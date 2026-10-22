// Regisseur van het leven op de planeet: bewaart de wereld, haalt de tijd in die voorbij is
// gegaan terwijl niemand keek, rekent elke paar seconden verder en houdt wezens en gebouwen
// in beeld gelijk met wat er werkelijk gebeurt.

import { nieuweWereld, voegSoortToe, vertrekSoort, terugSoort, stap, inhalen, soortInfo, stormKans, jarenTussen, snelBezig, meld, meters } from './sim.js';
import { maakRegios } from './regio.js';

const OPSLAG = 'planeetmakers-leven-v1';
const MAX_ZICHTBAAR = 220;

function leesAlles() {
  try {
    return JSON.parse(localStorage.getItem(OPSLAG)) || {};
  } catch {
    return {};
  }
}

// Gemiddelde kleur van een tekening (zonder het witte randje en de zwarte lijnen).
export function kleurVan(url) {
  return new Promise((klaar) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 32, 32);
      const d = ctx.getImageData(0, 0, 32, 32).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200) continue;
        const max = Math.max(d[i], d[i + 1], d[i + 2]), min = Math.min(d[i], d[i + 1], d[i + 2]);
        if (max > 235 && min > 225) continue; // wit randje
        if (max < 40) continue; // zwarte lijnen
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n++;
      }
      if (!n) return klaar(null);
      r /= n * 255;
      g /= n * 255;
      b /= n * 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
      let h = 0, s = 0;
      if (max !== min) {
        const dd = max - min;
        s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
        h = max === r ? (g - b) / dd + (g < b ? 6 : 0) : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
        h /= 6;
      }
      klaar({ h, s, l });
    };
    img.onerror = () => klaar(null);
    img.src = url;
  });
}

export class Leven {
  constructor({ wezens, beeld, snelheid = 1, opNieuws, opNieuweSoort, opBewaard }) {
    this.opBewaard = opBewaard || (() => {});
    this.wezens = wezens;
    this.beeld = beeld;
    this.snelheid = snelheid;
    this.opNieuws = opNieuws || (() => {});
    this.opNieuweSoort = opNieuweSoort || (() => {});
    this.bezigMetSoort = new Set();
    this.wie = null;
    this.w = null;
    this.regios = null;
    this.planeet = null;
    this.recept = null;
    this.bezig = false;
    this.timer = null;
    this.bewaarTimer = null;
    this.regioTimer = null;
    this.toevoegen = new Set();
    window.addEventListener('pagehide', () => this.bewaar());
  }

  get actief() {
    return !!(this.w && this.regios && !this.bezig);
  }

  // Een planeet openen: wereld laden, regio's uitlezen, de gemiste tijd inhalen.
  async open(wie, recept, planeet) {
    this.sluit();
    this.wie = wie;
    this.recept = recept;
    this.planeet = planeet;
    this.w = leesAlles()[wie] || null;
    this.leesRegios();
    let weg = null;
    if (this.w) {
      const nu = Date.now();
      const jaren = jarenTussen(this.w, this.w.laatst, nu) * this.snelheid;
      const jaarVoor = this.w.jaar;
      const minuten = (nu - this.w.laatst) / 60000;
      if (jaren > 1) {
        this.bezig = true;
        const res = await rekenOpAchtergrond(this.w, this.regios, jaren, nu);
        this.bezig = false;
        if (this.wie !== wie) return null; // intussen een andere speler gekozen
        this.w = res;
      }
      this.w.laatst = nu;
      this.snelKlaar(nu);
      const nieuws = this.w.kroniek.filter((e) => e.jaar > jaarVoor && e.belang >= 2);
      if (jaren >= 10) weg = { minuten, jaren, nieuws, jaarVoor };
      this.gezien = this.w.nr || 0;
    }
    await this.syncSoorten();
    await this.controleerNieuweSoorten();
    this.toon();
    this.timer = setInterval(() => this.tik(), 2000);
    this.bewaarTimer = setInterval(() => this.bewaar(), 15000);
    return weg;
  }

  sluit() {
    clearInterval(this.timer);
    clearInterval(this.bewaarTimer);
    clearTimeout(this.regioTimer);
    if (this.w && this.wie) this.bewaar();
    this.wie = null;
    this.w = null;
    this.regios = null;
    this.beeld.leeg();
  }

