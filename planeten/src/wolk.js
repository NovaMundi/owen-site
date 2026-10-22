// De planeten gaan mee tussen huizen en apparaten. Zelfde opzet als Supervrienden:
//   1. De opslag op het apparaat blijft de bron. Geen internet? Gewoon doorspelen; het loopt
//      later vanzelf bij. Een kind ziet nooit een foutmelding omdat de wifi hapert.
//   2. Er wordt nooit stil iets overschreven. Is een planeet op twee apparaten veranderd, dan
//      kiest het kind welke het houdt.
//   3. Koppelen gebeurt één keer per apparaat, via een link met de familiecode erin.
//
// Per planeet (owen, jake, papa) gaat alles mee: het recept, de levende wereld en de foto voor
// het startscherm. De ingesproken wensen gaan als één lijst mee en worden samengevoegd.

// Op de site zelf (en bij lokaal testen met 'netlify dev' op poort 8888) relatief, elders naar jakevanpelt.com.
const WOLK = location.hostname.endsWith('jakevanpelt.com') || location.port === '8888' ? '/.netlify/functions/planeten' : 'https://jakevanpelt.com/.netlify/functions/planeten';
const STAND = 'planeetmakers-wolk-v1';
const OPSLAG = { recept: 'planeetmakers-v1', wereld: 'planeetmakers-leven-v1', foto: 'planeetmakers-fotos-v1', wensen: 'planeetmakers-wensen-v1' };
export const PLANETEN = ['owen', 'jake', 'papa'];

function lees(sleutel, standaard) {
  try {
    return JSON.parse(localStorage.getItem(sleutel)) ?? standaard;
  } catch {
    return standaard;
  }
}
function schrijf(sleutel, waarde) {
  try {
    localStorage.setItem(sleutel, JSON.stringify(waarde));
    return true;
  } catch {
    return false;
  }
}

// Vingerafdruk: is er sinds de laatste keer bijwerken iets veranderd?
function afdruk(obj) {
  const t = JSON.stringify(obj ?? null);
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
      .map((w) => ({
        ...w,
        naam: tekst(w.naam) || 'Wezen',
        echt: w.echt && BEELD.test(w.echt.plaatje || '') ? w.echt : null,
        geluid: w.geluid && GELUID.test(w.geluid) ? w.geluid : null,
      }));
  }
  return data;
}

const TEKENS = 'abcdefghjkmnpqrstuvwxyz23456789';
const WOORDEN = ['zorbix', 'blibo', 'lumi', 'kwasar', 'nebula', 'komeet', 'pluto', 'stardust', 'orbit', 'galaxo'];

let stand = lees(STAND, { code: null, versies: {}, afdrukken: {}, botsingen: {} });
const bewaarStand = () => schrijf(STAND, stand);
const timers = {};
let bezig = {};

export const wolk = {
  get code() {
    return stand.code;
  },
  get aan() {
    return !!stand.code;
  },
  botsing(wie) {
    return stand.botsingen[wie] || null;
  },
  linkVoor(site) {
    return `${site}/planeten/?familie=${stand.code}`;
  },

  // Een link als ?familie=zorbix-k3m7qp koppelt dit apparaat. Daarna haalt hij de code weg uit
  // het adres, zodat je hem niet per ongeluk deelt.
  koppelUitLink() {
    const url = new URL(location.href);
    const code = (url.searchParams.get('familie') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (code.length < 8) return false;
    if (code !== stand.code) stand = { code, versies: {}, afdrukken: {}, botsingen: {} };
    bewaarStand();
    url.searchParams.delete('familie');
    history.replaceState(null, '', url.pathname + (url.search || ''));
    return true;
  },

  async zetAan() {
    if (stand.code) return stand.code;
    let staart = '';
    for (let i = 0; i < 6; i++) staart += TEKENS[Math.floor(Math.random() * TEKENS.length)];
    stand.code = WOORDEN[Math.floor(Math.random() * WOORDEN.length)] + '-' + staart;
    bewaarStand();
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
    await Promise.all([...PLANETEN, 'wensen'].map((wie) => this.haal(wie)));
  },

  async haal(wie) {
    let doc;
    try {
      const r = await fetch(`${WOLK}?code=${stand.code}&wie=${wie}`);
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
    if (stand.botsingen[wie] && !forceer) return false;
    const data = this.pakket(wie) || { recept: null };
    const vingerafdruk = afdruk(this.pakket(wie));
    if (!forceer && vingerafdruk === stand.afdrukken[wie]) return true; // niets veranderd
    bezig[wie] = true;
    try {
      const r = await fetch(`${WOLK}?code=${stand.code}&wie=${wie}${forceer ? '&forceer=1' : ''}${aanzetten ? '&aanzetten=1' : ''}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ versie: stand.versies[wie] || 0, data }),
      });
      if (r.status === 409) {
        // Iemand anders heeft ondertussen op deze planeet gespeeld: het kind kiest straks.
        stand.botsingen[wie] = (await r.json()).hunne;
        bewaarStand();
        return false;
      }
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
