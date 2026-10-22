// De levensmotor: wezens groeien, trekken rond, ontdekken dingen, krijgen ruzie en sluiten vrede.
// Puur rekenwerk zonder 3D of scherm, zodat het ook op de achtergrond (werker) of later op een
// server kan draaien. Tijd in jaren; 1 echte minuut = 1 jaar.
//
// Een wereld bestaat uit soorten (de getekende wezens) en groepen (een soort in één gebied).
// Gebieden (regio's) komen uit regio.js en beschrijven wat de planeet daar te bieden heeft.

export const JAAR_PER_MINUUT = 1;

// Het eerste halfuur na het eerste wezen gaat de tijd 20 keer zo snel, zodat je in je eerste
// spelletje al holen en een eigen stam ziet. Daarna gewoon 1 minuut = 1 jaar.
// Een vaste rekensom van de klok: elk apparaat (en de werker) komt zo op hetzelfde jaar uit.
export const SNEL = { minuten: 30, keer: 20 };
export function jarenTussen(w, van, tot) {
  const min = Math.max(0, tot - van) / 60000;
  let extra = 0;
  if (w.snelVan) {
    const eind = w.snelVan + SNEL.minuten * 60000;
    const overlap = Math.max(0, Math.min(tot, eind) - Math.max(van, w.snelVan)) / 60000;
    extra = overlap * (SNEL.keer - 1);
  }
  return (min + extra) * JAAR_PER_MINUUT;
}
export function snelBezig(w, nu = Date.now()) {
  return !!(w && w.snelVan && nu < w.snelVan + SNEL.minuten * 60000);
}

// ---------- Ontdekkingen ----------
// kosten = totaal verzamelde kennis die nodig is. eis = wat de planeet moet bieden.
export const TECH = [
  { id: 'nesten', naam: 'Holen en nesten', icoon: '🕳️', kosten: 40, na: [] },
  { id: 'stokken', naam: 'Gereedschap', icoon: '🪵', kosten: 2000, na: ['nesten'] },
  { id: 'taal', naam: 'Praten', icoon: '🗣️', kosten: 40000, na: ['stokken'] },
  { id: 'vuur', naam: 'Vuur', icoon: '🔥', kosten: 60000, na: ['taal'], eis: 'vuur' },
  { id: 'vissen', naam: 'Vissen', icoon: '🎣', kosten: 25000, na: ['stokken'], eis: 'kust' },
  { id: 'hutten', naam: 'Hutten', icoon: '🛖', kosten: 95000, na: ['vuur', 'taal'] },
  { id: 'landbouw', naam: 'Akkers', icoon: '🌾', kosten: 170000, na: ['hutten'], eis: 'vruchtbaar' },
  { id: 'boten', naam: 'Boten', icoon: '⛵', kosten: 240000, na: ['hutten'], eis: 'boot' },
  { id: 'wiel', naam: 'Het wiel', icoon: '🛞', kosten: 300000, na: ['hutten'] },
  { id: 'metaal', naam: 'Metaal', icoon: '⚒️', kosten: 450000, na: ['vuur', 'wiel'], eis: 'metaal' },
  { id: 'schrift', naam: 'Schrijven', icoon: '📜', kosten: 650000, na: ['wiel'] },
  { id: 'kristal', naam: 'Kristalkracht', icoon: '💎', kosten: 850000, na: ['schrift'], eis: 'magie' },
  { id: 'sterren', naam: 'Sterrenkijken', icoon: '🔭', kosten: 950000, na: ['schrift'] },
  // Een lijst binnen de lijst = één van beide is genoeg (zo kan een magische planeet zonder metaal
  // of stroom toch verder met kristalkracht).
  { id: 'machines', naam: 'Machines', icoon: '⚙️', kosten: 1500000, na: [['metaal', 'kristal'], 'schrift'] },
  { id: 'stroom', naam: 'Elektriciteit', icoon: '💡', kosten: 2400000, na: ['machines'] },
  { id: 'raket', naam: 'Raketten', icoon: '🚀', kosten: 4200000, na: [['stroom', 'kristal'], 'sterren', 'machines'] },
  { id: 'schoon', naam: 'Schone energie', icoon: '🌱', kosten: 3400000, na: ['stroom'] },
];
export const TECH_BY = Object.fromEntries(TECH.map((t) => [t.id, t]));

function naOk(t, soort) {
  // Een volk dat bij de lava woont, kent het vuur al voordat het kan praten.
  const na = t.id === 'vuur' && soort.thuisLand === 'lava' ? ['stokken'] : t.na;
  return na.every((x) => (Array.isArray(x) ? x.some((y) => soort.tech.includes(y)) : soort.tech.includes(x)));
}

// Niet elke soort volgt het pad van de mens: zeewezens en vliegers vinden hun eigen weg.
const EIGEN = {
  zee: { vuur: ['Hete bronnen', '♨️'], hutten: ['Koraalhuizen', '🪸'], wiel: ['Stromingsrijden', '🌊'], metaal: ['Schelpsmeden', '🐚'], machines: ['Bellenmachines', '🫧'], raket: ['Bellenraket', '🚀'], landbouw: ['Zeewiertuinen', '🌿'], vissen: ['Samen jagen', '🐟'] },
  lucht: { wiel: ['Windzeilen', '🪁'], hutten: ['Rotsnesten', '🪺'], boten: ['Lange vluchten', '🦅'] },
};
// Zeewezens horen bij de zee, ook als ze pootjes krijgen; pas een afgesplitste landsoort is een landdier.
export function rijk(soort) {
  return soort.beweging === 'zwemmen' ? 'zee' : 'land';
}
// En de ondergrond waar een volk begon, bepaalt hoe ze bouwen.
const LANDEIGEN = {
  ijs: { hutten: ["Iglo's", '🧊'] },
  woestijn: { hutten: ['Leemhuizen', '🧱'] },
  berg: { hutten: ['Rotswoningen', '🪨'] },
  lava: { hutten: ['Stenen huizen', '🪨'] },
};
export function techNaam(id, soort) {
  const t = TECH_BY[id];
  const soortRijk = rijk(soort) === 'zee' ? 'zee' : soort.beweging === 'vliegen' ? 'lucht' : null;
  const eigen = (soortRijk && EIGEN[soortRijk][id]) || (rijk(soort) === 'land' && LANDEIGEN[soort.thuisLand]?.[id]);
  if (id === 'vuur' && soort.vlaggen && soort.vlaggen.gloed) return { naam: 'Kristalgloed', icoon: '✨' };
  return eigen ? { naam: eigen[0], icoon: eigen[1] } : { naam: t.naam, icoon: t.icoon };
}

// De baas van een rijk: de eerste soort die akkers kreeg (en nog leeft). Daarvoor is niemand de baas.
function heerser(w, gebied) {
  let beste = null;
  for (const s of Object.values(w.soorten)) {
    if (s.uitgestorven !== null || !s.tech.includes('landbouw') || rijk(s) !== gebied || s.vlaggen.gevallen) continue;
    if (!beste || (s.vlaggen.heerserSinds ?? Infinity) < (beste.vlaggen.heerserSinds ?? Infinity)) beste = s;
  }
  return beste;
}

export const TIJDPERKEN = [
  { id: 'oertijd', naam: 'Oertijd', icoon: '🥚', als: [] },
  { id: 'holentijd', naam: 'Holentijd', icoon: '🕳️', als: ['nesten'] },
  { id: 'steentijd', naam: 'Steentijd', icoon: '🪨', als: ['stokken'] },
  { id: 'vuurtijd', naam: 'Vuurtijd', icoon: '🔥', als: ['vuur'] },
  { id: 'dorpentijd', naam: 'Dorpentijd', icoon: '🛖', als: ['hutten'] },
  { id: 'metaaltijd', naam: 'Metaaltijd', icoon: '⚒️', als: ['metaal'] },
  { id: 'stedentijd', naam: 'Stedentijd', icoon: '🏰', als: ['schrift'] },
  { id: 'machinetijd', naam: 'Machinetijd', icoon: '⚙️', als: ['machines'] },
  { id: 'ruimtetijd', naam: 'Ruimtetijd', icoon: '🚀', als: ['raket'] },
];

export function tijdperk(soort) {
  let t = TIJDPERKEN[0];
  for (const p of TIJDPERKEN) if (p.als.every((x) => soort.tech.includes(x))) t = p;
  return t;
}

// Hoe ver is een groep: 0 niets, 1 nesten, 2 kampvuur, 3 hutten, 4 dorp, 5 stad, 6 grote stad.
export function niveau(soort, g) {
  const h = (x) => soort.tech.includes(x);
  const p = g.pop;
  if (h('stroom') && p > 6000) return 6;
  if (h('schrift') && p > 1200) return 5;
  if (h('landbouw') && p > 150) return 4;
  if (h('hutten') && p > 25) return 3;
  if (h('vuur') && p > 8) return 2;
  if (h('nesten') && p > 3) return 1;
  return 0;
}

