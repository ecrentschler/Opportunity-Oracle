# Opportunity Oracle — Scanner

A ritual-tech opportunity radar for underground artists. It scans the web on
its own for creative opportunities, scores them against your artist profile,
and gives you a CRM + submission assistant to act on them. Designed to be
installed on your phone as a PWA — open it like an app, see what needs you
right now, act, close. Built for Draem.

---

## START HERE (3 steps)

```bash
npm install
npm start
```

Open **http://localhost:3000**. Your Draem profile and 41 curated sources are
already loaded. The first screen — **Today** — surfaces three things in one
glance: prep windows that just opened, deadlines within 7 days, and what's
new since you last visited. That's the whole point of the open-the-app flow.

To deploy to Railway and install on your phone, see **DEPLOY-AND-INSTALL.md**.

The Oracle scans hourly on its own. No emails, no notifications by default —
you open the PWA on your own terms and the Today view tells you what matters.

---

## The honest truth about "scanning"

This is the part most tools lie about, so here it is straight.

**What it genuinely auto-finds** (RSS feeds + public web pages, robots-respecting):
open calls, public-art RFQ/RFP, grants, festival applications, gallery calls,
residencies, university gallery calls, alt-weekly event listings. The
structured world. These flow in on their own.

**What it deliberately does NOT scan:** Instagram, Facebook groups, Discord,
Telegram, Resident Advisor. These either forbid scraping in their terms or
gate everything behind a login. Building a scraper for them would mean
bypassing logins/terms — the build spec said don't, and the code refuses to.
If the fetcher hits an auth wall or CAPTCHA it reports it and moves on; it
never tries to break through.

For that underground/IG/RA world, use **⟡ paste a door** — drop a flyer
caption, newsletter, or event text and the same parser/scorer turns it into a
scored opportunity. That's where your underground leads live anyway, so the
split isn't a limitation so much as the actual shape of what's reachable.

This means: the scanner does real, unattended work on the structured half of
your opportunity landscape, and paste-intake covers the half no honest tool
can automate. Both feed the same dashboard, scoring, pipeline, and CRM.

---

## How the scanning works

1. **Sources** (Sources page) — each is a URL + type (`rss` cleanest, or
   `website` best-effort text scan). 10 real Michigan/Midwest arts sources are
   seeded. Add/disable your own anytime.
2. **Scheduler** (`src/jobs/scheduler.js`) — cron fires a full scan at
   6am / 2pm / 10pm by default (override with `SCAN_CRON`). This is the
   "runs on its own" part.
3. **Fetcher** (`src/collectors/fetcher.js`) — the respectful layer:
   honest User-Agent, robots.txt obeyed, ≥4s between hits to the same host,
   6h response cache, 401/403/CAPTCHA = report-and-skip (never bypass).
4. **Collectors** parse fetched content into rough opportunities
   (`rssCollector.js`, `genericWebsiteCollector.js`).
5. **Engine** (`src/enrichment/engine.js`) classifies the category and scores
   Fit / Urgency / Value with written reasons + warnings, plus an automation
   status. Same engine the dashboard uses, so scores match everywhere.
6. **Dedupe + persist** — `dedupeKey` (title+city+date) blocks re-adding the
   same door on every scan. Stored in `oracle-data.json`.

Verify it yourself without the internet: `node test/pipeline-proof.mjs`
runs real fixture content through the entire chain and prints scored results.

---

## Scoring (explainable, never a black box)

- **Fit 0–100** — distance from Willis, category match, vibe/genre/medium
  keyword match, pay vs your minimum, contact present. Avoid-keywords penalize.
- **Urgency 0–100** — deadline proximity and event date. Bucketed:
  Act this week / Soon / Research later / Watchlist.
- **Value 0–100** — pay, fee penalty, festival reach, prestige, repeat
  potential, existing relationship.
- **Rank** = fit·0.45 + urgency·0.25 + value·0.20 + relationship·0.10.

Every opportunity carries `reasons[]` and `warnings[]` so you always see *why*.
Edit your profile (Profiles page) and everything re-scores instantly.

---

## Knowing before it happens (Forecast)

A scanner can't see an Instagram post before it's posted, and no honest tool
can. But you can still get advance warning three ways, none requiring a scrape:

**1. Prep-window urgency (the timing fix).** Every category has a prep lead
time (Grant 21d, Festival 14d, DJ gig 3d, afters 2d...). Urgency now fires at
`deadline − prep`, not at the deadline. A festival due in 16 days with a
14-day prep need shows as urgent *now* — on the Forecast page's "work on these
now" lane — so you start in time instead of finding out too late.

