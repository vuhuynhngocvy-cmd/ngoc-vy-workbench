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
    statusLine.textContent = "Local preview: updates are saved only in this browser until the shared service is available.";
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

const entryStyle = document.createElement("style");
entryStyle.textContent = `
  #workbench-entry-layer { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; padding: 18px; background: rgba(48, 36, 31, .36); backdrop-filter: blur(3px); }
  #workbench-entry-layer[hidden] { display: none !important; }
  .workbench-entry-card { width: min(460px, 100%); padding: 24px; border: 1px solid #eadbd3; border-radius: 20px; background: #fffaf7; color: #30241f; box-shadow: 0 18px 50px rgba(48, 36, 31, .2); font-family: Inter, "Segoe UI", Arial, sans-serif; }
  .workbench-entry-card h2 { margin: 0 0 18px; font-size: 21px; }
  .workbench-entry-fields { display: grid; gap: 13px; }
  .workbench-entry-fields label { display: grid; gap: 6px; color: #66544c; font-size: 13px; font-weight: 650; }
  .workbench-entry-fields input, .workbench-entry-fields textarea { width: 100%; padding: 11px 12px; border: 1px solid #eadbd3; border-radius: 10px; background: #fff; color: #30241f; font: inherit; font-weight: 400; }
  .workbench-entry-fields textarea { min-height: 120px; resize: vertical; }
  .workbench-entry-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 18px; }
  .workbench-entry-actions button { padding: 10px 14px; border: 0; border-radius: 10px; background: #df8052; color: #fff; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
  .workbench-entry-actions button[data-entry-cancel] { background: #f2e6df; color: #66544c; }
  .workbench-entry-actions button:disabled { opacity: .65; cursor: wait; }
  .workbench-entry-error { margin: 12px 0 0; color: #a33b2e; font-size: 12px; }
`;
document.head.append(entryStyle);

const entryLayer = document.createElement("div");
entryLayer.id = "workbench-entry-layer";
entryLayer.hidden = true;
entryLayer.innerHTML = `
  <section class="workbench-entry-card" role="dialog" aria-modal="true" aria-labelledby="workbench-entry-title">
    <h2 id="workbench-entry-title"></h2>
    <form id="workbench-entry-form">
      <div class="workbench-entry-fields">
        <label>Title<input id="workbench-entry-title-input" name="title" maxlength="180" required></label>
        <label>Details<textarea id="workbench-entry-details" name="details" maxlength="3000" required></textarea></label>
      </div>
      <p class="workbench-entry-error" id="workbench-entry-error" role="alert" hidden></p>
      <div class="workbench-entry-actions">
        <button type="button" data-entry-cancel>Cancel</button>
        <button type="submit" data-entry-save>Save</button>
      </div>
    </form>
  </section>
`;
document.body.append(entryLayer);

const entryForm = entryLayer.querySelector("#workbench-entry-form");
const entryTitle = entryLayer.querySelector("#workbench-entry-title");
const titleInput = entryLayer.querySelector("#workbench-entry-title-input");
const detailsInput = entryLayer.querySelector("#workbench-entry-details");
const entryError = entryLayer.querySelector("#workbench-entry-error");
const saveButton = entryLayer.querySelector("[data-entry-save]");
let activeKind = "note";
let returnFocus = null;

function closeEntry() {
  entryLayer.hidden = true;
  if (returnFocus instanceof HTMLElement) returnFocus.focus();
}

function openEntry(kind, trigger) {
  activeKind = kind;
  returnFocus = trigger;
  entryTitle.textContent = kindNames[kind] || "New update";
  titleInput.value = "";
  detailsInput.value = "";
  entryError.hidden = true;
  entryError.textContent = "";
  entryLayer.hidden = false;
  titleInput.focus();
}

entryLayer.addEventListener("click", event => {
  if (event.target === entryLayer || event.target.closest("[data-entry-cancel]")) closeEntry();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !entryLayer.hidden) closeEntry();
});

entryForm.addEventListener("submit", async event => {
  event.preventDefault();
  saveButton.disabled = true;
  entryError.hidden = true;
  try {
    await addItem(activeKind, titleInput.value, detailsInput.value);
    closeEntry();
  } catch {
    entryError.textContent = "Could not save this update. Please try again.";
    entryError.hidden = false;
  } finally {
    saveButton.disabled = false;
  }
});

document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", () => openEntry(button.dataset.action, button));
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
