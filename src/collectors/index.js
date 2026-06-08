// src/collectors/index.js
// Dispatches sources to collectors, scores via the shared engine, dedupes,
// persists. This is the heart of "scans on its own."
import { collectRSS } from "./rssCollector.js";
import { collectGeneric } from "./genericWebsiteCollector.js";
import { enrich, rankScore } from "../enrichment/engine.js";
import { noteSourcePost } from "../enrichment/forecast.js";
import { store, logCrawl } from "../store/db.js";

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);

function dedupeKey(o) {
  return (
    (o.title || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40) + "|" +
    (o.city || "").toLowerCase().slice(0, 12) + "|" +
    (o.deadline || o.dateStart || "")
  );
}

export async function runCollector(source) {
  let result;
  try {
    result =
      source.type === "rss"
        ? await collectRSS(source)
        : await collectGeneric(source);
  } catch (e) {
    logCrawl(source.name, 0, 0, "error", e.message);
    return { source: source.name, found: 0, added: 0, status: "error" };
  }

  const profile = store.getProfile();
  let added = 0;

  for (const raw of result.items) {
    if (!raw.title || raw.title.length < 4) continue;
    // require at least one actionable anchor — no contentless noise
    if (!raw.dateStart && !raw.deadline && !raw.applicationUrl && !raw.contactEmail)
      continue;

    const base = {
      id: uid(),
      title: raw.title,
      category: raw.category || "Networking Lead",
      description: raw.description || "",
      sourceName: raw.sourceName || source.name,
      sourceUrl: raw.sourceUrl || source.url,
      originalUrl: raw.originalUrl || "",
      city: raw.city || source.city || "",
      state: raw.state || "", country: raw.country || "USA",
      dateStart: raw.dateStart || "", deadline: raw.deadline || "",
      applicationUrl: raw.applicationUrl || "",
      contactEmail: raw.contactEmail || "", contactSocial: raw.contactSocial || "",
      organizationName: raw.organizationName || "", venueName: raw.venueName || "",
      payMin: raw.payMin || 0, payMax: raw.payMax || 0, fee: raw.fee || 0,
      status: "Found", notes: "", relationshipBoost: false,
      createdAt: new Date().toISOString(), lastCheckedAt: today(),
    };

    const scored = profile ? enrich(base, profile) : base;
    const row = {
      ...base, ...scored,
      rankScore: profile ? rankScore(scored) : 0,
      dedupeKey: dedupeKey(base),
    };

    if (store.insertUnique("opportunities", row)) added++;
  }

  store.update("sources", source.id, {
    lastChecked: new Date().toISOString(),
    lastStatus: result.status,
  });
  // if this source actually produced opportunities, log it as a "post"
  // so cadence forecasting learns how often this source bears fruit
  if (result.found > 0) {
    const fresh = store.find("sources", source.id);
    if (fresh) noteSourcePost(fresh);
  }
  logCrawl(source.name, result.found, added, result.status);
  return { source: source.name, found: result.found, added, status: result.status };
}

export async function runAllSources() {
  const sources = store.all("sources").filter((s) => s.enabled);
  const report = [];
  for (const s of sources) report.push(await runCollector(s)); // sequential = polite
  return report;
}