**2. Recurrence (annual/seasonal patterns).** When opportunities age into
history (Archived / deadline passed), they become recurrence seeds. Anything
that looks annual gets a predicted next window with a "watch from" date weeks
ahead. Two prior cycles = `pattern` confidence; one sighting = `guess`. This
works even for IG-only calls: once you've logged "Lakes of Fire art grant"
once or twice, the Oracle warns you before it reopens.

**3. Source cadence (promoter rhythm — IG-safe).** Each source tracks a
`postLog`. If a promoter bears fruit every ~30 days and it's been 28, the
Forecast page says "expect a drop from @nightcollective in ~2d — check soon."
It predicts *when to look*, not the content, so it works on unscrapeable
sources. Auto-scanned sources log themselves; for IG/FB accounts you can't
scan, tap **"logged a sighting"** on the Forecast page whenever you see them
post. Two sightings and the rhythm starts predicting.

Verify the date math offline: `node test/forecast-proof.mjs`

## Getting Instagram / Facebook into the Oracle

There is no terms-clean way for the server to scrape IG/FB on a schedule.
What works instead:

**A. Bridge service → RSS (closest to automatic).** Tools like Inoreader,
Feeder, or RSS.app can watch specific *public* IG accounts / FB pages and emit
an RSS feed. Add that feed as a `type: rss` source in the Sources page. You
maintain the watchlist (the 15–40 accounts that matter); the bridge polls;
the Oracle ingests, scores, and dedupes. This is as close to "scan IG on its
own" as exists without getting accounts banned.

**B. Facebook Events iCal.** Many public FB Page events expose an `.ics`
export or appear on the venue's own site — those carry real dates and are
ingestible.

**C. Your own scrolling as the collector.** When you see a flyer in the app at
1am, paste it (⟡ paste a door) — the parser extracts date/venue/contact and
scores it. For the underground tier this is more reliable than any bot, and
logging the source as a sighting feeds cadence forecasting so the Oracle
learns that account's rhythm for next time.

The honest split stands: structured sources auto-scan; IG/FB come in via
bridge feeds or fast paste; forecasting covers the gap by predicting timing
from history and rhythm even where content can't be seen in advance.

## Automation limits (by design)

The Submission Assistant drafts, packages, and flags — it never sends or
submits anything itself. Automation status per opportunity:

- `Can Auto-Send Email` — email found; draft ready, **you** approve the send.
- `Needs Human Input` — external form / unknown fields; build packet, submit by hand.
- `Blocked by Payment / Login / CAPTCHA` / `Manual Only` — never automated.

Fees, logins, CAPTCHA, grant/tax/legal forms are always manual. The app
explains its reasoning in `autoReasons`.

---

## Deploy to Railway

No native build, no database server — it's pure Node + a JSON file, so deploy
is bulletproof.

1. Push this folder to a GitHub repo.
2. Railway → New Project → Deploy from GitHub repo.
3. Railway auto-detects Node, runs `npm install`, then `npm start`.
4. Set environment variables (Railway → Variables) — see `.env.example`.
5. **Important:** add a Railway Volume mounted at `/data` and set
   `DB_PATH=/data/oracle-data.json` so your opportunities persist across
   redeploys (otherwise the JSON file resets each deploy).

The cron scheduler runs inside the web process, so as long as the Railway
service is up, it keeps scanning on schedule.

---

## Adding sources

Sources page → **+ add source**. Type `rss` if the page offers a feed
(cleanest results), else `website`. The app shows `lastStatus` after each scan
so dead feeds and auth-walls are visible — if something reads `auth-wall` or
`robots-disallow`, that source can't be auto-scanned; paste from it instead.

---

## Using the CRM & profiles

- **Contacts** — promoters, venues, curators with relationship stage and
  follow-up dates.
- **Profiles** — your artist profile (drives scoring) + the application
  asset library (bios, statement, tech rider, links). The packet builder
  auto-picks the right assets per opportunity type.

---

## Project structure

```
src/
  collectors/   fetcher (respectful), rss, genericWebsite, dispatcher
  enrichment/   engine (scoring/classify), parser (intake)
  store/        db (JSON store), seed (Draem profile + sources)
  routes/       api.js (REST)
  jobs/         scheduler (cron), runScan (CLI)
  server.js     Express entry
public/
  index.html    the full dashboard UI (API-connected)
test/
  pipeline-proof.mjs   deterministic end-to-end proof
```

---

## Files you also have

`opportunity-oracle.html` (separate single-file build) — the same dashboard
with no server, paste/manual intake only, data in browser storage. Use it as
a zero-setup fallback or on a machine where you don't want to run Node.
