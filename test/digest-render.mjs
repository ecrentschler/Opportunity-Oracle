// Renders the digest HTML to a file without needing SMTP. Proves the email
// body is well-formed using whatever opportunities are in the store.
import { writeFileSync } from "fs";
import { store } from "../src/store/db.js";
import { seedIfEmpty } from "../src/store/seed.js";
import { recurrenceForecasts } from "../src/enrichment/forecast.js";

seedIfEmpty();

// Seed with realistic data so the digest has something to render
const DAY = 86400000;
const fromNow = (n) => new Date(Date.now() + n*DAY).toISOString().slice(0,10);
const tdy = new Date().toISOString().slice(0,10);

function mkOpp(o){
  return { id: Math.random().toString(36).slice(2), title:"", category:"", description:"",
    sourceName:"test", sourceUrl:"", originalUrl:"", city:"", state:"MI", country:"USA",
    dateStart:"", deadline:"", applicationUrl:"", contactEmail:"", contactSocial:"",
    organizationName:"", venueName:"", payMin:0, payMax:0, fee:0,
    fitScore:60, urgencyScore:70, valueScore:55, rankScore:65,
    automationStatus:"Needs Human Input", status:"Found",
    reasons:[], warnings:[], autoReasons:[],
    prepUrgent:false, prepReason:"", prepStart:"", prepDays:7,
    relationshipBoost:false, dedupeKey:Math.random().toString(36),
    notes:"", createdAt:tdy, lastCheckedAt:tdy, ...o };
}
store.insert("opportunities", mkOpp({
  title:"Russell Industrial Center — Kettama booking inquiry",
  category:"DJ Booking", city:"Detroit", deadline:fromNow(16),
  payMax:400, rankScore:88,
  prepUrgent:true, prepReason:"prep starts in 2d — get ready (needs ~14d)", prepStart:fromNow(2),
}));
store.insert("opportunities", mkOpp({
  title:"DUCF 2026 vendor applications",
  category:"Vendor Market", city:"Detroit", deadline:fromNow(5),
  fee:35, rankScore:72,
}));
store.insert("opportunities", mkOpp({
  title:"Sunday Artisan Market — Ann Arbor jury",
  category:"Vendor Market", city:"Ann Arbor", deadline:fromNow(3),
  rankScore:65,
}));
store.insert("opportunities", mkOpp({
  title:"Lakes of Fire 2024", category:"Festival Application",
  deadline:"2024-03-08", status:"Archived",
}));
store.insert("opportunities", mkOpp({
  title:"Lakes of Fire 2025", category:"Festival Application",
  deadline:"2025-03-12", status:"Archived",
}));

// Now render
const { sendDigest } = await import("../src/jobs/digest.js");
// Force render path by setting recipient + a stub SMTP, then catch the html
process.env.DIGEST_TO = "test@local";
process.env.SMTP_HOST = "x"; process.env.SMTP_USER="x"; process.env.SMTP_PASS="x";

// We don't actually want to send — monkey-patch nodemailer transport
const nm = await import("nodemailer");
let captured = null;
nm.default.createTransport = () => ({
  sendMail: async (msg) => { captured = msg; return { messageId: "<test>" }; }
});

const result = await sendDigest();
console.log("send result:", result);
if (captured) {
  writeFileSync("/tmp/digest.html", captured.html);
  console.log("\nSUBJECT:", captured.subject);
  console.log("HTML length:", captured.html.length, "chars");
  console.log("written to /tmp/digest.html");

  // sanity assertions on the rendered HTML
  const checks = {
    "has prep-urgent section": captured.html.includes("Prep window open"),
    "has the prep-urgent opp": captured.html.includes("Kettama"),
    "has deadline section": captured.html.includes("Deadlines within 7 days"),
    "has DUCF": captured.html.includes("DUCF"),
    "has rank score": /rank \d+/.test(captured.html),
    "has subject summary": /open|deadline|new|quiet/i.test(captured.subject),
    "no unescaped HTML injection": !captured.html.includes("<script>alert"),
  };
  let pass=0, fail=0;
  for (const [k,v] of Object.entries(checks)) { console.log((v?"OK ":"MISS ")+k); v?pass++:fail++; }
  console.log(`\n${pass}/${pass+fail} digest assertions passed`);
}
process.exit(0);
