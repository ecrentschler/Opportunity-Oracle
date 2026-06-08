// src/enrichment/parser.js
// Loose extractor — turns scraped/pasted text into a partial opportunity.
// Conservative by design: never invents. Unknown stays empty.
import { classify, CITY_COORDS, today } from "./engine.js";

const MONTHS = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
function parseDateLoose(txt){
  const t=txt.toLowerCase();
  // ISO
  let m=t.match(/(\d{4})-(\d{2})-(\d{2})/); if(m) return m[0];
  // Month DD, YYYY  or  Month DD
  m=t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/);
  if(m){
    const mo=MONTHS[m[1]], day=+m[2];
    let yr=m[3]?+m[3]:new Date().getFullYear();
    const cand=new Date(yr,mo,day);
    if(!m[3] && cand < new Date(today())) yr+=1;
    return `${yr}-${String(mo+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }
  // MM/DD or MM/DD/YYYY
  m=t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if(m){
    const mo=+m[1]-1, day=+m[2];
    let yr=m[3]? (m[3].length===2?2000+ +m[3]:+m[3]) : new Date().getFullYear();
    const cand=new Date(yr,mo,day);
    if(!m[3] && cand < new Date(today())) yr+=1;
    return `${yr}-${String(mo+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }
  return "";
}

function parseIntake(raw){
  const text=raw.trim();
  const lines=text.split(/\n+/).map(l=>l.trim()).filter(Boolean);
  const low=text.toLowerCase();
  const out={
    title:"", description:text.slice(0,600), category:"auto",
    city:"", venueName:"", organizationName:"",
    dateStart:"", deadline:"", contactEmail:"", contactSocial:"",
    applicationUrl:"", payMin:0, payMax:0, fee:0, _found:[]
  };
  const F=l=>out._found.push(l);

  // title = first substantial line; if it's one long blob, take the first clause
  let t0 = (lines.find(l=>l.length>3 && l.length<120) || lines[0] || "Untitled").replace(/^[#*\-\s]+/,"");
  if(t0.length>90){
    const clause = t0.split(/\s[\/|—–-]\s|\.\s|!\s|@\s|\bwww\.|https?:/)[0].trim();
    t0 = (clause.length>3 && clause.length<=90) ? clause : t0.slice(0,80).trim()+"…";
  }
  out.title = t0;
  F("title");

  // email
  let m=text.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
  if(m){ out.contactEmail=m[0]; F("email"); }

  // social handle
  m=text.match(/@[A-Za-z0-9_.]{2,30}/);
  if(m && !out.contactEmail.includes(m[0])){ out.contactSocial=m[0].replace(/[._]+$/,""); F("social"); }

  // url / application link
  const urls=text.match(/https?:\/\/[^\s)>\]]+/g);
  if(urls){
    out.applicationUrl = urls.find(u=>/apply|submission|form|callforentry|cafe|artcall|submittable|tally|typeform|google\.com\/forms/i.test(u)) || urls[0];
    F("link");
  }

  // dates — deadline keywords win for deadline slot
  const dlLine = lines.find(l=>/deadline|apply by|submit by|due|closes|applications close|entry deadline/i.test(l));
  if(dlLine){ const d=parseDateLoose(dlLine); if(d){ out.deadline=d; F("deadline"); } }
  const evLine = lines.find(l=>/(date|when|happening|takes place|join us|live on|performing|show)/i.test(l)) || lines.find(l=>parseDateLoose(l));
  if(evLine){ const d=parseDateLoose(evLine); if(d && d!==out.deadline){ out.dateStart=d; F("event date"); } }
  if(!out.dateStart && !out.deadline){ const d=parseDateLoose(text); if(d){ out.dateStart=d; F("date"); } }

  // city — scan known anchors first
  for(const c of Object.keys(CITY_COORDS)){
    if(low.includes(c)){ out.city=c.replace(/\b\w/g,x=>x.toUpperCase()); F("city"); break; }
  }
  if(!out.city){
    m=text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),?\s+(MI|Michigan|OH|IL|IN|MI\b)/);
    if(m){ out.city=m[1]; F("city"); }
  }

  // venue / org
  m=text.match(/(?:at|@)\s+([A-Z][\w'&\- ]{2,40})(?:\n|,|\.|!)/);
  if(m){ out.venueName=m[1].trim(); F("venue"); }
  m=text.match(/(?:presented by|hosted by|brought to you by|by)\s+([A-Z][\w'&\- ]{2,40})/i);
  if(m){ out.organizationName=m[1].trim(); F("organizer"); }

  // money
  m=low.match(/\$\s?(\d{2,5})(?:\s?[-–]\s?\$?\s?(\d{2,5}))?/);
  if(m){
    const a=+m[1], b=m[2]?+m[2]:a;
    if(/fee|cost|application fee|entry fee|booth.*\$|\$.*booth|vendor fee/.test(low)){
      out.fee=Math.min(a,b); F("fee");
    } else {
      out.payMin=Math.min(a,b); out.payMax=Math.max(a,b); F("pay");
    }
  }
  if(/free to apply|no application fee|no entry fee/.test(low)){ out.fee=0; }

  out.category=classify(text);
  return out;
}
export { parseDateLoose, parseIntake };
