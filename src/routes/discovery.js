// src/routes/discovery.js
import { store } from "../store/db.js";
const BRAVE_SAFETY_CAP = 900;
const MAX_QUERIES_PER_HUNT = 12;
const ym = () => new Date().toISOString().slice(0, 7);
export function readUsage() {
const s = store.getSettings() || {};
const u = s.braveUsage;
if (!u || u.month !== ym()) return { month: ym(), count: 0, cap: BRAVE_SAFETY_CAP };
return { month: u.month, count: u.count, cap: BRAVE_SAFETY_CAP };
}
function writeUsage(u) {
store.setSettings({ braveUsage: { month: u.month, count: u.count } });
}
async function braveSearch(key, q) {
const url = "https://api.search.brave.com/res/v1/web/search?count=10&freshness=py&q=" + encodeURIComponent(q);
const r = await fetch(url, { headers: { "X-Subscription-Token": key, Accept: "application/json" } });
if (!r.ok) throw new Error("brave_status_" + r.status);
const data = await r.json();
return ((data.web && data.web.results) || []).map((x) => {
let site = "";
try { site = new URL(x.url).hostname.replace("www.", ""); } catch (e) {}
return { title: x.title || "", url: x.url || "", description: (x.description || "").replace(/<[^>]+>/g, ""), site };
});
}
export async function runHunt(key, queries) {
const bounded = (queries || []).slice(0, MAX_QUERIES_PER_HUNT);
let usage = readUsage();
const out = [];
const YEAR = String(new Date().getFullYear());
for (let q of bounded) {
if (usage.count >= BRAVE_SAFETY_CAP) break;
if (!/20[2-9]\d/.test(q)) q = q + " " + YEAR;
let hits = [];
try { hits = await braveSearch(key, q); } catch (e) { hits = []; }
usage.count += 1;
for (const h of hits) out.push({ title: h.title, url: h.url, description: h.description, site: h.site, foundVia: q });
}
writeUsage(usage);
const CUR = new Date().getFullYear();
const freshOnly = out.filter((o) => {
const m = ((o.title || "") + " " + (o.description || "")).match(/20[2-9]\d/g);
if (!m) return true; // no year mentioned - keep, can't prove stale
return Math.max.apply(null, m.map(Number)) >= CUR; // newest year is this year or later
});
const seen = new Set(); const deduped = [];
for (const o of freshOnly) { if (o.url && !seen.has(o.url)) { seen.add(o.url); deduped.push(o); } }
return { usage: { month: usage.month, count: usage.count, cap: BRAVE_SAFETY_CAP }, results: deduped };
}