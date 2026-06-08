// src/enrichment/engine.js
// Scoring + classification engine, ported verbatim from the dashboard
// so the server and UI score identically. Pure functions, no DOM.

// date helpers (mirror the dashboard prelude — engine depends on these)
const today = () => new Date().toISOString().slice(0, 10);
function daysUntil(d) {
  if (!d) return null;
  const t = new Date(today()), x = new Date(d);
  return Math.round((x - t) / 86400000);
}

const CATEGORIES = [
  "DJ Booking","Live Performance","Festival Application","Vendor Market",
  "Art Fair","Mural Call","Public Art RFQ/RFP","Gallery Open Call",
  "Installation Call","Residency","Grant","Workshop / Facilitation",
  "Ecstatic Dance / Movement","Underground / Afterhours","Venue Lead",
  "Networking Lead","Projection / Visual Call","Sound Artist Call",
  "Community Art Project"
];

const CAT_KEYWORDS = {
  "DJ Booking":["dj","lineup","selector","set time","decks","b2b","opener","support act","club night","resident"],
  "Underground / Afterhours":["afters","afterhours","warehouse","secret","underground","loft","basement party","renegade"],
  "Ecstatic Dance / Movement":["ecstatic dance","movement","embodiment","somatic","sound journey","conscious dance","cacao"],
  "Festival Application":["festival","camping","burn","lakes of fire","transformational","artist application","theme camp"],
  "Vendor Market":["vendor","booth","market","makers market","pop-up","popup","craft fair","artisan"],
  "Art Fair":["art fair","art market","fine art fair"],
  "Mural Call":["mural","wall","exterior paint","muralist"],
  "Public Art RFQ/RFP":["public art","rfq","rfp","percent for art","civic art","call to artists"],
  "Gallery Open Call":["open call","exhibition","group show","juried","gallery","call for entry","art show"],
  "Installation Call":["installation","immersive","activation","interactive","sculpture","art build","large-scale"],
  "Residency":["residency","artist in residence","studio residency","fellowship residency"],
  "Grant":["grant","funding","stipend","award","microgrant","fiscal sponsor"],
  "Workshop / Facilitation":["workshop","facilitate","teach","class","lead a session","facilitator"],
  "Projection / Visual Call":["projection","vj","visuals","video mapping","projection mapping","light artist"],
  "Sound Artist Call":["sound artist","sound installation","field recording","sonic","sound bath"],
  "Live Performance":["performance","perform","stage","live act","showcase","feature artist"],
  "Venue Lead":["venue","book the room","host night","residency night","monthly night"],
  "Community Art Project":["community art","mural community","collaborative art","neighborhood art"],
  "Networking Lead":["meetup","mixer","artist meet","networking","creative social"]
};

function classify(text){
  const t=(text||"").toLowerCase();
  let best="Networking Lead", score=0;
  for(const [cat,kws] of Object.entries(CAT_KEYWORDS)){
    let s=0;
    for(const k of kws){ if(t.includes(k)) s += k.length>6?2:1; }
    if(s>score){ score=s; best=cat; }
  }
  return best;
}

/* haversine-free rough distance via known MI anchor cities */
const CITY_COORDS = {
  "detroit":[42.33,-83.05],"ann arbor":[42.28,-83.74],"ypsilanti":[42.24,-83.61],
  "willis":[42.13,-83.65],"ferndale":[42.46,-83.13],"hamtramck":[42.39,-83.06],
  "grand rapids":[42.96,-85.67],"lansing":[42.73,-84.55],"chicago":[41.88,-87.63],
  "cleveland":[41.50,-81.69],"toledo":[41.65,-83.54],"columbus":[39.96,-82.99],
  "kalamazoo":[42.29,-85.59],"flint":[43.01,-83.69],"pontiac":[42.64,-83.29]
};
function distMiles(city, home){
  if(!city) return null;
  const c=CITY_COORDS[city.toLowerCase().trim().split(",")[0]];
  const h=CITY_COORDS[(home||"willis").toLowerCase().trim().split(",")[0]] || CITY_COORDS["willis"];
  if(!c) return null;
  const dy=(c[0]-h[0])*69, dx=(c[1]-h[1])*54;
  return Math.round(Math.sqrt(dx*dx+dy*dy));
}

