// Proves the collection pipeline deterministically using local fixtures.
// This sandbox/your-machine can run it offline to verify scoring works
// end-to-end: parse -> classify -> score -> dedupe -> persist.
//   node test/pipeline-proof.mjs
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import Parser from "rss-parser";
import { parseIntake } from "../src/enrichment/parser.js";
import { enrich, rankScore } from "../src/enrichment/engine.js";
import { store } from "../src/store/db.js";
import { seedIfEmpty } from "../src/store/seed.js";

const FX = new URL("./fixture-feed.xml", import.meta.url).pathname;
seedIfEmpty();
const profile = store.getProfile();
console.log("Profile:", profile.artistName, "| radius", profile.radiusMiles, "mi\n");

const rss = new Parser();
const feed = await rss.parseString(readFileSync(FX, "utf8"));
console.log("RSS parsed:", feed.items.length, "items\n");

let added = 0;
for (const it of feed.items) {
  const parsed = parseIntake([it.title, it.contentSnippet || it.content || ""].join("\n"));
  const base = {
    id: Math.random().toString(36).slice(2), title: it.title,
    description: (it.contentSnippet || it.content || "").slice(0, 600),
    category: parsed.category, city: parsed.city || "",
    dateStart: parsed.dateStart || "", deadline: parsed.deadline || "",
    contactEmail: parsed.contactEmail || "",
    applicationUrl: parsed.applicationUrl || it.link || "",
    payMin: parsed.payMin || 0, payMax: parsed.payMax || 0, fee: parsed.fee || 0,
    organizationName: parsed.organizationName || "", venueName: parsed.venueName || "",
    status: "Found", relationshipBoost: false,
    dedupeKey: (it.title || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40),
  };
  const s = enrich(base, profile);
  if (store.insertUnique("opportunities", { ...base, ...s, rankScore: rankScore(s) })) added++;
  console.log("• " + it.title.slice(0, 56));
  console.log("  cat " + s.category + " | city=" + (base.city||"—") +
    " dl=" + (base.deadline||"—") + " pay=$" + base.payMax + " fee=$" + base.fee);
  console.log("  fit " + s.fitScore + " urg " + s.urgencyScore +
    " val " + s.valueScore + " RANK " + rankScore(s) + " | " + s.automationStatus);
  console.log("  why: " + (s.reasons[0]||"—") + (s.reasons[1]?" / "+s.reasons[1]:"") + "\n");
}
let dupes = 0;
for (const it of feed.items)
  if (!store.insertUnique("opportunities",
    { id:"x", dedupeKey:(it.title||"").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,40) })) dupes++;
console.log("─".repeat(50));
console.log(added + " scored & persisted | dedupe blocked " +
  dupes + "/" + feed.items.length + " on re-scan | store=" +
  store.count("opportunities"));
process.exit(0);
