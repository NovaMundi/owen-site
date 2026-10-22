// Wat de beschaving op de planeet zichtbaar maakt: holen, kampvuren, hutten, akkers, steden met
// lichtjes, wegen, boten en af en toe een raket. Alles wordt opnieuw neergezet als er een
// nederzetting groeit of krimpt; vuur, boten en raketten bewegen elk beeldje.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { maakRandom } from '../ruis.js';
import { MATEN } from '../keuzes.js';
import { niveau } from './sim.js';

const MAX = { hol: 3000, wand: 4000, dak: 4000, akker: 2500, gebouw: 8000, boot: 400, raket: 12, heuvel: 1500 };

let puntTex = null;
function punt() {
  if (puntTex) return puntTex;
  const d = document.createElement('canvas');
  d.width = d.height = 64;
  const ctx = d.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  puntTex = new THREE.CanvasTexture(d);
  return puntTex;
}

function instanties(geo, mat, max) {
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.count = 0;
  m.frustumCulled = false;
  return m;
}

export class BeschavingLaag {
  constructor() {
    this.groep = new THREE.Group();
    const std = (kleur, extra = {}) => new THREE.MeshStandardMaterial({ color: kleur, roughness: 0.9, ...extra });
    this.hol = instanties(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std('#ffffff'), MAX.hol);
    this.wand = instanties(new THREE.CylinderGeometry(0.42, 0.48, 0.55, 8).translate(0, 0.275, 0), std('#ffffff'), MAX.wand);
    this.dak = instanties(new THREE.ConeGeometry(0.62, 0.55, 8).translate(0, 0.8, 0), std('#ffffff'), MAX.dak);
    this.akker = instanties(new THREE.BoxGeometry(1, 0.06, 0.7).translate(0, 0.03, 0), std('#ffffff'), MAX.akker);
    this.gebouw = instanties(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), std('#ffffff', { roughness: 0.6 }), MAX.gebouw);
    const romp = new THREE.BoxGeometry(1, 0.3, 0.4).translate(0, 0.15, 0);
    const zeil = new THREE.ConeGeometry(0.3, 0.9, 3).translate(0, 0.75, 0);
    this.boot = instanties(mergeGeometries([romp.toNonIndexed(), zeil.toNonIndexed()]), std('#f2ead8'), MAX.boot);
    const raketGeo = mergeGeometries(
      [new THREE.CylinderGeometry(0.18, 0.22, 1, 10).translate(0, 0.5, 0), new THREE.ConeGeometry(0.18, 0.4, 10).translate(0, 1.2, 0)].map((g) => g.toNonIndexed())
    );
    this.raket = instanties(raketGeo, std('#f4f4f4', { metalness: 0.4, roughness: 0.3 }), MAX.raket);
    // Zwermheuvels: hoge, hobbelige bergjes van aarde (zoals termietenheuvels).
    const heuvelGeo = new THREE.CylinderGeometry(0.12, 0.5, 1, 9, 5).translate(0, 0.5, 0);
    const hp = heuvelGeo.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
      const f = 1 + Math.sin(x * 9 + y * 7) * Math.sin(z * 8 - y * 5) * 0.18;
      hp.setXYZ(i, x * f, y, z * f);
    }
    heuvelGeo.computeVertexNormals();
    this.heuvel = instanties(heuvelGeo, std('#ffffff', { roughness: 1 }), MAX.heuvel);
    this.groep.add(this.hol, this.wand, this.dak, this.akker, this.gebouw, this.boot, this.raket, this.heuvel);

    // Vuurtjes en lichtjes: puntjes die gloeien.
    this.vuur = this.punten(600, '#ffae42', 1);
    this.licht = this.punten(9000, '#ffe9a8', 1);
    this.vlam = this.punten(MAX.raket * 12, '#ffb347', 1);
    this.wegen = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#c9a77a', transparent: true, opacity: 0.8 }));
    this.groep.add(this.wegen);

    this.boten = [];
    this.raketten = [];
    this.sleutel = '';
    this.tijd = 0;
  }

  punten(max, kleur) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(max), 1));
    g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({
      uniforms: { kaart: { value: punt() }, kleur: { value: new THREE.Color(kleur) }, flikker: { value: 1 } },
      vertexShader: `
        attribute float size;
        uniform float flikker;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * flikker * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D kaart;
        uniform vec3 kleur;
        void main() {
          vec4 t = texture2D(kaart, gl_PointCoord);
          gl_FragColor = vec4(kleur * 2.2, t.a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    this.groep.add(p);
    return p;
  }

  // Alles opnieuw neerzetten als er iets veranderd is.
  zet(wereld, regios, planeet, recept) {
    if (!wereld || !regios || !planeet) return this.leeg();
    const groepen = wereld.groepen
      .map((g) => ({ g, s: wereld.soorten[g.soort], n: wereld.soorten[g.soort] ? niveau(wereld.soorten[g.soort], g) : 0 }))
      .filter((x) => x.s && x.n > 0 && regios[x.g.regio]);
    const boten = groepen.filter((x) => x.s.tech.includes('boten') && regios[x.g.regio].kust).length;
    const raketten = Object.values(wereld.soorten).filter((s) => s.tech.includes('raket')).length;
    const sleutel = groepen.map((x) => `${x.g.regio}${x.s.id}${x.n}${x.s.vlaggen.heuvels ? 'h' : ''}`).join(',') + `|${boten}|${raketten}|${planeet.zeeR}|${planeet.maxR}|${recept.grootte}`;
    if (sleutel === this.sleutel) return;
    this.sleutel = sleutel;
    this.leeg(false);

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const omhoog = new THREE.Vector3(0, 1, 0), draai = new THREE.Quaternion(), kleur = new THREE.Color();
    const zee = planeet.zeeStraal;
    this.zeeStraal = zee;
    const vuurPos = [], vuurSize = [], lichtPos = [], lichtSize = [], weg = [];
    const plaats = (mesh, dir, schaal, kleurHex, hoek = 0, onder = false) => {
      if (mesh.count >= mesh.instanceMatrix.count) return null;
      const r = planeet.landStraal(dir);
      if (!onder && zee > 0 && r < zee) return null; // niet in het water bouwen
      v.copy(dir).multiplyScalar(r - schaal.y * 0.05);
      q.setFromUnitVectors(omhoog, dir).multiply(draai.setFromAxisAngle(omhoog, hoek));
      m4.compose(v, q, sc.copy(schaal));
      mesh.setMatrixAt(mesh.count, m4);
      mesh.setColorAt(mesh.count, kleur.set(kleurHex));
      mesh.count++;
      return v.clone();
    };
    const verspreid = (rnd, midden, straal) => {
      const t = new THREE.Vector3().randomDirection();
      t.addScaledVector(midden, -t.dot(midden)).normalize();
      return midden.clone().addScaledVector(t, Math.sqrt(rnd()) * straal).normalize();
    };

    const centra = new Map(); // voor wegen
    for (const { g, s, n } of groepen) {
      const reg = regios[g.regio];
      const midden = new THREE.Vector3(...reg.dir);
      const rnd = maakRandom(g.regio + s.id);
      const maat = Math.min(0.022, Math.max(0.006, (MATEN.find((m) => m.id === s.maat) || MATEN[1]).maat * (s.genen.grootte || 1)));
      const onder = s.beweging === 'zwemmen' && !reg.land; // koraaldorpen op de zeebodem
      const eigen = s.kleur ? new THREE.Color().setHSL(s.kleur.h, Math.min(0.75, s.kleur.s), 0.55).getHexString() : 'c0704a';
      // Hoe ze bouwen hangt af van waar ze vandaan komen: iglo's, leem, lavasteen of hout.
      const land = s.thuisLand;
      const wandKleur = onder ? '#ff9ec7' : land === 'woestijn' ? '#c99a6b' : land === 'lava' ? '#3d3936' : land === 'berg' ? '#9a948c' : '#e8d3a8';
      const dakKleur = onder ? '#5ad1c4' : land === 'woestijn' ? '#b07f55' : land === 'lava' ? '#5c534c' : '#' + eigen;
      const straal = 0.035 + n * 0.012;
      // Zwermheuvels van soorten die niet praten maar wel samen bouwen.
      if (s.vlaggen.heuvels && !s.tech.includes('taal') && g.pop > 20 && !onder) {
        const aantal = Math.min(5, 1 + Math.floor(Math.log10(g.pop)));
        for (let i = 0; i < aantal; i++) {
          const h = maat * (1.1 + rnd() * 1.3);
          plaats(this.heuvel, verspreid(rnd, midden, straal), new THREE.Vector3(h * 0.6, h, h * 0.6), ['#a8784e', '#9a6c45', '#b88a5c'][i % 3], rnd() * 6);
        }
      }
      if (n >= 1) for (let i = 0; i < 3; i++) plaats(this.hol, verspreid(rnd, midden, straal), sc.set(maat * 0.9, maat * 0.45, maat * 0.9).clone(), onder ? '#c98a6a' : '#4a3a2e', 0, onder);
      if (n >= 2 && !onder) {
        const p = plaats(this.hol, midden.clone(), new THREE.Vector3(maat * 0.6, maat * 0.12, maat * 0.6), '#6b6b6b');
        if (p) {
          vuurPos.push(p.addScaledVector(midden, maat * 0.25));
          vuurSize.push(maat * 0.9);
        }
      }
      const hutten = n >= 6 ? 0 : n === 5 ? 6 : n === 4 ? 9 : n === 3 ? 4 : 0;
      for (let i = 0; i < hutten; i++) {
        const dir = verspreid(rnd, midden, straal);
        const s3 = new THREE.Vector3(maat * 1.3, maat * 1.3, maat * 1.3);
        if (land === 'ijs' && !onder) plaats(this.hol, dir, new THREE.Vector3(maat * 1.6, maat * 1.1, maat * 1.6), '#f4f8ff', 0); // iglo
        else if (plaats(this.wand, dir, s3, wandKleur, rnd() * 6, onder)) plaats(this.dak, dir, s3, dakKleur, rnd() * 6, onder);
      }
      if (n >= 4 && !onder) {
        const akkerKleuren = ['#e7c65a', '#9ccc5a', '#c9a24a', '#7fbf4a'];
        for (let i = 0; i < (n >= 5 ? 8 : 5); i++) {
          const dir = verspreid(rnd, midden, straal * 1.6);
          plaats(this.akker, dir, new THREE.Vector3(maat * 2.6, maat, maat * 2.6), akkerKleuren[i % 4], rnd() * 6);
        }
      }
      if (n >= 5) {
        const aantal = n === 6 ? 34 : 16;
        for (let i = 0; i < aantal; i++) {
          const dir = verspreid(rnd, midden, straal * (n === 6 ? 1.1 : 0.9));
          const hoog = maat * (n === 6 ? 1.5 + rnd() ** 2 * 5 : 1 + rnd() * 1.8);
          const breed = maat * (0.9 + rnd() * 0.6);
          const steen = onder ? ['#ff9ec7', '#5ad1c4', '#ffd36b'][i % 3] : n === 6 ? ['#d9dde3', '#aab4c0', '#' + eigen, '#eef1f4'][i % 4] : ['#d8c7a6', '#c2ad8a', '#' + eigen][i % 3];
          const p = plaats(this.gebouw, dir, new THREE.Vector3(breed, hoog, breed), steen, rnd() * 6, onder);
          if (p && (n === 6 || s.tech.includes('stroom') || s.tech.includes('kristal'))) {
            const lagen = Math.max(1, Math.round(hoog / maat));
            for (let k = 0; k < lagen; k++) {
              lichtPos.push(p.clone().addScaledVector(dir, hoog * (0.25 + (0.6 * k) / lagen)).addScaledVector(new THREE.Vector3().randomDirection(), breed * 0.4));
              lichtSize.push(maat * 0.35);
            }
          }
        }
      }
      if (n >= 4) {
        if (!centra.has(s.id)) centra.set(s.id, []);
        centra.get(s.id).push({ regio: g.regio, dir: midden });
      }
    }

    // Wegen tussen naburige dorpen en steden van dezelfde soort.
    for (const [, lijst] of centra) {
      const ids = new Set(lijst.map((c) => c.regio));
      for (const c of lijst) {
        for (const b of regios[c.regio].buren) {
          if (b < c.regio || !ids.has(b)) continue;
          const doel = new THREE.Vector3(...regios[b].dir);
          const punten = [];
          let nat = false;
          for (let k = 0; k <= 10; k++) {
            const dir = c.dir.clone().lerp(doel, k / 10).normalize();
            const r = planeet.landStraal(dir);
            if (zee > 0 && r < zee) nat = true; // geen wegen over zee
            punten.push(dir.multiplyScalar(Math.max(r, zee) + 0.0012 * recept.grootte));
          }
          if (nat) continue;
          for (let k = 1; k < punten.length; k++) weg.push(punten[k - 1].x, punten[k - 1].y, punten[k - 1].z, punten[k].x, punten[k].y, punten[k].z);
        }
      }
    }
    this.wegen.geometry.dispose();
    this.wegen.geometry = new THREE.BufferGeometry();
    this.wegen.geometry.setAttribute('position', new THREE.Float32BufferAttribute(weg, 3));

    // Boten varen rondjes voor de kust.
    this.boten = [];
    for (const { g, s } of groepen) {
      const reg = regios[g.regio];
      if (!s.tech.includes('boten') || !reg.kust || s.beweging === 'zwemmen') continue;
      const midden = new THREE.Vector3(...reg.dir);
      const rnd = maakRandom('boot' + g.regio + s.id);
      for (let poging = 0; poging < 12 && this.boten.length < MAX.boot; poging++) {
        const dir = verspreid(rnd, midden, 0.14);
        if (planeet.landStraal(dir) < zee - 0.002) {
          this.boten.push({ midden: dir, as: dir.clone(), hoek: rnd() * 6.28, straal: 0.02 + rnd() * 0.03, snel: 0.15 + rnd() * 0.15, maat: 0.006 });
          if (this.boten.length % 2 === 0) break;
        }
      }
    }
    this.boot.count = this.boten.length;

    // Raketten staan bij de grootste stad van een soort die ze heeft uitgevonden.
    this.raketten = [];
    for (const s of Object.values(wereld.soorten)) {
      if (!s.tech.includes('raket')) continue;
      const stad = groepen.filter((x) => x.s === s && regios[x.g.regio].land).sort((a, b) => b.g.pop - a.g.pop)[0];
      if (!stad) continue;
      const dir = new THREE.Vector3(...regios[stad.g.regio].dir);
      this.raketten.push({ dir, hoogte: 0, wacht: 5 + Math.random() * 30, grond: planeet.landStraal(dir) });
    }
    this.raket.count = this.raketten.length;

    this.vulPunten(this.vuur, vuurPos, vuurSize);
    this.vulPunten(this.licht, lichtPos, lichtSize);
    for (const m of [this.hol, this.wand, this.dak, this.akker, this.gebouw, this.heuvel]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  vulPunten(p, posities, maten) {
    const pos = p.geometry.attributes.position, size = p.geometry.attributes.size;
    const n = Math.min(posities.length, size.count);
    for (let i = 0; i < n; i++) {
      pos.setXYZ(i, posities[i].x, posities[i].y, posities[i].z);
      size.setX(i, maten[i] * 3.2); // wereldmaat naar beeldpunten (zie de shader)
    }
    pos.needsUpdate = size.needsUpdate = true;
    p.geometry.setDrawRange(0, n);
  }

  leeg(ookSleutel = true) {
    if (ookSleutel) this.sleutel = '';
    for (const m of [this.hol, this.wand, this.dak, this.akker, this.gebouw, this.boot, this.raket, this.heuvel]) m.count = 0;
    for (const p of [this.vuur, this.licht, this.vlam]) p.geometry.setDrawRange(0, 0);
    this.wegen.geometry.setDrawRange(0, 0);
    this.boten = [];
    this.raketten = [];
  }

  update(dt) {
    this.tijd += dt;
    this.vuur.material.uniforms.flikker.value = 0.8 + Math.sin(this.tijd * 17) * 0.12 + Math.sin(this.tijd * 31) * 0.08;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), t = new THREE.Vector3();
    const omhoog = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), voor = new THREE.Vector3(1, 0, 0);
    this.boten.forEach((b, i) => {
      b.hoek += dt * b.snel;
      // Rondje varen rond een punt in zee.
      t.set(1, 0, 0);
      if (Math.abs(b.midden.x) > 0.9) t.set(0, 1, 0);
      t.addScaledVector(b.midden, -t.dot(b.midden)).normalize();
      const t2 = new THREE.Vector3().crossVectors(b.midden, t);
      const dir = b.midden.clone().addScaledVector(t, Math.cos(b.hoek) * b.straal).addScaledVector(t2, Math.sin(b.hoek) * b.straal).normalize();
      const r = this.zeeStraal || 1;
      v.copy(dir).multiplyScalar(r);
      const vaar = t.clone().multiplyScalar(-Math.sin(b.hoek)).addScaledVector(t2, Math.cos(b.hoek));
      q.setFromUnitVectors(omhoog, dir);
      const lokaalVoor = voor.clone().applyQuaternion(q);
      const hoek = Math.atan2(lokaalVoor.clone().cross(vaar).dot(dir), lokaalVoor.dot(vaar));
      q.multiply(new THREE.Quaternion().setFromAxisAngle(omhoog, hoek));
      m4.compose(v, q, sc.setScalar(b.maat));
      this.boot.setMatrixAt(i, m4);
    });
    if (this.boten.length) this.boot.instanceMatrix.needsUpdate = true;

    // Raketten: wachten, opstijgen met een vlammenstaart, en weer opnieuw.
    const vlamPos = [], vlamSize = [];
    this.raketten.forEach((r, i) => {
      r.wacht -= dt;
      if (r.wacht < 0) r.hoogte += dt * (0.02 + r.hoogte * 0.8);
      if (r.hoogte > 2.5) {
        r.hoogte = 0;
        r.wacht = 40 + Math.random() * 40;
      }
      v.copy(r.dir).multiplyScalar(r.grond + r.hoogte);
      q.setFromUnitVectors(omhoog, r.dir);
      m4.compose(v, q, sc.setScalar(0.012));
      this.raket.setMatrixAt(i, m4);
      if (r.wacht < 0) {
        for (let k = 0; k < 10; k++) {
          vlamPos.push(v.clone().addScaledVector(r.dir, -0.004 - k * 0.003 - Math.random() * 0.002));
          vlamSize.push(0.006 * (1 - k / 12) + Math.random() * 0.002);
        }
      }
    });
    if (this.raketten.length) this.raket.instanceMatrix.needsUpdate = true;
    this.vulPunten(this.vlam, vlamPos, vlamSize);
  }
}
