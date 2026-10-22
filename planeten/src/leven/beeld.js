// Wat de beschaving op de planeet zichtbaar maakt: holen, kampvuren, hutten, akkers, steden met
// lichtjes, wegen, boten en af en toe een raket. Alles wordt opnieuw neergezet als er een
// nederzetting groeit of krimpt; vuur, boten en raketten bewegen elk beeldje.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { maakRandom } from '../ruis.js';
import { MATEN } from '../keuzes.js';
import { niveau, geloofNaam, godNaam } from './sim.js';

// Opschriften in de tempel: de naam van het geloof gebeiteld in de balk boven de zuilen, en
// "De Grote ..." op de gedenksteen ervoor. Steenkleur met ingekerfde letters, zoals een echte tempel.
const opschriftCache = new Map();
function opschriftTextuur(regels, B, H) {
  const sleutel = regels.join('|') + B + 'x' + H;
  if (opschriftCache.has(sleutel)) return opschriftCache.get(sleutel);
  const d = document.createElement('canvas');
  d.width = B;
  d.height = H;
  const ctx = d.getContext('2d');
  ctx.fillStyle = '#efe3c4';
  ctx.fillRect(0, 0, B, H);
  // Een beetje steen: vlekjes.
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(120,100,70,${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * B, Math.random() * H, 2 + Math.random() * 6, 2 + Math.random() * 6);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const regelH = H / regels.length;
  regels.forEach((tekst, i) => {
    let grootte = Math.floor(regelH * 0.62);
    ctx.font = `700 ${grootte}px Fredoka, "Segoe UI", sans-serif`;
    while (ctx.measureText(tekst).width > B * 0.9 && grootte > 10) ctx.font = `700 ${(grootte -= 2)}px Fredoka, "Segoe UI", sans-serif`;
    const y = regelH * (i + 0.5);
    // Ingekerfd: lichte rand onder, donkere letter erin.
    ctx.fillStyle = 'rgba(255,250,235,0.9)';
    ctx.fillText(tekst, B / 2 + 1.5, y + 2);
    ctx.fillStyle = '#6b5a3e';
    ctx.fillText(tekst, B / 2, y);
  });
  const tex = new THREE.CanvasTexture(d);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // Is het lettertype nog niet geladen, dan niet onthouden: de volgende keer opnieuw tekenen.
  if (!document.fonts || document.fonts.check('700 20px Fredoka')) opschriftCache.set(sleutel, tex);
  return tex;
}
const opschriftVlak = (tex, b, h) =>
  new THREE.Mesh(new THREE.PlaneGeometry(b, h), new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2 }));

