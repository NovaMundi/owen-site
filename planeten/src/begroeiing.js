// Begroeiing dichtbij: als je inzoomt, groeien rond de plek waar je kijkt grassprieten,
// bloemetjes, struikjes, varens, steentjes, cactussen (in de woestijn) en zeewier (in ondiep
// water). Van ver zijn ze er niet: dan zie je ze toch niet, en zo blijft het vlot op een tablet.
//
// De plekjes liggen vast op de planeet (elke plek heeft zijn eigen toevalsgetal), dus als je
// verder kijkt, komen er aan de rand nieuwe bij en verdwijnen er achter je, zonder dat alles
// opnieuw door elkaar springt. Aan de rand groeien ze zacht in en uit.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAX = { gras: 2600, bloem: 500, steen: 500, struik: 200, varen: 400, cactus: 80, wier: 400 };
const ASSEN = [
  [0, 1, 2], [0, -1, 2], [1, 0, 2], [1, -1, 2], [2, 0, 1], [2, -1, 1], // as, teken, de andere twee
];

// Toevalsgetal dat bij een vaste plek hoort.
function hash(a, b, c, d) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2147483647) ^ Math.imul(d, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---- Vormpjes ----
function kleurOpHoogte(geo, onder, boven) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const p = geo.attributes.position;
  const k = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - min.y) / Math.max(1e-9, max.y - min.y);
    const l = onder + (boven - onder) * t;
    k[i * 3] = k[i * 3 + 1] = k[i * 3 + 2] = l;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(k, 3));
  return geo;
}
const alleen = (g) => {
  g = g.index ? g.toNonIndexed() : g;
  for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
  return g;
};
const samen = (lijst) => mergeGeometries(lijst.map(alleen));

function sprietjes(aantal, hoog, breed, buig) {
  const pos = [];
  for (let i = 0; i < aantal; i++) {
    const a = (i / aantal) * Math.PI * 2 + i * 0.7;
    const r = breed * (0.3 + (i % 3) * 0.35);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = hoog * (0.7 + ((i * 37) % 10) / 22);
    const lx = Math.cos(a) * buig * h, lz = Math.sin(a) * buig * h;
    const px = -Math.sin(a) * breed * 0.18, pz = Math.cos(a) * breed * 0.18;
    pos.push(x - px, 0, z - pz, x + px, 0, z + pz, x + lx, h, z + lz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return naarBoven(g);
}
// Dunne blaadjes krijgen het licht zoals de grond eronder (anders is de achterkant zwart).
function naarBoven(g) {
  const n = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < n.length; i += 3) n[i + 1] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}
function bladeren(aantal, lang, breed, hangt, hoogte) {
  const lijst = [];
  for (let i = 0; i < aantal; i++) {
    const b = new THREE.PlaneGeometry(lang, breed, 5, 1).translate(lang / 2, 0, 0);
    const p = b.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const t = p.getX(k) / lang;
      p.setY(k, p.getY(k) * (1 - t * 0.8));
      p.setZ(k, -t * t * hangt + t * hoogte);
    }
    b.rotateX(-Math.PI / 2).rotateY((i / aantal) * Math.PI * 2 + i * 0.4);
    lijst.push(b);
  }
  return naarBoven(samen(lijst));
}
function bobbels(stukken, mate) {
  const g = samen(stukken);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = 1 + Math.sin(x * 9100) * Math.sin(y * 8300 + 1) * Math.sin(z * 7700 + 2) * mate;
    p.setXYZ(i, x * f, y * f, z * f);
  }
  g.computeVertexNormals();
  return g;
}

