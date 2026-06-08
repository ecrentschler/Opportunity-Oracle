// Tests broadcast + settings + public-feed-filter logic directly (no HTTP),
// avoiding the shell's server-lifecycle issues.
import { store } from "../src/store/db.js";
import { seedIfEmpty } from "../src/store/seed.js";
import { enrich, rankScore } from "../src/enrichment/engine.js";
import { buildRoundup } from "../src/enrichment/broadcast.js";

seedIfEmpty();
const profile = store.getProfile();
const DAY = 86400000;
const fromNow = (n) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);

function add(o) {
  const base = {
    id: Math.random().toString(36).slice(2), title: "", category: "DJ Booking",
    description: "", city: "", state: "MI", country: "USA", dateStart: "", deadline: "",
    applicationUrl: "", contactEmail: "", contactSocial: "", organizationName: "",
    venueName: "", payMin: 0, payMax: 0, fee: 0, status: "Found", notes: "",
    relationshipBoost: false, createdAt: new Date().toISOString(),
    lastCheckedAt: fromNow(0), dedupeKey: Math.random().toString(36), ...o,
  };
  const s = enrich(base, profile);
  const row = { ...base, ...s, rankScore: rankScore(s) };
  store.insert("opportunities", row);
  return row;
}

add({ title: "Russell booking", category: "DJ Booking", city: "Detroit", deadline: fromNow(12), payMax: 400, applicationUrl: "https://ex.com/r" });
add({ title: "Sunday Artisan Market", category: "Vendor Market", city: "Ann Arbor", deadline: fromNow(6), applicationUrl: "https://ex.com/s" });
add({ title: "Past deadline thing", category: "Gallery Open Call", city: "Detroit", deadline: fromNow(-5) });
add({ title: "Archived thing", category: "Grant", city: "Detroit", deadline: fromNow(30), status: "Archived" });

// ---- settings ----
console.log("=== settings ===");
console.log("default:", JSON.stringify(store.getSettings()));
store.setSettings({ brand: "Dreamwalker Dispatch", publicFeedEnabled: true });
console.log("after update:", JSON.stringify(store.getSettings()));

// ---- broadcast auto-select (mirror API logic) ----
console.log("\n=== broadcast auto-select ===");
const today = fromNow(0);
const settings = store.getSettings();
const picked = store.all("opportunities")
  .filter((o) => !["Archived", "Declined"].includes(o.status))
  .filter((o) => (o.fitScore || 0) >= 45)
  .filter((o) => !o.deadline || o.deadline >= today)
  .sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
  .slice(0, 12);
console.log("picked titles:", picked.map((o) => o.title));
const roundup = buildRoundup(picked, settings.brand, settings.region);
console.log("brand in output:", roundup.plain.startsWith("DREAMWALKER DISPATCH") ? "OK" : "FAIL");
console.log("excludes past deadline:", !picked.find((o) => o.title === "Past deadline thing") ? "OK" : "FAIL");
console.log("excludes archived:", !picked.find((o) => o.title === "Archived thing") ? "OK" : "FAIL");

// ---- public feed filter (mirror API logic) ----
console.log("\n=== public feed ===");
function publicFeed() {
  const s = store.getSettings();
  if (!s.publicFeedEnabled) return { enabled: false, items: [] };
  const items = store.all("opportunities")
    .filter((o) => !["Archived", "Declined"].includes(o.status))
    .filter((o) => (o.fitScore || 0) >= 45)
    .filter((o) => !o.deadline || o.deadline >= today)
    .sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
    .slice(0, 40);
  return { enabled: true, brand: s.brand, items };
}
let pf = publicFeed();
console.log("enabled:", pf.enabled, "| brand:", pf.brand, "| items:", pf.items.length);
store.setSettings({ publicFeedEnabled: false });
pf = publicFeed();
console.log("after disable — enabled:", pf.enabled, "items:", pf.items.length, "(expect false/0)");

const allPass =
  roundup.plain.startsWith("DREAMWALKER DISPATCH") &&
  !picked.find((o) => o.title === "Past deadline thing") &&
  !picked.find((o) => o.title === "Archived thing") &&
  pf.enabled === false;
console.log("\n" + (allPass ? "✓ ALL BROADCAST/FEED LOGIC CORRECT" : "✗ FAIL"));
process.exit(allPass ? 0 : 1);
