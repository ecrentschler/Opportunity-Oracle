// Verifies the /today filter logic directly (without going through HTTP),
// avoiding shell lifecycle issues. Tests the timestamp comparison fix.
import { store } from "../src/store/db.js";
import { seedIfEmpty } from "../src/store/seed.js";
import { enrich, rankScore } from "../src/enrichment/engine.js";

seedIfEmpty();
const profile = store.getProfile();

const DAY = 86400000;
const fromNow = (n) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

function makeOpp(o, createdAtIso = nowIso()) {
  const base = {
    id: Math.random().toString(36).slice(2),
    title: o.title || "Untitled",
    category: o.category || "DJ Booking",
    description: "", city: "", state: "MI", country: "USA",
    dateStart: "", deadline: "", applicationUrl: "", contactEmail: "",
    contactSocial: "", organizationName: "", venueName: "",
    payMin: 0, payMax: 0, fee: 0, status: "Found", notes: "",
    relationshipBoost: false, sourceName: "Test", sourceUrl: "", originalUrl: "",
    createdAt: createdAtIso, lastCheckedAt: new Date().toISOString().slice(0, 10),
    dedupeKey: Math.random().toString(36), ...o,
  };
  const s = enrich(base, profile);
  return { ...base, ...s, rankScore: rankScore(s) };
}

// Replicate the /today filter logic exactly
function todayFilter(since) {
  const live = store.all("opportunities")
    .filter((o) => !["Archived","Declined","Accepted"].includes(o.status));
  const today = new Date().toISOString().slice(0, 10);
  const daysFromToday = (d) => d ? Math.round((new Date(d) - new Date(today)) / DAY) : null;
  const prepUrgent = live.filter((o) => o.prepUrgent);
  const dueSoon = live.filter((o) => {
    const d = daysFromToday(o.deadline);
    return d !== null && d >= 0 && d <= 7 && !o.prepUrgent;
  });
  const newSince = live.filter((o) => (o.createdAt || "") > since);
  return {
    counts: {
      prepUrgent: prepUrgent.length,
      dueSoon: dueSoon.length,
      newSince: newSince.length,
      totalLive: live.length,
    },
    prepUrgent, dueSoon, newSince,
  };
}

console.log("=== test 1: empty store ===");
let r = todayFilter(new Date(Date.now() - 24*3600e3).toISOString());
console.log("counts:", r.counts);
console.log("expect: all 0");

console.log("\n=== test 2: seed 3 opps (1 prep-urgent, 1 due soon, 1 future) ===");
store.insert("opportunities", makeOpp({
  title: "Festival app (prep-urgent)", category: "Festival Application",
  deadline: fromNow(16),
}));
store.insert("opportunities", makeOpp({
  title: "Quick vendor market", category: "Vendor Market",
  deadline: fromNow(5), // prep is 7d, so this should ALSO be prep-urgent
}));
store.insert("opportunities", makeOpp({
  title: "Far-off festival", category: "Festival Application",
  deadline: fromNow(60),
}));

r = todayFilter(new Date(Date.now() - 10000).toISOString()); // since 10s ago
console.log("first visit (since=10s ago):");
console.log("  counts:", r.counts);
console.log("  prepUrgent:", r.prepUrgent.map(o => o.title));
console.log("  dueSoon:", r.dueSoon.map(o => o.title));

console.log("\n=== test 3: returning visit (since=now) — newSince should be 0 ===");
const justNow = new Date().toISOString();
// give a hair of clock slack
await new Promise(r => setTimeout(r, 100));
r = todayFilter(justNow);
console.log("counts:", r.counts);
console.log("expect: prepUrgent>=1, dueSoon as before, newSince=0");

console.log("\n=== test 4: add a new opp AFTER 'since' — should appear ===");
await new Promise(r => setTimeout(r, 100));
const cutoff = new Date().toISOString();
await new Promise(r => setTimeout(r, 100));
store.insert("opportunities", makeOpp({
  title: "Fresh new opp", deadline: fromNow(20),
}));
r = todayFilter(cutoff);
console.log("counts:", r.counts);
console.log("newSince:", r.newSince.map(o => o.title));
console.log("expect: newSince=1, title='Fresh new opp'");

// assertions
const pass1 = r.counts.newSince === 1 && r.newSince[0].title === "Fresh new opp";
console.log("\n" + (pass1 ? "✓ since-cutoff comparison correct" : "✗ FAIL: since-cutoff broken"));

process.exit(pass1 ? 0 : 1);
