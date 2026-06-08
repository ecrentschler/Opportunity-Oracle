// src/routes/api.js
import express from "express";
import { store } from "../store/db.js";
import { runAllSources, runCollector } from "../collectors/index.js";
import { enrich, rankScore } from "../enrichment/engine.js";
import { parseIntake } from "../enrichment/parser.js";
import { recurrenceForecasts, cadenceForecast } from "../enrichment/forecast.js";
import { buildRoundup } from "../enrichment/broadcast.js";

export const api = express.Router();
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);

function scoreOf(o) {
  const p = store.getProfile();
  if (!p) return { ...o, rankScore: 0 };
  const s = enrich(o, p);
  return { ...o, ...s, rankScore: rankScore(s) };
}

// ---- opportunities ----
api.get("/opportunities", (_q, res) => {
  res.json(
    store.all("opportunities").sort(
      (a, b) => (b.rankScore || 0) - (a.rankScore || 0)
    )
  );
});

api.post("/opportunities", (req, res) => {
  const o = {
    id: uid(), title: "New opportunity", category: "Networking Lead",
    description: "", city: "", state: "", country: "USA",
    dateStart: "", deadline: "", applicationUrl: "", contactEmail: "",
    contactSocial: "", organizationName: "", venueName: "",
    payMin: 0, payMax: 0, fee: 0, status: "Found", notes: "",
    relationshipBoost: false, sourceName: "Manual", sourceUrl: "",
    originalUrl: "", createdAt: new Date().toISOString(), lastCheckedAt: today(),
    dedupeKey: "manual-" + uid(), ...req.body,
  };
  const full = scoreOf(o);
  store.insert("opportunities", full);
  res.json(full);
});

api.put("/opportunities/:id", (req, res) => {
  const cur = store.find("opportunities", req.params.id);
  if (!cur) return res.status(404).json({ error: "not found" });
  const full = scoreOf({ ...cur, ...req.body });
  res.json(store.update("opportunities", req.params.id, full));
});

api.delete("/opportunities/:id", (req, res) =>
  res.json(store.remove("opportunities", req.params.id))
);

// ---- paste intake ----
api.post("/intake", (req, res) =>
  res.json(parseIntake(req.body.text || ""))
);

// ---- scan ----
api.post("/scan", async (_q, res) => {
  const report = await runAllSources();
  res.json({ ranAt: new Date().toISOString(), report });
});
api.post("/scan/:sourceId", async (req, res) => {
  const s = store.find("sources", req.params.sourceId);
  if (!s) return res.status(404).json({ error: "no source" });
  res.json(await runCollector(s));
});

// ---- sources ----
api.get("/sources", (_q, res) => res.json(store.all("sources")));
api.post("/sources", (req, res) => {
  const s = {
    id: uid(), enabled: 1, lastChecked: "", lastStatus: "", notes: "",
    type: "website", city: "", categories: "", ...req.body,
  };
  store.insert("sources", s);
  res.json(s);
});
api.put("/sources/:id", (req, res) => {
  const u = store.update("sources", req.params.id, req.body);
  if (!u) return res.status(404).json({ error: "no source" });
  res.json(u);
});
api.delete("/sources/:id", (req, res) =>
  res.json(store.remove("sources", req.params.id))
);

// ---- profile / assets / contacts / logs ----
api.get("/profile", (_q, res) => res.json(store.getProfile()));
api.put("/profile", (req, res) => {
  store.setProfile(req.body);
  // re-score every opportunity against the new profile
  for (const o of store.all("opportunities"))
    store.update("opportunities", o.id, scoreOf(o));
  res.json({ ok: true });
});

api.get("/assets", (_q, res) => res.json(store.all("assets")));
api.post("/assets", (req, res) => {
  const a = { id: uid(), type: "", content: "", ...req.body };
  store.insert("assets", a);
  res.json(a);
});
api.put("/assets/:id", (req, res) =>
  res.json(store.update("assets", req.params.id, req.body))
);
api.delete("/assets/:id", (req, res) =>
  res.json(store.remove("assets", req.params.id))
);

api.get("/contacts", (_q, res) => res.json(store.all("contacts")));
api.post("/contacts", (req, res) => {
  const c = {
    id: uid(), relationship: "new lead", organization: "", role: "",
    email: "", social: "", city: "", lastContacted: "", nextFollowUp: "",
    notes: "", ...req.body,
  };
  store.insert("contacts", c);
  res.json(c);
});
api.put("/contacts/:id", (req, res) =>
  res.json(store.update("contacts", req.params.id, req.body))
);
api.delete("/contacts/:id", (req, res) =>
  res.json(store.remove("contacts", req.params.id))
);

api.get("/logs", (_q, res) =>
  res.json(store.all("crawl_logs").slice(0, 60))
);

