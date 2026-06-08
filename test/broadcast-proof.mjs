// Proves the content broadcast generator produces well-formed posts in all
// three formats from real opportunity data. Run offline.
import { buildRoundup } from "../src/enrichment/broadcast.js";

const DAY = 86400000;
const fromNow = (n) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);

const opps = [
  { title: "Russell Industrial Center — booking inquiry", category: "DJ Booking",
    city: "Detroit", deadline: fromNow(12), payMax: 400, applicationUrl: "https://example.com/russell" },
  { title: "Detroit Ecstatic Dance — guest selector", category: "Ecstatic Dance / Movement",
    city: "Detroit", dateStart: fromNow(19), payMax: 150, contactSocial: "@detroitecstatic" },
  { title: "Sunday Artisan Market — A2 jury", category: "Vendor Market",
    city: "Ann Arbor", deadline: fromNow(6), fee: 0, applicationUrl: "https://example.com/sunday" },
  { title: "DUCF 2026 vendor applications", category: "Vendor Market",
    city: "Detroit", deadline: fromNow(40), fee: 35, applicationUrl: "https://example.com/ducf" },
  { title: "Ypsi utility box mural RFQ", category: "Public Art RFQ/RFP",
    city: "Ypsilanti", deadline: fromNow(21), payMax: 800, applicationUrl: "https://example.com/ypsi" },
  { title: "Lakes of Fire art grant", category: "Festival Application",
    city: "", deadline: fromNow(34), contactEmail: "art@lakesoffire.org" },
];

const r = buildRoundup(opps, "Open Call Oracle", "Michigan");

console.log("=== META ===");
console.log(JSON.stringify(r.meta, null, 2));

console.log("\n=== INSTAGRAM CAPTION ===\n");
console.log(r.instagram);

console.log("\n=== PLAIN TEXT ===\n");
console.log(r.plain);

console.log("\n=== NEWSLETTER HTML (first 400 chars) ===\n");
console.log(r.newsletterHtml.slice(0, 400));

// assertions
const checks = {
  "meta count = 6": r.meta.count === 6,
  "groups present": r.meta.groups.length >= 3,
  "IG has hashtags": r.instagram.includes("#detroitart"),
  "IG groups by label": r.instagram.includes("DJS") || r.instagram.includes("VENDORS"),
  "plain has links": r.plain.includes("https://example.com/russell"),
  "plain shows deadline+days": /apply by .+\(\d+d\)/.test(r.plain),
  "newsletter is HTML": r.newsletterHtml.includes("<h1") && r.newsletterHtml.includes("<ul"),
  "newsletter links opps": r.newsletterHtml.includes("href=\"https://example.com/ducf\""),
  "newsletter escapes safe": !r.newsletterHtml.includes("<script>"),
  "mural shows pay $800": r.plain.includes("$800"),
  "ducf shows fee": r.plain.includes("$35 fee"),
};
let pass = 0, fail = 0;
console.log("\n=== ASSERTIONS ===");
for (const [k, v] of Object.entries(checks)) { console.log((v ? "OK  " : "FAIL ") + k); v ? pass++ : fail++; }
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
