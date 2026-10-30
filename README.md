# Uptime Control Room

A deliberately small uptime-monitoring web app that gives an infrastructure project a real service to deploy and operate.

## Run locally

Requires Node.js 18+.

```powershell
node --version
npm install
node server.js
```

Open `http://127.0.0.1:3000`. Monitors and their last 30 checks are persisted in `data/monitors.json`.

## Run with Docker

```powershell
docker build -t uptime-control-room .
docker run --rm -p 3000:3000 -v "${PWD}/data:/app/data" uptime-control-room
```

## Current scope

- Create and remove public HTTP/HTTPS URL monitors
- Manual individual or bulk checks
- Response time, HTTP status, and recent-check history
- Local JSON persistence

The next infrastructure phases will replace local persistence and manual checks with AWS managed services, scheduled workers, monitoring, alerting, and CI/CD.

## Optional S3 check logs

Every completed monitor check can be written as an individual JSON object in an S3 bucket. Copy `.env.example` to `.env`, provide the bucket name, region, and credentials for an IAM principal with `s3:PutObject` access to that bucket. Never commit `.env`.

Each object is stored under `uptime-checks/YYYY-MM-DD/` and contains the monitor name, status, timestamp, HTTP status code, and response time. S3 logging is disabled when `S3_BUCKET_NAME` is absent, and an S3 upload failure does not make the uptime check fail.