function scoreFit(opp, profile){
  const reasons=[], warnings=[];
  let pts=0, max=0;
  const blob = `${opp.title} ${opp.description} ${opp.venueName} ${opp.organizationName}`.toLowerCase();

  // distance (25)
  max+=25;
  const d = distMiles(opp.city, profile.location);
  if(d!=null){
    if(d<=profile.radiusMiles){
      const close = Math.max(0, 25 - (d/profile.radiusMiles)*16);
      pts+=Math.round(close);
      reasons.push(`Within ${d} mi (radius ${profile.radiusMiles})`);
    } else { warnings.push(`~${d} mi — outside ${profile.radiusMiles} mi radius`); }
  } else if(opp.city){ pts+=10; warnings.push(`Distance to ${opp.city} unknown`); }
  else { pts+=8; }

  // category match (22)
  max+=22;
  if(profile.types.includes(opp.category) ||
     profile.types.some(t=> opp.category.toLowerCase().includes(t.toLowerCase()))){
    pts+=22; reasons.push(`Category match: ${opp.category}`);
  } else { warnings.push(`Category "${opp.category}" not in your focus`); }

  // vibe keyword match (20)
  max+=20;
  const vibeHits = (profile.vibeKeywords||[]).filter(k=>blob.includes(k.toLowerCase()));
  if(vibeHits.length){
    pts+=Math.min(20, vibeHits.length*7);
    reasons.push(`Vibe: ${vibeHits.slice(0,4).join(", ")}`);
  }
  // genre / medium
  const gmHits = [...(profile.musicGenres||[]),...(profile.artMediums||[])]
    .filter(k=>blob.includes(k.toLowerCase()));
  if(gmHits.length){ pts+=Math.min(8,gmHits.length*4); max+=8; reasons.push(`Match: ${gmHits.slice(0,3).join(", ")}`); }
  else { max+=8; }

  // avoid keywords (penalty)
  const avoidHits=(profile.avoidKeywords||[]).filter(k=>blob.includes(k.toLowerCase()));
  if(avoidHits.length){ pts-=18; warnings.push(`Avoid-flag: ${avoidHits.join(", ")}`); }

  // pay (15)
  max+=15;
  if(opp.payMax>0){
    if(opp.payMax>=profile.minimumPay){ pts+=15; reasons.push(`Pays $${opp.payMax} (≥ your $${profile.minimumPay} min)`); }
    else { pts+=5; warnings.push(`Pay $${opp.payMax} below your $${profile.minimumPay} min`); }
  } else if(opp.fee>0){ pts+=4; warnings.push(`Costs $${opp.fee} to apply/vend`); }
  else { pts+=7; warnings.push("Pay not listed"); }

  // contact present (10)
  max+=10;
  if(opp.contactEmail||opp.contactSocial||opp.applicationUrl){ pts+=10; }
  else { warnings.push("No contact / application path found"); }

  const fit = Math.max(0, Math.min(100, Math.round((pts/max)*100)));
  return {fitScore:fit, reasons, warnings};
}

function scoreUrgency(opp){
  const reasons=[];
  let u=10;
  const dl = daysUntil(opp.deadline);
  const ev = daysUntil(opp.dateStart);
  if(dl!=null){
    if(dl<0){ u=5; reasons.push("Deadline passed"); }
    else if(dl<=2){ u=98; reasons.push(`Deadline in ${dl}d`); }
    else if(dl<=7){ u=85; reasons.push(`Deadline in ${dl}d`); }
    else if(dl<=14){ u=65; reasons.push(`Deadline in ${dl}d`); }
    else if(dl<=30){ u=45; reasons.push(`Deadline in ${dl}d`); }
    else { u=25; reasons.push(`Deadline in ${dl}d`); }
  }
  if(ev!=null && ev>=0){
    let eu = ev<=3?90 : ev<=7?75 : ev<=21?50 : ev<=60?30 : 15;
    if(eu>u){ u=eu; reasons.push(`Event in ${ev}d`); }
  }
  if(dl==null && ev==null){ reasons.push("No dates — watchlist"); u=15; }
  let bucket = u>=80?"Act this week" : u>=50?"Soon" : u>=30?"Research later" : "Watchlist";
  return {urgencyScore:u, urgencyBucket:bucket, urgencyReasons:reasons};
}

function scoreValue(opp, profile){
  const reasons=[];
  let v=30;
  if(opp.payMax>=500){ v+=30; reasons.push("Strong pay"); }
  else if(opp.payMax>=150){ v+=18; reasons.push("Paid"); }
  else if(opp.payMax>0){ v+=8; reasons.push("Small pay"); }
  if(opp.fee>0){ v-= opp.fee>50?14:7; reasons.push(`-$${opp.fee} fee`); }
  else if(opp.payMax===0){ reasons.push("Unpaid — weigh exposure"); }
  const blob=`${opp.title} ${opp.description}`.toLowerCase();
  if(/festival|fest/.test(blob)){ v+=14; reasons.push("Festival reach"); }
  if(/gallery|museum|exhibition/.test(blob)){ v+=12; reasons.push("Portfolio/prestige"); }
  if(/residency|grant|fellowship/.test(blob)){ v+=16; reasons.push("Career-building"); }
  if(/crazy wisdom|black sands|recurring|monthly|series/.test(blob)){ v+=10; reasons.push("Repeat potential"); }
  if(opp.relationshipBoost){ v+=8; reasons.push("Existing relationship"); }
  v=Math.max(0,Math.min(100,v));
  return {valueScore:v, valueReasons:reasons};
}