  bewaar() {
    if (!this.w || !this.wie || this.bezig) return;
    this.w.laatst = Date.now();
    // Oude spanningen tussen stammen die niet meer bestaan opruimen.
    const stammen = new Set(this.w.groepen.map((g) => g.stam));
    for (const k of Object.keys(this.w.spanning)) {
      const [a, b] = k.split('|');
      if (!stammen.has(a) || !stammen.has(b)) delete this.w.spanning[k];
    }
    const alles = leesAlles();
    alles[this.wie] = this.w;
    try {
      localStorage.setItem(OPSLAG, JSON.stringify(alles));
    } catch {}
    this.opBewaard(this.wie);
  }

  wis(wie) {
    const alles = leesAlles();
    delete alles[wie];
    try {
      localStorage.setItem(OPSLAG, JSON.stringify(alles));
    } catch {}
    if (this.wie === wie) this.w = null;
  }

  leesRegios() {
    if (!this.planeet || !this.planeet.geo) return;
    const { regios, planeet } = maakRegios(this.planeet);
    this.regios = regios;
    if (this.w) this.w.planeet = planeet;
    this.planeetInfo = planeet;
  }

  // De planeet is veranderd (water erbij, andere kleur...): opnieuw uitlezen, even wachten.
  planeetVeranderd(planeet, recept) {
    this.planeet = planeet;
    this.recept = recept;
    clearTimeout(this.regioTimer);
    this.regioTimer = setTimeout(() => {
      this.leesRegios();
      this.beeld.sleutel = '';
      this.toon();
    }, 1500);
  }

  // Wezens uit het recept toevoegen aan of verwijderen uit de wereld.
  async syncSoorten(recept = this.recept) {
    this.recept = recept;
    if (!recept || !this.regios) return;
    const lijst = recept.wezens || [];
    if (!lijst.length && !this.w) return;
    const nu = Date.now();
    if (!this.w) {
      this.w = nieuweWereld(recept.zaad, nu);
      this.w.planeet = this.planeetInfo;
      this.gezien = 0;
    }
    // Het allereerste wezen op deze planeet: het eerste halfuur gaat de tijd supersnel.
    if (lijst.length && !this.w.snelVan && !Object.keys(this.w.soorten).length && this.w.jaar < 5) {
      this.w.snelVan = nu;
      meld(this.w, 3, '⏩', 'In het begin gaat de tijd supersnel, anders duurt het zo lang! Kijk maar wat je wezens gaan doen.', nu);
    }
    const ids = new Set(lijst.map((x) => x.id));
    // Een soort die net vanzelf is ontstaan staat nog niet in de lijst: die niet weghalen.
    for (const [id, s] of Object.entries(this.w.soorten)) if (!ids.has(id) && !s.nieuw) vertrekSoort(this.w, id);
    for (const wezen of lijst) {
      if (this.w.soorten[wezen.id] || this.toevoegen.has(wezen.id)) continue;
      if (terugSoort(this.w, wezen.id)) continue; // terug met de oeps-knop
      this.toevoegen.add(wezen.id);
      const kleur = await kleurVan(wezen.plaatje);
      this.toevoegen.delete(wezen.id);
      if (!this.w || this.w.soorten[wezen.id]) continue;
      voegSoortToe(this.w, { ...wezen, kleur }, this.regios, nu);
    }
    this.meldNieuws();
    this.toon();
    this.bewaar();
  }

  tik() {
    if (!this.actief) return;
    const nu = Date.now();
    const jaren = jarenTussen(this.w, this.w.laatst, nu) * this.snelheid;
    this.w.laatst = nu;
    if (jaren <= 0) return;
    if (jaren < 40) stap(this.w, this.regios, jaren, nu);
    else inhalen(this.w, this.regios, jaren, nu);
    this.snelKlaar(nu);
    this.meldNieuws();
    this.toon();
  }

  // Het snelle begin is voorbij: dat zeggen, anders lijkt het alsof het spel kapot is.
  snelKlaar(nu) {
    if (!this.w || !this.w.snelVan || this.w.snelKlaar || snelBezig(this.w, nu)) return;
    this.w.snelKlaar = 1;
    meld(this.w, 2, '⏳', 'Het snelle begin is voorbij. Nu gaat de tijd gewoon verder: elke minuut een jaar.', nu);
  }

