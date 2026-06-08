# Email Digest — opt-in (off by default)

You set up the Oracle for PWA-first usage — open the app on your own terms,
no passive emails. The digest code is still in the repo though, so if your
behavior changes (you want a 7am morning brief or an evening reminder), you
can flip it on in a few minutes.

## What it does when on

Once a day at 7am (configurable), the server renders a ritual-tech HTML email
with three sections in priority order:

- **⚡ Prep window open — work on these now** (lead-time aware, the proactive list)
- **◆ Deadlines within 7 days** (the catch-all "found too late" guard)
- **☉ New since yesterday** (top-rank doors added in the last 24h)
- **✶ Recurrence forecasts** whose watch window opens in the next 30 days

Subject line auto-summarizes ("Oracle — 2 prep windows open" etc).

## Turn it on (~5 minutes)

### 1. Pick an SMTP provider and grab credentials

**Resend** (recommended — 100 emails/day free, no domain needed for testing):

1. Sign up at **resend.com**.
2. **API Keys → Create.** Copy the key (starts with `re_`).

**Gmail** (zero new accounts):

1. Enable 2-factor on your Gmail.
2. Visit **myaccount.google.com/apppasswords** → create one for "Mail."
3. Use your Gmail address as `SMTP_USER`, the 16-char app password as `SMTP_PASS`.

### 2. Add env vars

In Railway → Variables (or your local `.env`), set:

```
DIGEST_TO=you@example.com
SMTP_HOST=smtp.resend.com       # or smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend                # or your_gmail@gmail.com
SMTP_PASS=re_xxx...             # the API key or app password
SMTP_FROM="Oracle <oracle@yourdomain.com>"
DIGEST_CRON=0 7 * * *           # 7am daily (cron syntax)
```

### 3. Uncomment the schedule

Open `src/jobs/scheduler.js`. Near the bottom there's a commented block:

```js
// import("./digest.js").then(({ sendDigest }) => {
//   const DIGEST_CRON = process.env.DIGEST_CRON || "0 7 * * *";
//   if (cron.validate(DIGEST_CRON) && process.env.DIGEST_TO) {
//     cron.schedule(DIGEST_CRON, async () => { await sendDigest(); });
//     console.log(`[scheduler] digest "${DIGEST_CRON}"`);
//   }
// });
```

Uncomment it. Commit and push (Railway redeploys automatically).

### 4. Test the send

In Railway → your service → **three-dot menu → Open shell**:

```
npm run digest
```

Should print `[digest] sent → you@example.com (<message-id>)` and the email
arrives in seconds. If you see `SMTP-error`, fix the credentials and retry.

## Turn it back off

Either:

- Remove `DIGEST_TO` from Railway Variables (the schedule guards on it, so
  setting it empty disables the send), or
- Re-comment the schedule block in `scheduler.js`

Both work; the env var approach is faster.

## Tweaking the schedule

`DIGEST_CRON` is standard cron. Examples:

- 7am daily: `0 7 * * *`
- 7am and 6pm: `0 7,18 * * *`
- Mondays only at 8am: `0 8 * * 1`
- Every 4 hours: `0 */4 * * *` (probably too noisy)
