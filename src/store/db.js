// src/store/db.js
// Zero-dependency JSON store. No native build = bulletproof deploys.
// A single-user opportunity tracker doesn't need a SQL engine; pure JS
// keeps the whole thing Railway-friendly. Debounced + atomic writes.
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, writeFileSync, existsSync, renameSync } from "fs";

const __dir = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dir, "../../oracle-data.json");

const EMPTY = {
  sources: [], opportunities: [], contacts: [],
  assets: [], profile: null, crawl_logs: [],
  settings: { brand: "Open Call Oracle", region: "Michigan", publicFeedEnabled: false },
};

let data = { ...EMPTY };

(function load() {
  if (existsSync(DB_PATH)) {
    try { data = { ...EMPTY, ...JSON.parse(readFileSync(DB_PATH, "utf8")) }; }
    catch { data = { ...EMPTY }; }
  }
})();

let writeTimer = null;
function persist() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(flushNow, 120);
}
function flushNow() {
  clearTimeout(writeTimer);
  const tmp = DB_PATH + ".tmp";
  writeFileSync(tmp, JSON.stringify(data));
  renameSync(tmp, DB_PATH);
}
process.on("exit", flushNow);
process.on("SIGINT", () => { flushNow(); process.exit(0); });
process.on("SIGTERM", () => { flushNow(); process.exit(0); });

export const store = {
  all(coll) { return data[coll].slice(); },
  find(coll, id) { return data[coll].find((x) => x.id === id) || null; },
  insert(coll, row) { data[coll].push(row); persist(); return row; },
  insertUnique(coll, row, keyField = "dedupeKey") {
    if (row[keyField] && data[coll].some((x) => x[keyField] === row[keyField]))
      return false;
    data[coll].push(row); persist(); return true;
  },
  update(coll, id, patch) {
    const i = data[coll].findIndex((x) => x.id === id);
    if (i === -1) return null;
    data[coll][i] = { ...data[coll][i], ...patch };
    persist(); return data[coll][i];
  },
  remove(coll, id) {
    data[coll] = data[coll].filter((x) => x.id !== id);
    persist(); return { ok: true };
  },
  getProfile() { return data.profile; },
  setProfile(p) { data.profile = p; persist(); },
  getSettings() { return data.settings || { brand: "Open Call Oracle", region: "Michigan", publicFeedEnabled: false }; },
  setSettings(s) { data.settings = { ...this.getSettings(), ...s }; persist(); return data.settings; },
  count(coll) { return data[coll].length; },
};

export function logCrawl(sourceName, found, added, status, detail = "") {
  data.crawl_logs.unshift({
    ts: new Date().toISOString(), sourceName, found, added, status, detail,
  });
  data.crawl_logs = data.crawl_logs.slice(0, 200);
  persist();
}
