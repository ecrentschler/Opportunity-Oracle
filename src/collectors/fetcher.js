// src/collectors/fetcher.js
// Respectful collection layer. Every rule from the build spec lives here.
//  - honest user-agent
//  - robots.txt respected
//  - low request rate (per-host throttle)
//  - response caching
//  - no login/CAPTCHA bypass (we simply never attempt gated pages)

const UA = "OpportunityOracle/1.0 (artist opportunity radar; respectful crawler; contact: configure in .env)";
const MIN_GAP_MS = 4000;          // >= 4s between hits to the same host
const CACHE_TTL_MS = 6 * 3600e3;  // 6h cache
const TIMEOUT_MS = 15000;

const lastHit = new Map();        // host -> timestamp
const cache = new Map();          // url  -> { at, status, body }
const robotsCache = new Map();    // host -> { at, disallow:[] }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hostOf(url) {
  try { return new URL(url).host; } catch { return null; }
}

async function throttle(host) {
  const prev = lastHit.get(host) || 0;
  const wait = MIN_GAP_MS - (Date.now() - prev);
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

async function rawFetch(url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...opts,
      signal: ctl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, "Accept": "*/*", ...(opts.headers || {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

// Minimal robots.txt parser. Honors Disallow for our UA / '*'.
async function robotsAllows(url) {
  const host = hostOf(url);
  if (!host) return false;
  const path = new URL(url).pathname || "/";

  let r = robotsCache.get(host);
  if (!r || Date.now() - r.at > 24 * 3600e3) {
    const disallow = [];
    try {
      await throttle(host);
      const res = await rawFetch(`https://${host}/robots.txt`);
      if (res.ok) {
        const txt = await res.text();
        let applies = false;
        for (const lineRaw of txt.split("\n")) {
          const line = lineRaw.split("#")[0].trim();
          if (!line) continue;
          const [k0, ...rest] = line.split(":");
          const k = k0.trim().toLowerCase();
          const v = rest.join(":").trim();
          if (k === "user-agent") {
            applies = v === "*" || v.toLowerCase().includes("opportunityoracle");
          } else if (k === "disallow" && applies && v) {
            disallow.push(v);
          }
        }
      }
    } catch {
      /* no robots.txt or unreachable => treat as allowed */
    }
    r = { at: Date.now(), disallow };
    robotsCache.set(host, r);
  }
  return !r.disallow.some((d) => d !== "/" ? path.startsWith(d) : path === "/" ? false : true)
      && !r.disallow.some((d) => d === "/" ? true : false && false); // '/' total-block handled below
}

// total-block check kept explicit & readable
async function blockedByRobots(url) {
  const host = hostOf(url);
  if (!host) return true;
  const r = robotsCache.get(host);
  // populate cache via robotsAllows side-effect
  await robotsAllows(url);
  const rr = robotsCache.get(host);
  if (!rr) return false;
  if (rr.disallow.includes("/")) return true;
  const path = new URL(url).pathname || "/";
  return rr.disallow.some((d) => d && d !== "/" && path.startsWith(d));
}

/**
 * Polite GET. Returns { ok, status, body, fromCache } or { ok:false, reason }.
 * Never follows into login/paywall; if a page 401/403s we just report it.
 */
export async function politeGet(url) {
  const host = hostOf(url);
  if (!host) return { ok: false, reason: "bad-url" };

  const c = cache.get(url);
  if (c && Date.now() - c.at < CACHE_TTL_MS)
    return { ok: true, status: c.status, body: c.body, fromCache: true };

  if (await blockedByRobots(url))
    return { ok: false, reason: "robots-disallow" };

  try {
    await throttle(host);
    const res = await rawFetch(url);
    if (res.status === 401 || res.status === 403)
      return { ok: false, reason: "auth-wall" }; // do NOT attempt to bypass
    const body = await res.text();
    if (/captcha|recaptcha|hcaptcha|cf-challenge/i.test(body.slice(0, 4000)))
      return { ok: false, reason: "captcha" };   // do NOT attempt to bypass
    cache.set(url, { at: Date.now(), status: res.status, body });
    return { ok: true, status: res.status, body };
  } catch (e) {
    return { ok: false, reason: e.name === "AbortError" ? "timeout" : "fetch-error" };
  }
}

export const _config = { UA, MIN_GAP_MS, CACHE_TTL_MS };
