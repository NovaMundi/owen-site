// De planeten gaan mee tussen huizen en apparaten. Zelfde opzet als Supervrienden:
//   1. De opslag op het apparaat blijft de bron. Geen internet? Gewoon doorspelen; het loopt
//      later vanzelf bij. Een kind ziet nooit een foutmelding omdat de wifi hapert.
//   2. Er wordt nooit stil iets overschreven. Is een planeet op twee apparaten veranderd, dan
//      kiest het kind welke het houdt.
//   3. Koppelen gebeurt één keer per apparaat, via een link met een uitnodiging erin. Daarmee
//      krijgt het apparaat een eigen geheime sleutel; de familiecode alleen is niet genoeg.
//
// Per planeet (owen, jake, papa) gaat alles mee: het recept, de levende wereld en de foto voor
// het startscherm. De ingesproken wensen gaan als één lijst mee en worden samengevoegd.

// Op de site zelf (en bij lokaal testen met 'netlify dev' op poort 8888) relatief, elders naar jakevanpelt.com.
const WOLK = location.hostname.endsWith('jakevanpelt.com') || location.port === '8888' ? '/.netlify/functions/planeten' : 'https://jakevanpelt.com/.netlify/functions/planeten';
const STAND = 'planeetmakers-wolk-v1';
const OPSLAG = { recept: 'planeetmakers-v1', wereld: 'planeetmakers-leven-v1', foto: 'planeetmakers-fotos-v1', wensen: 'planeetmakers-wensen-v1' };
import { ALLE_PLANEETIDS, spelerVan } from './keuzes.js';
// Welke planeten gaan mee: op de tablet van een kind alleen de eigen plekken (zie zetSpeler).
export let PLANETEN = [...ALLE_PLANEETIDS];

import { lees, schrijf, heeftGaten, SANDBOX } from './opslag.js';

// Vingerafdruk: is er sinds de laatste keer bijwerken iets veranderd? 'laatst' (wanneer er voor
// het laatst gekeken is) telt niet mee: alleen kijken is geen verandering.
function afdruk(obj) {
  const t = JSON.stringify(obj ?? null, (k, v) => (k === 'laatst' ? undefined : v));
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return t.length + '-' + h.toString(36);
}

// Wat uit de wolk komt, gaat de pagina in. Alleen echte plaatjes en geluiden doorlaten, en
// namen zonder HTML-tekens, zodat niemand met de familiecode er code in kan smokkelen.
const BEELD = /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/;
const GELUID = /^data:audio\/[a-z0-9.+-]+(;codecs=[a-z0-9.,-]+)?;base64,[A-Za-z0-9+/=]+$/i;
const tekst = (t) => (typeof t === 'string' ? t.replace(/[<>"'&`]/g, '').slice(0, 40) : t);
function veilig(data) {
  if (!data || typeof data !== 'object') return data;
  if (data.lijst) data.lijst = data.lijst.filter((w) => !w.audio || GELUID.test(w.audio)).map((w) => ({ ...w, tekst: tekst(w.tekst) }));
  if (data.foto && !BEELD.test(data.foto)) data.foto = null;
  const r = data.recept;
  if (r) {
    r.naam = tekst(r.naam);
    r.wezens = (r.wezens || [])
      .filter((w) => BEELD.test(w.plaatje || '') && (!w.dicht || BEELD.test(w.dicht)) && (!w.tekening || BEELD.test(w.tekening)))
      .map((w) => (w.mond && !BEELD.test(w.mond) ? { ...w, mond: null } : w))
      .map((w) => ({
        ...w,
        naam: tekst(w.naam) || 'Wezen',
        echt: w.echt && BEELD.test(w.echt.plaatje || '') ? w.echt : null,
        geluid: w.geluid && GELUID.test(w.geluid) ? w.geluid : null,
      }));
  }
  return data;
}

// Een verzoek dat blijft hangen (tablet even bevroren) mag de sync niet voorgoed blokkeren.
const wachtHooguit = (ms) => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);

const TEKENS = 'abcdefghjkmnpqrstuvwxyz23456789';
const WOORDEN = ['zorbix', 'blibo', 'lumi', 'kwasar', 'nebula', 'komeet', 'pluto', 'stardust', 'orbit', 'galaxo'];

let stand = lees(STAND, { code: null, versies: {}, afdrukken: {}, botsingen: {} });

// De eigen sleutel van dit apparaat meesturen (zie netlify/lib/planeet-toegang.mjs).
const kop = (extra = {}) => (stand.sleutel ? { ...extra, 'x-planeet-sleutel': stand.sleutel } : extra);
let sleutelBezig = null;
// De server kent onze sleutel niet (meer): vergeten, dan vraagt zorgSleutel een nieuwe (dat lukt
// tijdens de overgang; daarna zegt het wolkpaneel dat er een nieuwe koppel-link nodig is).
function sleutelAfgewezen(r) {
  if (r.status !== 401 || !stand.sleutel) return false;
  stand.sleutel = null;
  bewaarStand();
  return true;
}
async function zorgSleutel() {
  if (!stand.code || stand.sleutel) return !!stand.sleutel;
  // Eén aanvraag tegelijk, ook als alle planeten tegelijk willen ophalen.
  sleutelBezig ||= (async () => {
    try {
      const r = await fetch(`${WOLK}?code=${stand.code}&actie=sleutel`, {
        method: 'POST',
        signal: wachtHooguit(20000),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uitnodiging: stand.uitnodiging || null }),
      });
      if (r.ok) {
        stand.sleutel = (await r.json()).sleutel || null;
        delete stand.uitnodiging;
        bewaarStand();
      } else if (r.status === 401) {
        // De uitnodiging is verlopen of al te vaak gebruikt.
        delete stand.uitnodiging;
        stand.geweigerd = true;
        bewaarStand();
      }
    } catch {}
    sleutelBezig = null;
    return !!stand.sleutel;
  })();
  return sleutelBezig;
}
// Botsingen (de hele andere planeet, soms een paar MB) alleen in het geheugen houden: bij de
// volgende keer ophalen zien we ze vanzelf weer. Anders raakt het geheugen van de tablet vol.
stand.botsingen = {};
const bewaarStand = () => schrijf(STAND, { ...stand, botsingen: {} });
const timers = {};
let bezig = {};

