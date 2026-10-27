import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

const store = getStore("ngoc-vy-workbench-items");
const allowedKinds = new Set(["note", "goal", "reminder"]);
const kindNames = { note: "New Note", goal: "Progress Update", reminder: "Reminder" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  if (request.method === "GET") {
    const { blobs } = await store.list();
    const rows = await Promise.all(blobs.map(({ key }) => store.get(key, { type: "json" })));
    return json(rows.filter(Boolean).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let item;
  try { item = await request.json(); }
  catch { return json({ error: "Invalid request." }, 400); }

  if (!item || !allowedKinds.has(item.kind) || typeof item.title !== "string" || typeof item.text !== "string" || !item.title.trim() || !item.text.trim()) {
    return json({ error: "A type, name, and details are required." }, 400);
  }

  const record = {
    id: randomUUID(),
    kind: item.kind,
    kindName: kindNames[item.kind],
    title: item.title.trim().slice(0, 180),
    text: item.text.trim().slice(0, 3000),
    createdAt: new Date().toISOString()
  };

  await store.setJSON(record.id, record);
  return json({ ok: true, id: record.id }, 201);
};
