// src/collectors/genericWebsiteCollector.js
// Best-effort scanner for public pages: venue calendars, festival sites,
// city public-art pages, university gallery calls.
// No headless browser, no JS execution, no login/CAPTCHA bypass.
// Strips tags, splits into candidate blocks, runs the conservative parser.
// Honest about limits: structured RSS/CaFE beats this; this is the catch-all.
import { politeGet } from "./fetcher.js";
import { parseIntake } from "../enrichment/parser.js";

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h\d|tr|section|article|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Pull anchors that look like a call/application so we surface the real link.
function appLinks(html, base) {
  const out = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 30) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    if (/apply|submission|call for|open call|rfq|rfp|prospectus|enter|register|vendor/i.test(text + " " + href)) {
      try { out.push(new URL(href, base).href); } catch {}
    }
  }
  return out;
}

// Heuristic: keep text blocks that smell like an opportunity.
const SMELL = /(call for|open call|deadline|apply by|submission|rfq|rfp|vendor|booth|residency|grant|mural|exhibition|juried|festival|application|seeking artists|now accepting)/i;

export async function collectGeneric(source) {
  const res = await politeGet(source.url);
  if (!res.ok) return { found: 0, items: [], status: res.reason };

  const text = stripHtml(res.body);
  const links = appLinks(res.body, source.url);

  // Split into blocks on blank lines / headings, keep the promising ones.
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 60 && b.length < 1600 && SMELL.test(b));

  const seen = new Set();
  const items = [];
  for (const b of blocks.slice(0, 12)) {
    const parsed = parseIntake(b);
    const key = (parsed.title || b.slice(0, 40)).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      ...parsed,
      description: b.slice(0, 600),
      sourceName: source.name,
      sourceUrl: source.url,
      originalUrl: source.url,
      applicationUrl: parsed.applicationUrl || links[0] || source.url,
      city: parsed.city || source.city || "",
    });
  }
  return {
    found: items.length,
    items,
    status: items.length ? "ok" : "no-matches",
  };
}
