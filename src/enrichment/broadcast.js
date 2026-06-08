// src/enrichment/broadcast.js
// Turns scored opportunities into ready-to-paste content. Template-driven off
// your real data — no AI API, no cost, works offline. This is the bridge from
// "private radar" to "public feed / monetizable roundup."
//
// Formats: instagram (caption + hashtags), newsletter (Substack/email HTML +
// plaintext), and plain (paste anywhere). The user picks which opportunities
// go in; this renders them.

const fmtDate = (s) => {
  if (!s) return "rolling";
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const daysUntil = (s) => {
  if (!s) return null;
  return Math.round((new Date(s) - new Date(new Date().toISOString().slice(0,10))) / 86400000);
};

// One-line summary of an opportunity, used across formats.
function oppSummary(o) {
  const bits = [];
  if (o.city) bits.push(o.city);
  if (o.deadline) {
    const d = daysUntil(o.deadline);
    bits.push(d != null && d >= 0 ? `apply by ${fmtDate(o.deadline)} (${d}d)` : `deadline ${fmtDate(o.deadline)}`);
  } else if (o.dateStart) {
    bits.push(fmtDate(o.dateStart));
  }
  if (o.payMax > 0) bits.push(`$${o.payMax}`);
  else if (o.fee > 0) bits.push(`$${o.fee} fee`);
  return bits.join(" · ");
}

// Group opportunities by a friendly category label for sectioned posts.
const CAT_LABEL = {
  "DJ Booking": "DJs",
  "Live Performance": "Performers",
  "Ecstatic Dance / Movement": "Movement / ecstatic",
  "Underground / Afterhours": "Underground",
  "Vendor Market": "Vendors",
  "Art Fair": "Vendors",
  "Mural Call": "Muralists",
  "Public Art RFQ/RFP": "Public art",
  "Gallery Open Call": "Gallery / exhibition",
  "Installation Call": "Installation artists",
  "Festival Application": "Festivals",
  "Grant": "Grants",
  "Residency": "Residencies",
  "Sound Artist Call": "Sound artists",
  "Projection / Visual Call": "Visual / projection",
};
const labelFor = (cat) => CAT_LABEL[cat] || "Other calls";

/**
 * Build a roundup from a list of opportunities.
 * @param opps  array of opportunity objects (already filtered/picked by caller)
 * @param brand brand name string (configurable; defaults applied by caller)
 * @param region region tag, e.g. "Michigan"
 */
export function buildRoundup(opps, brand = "Open Call Oracle", region = "Michigan") {
  const week = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const n = opps.length;

  // group by friendly label
  const groups = {};
  for (const o of opps) {
    const k = labelFor(o.category);
    (groups[k] = groups[k] || []).push(o);
  }
  const groupEntries = Object.entries(groups);

  // ---------- INSTAGRAM caption ----------
  const igLines = [];
  igLines.push(`✦ ${n} ${region} opportunities open right now ✦`);
  igLines.push("");
  for (const [label, items] of groupEntries) {
    igLines.push(`— ${label.toUpperCase()} —`);
    for (const o of items) {
      igLines.push(`• ${o.title}`);
      const s = oppSummary(o);
      if (s) igLines.push(`  ${s}`);
    }
    igLines.push("");
  }
  igLines.push("Full links + how to apply at the link in bio.");
  igLines.push("Save this. Share with an artist who needs it.");
  igLines.push("");
  const hashtags = [
    "#detroitart", "#michiganartist", "#annarbor", "#detroitmusic",
    "#callforartists", "#opencall", "#artistopportunity", "#vendorsneeded",
    "#detroitdj", "#michiganmakers", "#artgrants", "#festivalseason",
  ];
  igLines.push(hashtags.join(" "));
  const instagram = igLines.join("\n");

  // ---------- PLAIN TEXT ----------
  const plainLines = [];
  plainLines.push(`${brand.toUpperCase()} — ${region} opportunities, week of ${week}`);
  plainLines.push("=".repeat(48));
  plainLines.push("");
  for (const [label, items] of groupEntries) {
    plainLines.push(`${label}`);
    plainLines.push("-".repeat(label.length));
    for (const o of items) {
      plainLines.push(`• ${o.title}`);
      const s = oppSummary(o);
      if (s) plainLines.push(`  ${s}`);
      if (o.applicationUrl) plainLines.push(`  → ${o.applicationUrl}`);
      else if (o.contactEmail) plainLines.push(`  → ${o.contactEmail}`);
      else if (o.contactSocial) plainLines.push(`  → ${o.contactSocial}`);
    }
    plainLines.push("");
  }
  plainLines.push(`${n} opportunities · curated by ${brand}`);
  const plain = plainLines.join("\n");

  // ---------- NEWSLETTER (HTML for Substack/email) ----------
  const esc = (s) => String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const htmlParts = [];
  htmlParts.push(`<h1 style="font-family:Georgia,serif">${esc(brand)}</h1>`);
  htmlParts.push(`<p style="font-family:Georgia,serif;font-style:italic;color:#555">${esc(region)} opportunities · week of ${esc(week)}</p>`);
  htmlParts.push(`<p style="font-family:system-ui,sans-serif">${n} open calls, bookings, and markets worth your attention this week.</p>`);
  for (const [label, items] of groupEntries) {
    htmlParts.push(`<h2 style="font-family:Georgia,serif;border-bottom:2px solid #c9a24b;padding-bottom:4px">${esc(label)}</h2>`);
    htmlParts.push(`<ul style="font-family:system-ui,sans-serif;line-height:1.6">`);
    for (const o of items) {
      const link = o.applicationUrl || (o.contactEmail ? "mailto:" + o.contactEmail : "");
      const titleHtml = link
        ? `<a href="${esc(link)}" style="color:#a8362e;text-decoration:none"><strong>${esc(o.title)}</strong></a>`
        : `<strong>${esc(o.title)}</strong>`;
      const s = oppSummary(o);
      htmlParts.push(`<li>${titleHtml}${s ? `<br><span style="color:#777;font-size:14px">${esc(s)}</span>` : ""}</li>`);
    }
    htmlParts.push(`</ul>`);
  }
  htmlParts.push(`<p style="font-family:system-ui,sans-serif;color:#999;font-size:13px;margin-top:30px">Curated by ${esc(brand)}. Forward to an artist who needs it.</p>`);
  const newsletterHtml = htmlParts.join("\n");

  // newsletter plaintext (for Substack's plain composer / email fallback)
  const newsletterText = plain;

  return {
    meta: { brand, region, week, count: n, groups: groupEntries.map(([l, i]) => ({ label: l, count: i.length })) },
    instagram,
    plain,
    newsletterHtml,
    newsletterText,
  };
}
