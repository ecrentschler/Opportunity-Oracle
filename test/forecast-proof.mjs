// Verifies forecast date math with realistic scenarios. Run offline.
//   node test/forecast-proof.mjs
import { leadTimeFields as leadTime, prepDaysFor } from "../src/enrichment/engine.js";
import { recurrenceForecasts, cadenceForecast } from "../src/enrichment/forecast.js";
import { store } from "../src/store/db.js";
import { seedIfEmpty } from "../src/store/seed.js";

const DAY = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const fromNow = (n) => iso(Date.now() + n * DAY);

seedIfEmpty();

console.log("=== 1. LEAD-TIME (proactive urgency) ===");
// Festival app due in 16 days; prep need 14 days -> should be prep-urgent NOW
const fest = { category: "Festival Application", deadline: fromNow(16) };
const lt1 = leadTime(fest);
console.log(`Festival due in 16d, prep ${lt1.prepDays}d:`);
console.log(`  prepStart=${lt1.prepStart} urgent=${lt1.prepUrgent} — "${lt1.prepReason}"`);
console.log(`  EXPECT urgent=true (16-14=2 days, window already open)\n`);

// DJ gig due in 16 days; prep 3 -> NOT urgent yet
const dj = { category: "DJ Booking", deadline: fromNow(16) };
const lt2 = leadTime(dj);
console.log(`DJ gig due in 16d, prep ${lt2.prepDays}d:`);
console.log(`  urgent=${lt2.prepUrgent} — "${lt2.prepReason}"`);
console.log(`  EXPECT urgent=false (plenty of runway)\n`);

console.log("=== 2. RECURRENCE (annual pattern) ===");
// Simulate a festival seen 2 prior years, both anchors in the past.
const mk = (title, deadline) => ({
  id: Math.random().toString(36).slice(2), title,
  category: "Festival Application", city: "", deadline,
  dateStart: "", status: "Archived",
});
store.insert("opportunities", mk("Lakes of Fire 2024 Art Grant", "2024-03-05"));
store.insert("opportunities", mk("Lakes of Fire 2025 Art Grant", "2025-03-08"));
const recs = recurrenceForecasts().filter((r) => /lakes of fire/i.test(r.sourceTitle));
if (recs.length) {
  const r = recs[0];
  console.log(`Forecast: "${r.title.trim()}"`);
  console.log(`  basis: ${r.basis}`);
  console.log(`  predicted window ~${r.predictedWindow} (${r.daysOut}d out)`);
  console.log(`  watch from ${r.watchFrom} · confidence=${r.confidence}`);
  console.log(`  EXPECT predicted ≈ early March 2026 (last 2025-03-08 + ~365d)\n`);
} else {
  console.log("  FAIL: no recurrence forecast produced\n");
}

console.log("=== 3. CADENCE (promoter rhythm — IG-safe) ===");
// Promoter posted afters every ~30d; last was 28d ago -> "expect soon"
const src = {
  id: "s1", name: "@nightcollective",
  postLog: [fromNow(-90), fromNow(-60), fromNow(-31), fromNow(-2)],
};
const c = cadenceForecast(src);
console.log(`@nightcollective postLog every ~${c.avgIntervalDays}d, last ${c.daysSinceLast}d ago:`);
console.log(`  expectedBy=${c.expectedBy} (${c.daysOut}d) actionable=${c.actionable}`);
console.log(`  note: "${c.note}"`);
console.log(`  EXPECT next ~30d after last post, flagged when close\n`);

// Overdue case
const src2 = { id: "s2", name: "@warehouse", postLog: [fromNow(-80), fromNow(-40), fromNow(-50)] };
const c2 = cadenceForecast(src2);
console.log(`@warehouse (gaps ~40d, last 40d ago):`);
console.log(`  ${c2.overdue ? "OVERDUE" : "on track"} — "${c2.note}"\n`);

console.log("=== prep-days table sanity ===");
for (const cat of ["Grant", "Festival Application", "DJ Booking", "Underground / Afterhours"])
  console.log(`  ${cat}: ${prepDaysFor(cat)}d`);

console.log("\nALL FORECAST TESTS RAN");
process.exit(0);
