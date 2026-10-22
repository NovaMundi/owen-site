// Levende wezens op de planeet. Elk wezen is een getekende sticker die rechtop op de grond staat,
// altijd naar je toe gedraaid, en die loopt, hupt, zwemt, vliegt of zweeft.

import * as THREE from 'three';
import { maakRandom } from './ruis.js';
import { MATEN } from './keuzes.js';

const MAX_TOTAAL = 220;
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

export class WezensLaag {
  constructor() {
    this.groep = new THREE.Group();
    this.soorten = new Map(); // id -> { w, sleutel, open, dicht, dieren: [] }
    this.planeet = null;
    this.vlak = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    this.schaduwGeo = new THREE.CircleGeometry(0.5, 20);
    this.tijd = 0;
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
    s.doel = aantal;
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
    for (const d of s.dieren) {
      this.groep.remove(d.mesh, d.schaduw);
      d.schaduw.material.dispose();
    }
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
    const schaduwMat = new THREE.MeshBasicMaterial({ map: schaduwTextuur(), transparent: true, depthWrite: false });
    const s = { w, sleutel, open, dicht, schaduwMat, dieren: [], doel: aantal, schaal: 1, thuizen: null, thuisSleutel: null, midden: null, amfibie: false };
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
    while (s.dieren.length > s.doel) {
      const d = s.dieren.pop();
      this.groep.remove(d.mesh, d.schaduw);
      d.schaduw.material.dispose();
    }
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
    const mesh = new THREE.Mesh(this.vlak, s.open);
    mesh.userData.soort = s.w.id;
    const schaduw = new THREE.Mesh(this.schaduwGeo, s.schaduwMat.clone());
    schaduw.visible = s.w.beweging !== 'zwemmen';
    this.groep.add(mesh, schaduw);
    const basisMaat = maat * (0.85 + Math.random() * 0.3);
    s.dieren.push({
      mesh,
      schaduw,
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

  magHier(s, dir) {
    const p = this.planeet;
    const beweging = s.w.beweging;
    if (beweging === 'vliegen' || beweging === 'zweven' || s.amfibie) return true;
    const zee = p.zeeStraal;
    const nat = zee > 0 && p.landStraal(dir) < zee - 0.0005;
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

    for (const s of this.soorten.values()) {
      this.bijwerken(s);
      const b = s.w.beweging;
      for (const d of s.dieren) {
        d.geboren += dt;
        if (d.geboren < 0) {
          d.mesh.visible = d.schaduw.visible = false;
          continue;
        }
        d.mesh.visible = true;

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
          const nieuweDir = d.dir.clone().multiplyScalar(Math.cos(hoek)).addScaledVector(d.koers, Math.sin(hoek));
          const goed = this.magHier(s, nieuweDir);
          if (goed || !this.magHier(s, d.dir)) {
            // Koers meedraaien zodat hij rechtdoor blijft gaan.
            d.koers.multiplyScalar(Math.cos(hoek)).addScaledVector(d.dir, -Math.sin(hoek));
            d.dir.copy(nieuweDir).normalize();
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
          // Niet te ver van huis: langzaam terugsturen naar hun eigen gebied.
          if (d.thuis && !d.vrij && d.dir.dot(d.thuis) < Math.cos(0.09)) {
            const naarHuis = d.thuis.clone().addScaledVector(d.dir, -d.thuis.dot(d.dir));
            if (naarHuis.lengthSq() > 1e-8) d.koers.lerp(naarHuis.normalize(), Math.min(1, dt * 1.5));
          }
          d.koers.addScaledVector(d.dir, -d.koers.dot(d.dir)).normalize();
        }
        if (actief && (b === 'lopen' || b === 'huppen') && Math.random() < dt * 0.1) d.pauze = 0.8 + Math.random() * 2;

        // ---- Hoogte ----
        const land = p.landStraal(d.dir);
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

        // Knipperen.
        d.knipper -= dt;
        if (d.knipper <= 0) {
          d.dicht = 0.14;
          d.knipper = 2 + Math.random() * 5;
        }
        d.dicht -= dt;
        d.mesh.material = d.dicht > 0 ? s.dicht : s.open;

        // Schaduw op de grond.
        if (b !== 'zwemmen') {
          const opGrond = Math.max(land, zee) + 0.0012 * p.r.grootte;
          d.schaduw.visible = true;
          d.schaduw.position.copy(n).multiplyScalar(opGrond);
          d.schaduw.quaternion.setFromUnitVectors(zAs, n);
          const los = Math.max(0, hoogte - grond) / (d.maat * 4 + 0.02);
          const sc = breed * 0.9 * Math.max(0.3, 1 - los);
          d.schaduw.scale.set(sc, sc * 0.6, 1);
          d.schaduw.material.opacity = Math.max(0.15, 1 - los);
        }
      }
    }
  }

  // Welk dier zit onder deze straal (in wereldcoördinaten)?
  raak(straal) {
    const raker = new THREE.Raycaster(straal.origin, straal.direction);
    const doelen = [];
    for (const s of this.soorten.values()) for (const d of s.dieren) if (d.mesh.visible) doelen.push(d.mesh);
    const hit = raker.intersectObjects(doelen, false)[0];
    if (!hit) return null;
    const s = this.soorten.get(hit.object.userData.soort);
    return { soort: s.w, dier: s.dieren.find((d) => d.mesh === hit.object) };
  }

  willekeurigDier(id) {
    const s = this.soorten.get(id);
    if (!s || !s.dieren.length) return null;
    return s.dieren[Math.floor(Math.random() * s.dieren.length)];
  }
}