  // Nieuwe soorten (kruising of afsplitsing) krijgen een plaatje en komen in de lijst van het kind.
  async controleerNieuweSoorten() {
    if (!this.w || !this.recept) return;
    const wie = this.wie;
    for (const s of Object.values(this.w.soorten)) {
      if (!s.nieuw || this.bezigMetSoort.has(s.id)) continue;
      if ((this.recept.wezens || []).some((x) => x.id === s.id)) {
        s.nieuw = false;
        continue;
      }
      this.bezigMetSoort.add(s.id);
      try {
        await this.opNieuweSoort(s);
        if (this.wie === wie && this.w.soorten[s.id]) s.nieuw = false;
      } finally {
        this.bezigMetSoort.delete(s.id);
      }
    }
  }

  meldNieuws() {
    if (!this.w) return;
    this.controleerNieuweSoorten();
    const nieuw = this.w.kroniek.filter((e) => (e.nr || 0) > (this.gezien || 0));
    this.gezien = this.w.nr || 0;
    if (nieuw.length) this.opNieuws(nieuw);
  }

  // Wezens en gebouwen gelijk zetten met de wereld.
  toon() {
    if (!this.w || !this.regios) return;
    const totalen = {};
    for (const s of Object.values(this.w.soorten)) totalen[s.id] = soortInfo(this.w, s.id);
    // Hoeveel wezens in beeld: in het begin precies, later een paar meer naarmate het er veel worden.
    const wensen = Object.fromEntries(
      Object.entries(totalen).map(([id, i]) => {
        const t = i.totaal;
        const n = t < 0.5 ? 0 : t <= 12 ? Math.max(1, Math.round(t)) : Math.min(40, 12 + Math.round(Math.log2(t / 12) * 5));
        return [id, n];
      })
    );
    const som = Object.values(wensen).reduce((a, b) => a + b, 0);
    const factor = som > MAX_ZICHTBAAR ? MAX_ZICHTBAAR / som : 1;
    for (const [id, i] of Object.entries(totalen)) {
      const thuizen = i.groepen
        .filter((g) => g.pop >= 0.5 && this.regios[g.regio])
        .sort((a, b) => b.pop - a.pop)
        .slice(0, 8)
        .map((g) => ({ id: g.regio, dir: this.regios[g.regio].dir, gewicht: g.pop }));
      this.wezens.stelLeven(id, {
        aantal: Math.floor(wensen[id] * factor),
        thuizen,
        schaal: i.soort.genen.grootte,
        amfibie: i.soort.beweging === 'zwemmen' && i.soort.genen.land >= 0.5,
      });
    }
    if (this.planeet && this.recept) this.beeld.zet(this.w, this.regios, this.planeet, this.recept);
  }

  info(id) {
    return this.w ? soortInfo(this.w, id) : null;
  }

  meters(id) {
    return this.w && this.regios ? meters(this.w, this.regios, id) : null;
  }

  // Het kind heeft een wezen aangepast: naam en kleur ook in de wereld bijwerken.
  async pasAan(wezen) {
    const s = this.w && this.w.soorten[wezen.id];
    if (!s) return;
    s.naam = wezen.naam;
    s.kleur = (await kleurVan(wezen.plaatje)) || s.kleur;
    this.beeld.sleutel = '';
    this.bewaar();
  }

  // Het klimaat van nu (droogte, ijstijd...). Zonder leven: gewoon rustig.
  klimaat() {
    return (this.w && this.w.klimaat) || { fase: 'gewoon', temp: 0, nat: 1, ijs: 0, vervuiling: 0 };
  }

  stormKans(recept) {
    if (this.w && this.w.planeet) return stormKans(this.w);
    return (recept.wolken || 0) * (recept.onweer ? 1.8 : 0.6);
  }
}

// Gemiste tijd inhalen op de achtergrond, zodat het scherm blijft bewegen.
function rekenOpAchtergrond(wereld, regios, jaren, nu) {
  return new Promise((klaar) => {
    const werker = new Worker(new URL('./werker.js', import.meta.url), { type: 'module' });
    werker.onmessage = (e) => {
      werker.terminate();
      klaar(e.data.wereld);
    };
    werker.onerror = () => {
      werker.terminate();
      inhalen(wereld, regios, jaren, nu);
      klaar(wereld);
    };
    werker.postMessage({ wereld, regios, jaren, nu });
  });
}
