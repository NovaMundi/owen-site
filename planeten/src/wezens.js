// Levende wezens op de planeet. Elk wezen is een getekende sticker die rechtop op de grond staat,
// altijd naar je toe gedraaid, en die loopt, hupt, zwemt, vliegt of zweeft.

import * as THREE from 'three';
import { maakRandom } from './ruis.js';
import { MATEN } from './keuzes.js';

const MAX_TOTAAL = 220;
const PER_SOORT = 64; // meer van één soort tegelijk in beeld wordt het nooit (zie beheer.js)
const NUL = new THREE.Matrix4().makeScale(0, 0, 0);
// Huppers komen alleen tijdens de sprong vooruit, dus die gaan in de lucht extra snel.
const SNELHEID = { lopen: 0.045, huppen: 0.09, zwemmen: 0.04, vliegen: 0.12, zweven: 0.018 };

const laadTextuur = (() => {
  const lader = new THREE.TextureLoader();
  return (url) => {
    const t = lader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
})();

let schaduwTex = null;
function schaduwTextuur() {
  if (schaduwTex) return schaduwTex;
  const d = document.createElement('canvas');
  d.width = d.height = 64;
  const ctx = d.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  schaduwTex = new THREE.CanvasTexture(d);
  return schaduwTex;
}

// Wat telt als "anders" voor een soort (naam wijzigen hoeft geen nieuwe dieren).
// Welk plaatje laat het wezen nu zien: de tekening of de echte versie (✨ Maak echt).
export function beeldVan(w) {
  if (w.weergave === 'echt' && w.echt && w.echt.plaatje) return { open: w.echt.plaatje, dicht: w.echt.plaatje, verhouding: w.echt.verhouding || 1, echt: true };
  return { open: w.plaatje, dicht: w.dicht || w.plaatje, verhouding: w.verhouding || 1, echt: false };
}
const sleutelVan = (w) => { const b = beeldVan(w); return JSON.stringify([b.open.length, b.open.slice(-40), w.beweging, w.maat, w.kijkt]); };

// ---- Wat ze aan het doen zijn: een klein wolkje boven hun hoofd (zoals in De Sims) ----
const TAAK_ICOON = ['🔨', '💤', '🍎', '🙏', '🔥', '🌾'];
let atlasTex = null;
function atlas() {
  if (atlasTex) return atlasTex;
  const C = 96;
  const d = document.createElement('canvas');
  d.width = C * TAAK_ICOON.length;
  d.height = C;
  const ctx = d.getContext('2d');
  TAAK_ICOON.forEach((e, i) => {
    // Wit wolkje met het icoon erin.
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(i * C + C / 2, C / 2, C * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${Math.round(C * 0.5)}px "Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e, i * C + C / 2, C / 2 + C * 0.04);
  });
  atlasTex = new THREE.CanvasTexture(d);
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  return atlasTex;
}
const MAX_ICONEN = 260;

export class WezensLaag {
  constructor() {
    this.groep = new THREE.Group();
    this.soorten = new Map(); // id -> { w, sleutel, open, dicht, dieren: [] }
    this.planeet = null;
    this.vlak = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    this.schaduwGeo = new THREE.CircleGeometry(0.5, 20);
    this.tijd = 0;
    this.dorp = null; // de beschavingslaag: waar zijn huizen, vuren, tempels en bouwplaatsen?
    this.zon = new THREE.Vector3(1, 0, 0); // richting van de zon: aan de nachtkant gaan ze slapen
    // Wolkjes met wat ze doen: één tekenopdracht voor allemaal.
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_ICONEN * 3), 3));
    g.setAttribute('cel', new THREE.BufferAttribute(new Float32Array(MAX_ICONEN), 1));
    g.setAttribute('maat', new THREE.BufferAttribute(new Float32Array(MAX_ICONEN), 1));
    g.setDrawRange(0, 0);
    this.iconen = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: { kaart: { value: atlas() }, cellen: { value: TAAK_ICOON.length } },
        vertexShader: `
          attribute float cel;
          attribute float maat;
          varying float vCel;
          varying float vZicht;
          void main() {
            vCel = cel;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            // Alleen als je dichtbij kijkt; van ver zou het een rommeltje worden.
            vZicht = 1.0 - smoothstep(0.5, 1.3, -mv.z);
            gl_PointSize = maat * (300.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D kaart;
          uniform float cellen;
          varying float vCel;
          varying float vZicht;
          void main() {
            vec2 uv = vec2((vCel + gl_PointCoord.x) / cellen, 1.0 - gl_PointCoord.y);
            vec4 c = texture2D(kaart, uv);
            if (c.a * vZicht < 0.05) discard;
            gl_FragColor = vec4(c.rgb, c.a * vZicht);
          }`,
        transparent: true,
        depthWrite: false,
      })
    );
    this.iconen.frustumCulled = false;
    this.groep.add(this.iconen);
  }

  // Een nieuwe taak kiezen voor een dier: wat past bij de tijd van de dag en bij wat er te doen is?
  kiesTaak(s, d) {
    const id = s.w.id, b = s.w.beweging;
    const plek = this.dorp && this.dorp.plekken ? this.dorp.plekken.get(id) : null;
    const licht = this.zon ? d.dir.dot(this.zon) : 1;
    const nacht = licht < -0.15, avond = !nacht && licht < 0.1;
    const dichtbij = (lijst, max) => {
      let beste = null, bd = Math.cos(max);
      for (const p of lijst || []) {
        const dot = p.dot(d.dir);
        if (dot > bd) (bd = dot), (beste = p);
      }
      return beste;
    };
    const naast = (p, afstand = 0.006) => {
      const t = new THREE.Vector3().randomDirection();
      t.addScaledVector(p, -t.dot(p)).normalize();
      return p.clone().addScaledVector(t, afstand * (0.4 + Math.random())).normalize();
    };
    let taak = null;
    const lopers = b === 'lopen' || b === 'huppen';
    if (nacht) {
      const huis = lopers && plek && dichtbij(plek.huis, 0.25);
      taak = { soort: 'slapen', doel: huis ? naast(huis, 0.004) : null, icoon: 1 };
    } else if (lopers && this.dorp && Math.random() < 0.7) {
      const bouw = dichtbij(this.dorp.bouwVoor(id), 0.3);
      if (bouw) taak = { soort: 'bouwen', doel: naast(bouw, 0.005), icoon: 0 };
    }
    // Feest bij de tempel: iedereen komt samen en buigt voor hun god.
    if (!taak && lopers && plek && plek.tempel && this.tijd % 80 < 20 && plek.tempel.dot(d.dir) > Math.cos(0.35)) taak = { soort: 'bidden', doel: naast(plek.tempel, 0.012), icoon: 3 };
    if (!taak && lopers && avond && plek) {
      const vuur = dichtbij(plek.vuur, 0.25);
      if (vuur) taak = { soort: 'vuur', doel: naast(vuur, 0.006), icoon: 4 };
    }
    if (!taak) {
      const k = Math.random();
      if (k < 0.4) taak = { soort: 'eten', doel: naast(d.dir, 0.03), icoon: 2 };
      else if (k < 0.6 && lopers && plek && plek.akker.length) {
        const akker = dichtbij(plek.akker, 0.2);
        if (akker) taak = { soort: 'akker', doel: naast(akker, 0.004), icoon: 5 };
      }
    }
    d.taak = taak;
    d.taakTot = this.tijd + (taak ? 10 + Math.random() * 14 : 4 + Math.random() * 6);
  }

  // Lijst wezens uit het recept bijhouden: alleen veranderde soorten opnieuw maken.
  zet(lijst) {
    const ids = new Set((lijst || []).map((w) => w.id));
    for (const [id] of this.soorten) if (!ids.has(id)) this.weg(id);
    for (const w of lijst || []) {
      const s = this.soorten.get(w.id);
      const sleutel = sleutelVan(w);
      if (s && s.sleutel === sleutel) {
        s.w = w;
        continue;
      }
      if (s) this.weg(w.id);
      this.maakSoort(w, sleutel, Math.min(w.aantal, MAX_TOTAAL));
    }
  }

  // Wat de levensmotor zegt: hoeveel zijn er te zien, waar wonen ze, hoe groot zijn ze geworden.
  stelLeven(id, { aantal, thuizen, schaal = 1, amfibie = false }) {
    const s = this.soorten.get(id);
    if (!s) return;
    s.doel = Math.min(aantal, PER_SOORT);
    s.amfibie = amfibie;
    if (schaal !== s.schaal) {
      s.schaal = schaal;
      for (const d of s.dieren) d.maat = d.basisMaat * schaal;
    }
    const sleutel = (thuizen || []).map((t) => t.id).join(',');
    if (sleutel !== s.thuisSleutel) {
      s.thuisSleutel = sleutel;
      s.thuizen = thuizen && thuizen.length ? thuizen.map((t) => ({ dir: new THREE.Vector3(...t.dir), gewicht: t.gewicht })) : null;
      // Sommigen verhuizen naar een nieuw thuis: dat zie je ze ook echt doen.
      for (const d of s.dieren) if (!d.thuis || Math.random() < 0.5) d.thuis = this.kiesThuis(s);
    }
  }

  kiesThuis(s) {
    if (!s.thuizen) return s.midden || null;
    const som = s.thuizen.reduce((a, t) => a + t.gewicht, 0);
    let r = Math.random() * som;
    for (const t of s.thuizen) if ((r -= t.gewicht) <= 0) return t.dir;
    return s.thuizen[0].dir;
  }

  leeg() {
    for (const id of [...this.soorten.keys()]) this.weg(id);
  }

  weg(id) {
    const s = this.soorten.get(id);
    if (!s) return;
    for (const d of s.dieren) this.groep.remove(d.mesh);
    this.groep.remove(s.openInst, s.dichtInst, s.schaduwInst);
    for (const inst of [s.openInst, s.dichtInst, s.schaduwInst]) inst.dispose();
    s.open.map.dispose();
    s.dicht.map.dispose();
    s.open.dispose();
    s.dicht.dispose();
    s.schaduwMat.dispose();
    this.soorten.delete(id);
  }

  maakSoort(w, sleutel, aantal) {
    const mat = (url) =>
      new THREE.MeshStandardMaterial({
        map: laadTextuur(url),
        emissiveMap: null,
        transparent: true,
        alphaTest: 0.4,
        side: THREE.DoubleSide,
        roughness: 1,
        emissive: '#ffffff',
        emissiveIntensity: 0,
      });
    const beeld = beeldVan(w);
    const open = mat(beeld.open);
    const dicht = mat(beeld.dicht);
    // Een beetje eigen licht, zodat de tekening vrolijk blijft, ook op de schaduwkant.
    for (const m of [open, dicht]) {
      m.emissiveMap = m.map;
      m.emissiveIntensity = 0.35;
    }
    const schaduwMat = new THREE.MeshBasicMaterial({ map: schaduwTextuur(), transparent: true, depthWrite: false, opacity: 0.8 });
    // Alle dieren van één soort in één keer tekenen (instancing): twee lagen voor ogen open en
    // ogen dicht, en één voor de schaduwen. Zo blijft het vlot op een tablet, ook met 200 dieren.
    const inst = (geo, m) => {
      const i = new THREE.InstancedMesh(geo, m, PER_SOORT);
      i.count = 0;
      i.frustumCulled = false; // ze staan over de hele planeet verspreid
      i.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.groep.add(i);
      return i;
    };
    const s = {
      w, sleutel, open, dicht, schaduwMat, dieren: [], doel: Math.min(aantal, PER_SOORT), schaal: 1, thuizen: null, thuisSleutel: null, midden: null, amfibie: false,
      openInst: inst(this.vlak, open),
      dichtInst: inst(this.vlak, dicht),
      schaduwInst: inst(this.schaduwGeo, schaduwMat),
    };
    s.openInst.userData.soort = s.dichtInst.userData.soort = w.id;
    this.soorten.set(w.id, s);
  }

  // Aantal dieren in beeld gelijk trekken met wat er zou moeten zijn.
  bijwerken(s) {
    if (!s.midden) {
      // Startplek: een kudde rond één plek waar ze kunnen leven.
      const rnd = maakRandom(s.w.id);
      for (let i = 0; i < 80 && !s.midden; i++) {
        const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
        if (this.magHier(s, v)) s.midden = v;
      }
      if (!s.midden) s.midden = new THREE.Vector3(0, 1, 0);
    }
    let nieuw = 0;
    while (s.dieren.length < s.doel) this.nieuwDier(s, nieuw++);
    while (s.dieren.length > s.doel) this.groep.remove(s.dieren.pop().mesh);
  }

  nieuwDier(s, k) {
    const maat = (MATEN.find((m) => m.id === s.w.maat) || MATEN[1]).maat;
    const thuis = this.kiesThuis(s) || s.midden;
    const spreiding = 0.06 + Math.sqrt(Math.min(s.doel, 30)) * 0.03;
    let dir = null;
    for (let i = 0; i < 30 && !dir; i++) {
      const v = thuis.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(spreiding * 2)).normalize();
      if (this.magHier(s, v)) dir = v;
    }
    if (!dir) dir = thuis.clone();
    const koers = new THREE.Vector3().randomDirection();
    koers.addScaledVector(dir, -koers.dot(dir)).normalize();
    // Een onzichtbaar houvast per dier: plek, draaiing en maat. Getekend wordt via de instancing.
    // (De camera volgt dit houvast als je op bezoek gaat.)
    const mesh = new THREE.Object3D();
    mesh.userData.soort = s.w.id;
    this.groep.add(mesh);
    const basisMaat = maat * (0.85 + Math.random() * 0.3);
    s.dieren.push({
      mesh,
      dir,
      koers,
      thuis,
      basisMaat,
      maat: basisMaat * s.schaal,
      fase: Math.random() * 10,
      pauze: 0,
      knipper: 1 + Math.random() * 5,
      dicht: 0,
      spiegel: 1,
      sprong: 0,
      geboren: -k * 0.08, // ploppen één voor één tevoorschijn
      duik: 0,
      snel: 0.8 + Math.random() * 0.4,
    });
  }

  magHier(s, dir, land) {
    const p = this.planeet;
    const beweging = s.w.beweging;
    if (beweging === 'vliegen' || beweging === 'zweven' || s.amfibie) return true;
    const zee = p.zeeStraal;
    const nat = zee > 0 && (land ?? p.landStraal(dir)) < zee - 0.0005;
    if (beweging === 'zwemmen') return zee <= 0 || nat; // geen water: dan maar op het land
    return !nat;
  }

  // Waar staat dit dier nu (in de ruimte van de laag)?
  plekVan(d, uit = new THREE.Vector3()) {
    return uit.copy(d.mesh.position);
  }

  update(dt, camera, houder) {
    if (!this.planeet) return;
    this.tijd += dt;
    const p = this.planeet;
    const cam = houder.worldToLocal(camera.position.clone());
    const camRechts = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const n = new THREE.Vector3(), f = new THREE.Vector3(), x = new THREE.Vector3();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), wiebel = new THREE.Quaternion();
    const zAs = new THREE.Vector3(0, 0, 1);
    const zee = p.zeeStraal;
    const schaduwPlek = new THREE.Vector3(), schaduwDraai = new THREE.Quaternion(), schaduwMaat = new THREE.Vector3();
    // Is de planeet veranderd (boetseren, water erbij)? Dan de onthouden grondhoogtes vergeten.
    if (this.grondSleutel !== p) {
      this.grondSleutel = p;
      for (const s of this.soorten.values()) for (const d of s.dieren) d.land = undefined;
    }

    for (const s of this.soorten.values()) {
      this.bijwerken(s);
      const b = s.w.beweging;
      const aantal = s.dieren.length;
      s.openInst.count = s.dichtInst.count = s.schaduwInst.count = aantal;
      for (let i = 0; i < aantal; i++) {
        const d = s.dieren[i];
        d.geboren += dt;
        if (d.geboren < 0) {
          d.mesh.visible = false;
          s.openInst.setMatrixAt(i, NUL);
          s.dichtInst.setMatrixAt(i, NUL);
          s.schaduwInst.setMatrixAt(i, NUL);
          continue;
        }
        d.mesh.visible = true;

        // ---- Wat gaat hij doen? ----
        if (!d.taakTot || this.tijd > d.taakTot) this.kiesTaak(s, d);
        const taak = d.taak;
        let bezig = false; // aangekomen bij zijn taak (dan staat hij stil en doet het)
        if (taak) {
          if (!taak.doel || taak.doel.dot(d.dir) > Math.cos(0.006)) {
            bezig = true;
            d.pauze = Math.max(d.pauze, 0.2);
          }
        }

        // ---- Bewegen over een grote cirkel ----
        d.pauze -= dt;
        d.vrij = Math.max(0, (d.vrij || 0) - dt);
        const actief = d.pauze <= 0;
        // De sprong (en het loopritme) loopt altijd door zolang hij niet uitrust; een hupper komt
        // alleen vooruit tijdens de sprong zelf, niet als hij op de grond landt.
        if (actief) d.fase += dt * (b === 'vliegen' ? 1.4 : 1);
        const loopt = actief && !(b === 'huppen' && Math.sin(d.fase * 6) < 0);
        if (loopt) {
          const hoek = (SNELHEID[b] * d.snel * dt) / (p.straal || 1) * Math.sqrt(d.maat / 0.014) ** 0.6;
          const nieuweDir = d.dir.clone().multiplyScalar(Math.cos(hoek)).addScaledVector(d.koers, Math.sin(hoek)).normalize();
          // De grondhoogte maar één keer per dier per beeldje opzoeken (dat is het dure deel).
          const nieuwLand = p.landStraal(nieuweDir);
          const goed = this.magHier(s, nieuweDir, nieuwLand);
          if (goed || !this.magHier(s, d.dir, d.land)) {
            // Koers meedraaien zodat hij rechtdoor blijft gaan.
            d.koers.multiplyScalar(Math.cos(hoek)).addScaledVector(d.dir, -Math.sin(hoek));
            d.dir.copy(nieuweDir);
            d.land = nieuwLand;
            d.botst = Math.max(0, (d.botst || 0) - dt);
          } else {
            // Rand van het water of land: een flinke draai een andere kant op, en even niet naar
            // huis sturen (anders blijft hij heen en weer duwen op dezelfde plek).
            d.koers.applyAxisAngle(d.dir, (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 + Math.random() * Math.PI / 2));
            d.vrij = 1.5 + Math.random() * 2;
            d.botst = (d.botst || 0) + 1;
            // Telkens weer vast? Dan maar hier een nieuw thuis.
            if (d.botst > 6) {
              d.thuis = d.dir.clone();
              d.botst = 0;
            }
          }
          // Een beetje slingeren, zoals echte dieren.
          d.koers.applyAxisAngle(d.dir, (Math.random() - 0.5) * dt * 2.2);
          // Op weg naar zijn taak: daarheen sturen (en dan niet naar huis trekken).
          if (taak && taak.doel && !bezig && !d.vrij) {
            const naar = taak.doel.clone().addScaledVector(d.dir, -taak.doel.dot(d.dir));
            if (naar.lengthSq() > 1e-10) d.koers.lerp(naar.normalize(), Math.min(1, dt * 5));
          }
          // Niet te ver van huis: langzaam terugsturen naar hun eigen gebied.
          else if (d.thuis && !d.vrij && d.dir.dot(d.thuis) < Math.cos(0.09)) {
            const naarHuis = d.thuis.clone().addScaledVector(d.dir, -d.thuis.dot(d.dir));
            if (naarHuis.lengthSq() > 1e-8) d.koers.lerp(naarHuis.normalize(), Math.min(1, dt * 1.5));
          }
          d.koers.addScaledVector(d.dir, -d.koers.dot(d.dir)).normalize();
        }
        if (!taak && actief && (b === 'lopen' || b === 'huppen') && Math.random() < dt * 0.1) d.pauze = 0.8 + Math.random() * 2;

        // ---- Hoogte ----
        // Staat hij stil, dan af en toe opnieuw kijken (er kan net geboetseerd zijn onder zijn voeten).
        if (d.land === undefined || (!loopt && this.tijd - (d.landT || 0) > 0.5)) {
          d.land = p.landStraal(d.dir);
          d.landT = this.tijd;
        }
        const land = d.land;
        const grond = Math.max(land, zee);
        let hoogte = grond;
        const t = this.tijd + d.fase;
        let kantel = 0, squash = 1;
        if (b === 'lopen') {
          hoogte += Math.abs(Math.sin(d.fase * 9)) * d.maat * 0.08 * (loopt ? 1 : 0);
          kantel = loopt ? Math.sin(d.fase * 9) * 0.12 : 0;
        } else if (b === 'huppen') {
          const boog = Math.max(0, Math.sin(d.fase * 6));
          hoogte += boog * d.maat * 0.9;
          squash = boog < 0.05 ? 0.85 : 1 + boog * 0.08;
        } else if (b === 'zwemmen') {
          const nat = zee > 0 && land < zee;
          if (nat) {
            d.duik = Math.max(0, d.duik - dt);
            if (Math.random() < dt * 0.05) d.duik = 3;
            const onder = d.duik > 0 ? Math.sin((d.duik / 3) * Math.PI) * d.maat * 1.3 : 0;
            hoogte = zee - d.maat * 0.35 + Math.sin(t * 2) * d.maat * 0.08 - onder;
            kantel = Math.sin(t * 1.5) * 0.15;
          }
        } else if (b === 'vliegen') {
          hoogte += 0.03 + d.maat * 3 + Math.sin(t * 0.7) * d.maat;
          squash = 1 + Math.sin(t * 14) * 0.1;
          kantel = Math.sin(t * 0.9) * 0.2;
        } else if (b === 'zweven') {
          hoogte += d.maat * 0.7 + Math.sin(t * 1.2) * d.maat * 0.3;
          kantel = Math.sin(t * 0.8) * 0.1;
        }
        // Bezig met zijn taak: dat zie je aan hoe hij beweegt.
        if (bezig && taak) {
          if (taak.soort === 'bouwen') {
            hoogte += Math.abs(Math.sin(t * 11)) * d.maat * 0.25;
            kantel = Math.sin(t * 11) * 0.3;
          } else if (taak.soort === 'bidden') {
            kantel = Math.sin(t * 1.6) > 0 ? 0.55 : 0.05; // buigen
          } else if (taak.soort === 'vuur') {
            hoogte += Math.abs(Math.sin(t * 5)) * d.maat * 0.45; // dansen rond het vuur
            kantel = Math.sin(t * 2.5) * 0.25;
          } else if (taak.soort === 'slapen') {
            kantel = 0.9; // liggen
            squash = 0.9 + Math.sin(t * 1.5) * 0.04;
          } else if (taak.soort === 'eten' || taak.soort === 'akker') {
            kantel = 0.25 + Math.sin(t * 7) * 0.15; // knabbelen of werken op het land
          }
        }
        // Opspringen na een tik.
        if (d.sprong > 0) {
          d.sprong = Math.max(0, d.sprong - dt * 1.6);
          hoogte += Math.sin(d.sprong * Math.PI) * d.maat * 1.5;
          kantel += Math.sin(d.sprong * Math.PI * 2) * 0.4;
        }

        // ---- Draaien naar de camera, rechtop op de grond ----
        n.copy(d.dir);
        d.mesh.position.copy(n).multiplyScalar(hoogte);
        f.copy(cam).sub(d.mesh.position);
        f.addScaledVector(n, -f.dot(n));
        if (f.lengthSq() < 1e-10) f.copy(d.koers);
        f.normalize();
        x.crossVectors(n, f);
        m.makeBasis(x, n, f);
        q.setFromRotationMatrix(m);
        wiebel.setFromAxisAngle(zAs, kantel);
        d.mesh.quaternion.copy(q).multiply(wiebel);

        // Kijkrichting: omdraaien als hij de andere kant op loopt.
        const opScherm = d.koers.dot(camRechts);
        const doel = Math.abs(opScherm) > 0.2 ? (opScherm > 0 ? 1 : -1) * (s.w.kijkt === 'links' ? -1 : 1) : d.spiegel > 0 ? 1 : -1;
        d.spiegel += (doel - d.spiegel) * Math.min(1, dt * 8);
        const groei = Math.min(1, d.geboren * 3);
        const plop = groei < 1 ? groei * (1 + Math.sin(groei * Math.PI) * 0.4) : 1;
        const breed = d.maat * beeldVan(s.w).verhouding * plop;
        d.mesh.scale.set(breed * d.spiegel, d.maat * squash * plop, 1);
        d.mesh.updateMatrix();

        // Knipperen: in de laag met open ogen of in die met dichte ogen.
        d.knipper -= dt;
        if (d.knipper <= 0) {
          d.dicht = 0.14;
          d.knipper = 2 + Math.random() * 5;
        }
        d.dicht -= dt;
        s.openInst.setMatrixAt(i, d.dicht > 0 ? NUL : d.mesh.matrix);
        s.dichtInst.setMatrixAt(i, d.dicht > 0 ? d.mesh.matrix : NUL);

        // Schaduw op de grond (kleiner als hij hoog in de lucht is).
        if (b !== 'zwemmen') {
          const opGrond = Math.max(land, zee) + 0.0012 * p.r.grootte;
          schaduwPlek.copy(n).multiplyScalar(opGrond);
          schaduwDraai.setFromUnitVectors(zAs, n);
          const los = Math.max(0, hoogte - grond) / (d.maat * 4 + 0.02);
          const sc = breed * 0.9 * Math.max(0.3, 1 - los) * Math.max(0.4, 1 - los * 0.5);
          schaduwMaat.set(sc, sc * 0.6, 1);
          m.compose(schaduwPlek, schaduwDraai, schaduwMaat);
          s.schaduwInst.setMatrixAt(i, m);
        } else s.schaduwInst.setMatrixAt(i, NUL);
      }
      s.openInst.instanceMatrix.needsUpdate = true;
      s.dichtInst.instanceMatrix.needsUpdate = true;
      s.schaduwInst.instanceMatrix.needsUpdate = true;
    }
    // Wolkjes boven wie iets aan het doen is.
    const pos = this.iconen.geometry.attributes.position, cel = this.iconen.geometry.attributes.cel, mt = this.iconen.geometry.attributes.maat;
    let ic = 0;
    for (const s of this.soorten.values()) {
      for (const d of s.dieren) {
        if (ic >= MAX_ICONEN || !d.taak || !d.mesh.visible || d.geboren < 0) continue;
        const bij = !d.taak.doel || d.taak.doel.dot(d.dir) > Math.cos(0.006);
        if (!bij) continue;
        const p = d.mesh.position;
        const hoog = d.maat * 1.35 + 0.002 + Math.sin(this.tijd * 2 + d.fase) * d.maat * 0.06;
        pos.setXYZ(ic, p.x + d.dir.x * hoog, p.y + d.dir.y * hoog, p.z + d.dir.z * hoog);
        cel.setX(ic, d.taak.icoon);
        mt.setX(ic, Math.max(0.006, d.maat * 0.7));
        ic++;
      }
    }
    pos.needsUpdate = cel.needsUpdate = mt.needsUpdate = true;
    this.iconen.geometry.setDrawRange(0, ic);
  }

  // Welk dier zit onder deze straal (in wereldcoördinaten)?
  raak(straal) {
    const raker = new THREE.Raycaster(straal.origin, straal.direction);
    const doelen = [];
    for (const s of this.soorten.values()) {
      // De dieren lopen rond: de omvang van de laag opnieuw laten uitrekenen voor het raken.
      s.openInst.boundingSphere = s.dichtInst.boundingSphere = null;
      doelen.push(s.openInst, s.dichtInst);
    }
    const hit = raker.intersectObjects(doelen, false).find((h) => h.instanceId !== undefined);
    if (!hit) return null;
    const s = this.soorten.get(hit.object.userData.soort);
    const dier = s && s.dieren[hit.instanceId];
    return dier ? { soort: s.w, dier } : null;
  }

  // Kleine wezens zijn met een vinger lastig precies te raken: eerst echt raak, anders het wezen
  // dat binnen een vingerbreedte (±32 pixels) van de tik staat, aan de kant die je ziet.
  raakBij(straal, ndc, camera, breedte, hoogte, marge = 32) {
    const echt = this.raak(straal);
    if (echt) return echt;
    const v = new THREE.Vector3(), naarCam = new THREE.Vector3();
    let beste = null, afstand = marge;
    for (const s of this.soorten.values()) {
      for (const d of s.dieren) {
        if (!d.mesh.visible) continue;
        d.mesh.getWorldPosition(v);
        naarCam.copy(camera.position).sub(v);
        if (v.clone().normalize().dot(naarCam) <= 0) continue; // achter de planeet
        v.project(camera);
        if (v.z > 1) continue;
        const px = Math.hypot(((v.x - ndc.x) * breedte) / 2, ((v.y - ndc.y) * hoogte) / 2);
        if (px < afstand) {
          afstand = px;
          beste = { soort: s.w, dier: d };
        }
      }
    }
    return beste;
  }

  willekeurigDier(id) {
    const s = this.soorten.get(id);
    if (!s || !s.dieren.length) return null;
    return s.dieren[Math.floor(Math.random() * s.dieren.length)];
  }
}
