// src/enrichment/forecast.js
// Answers the real need: "know before it happens, with timing."
// Three mechanisms, none of which require scraping a closed platform:
//   1) recurrence  — annual/seasonal repeats predicted from history
//   2) cadence     — per-source posting rhythm ("expect a drop soon")
//   3) lead-time   — urgency fires at (deadline - prep time), not deadline
import { store } from "../store/db.js";
import { prepDaysFor } from "./engine.js";

const today = () => new Date().toISOString().slice(0, 10);
const DAY = 86400000;
const toD = (s) => (s ? new Date(s + "T00:00:00") : null);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(toD(s).getTime() + n * DAY));
const daysBetween = (a, b) => Math.round((toD(b) - toD(a)) / DAY);

// Lead-time logic now lives in engine.js (single source of truth) and is
// merged during enrich(). This module keeps only the store-backed
// forecasts: recurrence (history) and cadence (source rhythm).

/**
 * Recurrence forecast. Looks at archived/past opportunities and projects
 * the next likely window for anything that looks annual/seasonal.
 * A match = same-ish title seen before with a date now in the past.
 */
export function recurrenceForecasts() {
  const all = store.all("opportunities");
  const norm = (t) =>
    (t || "").toLowerCase().replace(/\b(20\d\d|'?\d\d)\b/g, "")
      .replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

  // group by normalized title (year-stripped)
  const groups = new Map();
  for (const o of all) {
    const anchor = o.deadline || o.dateStart;
    if (!anchor) continue;
    const k = norm(o.title);
    if (k.length < 6) continue;
    (groups.get(k) || groups.set(k, []).get(k)).push({ ...o, anchor });
  }

  const out = [];
  const tdy = today();
  for (const [, items] of groups) {
    items.sort((a, b) => (a.anchor < b.anchor ? -1 : 1));
    const last = items[items.length - 1];
    const lastPassed = daysBetween(tdy, last.anchor) < 0;
    if (!lastPassed) continue; // only forecast things whose last instance is over

    // estimate cycle: avg gap between successive anchors, default ~365
    let cycle = 365;
    if (items.length >= 2) {
      let gaps = [];
      for (let i = 1; i < items.length; i++)
        gaps.push(daysBetween(items[i - 1].anchor, items[i].anchor));
      gaps = gaps.filter((g) => g > 30); // ignore dupes
      if (gaps.length) cycle = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    }
    const prep = prepDaysFor(last.category);
    // Roll forward by whole cycles until the prediction is in the future
    // (a 2024/2025 pattern should predict the NEXT one, not a past date).
    let predicted = addDays(last.anchor, cycle);
    let guard = 0;
    while (daysBetween(tdy, predicted) < -7 && guard++ < 12)
      predicted = addDays(predicted, cycle);
    const dOut = daysBetween(tdy, predicted);
    if (dOut < -7 || dOut > 400) continue; // keep it relevant
    out.push({
      kind: "recurrence",
      title: last.title.replace(/\b20\d\d\b/g, "").trim(),
      category: last.category,
      city: last.city,
      basis: items.length === 1
        ? `seen once (${last.anchor}) — assuming annual`
        : `${items.length} prior cycles, ~${cycle}d apart`,
      predictedWindow: predicted,
      windowStart: addDays(predicted, -14),
      watchFrom: addDays(predicted, -(prep + 14)),
      daysOut: dOut,
      confidence: items.length >= 2 ? "pattern" : "guess",
      sourceTitle: last.title,
    });
  }
  return out.sort((a, b) => a.daysOut - b.daysOut);
}

/**
 * Cadence forecast for watchlist sources. Tracks observed post timestamps
 * per source; if the average interval has nearly elapsed, predict a drop.
 * Works on IG/FB-origin sources because it predicts from rhythm, not content.
 * `postLog` lives on the source row: array of ISO dates the source produced.
 */
export function cadenceForecast(source) {
  const log = (source.postLog || []).slice().sort();
  if (log.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < log.length; i++) gaps.push(daysBetween(log[i - 1], log[i]));
  const valid = gaps.filter((g) => g >= 1);
  if (!valid.length) return null;
  const avg = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  const last = log[log.length - 1];
  const since = daysBetween(last, today());
  const due = addDays(last, avg);
  const dOut = daysBetween(today(), due);
  return {
    kind: "cadence",
    source: source.name,
    avgIntervalDays: avg,
    daysSinceLast: since,
    expectedBy: due,
    daysOut: dOut,
    overdue: dOut < 0,
    note:
      dOut < 0
        ? `overdue by ${-dOut}d — check ${source.name} now`
        : dOut <= Math.max(3, avg * 0.15)
        ? `expect a post from ${source.name} in ~${dOut}d — check soon`
        : `next expected ~${due}`,
    actionable: dOut <= Math.max(3, avg * 0.15),
  };
}

/** Record that a source produced something today (feeds cadence). */
export function noteSourcePost(source) {
  const log = (source.postLog || []).slice();
  const t = today();
  if (log[log.length - 1] !== t) log.push(t);
  store.update("sources", source.id, { postLog: log.slice(-30) });
}