const BOUWTIJD = 30000; // zo lang (echte tijd) staat een nieuw bouwwerk in de steigers
// Kleur van de god: uit de naam, zodat elke speler altijd dezelfde eigen kleur heeft.
const GODKLEUREN = ['#5ab8ff', '#7ad04a', '#ff9a3a', '#ff6fb5', '#b07cff', '#ffd34d', '#3fd0c0', '#ff6a5a'];
function godKleur(geloof) {
  const n = godNaam(geloof);
  let h = 0;
  for (const c of n.toLowerCase()) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return GODKLEUREN[h % GODKLEUREN.length];
}
const MAX = { tempel: 40, brug: 2000, hol: 3000, wand: 4000, dak: 4000, akker: 2500, gebouw: 8000, boot: 400, raket: 12, heuvel: 1500, fabriek: 600, molen: 600, koraal: 1500 };

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
  // Tempel: trappen, zuilen en een dak; ervoor een beeld van de god (het kind dat de planeet maakte).
  const tempel = samenVoeg([
    grijs(new THREE.BoxGeometry(1.2, 0.12, 1.2).translate(0, 0.06, 0), 0.75),
    grijs(new THREE.BoxGeometry(1.0, 0.12, 1.0).translate(0, 0.18, 0), 0.85),
    ...[[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]].map(([x, z]) => grijs(new THREE.CylinderGeometry(0.07, 0.08, 0.6, 8).translate(x, 0.54, z), 1)),
    grijs(new THREE.BoxGeometry(1.0, 0.2, 1.0).translate(0, 0.94, 0), 0.9),
    grijs(new THREE.ConeGeometry(0.75, 0.35, 4).rotateY(Math.PI / 4).translate(0, 1.215, 0), 0.75),
    // Gedenksteen voor de tempel (daar komt "De Grote ..." op).
    grijs(new THREE.BoxGeometry(0.62, 0.44, 0.09).translate(0, 0.22, 0.86), 0.85),
  ]);
  const beeld = samenVoeg([
    grijs(new THREE.BoxGeometry(0.4, 0.25, 0.4).translate(0, 0.125, 0), 0.6),
    grijs(new THREE.CylinderGeometry(0.12, 0.18, 0.45, 10).translate(0, 0.47, 0), 1),
    grijs(new THREE.SphereGeometry(0.14, 12, 8).translate(0, 0.82, 0), 1.1),
    grijs(new THREE.OctahedronGeometry(0.09).translate(0, 1.05, 0), 1.2),
  ]);
  // Brug: een plank met een randje aan beide kanten.
  const brug = samenVoeg([
    grijs(new THREE.BoxGeometry(1, 0.12, 1), 0.9),
    grijs(new THREE.BoxGeometry(1, 0.25, 0.08).translate(0, 0.15, 0.46), 0.6),
    grijs(new THREE.BoxGeometry(1, 0.25, 0.08).translate(0, 0.15, -0.46), 0.6),
  ]);
  return { hol, wand, dak, akker, gebouw, fabriek, mast, rotor, koraal, tempel, beeld, brug };
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
    this.tempel = instanties(v.tempel, klei(), MAX.tempel);
    this.beeld = instanties(v.beeld, new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, metalness: 0.5, roughness: 0.35 }), MAX.tempel);
    this.brug = instanties(v.brug, klei(), MAX.brug);
    this.groep.add(this.fabriek, this.mast, this.rotor, this.koraal, this.tempel, this.beeld, this.brug);
    this.banieren = new THREE.Group();
    this.groep.add(this.banieren);
    this.groei = [];
    this.plekken = new Map();
    this.gezienPlek = new Map();
    this.bekendeBruggen = new Set();
    this.opBrug = null; // wordt gezet door wie het verhaal bijhoudt
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
      .map((g) => ({ g, s: wereld.soorten[g.soort], n: wereld.soorten[g.soort] ? this.toonNiveau(g, wereld.soorten[g.soort]) : 0 }))
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
    // De eerste keer staat alles er gewoon; daarna wordt wat nieuw is zichtbaar gebouwd.
    const eerste = !this.gebouwd;
    this.gebouwd = true;
    this.groei = [];
    this.plekken = new Map();
    let huidigSoort = null, wat = null;
    const plekVan = (sid) => {
      let p = this.plekken.get(sid);
      if (!p) this.plekken.set(sid, (p = { huis: [], vuur: [], akker: [], tempel: null }));
      return p;
    };
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
      // Nieuw? Dan groeit het de komende tijd op uit de steigers (zie update).
      const k = mesh.id + ':' + dir.x.toFixed(4) + ',' + dir.y.toFixed(4) + ',' + dir.z.toFixed(4); // plek op de bol, niet de hoogte
      let t0 = this.gezienPlek.get(k);
      if (t0 === undefined) this.gezienPlek.set(k, (t0 = eerste ? -1e9 : nu));
      if (nu - t0 < BOUWTIJD) this.groei.push({ mesh, i: mesh.count, m: m4.clone(), t0, dir: dir.clone(), sid: huidigSoort });
      mesh.setMatrixAt(mesh.count, m4);
      mesh.setColorAt(mesh.count, kleur.set(kleurHex));
      mesh.count++;
      if (huidigSoort && wat) plekVan(huidigSoort)[wat].push(dir.clone());
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
      huidigSoort = s.id;
      wat = null;
      const reg = regios[g.regio];
      const midden = new THREE.Vector3(...reg.dir);
      // Elk soort bouwwerk een eigen vaste reeks: komt er een hutje bij, dan blijft de rest staan.
      const stroom = (k) => maakRandom(g.regio + s.id + k);
      const maat = Math.min(0.022, Math.max(0.006, (MATEN.find((m) => m.id === s.maat) || MATEN[1]).maat * (s.genen.grootte || 1)));
      const onder = s.beweging === 'zwemmen' && !reg.land; // koraaldorpen op de zeebodem
      const eigen = s.kleur ? new THREE.Color().setHSL(s.kleur.h, Math.min(0.75, s.kleur.s), 0.55).getHexString() : 'c0704a';
      // Hoe ze bouwen hangt af van waar ze vandaan komen: iglo's, leem, lavasteen of hout.
      const land = s.thuisLand;
      const wandKleur = onder ? '#ff9ec7' : land === 'woestijn' ? '#c99a6b' : land === 'lava' ? '#3d3936' : land === 'berg' ? '#9a948c' : '#e8d3a8';
      const dakKleur = onder ? '#5ad1c4' : land === 'woestijn' ? '#b07f55' : land === 'lava' ? '#5c534c' : '#' + eigen;
      const straal = 0.07; // vaste grootte: als een dorp groeit, schuift er niets op
      // Zwermheuvels van soorten die niet praten maar wel samen bouwen.
      if (s.vlaggen.heuvels && !s.tech.includes('taal') && g.pop > 20 && !onder) {
        const rnd = stroom('h');
        const aantal = Math.min(5, 1 + Math.floor(Math.log10(g.pop)));
        for (let i = 0; i < aantal; i++) {
          const h = maat * (1.1 + rnd() * 1.3);
          plaats(this.heuvel, verspreid(rnd, midden, straal), new THREE.Vector3(h * 0.6, h, h * 0.6), ['#a8784e', '#9a6c45', '#b88a5c'][i % 3], rnd() * 6);
        }
      }
      wat = 'huis';
      if (n >= 1) for (let i = 0, rnd = stroom('o'); i < 3; i++) plaats(this.hol, verspreid(rnd, midden, straal), sc.set(maat * 0.9, maat * 0.45, maat * 0.9).clone(), onder ? '#c98a6a' : '#4a3a2e', 0, onder);
      wat = 'vuur';
      if (n >= 2 && !onder) {
        const p = plaats(this.hol, midden.clone(), new THREE.Vector3(maat * 0.6, maat * 0.12, maat * 0.6), '#6b6b6b');
        if (p) {
          vuurPos.push(p.addScaledVector(midden, maat * 0.25));
          vuurSize.push(maat * 0.9);
        }
      }
      wat = 'huis';
      const hutten = n >= 6 ? 0 : n === 5 ? 6 : n === 4 ? 9 : n === 3 ? 4 : 0;
      for (let i = 0, rnd = stroom('u'); i < hutten; i++) {
        const dir = verspreid(rnd, midden, straal);
        const s3 = new THREE.Vector3(maat * 1.3, maat * 1.3, maat * 1.3);
        if (onder) plaats(this.koraal, dir, s3.clone().multiplyScalar(0.6), ['#ff7eb6', '#ff9a5a', '#b48cff', '#5ad1c4'][i % 4], rnd() * 6, true); // koraalhuizen
        else if (land === 'ijs') plaats(this.hol, dir, new THREE.Vector3(maat * 1.6, maat * 1.1, maat * 1.6), '#f4f8ff', 0); // iglo
        else if (plaats(this.wand, dir, s3, wandKleur, rnd() * 6, onder)) plaats(this.dak, dir, s3, dakKleur, rnd() * 6, onder);
      }
      if (n >= 4 && !onder) {
        wat = 'akker';
        const akkerKleuren = ['#e7c65a', '#9ccc5a', '#c9a24a', '#7fbf4a'];
        for (let i = 0, rnd = stroom('a'); i < (n >= 5 ? 8 : 5); i++) {
          const dir = verspreid(rnd, midden, straal * 1.6);
          plaats(this.akker, dir, new THREE.Vector3(maat * 2.6, maat, maat * 2.6), akkerKleuren[i % 4], rnd() * 6);
        }
      }
      wat = 'huis';
      if (n >= 5) {
        const aantal = n === 6 ? 34 : 16;
        for (let i = 0, rnd = stroom('g'); i < aantal; i++) {
          const dir = verspreid(rnd, midden, straal * (n === 6 ? 1.1 : 0.9));
          const hoog = maat * (n === 6 ? 1.5 + rnd() ** 2 * 5 : 1 + rnd() * 1.8);
          const breed = maat * (0.9 + rnd() * 0.6);
          const steen = onder ? ['#ff9ec7', '#5ad1c4', '#ffd36b'][i % 3] : n === 6 ? ['#d9dde3', '#aab4c0', '#' + eigen, '#eef1f4'][i % 4] : ['#d8c7a6', '#c2ad8a', '#' + eigen][i % 3];
          const p = plaats(this.gebouw, dir, new THREE.Vector3(breed, hoog, breed), steen, rnd() * 6, onder);
          if (p && (n === 6 || s.tech.includes('stroom') || s.tech.includes('kristal'))) {
            const lagen = Math.max(1, Math.round(hoog / maat));
            for (let k = 0; k < lagen; k++) {
              lichtPos.push(p.clone().addScaledVector(dir, hoog * (0.25 + (0.6 * k) / lagen)).addScaledVector(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), breed * 0.4));
              lichtSize.push(maat * 0.35);
            }
          }
        }
      }
      wat = null;
      // Fabrieken (met rook) zodra ze machines hebben; met schone energie komen er windmolens bij
      // en gaat de rook uit. Zo zie je op de planeet zelf wat schone energie betekent.
      if (n >= 5 && !onder && s.tech.includes('machines')) {
        const schoon = s.tech.includes('schoon');
        for (let i = 0, rnd = stroom('f'); i < (schoon ? 1 : 3); i++) {
          const dir = verspreid(rnd, midden, straal * 1.35);
          const sch = new THREE.Vector3(maat * 2.2, maat * 2.2, maat * 2.2);
          const p = plaats(this.fabriek, dir, sch, ['#c9b8a0', '#b9c2cc', '#d8c7a6'][i % 3], rnd() * 6);
          if (p && !schoon) this.rookBronnen.push({ pos: p.clone().addScaledVector(dir, maat * 2.4), dir: dir.clone(), maat, fase: rnd() });
        }
        if (schoon) {
          for (let i = 0, rnd = stroom('m'); i < 4; i++) {
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

    // Tempels: bij het grootste dorp van elke gelovige soort, met een beeld van hun god.
    huidigSoort = null;
    wat = null;
    for (const b of [...this.banieren.children]) {
      this.banieren.remove(b);
      b.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    for (const s of Object.values(wereld.soorten)) {
      if (!s.geloof || s.uitgestorven !== null) continue;
      // De tempel blijft waar hij gebouwd is (zolang dat dorp er nog is); anders bij het grootste dorp.
      const dorpen = groepen.filter((x) => x.s === s && x.n >= 3 && regios[x.g.regio].land);
      const dorp = dorpen.find((x) => x.g.regio === s.geloof.tempelRegio) || dorpen.sort((a, b) => b.g.pop - a.g.pop)[0];
      if (!dorp) continue;
      s.geloof.tempelRegio = dorp.g.regio;
      const midden = new THREE.Vector3(...regios[dorp.g.regio].dir);
      const rnd = maakRandom(dorp.g.regio + s.id + 'tempel');
      const maat = Math.min(0.022, Math.max(0.006, (MATEN.find((m) => m.id === s.maat) || MATEN[1]).maat * (s.genen.grootte || 1)));
      const dir = verspreid(rnd, midden, 0.03);
      huidigSoort = s.id;
      const hoek = rnd() * 6;
      const p = plaats(this.tempel, dir, new THREE.Vector3(maat * 3, maat * 3, maat * 3), '#efe3c4', hoek);
      if (p) {
        plekVan(s.id).tempel = dir.clone();
        const voor = verspreid(rnd, dir, 0.012);
        plaats(this.beeld, voor, new THREE.Vector3(maat * 2.4, maat * 2.4, maat * 2.4), godKleur(s.geloof), hoek);
        // Opschriften in de tempel zelf (stukje herkenning voor het kind): de naam van het geloof
        // in de balk, "De Grote ..." op de gedenksteen. Zelfde stand en maat als de tempel.
        const tm = new THREE.Matrix4();
        this.tempel.getMatrixAt(this.tempel.count - 1, tm);
        const opschrift = new THREE.Group();
        tm.decompose(opschrift.position, opschrift.quaternion, opschrift.scale);
        const balk = opschriftVlak(opschriftTextuur([geloofNaam(s.geloof).toUpperCase()], 512, 80), 0.94, 0.16);
        balk.position.set(0, 0.94, 0.503);
        const steen = opschriftVlak(opschriftTextuur(['DE GROTE', godNaam(s.geloof).toUpperCase()], 256, 176), 0.56, 0.385);
        steen.position.set(0, 0.22, 0.907);
        opschrift.add(balk, steen);
        opschrift.userData.klaar = (this.gezienPlek.get(this.tempel.id + ':' + dir.x.toFixed(4) + ',' + dir.y.toFixed(4) + ',' + dir.z.toFixed(4)) || 0) + BOUWTIJD;
        this.banieren.add(opschrift);
      }
      huidigSoort = null;
    }

    // Wegen tussen naburige dorpen en steden van dezelfde soort. Wie het wiel kent, slaat bruggen
    // over smalle stukken water.
    for (const [sid, lijst] of centra) {
      const kanBrug = wereld.soorten[sid]?.tech.includes('wiel');
      const ids = new Set(lijst.map((c) => c.regio));
      for (const c of lijst) {
        for (const b of regios[c.regio].buren) {
          if (b < c.regio || !ids.has(b)) continue;
          const doel = new THREE.Vector3(...regios[b].dir);
          const punten = [];
          let natAantal = 0;
          const natte = [];
          for (let k = 0; k <= 10; k++) {
            const dir = c.dir.clone().lerp(doel, k / 10).normalize();
            const r = grondOnder(dir);
            const isNat = zee > 0 && r < zee;
            natte.push(isNat);
            if (isNat) natAantal++;
            punten.push(dir.multiplyScalar(Math.max(r, zee) + (isNat ? 0.004 : 0.0012) * recept.grootte));
          }
          if (natAantal && (!kanBrug || natAantal > 4)) continue; // te veel water: geen weg
          if (natAantal) {
            // Een brug: planken over het water.
            for (let k = 1; k < punten.length; k++) {
              if (!natte[k] && !natte[k - 1]) continue;
              if (this.brug.count >= MAX.brug) break;
              const a = punten[k - 1], bb = punten[k];
              const mid = a.clone().add(bb).multiplyScalar(0.5);
              const lang = a.distanceTo(bb);
              const x = bb.clone().sub(a).normalize();
              const y = mid.clone().normalize();
              const z = new THREE.Vector3().crossVectors(x, y).normalize();
              y.crossVectors(z, x);
              m4.makeBasis(x, y, z).scale(new THREE.Vector3(lang * 1.05, 0.0012 * recept.grootte, 0.0045 * recept.grootte)).setPosition(mid);
              this.brug.setMatrixAt(this.brug.count, m4);
              this.brug.setColorAt(this.brug.count, kleur.set('#a8794e'));
              this.brug.count++;
            }
            const bk = sid + ':' + c.regio + '-' + b;
            if (!this.bekendeBruggen.has(bk)) {
              this.bekendeBruggen.add(bk);
              if (this.opBrug) this.opBrug(sid, eerste);
            }
          }
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
    for (const m of [this.hol, this.wand, this.dak, this.akker, this.gebouw, this.heuvel, this.fabriek, this.mast, this.koraal, this.tempel, this.beeld, this.brug]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  // Een dorp gaat meteen omhoog als het groeit, maar pas na een halve minuut omlaag. Anders springt
  // een dorp dat net rond een grens zit steeds heen en weer tussen hutjes en een stad.
  toonNiveau(g, s) {
    const n = niveau(s, g);
    this.getoond ||= new Map();
    const k = g.regio + '|' + s.id;
    const was = this.getoond.get(k);
    const nu = performance.now();
    if (!was) {
      this.getoond.set(k, { n, t: nu });
      return n;
    }
    // Omhoog pas met wat speling (15% boven de grens), omlaag pas na een halve minuut.
    const ruim = niveau(s, { ...g, pop: g.pop * 0.87 });
    if (ruim > was.n || (n < was.n && nu - was.t > 30000)) {
      this.getoond.set(k, { n: n < was.n ? n : ruim, t: nu });
      return n < was.n ? n : ruim;
    }
    if (n >= was.n) was.t = nu;
    return was.n;
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
    for (const m of [this.hol, this.wand, this.dak, this.akker, this.gebouw, this.boot, this.raket, this.heuvel, this.fabriek, this.mast, this.rotor, this.koraal, this.tempel, this.beeld, this.brug]) m.count = 0;
    this.groei = [];
    for (const b of [...(this.banieren?.children || [])]) {
      this.banieren.remove(b);
      b.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    if (ookSleutel) {
      // Andere planeet (of opnieuw geopend): alles staat er meteen, niets in de steigers.
      this.gebouwd = false;
      this.gezienPlek = new Map();
      this.bekendeBruggen = new Set();
      this.plekken = new Map();
    }
    for (const p of [this.vuur, this.licht, this.vlam, this.rook]) p.geometry.setDrawRange(0, 0);
    this.molens = [];
    this.rookBronnen = [];
    this.wegen.geometry.setDrawRange(0, 0);
    this.boten = [];
    this.raketten = [];
  }

  // Wat er nu in de steigers staat voor een soort (de wezens lopen erheen om te helpen).
  bouwVoor(sid) {
    return this.groei.filter((g) => g.sid === sid).map((g) => g.dir);
  }

  update(dt) {
    this.tijd += dt;
    if (this.banieren.children.length) {
      const nu = performance.now();
      for (const o of this.banieren.children) o.visible = nu > o.userData.klaar;
    }
    // Nieuwe bouwwerken groeien op: eerst klein en laag, in een halve minuut helemaal af.
    this.groeiKlok = (this.groeiKlok || 0) + dt;
    if (this.groei.length && this.groeiKlok > 0.08) {
      this.groeiKlok = 0;
      const nu = performance.now(), gv = new THREE.Vector3(), gq = new THREE.Quaternion(), gs = new THREE.Vector3(), gm = new THREE.Matrix4();
      const bezig = [];
      for (const g of this.groei) {
        const f = Math.min(1, (nu - g.t0) / BOUWTIJD);
        const e = f * f * (3 - 2 * f);
        g.m.decompose(gv, gq, gs);
        gs.set(gs.x * (0.35 + 0.65 * e), gs.y * (0.05 + 0.95 * e), gs.z * (0.35 + 0.65 * e));
        gm.compose(gv, gq, gs);
        if (g.i < g.mesh.count) {
          g.mesh.setMatrixAt(g.i, gm);
          g.mesh.instanceMatrix.needsUpdate = true;
        }
        if (f < 1) bezig.push(g);
      }
      this.groei = bezig;
    }
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
