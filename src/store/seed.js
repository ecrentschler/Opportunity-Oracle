// src/store/seed.js
// First-run seed: real Draem profile + curated genuinely-scannable sources.
import { store } from "./db.js";

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const PROFILE = {
  artistName: "Draem", realName: "Eric", location: "Willis, MI",
  radiusMiles: 250,
  types: ["DJ Booking", "Vendor Market", "Installation Call", "Gallery Open Call",
    "Festival Application", "Ecstatic Dance / Movement", "Public Art RFQ/RFP"],
  musicGenres: ["ritual bass", "tribal bass", "ecstatic dance", "dark house",
    "experimental bass", "downtempo", "organic house"],
  artMediums: ["electroformed copper jewelry", "laser cut art", "CNC reliefs",
    "installation art", "ritual objects", "sacred geometry", "Norse", "Egyptian"],
  vibeKeywords: ["underground", "ritual", "ecstatic", "immersive", "dark",
    "sacred", "shamanic", "ancient", "mythic", "ceremonial", "festival",
    "queer-friendly", "transformational"],
  avoidKeywords: ["jam band", "corporate wedding", "country bar", "cover band",
    "kids party", "top 40"],
  minimumPay: 150,
  portfolio: "etsy.com/shop/ArtofDreamwalker",
  music: "soundcloud / DRAEM", instagram: "@i_am_dreamwalker",
  shop: "etsy.com/shop/ArtofDreamwalker",
};

const ASSETS = [
  ["Short artist bio", "Draem is a Michigan-based multidisciplinary artist working at the intersection of sacred symbolism and ancient-futuristic sound. Electroformed copper, ritual objects, and dark immersive electronic music."],
  ["DJ bio", "DRAEM crafts ritual-bass journey sets — tribal low-end, downtempo ceremony, and ecstatic peaks. Built for conscious dance floors, festival temples, and the sacred-weird hours."],
  ["Vendor bio", "ArtofDreamwalker — handcrafted electroformed copper jewelry with Norse and Egyptian themes. 260+ sales, 4.9 stars. Sacred geometry wearable as talisman."],
  ["Artist statement", "My work treats craft as sacred labor. Drawing on Egyptian, Norse, and shamanic traditions, I make objects and sound that feel unearthed rather than manufactured — ancient but futuristic, sacred but feral."],
  ["Tech rider / needs", "DJ: CDJ-3000s or XDJ, DJM mixer, monitor. Bring own USBs/headphones. Installation: 1-2 dedicated 20A circuits. Vendor: 10x10, own tent/tables/power."],
  ["Links block", "Etsy: etsy.com/shop/ArtofDreamwalker · IG: @i_am_dreamwalker · Music: SoundCloud DRAEM"],
];

