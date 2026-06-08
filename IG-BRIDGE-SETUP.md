# IG / FB Bridge Setup — turning the watchlist into auto-feeds

The honest part again: no terms-clean tool lets a server scrape Instagram on a
schedule. But a bridge service can poll public IG accounts on YOUR behalf and
emit an RSS feed. The Oracle's RSS collector then ingests that feed like any
other source. This is the closest thing to "scan IG on its own" that doesn't
get accounts banned or break weekly.

## Pick ONE bridge service

Three options that genuinely work as of 2026. Pick one and stick with it.

### Option A — RSS.app  (recommended — simplest)
- Free tier: 5 feeds (enough for a tight Tier-1 list)
- Paid: $9/mo for ~50 feeds (covers the full Tier 1-2 watchlist)
- Works on public IG, FB Pages, TikTok, YouTube, Twitter/X
- Reliable ~hourly polling

### Option B — Inoreader  (more powerful, steeper learning curve)
- Free tier limited; "Pro" ~$8/mo gives ~150 feeds
- Excellent filtering, rules, OPML export
- Best if you also want to read RSS yourself

### Option C — Feeder.co or RSSHub (self-hosted)
- RSSHub is open-source, you can run it free
- Higher setup effort; best if you want full control

## Step-by-step (using RSS.app as example)

For each IG account in DRAEM-WATCHLIST.md marked `IG-bridge`:

1. Go to rss.app, sign up (free works for Tier 1).
2. Click "New Feed" → "Instagram User Feed".
3. Paste the IG handle URL: `https://www.instagram.com/detroit_a2_ecstatic_dance/`
4. RSS.app generates a feed URL like:
   `https://rss.app/feeds/AbCdEf123.xml`
5. Copy that feed URL.
6. In the Oracle (Sources page) → **+ add source**:
   - Name: `IG · @detroit_a2_ecstatic_dance`
   - Type: `rss`
   - URL: paste the RSS.app feed URL
   - City: `Detroit` (or where they post events)
   - Categories: `DJ Booking,Ecstatic Dance / Movement`
7. Click save. The Oracle's next scan ingests it.

Repeat for the rest. The Tier 1-2 IG bridges take ~20 minutes once.

## What you actually get

When a watched account posts:
- Bridge sees it within ~1 hour
- Oracle's next scan (every 8 hours by default) picks it up
- Parser extracts dates / venues / contacts where present
- Engine scores it against your Draem profile
- It appears on the Dashboard, scored, with explainable reasons
- The source's `postLog` ticks up → cadence forecasting sharpens

Worst case lag: ~8 hours from post to scored card. Real-world that's enough
warning for everything except same-day announcements (which underground
sometimes does anyway).

## Save bridge cost — combine into mega-feeds

RSS.app lets you build "bundles" — combine 5 IG accounts into one feed URL.
The Oracle treats it as one source but receives posts from all 5. If you're
on the free tier (5 feeds), this is how you get 20+ accounts into the Oracle:
- Bundle 1: Tier 1 ecstatic/ritual (5 IG accounts)
- Bundle 2: Tier 2 venues (5 IG accounts)
- Bundle 3: Tier 2 collectives (5 IG accounts)
- etc.
Trade-off: source-level cadence forecasting becomes per-bundle instead of
per-account. Per-account is sharper; bundles cost less.

## When a bridge dies

Bridges occasionally lose access to an account (IG changes something, account
goes private). The Oracle's `lastStatus` field shows `auth-wall` or
`no-matches` when this happens — you'll see it on the Sources page. Recovery:
delete that feed in RSS.app, recreate it. ~2 min fix.

## Facebook Events shortcut

Public FB Page events still expose iCal `.ics`. To grab one:
- Visit the FB Page → Events tab
- Right-click "Subscribe to events" → copy URL
- It's a webcal:// URL — change to https://
- Add to Oracle as a source (type: website — the parser handles ICS reasonably)

That gets you real dates without any bridge.

## DON'T

- Don't paste private/closed account URLs. They won't work and may flag the bridge.
- Don't try to scrape IG directly from the Oracle. It will break and may risk your IG account.
- Don't use scraping browser extensions that "automate" IG. Those are how accounts get banned.