function classifyAutomation(opp){
  const reasons=[];
  if(opp.fee>0){ return {automationStatus:"Blocked by Payment", autoReasons:[`$${opp.fee} fee — manual review required`]}; }
  const blob=`${opp.title} ${opp.description}`.toLowerCase();
  if(/login|sign in|account required|member/.test(blob)) return {automationStatus:"Blocked by Login",autoReasons:["Login wall detected"]};
  if(/captcha|recaptcha/.test(blob)) return {automationStatus:"Blocked by CAPTCHA",autoReasons:["CAPTCHA likely"]};
  if(/grant|tax|w-?9|legal|contract|budget/.test(blob)) return {automationStatus:"Manual Only",autoReasons:["Legal/financial info required"]};
  if(opp.contactEmail && !opp.applicationUrl){ return {automationStatus:"Can Auto-Send Email",autoReasons:["Email found — draft ready, you approve send"]}; }
  if(opp.applicationUrl){ return {automationStatus:"Needs Human Input",autoReasons:["External form — unknown fields, prep packet then submit manually"]}; }
  if(opp.contactSocial){ return {automationStatus:"Draft Only",autoReasons:["Social DM — copy draft, send from your account"]}; }
  return {automationStatus:"Needs Human Input",autoReasons:["No clear path — research contact"]};
}

// Prep lead time (days) the artist needs before a deadline, by category.
// Makes urgency proactive: it fires at (deadline - prep), not at deadline.
const PREP_DAYS = {
  "Grant":21,"Residency":18,"Public Art RFQ/RFP":14,"Mural Call":12,
  "Installation Call":14,"Festival Application":14,"Gallery Open Call":10,
  "Art Fair":8,"Vendor Market":7,"Workshop / Facilitation":7,
  "DJ Booking":3,"Live Performance":4,"Ecstatic Dance / Movement":3,
  "Sound Artist Call":7,"Projection / Visual Call":7,
  "Underground / Afterhours":2,"Community Art Project":7,
  "Venue Lead":3,"Networking Lead":1
};
function prepDaysFor(cat){ return PREP_DAYS[cat] ?? 7; }
function leadTimeFields(opp){
  const prep = prepDaysFor(opp.category);
  if(!opp.deadline) return {prepDays:prep,prepStart:"",prepUrgent:false,prepReason:""};
  const dDeadline = daysUntil(opp.deadline);
  const prepStart = (()=>{ const d=new Date(opp.deadline+"T00:00:00");
    d.setDate(d.getDate()-prep); return d.toISOString().slice(0,10); })();
  const dStart = daysUntil(prepStart);
  const prepUrgent = dStart<=3 && dDeadline>=0;
  let prepReason;
  if(dDeadline<0) prepReason="deadline passed";
  else if(dStart<=0) prepReason=`prep window open — needs ~${prep}d, due ${opp.deadline}`;
  else if(prepUrgent) prepReason=`prep starts in ${dStart}d — get ready (needs ~${prep}d)`;
  else prepReason=`start prep by ${prepStart} (${dStart}d out)`;
  return {prepDays:prep,prepStart,prepUrgent,prepReason};
}

function enrich(opp, profile){
  const cat = opp.category && opp.category!=="auto" ? opp.category
            : classify(`${opp.title} ${opp.description}`);
  const o = {...opp, category:cat};
  const lt = leadTimeFields(o);
  const u = scoreUrgency(o);
  // proactive bump: if prep window is open/imminent, urgency reflects it now
  if(lt.prepUrgent && u.urgencyScore < 80){
    u.urgencyScore = Math.max(u.urgencyScore, 82);
    u.urgencyBucket = "Act this week";
    u.urgencyReasons = [lt.prepReason, ...u.urgencyReasons];
  }
  return {
    ...o,
    ...scoreFit(o,profile),
    ...u,
    ...scoreValue(o,profile),
    ...classifyAutomation(o),
    ...lt
  };
}

const WEIGHTS = {fit:.45,urgency:.25,value:.20,rel:.10};
function rankScore(o){
  const rel = o.relationshipBoost?70:35;
  return Math.round(o.fitScore*WEIGHTS.fit + o.urgencyScore*WEIGHTS.urgency +
                    o.valueScore*WEIGHTS.value + rel*WEIGHTS.rel);
}

export { CATEGORIES, CITY_COORDS, today, daysUntil, prepDaysFor, leadTimeFields, classify, distMiles, scoreFit, scoreUrgency, scoreValue, classifyAutomation, enrich, rankScore };