function maakVormen() {
  const gras = kleurOpHoogte(sprietjes(7, 0.0016, 0.0006, 0.35), 0.7, 1.3);
  const bloem = samen([
    sprietjes(3, 0.0017, 0.0002, 0.1),
    new THREE.IcosahedronGeometry(0.0004, 1).scale(1, 0.6, 1).translate(0, 0.0018, 0),
    new THREE.IcosahedronGeometry(0.00032, 1).scale(1, 0.6, 1).translate(0.0005, 0.0014, 0.0002),
  ]);
  // De bloem: steeltjes groen, bolletjes in de bloemkleur (via de kleur per hoogte).
  const bk = new Float32Array(bloem.attributes.position.count * 3);
  for (let i = 0; i < bloem.attributes.position.count; i++) {
    const kop = bloem.attributes.position.getY(i) > 0.00118;
    bk.set(kop ? [1, 1, 1] : [0.25, 0.55, 0.2], i * 3);
  }
  bloem.setAttribute('color', new THREE.BufferAttribute(bk, 3));
  const steen = bobbels([new THREE.IcosahedronGeometry(0.0007, 1).scale(1, 0.55, 0.8)], 0.18);
  kleurOpHoogte(steen, 0.7, 1.05);
  const struik = bobbels([
    new THREE.IcosahedronGeometry(0.0012, 1).translate(0, 0.0009, 0),
    new THREE.IcosahedronGeometry(0.0009, 1).translate(0.0009, 0.0007, 0.0003),
    new THREE.IcosahedronGeometry(0.0009, 1).translate(-0.0007, 0.0008, -0.0006),
  ], 0.1);
  kleurOpHoogte(struik, 0.5, 1.1);
  const varen = kleurOpHoogte(bladeren(7, 0.0024, 0.0006, 0.0012, 0.0016), 0.7, 1.2);
  const cactus = samen([
    new THREE.CylinderGeometry(0.00045, 0.0005, 0.004, 8).translate(0, 0.002, 0),
    new THREE.SphereGeometry(0.00045, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.004, 0),
    new THREE.CylinderGeometry(0.0003, 0.0003, 0.0014, 6).translate(0.0009, 0.0026, 0),
    new THREE.CylinderGeometry(0.0003, 0.0003, 0.0008, 6).rotateZ(Math.PI / 2).translate(0.0006, 0.0019, 0),
    new THREE.CylinderGeometry(0.0003, 0.0003, 0.001, 6).translate(-0.0008, 0.0022, 0),
    new THREE.CylinderGeometry(0.0003, 0.0003, 0.0006, 6).rotateZ(Math.PI / 2).translate(-0.0005, 0.0017, 0),
  ]);
  kleurOpHoogte(cactus, 0.75, 1.05);
  const wier = kleurOpHoogte(sprietjes(5, 0.0034, 0.0004, 0.12), 0.6, 1.2);
  return { gras, bloem, steen, struik, varen, cactus, wier };
}