// Watchlist proposal v1 — reweighted toward LARGER venues, popular collectives,
// and big juried events per Draem's preference. Small/local ritual/ecstatic
// kept but at Tier 3 (still in radar, not the priority lane). Each source has:
//   tier 1-5 (priority lane), bridgeNeeded (true = IG/FB, needs RSS.app/Inoreader),
//   handle (the public account/page if applicable), expectedCadence (days),
//   notes (what to expect from it). See DRAEM-WATCHLIST.md for rationale.
const SOURCES = [
  // ============================================================
  // TIER 1 — BIG VENUES + MAJOR FESTIVALS + FLAGSHIP EVENTS
  // (the lane that moves careers, not just fills weeknights)
  // ============================================================
  ["Russell Industrial Center (Bandsintown)", "rss", "https://rss.app/feeds/bandsintown-russell-industrial-center.xml", "Detroit", "DJ Booking,Live Performance", 1, true, "@russellindustrialcenter", 10, "1,500-cap warehouse venue. Kettama, Boogie T, Sunn O))) tier bookings. Build the bandsintown→rss bridge for it."],
  ["Lincoln Factory (Bandsintown)", "rss", "https://rss.app/feeds/bandsintown-lincoln-factory.xml", "Detroit", "DJ Booking,Underground / Afterhours", 1, true, "@lincolnfactorydetroit", 10, "Marble Bar team's new high-cap warehouse venue at Dreamtroit/Art Park. Bridge bandsintown."],
  ["Movement Music Festival", "website", "https://www.movement.us/", "Detroit", "Festival Application,DJ Booking", 1, false, "", 90, "Memorial weekend flagship — Detroit's biggest. Even adjacent bookings carry massive lineup pull."],
  ["Movement Afters (curated listings)", "website", "https://movementafters.com/", "Detroit", "DJ Booking,Underground / Afterhours", 1, false, "", 60, "Memorial weekend afters ecosystem — the slot you actually want."],
  ["Interdimensional Transmissions (IG)", "rss", "", "Detroit", "DJ Booking,Underground / Afterhours", 1, true, "@idmtransmissions", 30, "Detroit institution. The Bunker. Top-tier underground programming."],
  ["Detroit Techno Militia", "website", "https://www.detroittechnomilitia.com/", "Detroit", "DJ Booking", 1, false, "", 30, "Major promoter + collective + label. Long-standing influence."],
  ["ArtPrize (Grand Rapids)", "website", "https://www.artprize.org/", "Grand Rapids", "Festival Application,Installation Call,Gallery Open Call", 1, false, "", 365, "Annual Sept-Oct flagship art event. Anyone can apply. Whole 3-sq-mi district becomes venues. Major exposure."],
  ["Detroit Urban Craft Fair (DUCF)", "website", "https://detroiturbancraftfair.com/blog/", "Detroit", "Vendor Market", 1, false, "", 90, "Handmade Detroit's flagship indie craft fair. Masonic Temple. Apps open early August for December event. Major vendor opportunity."],

  // ============================================================
  // TIER 2 — MID-SIZE VENUES / SERIOUS COLLECTIVES / KEY MARKETS
  // (where steady bookings live; the active scene ring)
  // ============================================================
  ["Tangent Gallery (IG)", "rss", "", "Detroit", "DJ Booking,Live Performance,Installation Call", 2, true, "@tangentgallery", 10, "Major underground venue. Experimental + late-night."],
  ["TV Lounge Detroit (IG)", "rss", "", "Detroit", "DJ Booking", 2, true, "@tvloungedetroit", 10, "Detroit institution. Movement kickoff venue."],
  ["Spot Lite Detroit (IG)", "rss", "", "Detroit", "DJ Booking,Underground / Afterhours", 2, true, "@spotlitedetroit", 10, "Frequent underground bookings. Active programming."],
  ["Marble Bar (IG)", "rss", "", "Detroit", "DJ Booking", 2, true, "@marblebardetroit", 10, "Detroit techno mainstay. Sister venue to Lincoln Factory."],
  ["El Club Detroit (IG)", "rss", "", "Detroit", "DJ Booking,Live Performance", 2, true, "@elclubdetroit", 10, "Southwest Detroit venue. Wide booking range."],
  ["Magic Stick / Majestic complex (IG)", "rss", "", "Detroit", "DJ Booking,Live Performance", 2, true, "@majesticdetroit", 14, "Multi-room venue complex."],
  ["19hz.info Detroit", "website", "https://19hz.info/eventlisting_Detroit.php", "Detroit", "DJ Booking,Underground / Afterhours", 2, false, "", 3, "Public underground event calendar — highest-leverage scannable source for the active scene."],
  ["Low Visibility (IG)", "rss", "", "Detroit", "Underground / Afterhours", 2, true, "@lowvisibility", 60, "Convergence @ Paris Bar. Hot collective."],
  ["Apex Fundamentals (IG)", "rss", "", "Detroit", "Underground / Afterhours", 2, true, "@apexfundamentals", 60, "Underground community building."],
  ["Paris Bar Hamtramck (IG)", "rss", "", "Hamtramck", "Underground / Afterhours", 2, true, "@parisbarhamtramck", 14, "Convergence host. Active Hamtramck venue."],
  ["Sunday Artisan Market (A2)", "website", "https://sundayartisanmarket.org/vendor-information/application", "Ann Arbor", "Vendor Market", 2, false, "", 7, "Year-round juried, fast turnaround. Best recurring vendor slot in your radius."],
  ["Detroit Artists Market", "website", "https://detroitartistsmarket.org/", "Detroit", "Gallery Open Call,Vendor Market", 2, false, "", 90, "Art for the Holidays (Nov-Dec, 1500 works, 100 artists). Ceramic/jewelry/textile focus — fits."],
  ["Handcrafters Plymouth (Spring/Fall/Tinsel)", "website", "https://www.hcshows.com/exhibit", "Plymouth", "Vendor Market,Art Fair", 2, false, "", 90, "3 juried shows/year: Feb 28 / Aug 31 / Oct 31 deadlines. Predictable recurrence."],

  // ============================================================
  // TIER 3 — LOCAL / RITUAL / ECSTATIC / KNOWN COMMUNITY
  // (smaller events you know — kept on the radar, not the lead)
  // ============================================================
  ["Detroit & A2 Ecstatic Dance (IG)", "rss", "", "Detroit", "DJ Booking,Ecstatic Dance / Movement", 3, true, "@detroit_a2_ecstatic_dance", 14, "Guest DJ slots, 2 dances/mo. Existing relationship anchor with Charity Loring."],
  ["Vibe UPP / Ekanti (IG)", "rss", "", "Ypsilanti", "DJ Booking,Underground / Afterhours", 3, true, "@ekanti", 21, "Closest aesthetic neighbor — house/techno + transformative. Ypsilanti."],
  ["Elemental Ecstatic Dance (A2 Yoga)", "website", "https://annarborobserver.com/mc-events/elemental-ecstatic-dance-9/", "Ann Arbor", "Ecstatic Dance / Movement", 3, false, "", 7, "Feature DJ slots Sundays — observer listing has dates."],
  ["Wake Your Waters / Detroit Abloom (IG)", "rss", "", "Detroit", "Ecstatic Dance / Movement", 3, true, "@wakeyourwaters", 30, "Conscious collective, sound journey format."],
  ["Indigo Grace (A2 venue, IG)", "rss", "", "Ann Arbor", "Ecstatic Dance / Movement", 3, true, "@indigograce", 30, "Ritual gatherings, ecstatic events."],
  ["Ann Arbor Farmers Market", "website", "https://www.a2gov.org/parks-and-recreation/parks-and-places/ann-arbor-farmers-market/", "Ann Arbor", "Vendor Market", 3, false, "", 365, "Returning Mar 1 / new Apr 1 deadlines. Annual but predictable."],
  ["Michigan Makers Market", "website", "https://www.michiganmakersmarket.org/", "", "Vendor Market", 3, false, "", 365, "Nov 14 event; apps open earlier."],
  ["Ferndale Dot / Rust Belt (IG)", "rss", "", "Ferndale", "Vendor Market", 3, true, "@rustbeltmarket", 30, "Curated Ferndale markets."],

  // ============================================================
  // TIER 4 — FESTIVAL / BURN / IMMERSIVE / RESIDENCY
  // (career-mover lane: bigger festivals + immersive opportunities)
  // ============================================================
  ["Lakes of Fire (regional burn)", "website", "https://lakesoffire.org/", "", "Festival Application,Installation Call", 4, false, "", 365, "Regional burn; art grants + theme camp + DJ slots."],
  ["John Michael Kohler — Midsummer Festival", "website", "https://www.jmkac.org/engage/programs/midsummer-festival-of-the-arts/", "Sheboygan WI", "Art Fair,Vendor Market", 4, false, "", 365, "Major Midwest juried fest. Apps Dec 15 - Mar 2 for July event. Driveable from MI."],
  ["Northville Art House (juried)", "website", "https://www.northvilleartshouse.org/", "Northville", "Gallery Open Call", 4, false, "", 120, "Juried exhibitions. $700+ cash/prizes. Close to home."],
  ["Indianapolis Art Center — Art From the Heartland", "website", "https://www.indplsartcenter.org/", "Indianapolis", "Gallery Open Call", 4, false, "", 365, "Midwest-region juried, $4,000 in awards. May deadline."],
  ["Artlink Midwest Regional (CaFE)", "website", "https://artist.callforentry.org/festivals.php", "", "Gallery Open Call", 4, false, "", 365, "Indiana/Ohio/MI/IL+ eligible. Annual Jan-Feb exhibition window."],
  ["Burning Man regional events", "website", "https://burningman.org/network/regional-network/", "", "Festival Application,Installation Call", 4, false, "", 90, "All regional burns + art grant calls."],

  // ============================================================
  // TIER 5 — GALLERIES / PUBLIC ART / MURALS / GRANTS (slower lane)
  // ============================================================
  ["Crazy Wisdom (your show, IG)", "rss", "", "Ann Arbor", "Gallery Open Call", 5, true, "@crazywisdomaa", 90, "Your June 2026 show. Existing relationship — track for repeat/sister opportunities."],
  ["Ann Arbor Art Center", "website", "https://www.annarborartcenter.org/", "Ann Arbor", "Gallery Open Call", 5, false, "", 30, "Open calls, gallery."],
  ["U-M Stamps", "website", "https://stamps.umich.edu/", "Ann Arbor", "Gallery Open Call,Installation Call", 5, false, "", 30, "Gallery calls, installations."],
  ["Detroit City Walls", "website", "https://detroitmi.gov/departments/general-services-department/city-walls", "Detroit", "Mural Call,Public Art RFQ/RFP", 5, false, "", 90, "Mural calls."],
  ["CultureSource opportunities", "website", "https://www.culturesource.org/opportunities/", "Detroit", "Grant,Gallery Open Call", 5, false, "", 7, "Grant + opportunity aggregator. High-frequency feed."],
  ["Michigan Arts & Culture Council", "website", "https://www.michiganbusiness.org/about-macc/", "", "Grant", 5, false, "", 90, "State grants."],
];

export function seedIfEmpty() {
  if (store.getProfile()) return false;
  store.setProfile(PROFILE);
  for (const [type, content] of ASSETS)
    store.insert("assets", { id: uid(), type, content });
  for (const [name, type, url, city, categories, tier, bridgeNeeded, handle, expectedCadence, notes] of SOURCES)
    store.insert("sources", {
      id: uid(), name, type, url, city, categories,
      tier, bridgeNeeded: bridgeNeeded ? 1 : 0, handle,
      expectedCadence, notes,
      enabled: bridgeNeeded ? 0 : 1, // bridge-needed sources disabled until you paste a feed URL
      lastChecked: "", lastStatus: "",
    });
  return true;
}