// ---- forecast: know before it happens ----
api.get("/forecast", (_q, res) => {
  const recurrence = recurrenceForecasts();
  const cadence = store
    .all("sources")
    .map((s) => cadenceForecast(s))
    .filter(Boolean)
    .sort((a, b) => a.daysOut - b.daysOut);
  // prep-urgent: opportunities whose prep window is open/imminent but not
  // yet acted on — the "you should already be working on this" list
  const prepUrgent = store
    .all("opportunities")
    .filter(
      (o) =>
        o.prepUrgent &&
        !["Applied / Submitted", "Accepted", "Declined", "Archived"].includes(
          o.status
        )
    )
    .sort((a, b) => (a.deadline > b.deadline ? 1 : -1));
  res.json({ recurrence, cadence, prepUrgent });
});

// ---- /today — the one screen designed for "I opened the PWA, what now?" ----
// Returns everything the Today view needs in a single call so the first
// paint is instant. Client passes ?since=ISO_timestamp to compute "new since
// last visit" — the server doesn't track per-user visit times (no auth yet),
// so the client owns that piece via localStorage.
api.get("/today", (req, res) => {
  const live = store
    .all("opportunities")
    .filter((o) => !["Archived", "Declined", "Accepted"].includes(o.status));

  const today = new Date().toISOString().slice(0, 10);
  const daysFromToday = (d) => {
    if (!d) return null;
    return Math.round((new Date(d) - new Date(today)) / 86400000);
  };

  // 1. Prep windows open / imminent — the proactive list
  const prepUrgent = live
    .filter((o) => o.prepUrgent)
    .sort((a, b) => (a.deadline > b.deadline ? 1 : -1));

  // 2. Deadlines within 7 days (regardless of prep status — catches everything
  //    where "found too late" risk is real)
  const dueSoon = live
    .filter((o) => {
      const d = daysFromToday(o.deadline);
      return d !== null && d >= 0 && d <= 7 && !o.prepUrgent;
    })
    .sort((a, b) => (a.deadline > b.deadline ? 1 : -1));

  // 3. New since last visit (or last 24h if no since provided)
  const since = req.query.since || new Date(Date.now() - 24 * 3600e3).toISOString();
  const newSince = live
    .filter((o) => (o.createdAt || "") > since)
    .sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
    .slice(0, 8);

  // 4. Counts for the at-a-glance header
  const counts = {
    prepUrgent: prepUrgent.length,
    dueSoon: dueSoon.length,
    newSince: newSince.length,
    totalLive: live.length,
  };

  res.json({ asOf: new Date().toISOString(), counts, prepUrgent, dueSoon, newSince });
});

// ---- settings (brand name, region, public feed toggle) ----
api.get("/settings", (_q, res) => res.json(store.getSettings()));
api.put("/settings", (req, res) => res.json(store.setSettings(req.body)));

// ---- broadcast: generate ready-to-post roundups ----
// Body: { ids: [optional explicit opportunity ids], limit, minFit }
// If no ids given, auto-selects top opportunities by rank that have a deadline
// in the future or are rolling, excluding archived/declined.
api.post("/broadcast", (req, res) => {
  const settings = store.getSettings();
  const { ids, limit = 12, minFit = 45 } = req.body || {};
  let opps;
  if (Array.isArray(ids) && ids.length) {
    const byId = new Map(store.all("opportunities").map((o) => [o.id, o]));
    opps = ids.map((id) => byId.get(id)).filter(Boolean);
  } else {
    const today = new Date().toISOString().slice(0, 10);
    opps = store
      .all("opportunities")
      .filter((o) => !["Archived", "Declined"].includes(o.status))
      .filter((o) => (o.fitScore || 0) >= minFit)
      .filter((o) => !o.deadline || o.deadline >= today) // not past
      .sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
      .slice(0, limit);
  }
  const roundup = buildRoundup(opps, settings.brand, settings.region);
  res.json({ ...roundup, sourceIds: opps.map((o) => o.id) });
});

// ---- public read-only feed (no auth) ----
// Returns a lightweight, shareable list. Only serves data when the user has
// explicitly enabled the public feed in settings (off by default).
api.get("/public/feed", (_q, res) => {
  const settings = store.getSettings();
  if (!settings.publicFeedEnabled) {
    return res.json({ enabled: false, brand: settings.brand, region: settings.region, items: [] });
  }
  const today = new Date().toISOString().slice(0, 10);
  const items = store
    .all("opportunities")
    .filter((o) => !["Archived", "Declined"].includes(o.status))
    .filter((o) => (o.fitScore || 0) >= 45)
    .filter((o) => !o.deadline || o.deadline >= today)
    .sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
    .slice(0, 40)
    .map((o) => ({
      title: o.title, category: o.category, city: o.city,
      deadline: o.deadline, dateStart: o.dateStart,
      payMax: o.payMax, fee: o.fee,
      applicationUrl: o.applicationUrl,
      contactSocial: o.contactSocial,
    }));
  res.json({ enabled: true, brand: settings.brand, region: settings.region, items, asOf: new Date().toISOString() });
});