// ---------- Toeval met geheugen (zelfde wereld = zelfde verloop) ----------
function rnd(w) {
  w.rng = (w.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(w.rng ^ (w.rng >>> 15), 1 | w.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const kies = (w, lijst) => lijst[Math.floor(rnd(w) * lijst.length)];
const klem = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// ---------- Namen ----------
export function meervoud(naam) {
  const n = naam.trim();
  if (/[aiouy]$/i.test(n)) return n + "'s";
  if (/e$/i.test(n)) return n + 's';
  return n + 'en';
}
const LANDSCHAP = { kust: 'Kust', berg: 'Berg', ijs: 'IJs', bos: 'Bos', woestijn: 'Zand', lava: 'Vuur', zee: 'Zee', vlakte: 'Wei', magie: 'Glim', eiland: 'Eiland' };

// ---------- Wereld en soorten ----------
export function nieuweWereld(zaad, nu) {
  let s = 0;
  for (const c of String(zaad)) s = (Math.imul(s, 31) + c.charCodeAt(0)) | 0;
  return { versie: 1, jaar: 0, laatst: nu, rng: s, soorten: {}, groepen: [], spanning: {}, kroniek: [], gezien: 0, klimaat: nieuwKlimaat() };
}

// ---------- Klimaat ----------
// De keuzes van het kind (wolken, stormachtig, ijskappen) zijn het gemiddelde. Daaromheen gebeurt
// van alles: droogtes, natte tijden, ijstijden, warme tijden, vulkanen, en de fabrieken van de
// wezens zelf maken de planeet warmer.
export const FASEN = {
  gewoon: { naam: 'Rustig klimaat', icoon: '🌤️' },
  droogte: { naam: 'Droogte', icoon: '🏜️' },
  nat: { naam: 'Natte tijd', icoon: '🌧️' },
  ijstijd: { naam: 'IJstijd', icoon: '🧊' },
  warm: { naam: 'Warme tijd', icoon: '🌡️' },
};

function nieuwKlimaat() {
  // Huidige waarden schuiven langzaam naar het doel van de fase.
  return { fase: 'gewoon', tot: 0, temp: 0, nat: 1, ijs: 0, as: 0, vervuiling: 0, vlaggen: {} };
}

const DOEL = {
  gewoon: { temp: 0, nat: 1, ijs: 0 },
  droogte: { temp: 0.05, nat: 0.35, ijs: 0 },
  nat: { temp: 0, nat: 1.6, ijs: 0 },
  ijstijd: { temp: -0.2, nat: 0.8, ijs: 0.35 },
  warm: { temp: 0.12, nat: 1.1, ijs: -0.15 },
};

// Hoe stormachtig is het nu? 0 = nooit onweer, 1 = heel vaak.
export function stormKans(w) {
  const k = w.klimaat || nieuwKlimaat();
  const p = w.planeet || {};
  const basis = (p.wolken ?? 0.5) * (p.onweer ? 1.8 : 0.6);
  return klem(basis * k.nat * (1 + Math.max(0, k.temp) * 3 + k.vervuiling * 0.8), 0, 1.5);
}

function klimaatStap(w, regios, dt, nu) {
  const k = (w.klimaat ||= nieuwKlimaat());
  const p = w.planeet || { wolken: 0.5, onweer: false, ijskappen: 0 };
  const ietsLevend = Object.values(w.soorten).some((s) => s.uitgestorven === null);
  const zeg = (icoon, tekst, belang = 2) => ietsLevend && verhaal(w, null, belang, icoon, tekst, nu);

  // Een fase is voorbij: terug naar gewoon.
  if (k.fase !== 'gewoon' && w.jaar >= k.tot) {
    const oud = k.fase;
    k.fase = 'gewoon';
    if (oud === 'ijstijd') zeg('☀️', 'De ijstijd is voorbij. Het ijs smelt langzaam en het wordt weer warmer.', 3);
    if (oud === 'droogte') zeg('🌧️', 'Eindelijk regent het weer! De droogte is voorbij.');
    if (oud === 'nat') zeg('🌤️', 'De natte tijd is voorbij.', 1);
    if (oud === 'warm') zeg('🌤️', 'Het wordt weer wat koeler.', 1);
  }
  // Kans op een nieuwe fase (per jaar). Een droge planeet krijgt eerder droogte, enzovoort.
  if (k.fase === 'gewoon') {
    const r = rnd(w) / dt;
    const kans = {
      droogte: (1 / 5000) * (1.4 - (p.wolken ?? 0.5)),
      nat: (1 / 6000) * (0.4 + (p.wolken ?? 0.5)),
      ijstijd: (1 / 30000) * (1 + (p.ijskappen || 0) * 2),
      warm: 1 / 26000,
    };
    let opgeteld = 0;
    for (const [fase, c] of Object.entries(kans)) {
      opgeteld += c;
      if (r < opgeteld) {
        k.fase = fase;
        const duur = { droogte: [60, 500], nat: [80, 600], ijstijd: [2500, 9000], warm: [800, 3000] }[fase];
        k.tot = w.jaar + duur[0] + rnd(w) * (duur[1] - duur[0]);
        if (fase === 'droogte') zeg('🏜️', 'Het regent al heel lang niet meer. Een grote droogte is begonnen.', 3);
        if (fase === 'nat') zeg('🌧️', 'Het regent en het regent. Een natte tijd is begonnen.');
        if (fase === 'ijstijd') zeg('🧊', 'Het wordt kouder en kouder... Een ijstijd is begonnen! Het ijs groeit.', 3);
        if (fase === 'warm') zeg('🌡️', 'Het wordt warmer op de planeet.');
        break;
      }
    }
  }
  // Langzaam naar het doel schuiven (ijs groeit traag, regen verandert sneller).
  const doel = DOEL[k.fase];
  const traag = 1 - Math.exp(-dt / 600), snel = 1 - Math.exp(-dt / 40);
  k.temp += (doel.temp + k.vervuiling * 0.25 - k.as - k.temp) * traag;
  k.nat += (doel.nat - k.nat) * snel;
  k.ijs += (doel.ijs - k.ijs) * traag;
  k.as = Math.max(0, k.as * Math.exp(-dt / 8));

  // Vulkanen: alleen waar vulkanische grond of lava is.
  const vulkaan = regios.filter((r) => r.vuur > 0.3);
  if (vulkaan.length && rnd(w) < dt * (1 / 3500) * Math.min(1, vulkaan.length / 20)) {
    const r = kies(w, vulkaan);
    k.as = Math.min(0.15, k.as + 0.1); // as in de lucht: even kouder
    for (const g of w.groepen) {
      if (g.regio !== r.id && !r.buren.includes(g.regio)) continue;
      const voor = g.pop;
      g.pop *= g.regio === r.id ? 0.5 : 0.85;
      verlies(w.soorten[g.soort], 'ramp', voor - g.pop);
    }
    zeg('🌋', 'Een vulkaan barstte uit! De as maakte de lucht een tijdje donker en koud.', 3);
    r.vulkaanJaar = w.jaar; // vers vuur: makkelijker te ontdekken
  }
  // Heel zelden een meteoriet.
  if (rnd(w) < dt / 90000) {
    const r = kies(w, regios);
    for (const g of w.groepen) {
      if (g.regio !== r.id && !r.buren.includes(g.regio)) continue;
      verlies(w.soorten[g.soort], 'ramp', g.pop * 0.8);
      g.pop *= 0.2;
    }
    k.as = Math.min(0.2, k.as + 0.12);
    zeg('☄️', 'Een enorme meteoriet sloeg in op de planeet! Het werd heel lang stoffig en koud.', 3);
  }
  // Fabrieken maken de lucht warmer; schone energie maakt het weer goed.
  const fabrieken = Object.values(w.soorten).reduce((s, x) => {
    if (x.uitgestorven !== null || x.tech.includes('schoon')) return s;
    const t = totaalVan(w, x.id);
    return s + ((x.tech.includes('machines') ? 1 : 0) + (x.tech.includes('stroom') ? 1.5 : 0)) * Math.log10(1 + t);
  }, 0);
  const schoon = Object.values(w.soorten).some((x) => x.tech.includes('schoon'));
  k.vervuiling = klem(k.vervuiling + dt * (fabrieken * 0.000004 - (schoon ? 0.0004 : 0.00002) * k.vervuiling), 0, 1);
  if (k.vervuiling > 0.15 && !k.vlaggen.warmer) {
    k.vlaggen.warmer = 1;
    zeg('🏭', 'De fabrieken en machines blazen een onzichtbaar gas de lucht in. Dat houdt de warmte van de zon vast, dus de planeet wordt warmer en er komen meer stormen.', 3);
  }
  if (k.vervuiling > 0.4 && !k.vlaggen.heet) {
    k.vlaggen.heet = 1;
    zeg('🥵', 'Er zit nu zoveel van dat warmte-gas in de lucht dat het steeds warmer wordt. De ijskappen smelten!', 3);
  }
  if (schoon && k.vlaggen.warmer && k.vervuiling < 0.08 && !k.vlaggen.hersteld) {
    k.vlaggen.hersteld = 1;
    zeg('🌱', 'Dankzij schone energie is de lucht weer schoon geworden.', 3);
  }
}

// Wat een gebied nu werkelijk biedt, met het klimaat erbij.
function nuIn(r, w) {
  const k = w.klimaat;
  if (!k) return r;
  const p = w.planeet || {};
  let temp = r.temp + k.temp;
  let plant = r.plant, water = r.water;
  // In een ijstijd schuift het ijs van de polen naar de evenaar.
  const ijsGrens = 1 - Math.max(0, (p.ijskappen || 0) * 0.6 + k.ijs);
  const lat = Math.abs(r.dir[1]);
  if (r.land && r.grond !== 'ijs' && lat > ijsGrens) {
    temp -= 0.3;
    plant *= 0.15;
  }
  if (r.land && !r.kust) water = klem(r.water * (0.35 + 0.65 * k.nat));
  else if (r.land) water = klem(Math.max(r.water * 0.85, r.water * k.nat));
  plant *= klem(0.45 + 0.55 * Math.min(1.25, k.nat), 0, 1.3);
  if (temp > 0.95) plant *= 0.6;
  return { ...r, temp: klem(temp), plant, water };
}

const JACHT = 0.002; // per jaar, maal (1 + hoe groot het dorp of de stad van de jagers is)

const BASIS = {
  maat: { mier: { groei: 0.22, cap: 4, kracht: 0.3 }, hond: { groei: 0.1, cap: 1, kracht: 1 }, olifant: { groei: 0.05, cap: 0.4, kracht: 2.2 }, reus: { groei: 0.025, cap: 0.15, kracht: 4 } },
};

// Kleur van de tekening geeft een beetje karakter mee.
function karakterUitKleur(kleur) {
  const g = { agressie: 0.3, samen: 0.4, slim: 1, plant: 1, magie: 0 };
  if (!kleur) return g;
  const { h, s } = kleur;
  if (s < 0.15) return g;
  if (h < 0.07 || h > 0.93) g.agressie += 0.2; // rood: fel
  else if (h < 0.17) g.slim += 0.15; // oranje/geel: slim en nieuwsgierig
  else if (h < 0.45) g.plant += 0.25; // groen: goed met planten
  else if (h < 0.7) g.samen += 0.2; // blauw: rustig, werkt graag samen
  else g.magie += 0.3; // paars/roze: houdt van magie
  return g;
}

// Aanleg om slim te worden: niet elk dier wordt een denker. Formaat, manier van bewegen,
// karakter en een beetje toeval bepalen hoe snel hersenen kunnen groeien.
export const SLIM_DREMPEL = 1.35; // daarboven kunnen ze leren praten
// Ongeveer de helft van de soorten haalt de drempel nooit (aanleg onder ±0,95).
const slimPlafond = (g) => 0.9 + (g.aanleg ?? 1) * 0.48;
function aanlegVoor(w, maat, beweging, k) {
  const m = { mier: 0.55, hond: 1.1, olifant: 1.2, reus: 0.9 }[maat] ?? 1;
  const b = { lopen: 1.1, huppen: 1, zwemmen: 0.9, vliegen: 0.8, zweven: 0.7 }[beweging] ?? 1;
  return m * b * (0.6 + rnd(w) * 0.8) * (1 + (k.slim - 1) + k.samen * 0.3);
}

export function voegSoortToe(w, wezen, regios, nu) {
  const k = karakterUitKleur(wezen.kleur);
  const soort = {
    id: wezen.id,
    naam: wezen.naam,
    beweging: wezen.beweging,
    maat: wezen.maat,
    kleur: wezen.kleur || null,
    genen: { grootte: 1, kou: 0, hitte: 0, land: wezen.beweging === 'zwemmen' ? 0 : 1, zwem: wezen.beweging === 'zwemmen' ? 1 : 0, ...k, aanleg: aanlegVoor(w, wezen.maat, wezen.beweging, k) },
    kennis: 0,
    tech: [],
    sinds: w.jaar,
    piek: wezen.aantal,
    uitgestorven: null,
    vlaggen: {},
  };
  w.soorten[soort.id] = soort;
  // Landen op een plek die bij ze past (met het klimaat van nu: niet midden in het ijs).
  regios = regios.map((r) => nuIn(r, w));
  const goed = regios.filter((r) => woont(soort, r) > 0);
  const lijst = goed.length ? goed : regios;
  let beste = null, score = -1;
  for (let i = 0; i < 12; i++) {
    const r = kies(w, lijst);
    const c = capaciteitVan(soort, r, w);
    if (c > score) {
      score = c;
      beste = r;
    }
  }
  const stam = meervoud(soort.naam);
  soort.thuisLand = beste.soort;
  w.groepen.push({ soort: soort.id, regio: beste.id, pop: wezen.aantal, stam, oorlog: null, sinds: w.jaar });
  verhaal(w, soort, 3, '🛸', `Een ruimteschip zette ${wezen.aantal === 1 ? 'één' : wezen.aantal} ${wezen.aantal === 1 ? soort.naam : meervoud(soort.naam)} neer${plekTekst(beste)}.`, nu);
  if (wezen.aantal === 1) verhaal(w, soort, 2, '💭', `${soort.naam} is helemaal alleen. Alleen kun je geen familie krijgen...`, nu);
  if (!goed.length) verhaal(w, soort, 2, '😟', `${meervoud(soort.naam)} kijken om zich heen. Dit is geen fijne plek voor ze.`, nu);
  return soort;
}

// Een wezen dat het kind weghaalt, vertrekt met een ruimteschip. Het hele verhaal (aantal, waar ze
// woonden, wat ze kenden) blijft bewaard, zodat de oeps-knop het echt terugbrengt.
export function vertrekSoort(w, id) {
  const s = w.soorten[id];
  if (!s) return;
  w.vertrokken ||= {};
  w.vertrokken[id] = { soort: s, groepen: w.groepen.filter((g) => g.soort === id), jaar: w.jaar };
  const ids = Object.keys(w.vertrokken);
  if (ids.length > 8) delete w.vertrokken[ids[0]];
  if (s.uitgestorven === null) verhaal(w, s, 2, '🛸', `De ${meervoud(s.naam)} stapten in een ruimteschip en vlogen weg.`, Date.now());
  verwijderSoort(w, id);
}
export function terugSoort(w, id) {
  const v = w.vertrokken && w.vertrokken[id];
  if (!v) return false;
  delete w.vertrokken[id];
  w.soorten[id] = v.soort;
  w.groepen.push(...v.groepen);
  if (v.soort.uitgestorven === null) verhaal(w, v.soort, 2, '🛸', `Het ruimteschip kwam terug! De ${meervoud(v.soort.naam)} zijn er weer.`, Date.now());
  return true;
}

export function verwijderSoort(w, id) {
  delete w.soorten[id];
  w.groepen = w.groepen.filter((g) => g.soort !== id);
  for (const k of Object.keys(w.spanning)) if (k.includes(id)) delete w.spanning[k];
}

function plekTekst(r) {
  return { kust: ' aan de kust', berg: ' in de bergen', ijs: ' in het ijs', bos: ' in het bos', woestijn: ' in de woestijn', lava: ' bij de lava', zee: ' in de zee', vlakte: ' op een grote vlakte', magie: ' bij de glimmende kristallen' }[r.soort] || '';
}

export function meld(w, belang, icoon, tekst, nu = Date.now()) {
  verhaal(w, null, belang, icoon, tekst, nu);
}

function verhaal(w, soort, belang, icoon, tekst, nu) {
  // nr telt altijd door, ook als oude berichten weggaan: zo weet het scherm wat nieuw is.
  w.nr = (w.nr || w.kroniek.length) + 1;
  w.kroniek.push({ jaar: Math.floor(w.jaar), icoon, tekst, soort: soort ? soort.id : null, belang, t: nu, nr: w.nr });
  // Vol? Dan eerst het oudste minst belangrijke bericht weg, zodat grote gebeurtenissen
  // (een nieuwe soort, de eerste raket) bewaard blijven.
  if (w.kroniek.length > 400) {
    const laagste = Math.min(...w.kroniek.map((e) => e.belang));
    w.kroniek.splice(w.kroniek.findIndex((e) => e.belang === laagste), 1);
  }
}

// ---------- Wat kan een soort in een gebied? ----------
// 0 = kan hier niet wonen, 1 = prima.
function woont(soort, r) {
  const g = soort.genen;
  if (soort.beweging === 'zwemmen') {
    if (!r.land) return r.zeeLeefbaar;
    return g.land >= 0.5 && r.kust ? 0.7 : 0;
  }
  if (!r.land) return 0;
  return 1;
}

function capaciteitVan(soort, r, w) {
  const leef = woont(soort, r);
  if (!leef) return 0;
  const g = soort.genen, h = (x) => soort.tech.includes(x);
  const b = BASIS.maat[soort.maat] || BASIS.maat.hond;
  let eten;
  if (r.land) {
    eten = r.plant * g.plant * (1 + (h('stokken') ? 0.3 : 0) + (h('vuur') ? 0.4 : 0)) * (h('landbouw') ? 1 + 2 * r.vruchtbaar : 1);
    if (r.kust) eten += r.zeevoedsel * (h('vissen') ? 1 : 0.25);
    if (soort.beweging === 'zwemmen') eten = r.zeevoedsel + r.plant * 0.3;
  } else eten = r.zeevoedsel * (h('vissen') ? 1.4 : 1) * (h('stokken') ? 1.2 : 1);
  const water = soort.beweging === 'zwemmen' && !r.land ? 1 : klem(r.water * 1.4 + (h('wiel') ? 0.2 : 0));
  const klimaat = klimaatFit(soort, r);
  let onderdak = 1 + (h('nesten') ? 0.2 : 0) + (h('hutten') ? 0.6 : 0);
  if (h('schrift')) onderdak *= 2;
  if (h('machines')) onderdak *= 3;
  if (h('stroom')) onderdak *= 2;
  if (h('kristal')) onderdak *= 1 + r.magie;
  if (soort.vlaggen?.heuvels) onderdak *= 1.5; // veilig en koel in de heuvels
  const reus = 1 / Math.pow(g.grootte, 0.8);
  const oppervlak = w.planeet ? w.planeet.grootte ** 2 : 1; // grotere planeet = meer ruimte
  // Seizoenen: verder van de evenaar zijn de winters strenger. Holen, hutten en akkers (voorraad)
  // helpen de winter door. In de zee merk je er weinig van.
  const seiz = (w.planeet?.seizoenen || 0) * (0.3 + Math.abs(r.dir[1])) * (r.land ? 1 : 0.3);
  const voorraad = h('landbouw') ? 0.25 : h('hutten') ? 0.45 : h('nesten') ? 0.75 : 1;
  const winter = 1 - Math.min(0.6, seiz * 0.55 * voorraad);
  return 80 * b.cap * reus * eten * water * klimaat * onderdak * leef * oppervlak * winter;
}

// Hoeveel één wezen eet (groot eet meer). Om concurrentie tussen klein en groot eerlijk te tellen.
function verbruik(s) {
  const b = BASIS.maat[s.maat] || BASIS.maat.hond;
  return Math.pow(s.genen.grootte, 0.8) / b.cap;
}

// Waarom een groep krimpt: wat ontbreekt er het meest? Dat wordt het "omdat" in het verhaal.
function tekortIn(soort, r, drukDoor) {
  const g = soort.genen;
  if (drukDoor > 0.5) return 'concurrentie';
  const water = soort.beweging === 'zwemmen' && !r.land ? 1 : klem(r.water * 1.4);
  const fit = klimaatFit(soort, r);
  const lief = 0.55 - g.kou * 0.45 + g.hitte * 0.4;
  const eten = klem((r.land ? r.plant * g.plant + (r.kust ? r.zeevoedsel * 0.5 : 0) : r.zeevoedsel) / 0.8);
  const laagste = Math.min(water, fit, eten);
  if (laagste === water && water < 0.6) return 'dorst';
  if (laagste === fit && fit < 0.6) return r.temp < lief ? 'kou' : 'hitte';
  return 'honger';
}
function verlies(soort, oorzaak, aantal) {
  if (!soort || !(aantal > 0)) return;
  soort.verlies ||= {};
  soort.verlies[oorzaak] = (soort.verlies[oorzaak] || 0) + aantal;
}
export const OMDAT = {
  honger: 'er niet genoeg eten was',
  dorst: 'er te weinig water was',
  kou: 'het te koud werd',
  hitte: 'het te heet werd',
  concurrentie: 'andere dieren het eten opaten',
  jacht: 'er te veel op ze gejaagd werd',
  oorlog: 'ze te veel moesten vechten',
  ziekte: 'een ziekte ze te pakken kreeg',
  ramp: 'een ramp hun plek verwoestte',
};
export function grootsteOorzaak(soort) {
  const v = soort.verlies || {};
  let beste = null;
  for (const [k, n] of Object.entries(v)) if (!beste || n > v[beste]) beste = k;
  return beste;
}

// Warmte: elke soort heeft een lievelingstemperatuur die met de genen meeschuift.
function klimaatFit(soort, r) {
  const g = soort.genen, h = (x) => soort.tech.includes(x);
  const lief = 0.55 - g.kou * 0.45 + g.hitte * 0.4;
  const warm = r.temp + (h('vuur') ? 0.12 : 0) + (h('hutten') ? 0.08 : 0);
  return klem(1 - Math.abs(warm - lief) * 1.6, 0.03, 1);
}

// Komt deze soort zelf over zee? (Vliegen, zwemmen of met boten wel; lopen, huppen, zweven niet.)
function overZeeNee(s) {
  return s.beweging !== 'vliegen' && s.beweging !== 'zwemmen' && !s.tech.includes('boten');
}

function vlot(w, soort, g, r, regios, nu) {
  const cosMax = Math.cos(0.6); // niet te ver: de stroming brengt ze naar een eiland in de buurt
  let doel = null, beste = cosMax;
  for (const n of regios) {
    if (!n.land || !n.kust || n.eiland == null || n.eiland === r.eiland || !woont(soort, n)) continue;
    const dot = n.dir[0] * r.dir[0] + n.dir[1] * r.dir[1] + n.dir[2] * r.dir[2];
    if (dot > beste) (beste = dot), (doel = n);
  }
  if (!doel) return;
  // Woont de soort daar al, dan verandert er niets.
  if (w.groepen.some((x) => x.soort === soort.id && regios[x.regio]?.eiland === doel.eiland)) return;
  const mee = Math.min(6, g.pop * 0.1);
  g.pop -= mee;
  w.groepen.push({ soort: soort.id, regio: doel.id, pop: mee, stam: meervoud(soort.naam), oorlog: null, sinds: w.jaar });
  if (!soort.vlaggen['vlot_' + doel.eiland]) {
    soort.vlaggen['vlot_' + doel.eiland] = 1;
    verhaal(w, soort, 2, '🪵', `Een paar ${meervoud(soort.naam)} dreven op een boomstam over de zee. Ze spoelden aan op een ander eiland!`, nu);
  }
}

function bereikbaar(soort, van, naar) {
  if (soort.beweging === 'vliegen') return naar.land || false;
  const kan = woont(soort, naar) > 0;
  if (!kan) return false;
  if (soort.beweging === 'zwemmen') return true;
  // Over water alleen met boten.
  if (!van.land || !naar.land) return soort.tech.includes('boten');
  return true;
}

// ---------- Eén stap in de tijd ----------
export function stap(w, basisRegios, dt, nu) {
  w.jaar += dt;
  klimaatStap(w, basisRegios, dt, nu);
  // Wat elk gebied nu biedt, met droogte, ijstijd of warmte erbij.
  const regios = basisRegios.map((r) => nuIn(r, w));
  // Hoeveel wezens een gebied kan voeden, per soort; één keer per stap uitrekenen.
  const capCache = new Map();
  const capaciteit = (s, r) => {
    const k = s.id + '|' + r.id;
    let c = capCache.get(k);
    if (c === undefined) capCache.set(k, (c = capaciteitVan(s, r, w)));
    return c;
  };
  const perRegio = new Map();
  for (const g of w.groepen) {
    if (!perRegio.has(g.regio)) perRegio.set(g.regio, []);
    perRegio.get(g.regio).push(g);
  }

  for (const soort of Object.values(w.soorten)) {
    if (soort.uitgestorven !== null) continue;
    const groepen = w.groepen.filter((g) => g.soort === soort.id);
    const b = BASIS.maat[soort.maat] || BASIS.maat.hond;
    const totaal = groepen.reduce((s, g) => s + g.pop, 0);
    let gezond = 0, rijkSom = 0, kouDruk = 0, hitteDruk = 0, honger = 0, bezet = 0;
    const isHeerser = soort.tech.includes('taal'); // slimme soorten bouwen, jagen en kappen bos
    const baas = heerser(w, rijk(soort));
    const isBaas = baas === soort;
    // Waar de baas woont (en in de gebieden ernaast) is weinig ruimte om zelf verder te komen.
    // Een groep die ver weg apart leeft, gaat zijn eigen gang, zoals de dieren van Australië.
    let baasGebied = null;
    if (baas && !isBaas) {
      baasGebied = new Set();
      for (const x of w.groepen) {
        if (x.soort !== baas.id || x.pop < 5 || !regios[x.regio]) continue;
        baasGebied.add(x.regio);
        for (const b of regios[x.regio].buren) baasGebied.add(b);
      }
    }
    let onderBaas = 0;
    soort.verlies ||= {};
    for (const k of Object.keys(soort.verlies)) soort.verlies[k] *= Math.exp(-dt / 2000); // oude oorzaken vervagen
    // Een getekend wezen heeft altijd één schuilplek: het gebied waar het het best past. Daar telt
    // de concurrentie maar half. Zo kan een wezen van het kind wel heel klein worden, maar sterft
    // het zelden uit.
    let schuil = null;
    if (!soort.afkomst) {
      let best = -1;
      for (const g of groepen) {
        const r = regios[g.regio];
        const k = r ? capaciteit(soort, r) : 0;
        if (k > best) (best = k), (schuil = g);
      }
    }

    for (const g of groepen) {
      const r = regios[g.regio];
      if (!r) {
        g.pop = 0;
        continue;
      }
      // Eten delen met andere soorten in hetzelfde gebied (Lotka-Volterra). Andere dieren eten
      // deels ander eten (overlap), en een groot dier eet meer dan een klein dier. Wie beter bij
      // het gebied past, kan er meer wezens voeden en drukt de ander er langzaam uit.
      const buren = perRegio.get(g.regio) || [];
      const overlap = (s2) => {
        if (s2.beweging !== soort.beweging && (s2.beweging === 'zwemmen' || soort.beweging === 'zwemmen')) return 0.1;
        return s2.maat === soort.maat ? 0.5 : 0.3;
      };
      const eigenVerbruik = verbruik(soort);
      let gebruikt = 0;
      for (const x of buren) {
        const s2 = w.soorten[x.soort];
        if (x === g || !s2) continue;
        gebruikt += overlap(s2) * x.pop * (verbruik(s2) / eigenVerbruik);
      }
      if (g === schuil) gebruikt *= 0.5;
      const K = capaciteit(soort, r);
      let cap = Math.max(K * 0.01, K - gebruikt);
      const drukDoor = K > 0 ? Math.min(1, gebruikt / K) : 0; // hoeveel anderen hier wegeten
      if (g.oorlog) cap *= 0.8;
      // Een groep die lang apart leeft, past zich langzaam aan zijn plek aan (wie past, blijft over).
      if (g.apart) cap *= 1 + 0.5 * Math.min(1, g.apart / APART_NA);
      // Een oerwoud zit vol wilde dieren, maar is lastig voor de heerser zolang die geen metaal heeft.
      if (r.oerwoud) cap *= isHeerser ? (soort.tech.includes('metaal') ? 0.9 : 0.45) : 1.3;
      // Waar de heerser dorpen en steden bouwt, is minder ruimte voor wilde dieren, en er wordt gejaagd.
      if (!isHeerser) {
        for (const x of buren) {
          const s2 = w.soorten[x.soort];
          if (!s2 || x === g || !s2.tech.includes('taal')) continue;
          // Huisdieren worden niet opgejaagd; bij hun volk hebben ze juist een stal en eten.
          if (soort.vlaggen.getemdDoor === s2.id) {
            cap *= 1.25;
            continue;
          }
          const nv = niveau(s2, x);
          if (nv >= 4) cap *= Math.max(0.4, 1 - 0.12 * (nv - 3));
          if (s2.tech.includes('stokken') && !s2.tech.includes('schoon') && x.pop > 20 && rijk(s2) === rijk(soort)) {
            const voor = g.pop;
            g.pop *= Math.exp(-dt * JACHT * (1 + nv));
            verlies(soort, 'jacht', voor - g.pop);
            if (!s2.vlaggen['jaagt_' + soort.id]) {
              s2.vlaggen['jaagt_' + soort.id] = 1;
              verhaal(w, s2, 2, '🏹', `De ${meervoud(s2.naam)} gingen op de ${meervoud(soort.naam)} jagen.`, nu);
            }
          }
        }
      }
      const groei = b.groei * (0.6 + 0.4 * soort.genen.slim);
      // Alleen kun je geen kindjes krijgen.
      if (totaal < 1.6) {
        g.pop -= dt * 0.0006 * g.pop; // langzaam oud worden
      } else if (cap < 0.5) {
        const voor = g.pop;
        g.pop *= Math.exp(-0.08 * dt);
        honger += g.pop;
        verlies(soort, tekortIn(soort, r, drukDoor), voor - g.pop);
      } else {
        // Groeien tot het gebied vol is (exacte oplossing, werkt ook met grote stappen).
        const p = Math.max(g.pop, 1e-6);
        const nieuw = cap / (1 + ((cap - p) / p) * Math.exp(-groei * dt));
        if (nieuw < g.pop * 0.98) honger += g.pop - nieuw;
        if (nieuw < g.pop) verlies(soort, tekortIn(soort, r, drukDoor), g.pop - nieuw);
        g.pop = nieuw;
      }
      g.cap = cap;
      if (baasGebied && baasGebied.has(g.regio)) onderBaas += g.pop;
      if (g.pop > 0.3) bezet++;
      gezond += cap > 0 ? Math.min(1, cap / Math.max(g.pop, 1e-6)) * g.pop : 0;
      // Een rijke omgeving geeft meer ideeën: hout, steen, metaal, eten, water, vuur.
      rijkSom += g.pop * klem((r.plant + r.water + r.hout + r.metaal + (r.kust || !r.land ? r.zeevoedsel : 0) + r.vuur * 0.5 + r.magie * 0.5) / 3, 0, 1.4);
      kouDruk += g.pop * klem(0.4 - r.temp) * 2;
      hitteDruk += g.pop * klem(r.temp - 0.7) * 3;

      // Heel soms drijven een paar dieren per ongeluk op een boomstam naar een ander eiland.
      if (r.kust && r.eiland != null && g.pop > 15 && overZeeNee(soort) && rnd(w) < 1 - Math.exp(-dt / 20000)) vlot(w, soort, g, r, regios, nu);

      // Uitzwermen als het vol wordt.
      // Kans en aantal hangen zo van de tijd af dat een grote stap (inhalen) hetzelfde geeft als
      // veel kleine stappen (spelen).
      if (g.pop > 0.55 * cap && g.pop > 4 && rnd(w) < 1 - Math.exp(-0.25 * dt)) {
        let doel = null, beste = 0;
        for (const id of r.buren) {
          const n = regios[id];
          if (!bereikbaar(soort, r, n)) continue;
          const daar = perRegio.get(id) || [];
          const vol = daar.reduce((s, x) => s + x.pop, 0);
          const c = capaciteit(soort, n) / (vol + 5);
          if (c > beste) {
            beste = c;
            doel = n;
          }
        }
        if (doel && beste > 0.05) {
          // Een vijfde trekt weg. (Niet meer bij een grote stap: de groep groeit tussendoor ook weer aan.)
          const mee = g.pop * 0.2;
          g.pop -= mee;
          let d = (perRegio.get(doel.id) || []).find((x) => x.soort === soort.id);
          if (d) d.pop += mee;
          else {
            const nieuweStam = doel.soort !== r.soort && rnd(w) < 0.5;
            const stam = nieuweStam ? `${LANDSCHAP[doel.soort] || ''}${meervoud(soort.naam).toLowerCase()}` : g.stam;
            d = { soort: soort.id, regio: doel.id, pop: mee, stam, oorlog: null, sinds: w.jaar };
            w.groepen.push(d);
            if (!perRegio.has(doel.id)) perRegio.set(doel.id, []);
            perRegio.get(doel.id).push(d);
            if (!soort.vlaggen['naar_' + doel.soort]) {
              soort.vlaggen['naar_' + doel.soort] = 1;
              verhaal(w, soort, 1, '🧭', `Een groep ${meervoud(soort.naam)} trok${plekTekst(doel) || ' verder'}.`, nu);
            }
            if (nieuweStam && !soort.vlaggen['stam_' + stam]) {
              soort.vlaggen['stam_' + stam] = 1;
              verhaal(w, soort, 1, '🏕️', `Daar werden ze een eigen stam: de ${stam}.`, nu);
            }
          }
        }
      }
    }

    // Kennis en ontdekkingen. Meer wezens helpt, maar een volle buik en slimme hoofden helpen meer.
    const g0 = soort.genen;
    const maal = g0.slim * (1 + (soort.tech.includes('taal') ? 0.5 : 0) + (soort.tech.includes('vuur') ? 0.3 : 0) + (soort.tech.includes('schrift') ? 0.8 : 0) + (soort.tech.includes('stroom') ? 1 : 0));
    const welvaart = totaal > 0 ? gezond / totaal : 0;
    const rijkdom = totaal > 0 ? 0.3 + rijkSom / totaal : 0.3;
    // Heeft een andere soort in hun rijk al akkers en dorpen, dan raken ze daar achterop:
    // wilde dieren komen dan nauwelijks verder, andere slimme soorten gaan langzamer.
    // Alleen voor het deel dat in het gebied van de baas woont.
    const remBaas = isHeerser ? 0.15 : 0.05;
    const deelOnder = baasGebied && totaal > 0 ? Math.min(1, onderBaas / totaal) : 0;
    const rem = 1 - deelOnder * (1 - remBaas);
    // Seizoenen dwingen tot vooruit denken: een beetje slimmer.
    const seizoenSlim = 1 + (w.planeet?.seizoenen || 0) * 0.15;
    if (totaal >= 1.6) soort.kennis += dt * 0.5 * Math.log2(1 + totaal) * maal * (0.15 + 0.85 * welvaart) * rijkdom * rem * seizoenSlim;
    ontdek(w, soort, groepen, regios, dt, nu);

    // Ziektes treffen soorten die heel dicht op elkaar leven.
    const volheid = groepen.reduce((s, g) => s + (g.cap ? Math.min(1.2, g.pop / g.cap) : 0), 0) / Math.max(1, groepen.length);
    if (totaal > 500 && volheid > 0.9 && rnd(w) < dt / 30000) {
      const ernst = soort.tech.includes('schrift') ? 0.75 : 0.5; // wie kan opschrijven, leert van ziektes
      for (const g of groepen) {
        verlies(soort, 'ziekte', g.pop * (1 - ernst));
        g.pop *= ernst;
      }
      soort.vlaggen.ziektes = (soort.vlaggen.ziektes || 0) + 1;
      verhaal(w, soort, soort.vlaggen.ziektes === 1 ? 2 : 1, '🤒', `Een ziekte trof de ${meervoud(soort.naam)}. Veel van hen werden ziek, maar de sterksten bleven over.`, nu);
    }

    // Evolutie: langzaam aanpassen aan waar ze wonen.
    const som = Math.max(1, groepen.reduce((s, g) => s + g.pop, 0));
    const tempo = dt * 0.0008;
    g0.kou = klem(g0.kou + ((kouDruk / som) - g0.kou * 0.3) * tempo * 3);
    g0.hitte = klem(g0.hitte + ((hitteDruk / som) - g0.hitte * 0.3) * tempo * 3);
    // Hersenen groeien alleen als de omgeving erom vraagt: veel afwisseling, seizoenen,
    // samenleven. Daarna helpt praten en leren zelf ook mee.
    if (g0.aanleg === undefined) g0.aanleg = 1;
    const druk = Math.max(0, (rijkdom - 0.6) + (w.planeet?.seizoenen || 0) * 0.5 + g0.samen * 0.4 + Math.min(1, groepen.length / 30) * 0.3);
    // Aanleg bepaalt hoe slim een soort hooguit kan worden: niet elk dier wordt een denker.
    // Wie eenmaal praat, kan door leren en elkaar dingen vertellen nog wat verder komen.
    const plafond = Math.min(3, slimPlafond(g0) + (isHeerser ? 0.8 : 0));
    const slimNieuw = Math.min(plafond, g0.slim + dt * 0.00001 * druk * g0.aanleg * (1 - deelOnder * 0.7) + (isHeerser ? tempo * 0.15 * soort.tech.length / 8 : 0));
    g0.slim = Math.max(g0.slim, slimNieuw); // nooit dommer worden
    const vol = groepen.reduce((s, g) => s + (g.cap ? g.pop / g.cap : 0), 0) / Math.max(1, groepen.length);
    g0.grootte = klem(g0.grootte + (vol < 0.5 ? 0.2 : -0.2) * tempo * 0.5, 0.5, 2.2);
    if (soort.beweging === 'zwemmen' && g0.land < 1) {
      const kustRuimte = Object.values(regios).some((r) => r.land && r.kust);
      if (kustRuimte && vol > 0.7) g0.land = klem(g0.land + tempo * 1.2);
    }
    genEvents(w, soort, nu);
    // Wie nooit gaat praten maar wel goed samenwerkt (zoals mieren en termieten), bouwt samen
    // enorme heuvels met gangen en kamers. Zonder dat iemand de baas is of het uitlegt.
    if (!soort.vlaggen.heuvels && !isHeerser && !soort.vlaggen.getemdDoor && soort.tech.includes('nesten') && totaal > 150 && soort.beweging !== 'zwemmen' &&
      (soort.maat === 'mier' || (slimPlafond(g0) < SLIM_DREMPEL && g0.samen >= 0.5)) && rnd(w) < 1 - Math.exp(-dt / 3000)) {
      soort.vlaggen.heuvels = Math.floor(w.jaar);
      verhaal(w, soort, 3, '⛰️', `De ${meervoud(soort.naam)} kunnen niet praten, maar samen bouwen ze enorme heuvels met gangen en kamers. Niemand vertelt ze hoe: iedereen doet een klein stukje!`, nu);
    }

    // Honger en uitsterven.
    const nu_totaal = groepen.reduce((s, g) => s + g.pop, 0);
    soort.piek = Math.max(soort.piek, nu_totaal);
    // Geschiedenis voor de grafiek in het verhaalboek: hooguit 120 punten. Is het vol, dan om de
    // andere weg en twee keer zo ver uit elkaar (zo past ook een miljoen jaar erin).
    const hs = (soort.histStap ||= 200);
    const hist = (soort.hist ||= []);
    if (!hist.length || w.jaar - hist[hist.length - 1][0] >= hs) {
      hist.push([Math.floor(w.jaar), Math.round(nu_totaal)]);
      if (hist.length > 120) {
        soort.hist = hist.filter((_, k) => k % 2 === 0 || k === hist.length - 1);
        soort.histStap = hs * 2;
      }
    }
    // Hooguit eens per 5000 jaar melden; alleen de eerste keer is groot nieuws.
    if (honger > nu_totaal * 0.02 * dt && (!soort.vlaggen.honger || w.jaar - soort.vlaggen.honger > 5000)) {
      verhaal(w, soort, soort.vlaggen.honger ? 1 : 2, '😟', hongerTekst(soort, groepen, regios), nu);
      soort.vlaggen.honger = w.jaar;
    }
    // Het kind heeft gezien dat het slecht gaat (tijdens het spelen, niet tijdens het inhalen).
    if (!w._inhalen && soort.piek > 20 && nu_totaal < soort.piek * 0.3) soort.vlaggen.gewaarschuwd = 1;
    else if (soort.vlaggen.gewaarschuwd && nu_totaal > soort.piek * 0.6) delete soort.vlaggen.gewaarschuwd; // weer opgeknapt: weer beschermd
    // Een getekend wezen sterft nooit uit terwijl het kind weg was, zonder dat het kind eerder
    // heeft kunnen zien dat het slecht ging. Dan blijft er een laatste groepje over.
    if (w._inhalen && !soort.afkomst && !soort.vlaggen.gewaarschuwd && nu_totaal < 10 && nu_totaal > 0 && soort.piek >= 10) {
      const beste = groepen.reduce((a, g) => (g.pop > (a?.pop ?? -1) ? g : a), null);
      if (beste) beste.pop += 10 - nu_totaal;
    } else if (nu_totaal < 0.5) {
      soort.uitgestorven = Math.floor(w.jaar);
      (soort.hist ||= []).push([Math.floor(w.jaar), 0]);
      const oorzaak = grootsteOorzaak(soort);
      soort.oorzaak = oorzaak;
      verhaal(w, soort, 3, '🪦', `De ${meervoud(soort.naam)} zijn uitgestorven${oorzaak ? `, omdat ${OMDAT[oorzaak]}` : ''}. De laatste ${soort.naam} is er niet meer.${soort.afkomst ? '' : ' Wat zou daar wél kunnen leven? Teken het maar!'}`, nu);
    }
    // Mijlpalen in aantal.
    for (const [grens, tekst] of [[10, 'Er zijn nu al 10 '], [100, 'Er zijn nu 100 '], [1000, 'Duizend '], [10000, 'Tienduizend '], [100000, 'Honderdduizend '], [1000000, 'Een miljoen ']]) {
      if (nu_totaal >= grens && !soort.vlaggen['aantal' + grens]) {
        soort.vlaggen['aantal' + grens] = 1;
        verhaal(w, soort, grens >= 1000 ? 2 : 1, '👪', `${tekst}${meervoud(soort.naam)}${grens === 10 ? '!' : ' op de planeet!'}`, nu);
      }
    }
  }

  temmen(w, dt, nu);
  geloof(w, dt, nu);
  kroon(w, nu);
  ruzies(w, regios, dt, nu);
  nieuweSoorten(w, regios, dt, nu);
  w.groepen = w.groepen.filter((g) => g.pop >= 0.3 || (g.pop > 0 && w.soorten[g.soort] && totaalVan(w, g.soort) < 1.6 && totaalVan(w, g.soort) >= 0.5));
}

function totaalVan(w, id) {
  return w.groepen.reduce((s, g) => s + (g.soort === id ? g.pop : 0), 0);
}

function hongerTekst(soort, groepen, regios) {
  const rs = groepen.map((g) => regios[g.regio]).filter(Boolean);
  const m = meervoud(soort.naam);
  if (rs.length && rs.every((r) => r.water < 0.2) && soort.beweging !== 'zwemmen') return `De ${m} hebben dorst. Ze zoeken overal naar water.`;
  if (rs.length && rs.every((r) => r.temp < 0.25)) return `De ${m} hebben het heel erg koud.`;
  if (rs.length && rs.every((r) => r.temp > 0.85)) return `Het is veel te heet voor de ${m}.`;
  return `De ${m} hebben honger. Er is niet genoeg eten voor iedereen.`;
}

function ontdek(w, soort, groepen, regios, dt, nu) {
  const h = (x) => soort.tech.includes(x);
  const rs = groepen.filter((g) => g.pop > 1).map((g) => regios[g.regio]).filter(Boolean);
  const m = meervoud(soort.naam);
  for (const t of TECH) {
    // Manen aan de hemel maken nieuwsgierig naar de sterren.
    const kosten = t.id === 'sterren' && w.planeet ? t.kosten * (1 - 0.15 * Math.min(3, w.planeet.manen)) : t.kosten;
    if (h(t.id) || !naOk(t, soort) || soort.kennis < kosten) continue;
    let bron = null;
    const zee = rijk(soort) === 'zee';
    const vulkanisch = regios.some((r) => r.vuur > 0.3);
    const magisch = rs.some((r) => r.magie > 0.3) || soort.genen.magie >= 0.3;
    if (t.eis === 'vuur') {
      if (zee) {
        // Onder water geen vuur, wel warmte uit hete bronnen of gloeiende kristallen.
        // Zonder vulkanen of magie: heel langzaam leren ze warmte uit zonnige lagunes te halen.
        if (rnd(w) > dt * (vulkanisch || magisch ? 0.003 : 0.00015)) continue;
        bron = vulkanisch ? 'bronnen' : magisch ? 'gloed' : 'zon';
      } else {
        // Vuur moet je eerst ergens zien: bliksem, lava, een vulkaan. Of heel veel geluk met stenen.
        // Bliksem telt alleen als er echt stormen zijn; een vulkaan die net uitbarstte helpt extra.
        // Op een magische planeet kan gloeiend kristal ook warmte geven.
        const landRs = rs.filter((r) => r.land);
        if (!landRs.length) continue;
        const storm = stormKans(w);
        const kansIn = (r) => Math.max(r.vuur + (r.vulkaanJaar && w.jaar - r.vulkaanJaar < 50 ? 0.8 : 0), (r.bliksem || 0) * storm, r.magie * 0.5);
        const kans = landRs.reduce((s, r) => s + kansIn(r), 0) / landRs.length;
        if (rnd(w) > dt * (0.01 * kans + 0.0001)) continue;
        const r = landRs.reduce((a, b) => (kansIn(b) > kansIn(a) ? b : a));
        const bliksem = (r.bliksem || 0) * storm, gloed = r.magie * 0.5;
        bron = kansIn(r) < 0.05 ? 'stenen' : gloed > Math.max(bliksem, r.vuur) ? 'gloed' : bliksem > r.vuur ? 'bliksem' : r.vuurBron;
      }
      if (bron === 'gloed') soort.vlaggen.gloed = 1;
    } else if (t.eis === 'kust') {
      if (!zee && !rs.some((r) => r.kust || !r.land)) continue;
    } else if (t.eis === 'vruchtbaar') {
      if (!zee && !rs.some((r) => r.land && r.vruchtbaar > 0.25 && r.water > 0.3)) continue;
    } else if (t.eis === 'boot') {
      if (zee || soort.beweging === 'vliegen') {
        if (soort.beweging !== 'vliegen') continue;
      } else if (!rs.some((r) => r.kust && r.hout > 0.1)) continue;
    } else if (t.eis === 'metaal') {
      // Zeewezens vinden metaal op de zeebodem bij vulkanen of meteorietkraters.
      if (zee ? !(vulkanisch || regios.some((r) => r.metaal > 0.4)) : !rs.some((r) => r.metaal > 0.15)) continue;
    } else if (t.eis === 'magie') {
      if (!magisch) continue;
    }
    // Praten kan pas als de hersenen groot genoeg zijn geworden.
    if (t.id === 'taal' && soort.genen.slim < SLIM_DREMPEL) continue;
    if (t.id === 'vuur' && soort.thuisLand === 'lava' && !soort.tech.includes('taal')) bron = 'lavavolk';
    // Eerst kijken of er al een baas is, dan pas de akkers erbij (anders vindt hij zichzelf).
    const alBaas = t.id === 'landbouw' ? heerser(w, rijk(soort)) : null;
    soort.tech.push(t.id);
    if (soort.vlaggen.slaapt === t.id) delete soort.vlaggen.slaapt;
    // Een huisdier dat leert praten, wil geen huisdier meer zijn.
    if (t.id === 'taal' && soort.vlaggen.getemdDoor) {
      const baasje = w.soorten[soort.vlaggen.getemdDoor];
      delete soort.vlaggen.getemdDoor;
      if (baasje) verhaal(w, soort, 3, '🗝️', `De ${m} leerden praten. Het eerste wat ze zeiden: "We willen geen huisdier meer zijn!" Ze namen afscheid van de ${meervoud(baasje.naam)} en gingen hun eigen weg.`, nu);
    }
    const tn = techNaam(t.id, soort);
    const tekst = ontdekTekst(t.id, m, bron, soort);
    // Onthouden wanneer en hoe (voor de ontdekkingsboom).
    (soort.ontdekt ||= {})[t.id] = { jaar: Math.floor(w.jaar), hoe: tekst };
    verhaal(w, soort, t.id === 'nesten' || t.id === 'stokken' ? 2 : 3, tn.icoon, tekst, nu);
    // Meerdere soorten kunnen slim worden. Wie als eerste akkers heeft en dorpen bouwt, krijgt een
    // grote voorsprong en wordt de baas van zijn rijk (maar ook dat kan weer veranderen).
    if (t.id === 'landbouw' && !alBaas) {
      soort.vlaggen.heerserSinds = w.jaar;
      verhaal(w, soort, 3, '👑', `De ${m} waren de eersten met akkers ${rijk(soort) === 'zee' ? 'in de zee' : 'op het land'}. Ze krijgen meer eten, bouwen dorpen en nemen steeds meer ruimte in. Andere dieren moeten opschuiven.`, nu);
    }
    if (t.id === 'schoon') {
      for (const ander of Object.values(w.soorten)) {
        if (ander !== soort && ander.uitgestorven === null && soort.vlaggen['jaagt_' + ander.id]) {
          verhaal(w, soort, 2, '🏞️', `De ${m} maakten natuurparken. De ${meervoud(ander.naam)} zijn weer veilig.`, nu);
        }
      }
    }
    const nieuw = tijdperk(soort);
    if (nieuw.als.length && nieuw.als[nieuw.als.length - 1] === t.id) verhaal(w, soort, 2, nieuw.icoon, `De ${nieuw.naam} is begonnen voor de ${m}!`, nu);
    break; // één ontdekking tegelijk
  }
}

function ontdekTekst(id, m, bron, soort) {
  const zwem = soort.beweging === 'zwemmen', vlieg = soort.beweging === 'vliegen';
  // Eigen paden voor zeewezens en vliegers.
  if (rijk(soort) === 'zee') {
    const zeeTekst = {
      wiel: `De ${m} leerden mee te liften op de zeestromingen. Zo komen ze overal!`,
      metaal: `Op de zeebodem vonden de ${m} harde schelpen en metaal om gereedschap van te maken.`,
      machines: `De ${m} bouwden machines die werken met luchtbellen.`,
      landbouw: `De ${m} legden zeewiertuinen aan. Nu groeit het eten vanzelf!`,
      raket: `De ${m} bouwden een raket vol water, zodat ze in de ruimte kunnen zwemmen!`,
    };
    if (zeeTekst[id]) return zeeTekst[id];
  }
  if (vlieg && id === 'wiel') return `De ${m} leerden zweven op de wind. Ze vliegen nu over de hele planeet!`;
  if (vlieg && id === 'boten') return `De ${m} leerden heel lange vluchten te maken, over de zee heen.`;
  if (vlieg && id === 'hutten') return `De ${m} bouwden grote nesten in de rotsen.`;
  switch (id) {
    case 'nesten':
      return zwem ? `De ${m} maakten holletjes in het zand op de zeebodem.` : vlieg ? `De ${m} bouwden hun eerste nesten.` : `De ${m} groeven hun eerste holen om in te slapen.`;
    case 'stokken':
      return zwem ? `De ${m} ontdekten dat je met schelpen dingen kunt openmaken.` : `Een slimme ${soort.naam} pakte een stok en een steen. Gereedschap!`;
    case 'taal':
      return `De ${m} begonnen met elkaar te praten. Nu kunnen ze verhalen vertellen.`;
    case 'vuur':
      return {
        bliksem: `De bliksem sloeg in een boom en de ${m} zagen vuur! Ze leerden het zelf te maken.`,
        lava: `Bij de gloeiende lavazee ontdekten de ${m} het vuur.`,
        vulkaan: `Een vulkaan spuwde vuur. De ${m} namen een brandende tak mee naar huis.`,
        stenen: `Na heel lang proberen sloeg een ${soort.naam} twee stenen tegen elkaar. Vonkjes! Vuur!`,
        lavavolk: `De ${m} wonen naast de gloeiende lava. Ze kunnen nog niet eens praten, maar ze weten al hoe je met een tak een vuurtje meeneemt!`,
        bronnen: `De ${m} ontdekten hete bronnen op de zeebodem. Daar kun je eten op koken!`,
        zon: `De ${m} ontdekten dat het water in ondiepe lagunes warm wordt van de zon. Zo leerden ze koken!`,
        gloed: `De ${m} ontdekten dat gloeiende kristallen warmte geven. Bijna net zo goed als vuur!`,
      }[bron] || `De ${m} ontdekten het vuur!`;
    case 'vissen':
      return zwem ? `De ${m} leerden samen jagen in de zee.` : `De ${m} leerden vissen vangen.`;
    case 'hutten':
      if (zwem) return `De ${m} bouwden huisjes van koraal.`;
      return {
        ijs: `Er groeien geen bomen in het ijs. Daarom bouwden de ${m} huizen van sneeuwblokken: iglo's! Binnen is het lekker warm.`,
        woestijn: `In de woestijn is bijna geen hout. De ${m} maakten blokken van modder en lieten ze in de zon hard worden. Zo bouwden ze leemhuizen.`,
        berg: `De ${m} hakten huizen uit in de rotsen van de bergen.`,
        lava: `De ${m} bouwden huizen van zwarte lavasteen. Die kunnen niet branden!`,
      }[soort.thuisLand] || `De ${m} bouwden hun eerste hutten.`;
    case 'landbouw':
      return `De ${m} plantten zaadjes en maakten de eerste akkers. Nu groeit het eten vanzelf!`;
    case 'boten':
      return `De ${m} bouwden een boot en voeren de zee op!`;
    case 'wiel':
      return `Een ${soort.naam} bedacht het wiel. Alles gaat nu sneller!`;
    case 'metaal':
      return `In de bergen vonden de ${m} glimmend metaal.`;
    case 'schrift':
      return `De ${m} bedachten letters. Nu kunnen ze alles opschrijven!`;
    case 'kristal':
      return `De ${m} ontdekten dat de kristallen licht en kracht geven.`;
    case 'sterren':
      return `De ${m} keken 's nachts naar de sterren en de manen en vroegen zich af wat daar is.`;
    case 'machines':
      return `De ${m} bouwden hun eerste machines. Het ratelt en het puft!`;
    case 'stroom':
      return `De ${m} ontdekten elektriciteit. 's Nachts gaan in de steden de lichtjes aan!`;
    case 'raket':
      return `De ${m} bouwden een raket! Ze kijken naar de andere planeten...`;
    case 'schoon':
      return `De ${m} haalden energie uit de zon en de wind. Geen rook meer!`;
  }
  return `De ${m} ontdekten iets nieuws.`;
}

function genEvents(w, soort, nu) {
  const g = soort.genen, v = soort.vlaggen, m = meervoud(soort.naam);
  const drempel = (sleutel, waar, icoon, tekst) => {
    if (waar && !v[sleutel]) {
      v[sleutel] = 1;
      verhaal(w, soort, 2, icoon, tekst, nu);
    }
  };
  // Evolutie gaat via selectie: niet "ze kregen een vacht", maar "wie een dikke vacht had,
  // bleef over en kreeg de meeste kindjes".
  drempel('vacht', g.kou > 0.35, '🧥', `Het is koud waar de ${m} wonen. Wie een dikke vacht had, hield het het langst vol en kreeg de meeste kindjes. Na heel veel jaren hebben bijna alle ${m} een dikke vacht.`);
  drempel('hitte', g.hitte > 0.35, '🌵', `Het is heet waar de ${m} wonen. Wie goed tegen de hitte kon, bleef het vaakst over. Zo kunnen bijna alle ${m} nu goed tegen de hitte.`);
  drempel('groot', g.grootte > 1.3, '📏', `Er was veel ruimte en eten. De grootste ${m} waren het sterkst en kregen de meeste kindjes. Zo werden de ${m} langzaam steeds groter.`);
  drempel('klein', g.grootte < 0.75, '🤏', `Er was weinig eten. Kleine ${m} hebben minder nodig, dus die bleven vaker over. Zo werden de ${m} langzaam kleiner.`);
  drempel('slim', g.slim > SLIM_DREMPEL - 0.05, '🧠', `De slimste ${m} vonden het meeste eten en kregen de meeste kindjes. Na heel veel jaren hebben de ${m} grotere hersenen. Ze maken steeds meer geluidjes naar elkaar...`);
  drempel('pootjes', soort.beweging === 'zwemmen' && g.land >= 0.5, '🦵', `Het werd vol in de zee. ${hoofd(m)} die een stukje op het land konden kruipen, vonden daar eten. Na heel lang hebben sommige ${m} echte pootjes!`);
}

// ---------- Geloof ----------
// Een slim volk met dorpen gaat zich afvragen wie hun wereld gemaakt heeft. En dat klopt: dat was
// het kind (of papa) van wie de planeet is! Ze bouwen een tempel en houden feesten. Verschillende
// goden geven geen ruzie, alleen mooie verhalen voor elkaar.
// De god is altijd de speler die de planeet maakte, met de naam die die zelf heeft ingevoerd.
// (Zo voelt elk kind dat zijn eigen wezens in hem of haar geloven.) GODEN is alleen nog een
// reserve voor oude werelden zonder naam.
export const GODEN = { owen: 'Owen', jake: 'Jake', papa: 'Papa' };
const schoneNaam = (n) => String(n || '').replace(/[^\p{L}\p{N} '-]/gu, '').trim().slice(0, 16);
export function godNaam(geloof) {
  return schoneNaam(geloof?.godNaam) || GODEN[geloof?.god] || 'de Maker';
}
// Elk volk geeft zijn geloof een eigen naam: het Sophieïsme, het Lucasdom, het Geloof van Emma...
// (Na een klinker krijgt -isme een trema: Jakeïsme, Emmaïsme.)
function maakGeloofNaam(naam, keuze) {
  const g = schoneNaam(naam) || 'Maker';
  const isme = /[aeiouy]$/i.test(g) ? g + 'ïsme' : g + 'isme';
  return [isme, g + 'dom', 'Geloof van ' + g][Math.floor(keuze * 3) % 3];
}
export function geloofNaam(geloof) {
  if (!geloof) return '';
  return geloof.naam || maakGeloofNaam(godNaam(geloof), 0);
}
function geloof(w, dt, nu) {
  w._geloofTijd = (w._geloofTijd || 0) + dt;
  if (w._geloofTijd < 50) return;
  const tijd = w._geloofTijd;
  w._geloofTijd = 0;
  const maker = w.maker || 'speler';
  const makerNaam = schoneNaam(w.makerNaam) || GODEN[w.maker] || 'de Maker';
  const levend = Object.values(w.soorten).filter((s) => s.uitgestorven === null);
  for (const s of levend) {
    if (s.geloof || !s.tech.includes('taal') || !s.tech.includes('hutten')) continue;
    // Naar de sterren kijken of een ijstijd meemaken zet ze eerder aan het denken.
    const kans = (s.tech.includes('sterren') ? 3 : 1) * (w.klimaat?.fase === 'ijstijd' ? 2 : 1);
    if (rnd(w) > 1 - Math.exp((-tijd * kans) / 12000)) continue;
    const ander = levend.find((x) => x.geloof && x !== s);
    // Meestal de maker van de planeet; heel soms de god van een ander volk (een reiziger vertelde over hem).
    const overgenomen = ander && rnd(w) < 0.3;
    const god = overgenomen ? ander.geloof.god : maker;
    const naamGod = overgenomen ? godNaam(ander.geloof) : makerNaam;
    s.geloof = { god, godNaam: naamGod, sinds: Math.floor(w.jaar), naam: maakGeloofNaam(naamGod, rnd(w)) };
    const m = meervoud(s.naam);
    verhaal(w, s, 3, '🙏', `De ${m} keken naar de sterren en vroegen zich af wie hun wereld gemaakt had. Ze denken dat het de Grote ${naamGod} was. En dat klopt! Hun geloof heet het ${s.geloof.naam}. Ze bouwen een tempel voor de Grote ${naamGod}.`, nu);
    if (ander && ander.geloof.god !== god) verhaal(w, s, 2, '📖', `De ${m} (${s.geloof.naam}) en de ${meervoud(ander.naam)} (${geloofNaam(ander.geloof)}) vertellen elkaar verhalen over de Grote ${naamGod} en de Grote ${godNaam(ander.geloof)}.`, nu);
  }
  for (const s of levend) {
    if (!s.geloof || rnd(w) > 1 - Math.exp(-tijd / 9000)) continue;
    verhaal(w, s, 1, '🎉', `De ${meervoud(s.naam)} vierden het grote ${godNaam(s.geloof)}feest van het ${geloofNaam(s.geloof)}. Ze dansten de hele nacht rond de tempel van de Grote ${godNaam(s.geloof)}.`, nu);
  }
}

// Doet het kind iets groots op de planeet (een berg maken, water gieten, een storm), dan zien de
// gelovige wezens dat als een wonder van hun god.
const WONDEREN = {
  berg: 'zagen ineens een berg uit de grond groeien',
  kuil: 'zagen de grond wegzakken in een diepe kuil',
  water: 'zagen het water stijgen alsof iemand de zee vulde',
  storm: 'zagen een enorme storm over het land trekken',
  verf: 'zagen de grond ineens van kleur veranderen',
  wezen: 'zagen een ruimteschip met nieuwe wezens landen',
  feest: 'zagen vuurwerk aan de hemel',
};
export function wonder(w, soort, nu = Date.now()) {
  const tekst = WONDEREN[soort];
  if (!tekst || w.jaar - (w._wonderJaar ?? -1e9) < 150) return false;
  const gelovig = Object.values(w.soorten).filter((s) => s.uitgestorven === null && s.geloof);
  if (!gelovig.length) return false;
  w._wonderJaar = w.jaar;
  const s = gelovig[Math.floor(rnd(w) * gelovig.length)];
  verhaal(w, s, 2, '✨', `De ${meervoud(s.naam)} ${tekst}. "Een wonder van de Grote ${godNaam(s.geloof)}!" riepen ze, en ze brachten bloemen naar de tempel van het ${geloofNaam(s.geloof)}.`, nu);
  return true;
}

// ---------- Temmen ----------
// Een slim volk met akkers en een wild dier dat in dezelfde gebieden woont: soms raken ze aan
// elkaar gewend. Het dier wordt een huisdier: het helpt mee, krijgt eten en een stal, en wordt
// niet meer opgejaagd. Zo hebben mensen ook honden, paarden en koeien gekregen.
function temmen(w, dt, nu) {
  w._temTijd = (w._temTijd || 0) + dt;
  if (w._temTijd < 50) return;
  const tijd = w._temTijd;
  w._temTijd = 0;
  const levend = Object.values(w.soorten).filter((s) => s.uitgestorven === null);
  const tammers = levend.filter((s) => s.tech.includes('landbouw') && s.tech.includes('taal'));
  if (!tammers.length) return;
  const gebiedenVan = (id) => new Set(w.groepen.filter((g) => g.soort === id && g.pop > 5).map((g) => g.regio));
  for (const dier of levend) {
    if (dier.vlaggen.getemdDoor || dier.tech.includes('taal') || dier.maat === 'mier' || dier.beweging === 'zwemmen') continue;
    const hier = gebiedenVan(dier.id);
    for (const t of tammers) {
      if (t === dier || rijk(t) !== rijk(dier)) continue;
      const daar = gebiedenVan(t.id);
      let samen = 0;
      for (const x of hier) if (daar.has(x)) samen++;
      if (!samen || rnd(w) > 1 - Math.exp((-tijd * samen) / 60000)) continue;
      dier.vlaggen.getemdDoor = t.id;
      const klus = dier.beweging === 'vliegen' ? 'met het brengen van berichten' : dier.maat === 'olifant' || dier.maat === 'reus' ? 'met het dragen van zware dingen' : 'met het bewaken van de dorpen';
      verhaal(w, dier, 3, '🐕', `De ${meervoud(t.naam)} temden de ${meervoud(dier.naam)}! De ${meervoud(dier.naam)} helpen nu ${klus}. Ze krijgen eten en een warme stal, en niemand jaagt meer op ze.`, nu);
      break;
    }
  }
}

// ---------- De kroon kan wisselen ----------
// De grootste bouwers blijven dat niet altijd. Stort hun rijk in (honger, ziekte, oorlog...) of
// wordt een ander volk veel groter, dan zijn ze het niet meer. Na een instorting vergeten ze
// soms zelfs hun nieuwste uitvinding: donkere tijden. Later kunnen ze weer opkrabbelen.
function kroon(w, nu) {
  for (const gebied of ['land', 'zee']) {
    const baas = heerser(w, gebied);
    if (!baas) {
      // Geen baas: een gevallen rijk dat weer groot is, mag weer meedoen.
      for (const s of Object.values(w.soorten)) {
        if (s.vlaggen.gevallen && s.uitgestorven === null && rijk(s) === gebied && w.jaar - s.vlaggen.gevallen > 5000 && totaalVan(w, s.id) > s.piek * 0.6) {
          delete s.vlaggen.gevallen;
          s.vlaggen.heerserSinds = w.jaar;
          verhaal(w, s, 3, '👑', `De ${meervoud(s.naam)} krabbelden weer op. Ze zijn opnieuw de grootste bouwers ${gebied === 'zee' ? 'in de zee' : 'op het land'}!`, nu);
          break;
        }
      }
      continue;
    }
    const tot = totaalVan(w, baas.id);
    let rivaal = null, rivaalTot = 0;
    for (const s of Object.values(w.soorten)) {
      if (s === baas || s.uitgestorven !== null || rijk(s) !== gebied || !s.tech.includes('landbouw') || s.vlaggen.gevallen) continue;
      const t = totaalVan(w, s.id);
      if (t > rivaalTot) (rivaal = s), (rivaalTot = t);
    }
    // Een rijk valt niet zomaar: pas na een flinke tijd aan de top, en niet vlak na de vorige wissel.
    w.kroonRust ||= {};
    if (w.jaar - (w.kroonRust[gebied] ?? -1e9) < 12000 || w.jaar - (baas.vlaggen.heerserSinds ?? 0) < 6000) continue;
    const instort = baas.piek > 200 && tot < baas.piek * 0.2;
    const ingehaald = rivaal && rivaalTot > tot * 3 && rivaalTot > 100;
    if (!instort && !ingehaald) continue;
    w.kroonRust[gebied] = w.jaar;
    baas.vlaggen.gevallen = w.jaar;
    delete baas.vlaggen.heerserSinds;
    const m = meervoud(baas.naam);
    if (instort) {
      const basis = ['nesten', 'stokken', 'taal', 'vuur', 'hutten', 'landbouw'];
      const laatste = [...baas.tech].reverse().find((t) => !basis.includes(t));
      let vergeten = '';
      if (laatste) {
        // De uitvinding raakt niet kwijt, maar "slaapt": als het weer beter gaat, komt ze snel terug.
        baas.tech = baas.tech.filter((t) => t !== laatste);
        baas.kennis = Math.min(baas.kennis, TECH_BY[laatste].kosten * 0.9);
        baas.vlaggen.slaapt = laatste;
        vergeten = ` Even wisten ze niet meer hoe ${techNaam(laatste, baas).naam.toLowerCase()} werkte. Als het beter gaat, komt het terug.`;
      }
      const oorzaak = grootsteOorzaak(baas);
      verhaal(w, baas, 3, '🏚️', `Het rijk van de ${m} stortte in, omdat ${OMDAT[oorzaak] || 'er te veel tegelijk misging'}. Er braken donkere tijden aan.${vergeten}`, nu);
    } else {
      verhaal(w, baas, 3, '🏚️', `De ${meervoud(rivaal.naam)} werden veel groter dan de ${m}. De ${m} zijn niet meer de grootste bouwers.`, nu);
    }
    if (rivaal) {
      rivaal.vlaggen.heerserSinds = w.jaar;
      verhaal(w, rivaal, 3, '👑', `Nu zijn de ${meervoud(rivaal.naam)} de grootste bouwers ${gebied === 'zee' ? 'in de zee' : 'op het land'}.`, nu);
    }
  }
}

// ---------- Ruzie, oorlog en vrede ----------
function ruzies(w, regios, stapDt, nu) {
  // Spanningen veranderen langzaam: hooguit eens per 3 jaar uitrekenen (scheelt veel rekenwerk).
  w._ruzieTijd = (w._ruzieTijd || 0) + stapDt;
  if (w._ruzieTijd < Math.max(3, Math.min(100, stapDt * 4))) return;
  const dt = w._ruzieTijd;
  w._ruzieTijd = 0;
  const groepen = w.groepen.filter((g) => g.pop > 2);
  const perRegio = new Map();
  for (const g of groepen) {
    if (!perRegio.has(g.regio)) perRegio.set(g.regio, []);
    perRegio.get(g.regio).push(g);
  }
  const gedaan = new Set();
  for (const a of groepen) {
    const ra = regios[a.regio];
    if (!ra) continue;
    for (let k = -1; k < ra.buren.length; k++) {
      const lijst = perRegio.get(k < 0 ? a.regio : ra.buren[k]);
      if (!lijst) continue;
      for (const b of lijst) {
        if (b === a || b.stam === a.stam) continue;
        const sleutel = a.stam < b.stam ? a.stam + '|' + b.stam : b.stam + '|' + a.stam;
        if (gedaan.has(sleutel)) continue;
        gedaan.add(sleutel);
        const sa = w.soorten[a.soort], sb = w.soorten[b.soort];
        if (!sa || !sb) continue;
        // Een gloednieuwe soort krijgt eerst rust om te groeien.
        if (w.jaar - (sa.sinds || 0) < 3000 && sa.afkomst) continue;
        if (w.jaar - (sb.sinds || 0) < 3000 && sb.afkomst) continue;
        const sp = (w.spanning[sleutel] ||= { waarde: 0, oorlog: false, ruzie: false, vriend: false, rust: 0, keer: 0 });
        const vol = klem((a.cap ? a.pop / a.cap : 1) + (b.cap ? b.pop / b.cap : 1) - 1, 0, 2);
        const fel = (sa.genen.agressie + sb.genen.agressie) / 2;
        const lief = (sa.genen.samen + sb.genen.samen) / 2 + (sa.tech.includes('taal') && sb.tech.includes('taal') ? 0.2 : 0);
        // Na een vrede blijft het een hele tijd rustig.
        // Andere soorten zitten elkaar minder in de weg dan stammen van dezelfde soort.
        const zelfde = sa === sb ? 1 : 0.5;
        if (w.jaar > sp.rust || sp.oorlog) sp.waarde += dt * 0.0015 * (vol * fel * 2 * zelfde - lief * 0.6 + (rnd(w) - 0.5) * 0.4);
        sp.waarde = klem(sp.waarde, -2, 3);
        // Stammen van dezelfde soort vechten heel zelden: hooguit eens per 20.000 jaar per soort.
        // Anders staat het verhaalboek vol met dezelfde ruzies.
        if (sa === sb && !sp.oorlog && w.jaar - (sa.vlaggen.stamOorlog ?? -1e9) < 20000) sp.waarde = Math.min(sp.waarde, 0.7);
        const namen = `de ${a.stam} en de ${b.stam}`;
        const belang = sp.keer ? 1 : 2; // de eerste keer is groot nieuws, daarna minder
        if (!sp.ruzie && sp.waarde > 0.8) {
          sp.ruzie = true;
          // De reden onthouden: als het later uitloopt op vechten, weet het kind nog waarom.
          sp.reden = vol > 0.9 ? 'het werd te vol en er was niet genoeg eten' : kies(w, ['ze wilden allebei hetzelfde water', 'ze wilden allebei de beste slaapplek', 'ze wilden allebei de baas zijn']);
          verhaal(w, sa, belang, '😠', `${hoofd(namen)} kregen ruzie, want ${sp.reden}.`, nu);
        }
        if (!sp.oorlog && sp.waarde > 1.8) {
          sp.oorlog = true;
          sp.keer++;
          if (sa === sb) sa.vlaggen.stamOorlog = w.jaar;
          a.oorlog = b.oorlog = sleutel;
          verhaal(w, sa, sp.keer === 1 ? 3 : 1, '⚔️', `${hoofd(namen)} gingen ${sp.keer === 1 ? '' : 'weer '}duwen en stoeien om de grens, want ${sp.reden || 'het werd te vol'}.`, nu);
        }
        if (sp.oorlog) {
          const ka = a.pop * (BASIS.maat[sa.maat]?.kracht || 1) * sa.genen.grootte * (sa.tech.includes('metaal') ? 1.5 : 1);
          const kb = b.pop * (BASIS.maat[sb.maat]?.kracht || 1) * sb.genen.grootte * (sb.tech.includes('metaal') ? 1.5 : 1);
          // Vechten kost wezens, maar de zwakkere trekt zich terug voordat het te erg wordt.
          // Ook bij een grote stap nooit verder dan 40% van wat er voor de oorlog was.
          a.voorOorlog ||= a.pop;
          b.voorOorlog ||= b.pop;
          const [pa, pb] = [a.pop, b.pop];
          a.pop = Math.min(a.pop, Math.max(a.pop * Math.exp(-0.012 * dt * (kb / (ka + kb))), a.voorOorlog * 0.4));
          b.pop = Math.min(b.pop, Math.max(b.pop * Math.exp(-0.012 * dt * (ka / (ka + kb))), b.voorOorlog * 0.4));
          verlies(sa, 'oorlog', pa - a.pop);
          verlies(sb, 'oorlog', pb - b.pop);
          sp.waarde -= dt * 0.01; // vechten maakt moe
          if (sp.waarde < 0.6 || rnd(w) < 1 - Math.exp(-dt * 0.006)) {
            sp.oorlog = false;
            sp.ruzie = false;
            sp.waarde = -0.6;
            sp.rust = w.jaar + 3000;
            a.oorlog = b.oorlog = null;
            delete a.voorOorlog;
            delete b.voorOorlog;
            const winnaar = ka > kb ? a : b, verliezer = ka > kb ? b : a;
            w.soorten[winnaar.soort].genen.agressie = klem(w.soorten[winnaar.soort].genen.agressie + 0.04);
            w.soorten[verliezer.soort].genen.samen = klem(w.soorten[verliezer.soort].genen.samen + 0.05);
            verhaal(w, sa, belang, '🕊️', `${hoofd(namen)} sloten vrede. ${hoofd('de ' + winnaar.stam)} waren het sterkst.`, nu);
          }
        } else if (!sp.vriend && sp.waarde < -1) {
          sp.vriend = true;
          verhaal(w, sa, 2, '🤝', `${hoofd(namen)} werden vrienden en gingen samen handelen.`, nu);
        }
        // Vrienden leren van elkaar.
        if (sp.vriend && sa !== sb) {
          for (const [van, naar] of [[sa, sb], [sb, sa]]) {
            // Wilde dieren leren geen dingen van de heerser; alleen soorten die kunnen praten.
            const kan = naar.tech.includes('taal') && van.tech.find((t) => !naar.tech.includes(t) && naOk(TECH_BY[t], naar) && t !== 'vuur' && t !== 'taal' && TECH_BY[t].kosten <= 100000);
            if (kan && rnd(w) < 1 - Math.exp(-dt * 0.002)) {
              naar.tech.push(kan);
              (naar.ontdekt ||= {})[kan] = { jaar: Math.floor(w.jaar), hoe: `Geleerd van de ${meervoud(van.naam)}.` };
              verhaal(w, naar, 2, '🎓', `De ${meervoud(van.naam)} leerden de ${meervoud(naar.naam)} ${TECH_BY[kan].naam.toLowerCase()}.`, nu);
            }
          }
        }
      }
    }
  }
}
const hoofd = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- Nieuwe soorten: kruising en afsplitsing ----------
// Zoals in de echte evolutie: soorten die lang samenleven kunnen samen een nieuwe soort krijgen,
// en een stam die heel lang apart leeft in een andere omgeving wordt een eigen soort.
const MAX_SOORTEN = 6;
const KRUIS_NA = 8000; // jaren samenleven (±5,5 dag)
const APART_NA = 10000; // jaren apart (±1 week)
const KRUIS_BINNEN = 30000; // daarna zijn twee verwante soorten te ver uit elkaar gegroeid

function nieuweSoorten(w, regios, dt, nu) {
  const levend = Object.values(w.soorten).filter((s) => s.uitgestorven === null);
  if (levend.length >= MAX_SOORTEN) return;
  // Een nieuwe soort is heel bijzonder: de eerste pas na ±2,5 week, daarna hooguit één per ±2,5 week.
  if (w.jaar - (w.laatsteNieuweSoort ?? 0) < 25000) return;
  w.contact ||= {};
  const wortels = (s) => s.wortel || [s.id];
  const familie = (a, b) => wortels(a).some((x) => wortels(b).includes(x));
  const naamBestaat = (naam) => levend.some((s) => s.naam.toLowerCase() === naam.toLowerCase());

  // Kruising: twee soorten met flinke groepen in hetzelfde gebied.
  const perRegio = new Map();
  for (const g of w.groepen) {
    if (g.pop < 20) continue;
    if (!perRegio.has(g.regio)) perRegio.set(g.regio, []);
    perRegio.get(g.regio).push(g);
  }
  const gedaan = new Set();
  for (const [regio, eigen] of perRegio) {
    // Samenleven = in hetzelfde gebied of in een buurgebied wonen.
    const buren = (regios[regio]?.buren || []).flatMap((id) => perRegio.get(id) || []);
    for (let i = 0; i < eigen.length; i++) {
      for (const b of [...eigen.slice(i + 1), ...buren]) {
        const a = eigen[i];
        if (a.soort === b.soort) continue;
        const sleutel = [a.soort, b.soort].sort().join('|');
        if (gedaan.has(sleutel)) continue;
        gedaan.add(sleutel);
        const c = (w.contact[sleutel] ||= { jaren: 0, klaar: false });
        c.jaren += dt;
        if (c.klaar || c.jaren < KRUIS_NA) continue;
        const sa = w.soorten[a.soort], sb = w.soorten[b.soort];
        // Zoals echt: alleen soorten die nauw verwant zijn en nog niet zo lang geleden uit elkaar
        // gingen, kunnen samen jongen krijgen. Een vis en een vogel nooit.
        if (!sa || !sb || !familie(sa, sb)) continue;
        if (w.jaar - Math.max(sa.sinds || 0, sb.sinds || 0) > KRUIS_BINNEN) continue;
        if (rijk(sa) !== rijk(sb)) continue; // een vis en een landdier krijgen geen jongen samen
        // Lijken ze op elkaar, dan lukt het makkelijker.
        const maten = ['mier', 'hond', 'olifant', 'reus'];
        const verschil = Math.abs(maten.indexOf(sa.maat) - maten.indexOf(sb.maat));
        const past = (sa.beweging === sb.beweging ? 1 : 0.5) * (verschil <= 1 ? 1 : 0.3);
        if (rnd(w) > dt * past / 8000) continue;
        c.klaar = true;
        if (kruising(w, sa, sb, a, b, regios[regio], nu, naamBestaat)) {
          w.laatsteNieuweSoort = w.jaar;
          return; // één nieuwe soort tegelijk
        }
      }
    }
  }

  // Afsplitsing: een groep die lang in een heel andere omgeving leeft, ver van de rest.
  const bewoond = new Set(w.groepen.filter((x) => x.pop > 5).map((x) => x.soort + '|' + x.regio));
  // Op welk eiland woont het grootste deel van elke soort? (Hun "thuis-eiland".)
  const hoofdEiland = {};
  for (const x of w.groepen) {
    const e = regios[x.regio]?.eiland;
    if (e == null) continue;
    const h = hoofdEiland[x.soort];
    if (!h || x.pop > h.pop) hoofdEiland[x.soort] = { e, pop: x.pop };
  }
  for (const g of w.groepen) {
    const s = w.soorten[g.soort];
    const r = regios[g.regio];
    if (s && !s.thuisLand && r) s.thuisLand = r.soort; // oudere werelden
    if (!s || !r || s.uitgestorven !== null || g.pop < 30) continue;
    // Op een ander eiland dan de rest, en ze kunnen niet terug: dat is de snelste weg naar een
    // nieuwe soort (zoals de vinken en schildpadden van de Galápagos).
    const opEiland = r.eiland != null && hoofdEiland[s.id] && r.eiland !== hoofdEiland[s.id].e && overZeeNee(s);
    const sleutel = opEiland ? 'eiland' + r.eiland : r.soort;
    if ((s.vlaggen.splitsingen || 0) >= 2 || s.vlaggen['split_' + sleutel]) continue;
    const ander = r.soort !== (s.thuisLand || r.soort) && ['ijs', 'woestijn', 'lava', 'magie', 'berg', 'zee'].includes(r.soort);
    const alleen = !r.buren.some((id) => bewoond.has(g.soort + '|' + id));
    const was = g.apart || 0;
    g.apart = opEiland || (ander && (alleen || r.soort === 'ijs' || r.soort === 'lava')) ? was + dt : 0;
    // Halverwege: de groep verandert al langzaam (selectie), lang voordat het een nieuwe soort is.
    if (was < APART_NA / 2 && g.apart >= APART_NA / 2 && !s.vlaggen['apart_' + sleutel]) {
      s.vlaggen['apart_' + sleutel] = 1;
      if (opEiland) {
        verhaal(w, s, 2, '🔎', `De ${meervoud(s.naam)} op het eiland zien de anderen nooit meer. Daar blijven steeds de ${meervoud(s.naam)} over die het best bij het eiland passen. Langzaam gaan ze er anders uitzien...`, nu);
      } else {
        const wat = { ijs: 'tegen de kou', woestijn: 'tegen de hitte en de droogte', lava: 'tegen de hitte', berg: 'op de steile bergen', zee: 'in het water', magie: 'bij de kristallen' }[r.soort] || 'daar';
        verhaal(w, s, 2, '🔎', `De ${meervoud(s.naam)}${plekTekst(r)} zien de anderen nooit meer. Wie het best ${wat} kan, blijft daar over. Langzaam gaan ze er anders uitzien...`, nu);
      }
    }
    if (g.apart > APART_NA && rnd(w) < dt / 8000) {
      if (afsplitsing(w, s, g, r, nu, naamBestaat, opEiland, regios)) {
        w.laatsteNieuweSoort = w.jaar;
        return;
      }
    }
  }
}

const TINT = { ijs: 0.55, woestijn: 0.11, lava: 0.02, zee: 0.5, bos: 0.33, magie: 0.8, berg: 0.08, vlakte: 0.22, kust: 0.48 };

function basisSoort(w, naam, genen, extra) {
  const id = 'n' + Math.floor(w.jaar).toString(36) + Math.floor(rnd(w) * 1e6).toString(36);
  // Wat ze van hun ouders erven (vacht, grote hersenen...) is geen nieuws meer.
  const vlaggen = {};
  if (genen.slim > SLIM_DREMPEL - 0.05) vlaggen.slim = 1;
  if (genen.kou > 0.35) vlaggen.vacht = 1;
  if (genen.hitte > 0.35) vlaggen.hitte = 1;
  return { id, naam, genen, kennis: 0, tech: [], sinds: w.jaar, piek: 0, uitgestorven: null, vlaggen, nieuw: true, ...extra };
}

function kruising(w, sa, sb, ga, gb, r, nu, naamBestaat) {
  const helft = (n, eerste) => (eerste ? n.slice(0, Math.ceil(n.length / 2)) : n.slice(Math.floor(n.length / 2)));
  const naamRuw = helft(sa.naam, true) + helft(sb.naam, false).toLowerCase();
  const naam = naamRuw.charAt(0).toUpperCase() + naamRuw.slice(1);
  if (naamBestaat(naam)) return false;
  const mix = (x, y) => (x + y) / 2 + (rnd(w) - 0.5) * 0.1;
  const genen = {};
  for (const k of new Set([...Object.keys(sa.genen), ...Object.keys(sb.genen)])) genen[k] = mix(sa.genen[k] ?? 0, sb.genen[k] ?? 0);
  const maten = ['mier', 'hond', 'olifant', 'reus'];
  const maat = maten[Math.round((maten.indexOf(sa.maat) + maten.indexOf(sb.maat)) / 2 + (rnd(w) - 0.5) * 0.6)] || sa.maat;
  // Een kruising wordt niet geboren met kennis: hij begint waar de minst ontwikkelde ouder was.
  const slim = sa.tech.length <= sb.tech.length ? sa : sb;
  const s = basisSoort(w, naam, genen, {
    beweging: rnd(w) < 0.5 ? sa.beweging : sb.beweging,
    maat,
    kleur: sb.kleur || sa.kleur,
    thuisLand: r.soort,
    afkomst: { soort: 'kruising', ouders: [sa.id, sb.id], tint: sb.kleur ? sb.kleur.h : null, vlekken: sb.kleur || null },
  });
  s.tech = slim.tech.filter((t) => t !== 'taal' || (sa.tech.includes('taal') && sb.tech.includes('taal')));
  s.ontdekt = Object.fromEntries(Object.entries(slim.ontdekt || {}).filter(([t]) => s.tech.includes(t)));
  s.kennis = Math.min(slim.kennis, 6000) * 0.8;
  s.wortel = [...new Set([...(sa.wortel || [sa.id]), ...(sb.wortel || [sb.id])])];
  s.genen.slim += 0.1; // bastaardkracht: kruisingen zijn vaak sterk en slim
  const pop = Math.max(6, (ga.pop + gb.pop) * 0.15);
  ga.pop -= pop / 2;
  gb.pop -= pop / 2;
  s.piek = pop;
  w.soorten[s.id] = s;
  w.groepen.push({ soort: s.id, regio: r.id, pop, stam: meervoud(naam), oorlog: null, sinds: w.jaar });
  verhaal(w, s, 3, '🧬', `De ${meervoud(sa.naam)} en de ${meervoud(sb.naam)} hebben dezelfde opa's en oma's van heel lang geleden. Ze lijken nog zo op elkaar dat ze samen jongen kregen. Zo ontstonden de ${meervoud(naam)}!`, nu);
  return true;
}

function afsplitsing(w, ouder, g, r, nu, naamBestaat, opEiland = false, regios = []) {
  // De oudersoort moet ergens anders blijven bestaan: nooit de laatste groep omzetten.
  const blijft = w.groepen.some((x) => x.soort === ouder.id && x !== g && x.pop > 2 && !(opEiland && regios[x.regio]?.eiland === r.eiland));
  if (!blijft) return false;
  const voor = opEiland ? LANDSCHAP.eiland : LANDSCHAP[r.soort] || 'Nieuwe';
  // Geen "IJsijsblibo": een eerder voorvoegsel eerst weghalen.
  const kern = ouder.naam.replace(new RegExp('^(' + Object.values(LANDSCHAP).join('|') + ')', 'i'), '') || ouder.naam;
  const naam = voor + kern.toLowerCase();
  if (naamBestaat(naam)) return false;
  const genen = { ...ouder.genen };
  genen.slim += 0.05;
  // Ze zijn juist een eigen soort geworden omdat ze zich aanpasten aan hun omgeving.
  if (r.soort === 'ijs') {
    genen.grootte = Math.min(2.2, genen.grootte * 1.2);
    genen.kou = Math.max(genen.kou, 0.75);
  }
  if (r.soort === 'woestijn') {
    genen.grootte = Math.max(0.5, genen.grootte * 0.85);
    genen.hitte = Math.max(genen.hitte, 0.6);
  }
  if (r.soort === 'lava') genen.hitte = Math.max(genen.hitte, 0.75);
  if (r.soort === 'magie') genen.magie = Math.max(genen.magie || 0, 0.7);
  // De eilandregel: op een eiland worden grote dieren kleiner (weinig eten) en kleine dieren
  // groter (geen grote dieren die ze opeten). Zo bestonden er echt dwergolifanten!
  let eilandMaat = null;
  if (opEiland) {
    const groot = ouder.maat === 'olifant' || ouder.maat === 'reus';
    genen.grootte = Math.min(2.2, Math.max(0.5, genen.grootte * (groot ? 0.7 : ouder.maat === 'mier' ? 1.4 : 0.9)));
    eilandMaat = groot ? 'kleiner' : ouder.maat === 'mier' ? 'groter' : null;
  }
  // Vissen met pootjes worden echte landdieren.
  const beweging = ouder.beweging === 'zwemmen' && r.land ? 'lopen' : ouder.beweging;
  const s = basisSoort(w, naam, genen, {
    beweging,
    maat: ouder.maat,
    kleur: ouder.kleur ? { ...ouder.kleur, h: TINT[r.soort] ?? ouder.kleur.h } : null,
    thuisLand: r.soort,
    afkomst: { soort: 'afsplitsing', ouders: [ouder.id], tint: TINT[r.soort] ?? null, landschap: r.soort },
  });
  s.tech = [...ouder.tech];
  s.ontdekt = { ...(ouder.ontdekt || {}) };
  s.kennis = ouder.kennis;
  s.piek = g.pop;
  s.wortel = [...(ouder.wortel || [ouder.id])];
  const sleutel = opEiland ? 'eiland' + r.eiland : r.soort;
  s.vlaggen['split_' + sleutel] = 1; // niet nog eens op dezelfde plek
  ouder.vlaggen.splitsingen = (ouder.vlaggen.splitsingen || 0) + 1;
  ouder.vlaggen['split_' + sleutel] = 1;
  w.soorten[s.id] = s;
  // Op een eiland wordt de hele eilandgroep de nieuwe soort, anders alleen deze groep.
  for (const x of opEiland ? w.groepen.filter((x) => x.soort === ouder.id && regios[x.regio]?.eiland === r.eiland) : [g]) {
    x.soort = s.id;
    x.stam = meervoud(naam);
    x.apart = 0;
  }
  g.soort = s.id;
  g.stam = meervoud(naam);
  g.apart = 0;
  if (opEiland) {
    const maatZin = eilandMaat ? ` Op het eiland werden ze langzaam ${eilandMaat}.` : '';
    verhaal(w, s, 3, '🧬', `Een groep ${meervoud(ouder.naam)} leefde heel lang op een eiland, ver van de anderen. Daar bleven steeds de ${meervoud(ouder.naam)} over die het best bij het eiland pasten.${maatZin} Na duizenden jaren waren ze zo anders dat ze een nieuwe soort werden: de ${meervoud(naam)}!`, nu);
  } else {
    verhaal(w, s, 3, '🧬', `Een groep ${meervoud(ouder.naam)} woonde heel lang${plekTekst(r)}, ver van de anderen. Daar bleven steeds de ${meervoud(ouder.naam)} over die het best bij die plek pasten. Na duizenden jaren waren ze zo anders dat ze een nieuwe soort werden: de ${meervoud(naam)}!`, nu);
  }
  return true;
}

// ---------- Tijd inhalen ----------
// Grote stappen voor lange afwezigheid; de groeiformule blijft dan toch kloppen.
export function inhalen(w, regios, jaren, nu) {
  let rest = Math.min(jaren, 200000);
  const stapGrootte = Math.max(0.5, Math.min(100, rest / 1500));
  w._inhalen = true;
  try {
    while (rest > 1e-6) {
      const dt = Math.min(stapGrootte, rest);
      stap(w, regios, dt, nu);
      rest -= dt;
    }
  } finally {
    delete w._inhalen;
  }
}

// ---------- Drie meters voor het kind: eten, water, warmte ----------
// 1 = prima, 0 = heel slecht. Plus een zin met "omdat", zodat het kind snapt waarom.
export function meters(w, basisRegios, id) {
  const s = w.soorten[id];
  if (!s || s.uitgestorven !== null) return null;
  const groepen = w.groepen.filter((g) => g.soort === id && g.pop > 0.3 && basisRegios[g.regio]);
  if (!groepen.length) return null;
  let som = 0, eten = 0, water = 0, warmte = 0, temp = 0;
  for (const g of groepen) {
    const r = nuIn(basisRegios[g.regio], w);
    som += g.pop;
    eten += g.pop * (g.cap ? klem((g.cap / Math.max(g.pop, 1e-6) - 0.75) / 0.4) : 0.5);
    water += g.pop * (s.beweging === 'zwemmen' && !r.land ? 1 : klem((r.water * 1.4 - 0.15) / 0.6));
    warmte += g.pop * klem((klimaatFit(s, r) - 0.3) / 0.5);
    temp += g.pop * r.temp;
  }
  const m = { eten: eten / som, water: water / som, warmte: warmte / som };
  const lief = 0.55 - s.genen.kou * 0.45 + s.genen.hitte * 0.4;
  const koud = temp / som < lief;
  const naam = meervoud(s.naam);
  const vol = s.verlies && (s.verlies.concurrentie || 0) > (s.verlies.honger || 0);
  m.zinnen = {
    eten: m.eten > 0.66 ? `De ${naam} hebben genoeg te eten.` : m.eten > 0.33 ? `De ${naam} hebben net genoeg te eten, omdat er al veel van hen zijn.` : `De ${naam} hebben honger, omdat ${vol ? 'andere dieren hun eten opeten' : 'er te weinig eten is voor zoveel wezens'}.`,
    water: m.water > 0.66 ? `Er is genoeg water voor de ${naam}.` : m.water > 0.33 ? `Het water is soms op, omdat het droog is waar ze wonen.` : `De ${naam} hebben dorst, omdat het heel droog is waar ze wonen.`,
    warmte: m.warmte > 0.66 ? `De ${naam} vinden het lekker warm, niet te heet en niet te koud.` : `Het is ${m.warmte > 0.33 ? 'een beetje' : 'veel'} te ${koud ? 'koud' : 'heet'} voor de ${naam}${s.tech.includes('vuur') || !koud ? '.' : '. Vuur zou helpen!'}`,
  };
  return m;
}

// ---------- Samenvatting voor het scherm ----------
export function soortInfo(w, id) {
  const s = w.soorten[id];
  if (!s) return null;
  const groepen = w.groepen.filter((g) => g.soort === id);
  const totaal = groepen.reduce((a, g) => a + g.pop, 0);
  const stammen = new Set(groepen.filter((g) => g.pop >= 1).map((g) => g.stam));
  const baas = heerser(w, rijk(s));
  const rol = s.uitgestorven !== null ? 'weg' : baas === s ? 'heerser' : s.vlaggen.getemdDoor && w.soorten[s.vlaggen.getemdDoor] ? 'huisdier' : 'wild';
  return { soort: s, totaal, gebieden: groepen.length, stammen: stammen.size, tijdperk: tijdperk(s), groepen, rol, rijk: rijk(s) };
}