export class Begroeiing {
  constructor(planeet, wind) {
    this.p = planeet;
    this.groep = new THREE.Group();
    this.groep.visible = false;
    this.u = { uMid: { value: new THREE.Vector3() }, uStraal: { value: 0.03 }, uWind: wind.uWind };
    this.lagen = {};
    const vormen = maakVormen();
    for (const [naam, geo] of Object.entries(vormen)) {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: naam === 'steen' ? 0.95 : 0.8, side: ['gras', 'bloem', 'varen', 'wier'].includes(naam) ? THREE.DoubleSide : THREE.FrontSide });
      const wiegt = naam !== 'steen' && naam !== 'cactus';
      const sterk = naam === 'wier' ? 3 : 1;
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, this.u);
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uMid;\nuniform float uStraal;\nuniform float uWind;').replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec3 plek = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          // Aan de rand van het gebied zacht ingroeien in plaats van ineens verschijnen.
          float groot = 1.0 - smoothstep(uStraal * 0.65, uStraal, distance(plek, uMid));
          ${wiegt ? `float fase = uWind * ${(2.2 * sterk).toFixed(1)} + dot(plek, vec3(2100.0, 1700.0, 1300.0));
          float buig = transformed.y * 400.0;
          transformed.x += sin(fase) * buig * transformed.y * ${(0.25 * sterk).toFixed(2)};
          transformed.z += cos(fase * 0.8) * buig * transformed.y * ${(0.18 * sterk).toFixed(2)};` : ''}
          transformed *= groot;`
        );
      };
      const m = new THREE.InstancedMesh(geo, mat, MAX[naam]);
      m.count = 0;
      m.frustumCulled = false;
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX[naam] * 3), 3);
      this.lagen[naam] = m;
      this.groep.add(m);
    }
    this.vorige = null;
    this.vuil = true;
  }

  // Elk beeldje: kijkt de camera dichtbij? Dan rond die plek begroeiing neerzetten.
  bij(cameraLokaal) {
    const p = this.p;
    const afstand = cameraLokaal.length();
    const dir = cameraLokaal.clone().divideScalar(afstand || 1);
    const grond = p.landStraal(dir) / p.r.grootte;
    const hoogte = afstand - Math.max(grond, p.zeeR);
    if (hoogte > 0.07) {
      this.groep.visible = false;
      return;
    }
    this.groep.visible = true;
    const straal = Math.min(0.06, Math.max(0.01, hoogte * 3.2 + 0.006));
    const v = this.vorige;
    if (!this.vuil && v && dir.angleTo(v.dir) < v.straal * 0.3 && straal < v.straal * 1.3 && straal > v.straal * 0.75) return;
    this.vuil = false;
    this.vorige = { dir, straal };
    this.zaai(dir, straal);
  }

  zaai(mid, straal) {
    const p = this.p;
    const n = p.n, d = p.dirs;
    this.zoek ||= maakZoeker(d, n);
    const kleuren = p.geo.attributes.color.array, bodem = p.geo.attributes.bodem.array;
    const zeeR = p.zeeR;
    const tel = Object.fromEntries(Object.keys(this.lagen).map((k) => [k, 0]));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), nrm = new THREE.Vector3();
    const omhoog = new THREE.Vector3(0, 1, 0), draai = new THREE.Quaternion(), kleur = new THREE.Color();
    // Rooster op de kubus (zoals de planeet zelf gemaakt is): één plekje per hokje.
    const stap = straal / 15;
    const cosMax = Math.cos(straal);
    this.u.uStraal.value = straal;
    for (let f = 0; f < 6; f++) {
      const [as, teken, andere] = ASSEN[f];
      const a = [0, 1, 2].filter((x) => x !== as);
      const mAs = mid.getComponent(as) * (teken < 0 ? -1 : 1);
      if (mAs < 0.3) continue;
      const u0 = mid.getComponent(a[0]) / mAs, v0 = mid.getComponent(a[1]) / mAs;
      const bereik = straal * 2.2;
      const iu0 = Math.floor((u0 - bereik) / stap), iu1 = Math.floor((u0 + bereik) / stap);
      const iv0 = Math.floor((v0 - bereik) / stap), iv1 = Math.floor((v0 + bereik) / stap);
      for (let iu = iu0; iu <= iu1; iu++) {
        for (let iv = iv0; iv <= iv1; iv++) {
          const zaad = Math.round(1 / stap);
          const r1 = hash(f, iu, iv, zaad), r2 = hash(f, iv, iu, zaad + 7), r3 = hash(iu, f, iv, zaad + 13);
          const u = (iu + r1) * stap, w = (iv + r2) * stap;
          if (Math.abs(u) > 1 || Math.abs(w) > 1) continue; // hoort bij een andere kant van de kubus
          pos.set(0, 0, 0).setComponent(as, teken < 0 ? -1 : 1).setComponent(a[0], u).setComponent(a[1], w).normalize();
          if (pos.dot(mid) < cosMax) continue;
          const i = this.zoek(pos);
          if (i < 0) continue;
          const rad = p.landStraal(pos) / p.r.grootte;
          const bioom = p.bioom[i];
          const [wZ, wR, wS] = [bodem[i * 3], bodem[i * 3 + 1], bodem[i * 3 + 2]];
          let soort = null;
          if (zeeR > 0 && rad < zeeR) {
            if (zeeR - rad < 0.009 && r3 < 0.45) soort = 'wier';
          } else if (wS > 0.5) {
            soort = r3 < 0.08 ? 'steen' : null;
          } else if (wR > 0.55) {
            soort = r3 < 0.35 ? 'steen' : r3 < 0.45 ? 'gras' : null;
          } else if (wZ > 0.5) {
            if (bioom === 3) soort = r3 < 0.035 ? 'cactus' : r3 < 0.12 ? 'steen' : r3 < 0.2 ? 'gras' : null;
            else soort = r3 < 0.08 ? 'steen' : r3 < 0.14 ? 'gras' : null;
          } else if (bioom === 4) {
            soort = r3 < 0.3 ? 'varen' : r3 < 0.4 ? 'struik' : 'gras';
          } else if (bioom === 2) {
            soort = r3 < 0.15 ? 'steen' : r3 < 0.55 ? 'gras' : null;
          } else {
            soort = r3 < 0.68 ? 'gras' : r3 < 0.84 ? 'bloem' : r3 < 0.9 ? 'struik' : r3 < 0.96 ? 'varen' : 'steen';
          }
          if (!soort || tel[soort] >= MAX[soort]) continue;
          const laag = this.lagen[soort];
          const nr = tel[soort]++;
          nrm.copy(pos);
          pos.multiplyScalar(rad - 0.00015);
          q.setFromUnitVectors(omhoog, nrm).multiply(draai.setFromAxisAngle(omhoog, r1 * 6.283));
          const g = 0.7 + r2 * 0.7;
          s.set(g, g * (0.8 + r1 * 0.5), g);
          m.compose(pos, q, s);
          laag.setMatrixAt(nr, m);
          // Kleur: de grond van die plek, een beetje gevarieerd. Bloemen in vrolijke kleuren.
          kleur.setRGB(kleuren[i * 3], kleuren[i * 3 + 1], kleuren[i * 3 + 2]);
          if (soort === 'gras' || soort === 'varen' || soort === 'struik') kleur.offsetHSL((r1 - 0.5) * 0.04, 0.05, (r2 - 0.5) * 0.1 + (soort === 'struik' ? -0.08 : 0.02));
          else if (soort === 'bloem') kleur.setHSL([0.0, 0.12, 0.15, 0.6, 0.8, 0.93][Math.floor(r2 * 6)], 0.75, 0.68);
          else if (soort === 'steen') kleur.lerp(new THREE.Color(0.55, 0.53, 0.5), 0.6).offsetHSL(0, 0, (r1 - 0.5) * 0.15);
          else if (soort === 'cactus') kleur.setHSL(0.3 + r1 * 0.05, 0.45, 0.32);
          else if (soort === 'wier') kleur.setHSL(0.28 + r1 * 0.08, 0.55, 0.25);
          laag.setColorAt(nr, kleur);
        }
      }
    }
    for (const [naam, laag] of Object.entries(this.lagen)) {
      laag.count = tel[naam];
      laag.instanceMatrix.needsUpdate = true;
      laag.instanceColor.needsUpdate = true;
    }
    this.u.uMid.value.copy(mid).multiplyScalar(p.landStraal(mid) / p.r.grootte);
  }
}

// Snel het dichtstbijzijnde punt van de planeet vinden: alle punten in hokjes op de kubus.
function maakZoeker(dirs, n) {
  const G = 96;
  const hokjes = new Int32Array(6 * G * G).fill(-1);
  const hok = (x, y, z) => {
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    let f, u, v;
    if (ax >= ay && ax >= az) (f = x > 0 ? 0 : 1), (u = y / ax), (v = z / ax);
    else if (ay >= az) (f = y > 0 ? 2 : 3), (u = x / ay), (v = z / ay);
    else (f = z > 0 ? 4 : 5), (u = x / az), (v = y / az);
    const iu = Math.min(G - 1, Math.floor((u * 0.5 + 0.5) * G)), iv = Math.min(G - 1, Math.floor((v * 0.5 + 0.5) * G));
    return f * G * G + iu * G + iv;
  };
  for (let i = 0; i < n; i++) hokjes[hok(dirs[i * 3], dirs[i * 3 + 1], dirs[i * 3 + 2])] = i;
  return (v) => {
    const h = hokjes[hok(v.x, v.y, v.z)];
    if (h >= 0) return h;
    // Leeg hokje (komt bijna niet voor): de buren proberen.
    for (const [dx, dy, dz] of [[0.01, 0, 0], [-0.01, 0, 0], [0, 0.01, 0], [0, -0.01, 0], [0, 0, 0.01], [0, 0, -0.01]]) {
      const k = hokjes[hok(v.x + dx, v.y + dy, v.z + dz)];
      if (k >= 0) return k;
    }
    return -1;
  };
}