export const wolk = {
  // Dit apparaat hoort bij één speler (owenvanpelt.com = Owen): alleen diens planeten ophalen en versturen.
  zetSpeler(speler) {
    PLANETEN = speler ? ALLE_PLANEETIDS.filter((id) => spelerVan(id) === speler) : [...ALLE_PLANEETIDS];
  },
  get code() {
    return stand.code;
  },
  get aan() {
    return !!stand.code;
  },
  botsing(wie) {
    return stand.botsingen[wie] || null;
  },
  // Voor andere verzoeken naar jakevanpelt.com (de toverknop).
  kop,
  get geweigerd() {
    return !!stand.geweigerd && !stand.sleutel;
  },
  // Alle andere apparaten loskoppelen (als er ooit een link rondgaat). Daarna alleen nog via een nieuwe koppel-link.
  async alleenDit() {
    if (!(await zorgSleutel())) return false;
    try {
      const r = await fetch(`${WOLK}?code=${stand.code}&actie=alleen-dit`, { method: 'POST', headers: kop(), signal: wachtHooguit(20000) });
      return r.ok;
    } catch {
      return false;
    }
  },
  // Een koppel-link voor een ander apparaat: met een verse uitnodiging (7 dagen, hooguit 5 keer).
  async maakLink(sites) {
    if (!(await zorgSleutel())) return null;
    try {
      // Per site een eigen uitnodiging: wie de QR van Owen scant, krijgt een sleutel voor Owen.
      const links = [];
      let u = null;
      for (const s of sites) {
        const speler = s.includes('owenvanpelt') ? 'owen' : s.includes('jakevanpelt') ? 'jake' : 'papa';
        const r = await fetch(`${WOLK}?code=${stand.code}&actie=uitnodig&speler=${speler}`, { method: 'POST', headers: kop(), signal: wachtHooguit(20000) });
        if (!r.ok) continue;
        u = await r.json();
        links.push(`${s}/planeten/?familie=${stand.code}&uitnodiging=${u.uitnodiging}`);
      }
      return u && links.length ? { ...u, links } : null;
    } catch {
      return null;
    }
  },

  // Een link als ?familie=zorbix-k3m7qp koppelt dit apparaat. Daarna haalt hij de code weg uit
  // het adres, zodat je hem niet per ongeluk deelt.
  koppelUitLink() {
    if (SANDBOX) return false; // de testomgeving gaat nooit naar de wolk
    const url = new URL(location.href);
    const code = (url.searchParams.get('familie') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (code.length < 8) return false;
    if (code !== stand.code) stand = { code, versies: {}, afdrukken: {}, botsingen: {} };
    const uitnodiging = (url.searchParams.get('uitnodiging') || '').toLowerCase().replace(/[^a-f0-9]/g, '');
    if (uitnodiging && !stand.sleutel) stand.uitnodiging = uitnodiging;
    delete stand.geweigerd;
    bewaarStand();
    url.searchParams.delete('familie');
    url.searchParams.delete('uitnodiging');
    history.replaceState(null, '', url.pathname + (url.search || ''));
    return true;
  },

  async zetAan() {
    if (SANDBOX) return null;
    if (stand.code) return stand.code;
    let staart = '';
    for (let i = 0; i < 6; i++) staart += TEKENS[Math.floor(Math.random() * TEKENS.length)];
    stand.code = WOORDEN[Math.floor(Math.random() * WOORDEN.length)] + '-' + staart;
    bewaarStand();
    await zorgSleutel();
    for (const wie of [...PLANETEN, 'wensen']) await this.stuur(wie, false, true);
    return stand.code;
  },

  // Alles wat bij één planeet hoort, uit de opslag van dit apparaat.
  pakket(wie) {
    if (wie === 'wensen') return { lijst: lees(OPSLAG.wensen, []) };
    const recept = lees(OPSLAG.recept, {})[wie] || null;
    if (!recept) return null;
    return { recept, wereld: lees(OPSLAG.wereld, {})[wie] || null, foto: lees(OPSLAG.foto, {})[wie] || null };
  },

  zetPakket(wie, data) {
    data = veilig(data);
    if (wie === 'wensen') return schrijf(OPSLAG.wensen, data?.lijst || []);
    for (const [deel, sleutel] of Object.entries({ recept: OPSLAG.recept, wereld: OPSLAG.wereld, foto: OPSLAG.foto })) {
      const alles = lees(sleutel, {});
      if (data && data[deel]) alles[wie] = data[deel];
      else delete alles[wie];
      schrijf(sleutel, alles);
    }
  },

  // Bij het startscherm: van elke planeet de laatste versie ophalen.
  async haalAlles() {
    if (!stand.code) return;
    await zorgSleutel();
    await Promise.all([...PLANETEN, 'wensen'].map((wie) => this.haal(wie)));
  },

  async haal(wie) {
    let doc;
    try {
      const r = await fetch(`${WOLK}?code=${stand.code}&wie=${wie}`, { headers: kop(), signal: wachtHooguit(20000) });
      if (sleutelAfgewezen(r)) await zorgSleutel();
      if (!r.ok) return;
      doc = await r.json();
    } catch {
      return; // geen internet: gewoon verder met wat er op het apparaat staat
    }
    const hier = this.pakket(wie);
    if (wie === 'wensen') return this.voegWensenSamen(doc, hier);
    const bekend = stand.versies[wie] || 0;
    const veranderdHier = hier && afdruk(hier) !== stand.afdrukken[wie];
    if (!doc) {
      if (hier) this.stuur(wie); // nog niet in de wolk: erheen sturen
      return;
    }
    // Ouder dan wat we al weten, of we sturen net zelf iets: niets terugzetten.
    if (doc.versie < bekend || bezig[wie]) return;
    if (doc.versie === bekend) {
      if (veranderdHier) this.stuur(wie);
      return;
    }
    // In de wolk staat een nieuwere versie.
    if (!hier || !veranderdHier) {
      this.zetPakket(wie, doc.data);
      stand.versies[wie] = doc.versie;
      stand.afdrukken[wie] = afdruk(this.pakket(wie));
      delete stand.botsingen[wie];
    } else {
      // Hier én daar veranderd: niet zelf kiezen.
      if (doc.data) doc.data = veilig(doc.data);
      stand.botsingen[wie] = doc;
    }
    bewaarStand();
  },

  // Wensen raken nooit kwijt: lijsten samenvoegen in plaats van kiezen.
  voegWensenSamen(doc, hier) {
    const lijst = [...(hier?.lijst || [])];
    for (const w of doc?.data?.lijst || []) if (!lijst.some((x) => x.wanneer === w.wanneer && x.wie === w.wie)) lijst.push(w);
    lijst.sort((a, b) => a.wanneer - b.wanneer);
    schrijf(OPSLAG.wensen, lijst);
    stand.versies.wensen = doc ? doc.versie : 0;
    bewaarStand();
    if (!doc || lijst.length > (doc.data?.lijst || []).length) this.stuur('wensen', true);
  },

  // Wijzigingen bundelen: de eerste zet een wekker, alles wat daarna komt gaat mee met die
  // ene keer versturen. Zo gaat er tijdens het spelen geregeld iets de deur uit, maar niet bij
  // elke penseelstreek apart.
  planStuur(wie, wacht = 8000) {
    if (!stand.code || stand.botsingen[wie] || timers[wie]) return;
    timers[wie] = setTimeout(() => {
      timers[wie] = null;
      this.stuur(wie);
    }, wacht);
  },

  // aanzetten = de eerste keer, vanuit "Wolk aanzetten": dan registreert de server de familie
  // (die mag toveren). Een verzonnen code via een gewone opslag mag dat niet.
  async stuur(wie, forceer = false, aanzetten = false) {
    if (!stand.code || bezig[wie]) return false;
    if (wie !== 'wensen' && !PLANETEN.includes(wie)) return false; // niet van deze speler
    if (stand.botsingen[wie] && !forceer) return false;
    const data = this.pakket(wie) || { recept: null };
    if (heeftGaten(data)) return false; // een plaatje is hier kwijt: liever niets sturen dan iets kapots
    const vingerafdruk = afdruk(this.pakket(wie));
    if (!forceer && vingerafdruk === stand.afdrukken[wie]) return true; // niets veranderd
    bezig[wie] = true;
    try {
      await zorgSleutel();
      const r = await fetch(`${WOLK}?code=${stand.code}&wie=${wie}${forceer ? '&forceer=1' : ''}${aanzetten ? '&aanzetten=1' : ''}`, {
        method: 'POST',
        signal: wachtHooguit(30000),
        headers: kop({ 'content-type': 'application/json' }),
        body: JSON.stringify({ versie: stand.versies[wie] || 0, data }),
      });
      if (r.status === 409) {
        // Iemand anders heeft ondertussen op deze planeet gespeeld: het kind kiest straks.
        const hunne = (await r.json()).hunne;
        if (hunne && hunne.data) hunne.data = veilig(hunne.data);
        stand.botsingen[wie] = hunne;
        bewaarStand();
        return false;
      }
      if (sleutelAfgewezen(r)) zorgSleutel();
      if (!r.ok) return false;
      const d = await r.json();
      stand.versies[wie] = d.versie;
      stand.afdrukken[wie] = vingerafdruk;
      delete stand.botsingen[wie];
      bewaarStand();
      return true;
    } catch {
      return false; // later opnieuw
    } finally {
      bezig[wie] = false;
    }
  },

  // Prullenbak in de wolk: elke planeet die werd weggegooid of overschreven, 30 dagen lang.
  async prullenbak() {
    if (!stand.code) return [];
    await zorgSleutel();
    const uit = [];
    await Promise.all(
      PLANETEN.map(async (wie) => {
        try {
          const r = await fetch(`${WOLK}?code=${stand.code}&wie=${wie}&prullenbak=lijst`, { headers: kop() });
          if (!r.ok) return;
          for (const tijd of await r.json())
            uit.push({
              wie,
              wanneer: Number(tijd),
              haal: async () => {
                const d = await fetch(`${WOLK}?code=${stand.code}&wie=${wie}&prullenbak=${tijd}`, { headers: kop() });
                return d.ok ? (await d.json())?.data || null : null;
              },
            });
        } catch {}
      })
    );
    return uit;
  },

  // Keuze bij twee versies: 'hier' houdt de planeet van dit apparaat, 'daar' die uit de wolk.
  async kies(wie, welke) {
    const doc = stand.botsingen[wie];
    if (!doc) return;
    if (welke === 'daar') {
      this.zetPakket(wie, doc.data);
      stand.versies[wie] = doc.versie;
      stand.afdrukken[wie] = afdruk(this.pakket(wie));
      delete stand.botsingen[wie];
      bewaarStand();
    } else {
      delete stand.botsingen[wie];
      stand.versies[wie] = doc.versie;
      bewaarStand();
      await this.stuur(wie, true);
    }
  },
};
