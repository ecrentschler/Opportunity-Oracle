# Deploy & Phone Setup — making the Oracle live 24/7

The Oracle becomes "an app that constantly updates" in two steps:

1. **Push it to Railway** so the scanner runs 24/7 in the cloud
2. **Install to your phone home screen** so it opens like a native app

End-to-end time: ~10 minutes. After that the scanner runs on its own forever
and you open the PWA on your own terms — the **Today** view tells you what
needs you right now.

(Optional 3rd step: email digest if you change your mind about passive
alerts — config in DIGEST-OPT-IN.md below.)

---

## 1. Deploy to Railway

Railway is free up to ~500 hours/month, $5/mo for unlimited. No native build,
no database server — just push and go.

### Push to GitHub first

```bash
cd opportunity-oracle-scanner
git init
git add .
git commit -m "initial"
gh repo create opportunity-oracle --private --source=. --push
```

(Or use the GitHub website — make a private repo, upload these files.)

### Connect Railway

1. Sign in at **railway.app** with your GitHub.
2. **New Project** → **Deploy from GitHub repo** → pick the repo.
3. Railway auto-detects Node, runs `npm install`, then `npm start`. First
   deploy completes in ~90 seconds. You'll see a build log; wait for "live."
4. **Settings → Networking → Generate Domain.** Railway gives you a URL like
   `oracle-production-xxxx.up.railway.app`. **Copy it.** This is your Oracle.

### Add a persistent volume (critical — data survives redeploys)

1. **New → Volume** in the Railway project.
2. Mount path: `/data`
3. Attach to your Oracle service.
4. **Variables** tab → add `DB_PATH=/data/oracle-data.json`.

Without this, every redeploy resets the database. Set this once and forget it.

### Configure environment variables

In Railway → Variables, add:

| Variable | Value | Why |
|---|---|---|
| `DB_PATH` | `/data/oracle-data.json` | persistence across redeploys |
| `SCAN_CRON` | `0 * * * *` | hourly scans (default; tweak as you like) |
| `PUBLIC_URL` | your Railway URL | used for share/copy-link features |

Railway redeploys automatically when you change vars. That's it for required
config — no email or SMTP setup needed.

---

## 2. Install to your phone like an app

### iPhone (Safari)

1. Open your Railway URL in Safari.
2. Tap the **share icon** (square with up-arrow) at the bottom.
3. Scroll → **Add to Home Screen.**
4. Name it "Oracle" → **Add.**
5. The Oracle's gold-on-black sigil appears on your home screen. Tap it — opens
   fullscreen, no Safari chrome, feels like a native app. Status bar adapts
   to the dark theme.

### Android (Chrome)

1. Open your Railway URL in Chrome.
2. Tap the **three-dot menu** → **Add to Home screen** (or Chrome may prompt
   you automatically with an "Install" banner).
3. Confirm → home-screen icon installed.
4. Opens standalone. On most Android devices it's listed in the app drawer too.

### What "app-like" means here

- Fullscreen — no browser URL bar eating your screen
- Home-screen icon, in your phone's app launcher
- Loads instantly even on slow networks (service worker cached the shell)
- Works offline for already-loaded data (you can browse your pipeline on a plane)
- Status bar matches the dark theme
- Survives phone restarts; updates automatically as you redeploy

### What it isn't

- Not in the App Store (that's a different ~weeks-of-work path)
- Not native push notifications by default (that's a future build — see below)
- iOS limits some PWA features (e.g. notifications require manual enable per page)

The digest email is the primary "wake me when it matters" channel. The PWA
gives you the app experience without app-store friction.

---

## 3. Optional next steps

**Email digest.** You chose PWA-first, but if you want a passive 7am email
summary later, see **DIGEST-OPT-IN.md** — three env vars + uncomment one
schedule block and it's on.

**Web push notifications.** True phone-popup alerts when prep-urgent items
appear. Requires VAPID keys, a service-worker push handler, and a permission
prompt. ~2 hours of work; ask if you want it built. PWA push works on Android
+ desktop reliably; iOS Safari supports it as of iOS 16.4 but requires the
user to add the PWA to home screen *first* before granting permission.

**SMS for the most urgent.** Twilio integration — $1/mo + ~1¢ per text. Only
fires for fit≥90, urgency≥85 items. Costs real money but cuts through.

---

## Operations

**Check it's still running:** Railway → your service → Logs. You'll see
`[scan] starting...` and `[scan] done in 23s — +2 new` lines every hour.

**Tweak the scan rate:** Change `SCAN_CRON` in Railway Variables.
- Every 30 min: `*/30 * * * *`
- Every 2 hours: `0 */2 * * *`
- Twice daily 6am/6pm: `0 6,18 * * *`

**Pause it:** Railway → service → **Pause.** Resume anytime. Data persists in the volume.

**Cost reality:** Free tier is ~500 hours/month. The Oracle uses ~720 hours/month if always-on (24×30=720), so you'll need the $5/mo Hobby plan after the first ~3 weeks of each month. Or set it to sleep overnight (Railway calls this "auto-suspend") and accept that scans don't fire while asleep.

That's the whole operational picture. Push, set vars, install to home screen,
done. The Oracle runs.
