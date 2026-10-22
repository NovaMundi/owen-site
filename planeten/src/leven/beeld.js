// Wat de beschaving op de planeet zichtbaar maakt: holen, kampvuren, hutten, akkers, steden met
// lichtjes, wegen, boten en af en toe een raket. Alles wordt opnieuw neergezet als er een
// nederzetting groeit of krimpt; vuur, boten en raketten bewegen elk beeldje.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { maakRandom } from '../ruis.js';
import { MATEN } from '../keuzes.js';
import { niveau } from './sim.js';

const MAX = { hol: 3000, wand: 4000, dak: 4000, akker: 2500, gebouw: 8000, boot: 400, raket: 12, heuvel: 1500, fabriek: 600, molen: 600, koraal: 1500 };

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

// ---- Bouwwerken in kleistijl (zie kunst/iconen/bouw-*.webp voor de voorbeelden) ----
// Elke vorm is één samengevoegd stuk met licht en donker in de hoekpunten (deur, raam, schaduw).
// De kleur per huisje komt er via de instance-kleur bovenop. Zo blijven het weinig tekenopdrachten.
function grijs(geo, l) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  for (const n of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(n)) geo.deleteAttribute(n);
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  const k = new Float32Array(geo.attributes.position.count * 3);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = typeof l === 'function' ? l(p.getX(i), p.getY(i), p.getZ(i)) : l;
    k[i * 3] = k[i * 3 + 1] = k[i * 3 + 2] = v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(k, 3));
  return geo;
}
const samenVoeg = (lijst) => mergeGeometries(lijst);
function vormen() {
  // Hol (ook iglo): koepel met een donkere ingang aan de voorkant.
  const hol = grijs(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), (x, y, z) => (z > 0.28 && y < 0.27 && Math.abs(x) < 0.2 ? 0.12 : 0.8 + y * 0.5));
  // Hut: ronde muur met deur en raampje.
  const wand = samenVoeg([
    grijs(new THREE.CylinderGeometry(0.42, 0.48, 0.55, 12).translate(0, 0.275, 0), (x, y) => 0.82 + y * 0.35),
    grijs(new THREE.BoxGeometry(0.18, 0.3, 0.06).translate(0, 0.15, 0.46), 0.3),
    grijs(new THREE.BoxGeometry(0.12, 0.12, 0.06).rotateY(1.4).translate(0.43, 0.33, 0.09), 0.22),
  ]);
  // Dak: puntdak met een knopje bovenop; onderrand iets donkerder.
  const dak = samenVoeg([
    grijs(new THREE.ConeGeometry(0.64, 0.55, 12, 2).translate(0, 0.8, 0), (x, y) => 0.75 + (y - 0.52) * 0.8),
    grijs(new THREE.SphereGeometry(0.08, 6, 4).translate(0, 1.1, 0), 0.7),
  ]);
  // Akker: voren (strepen licht en donker).
  const akker = grijs(new THREE.BoxGeometry(1, 0.06, 0.7, 8, 1, 1).translate(0, 0.03, 0), (x) => (Math.round((x + 0.5) * 8) % 2 ? 0.75 : 1.05));
  // Stadshuis: blok met een plat dak dat net iets uitsteekt.
  const gebouw = samenVoeg([
    grijs(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), (x, y) => 0.8 + y * 0.25),
    grijs(new THREE.BoxGeometry(1.08, 0.06, 1.08).translate(0, 1.0, 0), 0.6),
  ]);
  // Fabriek: hal met zaagtanddak en een hoge schoorsteen.
  const fabriek = samenVoeg([
    grijs(new THREE.BoxGeometry(1, 0.55, 0.7).translate(0, 0.275, 0), 0.9),
    grijs(new THREE.CylinderGeometry(0.0001, 0.36, 0.25, 4, 1).rotateY(Math.PI / 4).scale(1.35, 1, 0.9).translate(-0.2, 0.67, 0), 0.65),
    grijs(new THREE.CylinderGeometry(0.0001, 0.36, 0.25, 4, 1).rotateY(Math.PI / 4).scale(1.35, 1, 0.9).translate(0.25, 0.67, 0), 0.65),
    grijs(new THREE.CylinderGeometry(0.08, 0.11, 1.1, 8).translate(0.38, 0.55, -0.2), (x, y) => (Math.floor(y * 6) % 2 ? 1.1 : 0.55)),
    grijs(new THREE.BoxGeometry(0.22, 0.28, 0.04).translate(-0.15, 0.14, 0.36), 0.35),
  ]);
  // Windmolen: mast met een kopje (de wieken draaien apart).
  const mast = grijs(samenVoeg([
    new THREE.CylinderGeometry(0.035, 0.07, 1.4, 6).translate(0, 0.7, 0),
    new THREE.BoxGeometry(0.12, 0.1, 0.2).translate(0, 1.42, 0.03),
  ].map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    g.deleteAttribute('uv');
    return g;
  })), 1);
  const wiek = new THREE.BoxGeometry(0.06, 0.62, 0.015).translate(0, 0.31, 0);
  const rotor = grijs(mergeGeometries([0, 1, 2].map((k) => wiek.clone().rotateZ((k * Math.PI * 2) / 3).toNonIndexed()).map((g) => {
    g.deleteAttribute('uv');
    return g;
  })), 1);
  // Koraal: vertakte armpjes met bolletjes, voor wezens die onder water wonen.
  const takken = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, h = 0.45 + (i % 3) * 0.18, schuin = 0.35 + (i % 2) * 0.25;
    const tak = new THREE.CylinderGeometry(0.05, 0.08, h, 6).translate(0, h / 2, 0).rotateZ(schuin).rotateY(a);
    const top = new THREE.Vector3(0, h, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), schuin).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    takken.push(tak, new THREE.SphereGeometry(0.09, 6, 4).translate(top.x, top.y, top.z));
  }
  takken.push(new THREE.CylinderGeometry(0.12, 0.16, 0.3, 7).translate(0, 0.15, 0));
  const koraal = grijs(mergeGeometries(takken.map((g) => g.toNonIndexed())), (x, y) => 0.7 + y * 0.5);
  return { hol, wand, dak, akker, gebouw, fabriek, mast, rotor, koraal };
}

