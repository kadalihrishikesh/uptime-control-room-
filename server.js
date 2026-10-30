const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
require("dotenv").config();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "monitors.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const AWS_REGION = process.env.AWS_REGION;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const s3Client = S3_BUCKET_NAME ? new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
}) : null;

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]\n");
}

function readMonitors() {
  ensureStore();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeMonitors(monitors) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(monitors, null, 2)}\n`);
}

function send(res, status, body, contentType = "application/json") {
  res.writeHead(status, { "Content-Type": `${contentType}; charset=utf-8`, "Cache-Control": "no-store" });
  res.end(contentType === "application/json" ? JSON.stringify(body) : body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 20_000) req.destroy();
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("Invalid JSON body")); }
    });
  });
}

function validateUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Enter a valid URL, including https://"); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Only HTTP and HTTPS URLs can be monitored");
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error("Local addresses cannot be monitored");
  return url.toString();
}

async function writeS3CheckLog(monitor, result) {
  if (!s3Client) return;

  const timestamp = result.at;
  const date = timestamp.slice(0, 10);
  const logEntry = {
    monitorName: monitor.name,
    monitorId: monitor.id,
    status: result.status,
    timestamp,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTime
  };
  const key = `uptime-checks/${date}/${timestamp.replaceAll(":", "-")}-${monitor.id}-${randomUUID()}.json`;

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(logEntry),
      ContentType: "application/json"
    }));
  } catch (error) {
    // A logging failure must not turn a completed availability check into an API failure.
    const reason = [error.name, error.Code || error.code, error.message]
      .filter(Boolean)
      .join(" — ");
    console.error(`S3 audit-log upload failed: ${reason || "UnknownError"}`);
  }
}

async function runCheck(monitor) {
  const started = performance.now();
  let result;
  try {
    const response = await fetch(monitor.url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Uptime-Control-Room/1.0" }
    });
    const responseTime = Math.round(performance.now() - started);
    result = {
      at: new Date().toISOString(),
      status: response.ok ? "up" : "down",
      statusCode: response.status,
      responseTime,
      message: response.ok ? "Reachable" : `Returned HTTP ${response.status}`
    };
  } catch (error) {
    result = {
      at: new Date().toISOString(), status: "down", statusCode: null,
      responseTime: Math.round(performance.now() - started),
      message: error.name === "TimeoutError" ? "Request timed out" : "Connection failed"
    };
  }
  monitor.history = [result, ...(monitor.history || [])].slice(0, 30);
  monitor.lastCheck = result;
  await writeS3CheckLog(monitor, result);
  return result;
}

function serveStatic(req, res) {
  const requestPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.resolve(PUBLIC_DIR, `.${requestPath.split("?")[0]}`);
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) return send(res, 404, { error: "Not found" });
  const ext = path.extname(filePath);
  const types = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript" };
  send(res, 200, fs.readFileSync(filePath, "utf8"), types[ext] || "text/plain");
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/monitors") return send(res, 200, readMonitors());
    if (req.method === "POST" && req.url === "/api/monitors") {
      const body = await parseBody(req);
      const monitor = { id: randomUUID(), name: String(body.name || "").trim().slice(0, 70), url: validateUrl(body.url), createdAt: new Date().toISOString(), history: [] };
      if (!monitor.name) monitor.name = new URL(monitor.url).hostname;
      await runCheck(monitor);
      const monitors = readMonitors(); monitors.unshift(monitor); writeMonitors(monitors);
      return send(res, 201, monitor);
    }
    const checkMatch = req.url.match(/^\/api\/monitors\/([\w-]+)\/check$/);
    if (req.method === "POST" && checkMatch) {
      const monitors = readMonitors();
      const monitor = monitors.find((item) => item.id === checkMatch[1]);
      if (!monitor) return send(res, 404, { error: "Monitor not found" });
      await runCheck(monitor); writeMonitors(monitors); return send(res, 200, monitor);
    }
    const deleteMatch = req.url.match(/^\/api\/monitors\/([\w-]+)$/);
    if (req.method === "DELETE" && deleteMatch) {
      const monitors = readMonitors(); const next = monitors.filter((item) => item.id !== deleteMatch[1]);
      if (next.length === monitors.length) return send(res, 404, { error: "Monitor not found" });
      writeMonitors(next); return send(res, 204, "", "text/plain");
    }
    if (req.method === "GET") return serveStatic(req, res);
    send(res, 405, { error: "Method not allowed" });
  } catch (error) {
    send(res, 400, { error: error.message || "Request failed" });
  }
});

ensureStore();
server.listen(PORT, HOST, () => {
  console.log(`Uptime Control Room running at http://${HOST}:${PORT}`);
  console.log(`S3 audit logging: ${s3Client ? "enabled" : "disabled (S3_BUCKET_NAME is missing)"}`);
});
