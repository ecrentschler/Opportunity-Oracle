// src/jobs/digest.js
// Daily wake-up digest. Server picks: top-rank new opportunities, anything
// that just turned prep-urgent, and pending follow-ups, then emails them.
// SMTP-agnostic: works with Gmail app-passwords, Resend, Mailgun, SendGrid,
// Postmark, anything that speaks SMTP. If unconfigured, sends nothing —
// silent no-op, never crashes the server.
import nodemailer from "nodemailer";
import { store } from "../store/db.js";
import { recurrenceForecasts } from "../enrichment/forecast.js";

const isoDay = (d = new Date()) => d.toISOString().slice(0, 10);
const fmtDate = (s) => {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

function digestPayload() {
  const opps = store.all("opportunities");
  const live = opps.filter((o) => !["Archived", "Declined", "Accepted"].includes(o.status));

  // Top new (added within last 24h, by rank)
  const cutoff = new Date(Date.now() - 28 * 3600e3).toISOString().slice(0, 10);
  const fresh = live
    .filter((o) => (o.createdAt || "") >= cutoff)
    .sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
    .slice(0, 8);

  // Prep-urgent (the "don't find out too late" set)
  const prep = live
    .filter((o) => o.prepUrgent)
    .sort((a, b) => (a.deadline > b.deadline ? 1 : -1))
    .slice(0, 6);

  // Deadlines arriving within 7 days regardless of prep status
  const today = isoDay();
  const dueSoon = live
    .filter((o) => o.deadline && o.deadline >= today)
    .filter((o) => {
      const d = (new Date(o.deadline) - new Date(today)) / 86400000;
      return d <= 7 && d >= 0;
    })
    .sort((a, b) => (a.deadline > b.deadline ? 1 : -1))
    .slice(0, 6);

  // Recurrence forecasts whose watch window opens this week
  const forecasts = recurrenceForecasts()
    .filter((r) => r.daysOut >= 0 && r.daysOut <= 30)
    .slice(0, 4);

  return { fresh, prep, dueSoon, forecasts, asOf: today };
}

function renderHtml({ fresh, prep, dueSoon, forecasts, asOf }, baseUrl) {
  const oppLine = (o) => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #2a241b">
      <a href="${baseUrl}/" style="color:#e8e1d4;text-decoration:none;font-family:Georgia,serif;font-size:17px">${escape(o.title)}</a><br>
      <span style="font-family:'Courier New',monospace;font-size:11px;color:#9c9384">
        ${escape(o.category)} · ${escape(o.city || "—")} ·
        ${o.deadline ? `<span style="color:#d4493c">due ${fmtDate(o.deadline)}</span>` : ""}
        ${o.payMax ? ` · $${o.payMax}` : ""} · rank ${o.rankScore || 0}
      </span>
      ${o.prepReason ? `<br><span style="font-family:'Courier New',monospace;font-size:11px;color:#c9a24b">⚡ ${escape(o.prepReason)}</span>` : ""}
    </td></tr>`;
  const section = (title, color, items, render) =>
    !items.length ? "" : `
    <h2 style="font-family:Georgia,serif;font-weight:500;font-size:20px;color:${color};margin:32px 0 8px;border-bottom:1px solid #3a3126;padding-bottom:8px">${title}</h2>
    <table cellpadding="0" cellspacing="0" border="0" width="100%">${items.map(render).join("")}</table>`;

  return `<!doctype html><html><body style="margin:0;padding:0;background:#0a0908;color:#e8e1d4;font-family:Georgia,serif">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;margin:0 auto;padding:32px 22px;background:#0a0908">
      <tr><td>
        <div style="font-family:Georgia,serif;font-size:28px;color:#e8e1d4">Opportunity Oracle</div>
        <div style="font-family:Georgia,serif;font-size:28px;color:#c9a24b;font-style:italic">— daily reading</div>
        <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:.2em;color:#6b6256;margin-top:8px;text-transform:uppercase">${asOf}</div>

        ${section("⚡ Prep window open — work on these now", "#d4493c", prep, oppLine)}
        ${section("◆ Deadlines within 7 days", "#e6c068", dueSoon, oppLine)}
        ${section("☉ New since yesterday", "#6fe0d9", fresh, oppLine)}
        ${section("✶ Recurrence forecasts (watch starting soon)", "#9b78c9", forecasts, (f) => `
          <tr><td style="padding:10px 0;border-bottom:1px solid #2a241b">
            <span style="font-family:Georgia,serif;font-size:17px">${escape(f.title.trim())}</span><br>
            <span style="font-family:'Courier New',monospace;font-size:11px;color:#9c9384">
              ${escape(f.category)} · predicted ~${fmtDate(f.predictedWindow)} · ${f.daysOut}d out · ${escape(f.confidence)}
            </span>
          </td></tr>`)}

        ${(!prep.length && !dueSoon.length && !fresh.length && !forecasts.length)
          ? `<div style="font-family:Georgia,serif;font-style:italic;color:#6b6256;padding:30px 0">The oracle is quiet this morning. Nothing urgent.</div>` : ""}

        <div style="margin-top:40px;padding-top:20px;border-top:1px solid #3a3126;font-family:'Courier New',monospace;font-size:10px;color:#544b3f;line-height:1.7">
          <a href="${baseUrl}/" style="color:#c9a24b;text-decoration:none">open the oracle →</a><br>
          Sent because you have DIGEST_TO set. Unset that env var to stop these.
        </div>
      </td></tr>
    </table>
  </body></html>`;
}

function escape(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// One-shot send. Called by scheduler or by `npm run digest`.
export async function sendDigest({ silent = false } = {}) {
  const to = process.env.DIGEST_TO;
  if (!to) {
    if (!silent) console.log("[digest] DIGEST_TO not set — skipping (configure in .env)");
    return { sent: false, reason: "no-recipient" };
  }
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    if (!silent) console.log("[digest] SMTP_HOST/USER/PASS not set — skipping");
    return { sent: false, reason: "no-smtp" };
  }

  const data = digestPayload();
  const baseUrl = process.env.PUBLIC_URL || "http://localhost:" + (process.env.PORT || 3000);
  const html = renderHtml(data, baseUrl);

  const transporter = nodemailer.createTransport({
    host,
    port: +(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true", // typically false for STARTTLS:587
    auth: { user, pass },
  });

  const subject = data.prep.length
    ? `Oracle — ${data.prep.length} prep window${data.prep.length === 1 ? "" : "s"} open`
    : data.dueSoon.length
    ? `Oracle — ${data.dueSoon.length} deadline${data.dueSoon.length === 1 ? "" : "s"} this week`
    : data.fresh.length
    ? `Oracle — ${data.fresh.length} new`
    : "Oracle — quiet morning";

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Oracle" <${user}>`,
      to, subject, html,
    });
    console.log(`[digest] sent → ${to} (${info.messageId})`);
    return { sent: true, summary: { prep: data.prep.length, dueSoon: data.dueSoon.length, fresh: data.fresh.length } };
  } catch (e) {
    console.error("[digest] send failed:", e.message);
    return { sent: false, reason: "smtp-error", error: e.message };
  }
}
