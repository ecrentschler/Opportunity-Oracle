// src/enrichment/confidence.js
// Verification + confidence layer. Reads an already-stored opportunity and
// scores how trustworthy / complete it is, WITHOUT changing the parser.
// Philosophy: the Oracle finds doors; the human confirms them. This makes the
// "what's verified vs. what needs checking" honest and visible.
//
// Two separate ideas, deliberately NOT merged:
//   1. completeness — how much of the info a person needs is actually present
//   2. verified     — a human clicked the source and confirmed it (manual flag)
// A listing can be 100% complete and still unverified. Both are shown.

const FIELDS_THAT_MATTER = [
  // field key, human label, weight (how much it matters for acting)
  ["title", "Title", 1],            // always present, low signal
  ["category", "Category", 1],
  ["city", "Location", 2],
  ["deadline", "Deadline", 3],      // the thing people miss most
  ["applicationUrl", "How to apply / link", 3],
  ["contactEmail", "Contact", 2],   // email OR social counts (handled below)
  ["payMax", "Pay / value", 1],
  ["description", "Description", 1],
];

// Returns { completeness: 0-100, present: [...labels], missing: [...labels],
//           sourceLink, sourceLinkType, confidenceBand }
export function assessOpportunity(o) {
  const present = [];
  const missing = [];
  let got = 0, total = 0;

  for (const [key, label, weight] of FIELDS_THAT_MATTER) {
    total += weight;
    let has = false;
    if (key === "contactEmail") {
      // contact is satisfied by email OR social OR an application URL
      has = !!(o.contactEmail || o.contactSocial || o.applicationUrl);
    } else if (key === "payMax") {
      has = (o.payMax > 0) || (o.fee > 0); // either a pay or a known fee counts as "money info present"
    } else if (key === "deadline") {
      has = !!(o.deadline || o.dateStart); // a date of some kind
    } else {
      has = !!o[key];
    }
    if (has) { got += weight; present.push(label); }
    else missing.push(label);
  }

  const completeness = Math.round((got / total) * 100);

  // where does the source of truth live? prefer original page, then app url
  const sourceLink = o.originalUrl || o.applicationUrl || o.sourceUrl || "";
  const sourceLinkType = o.originalUrl ? "original posting"
    : o.applicationUrl ? "application page"
    : o.sourceUrl ? "source site" : "none";

  // confidence band combines completeness with whether a real source link exists
  let band;
  if (!sourceLink) band = "unverifiable";          // no link to check against = treat with suspicion
  else if (completeness >= 80) band = "high";
  else if (completeness >= 55) band = "medium";
  else band = "low";

  return { completeness, present, missing, sourceLink, sourceLinkType, confidenceBand: band };
}

// Short human sentence for the UI, e.g. on a card.
export function confidenceSummary(o) {
  const a = assessOpportunity(o);
  if (o.verified) return `Verified by you${o.verifiedAt ? " · " + o.verifiedAt.slice(0,10) : ""}`;
  const bandText = {
    high: "Looks complete — confirm at source before acting",
    medium: "Partial info — check the source link",
    low: "Sparse — verify everything at the source",
    unverifiable: "No source link found — treat with caution",
  }[a.confidenceBand];
  return bandText;
}
