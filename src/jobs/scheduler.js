// src/jobs/scheduler.js
// Cron job that makes the Oracle "run on its own":
//   SCAN_CRON — scrape configured sources (default: every hour)
// Sequential + throttled. The email digest exists in digest.js but is not
// scheduled by default — the user opens the PWA instead. To enable digest,
// set DIGEST_TO + SMTP_* env vars AND uncomment the digest schedule below.
import cron from "node-cron";
import { runAllSources } from "../collectors/index.js";

const SCAN_CRON = process.env.SCAN_CRON || "0 * * * *";

export function startScheduler() {
  if (!cron.validate(SCAN_CRON)) {
    console.warn(`[scheduler] invalid SCAN_CRON "${SCAN_CRON}" — scheduler off`);
    return;
  }
  cron.schedule(SCAN_CRON, async () => {
    const t0 = Date.now();
    console.log(`[scan] starting @ ${new Date().toISOString()}`);
    try {
      const report = await runAllSources();
      const added = report.reduce((n, r) => n + (r.added || 0), 0);
      console.log(`[scan] done in ${((Date.now() - t0) / 1000) | 0}s — +${added} new across ${report.length} sources`);
    } catch (e) {
      console.error("[scan] failed:", e.message);
    }
  });
  console.log(`[scheduler] scan "${SCAN_CRON}"`);

  // Digest schedule — opt-in only. Uncomment + set DIGEST_TO/SMTP_* to enable.
  // (User chose PWA-first; no passive email pings by default.)
  //
  // import("./digest.js").then(({ sendDigest }) => {
  //   const DIGEST_CRON = process.env.DIGEST_CRON || "0 7 * * *";
  //   if (cron.validate(DIGEST_CRON) && process.env.DIGEST_TO) {
  //     cron.schedule(DIGEST_CRON, async () => { await sendDigest(); });
  //     console.log(`[scheduler] digest "${DIGEST_CRON}"`);
  //   }
  // });
}