export class BeschavingLaag {
  constructor() {
    this.groep = new THREE.Group();
    const std = (kleur, extra = {}) => new THREE.MeshStandardMaterial({ color: kleur, roughness: 0.9, ...extra });
    // Klei: mat licht, kleur per hoekpunt (Lambert is ook nog eens zuinig voor de tablet).
    const klei = () => new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true });
    const v = vormen();
    this.hol = instanties(v.hol, klei(), MAX.hol);
    this.wand = instanties(v.wand, klei(), MAX.wand);
    this.dak = instanties(v.dak, klei(), MAX.dak);
    this.akker = instanties(v.akker, klei(), MAX.akker);
    this.gebouw = instanties(v.gebouw, klei(), MAX.gebouw);
    this.fabriek = instanties(v.fabriek, klei(), MAX.fabriek);
    this.mast = instanties(v.mast, klei(), MAX.molen);
    this.rotor = instanties(v.rotor, klei(), MAX.molen);
    this.koraal = instanties(v.koraal, klei(), MAX.koraal);
    this.groep.add(this.fabriek, this.mast, this.rotor, this.koraal);
    this.molens = [];
    this.rookBronnen = [];
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
    this.rook = this.punten(MAX.fabriek * 5, '#8a8f99', 1, true);
    this.wegen = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#c9a77a', transparent: true, opacity: 0.8 }));
    this.groep.add(this.wegen);

    this.boten = [];
    this.raketten = [];
    this.sleutel = '';
    this.tijd = 0;
  }

  punten(max, kleur, _ = 1, rook = false) {
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
          gl_FragColor = ${rook ? "vec4(kleur, t.a * 0.55)" : "vec4(kleur * 2.2, t.a)"};
        }`,
      transparent: true,
      depthWrite: false,
      blending: rook ? THREE.NormalBlending : THREE.AdditiveBlending,
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
    const sleutel = groepen.map((x) => `${x.g.regio}${x.s.id}${x.n}${x.s.vlaggen.heuvels ? 'h' : ''}${x.s.tech.length}`).join(',') + `|${boten}|${raketten}|${planeet.zeeR}|${planeet.maxR}|${recept.grootte}`;
    if (sleutel === this.sleutel) return;
    // Niet bij elke kleine verandering alles opnieuw neerzetten (dat hapert op een tablet): hooguit
    // eens per 6 seconden, behalve als de planeet zelf veranderd is of er nog niets staat.
    const planeetSleutel = `${planeet.zeeR}|${planeet.maxR}|${recept.grootte}|${planeet.kwaliteit}`;
    const nu = performance.now();
    if (this.sleutel && planeetSleutel === this.planeetSleutel && nu - (this.laatsteZet || 0) < 6000) return;
    if (planeetSleutel !== this.planeetSleutel) this.grond = new Map(); // grondhoogtes opnieuw
    this.planeetSleutel = planeetSleutel;
    this.laatsteZet = nu;
    this.sleutel = sleutel;
    this.leeg(false);

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const omhoog = new THREE.Vector3(0, 1, 0), draai = new THREE.Quaternion(), kleur = new THREE.Color();
    const zee = planeet.zeeStraal;
    this.zeeStraal = zee;
    const vuurPos = [], vuurSize = [], lichtPos = [], lichtSize = [], weg = [];
    // De grondhoogte is duur om uit te rekenen; elke plek maar één keer.
    this.grond ||= new Map();
    const grondOnder = (dir) => {
      const k = `${dir.x.toFixed(4)},${dir.y.toFixed(4)},${dir.z.toFixed(4)}`;
      let r = this.grond.get(k);
      if (r === undefined) this.grond.set(k, (r = planeet.landStraal(dir)));
      return r;
    };
    const plaats = (mesh, dir, schaal, kleurHex, hoek = 0, onder = false) => {
      if (mesh.count >= mesh.instanceMatrix.count) return null;
      const r = grondOnder(dir);
      if (!onder && zee > 0 && r < zee) return null; // niet in het water bouwen
      v.copy(dir).multiplyScalar(r - schaal.y * 0.05);
      q.setFromUnitVectors(omhoog, dir).multiply(draai.setFromAxisAngle(omhoog, hoek));
      m4.compose(v, q, sc.copy(schaal));
      mesh.setMatrixAt(mesh.count, m4);
      mesh.setColorAt(mesh.count, kleur.set(kleurHex));
      mesh.count++;
      return v.clone();
    };
    // Vaste plekken (uit het eigen toevalsgetal van dat dorp): opnieuw neerzetten verschuift niets.
    const verspreid = (rnd, midden, straal) => {
      const a = new THREE.Vector3(Math.abs(midden.y) > 0.9 ? 1 : 0, Math.abs(midden.y) > 0.9 ? 0 : 1, 0).cross(midden).normalize();
      const b = new THREE.Vector3().crossVectors(midden, a);
      const hoek = rnd() * Math.PI * 2;
      const t = a.multiplyScalar(Math.cos(hoek)).addScaledVector(b, Math.sin(hoek));
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
        if (onder) plaats(this.koraal, dir, s3.clone().multiplyScalar(0.6), ['#ff7eb6', '#ff9a5a', '#b48cff', '#5ad1c4'][i % 4], rnd() * 6, true); // koraalhuizen
        else if (land === 'ijs') plaats(this.hol, dir, new THREE.Vector3(maat * 1.6, maat * 1.1, maat * 1.6), '#f4f8ff', 0); // iglo
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
      // Fabrieken (met rook) zodra ze machines hebben; met schone energie komen er windmolens bij
      // en gaat de rook uit. Zo zie je op de planeet zelf wat schone energie betekent.
      if (n >= 5 && !onder && s.tech.includes('machines')) {
        const schoon = s.tech.includes('schoon');
        for (let i = 0; i < (schoon ? 1 : 3); i++) {
          const dir = verspreid(rnd, midden, straal * 1.35);
          const sch = new THREE.Vector3(maat * 2.2, maat * 2.2, maat * 2.2);
          const p = plaats(this.fabriek, dir, sch, ['#c9b8a0', '#b9c2cc', '#d8c7a6'][i % 3], rnd() * 6);
          if (p && !schoon) this.rookBronnen.push({ pos: p.clone().addScaledVector(dir, maat * 2.4), dir: dir.clone(), maat, fase: rnd() });
        }
        if (schoon) {
          for (let i = 0; i < 4; i++) {
            const dir = verspreid(rnd, midden, straal * 1.7);
            const sch = maat * 2.6;
            const hoek = rnd() * 6;
            const p = plaats(this.mast, dir, new THREE.Vector3(sch, sch, sch), '#f2f2f2', hoek);
            if (p) this.molens.push({ voet: p.clone(), dir: dir.clone(), schaal: sch, hoek, draai: rnd() * 6, snel: 1.2 + rnd() });
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
            const r = grondOnder(dir);
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
    this.rotor.count = this.molens.length;
    for (const m of [this.hol, this.wand, this.dak, this.akker, this.gebouw, this.heuvel, this.fabriek, this.mast, this.koraal]) {
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
    for (const m of [this.hol, this.wand, this.dak, this.akker, this.gebouw, this.boot, this.raket, this.heuvel, this.fabriek, this.mast, this.rotor, this.koraal]) m.count = 0;
    for (const p of [this.vuur, this.licht, this.vlam, this.rook]) p.geometry.setDrawRange(0, 0);
    this.molens = [];
    this.rookBronnen = [];
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

    // Windmolens draaien, fabrieken roken.
    const zAs = new THREE.Vector3(0, 0, 1);
    this.molens.forEach((m, i) => {
      m.draai += dt * m.snel;
      q.setFromUnitVectors(omhoog, m.dir).multiply(new THREE.Quaternion().setFromAxisAngle(omhoog, m.hoek)).multiply(new THREE.Quaternion().setFromAxisAngle(zAs, m.draai));
      v.copy(m.voet).addScaledVector(m.dir, m.schaal * 1.42).add(new THREE.Vector3(0, 0, m.schaal * 0.13).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(omhoog, m.dir).multiply(new THREE.Quaternion().setFromAxisAngle(omhoog, m.hoek))));
      m4.compose(v, q, sc.setScalar(m.schaal));
      this.rotor.setMatrixAt(i, m4);
    });
    if (this.molens.length) this.rotor.instanceMatrix.needsUpdate = true;
    const rookPos = [], rookSize = [];
    for (const b of this.rookBronnen) {
      for (let k = 0; k < 5; k++) {
        const t = (this.tijd * 0.25 + b.fase + k / 5) % 1;
        rookPos.push(b.pos.clone().addScaledVector(b.dir, t * b.maat * 5).add(new THREE.Vector3(Math.sin(t * 6 + b.fase * 9), 0, Math.cos(t * 5)).multiplyScalar(t * b.maat)));
        rookSize.push(b.maat * (0.6 + t * 1.6) * (1 - t * 0.6));
      }
    }
    this.vulPunten(this.rook, rookPos, rookSize);
  }
}
