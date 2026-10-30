const list = document.querySelector("#monitor-list");
const template = document.querySelector("#monitor-template");
const errorBox = document.querySelector("#form-error");

async function api(url, options) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (!response.ok && response.status !== 204) throw new Error((await response.json()).error || "Something went wrong");
  return response.status === 204 ? null : response.json();
}
function relativeTime(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 1000));
  return seconds < 60 ? "just now" : `${Math.floor(seconds / 60)}m ago`;
}
function render(monitors) {
  document.querySelector("#total-count").textContent = monitors.length;
  document.querySelector("#up-count").textContent = monitors.filter(m => m.lastCheck?.status === "up").length;
  document.querySelector("#down-count").textContent = monitors.filter(m => m.lastCheck?.status === "down").length;
  list.replaceChildren();
  if (!monitors.length) { list.innerHTML = '<div class="empty"><h3>No monitors yet</h3><p>Add a public service above to begin checking its availability.</p></div>'; return; }
  monitors.forEach((monitor) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector("article"); const last = monitor.lastCheck;
    card.classList.add(last?.status || "pending");
    node.querySelector("h3").textContent = monitor.name;
    const link = node.querySelector("a"); link.href = monitor.url; link.textContent = monitor.url;
    node.querySelector(".status-dot").title = last?.status || "Pending";
    node.querySelector(".check-detail").textContent = last ? `${last.message} · ${last.responseTime}ms · ${relativeTime(last.at)}` : "Waiting for first check";
    (monitor.history || []).slice(0, 12).reverse().forEach(check => { const dot = document.createElement("span"); dot.className = `history-dot ${check.status}`; dot.title = `${check.status} — ${check.at}`; node.querySelector(".history").append(dot); });
    node.querySelector(".check").onclick = async (event) => { event.currentTarget.disabled = true; event.currentTarget.textContent = "Checking…"; try { await api(`/api/monitors/${monitor.id}/check`, { method: "POST" }); await load(); } catch (error) { alert(error.message); } };
    node.querySelector(".delete").onclick = async () => { if (confirm(`Remove ${monitor.name}?`)) { await api(`/api/monitors/${monitor.id}`, { method: "DELETE" }); await load(); } };
    list.append(node);
  });
}
async function load() { try { render(await api("/api/monitors")); } catch (error) { list.innerHTML = `<div class="empty"><p>${error.message}</p></div>`; } }
document.querySelector("#monitor-form").onsubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  errorBox.textContent = "";
  button.disabled = true;
  button.textContent = "Checking…";
  try {
    await api("/api/monitors", { method: "POST", body: JSON.stringify({ name: form.elements.name.value, url: form.elements.url.value }) });
    form.reset();
    await load();
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Add monitor";
  }
};
document.querySelector("#refresh-all").onclick = async (event) => { const monitors = await api("/api/monitors"); event.currentTarget.disabled = true; event.currentTarget.textContent = "Refreshing…"; await Promise.all(monitors.map(m => api(`/api/monitors/${m.id}/check`, { method: "POST" }))); event.currentTarget.disabled = false; event.currentTarget.textContent = "Refresh all"; await load(); };
load();
