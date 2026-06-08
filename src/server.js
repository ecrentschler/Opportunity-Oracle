// src/server.js
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { api } from "./routes/api.js";
import { seedIfEmpty } from "./store/seed.js";
import { startScheduler } from "./jobs/scheduler.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));

const seeded = seedIfEmpty();
if (seeded) console.log("[seed] first run — Draem profile + curated sources loaded");

app.use("/api", api);
app.use(express.static(join(__dir, "../public")));
// Public read-only feed page (shareable, no login)
app.get("/feed", (_q, res) => res.sendFile(join(__dir, "../public/feed.html")));
app.get("*", (_q, res) => res.sendFile(join(__dir, "../public/index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Opportunity Oracle — running on http://localhost:${PORT}`);
  console.log(`  Scanner active. Trigger a scan now from the UI or: npm run scan\n`);
  startScheduler();
});
