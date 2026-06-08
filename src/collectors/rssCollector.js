// src/collectors/rssCollector.js
// Cleanest source type. Many arts councils, alt-weeklies, festival blogs,
// and public-art pages publish RSS/Atom. Fully scannable, robots-respecting.
import Parser from "rss-parser";
import { politeGet } from "./fetcher.js";
import { parseIntake } from "../enrichment/parser.js";

const rss = new Parser({ timeout: 15000, headers: { "User-Agent": "OpportunityOracle/1.0" } });

export async function collectRSS(source) {
  const res = await politeGet(source.url);
  if (!res.ok) return { found: 0, items: [], status: res.reason };

  let feed;
  try {
    feed = await rss.parseString(res.body);
  } catch {
    return { found: 0, items: [], status: "not-rss" };
  }

  const items = (feed.items || []).slice(0, 40).map((it) => {
    const blob = [it.title, it.contentSnippet || it.content || "", it.categories?.join(" ") || ""]
      .filter(Boolean)
      .join("\n");
    const parsed = parseIntake(blob);
    return {
      ...parsed,
      title: it.title || parsed.title || "Untitled",
      description: (it.contentSnippet || it.content || parsed.description || "").slice(0, 600),
      originalUrl: it.link || "",
      applicationUrl: parsed.applicationUrl || it.link || "",
      dateStart: parsed.dateStart || (it.isoDate ? it.isoDate.slice(0, 10) : ""),
      sourceName: source.name,
      sourceUrl: source.url,
      city: parsed.city || source.city || "",
    };
  });
  return { found: items.length, items, status: "ok" };
}
