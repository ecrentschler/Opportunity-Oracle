// src/jobs/runScan.js
// One-shot scan from the CLI: `npm run scan`
import { seedIfEmpty } from "../store/seed.js";
import { runAllSources } from "../collectors/index.js";

seedIfEmpty();
console.log("Running full scan…");
const report = await runAllSources();
for (const r of report)
  console.log(`  ${r.source}: found ${r.found}, added ${r.added} (${r.status})`);
const added = report.reduce((n, r) => n + (r.added || 0), 0);
console.log(`\nTotal new opportunities: ${added}`);
process.exit(0);
