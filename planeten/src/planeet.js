// De planeetmotor. Een planeet wordt gebouwd uit een recept (de keuzes van een kind).
// stel(recept) werkt alleen bij wat echt veranderd is, zodat een schuif of de giet-knop
// meteen te zien is zonder de hele wereld opnieuw uit te rekenen.
//
// Twee kwaliteiten: 'snel' tijdens het bouwen (alles reageert meteen) en 'hoog' als de planeet
// klaar is (vier keer zoveel detail, meer bomen, scherpere wolken).

import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { maakRuis, maakRandom } from './ruis.js';
import { velden } from './velden.js';
import { Begroeiing } from './begroeiing.js';

const KWALITEIT = {
  snel: { N: 128, bomen: 7000, wolkB: 1024, wolkH: 512 },
  hoog: { N: 256, bomen: 20000, wolkB: 2048, wolkH: 1024 },
};

// Een kale, grijze rots: zo begint elke nieuwe planeet.
export const KAAL = {
  naam: '',
  zaad: 'start',
  grootte: 1,
  bergen: 0.4,
  ruwheid: 0.45,
  kraters: 0.25,
  zee: 0,
  waterKleur: '#1f6fd1',
  zeeGloeit: false,
  grond: { strand: '#8d8a86', laag: '#77736f', midden: '#625e5a', hoog: '#8a8580', top: '#b5b0aa' },
  ijskappen: 0,
  lucht: '#9aa7c0',
  wolken: 0,
  wolkKleur: '#ffffff',
  onweer: false,
  bomen: 0,
  boomVorm: 'den', // oude planeten: één soort boom
  boomVormen: null, // nieuw: een mix, bijvoorbeeld ['den', 'paddenstoel']
  boomKleur: '#2e8b3a',
  paddenstoelKleur: null, // null = rood met witte stippen

  temperatuur: 0.5, // 0 = ijskoud, 1 = gloeiend heet
  seizoenen: 0.3, // 0 = altijd hetzelfde, 1 = hele strenge winters en hete zomers
  woestijn: 0.2, // hoeveel droge gebieden
  ring: null,
  manen: [],
  penseel: [], // boetseer- en verfstreken: {t:'h'|'v'|'g', x,y,z, r, a?, k?, n}
};

export function vulAan(recept) {
  return { ...KAAL, ...recept, grond: { ...KAAL.grond, ...(recept.grond || {}) } };
}

// Alleen de velden die het uiterlijk bepalen (voor het vergelijken van versies).
export function uiterlijk(recept) {
  const { naam, _gebruikt, klaar, wezens, ...rest } = vulAan(recept);
  return JSON.stringify(rest);
}

// ---------- Rekenhulp op de achtergrond ----------
let werker = null, volgnummer = 0;
const wachtend = new Map();
function startWerker() {
  werker = new Worker(new URL('./werker.js', import.meta.url), { type: 'module' });
  werker.onmessage = (e) => {
    const w = wachtend.get(e.data.id);
    wachtend.delete(e.data.id);
    if (w) w.klaar(e.data);
  };
  // Valt de rekenhulp om (bijvoorbeeld te weinig geheugen op de tablet), dan een nieuwe starten
  // en het werk nog één keer proberen, in plaats van voor altijd te blijven wachten.
  werker.onerror = (e) => {
    e.preventDefault?.();
    werker.terminate();
    werker = null;
    const opnieuw = [...wachtend.entries()];
    for (const [id, w] of opnieuw) {
      if (w.poging >= 1) {
        wachtend.delete(id);
        w.mis(new Error('rekenen mislukt'));
      }
    }
    if (wachtend.size) {
      startWerker();
      for (const [id, w] of wachtend) {
        w.poging++;
        werker.postMessage({ ...w.bericht, id });
      }
    }
  };
}
function reken(bericht) {
  if (!werker) startWerker();
  const id = ++volgnummer;
  return new Promise((klaar, mis) => {
    wachtend.set(id, { klaar, mis, bericht, poging: 0 });
    werker.postMessage({ ...bericht, id });
  });
}

