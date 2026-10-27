const list = document.querySelector("#live-list");
const statusLine = document.querySelector("#sync-status");
const localKey = "ngoc-vy-workbench-items";
const endpoint = "https://super-tiramisu-bd4af1.netlify.app/.netlify/functions/items";
const kindNames = { note: "New Note", goal: "Progress Update", reminder: "Reminder" };

function localItems() {
  try { return JSON.parse(localStorage.getItem(localKey) || "[]"); }
  catch { return []; }
}

function saveLocal(items) {
  localStorage.setItem(localKey, JSON.stringify(items));
}

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function draw(items) {
  list.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "sync-status";
    empty.textContent = "";
    list.append(empty);
    return;
  }
  items.slice().reverse().forEach(item => {
    const row = document.createElement("article");
    row.className = "live-item";
    row.innerHTML = `<div><strong>${escapeText(item.title)}</strong><p>${escapeText(item.text)}</p></div><small>${escapeText(item.kindName)}</small>`;
    list.append(row);
  });
}

async function loadItems() {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("API unavailable");
    const items = await response.json();
    draw(items);
    statusLine.textContent = "";
    window.workbenchShared = true;
  } catch {
    draw(localItems());
    statusLine.textContent = "Local preview: updates are saved only in this browser until the site is published with shared storage.";
    window.workbenchShared = false;
  }
}

async function addItem(kind, title, text) {
  const item = { kind, kindName: kindNames[kind], title: title.trim(), text: text.trim(), createdAt: new Date().toISOString() };
  if (!item.title || !item.text) return;
  if (window.workbenchShared) {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
    if (!response.ok) throw new Error("Could not save update");
  } else {
    const items = localItems();
    items.push(item);
    saveLocal(items);
  }
  await loadItems();
}

function promptFor(kind) {
  const title = window.prompt(`${kindNames[kind]} — name`);
  if (!title) return;
  const text = window.prompt(`${kindNames[kind]} — details`);
  if (!text) return;
  addItem(kind, title, text).catch(() => {
    statusLine.textContent = "Could not save this update. Please try again.";
  });
}

document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", () => promptFor(button.dataset.action));
});

document.querySelector("#quick-form").addEventListener("submit", event => {
  event.preventDefault();
  const input = document.querySelector("#quick-input");
  const text = input.value.trim();
  if (!text) return;
  addItem("note", "New Note", text).then(() => { input.value = ""; }).catch(() => {
    statusLine.textContent = "Could not save this note. Please try again.";
  });
});

loadItems();
setInterval(loadItems, 15000);
