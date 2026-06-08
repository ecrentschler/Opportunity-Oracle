// src/jobs/runDigest.js
// `npm run digest` — sends one digest immediately (for testing SMTP config).
import { seedIfEmpty } from "../store/seed.js";
import { sendDigest } from "./digest.js";

seedIfEmpty();
console.log("Sending digest…");
const r = await sendDigest();
if (r.sent) console.log("Digest sent.", r.summary);
else console.log("Digest NOT sent:", r.reason);
process.exit(0);