// ---------- Details als je inzoomt ----------
// Van ver zie je kleuren; dichtbij komt er structuur bij: grassprieten en bloemetjes, ribbels in
// het zand, scheuren in de rotsen, glinsters in de sneeuw. Alles uitgerekend in de grafische
// chip (geen plaatjes nodig) en met een beetje reliëf in het licht. Langs de kust nat zand en
// schuim. Ver weg valt het detail weg, anders gaat het flikkeren.
const GROND_DETAIL_PARS = `
uniform float uTijd;
uniform float uZee;
uniform float uSchaal;
varying vec3 vBodem;
varying vec3 vPos;
float gDetailH = 0.0;
float gDichtbij = 0.0;
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float ruis3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;
const GROND_DETAIL_KLEUR = `
{
  float afst = length(vViewPosition) / uSchaal;
  gDichtbij = 1.0 - smoothstep(0.035, 0.42, afst);
  vec3 p = vPos;
  if (gDichtbij > 0.001) { // ver weg: niets uitrekenen (scheelt veel op een tablet)
  float n1 = ruis3(p * 140.0);
  float n2 = ruis3(p * 900.0);
  float n3 = ruis3(p * 2600.0);
  vec3 basis = diffuseColor.rgb;
  // Gras: plukjes en sprieten, hier en daar een bloemetje.
  float hG = n1 * 0.5 + n2 * 0.55 + n3 * 0.35;
  vec3 cG = basis * (0.7 + 0.55 * n2 + 0.2 * (n1 - 0.5));
  float bloem = step(0.972, ruis3(p * 650.0 + 7.3)) * step(0.45, n1);
  vec3 bloemKleur = mix(vec3(1.0, 0.93, 0.45), vec3(1.0, 0.7, 0.85), step(0.5, ruis3(p * 230.0)));
  cG = mix(cG, bloemKleur, bloem * 0.9);
  // Zand: ribbels van de wind en losse korrels.
  float rib = sin(dot(p, vec3(0.7, 0.2, 0.68)) * 1500.0 + n1 * 10.0) * 0.5 + 0.5;
  float hZ = rib * 0.7 + n3 * 0.3;
  vec3 cZ = basis * (0.86 + 0.2 * rib + 0.16 * (n3 - 0.5));
  // Rots: scheuren en vlekken.
  float scheur = pow(1.0 - abs(ruis3(p * 320.0) * 2.0 - 1.0), 7.0);
  float hR = n1 * 0.8 + n2 * 0.5 - scheur * 0.9;
  vec3 cR = basis * (0.78 + 0.4 * n1) * (1.0 - scheur * 0.55);
  // Sneeuw en ijs: zacht, met glinsters.
  float hS = n1 * 0.35 + n2 * 0.1;
  vec3 cS = basis * (0.94 + 0.08 * n2) + step(0.985, n3) * 0.7;
  vec3 w = vec3(vBodem.x, vBodem.y, max(vBodem.z, sneeuw));
  float wg = max(0.0, 1.0 - w.x - w.y - w.z);
  float som = max(1.0, w.x + w.y + w.z + wg);
  vec3 det = (cG * wg + cZ * w.x + cR * w.y + cS * w.z) / som;
  gDetailH = (hG * wg + hZ * w.x + hR * w.y + hS * w.z) / som;
  diffuseColor.rgb = mix(basis, det, gDichtbij);
  }
  // Kust: net boven het water nat (donker) zand, net eronder schuim dat heen en weer spoelt.
  if (uZee > 0.0) {
    float r = length(vPos);
    float boven = r - uZee;
    diffuseColor.rgb *= 1.0 - 0.28 * smoothstep(0.0012, 0.0, boven) * step(0.0, boven);
    float golf = sin(uTijd * 1.3 + ruis3(p * 60.0) * 6.0) * 0.0004;
    float band = smoothstep(-0.0026, -0.0006, boven + golf) * step(boven, 0.0);
    float schuim = band * smoothstep(0.35, 0.75, ruis3(p * 420.0 + vec3(uTijd * 0.25)));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.98, 1.0), schuim * (0.45 + 0.5 * gDichtbij));
  }
}`;
const GROND_DETAIL_NORMAAL = `
{
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
  vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
  float det = dot(sx, r1);
  float h = gDetailH * 0.00035 * uSchaal * gDichtbij;
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  normal = normalize(abs(det) * normal - grad);
}`;

const kleur = (hex) => new THREE.Color(hex);
export const PADDENSTOEL_ROOD = '#d8281e';
const glad = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const zelfde = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export class Planeet {
  static async maak(recept, kwaliteit = 'snel') {
    const p = new Planeet(kwaliteit);
    await p.stel(recept);
    return p;
  }

  constructor(kwaliteit) {
    this.kwaliteit = kwaliteit;
    this.k = KWALITEIT[kwaliteit];
    this.groep = new THREE.Group();
    this.r = null;
    this.manen = [];
    this.uit = [0, 0, 0];
    this.wind = { uWind: { value: 0 } };
    this.begroeiing = null;
  }

  // Elk beeldje: kijk je van dichtbij, dan groeit er begroeiing rond die plek (zie begroeiing.js).
  detail(camera) {
    if (!this.geo || !this.r || !this.geo.attributes.bodem) return;
    if (!this.begroeiing) {
      this.begroeiing = new Begroeiing(this, this.wind);
      this.groep.add(this.begroeiing.groep);
    }
    this.groep.updateWorldMatrix(true, false);
    const lok = this.groep.worldToLocal(camera.position.clone());
    this.begroeiing.bij(lok);
    // Dichtbij: de dampkring en de wolken worden doorzichtig, zodat je de grond goed ziet.
    // Van ver blijft de planeet mooi blauw omrand.
    const h = lok.length();
    const glad = (a, b, x) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    if (this.waas) this.waas.material.uniforms.sterkte.value = glad(1.12, 1.9, h);
    if (this.lucht) this.lucht.material.uniforms.sterkte.value = glad(1.06, 1.5, h);
    if (this.wolken) this.wolken.material.opacity = 0.2 + 0.8 * glad(1.06, 1.45, h);
  }

  // ---------- Recept toepassen ----------
  async stel(invoer) {
    const r = vulAan(invoer);
    const oud = this.r;
    this.r = r;
    const veranderd = (...velden) => !oud || velden.some((v) => !zelfde(oud[v], r[v]));

    this.groep.scale.setScalar(r.grootte);
    if (this.seizoen) this.seizoen.uSchaal.value = r.grootte;

    let vorm = false;
    if (veranderd('zaad', 'ruwheid')) {
      await this.maakBasis();
      vorm = true;
    }
    if (veranderd('zaad', 'kraters') || vorm) {
      this.maakKraters();
      vorm = true;
    }
    if (veranderd('penseel') || vorm) {
      const nieuw = r.penseel || [];
      const vorig = (oud && oud.penseel) || [];
      const verlengd = oud && !vorm && nieuw.length >= vorig.length && zelfde(nieuw.slice(0, vorig.length), vorig);
      if (verlengd) for (let i = vorig.length; i < nieuw.length; i++) this.penseelStreek(nieuw[i]);
      else {
        this.wisPenseel();
        for (const p of nieuw) this.penseelStreek(p);
      }
      vorm = true;
    }
    if (vorm || veranderd('bergen')) this.maakHoogtes();
    const klimaat = ['temperatuur', 'woestijn', 'wolken'];
    if (vorm || veranderd('bergen', 'zee', 'grond', 'ijskappen', 'waterKleur', ...klimaat)) this.maakVorm();
    if (vorm || veranderd('bergen', 'zee', 'waterKleur', 'zeeGloeit')) this.maakZee();
    if (vorm || veranderd('bergen', 'zee', 'ijskappen', 'bomen', 'boomVorm', 'boomVormen', 'boomKleur', 'paddenstoelKleur', ...klimaat)) this.maakBomen();
    if (veranderd('zaad', 'wolkKleur', 'bergen')) await this.maakWolken();
    else if (veranderd('wolken') && !this.weerNu) this.zetWeer({ dekking: r.wolken, stormen: [] });
    if (veranderd('seizoenen') && this.seizoen) this.seizoen.uSterkte.value = r.seizoenen;
    if (veranderd('lucht', 'bergen')) this.maakLucht();
    if (veranderd('ring')) this.maakRing();
    if (veranderd('manen', 'zaad')) this.maakManen();
    if (this.begroeiing) this.begroeiing.vuil = true; // er kan iets veranderd zijn op de grond
  }

  // Ruisvelden die alleen van het zaadje en de ruwheid afhangen (het dure deel, op de achtergrond).
  async maakBasis() {
    const r = this.r;
    this.ruis = maakRuis(r.zaad);
    const res = await reken({ soort: 'basis', N: this.k.N, zaad: r.zaad, ruwheid: r.ruwheid });
    if (!this.geo) {
      const n = (this.n = res.dirs.length / 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('warmte', new THREE.BufferAttribute(new Float32Array(n), 1));
      g.setAttribute('bodem', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); // zand, rots, sneeuw (de rest is gras)
      g.setIndex(new THREE.BufferAttribute(res.index, 1));
      this.geo = g;
      this.dirs = res.dirs;
      this.krater = new Float32Array(n);
      this.deltaH = new Float32Array(n);
      this.verf = new Float32Array(n * 3);
      this.verfW = new Float32Array(n);
      this.rad = new Float32Array(n);
      this.warmte = g.attributes.warmte.array; // gemiddelde warmte per punt (0 koud, 1 heet)
      this.bioom = new Uint8Array(n); // 0 gewoon, 1 ijs, 2 toendra, 3 woestijn, 4 oerwoud, 5 zee
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
      // Seizoenen: de sneeuwgrens schuift heen en weer; winter in het noorden = zomer in het zuiden.
      this.seizoen = { uSeizoen: { value: 0 }, uSterkte: { value: 0 }, uTijd: { value: 0 }, uZee: { value: 0 }, uSchaal: { value: 1 } };
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, this.seizoen);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float warmte;\nattribute vec3 bodem;\nvarying float vWarmte;\nvarying float vNoord;\nvarying vec3 vBodem;\nvarying vec3 vPos;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWarmte = warmte;\nvNoord = normalize(position).y;\nvBodem = bodem;\nvPos = position;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\nuniform float uSeizoen;\nuniform float uSterkte;\nvarying float vWarmte;\nvarying float vNoord;\n${GROND_DETAIL_PARS}`)
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            float koude = uSterkte * 0.32 * uSeizoen * sign(vNoord) * (0.25 + abs(vNoord));
            float sneeuw = smoothstep(0.2, 0.1, vWarmte - koude) * step(0.001, vWarmte);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0), sneeuw * 0.92);
            ${GROND_DETAIL_KLEUR}`
          )
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${GROND_DETAIL_NORMAAL}`);
      };
      this.grond = new THREE.Mesh(g, mat);
      this.groep.add(this.grond);
      this.seizoen.uSchaal.value = this.r.grootte;
    }
    this.cont = res.cont;
    this.kam = res.kam;
    this.fijn = res.fijn;
    this.wiebel = res.wiebel;
    this.vocht = res.vocht;
    this.boomPlekken = null;
    this.wolkVeld = null;
  }

  maakKraters() {
    const rnd = maakRandom(this.r.zaad + '-kraters');
    this.kraterLijst = [];
    const aantal = Math.round(this.r.kraters * 60);
    for (let i = 0; i < aantal; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
      const straal = 0.04 + rnd() ** 2 * 0.22;
      this.kraterLijst.push({ v, straal, diepte: 0.4 + rnd() * 0.6, cos: Math.cos(straal * 1.4) });
    }
    const d = this.dirs;
    this.krater.fill(0);
    for (const k of this.kraterLijst) {
      for (let i = 0; i < this.n; i++) {
        const dot = d[i * 3] * k.v.x + d[i * 3 + 1] * k.v.y + d[i * 3 + 2] * k.v.z;
        if (dot > k.cos) this.krater[i] += kraterVorm(k, dot);
      }
    }
  }

  kraterOp(x, y, z) {
    let h = 0;
    for (const k of this.kraterLijst) {
      const dot = x * k.v.x + y * k.v.y + z * k.v.z;
      if (dot > k.cos) h += kraterVorm(k, dot);
    }
    return h;
  }

  // ---------- Boetseren en verven ----------
  wisPenseel() {
    this.deltaH.fill(0);
    this.verfW.fill(0);
  }

  penseelStreek(p) {
    const d = this.dirs, cosLim = Math.cos(p.r);
    const pk = p.k ? kleur(p.k) : null;
    for (let i = 0; i < this.n; i++) {
      const dot = d[i * 3] * p.x + d[i * 3 + 1] * p.y + d[i * 3 + 2] * p.z;
      if (dot <= cosLim) continue;
      const q = Math.acos(Math.min(1, dot)) / p.r;
      const f = (1 - q * q) ** 2;
      if (p.t === 'h') this.deltaH[i] += p.a * f;
      else if (p.t === 'g') this.verfW[i] = Math.max(0, this.verfW[i] - f);
      else {
        const w = this.verfW[i];
        const mix = w > 0 ? Math.min(1, f * 1.5) : 1;
        this.verf[i * 3] += (pk.r - this.verf[i * 3]) * mix;
        this.verf[i * 3 + 1] += (pk.g - this.verf[i * 3 + 1]) * mix;
        this.verf[i * 3 + 2] += (pk.b - this.verf[i * 3 + 2]) * mix;
        this.verfW[i] = Math.min(1, w + f * 1.2);
      }
    }
  }

  // ---------- Hoogte naar straal ----------
  get amp() {
    return 0.025 + this.r.bergen * 0.075;
  }

  basisH(i) {
    return this.cont[i] * 0.75 + this.kam[i] * (0.2 + this.r.bergen * 1.1) + this.fijn[i] + this.krater[i];
  }

  straalVoor(h) {
    const t = (h - this.lo) / (this.hi - this.lo);
    const amp = this.amp;
    if (t < 0) return 1 + amp * (t - 0.35);
    return 1 + amp * (Math.pow(Math.min(t, 2.2), 1.5) - 0.35);
  }

  maakHoogtes() {
    let lo = Infinity, hi = -Infinity;
    const basis = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const b = (basis[i] = this.basisH(i));
      if (b < lo) lo = b;
      if (b > hi) hi = b;
    }
    this.lo = lo;
    this.hi = hi;
    // Zeespiegel per percentage, op de basisvorm. Zo blijft de zee stil liggen tijdens het boetseren.
    this.radGesorteerd = basis.map((b) => this.straalVoor(b)).sort();
    this.maxR = this.straalVoor(hi);
  }

  get zeeR() {
    const z = this.r.zee;
    if (z <= 0) return 0;
    if (z >= 1) return this.maxR + 0.003;
    return this.radGesorteerd[Math.floor(z * (this.n - 1))] + 0.0005;
  }

  maakVorm() {
    const r = this.r, n = this.n, d = this.dirs;
    const pos = this.geo.attributes.position;
    const col = this.geo.attributes.color;
    const zeeR = this.zeeR;

    // Eerst de vorm, dan de normalen: die zijn nodig om steile hellingen rotsachtig te kleuren.
    for (let i = 0; i < n; i++) {
      const s = (this.rad[i] = this.straalVoor(this.basisH(i) + this.deltaH[i]));
      pos.setXYZ(i, d[i * 3] * s, d[i * 3 + 1] * s, d[i * 3 + 2] * s);
    }
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    const nrm = this.geo.attributes.normal.array;

    const g = r.grond;
    const banden = [
      [0.0, kleur(g.strand)],
      [0.06, kleur(g.laag)],
      [0.38, kleur(g.midden)],
      [0.68, kleur(g.hoog)],
      [0.9, kleur(g.top)],
    ];
    const rots = kleur(g.hoog).lerp(kleur(g.midden), 0.3).multiplyScalar(0.8);
    const water = kleur(r.waterKleur);
    const ondiep = water.clone().lerp(kleur(g.strand), 0.45);
    const bodemDiep = water.clone().multiplyScalar(0.12);
    const ijs = kleur(g.top).lerp(kleur('#ffffff'), 0.6);
    const verf = new THREE.Color();
    const c = new THREE.Color();
    const minR = this.radGesorteerd[0];
    const basis = zeeR || minR;
    // Klimaatzones, zoals op aarde: uit warmte en vocht ontstaan woestijn, toendra, ijs en oerwoud.
    // Ze kleuren met de kleuren van het thema mee, zodat een snoepwereld een snoepwereld blijft.
    const zand = kleur(g.strand).lerp(kleur('#d9b97a'), 0.35);
    const toendra = kleur(g.hoog).lerp(kleur('#c9cfc4'), 0.5);
    const jungle = kleur(g.laag).lerp(kleur(g.midden), 0.6).multiplyScalar(0.72);
    const temp0 = 0.5 + (r.temperatuur - 0.5) * 0.9;
    const nat0 = 0.5 + (r.wolken - 0.5) * 0.45 - r.woestijn * 0.55;
    const vocht = this.vocht || new Float32Array(n);
    // Wat voor bodem: zand, rots of sneeuw (de rest is begroeid). Voor de details als je inzoomt.
    const bodem = this.geo.attributes.bodem;
    const kaal = r.bomen <= 0 && !r.zee && r.penseel.every((p) => p.t !== 'v') && r.grond.laag === KAAL.grond.laag;

    for (let i = 0; i < n; i++) {
      const x = d[i * 3], y = d[i * 3 + 1], z = d[i * 3 + 2];
      const s = this.rad[i];
      const wiebel = this.wiebel[i];
      let wZand = 0, wRots = kaal ? 1 : 0, wSneeuw = 0;
      if (zeeR > 0 && s < zeeR) {
        // Ondiep water licht, diep water donker: geeft de kustlijn een mooie lagune-rand.
        c.copy(ondiep).lerp(bodemDiep, glad(0, 0.35, (zeeR - s) / Math.max(1e-4, zeeR - minR)));
        this.warmte[i] = 0;
        this.bioom[i] = 5;
        wZand = 1; // zeebodem: zand
        wRots = 0;
      } else {
        const t = (s - basis) / Math.max(1e-4, this.maxR - basis) + wiebel;
        let k = 0;
        while (k < banden.length - 1 && t > banden[k + 1][0]) k++;
        if (k === banden.length - 1) c.copy(banden[k][1]);
        else {
          const [a, ca] = banden[k], [b, cb] = banden[k + 1];
          c.copy(ca).lerp(cb, glad(a + (b - a) * 0.6, b, t));
        }
        // Warm bij de evenaar, koud bij de polen en hoog in de bergen.
        const warm = Math.max(0.002, Math.min(1, temp0 - Math.pow(Math.abs(y), 1.6) * 0.55 - Math.max(0, t) * 0.35 + wiebel));
        const nat = nat0 + vocht[i] * 0.9;
        this.warmte[i] = warm;
        let bioom = 0;
        if (t < 0.62) {
          const woest = glad(0.4, 0.5, warm) * glad(0.36, 0.26, nat);
          const oer = glad(0.6, 0.7, warm) * glad(0.62, 0.74, nat);
          const toe = glad(0.27, 0.18, warm);
          if (woest > 0.01) c.lerp(zand, woest);
          if (oer > 0.01) c.lerp(jungle, oer);
          if (toe > 0.01) c.lerp(toendra, toe * 0.7);
          bioom = woest > 0.5 ? 3 : oer > 0.5 ? 4 : toe > 0.5 ? 2 : 0;
          wZand = Math.max(wZand, woest);
        }
        // Zo koud dat het altijd bevroren is.
        const vries = glad(0.12, 0.05, warm);
        if (vries > 0.01) c.lerp(ijs, vries);
        if (vries > 0.5) bioom = 1;
        this.bioom[i] = bioom;
        // Steile hellingen worden kale rots.
        const steil = 1 - (nrm[i * 3] * x + nrm[i * 3 + 1] * y + nrm[i * 3 + 2] * z);
        if (t > 0.03 && t < 0.88) c.lerp(rots, glad(0.06, 0.2, steil) * 0.75);
        // Strand vlak bij het water, rots hoog en steil, sneeuw waar het bevroren is.
        if (zeeR > 0) wZand = Math.max(wZand, glad(0.07, 0.02, t));
        wRots = Math.max(wRots, glad(0.06, 0.2, steil) * 0.8, glad(0.6, 0.8, t));
        wSneeuw = Math.max(vries, glad(0.85, 0.95, t));
      }
      if (r.ijskappen > 0) {
        const pool = Math.abs(y) + wiebel * 1.6;
        const grens = 1 - r.ijskappen * 0.6;
        if (pool > grens) {
          const f = glad(grens, grens + 0.04, pool);
          c.lerp(ijs, f);
          if (f > 0.5 && this.bioom[i] !== 5) {
            this.bioom[i] = 1;
            this.warmte[i] = Math.min(this.warmte[i], 0.08);
          }
          if (this.bioom[i] !== 5) wSneeuw = Math.max(wSneeuw, f);
        }
      }
      // Zo samen nooit meer dan 1; wat overblijft is gras.
      const som = wZand + wRots + wSneeuw;
      if (som > 1) {
        wZand /= som;
        wRots /= som;
        wSneeuw /= som;
      }
      bodem.setXYZ(i, wZand, wRots, wSneeuw);
      const w = this.verfW[i];
      if (w > 0) {
        verf.setRGB(this.verf[i * 3], this.verf[i * 3 + 1], this.verf[i * 3 + 2]);
        c.lerp(verf, Math.min(1, w));
      }
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    bodem.needsUpdate = true;
    this.geo.attributes.warmte.needsUpdate = true;
    this.seizoen.uZee.value = zeeR;
    this.seizoen.uSterkte.value = r.seizoenen;
  }

  // ---------- Zee ----------
  maakZee() {
    const r = this.r;
    if (!this.zee) {
      const fijn = this.kwaliteit === 'hoog';
      this.golven = golfTextuur();
      this.zee = new THREE.Mesh(
        new THREE.SphereGeometry(1, fijn ? 256 : 128, fijn ? 128 : 64),
        new THREE.MeshPhysicalMaterial({
          roughness: 0.12,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          normalMap: this.golven,
          normalScale: new THREE.Vector2(0.35, 0.35),
          transparent: true,
        })
      );
      // Dichtbij: kleine golfjes bovenop de grote, die de andere kant op trekken. Zo glinstert
      // het water als je inzoomt, en lijkt het van ver nog steeds rustig.
      this.water = { uTijd: { value: 0 }, uSchaal: { value: 1 } };
      this.zee.material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, this.water);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uTijd;\nuniform float uSchaal;')
          .replace(
            'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
            `vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
            float dichtbij = 1.0 - smoothstep(0.04, 0.5, length(vViewPosition) / uSchaal);
            vec3 klein = texture2D( normalMap, vNormalMapUv * vec2(14.0, 9.0) + vec2(-uTijd * 0.012, uTijd * 0.008) ).xyz * 2.0 - 1.0;
            vec3 kleinst = texture2D( normalMap, vNormalMapUv * vec2(41.0, 27.0) + vec2(uTijd * 0.02, uTijd * 0.015) ).xyz * 2.0 - 1.0;
            mapN.xy += (klein.xy * 0.9 + kleinst.xy * 0.5) * dichtbij;`
          );
      };
      this.groep.add(this.zee);
    }
    this.water.uSchaal.value = r.grootte;
    const zeeR = this.zeeR;
    this.zee.visible = zeeR > 0;
    this.zee.scale.setScalar(Math.max(zeeR, 0.01));
    const m = this.zee.material;
    m.color.set(r.waterKleur);
    m.emissive.set(r.zeeGloeit ? r.waterKleur : '#000000');
    m.emissiveIntensity = r.zeeGloeit ? 1.6 : 0;
    m.opacity = r.zeeGloeit ? 0.96 : 0.78;
    m.roughness = r.zeeGloeit ? 0.55 : 0.12;
    m.clearcoat = r.zeeGloeit ? 0.2 : 1;
  }

  // ---------- Bomen ----------
  maakBoomPlekken() {
    const rnd = maakRandom(this.r.zaad + '-bomen');
    const max = this.k.bomen;
    const plekken = [];
    for (let k = 0; k < max * 2 && plekken.length < max; k++) {
      const i = Math.floor(rnd() * this.n);
      const d = this.dirs;
      const x = d[i * 3], y = d[i * 3 + 1], z = d[i * 3 + 2];
      // Bossen in plukjes, niet overal even dicht (behalve in het oerwoud, zie maakBomen).
      const inBos = this.ruis.lagen(x, y, z, 3, 3) >= 0.02;
      plekken.push({ i, inBos, sc: 0.6 + rnd() * 0.9, sy: 0.8 + rnd() * 0.6, tint: (rnd() - 0.5) * 0.15, draai: rnd() * Math.PI * 2 });
    }
    // Door elkaar, zodat een lage stand al over de hele planeet bomen geeft.
    for (let k = plekken.length - 1; k > 0; k--) {
      const j = Math.floor(rnd() * (k + 1));
      [plekken[k], plekken[j]] = [plekken[j], plekken[k]];
    }
    this.boomPlekken = plekken;
  }

  // Een bos is een mix: elke gekozen boomsoort groeit waar hij het beste past. Dennen in de kou,
  // palmen in de warmte, paddenstoelen waar het nat is. In woestijn en ijs groeit niets,
  // op de toendra maar een beetje, in het oerwoud juist extra veel.
  maakBomen() {
    const r = this.r;
    const max = this.k.bomen;
    if (!this.boomPlekken) this.maakBoomPlekken();
    const vormen = r.boomVormen && r.boomVormen.length ? r.boomVormen : [r.boomVorm];
    const sleutel = vormen.join(',');
    if (!this.bomen || this.bomenSleutel !== sleutel) {
      for (const [stam, kroon] of this.bomen ? this.bomen.values() : []) {
        for (const m of [stam, kroon]) {
          this.groep.remove(m);
          m.geometry.dispose();
          m.material.dispose();
        }
      }
      this.bomen = new Map();
      // Bomen wiegen zachtjes in de wind: hoe hoger in de boom, hoe meer. Elke boom een eigen ritme.
      const wiegen = (mat) => {
        mat.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, this.wind);
          shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vec3 boomPlek = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            float buig = transformed.y * transformed.y * 900.0;
            float fase = uWind * 1.6 + dot(boomPlek, vec3(310.0, 230.0, 170.0));
            transformed.x += sin(fase) * buig * 0.0045;
            transformed.z += cos(fase * 0.77) * buig * 0.003;`
          );
        };
        return mat;
      };
      for (const vorm of vormen) {
        const [stamGeo, kroonGeo, stamKleur] = boomVormen(vorm);
        const stam = new THREE.InstancedMesh(stamGeo, wiegen(new THREE.MeshStandardMaterial({ color: stamKleur, roughness: 0.9 })), max);
        const kristal = vorm === 'kristal';
        const kroon = new THREE.InstancedMesh(
          kroonGeo,
          wiegen(new THREE.MeshStandardMaterial({
            color: '#ffffff',
            vertexColors: true,
            side: vorm === 'palm' ? THREE.DoubleSide : THREE.FrontSide,
            roughness: kristal ? 0.2 : 0.85,
            metalness: kristal ? 0.3 : 0,
            emissive: kristal ? '#222222' : '#000000',
          })),
          max
        );
        this.bomen.set(vorm, [stam, kroon]);
        this.groep.add(stam, kroon);
      }
      this.bomenSleutel = sleutel;
    }
    const tellers = new Map(vormen.map((v) => [v, 0]));
    // Wat past waar? (warmte 0..1, vocht ongeveer -0.5..0.5)
    const past = {
      den: (w, n) => 1.2 - w * 1.2,
      bol: (w, n) => 1 - Math.abs(w - 0.5) * 1.5,
      palm: (w, n) => w * 1.5 - 0.3,
      paddenstoel: (w, n) => 0.4 + n * 1.5,
      kristal: () => 0.5,
    };
    // Ongeveer de helft van de plekken ligt buiten de bosplukjes, vandaar iets meer proberen.
    const aantal = Math.min(this.boomPlekken.length, Math.round(r.bomen * max * 1.6));
    const zeeR = this.zeeR, minR = this.radGesorteerd[0];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), nv = new THREE.Vector3();
    const schaal = new THREE.Vector3(), omhoog = new THREE.Vector3(0, 1, 0), draai = new THREE.Quaternion();
    const tint = new THREE.Color();
    const d = this.dirs;
    const kleiner = this.kwaliteit === 'hoog' ? 0.75 : 1;
    const vocht = this.vocht || new Float32Array(this.n);
    for (let k = 0; k < aantal; k++) {
      const p = this.boomPlekken[k];
      const s = this.rad[p.i];
      const t = (s - (zeeR || minR)) / Math.max(1e-4, this.maxR - (zeeR || minR));
      const bioom = this.bioom[p.i];
      if ((zeeR > 0 && s <= zeeR + 0.001) || t >= 0.62 || bioom === 1 || bioom === 3 || bioom === 5) continue;
      if (bioom === 2 && p.tint > 0) continue; // toendra: de helft
      // In het oerwoud staan bomen ook buiten de gewone bosplukjes.
      if (!p.inBos && bioom !== 4 && p.sc > 0.9) continue; // buiten de plukjes: losse bomen
      const warm = this.warmte[p.i], nat = vocht[p.i];
      let beste = vormen[0], score = -Infinity;
      for (const vorm of vormen) {
        const sc = (past[vorm] || past.bol)(warm, nat) + Math.sin(p.draai * 3 + vormen.indexOf(vorm) * 2.1) * 0.35; // beetje gemengd
        if (sc > score) {
          score = sc;
          beste = vorm;
        }
      }
      const [stam, kroon] = this.bomen.get(beste);
      const nr = tellers.get(beste);
      tellers.set(beste, nr + 1);
      nv.set(d[p.i * 3], d[p.i * 3 + 1], d[p.i * 3 + 2]);
      v.copy(nv).multiplyScalar(s - 0.0008);
      q.setFromUnitVectors(omhoog, nv).multiply(draai.setFromAxisAngle(omhoog, p.draai));
      schaal.set(p.sc * kleiner, p.sc * p.sy * kleiner, p.sc * kleiner);
      m.compose(v, q, schaal);
      stam.setMatrixAt(nr, m);
      kroon.setMatrixAt(nr, m);
      // Paddenstoelen hebben hun eigen kleur: standaard rood (met witte stippen), tenzij gekozen.
      const kroonKleur = beste === 'paddenstoel' ? r.paddenstoelKleur || PADDENSTOEL_ROOD : r.boomKleur;
      kroon.setColorAt(nr, tint.set(kroonKleur).offsetHSL(p.tint * 0.3, 0, p.tint * (beste === 'paddenstoel' ? 0.4 : 1)));
    }
    for (const [vorm, [stam, kroon]] of this.bomen) {
      const n = tellers.get(vorm) || 0;
      stam.count = kroon.count = n;
      stam.instanceMatrix.needsUpdate = kroon.instanceMatrix.needsUpdate = true;
      if (kroon.instanceColor) kroon.instanceColor.needsUpdate = true;
      stam.visible = kroon.visible = n > 0;
    }
  }

  // ---------- Wolken ----------
  // De wolkenlaag bewaart alleen het ruispatroon; hoeveel wolken er zijn en waar het stormt wordt
  // per beeldje in de shader bepaald. Zo kan het weer voortdurend veranderen zonder rekenwerk.
  async maakWolken() {
    const r = this.r;
    const { wolkB: B, wolkH: H } = this.k;
    if (!this.wolkVeld) {
      this.wolkVeld = (await reken({ soort: 'wolken', B, H, zaad: r.zaad })).veld;
      this.wolkVeldNieuw = true;
    }
    if (!this.wolken) {
      const doek = document.createElement('canvas');
      doek.width = B;
      doek.height = H;
      const tex = new THREE.CanvasTexture(doek);
      tex.colorSpace = THREE.NoColorSpace;
      tex.anisotropy = 4;
      const mat = new THREE.MeshStandardMaterial({ alphaMap: tex, transparent: true, depthWrite: false, roughness: 1 });
      this.weer = {
        uDrempel: { value: 1 },
        uStorm: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 1, 0, 0)) },
        uStormCos: { value: [1, 1, 1, 1] },
      };
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, this.weer);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uDrempel;\nuniform vec4 uStorm[4];\nuniform float uStormCos[4];')
          .replace(
            '#include <alphamap_fragment>',
            `float veld = texture2D(alphaMap, vAlphaMapUv).g * 2.0 - 1.0;
            float phi = vAlphaMapUv.x * 6.2831853;
            float th = (1.0 - vAlphaMapUv.y) * 3.14159265;
            vec3 rd = vec3(-cos(phi) * sin(th), cos(th), sin(phi) * sin(th));
            float storm = 0.0;
            for (int i = 0; i < 4; i++) storm = max(storm, uStorm[i].w * smoothstep(uStormCos[i], 1.0, dot(rd, uStorm[i].xyz)));
            // Fijne stapelwolken binnen de storm, zodat het geen gladde schijf wordt.
            float fijn = texture2D(alphaMap, vAlphaMapUv * vec2(4.0, 3.0)).g * 2.0 - 1.0;
            float dek = smoothstep(uDrempel, uDrempel + 0.3, veld + storm * (0.3 + 0.45 * (fijn * 0.5 + 0.5)));
            diffuseColor.a *= min(1.0, dek * (0.92 + storm * 0.08));
            diffuseColor.rgb *= mix(vec3(1.0), vec3(0.16, 0.17, 0.22) + fijn * 0.05, smoothstep(0.0, 0.8, storm));`
          );
      };
      this.wolken = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), mat);
      this.groep.add(this.wolken);
    }
    if (this.wolkVeldNieuw) {
      this.wolkVeldNieuw = false;
      const tex = this.wolken.material.alphaMap;
      const ctx = tex.image.getContext('2d');
      const beeld = ctx.createImageData(B, H);
      const veld = this.wolkVeld;
      for (let i = 0; i < veld.length; i++) {
        const v = Math.max(0, Math.min(255, (veld[i] * 0.5 + 0.5) * 255));
        const o = i * 4;
        beeld.data[o] = beeld.data[o + 1] = beeld.data[o + 2] = v;
        beeld.data[o + 3] = 255;
      }
      ctx.putImageData(beeld, 0, 0);
      tex.needsUpdate = true;
    }
    this.wolken.material.color.set(r.wolkKleur);
    this.wolken.scale.setScalar(1 + this.amp * 0.65 + 0.025);
    this.zetWeer(this.weerNu || { dekking: r.wolken, stormen: [] });
  }

  // Het weer van dit moment: hoeveel wolken (0..1) en waar het stormt (richting in wereldruimte).
  zetWeer(weer) {
    this.weerNu = weer;
    if (!this.wolken) return;
    const dek = Math.max(0, Math.min(1, weer.dekking));
    this.weer.uDrempel.value = 0.35 - dek * 0.55;
    const as = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 4; i++) {
      const s = weer.stormen[i];
      if (!s) {
        this.weer.uStorm.value[i].w = 0;
        continue;
      }
      // Wolken draaien mee; de storm in wolkenruimte zetten.
      const lokaal = s.dir.clone().applyAxisAngle(as, -this.wolken.rotation.y);
      this.weer.uStorm.value[i].set(lokaal.x, lokaal.y, lokaal.z, s.kracht);
      this.weer.uStormCos.value[i] = Math.cos(s.straal);
    }
    this.wolken.visible = dek > 0.02 || weer.stormen.length > 0;
  }

  // ---------- Dampkring: gloed rond de rand plus een waas over de dagkant ----------
  maakLucht() {
    if (!this.lucht) {
      this.lucht = new THREE.Mesh(
        new THREE.SphereGeometry(1, 64, 32),
        new THREE.ShaderMaterial({
          uniforms: { kleur: { value: new THREE.Color() }, sterkte: { value: 1 } },
          vertexShader: `
            varying vec3 vNormaal;
            varying vec3 vZicht;
            void main() {
              vec4 wp = modelViewMatrix * vec4(position, 1.0);
              vNormaal = normalize(normalMatrix * normal);
              vZicht = normalize(-wp.xyz);
              gl_Position = projectionMatrix * wp;
            }`,
          fragmentShader: `
            uniform vec3 kleur;
            uniform float sterkte;
            varying vec3 vNormaal;
            varying vec3 vZicht;
            void main() {
              // Achterkant van de schil: 0 aan de buitenrand, sterk vlak bij de planeet.
              float s = clamp(-dot(vNormaal, vZicht) / 0.5, 0.0, 1.0);
              gl_FragColor = vec4(kleur, pow(s, 2.2) * 0.9 * sterkte);
            }`,
          transparent: true,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      this.waas = new THREE.Mesh(
        new THREE.SphereGeometry(1, 96, 48),
        new THREE.ShaderMaterial({
          uniforms: { kleur: { value: new THREE.Color() }, zon: { value: new THREE.Vector3(1, 0.3, 1).normalize() }, sterkte: { value: 1 } },
          vertexShader: `
            varying vec3 vNormaal;
            varying vec3 vWereld;
            void main() {
              vec4 wp = modelMatrix * vec4(position, 1.0);
              vWereld = wp.xyz;
              vNormaal = normalize(mat3(modelMatrix) * normal);
              gl_Position = projectionMatrix * viewMatrix * wp;
            }`,
          fragmentShader: `
            uniform vec3 kleur;
            uniform vec3 zon;
            uniform float sterkte;
            varying vec3 vNormaal;
            varying vec3 vWereld;
            void main() {
              vec3 v = normalize(cameraPosition - vWereld);
              float rand = pow(1.0 - max(dot(vNormaal, v), 0.0), 2.6);
              float dag = smoothstep(-0.25, 0.5, dot(vNormaal, zon));
              gl_FragColor = vec4(kleur * 1.2, rand * dag * 0.85 * sterkte);
            }`,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      this.groep.add(this.lucht, this.waas);
    }
    this.lucht.material.uniforms.kleur.value.set(this.r.lucht);
    this.waas.material.uniforms.kleur.value.set(this.r.lucht);
    const rand = 1 + this.amp * 0.65;
    this.lucht.scale.setScalar(rand + 0.13);
    this.waas.scale.setScalar(rand + 0.035);
  }

  // ---------- Ring ----------
  maakRing() {
    if (this.ring) {
      this.groep.remove(this.ring);
      this.ring.geometry.dispose();
      this.ring.material.map.dispose();
      this.ring.material.dispose();
      this.ring = null;
    }
    const ring = this.r.ring;
    if (!ring) return;
    const binnen = 1.5, buiten = 1.7 + (ring.breedte ?? 0.5) * 0.6;
    const geo = new THREE.RingGeometry(binnen, buiten, 256, 1);
    const uv = geo.attributes.uv, p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (Math.hypot(p.getX(i), p.getY(i)) - binnen) / (buiten - binnen), 0.5);
    this.ring = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ map: ringTextuur(ring.kleur, this.r.zaad), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1 })
    );
    this.ring.rotation.x = -Math.PI / 2 + 0.38;
    this.ring.rotation.y = 0.15;
    this.groep.add(this.ring);
  }

  // ---------- Manen ----------
  maakManen() {
    for (const m of this.manen) {
      this.groep.remove(m.draaier);
      m.bol.geometry.dispose();
      m.bol.material.dispose();
    }
    this.manen = [];
    const rnd = maakRandom(this.r.zaad + '-manen');
    const fijn = this.kwaliteit === 'hoog' ? 24 : 12;
    this.r.manen.forEach((maan, i) => {
      const draaier = new THREE.Group();
      draaier.rotation.z = (rnd() - 0.5) * 0.6;
      draaier.rotation.y = rnd() * Math.PI * 2;
      const ms = 0.08 + (maan.grootte ?? 0.5) * 0.16;
      let mg = new THREE.IcosahedronGeometry(1, fijn);
      mg.deleteAttribute('normal');
      mg.deleteAttribute('uv');
      mg = mergeVertices(mg);
      const mr = maakRuis(this.r.zaad + '-maan' + i);
      const mp = mg.attributes.position;
      for (let k = 0; k < mp.count; k++) {
        const x = mp.getX(k), y = mp.getY(k), z = mp.getZ(k);
        const s = ms * (1 + mr.lagen(x, y, z, 5, 1.8) * 0.12 - Math.max(0, mr.kammen(x, y, z, 2, 3) - 0.75) * 0.1);
        mp.setXYZ(k, x * s, y * s, z * s);
      }
      mg.computeVertexNormals();
      const bol = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ color: maan.kleur || '#bbbbbb', roughness: 1 }));
      bol.position.x = 2.2 + i * 0.7;
      draaier.add(bol);
      this.groep.add(draaier);
      this.manen.push({ draaier, bol, snelheid: 0.12 / (1 + i * 0.6) });
    });
  }

  // ---------- Opvragen ----------
  // Straal van de grond (of de zee) in een richting, in wereldmaat.
  grondStraal(richting) {
    return Math.max(this.landStraal(richting), this.zeeR * this.r.grootte);
  }

  // Zeeniveau in wereldmaat (0 als er geen water is).
  get zeeStraal() {
    return this.zeeR * this.r.grootte;
  }

  // Straal van alleen de grond, ook onder water, in wereldmaat.
  landStraal(richting) {
    const v = this.tmpV || (this.tmpV = new THREE.Vector3());
    v.copy(richting).normalize();
    const [c, k, f] = velden(this.ruis, this.r.ruwheid, v.x, v.y, v.z, this.uit);
    let h = this.kraterOp(v.x, v.y, v.z) + c * 0.75 + k * (0.2 + this.r.bergen * 1.1) + f;
    for (const p of this.r.penseel) {
      if (p.t !== 'h') continue;
      const dot = v.x * p.x + v.y * p.y + v.z * p.z;
      if (dot <= Math.cos(p.r)) continue;
      const q = Math.acos(Math.min(1, dot)) / p.r;
      h += p.a * (1 - q * q) ** 2;
    }
    return this.straalVoor(h) * this.r.grootte;
  }

  // Waar raakt een straal (in wereldmaat) de planeet? Geeft een eenheidsrichting of null.
  raak(straal) {
    const o = straal.origin.clone().divideScalar(this.r.grootte);
    const dir = straal.direction;
    let R = 1, richting = null;
    for (let i = 0; i < 4; i++) {
      const b = o.dot(dir), c = o.lengthSq() - R * R;
      const disc = b * b - c;
      if (disc < 0) return richting;
      const t = -b - Math.sqrt(disc);
      if (t < 0) return richting;
      richting = o.clone().addScaledVector(dir, t).normalize();
      R = this.grondStraal(richting.clone()) / this.r.grootte;
    }
    return richting;
  }

  update(dt, zonRichting) {
    // Eén jaar op de planeet duurt één echte minuut: zo zie je de winter komen en gaan.
    if (this.seizoen) {
      this.seizoen.uSeizoen.value = Math.sin((Date.now() / 60000) * Math.PI * 2);
      this.seizoen.uTijd.value = (this.seizoen.uTijd.value + dt) % 1000;
    }
    if (this.wind) this.wind.uWind.value = (this.wind.uWind.value + dt) % 1000;
    if (this.water) this.water.uTijd.value = (this.water.uTijd.value + dt) % 1000;
    if (this.wolken) this.wolken.rotation.y += dt * 0.006;
    if (this.golven) {
      this.golven.offset.x += dt * 0.004;
      this.golven.offset.y += dt * 0.0015;
    }
    if (this.waas && zonRichting) this.waas.material.uniforms.zon.value.copy(zonRichting);
    for (const m of this.manen) m.draaier.rotation.y += dt * m.snelheid;
  }

  opruimen() {
    this.groep.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        // Alle plaatjes op het materiaal opruimen (ook de wolkenkaart: in HD ruim 8 MB per keer).
        for (const v of Object.values(o.material)) if (v && v.isTexture) v.dispose();
        o.material.dispose();
      }
    });
    if (this.golven) this.golven.dispose();
  }
}

function kraterVorm(k, dot) {
  const q = Math.acos(Math.min(1, dot)) / k.straal;
  if (q < 1) return -(1 - q * q) * k.diepte * 0.5;
  return Math.sin(((q - 1) / 0.4) * Math.PI) * k.diepte * 0.12;
}

// Naadloze golfjes als normal map: som van golven met hele frequenties.
let golfBron = null;
function golfTextuur() {
  if (!golfBron) {
    const B = 256;
    const rnd = maakRandom('golven');
    const golven = Array.from({ length: 14 }, () => ({
      fx: Math.floor(rnd() * 9) - 4,
      fy: Math.floor(rnd() * 9) - 4,
      fase: rnd() * Math.PI * 2,
      a: 0.3 + rnd(),
    })).filter((g) => g.fx || g.fy);
    const h = new Float32Array(B * B);
    for (let y = 0; y < B; y++)
      for (let x = 0; x < B; x++) {
        let s = 0;
        for (const g of golven) s += g.a * Math.sin(((g.fx * x + g.fy * y) / B) * Math.PI * 2 * 3 + g.fase) / (Math.abs(g.fx) + Math.abs(g.fy));
        h[y * B + x] = s;
      }
    const doek = document.createElement('canvas');
    doek.width = doek.height = B;
    const ctx = doek.getContext('2d');
    const beeld = ctx.createImageData(B, B);
    for (let y = 0; y < B; y++)
      for (let x = 0; x < B; x++) {
        const dx = h[y * B + ((x + 1) % B)] - h[y * B + ((x - 1 + B) % B)];
        const dy = h[((y + 1) % B) * B + x] - h[((y - 1 + B) % B) * B + x];
        const n = new THREE.Vector3(-dx * 2, -dy * 2, 1).normalize();
        const o = (y * B + x) * 4;
        beeld.data[o] = (n.x * 0.5 + 0.5) * 255;
        beeld.data[o + 1] = (n.y * 0.5 + 0.5) * 255;
        beeld.data[o + 2] = (n.z * 0.5 + 0.5) * 255;
        beeld.data[o + 3] = 255;
      }
    ctx.putImageData(beeld, 0, 0);
    golfBron = doek;
  }
  const tex = new THREE.CanvasTexture(golfBron);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 5);
  return tex;
}

// Stam en kroon per vorm. Formaat: ongeveer 1 cm op een planeet van 1 m.
// Boomvormen. Van ver zie je een stip, dichtbij een echte boom: een den met lagen, een bolle boom
// als een wolkje blad, een palm met hangende bladeren en kokosnoten, een paddenstoel met stippen.
// De onderkant van de kroon is wat donkerder (schaduw), dat geeft diepte.
const samen = (lijst) => mergeGeometries(lijst.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
  for (const naam of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(naam)) g.deleteAttribute(naam);
  return g;
}));
function hobbelig(geo, mate, zaad) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = Math.sin(x * 2900 + zaad) * Math.sin(y * 3100 + zaad * 2) * Math.sin(z * 2700 + zaad * 3);
    const f = 1 + h * mate;
    p.setXYZ(i, x * f, y * (1 + h * mate * 0.5), z * f);
  }
  geo.computeVertexNormals();
  return geo;
}
function metSchaduw(geo) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const p = geo.attributes.position;
  const kleuren = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - min.y) / Math.max(1e-6, max.y - min.y);
    const l = 0.55 + 0.45 * t;
    kleuren[i * 3] = kleuren[i * 3 + 1] = kleuren[i * 3 + 2] = l;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(kleuren, 3));
  return geo;
}
function boomVormen(vorm) {
  let stam, kroon, stamKleur = '#5a3d2b';
  if (vorm === 'bol') {
    stam = samen([
      new THREE.CylinderGeometry(0.0006, 0.0009, 0.0065, 6).translate(0, 0.00325, 0),
      new THREE.CylinderGeometry(0.0002, 0.0004, 0.003, 4).rotateZ(-0.7).translate(0.0011, 0.0058, 0),
    ]);
    kroon = samen([
      new THREE.IcosahedronGeometry(0.0034, 1).translate(0, 0.0086, 0),
      new THREE.IcosahedronGeometry(0.0026, 1).translate(0.0023, 0.0076, 0.0008),
      new THREE.IcosahedronGeometry(0.0025, 1).translate(-0.0019, 0.0079, -0.0012),
      new THREE.IcosahedronGeometry(0.0023, 1).translate(0.0004, 0.0108, 0.0005),
      new THREE.IcosahedronGeometry(0.002, 1).translate(-0.0008, 0.0078, 0.0021),
    ]);
    hobbelig(kroon, 0.12, 1);
  } else if (vorm === 'paddenstoel') {
    // Stippen horen bij de witte steel, zo blijven ze wit, wat voor kleur de hoed ook heeft.
    const stippen = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + (i % 2) * 0.3, h = i % 3 === 0 ? 0.35 : 0.85;
      const dir = new THREE.Vector3(Math.cos(a) * Math.sin(h), Math.cos(h) * 0.7, Math.sin(a) * Math.sin(h));
      stippen.push(new THREE.SphereGeometry(0.00075, 6, 4).scale(1, 0.45, 1).translate(dir.x * 0.0055, 0.0075 + dir.y * 0.0055, dir.z * 0.0055));
    }
    stam = samen([new THREE.CylinderGeometry(0.0011, 0.0016, 0.008, 10).translate(0, 0.004, 0), ...stippen]);
    kroon = new THREE.SphereGeometry(0.0055, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(0, 0.0075, 0);
    stamKleur = '#f2ead8';
  } else if (vorm === 'kristal') {
    stam = samen([
      new THREE.OctahedronGeometry(0.0015).scale(1, 2.2, 1).translate(0.002, 0.003, 0.001),
      new THREE.OctahedronGeometry(0.001).scale(1, 2.4, 1).rotateZ(0.4).translate(-0.0018, 0.0024, -0.0008),
    ]);
    kroon = new THREE.OctahedronGeometry(0.0025).scale(1, 3, 1).translate(0, 0.0072, 0);
    stamKleur = '#ffffff';
  } else if (vorm === 'palm') {
    // Een licht gebogen stam met kokosnoten bovenin.
    const st = new THREE.CylinderGeometry(0.0005, 0.0008, 0.011, 6, 6).translate(0, 0.0055, 0);
    const sp = st.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setX(i, sp.getX(i) + (sp.getY(i) / 0.011) ** 2 * 0.0012);
    st.computeVertexNormals();
    const noten = [0, 2.1, 4.2].map((a) => new THREE.SphereGeometry(0.0006, 6, 4).translate(0.0012 + Math.cos(a) * 0.0006, 0.0102, Math.sin(a) * 0.0006));
    stam = samen([st, ...noten]);
    // Bladeren die naar beneden hangen.
    const blad = [];
    for (let i = 0; i < 7; i++) {
      const b = new THREE.PlaneGeometry(0.0068, 0.0016, 6, 1).translate(0.0034, 0, 0);
      const bp = b.attributes.position;
      for (let k = 0; k < bp.count; k++) {
        const t = bp.getX(k) / 0.0068;
        bp.setY(k, bp.getY(k) * (1 - t * 0.7)); // spits toelopend
        bp.setZ(k, -t * t * 0.0034); // naar beneden buigen
      }
      b.rotateX(-Math.PI / 2 + 0.25).rotateY((i / 7) * Math.PI * 2 + (i % 2) * 0.2).translate(0.0012, 0.011, 0);
      b.computeVertexNormals();
      blad.push(b);
    }
    kroon = samen(blad);
    stamKleur = '#7a5a3a';
  } else {
    // Den: drie lagen takken, steeds kleiner naar boven.
    stam = new THREE.CylinderGeometry(0.0005, 0.0008, 0.004, 6).translate(0, 0.002, 0);
    kroon = samen([
      new THREE.ConeGeometry(0.0037, 0.0058, 8).translate(0, 0.0052, 0),
      new THREE.ConeGeometry(0.003, 0.005, 8).rotateY(0.4).translate(0, 0.0079, 0),
      new THREE.ConeGeometry(0.0021, 0.0043, 8).rotateY(0.8).translate(0, 0.0104, 0),
    ]);
  }
  return [stam, metSchaduw(kroon), stamKleur];
}

function ringTextuur(basisHex, zaad) {
  const B = 1024;
  const doek = document.createElement('canvas');
  doek.width = B;
  doek.height = 4;
  const ctx = doek.getContext('2d');
  const rnd = maakRandom(zaad + '-ring');
  const basis = new THREE.Color(basisHex || '#d8c9a3');
  for (let x = 0; x < B; x++) {
    const t = x / B;
    const band = 0.5 + 0.5 * Math.sin(t * 40 + rnd() * 0.6) * Math.sin(t * 9);
    const rand = glad(0, 0.06, t) * glad(1, 0.9, t);
    ctx.globalAlpha = Math.max(0, band * 0.75 + rnd() * 0.25) * rand;
    ctx.fillStyle = '#' + basis.clone().offsetHSL(0, 0, (band - 0.5) * 0.2).getHexString();
    ctx.fillRect(x, 0, 1, 4);
  }
  const tex = new THREE.CanvasTexture(doek);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
