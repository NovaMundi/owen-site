import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Planeet, KAAL, uiterlijk, vulAan, PADDENSTOEL_ROOD } from './planeet.js';
import { geluid } from './geluid.js';
import { stem } from './stem.js';
import { maakSterren, Sterrenstof, Vuurwerk } from './effecten.js';
import { WezensLaag, beeldVan } from './wezens.js';
import { echtStatus, vraagEcht } from './echt.js';
import { wolk } from './wolk.js';
import { openTekentafel } from './tekentafel.js';
import { Leven } from './leven/beheer.js';
import { BeschavingLaag } from './leven/beeld.js';
import { TECH, FASEN, OMDAT, meervoud, techNaam, snelBezig } from './leven/sim.js';
import { plaatjeVoorNieuweSoort } from './leven/afbeelding.js';
import * as K from './keuzes.js';
import { lees, schrijf, mediaKlaar, SANDBOX } from './opslag.js';
import { icoon } from './iconen.js';
import { openKiezen } from './kiezen.js';

// ================= Opslag =================
const OPSLAG = 'planeetmakers-v1';
const WENSEN = 'planeetmakers-wensen-v1';
const FOTOS = 'planeetmakers-fotos-v1';
// Plaatjes en geluiden staan in IndexedDB (zie opslag.js): eerst die inladen.
await mediaKlaar;
const planeten = lees(OPSLAG, {});
const fotos = lees(FOTOS, {});

// Prullenbak: een weggegooide planeet blijft 30 dagen bewaard (hier de laatste per speler, in de
// wolk allemaal). Past hij niet meer in het geheugen, dan staat hij alsnog in de wolk.
const PRULLENBAK = 'planeetmakers-prullenbak-v1';
const MAAND = 30 * 24 * 3600 * 1000;
function legInPrullenbak(id) {
  if (!planeten[id]) return;
  const bak = lees(PRULLENBAK, []).filter((x) => x.wie !== id && Date.now() - x.wanneer < MAAND);
  bak.push({ wie: id, wanneer: Date.now(), data: { recept: planeten[id], wereld: lees('planeetmakers-leven-v1', {})[id] || null, foto: fotos[id] || null } });
  if (!schrijf(PRULLENBAK, bak)) schrijf(PRULLENBAK, bak.slice(-1));
}

// ================= 3D-scène =================
const doek = document.getElementById('doek');
const renderer = new THREE.WebGLRenderer({ canvas: doek, antialias: true });
// Tablets hebben scherpe schermen maar een zuinige grafische chip: 1,5 is scherp genoeg en
// scheelt bijna de helft aan rekenwerk.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
// Raakt de tablet de 3D-tekenaar kwijt (geheugen vol, app op de achtergrond), dan alles
// bewaren en de pagina netjes opnieuw laden, in plaats van een zwart scherm.
doek.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  bewaarNu();
  setTimeout(() => location.reload(), 300);
});
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#03040a');
scene.add(maakSterren());

// Zachte gloed op alles wat licht geeft: lava, dampkring, sterrenstof, vuurwerk.
const composer = new EffectComposer(renderer);
const bloei = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.45, 0.9);
scene.add(new THREE.HemisphereLight('#9fb8ff', '#2a2230', 0.7));
const zon = new THREE.DirectionalLight('#fff4e0', 3.2);
scene.add(zon);
const bliksem = new THREE.PointLight('#cfe4ff', 0, 3, 1.5);
scene.add(bliksem);

const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 200);
camera.position.set(0, 0.6, 4.4);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(bloei);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, doek);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = true;
controls.maxDistance = 9;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

const houder = new THREE.Group(); // voor de geboorte-animatie
scene.add(houder);
const vuurwerk = new Vuurwerk(scene);
const wezens = new WezensLaag();
houder.add(wezens.groep);
let wezensVuil = false;
let volg = null; // het wezen dat de camera nu volgt
const beschaving = new BeschavingLaag();
houder.add(beschaving.groep);
// ?tijd=60 in de adresbalk laat de tijd 60 keer sneller gaan (om te testen).
const snelheid = Math.max(1, Number(new URLSearchParams(location.search).get('tijd')) || 1);
const leven = new Leven({ wezens, beeld: beschaving, snelheid, opNieuws: (lijst) => toonNieuws(lijst), opNieuweSoort: (s) => nieuweSoortErbij(s), opBewaard: (w) => wolk.planStuur(w, 60000) });
let wezenIds = '';

// Penseel-cursor: een ringetje op de grond waar je vinger is.
const cursor = new THREE.Mesh(
  new THREE.RingGeometry(0.85, 1, 48),
  new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide })
);
cursor.visible = false;
cursor.renderOrder = 10;
scene.add(cursor);

// ================= Toestand =================
let wie = null; // 'owen' | 'jake' | 'papa'
let recept = null;
let planeet = null; // de planeet die nu in beeld is (snel of hd)
let snel = null; // snelle versie, die reageert tijdens het bouwen
let hd = null, hdSleutel = null, hdBezig = false, hdTimer = null; // mooie versie als hij klaar is
let sessie = 0; // telt op bij elke wissel van speler, zodat late resultaten niet verdwalen
let stelBezig = false;
let geschiedenis = [];
let vuil = false;
let gereedschap = null;
let geboorte = null; // { stof, tikken }
const penseel = { modus: null, richting: 1, groot: false, kleur: K.VERF[0], gum: false, tekenen: false, nr: 0, laatste: null, tijd: 0 };
let paneelHoogte = 0, kijkVerschuiving = 0;
let opslaanTimer = null;

function wijzig() {
  vuil = true;
  wezensVuil = true;
}
function bewaarStap() {
  geschiedenis.push(JSON.stringify(recept));
  if (geschiedenis.length > 30) geschiedenis.shift(); // elke stap is een hele kopie, met plaatjes
  knopTerug.classList.toggle('uit', geschiedenis.length === 0);
}
function terug() {
  if (!geschiedenis.length) return;
  // Soorten die vanzelf zijn ontstaan horen bij de geschiedenis van de planeet: die blijven.
  const natuurlijk = (recept.wezens || []).filter((w) => w.ontstaan);
  recept = JSON.parse(geschiedenis.pop());
  for (const w of natuurlijk) if (!(recept.wezens || []).some((x) => x.id === w.id)) recept.wezens = [...(recept.wezens || []), w];
  knopTerug.classList.toggle('uit', geschiedenis.length === 0);
  geluid.zwiep();
  wijzig();
  if (gereedschap) toonPaneel(gereedschap, false);
  toonNaam();
}
function opslaan() {
  clearTimeout(opslaanTimer);
  opslaanTimer = setTimeout(() => {
    planeten[wie] = recept;
    if (!schrijf(OPSLAG, planeten)) geheugenVol();
    wolk.planStuur(wie);
  }, 400);
}
// Het geheugen van de tablet is vol: één keer per paar minuten zeggen, niet bij elke penseelstreek.
// Met de wolk aan staat alles er ook nog, dus dan gaat er niets verloren.
let volGemeld = 0;
function geheugenVol() {
  if (Date.now() - volGemeld < 180000) return;
  volGemeld = Date.now();
  toonMelding(wolk.aan ? 'Het geheugen van deze tablet is bijna vol. Je planeet staat veilig in de wolk. Roep papa even!' : 'Oei, het geheugen van deze tablet is vol. Roep papa even!', 6000);
}
// Meteen alles bewaren: als de app naar de achtergrond gaat (Android sluit die soms hard af).
function bewaarNu() {
  if (wie && recept && !geboorte) {
    clearTimeout(opslaanTimer);
    planeten[wie] = recept;
    if (!schrijf(OPSLAG, planeten)) geheugenVol();
  }
  leven.bewaar();
  if (wie) wolk.stuur(wie);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) bewaarNu();
});

// ================= Snel en mooi =================
function toonPlaneet(p) {
  if (planeet === p) return;
  if (planeet) houder.remove(planeet.groep);
  planeet = p;
  if (p) houder.add(p.groep);
  wezens.planeet = p;
}
function ruimOp() {
  sessie++;
  clearTimeout(hdTimer);
  clearTimeout(fotoTimer);
  for (const p of [snel, hd]) {
    if (!p) continue;
    houder.remove(p.groep);
    p.opruimen();
  }
  snel = hd = planeet = null;
  leven.sluit();
  wezenIds = '';
  wezens.leeg();
  wezens.planeet = null;
  stopVolg();
  hdSleutel = null;
  hdBezig = false;
  stelBezig = false;
  vuil = false;
}
function hdKlopt() {
  return hd && hdSleutel === uiterlijk(zicht(recept));
}
// De mooie versie is pas zinvol als de planeet klaar is en er niet aan gebouwd wordt.
function planHD(wacht = 1500) {
  clearTimeout(hdTimer);
  hdTimer = setTimeout(() => {
    if (recept && recept.klaar && !gereedschap) bouwHD(false);
  }, wacht);
}
async function bouwHD(feestelijk) {
  if (hdKlopt()) {
    if (!gereedschap) toonPlaneet(hd);
    return;
  }
  if (hdBezig) return planHD();
  hdBezig = true;
  zuinig.rust();
  const mijn = sessie;
  const sleutel = uiterlijk(zicht(recept));
  const nieuw = await Planeet.maak(structuredClone(zicht(recept)), 'hoog');
  if (mijn !== sessie) {
    nieuw.opruimen();
    return;
  }
  hdBezig = false;
  if (uiterlijk(zicht(recept)) !== sleutel) {
    // Tijdens het rekenen is er weer iets veranderd: weggooien en later opnieuw.
    nieuw.opruimen();
    planHD();
    return;
  }
  const oud = hd;
  hd = nieuw;
  hdSleutel = sleutel;
  if (!gereedschap) {
    if (feestelijk) {
      $('#flits').classList.remove('aan');
      void $('#flits').offsetWidth;
      $('#flits').classList.add('aan');
      geluid.geboorte();
      verbergMelding();
      setTimeout(() => stem.zeg('Kijk eens! Nu is je planeet extra mooi.'), 900);
    }
    toonPlaneet(hd);
  } else if (planeet === oud) toonPlaneet(snel);
  if (oud) oud.opruimen();
  maakFoto();
}

// ================= Foto voor het startscherm =================
// Een tweede, kleine tekenaar maakt een echte foto van de planeet met doorzichtige achtergrond.
const FOTO = 360;
let fotoTekenaar = null, fotoScene = null, fotoZon = null, fotoTimer = null;
function fotoVan(p, rec, richting) {
  if (!fotoTekenaar) {
    fotoTekenaar = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    fotoTekenaar.setPixelRatio(1);
    fotoTekenaar.setSize(FOTO, FOTO, false);
    fotoTekenaar.toneMapping = THREE.ACESFilmicToneMapping;
    fotoTekenaar.toneMappingExposure = 1.1;
    fotoScene = new THREE.Scene();
    fotoScene.add(new THREE.HemisphereLight('#9fb8ff', '#2a2230', 0.7));
    fotoZon = new THREE.DirectionalLight('#fff4e0', 3.2);
    fotoScene.add(fotoZon);
  }
  const ouder = p.groep.parent;
  fotoScene.add(p.groep);
  const omvang = (rec.ring ? 1.75 + (rec.ring.breedte ?? 0.5) * 0.6 : 1.2) * rec.grootte;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const dir = (richting || new THREE.Vector3(0, 0.15, 1)).clone().normalize();
  cam.position.copy(dir).multiplyScalar(omvang / Math.sin(THREE.MathUtils.degToRad(15)));
  cam.lookAt(0, 0, 0);
  const zonDir = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -1.0);
  zonDir.y += 0.3;
  fotoZon.position.copy(zonDir.normalize().multiplyScalar(10));
  p.update(0, zonDir);
  fotoTekenaar.render(fotoScene, cam);
  if (ouder) ouder.add(p.groep);
  else fotoScene.remove(p.groep);
  const url = fotoTekenaar.domElement.toDataURL('image/webp', 0.9);
  return url.startsWith('data:image/webp') ? url : fotoTekenaar.domElement.toDataURL('image/png');
}
function maakFoto() {
  if (!planeet || !wie || geboorte) return;
  fotos[wie] = fotoVan(planeet, recept, camera.position);
  schrijf(FOTOS, fotos);
  wolk.planStuur(wie);
}
function planFoto() {
  clearTimeout(fotoTimer);
  fotoTimer = setTimeout(maakFoto, 1200);
}
// Oude planeten zonder foto krijgen er alsnog een, één voor één.
async function maakOntbrekendeFotos() {
  for (const m of K.MAKERS) {
    if (!planeten[m.id] || fotos[m.id]) continue;
    const p = await Planeet.maak(planeten[m.id], 'snel');
    fotos[m.id] = fotoVan(p, { ...KAAL, ...planeten[m.id] });
    p.opruimen();
    schrijf(FOTOS, fotos);
    if (!wie) {
      const img = document.querySelector(`.maker-knop[data-id="${m.id}"] .mini`);
      if (img) {
        const nieuw = document.createElement('img');
        nieuw.className = 'mini foto';
        nieuw.alt = '';
        nieuw.src = fotos[m.id];
        img.replaceWith(nieuw);
      }
    }
  }
}

// ================= Schermen =================
const $ = (s) => document.querySelector(s);
const startScherm = $('#start');
const makerScherm = $('#maker');
const paneel = $('#paneel');
const dock = $('#dock');
const knopTerug = $('#terug');
const melding = $('#melding');

async function toonStart() {
  stem.stil();
  wie = null;
  sluitPaneel();
  makerScherm.hidden = true;
  startScherm.hidden = false;
  ruimOp();
  tekenStartKaarten();
  stem.zeg('Welkom, planeetmakers! Wie gaat er bouwen?');
  // Wat er op andere apparaten is gebeurd ophalen (stil op de achtergrond).
  if (wolk.aan) {
    $('#wolkknop').classList.add('bezig');
    await wolk.haalAlles();
    $('#wolkknop').classList.remove('bezig');
    if (wie) return; // intussen al een planeet gekozen
    herlaadUitOpslag();
    tekenStartKaarten();
  }
  maakOntbrekendeFotos();
}

function herlaadUitOpslag() {
  for (const [obj, sleutel] of [[planeten, OPSLAG], [fotos, FOTOS]]) {
    const vers = lees(sleutel, {});
    for (const k of Object.keys(obj)) delete obj[k];
    Object.assign(obj, vers);
  }
}

// Op jakevanpelt.com is Jake de baas, op owenvanpelt.com Owen. Daar staat je eigen planeet
// voorop, en alleen je eigen planeet kun je helemaal weggooien. Op papa's laptop mag alles.
const EIGENAAR = location.hostname.includes('jakevanpelt') ? 'jake' : location.hostname.includes('owenvanpelt') ? 'owen' : null;
const magWissen = (id) => !EIGENAAR || EIGENAAR === id;

function tekenStartKaarten() {
  const lijst = $('#makers');
  lijst.innerHTML = '';
  const volgorde = EIGENAAR ? [...K.MAKERS].sort((a, b) => (b.id === EIGENAAR) - (a.id === EIGENAAR)) : K.MAKERS;
  for (const m of volgorde) {
    const r = planeten[m.id];
    const k = document.createElement('button');
    k.className = 'maker-knop' + (m.id === EIGENAAR ? ' eigen' : '');
    k.dataset.id = m.id;
    k.innerHTML = fotos[m.id]
      ? `<img class="mini foto" src="${fotos[m.id]}" alt="">`
      : r
        ? `<span class="mini laden"></span>`
        : `<span class="mini leeg">?</span>`;
    k.innerHTML += `<span class="maker-naam">${m.naam}</span><span class="maker-sub"></span>`;
    k.querySelector('.maker-sub').textContent = r ? r.naam || 'Planeet zonder naam' : 'Nieuwe planeet';
    if (wolk.botsing(m.id)) k.insertAdjacentHTML('beforeend', '<span class="botsing-teken">⚠️</span>');
    k.addEventListener('click', () => {
      geluid.plop();
      if (wolk.botsing(m.id)) return kiesVersie(m.id);
      begin(m.id);
    });
    lijst.appendChild(k);
  }
}

// Twee versies van dezelfde planeet: het kind kiest welke het houdt, met de foto's erbij.
function kiesVersie(id) {
  const doc = wolk.botsing(id);
  const hier = { foto: fotos[id], recept: planeten[id], wereld: lees('planeetmakers-leven-v1', {})[id] };
  const daar = doc.data || {};
  const kaart = (p, label) => {
    const jaar = p.wereld ? `Jaar ${Math.floor(p.wereld.jaar).toLocaleString('nl-NL')}` : '';
    const n = (p.recept?.wezens || []).length;
    const naam = (p.recept?.naam || 'Zonder naam').replace(/[<>&]/g, '');
    return `<button class="versie-kaart" data-welke="${label}">${p.foto ? `<img src="${p.foto}" alt="">` : '<span class="mini leeg">?</span>'}<b>${naam}</b><span>${label === 'hier' ? 'op dit apparaat' : 'op het andere apparaat'}</span><span>${jaar}${n ? ` · ${n} wezens` : ''}</span></button>`;
  };
  const v = $('#vraag');
  v.querySelector('.vraag-tekst').innerHTML = `Deze planeet is op twee plekken veranderd. Welke wil je houden?<div class="versies">${kaart(hier, 'hier')}${kaart(daar, 'daar')}</div><small>De andere gaat dan weg.</small>`;
  v.querySelector('.ja').hidden = true;
  v.querySelector('.nee').textContent = 'Later';
  stem.zeg('Deze planeet is op twee plekken veranderd. Welke wil je houden?');
  const klaar = () => {
    v.hidden = true;
    v.querySelector('.ja').hidden = false;
    v.querySelector('.nee').textContent = 'Nee';
  };
  v.querySelectorAll('.versie-kaart').forEach((b) =>
    b.addEventListener('click', async () => {
      geluid.pling(3);
      klaar();
      // Wat op dit apparaat stond, gaat eerst naar de prullenbak (voor als het de verkeerde keuze was).
      if (b.dataset.welke === 'daar') legInPrullenbak(id);
      await wolk.kies(id, b.dataset.welke);
      herlaadUitOpslag();
      tekenStartKaarten();
    })
  );
  v.querySelector('.nee').onclick = () => {
    geluid.klik();
    klaar();
  };
  v.hidden = false;
}

// ☁️ op het startscherm: de planeten meenemen naar andere apparaten (voor papa).
function toonWolk() {
  const el = $('#wolkpaneel');
  const sites = ['https://owenvanpelt.com', 'https://jakevanpelt.com'];
  if (SANDBOX) {
    el.innerHTML = `<div class="weg-doos"><h2>🧪 Testomgeving</h2><p class="weg-uitleg">Hier staat de wolk uit: testplaneten blijven alleen op dit apparaat en raken de echte planeten nooit. Ook de toverknop werkt hier niet (die kost geld).</p><button class="opnieuw wolk-dicht">Sluiten</button></div>`;
    el.querySelector('.wolk-dicht').onclick = () => (el.hidden = true);
    el.hidden = false;
    return;
  }
  if (!wolk.aan) {
    el.innerHTML = `<div class="weg-doos">
      <h2>☁️ Meenemen naar andere apparaten</h2>
      <p class="weg-uitleg">Zet je de wolk aan, dan staan de planeten op elke tablet en computer waar je ze koppelt. Ze leven overal gewoon verder.</p>
      <button class="tt-klaar wolk-aan">Wolk aanzetten</button>
      <button class="tt-klaar wolk-bak">🗑️ Prullenbak</button>
      <button class="opnieuw wolk-dicht">Sluiten</button></div>`;
    el.querySelector('.wolk-bak').onclick = () => toonPrullenbak();
    el.querySelector('.wolk-aan').onclick = async (e) => {
      e.target.disabled = true;
      e.target.textContent = 'Bezig...';
      await wolk.zetAan();
      toonWolk();
    };
  } else {
    el.innerHTML = `<div class="weg-doos">
      <h2>☁️ De planeten gaan mee</h2>
      <p class="weg-uitleg">Open één van deze links één keer op de tablet of computer. Daarna gaat het vanzelf.</p>
      ${sites.map((s) => `<div class="wolk-link"><code>${wolk.linkVoor(s)}</code><button class="kleurbol plus wolk-kopie" data-link="${wolk.linkVoor(s)}" title="Kopiëren">📋</button></div>`).join('')}
      <p class="weg-uitleg">Familiecode: <b>${wolk.code}</b></p>
      <button class="tt-klaar wolk-bak">🗑️ Prullenbak</button>
      <button class="opnieuw wolk-dicht">Sluiten</button></div>`;
    el.querySelector('.wolk-bak').onclick = () => toonPrullenbak();
    el.querySelectorAll('.wolk-kopie').forEach((b) =>
      (b.onclick = async () => {
        try {
          await navigator.clipboard.writeText(b.dataset.link);
          b.textContent = '✅';
        } catch {
          b.textContent = '❌';
        }
      })
    );
  }
  el.querySelector('.wolk-dicht').onclick = () => (el.hidden = true);
  el.hidden = false;
}

// Prullenbak (voor papa): weggegooide planeten van deze tablet en uit de wolk terughalen.
async function toonPrullenbak() {
  const el = $('#wolkpaneel');
  el.innerHTML = `<div class="weg-doos"><h2>🗑️ Prullenbak</h2><p class="weg-uitleg">Weggegooide planeten blijven 30 dagen bewaard. Terughalen zet de huidige planeet van die speler zelf weer in de prullenbak.</p><div class="bak-lijst">Even zoeken...</div><button class="opnieuw wolk-dicht">Terug</button></div>`;
  el.querySelector('.wolk-dicht').onclick = () => toonWolk();
  el.hidden = false;
  const items = lees(PRULLENBAK, [])
    .filter((x) => Date.now() - x.wanneer < MAAND)
    .map((x) => ({ wie: x.wie, wanneer: x.wanneer, haal: async () => x.data }));
  for (const x of await wolk.prullenbak()) {
    // Dezelfde planeet staat vaak hier én in de wolk: maar één keer laten zien.
    if (!items.some((y) => y.wie === x.wie && Math.abs(y.wanneer - x.wanneer) < 120000)) items.push(x);
  }
  items.sort((a, b) => b.wanneer - a.wanneer);
  const lijst = el.querySelector('.bak-lijst');
  lijst.textContent = items.length ? '' : 'De prullenbak is leeg.';
  for (const x of items.slice(0, 15)) {
    const rij = document.createElement('div');
    rij.className = 'wolk-link';
    const datum = new Date(x.wanneer).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    rij.innerHTML = `<span></span><button class="tt-klaar">Terughalen</button>`;
    rij.querySelector('span').textContent = `${naamVan(x.wie)} · ${datum}`;
    rij.querySelector('button').onclick = async (e) => {
      e.target.disabled = true;
      e.target.textContent = 'Bezig...';
      const data = await x.haal();
      if (!data || !data.recept) {
        e.target.textContent = 'Lukt niet';
        return;
      }
      legInPrullenbak(x.wie);
      wolk.zetPakket(x.wie, data);
      herlaadUitOpslag();
      await wolk.stuur(x.wie, true);
      e.target.textContent = '✅ Terug!';
      tekenStartKaarten();
    };
    lijst.appendChild(rij);
  }
}

async function begin(id) {
  zuinig.rust();
  wie = id;
  geschiedenis = [];
  knopTerug.classList.add('uit');
  startScherm.hidden = true;
  makerScherm.hidden = false;
  aanpassenAanScherm();
  camera.position.set(0, 0.6, 4.4).setLength(beginAfstand());
  if (planeten[id]) {
    // Ontbrekende velden aanvullen (oudere planeten of uit de wolk), zodat er nergens met "niets" gerekend wordt.
    recept = metId(vulAan(planeten[id]), id);
    bouwDock();
    dock.hidden = false;
    toonNaam();
    stem.zeg(`Hoi ${naamVan(id)}! Daar is je planeet weer.`);
    const mijn = sessie;
    const p = await Planeet.maak(zicht(recept), 'snel');
    if (mijn !== sessie) return p.opruimen();
    snel = p;
    houder.scale.setScalar(1);
    toonPlaneet(snel);
    wezensVuil = true;
    // De tijd inhalen die voorbij is gegaan sinds het vorige bezoek.
    const lang = (recept.wezens || []).length > 0;
    if (lang) toonMelding('⏳ Even kijken wat er gebeurd is...');
    const weg = await leven.open(id, recept, snel);
    if (mijn !== sessie) return;
    if (lang) verbergMelding();
    wezenIds = (recept.wezens || []).map((w) => w.id).join(',');
    werkJaarBij();
    if (weg && weg.nieuws.length) toonWeg(weg);
    if (recept.klaar) planHD(0);
  } else {
    startGeboorte();
    bouwDock();
  }
}

// Elke planeet krijgt een eigen nummer en een eigenaar, en wie hem mag zien (nu alleen de familie).
// Nu nog niet nodig, maar straks wel: meer planeten per kind, bezoeken bij vrienden, een heelal.
function metId(r, eigenaar) {
  if (!r.id) {
    r.id = crypto.randomUUID ? crypto.randomUUID() : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    r.schema = 2;
    r.eigenaar = eigenaar;
    r.zichtbaar = 'familie';
    r.gemaakt = Date.now();
  }
  return r;
}

const naamVan = (id) => K.MAKERS.find((m) => m.id === id).naam;

function toonNaam() {
  $('#titel').textContent = recept.naam || `Planeet van ${naamVan(wie)}`;
}

// ================= Geboorte =================
function startGeboorte() {
  dock.hidden = true;
  $('#titel').textContent = '';
  const stof = new Sterrenstof();
  scene.add(stof.punten);
  geboorte = { stof, tikken: 0 };
  recept = metId({ ...structuredClone(KAAL), zaad: 'p-' + Math.floor(Math.random() * 1e9) }, wie);
  toonMelding('Tik op het sterrenstof!');
  stem.zeg('Kijk, sterrenstof! Tik er drie keer op, dan wordt er een planeet geboren.');
  // Planeet alvast bouwen terwijl het stof draait, dan hapert de onthulling niet.
  const mijn = sessie;
  Planeet.maak(recept, 'snel').then((p) => {
    if (mijn !== sessie) return p.opruimen();
    snel = p;
    houder.scale.setScalar(0.001);
    toonPlaneet(snel);
    leven.wis(wie);
    leven.open(wie, recept, snel);
  });
}

function tikGeboorte() {
  if (!geboorte || !snel) return;
  geboorte.tikken++;
  geboorte.stof.tik(geboorte.tikken);
  if (geboorte.tikken < 3) {
    geluid.pling(geboorte.tikken * 2);
    toonMelding(geboorte.tikken === 1 ? 'Nog twee keer!' : 'Nog één keer!');
    return;
  }
  geluid.geboorte();
  $('#flits').classList.remove('aan');
  void $('#flits').offsetWidth;
  $('#flits').classList.add('aan');
  const { stof } = geboorte;
  geboorte = null;
  verbergMelding();
  setTimeout(() => {
    scene.remove(stof.punten);
    stof.opruimen();
  }, 300);
  groei.start = performance.now();
  setTimeout(() => {
    dock.hidden = false;
    toonNaam();
    opslaan();
    planFoto();
    stem.zeg('Hoera! Er is een nieuwe planeet geboren. Hij is nog kaal en grijs. Kies hieronder wat je wilt maken!');
  }, 1400);
}
const groei = { start: 0 };
function groeiAnimatie(nu) {
  if (!groei.start) return;
  const t = Math.min(1, (nu - groei.start) / 1300);
  const c1 = 1.70158, c3 = c1 + 1;
  const e = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); // springerig groeien
  houder.scale.setScalar(Math.max(0.001, e));
  if (t >= 1) groei.start = 0;
}

// ================= Dock en panelen =================
function bouwDock() {
  dock.innerHTML = '';
  const gebruikt = recept._gebruikt || [];
  let eersteNieuw = true;
  for (const g of K.GEREEDSCHAP) {
    if (g.verborgen) continue;
    const k = document.createElement('button');
    k.className = 'gereedschap';
    k.dataset.id = g.id;
    k.innerHTML = `<span class="icoon">${icoon(g.id, g.icoon)}</span><span class="label">${g.label}</span>`;
    if (!gebruikt.includes(g.id) && eersteNieuw && g.id !== 'wens') {
      k.classList.add('wenk');
      eersteNieuw = false;
    }
    k.addEventListener('click', () => {
      geluid.klik();
      if (gereedschap === g.id) sluitPaneel();
      else toonPaneel(g.id, true);
    });
    dock.appendChild(k);
  }
}

function sluitPaneel() {
  gereedschap = null;
  paneel.hidden = true;
  paneel.innerHTML = '';
  zetPenseel(null);
  dock.querySelectorAll('.aan').forEach((k) => k.classList.remove('aan'));
  meetPaneel();
  // Klaar met bouwen: terug naar de mooie versie.
  if (recept && hdKlopt()) toonPlaneet(hd);
  else if (recept && recept.klaar) planHD();
}

function zetPenseel(modus) {
  penseel.modus = modus;
  penseel.draai = false;
  cursor.visible = false;
  doek.classList.toggle('penseel', !!modus);
  draaiKnop.hidden = !modus;
  draaiKnop.classList.remove('aan');
}
// ✋ Tijdens boetseren of verven even de planeet draaien met één vinger (twee vingers kan ook).
const draaiKnop = document.createElement('button');
draaiKnop.id = 'draaiknop';
draaiKnop.className = 'rond';
draaiKnop.title = 'Draaien';
draaiKnop.innerHTML = '✋<small>Draaien</small>';
draaiKnop.hidden = true;
draaiKnop.addEventListener('click', () => {
  penseel.draai = !penseel.draai;
  draaiKnop.classList.toggle('aan', penseel.draai);
  cursor.visible = false;
  geluid.klik();
  stem.zeg(penseel.draai ? 'Nu kun je de planeet draaien. Tik nog een keer op het handje om verder te bouwen.' : 'Bouwen maar!');
});
document.getElementById('maker').appendChild(draaiKnop);

function toonPaneel(id, opnieuw) {
  const g = K.GEREEDSCHAP.find((x) => x.id === id);
  gereedschap = id;
  // Tijdens het bouwen de snelle versie, die reageert meteen op elke keuze.
  if (snel && !['naam', 'wens', 'wezens', 'verhaal'].includes(id)) {
    clearTimeout(hdTimer);
    toonPlaneet(snel);
  }
  if (opnieuw) {
    recept._gebruikt = [...new Set([...(recept._gebruikt || []), id])];
    stem.zeg(g.zeg);
    opslaan();
  }
  dock.querySelectorAll('.gereedschap').forEach((k) => {
    k.classList.toggle('aan', k.dataset.id === id);
    if (k.dataset.id === id) k.classList.remove('wenk');
  });
  if (opnieuw) {
    const volgende = [...dock.querySelectorAll('.gereedschap')].find(
      (k) => !recept._gebruikt.includes(k.dataset.id) && k.dataset.id !== 'wens'
    );
    dock.querySelectorAll('.wenk').forEach((k) => k.classList.remove('wenk'));
    if (volgende) volgende.classList.add('wenk');
  }
  paneel.hidden = false;
  paneel.innerHTML = `<div class="kop"><span class="kop-titel">${icoon(g.id, g.icoon)} ${g.label}</span><button class="lees" title="Voorlezen">🔈</button><button class="dicht" title="Dicht">✕</button></div><div class="inhoud"></div>`;
  paneel.querySelector('.lees').onclick = () => {
    const was = stem.aan;
    stem.aan = true;
    stem.zeg(g.zeg);
    stem.aan = was;
  };
  paneel.querySelector('.dicht').onclick = () => {
    geluid.klik();
    sluitPaneel();
  };
  const inhoud = paneel.querySelector('.inhoud');
  zetPenseel(null);
  PANELEN[id](inhoud);
  meetPaneel();
}

function meetPaneel() {
  requestAnimationFrame(() => {
    paneelHoogte = paneel.hidden ? 0 : paneel.getBoundingClientRect().height;
  });
}

// Kleine bouwstenen voor panelen
function rij(titel) {
  const d = document.createElement('div');
  d.className = 'rij';
  if (titel) d.innerHTML = `<div class="rij-titel">${titel}</div>`;
  const k = document.createElement('div');
  k.className = 'keuzes';
  d.appendChild(k);
  return [d, k];
}
function knop(html, klasse, actie, { aan = false, titel = '' } = {}) {
  const b = document.createElement('button');
  b.className = klasse + (aan ? ' aan' : '');
  b.innerHTML = html;
  if (titel) b.title = titel;
  b.addEventListener('click', () => actie(b));
  return b;
}
function kies(houderEl, b) {
  houderEl.querySelectorAll('.aan').forEach((x) => x.classList.remove('aan'));
  b.classList.add('aan');
}
function kleurBol(kleurHex, titel, aan, actie, extra = '') {
  const b = knop(extra, 'kleurbol', actie, { aan, titel });
  b.style.setProperty('--k', kleurHex);
  return b;
}
function schuif(links, rechts, waarde, min, max, opWijzig) {
  const d = document.createElement('div');
  d.className = 'schuif';
  d.innerHTML = `<span>${links}</span><input type="range" min="${min}" max="${max}" step="0.01" value="${waarde}"><span>${rechts}</span>`;
  const inp = d.querySelector('input');
  inp.addEventListener('pointerdown', bewaarStap);
  inp.addEventListener('keydown', bewaarStap, { once: true });
  inp.addEventListener('input', () => {
    opWijzig(parseFloat(inp.value));
    wijzig();
  });
  inp.addEventListener('change', () => geluid.klik());
  return d;
}
function zet(veld, waarde) {
  bewaarStap();
  recept[veld] = waarde;
  wijzig();
}

const PANELEN = {
  grond(el) {
    el.appendChild(schuif('🐭', '🐘', recept.grootte, 0.6, 1.4, (v) => (recept.grootte = v)));
    const [r, k] = rij();
    for (const v of K.VORMEN) {
      const huidig = Object.entries(v.zet).every(([a, b]) => recept[a] === b);
      k.appendChild(
        knop(`<span class="groot">${icoon("vorm-" + v.id, v.icoon)}</span><span>${v.label}</span>`, 'kaart', (b) => {
          bewaarStap();
          Object.assign(recept, v.zet);
          kies(k, b);
          geluid.poef();
          wijzig();
        }, { aan: huidig })
      );
    }
    k.appendChild(
      knop(`<span class="groot">🎲</span><span>Schudden</span>`, 'kaart', () => {
        bewaarStap();
        recept.zaad = 'p-' + Math.floor(Math.random() * 1e9);
        geluid.poef();
        wijzig();
      })
    );
    el.appendChild(r);
  },

  water(el) {
    const [r1, k1] = rij();
    const giet = knop('<span class="groot">🚿</span><span>Gieten</span>', 'giet', () => {});
    const leeg = knop('<span class="groot">🕳️</span><span>Leeg</span>', 'giet leeg', () => {});
    vasthouden(giet, 1);
    vasthouden(leeg, -1);
    k1.append(giet, leeg);
    el.appendChild(r1);
    const [r2, k2] = rij();
    for (const w of K.WATER) {
      k2.appendChild(
        kleurBol(w.kleur, w.label, recept.waterKleur === w.kleur, (b) => {
          bewaarStap();
          recept.waterKleur = w.kleur;
          recept.zeeGloeit = !!w.gloeit;
          if (recept.zee <= 0) {
            recept.zee = 0.45;
            geluid.bubbel();
          }
          kies(k2, b);
          geluid.plop();
          wijzig();
          gloei.classList.toggle('aan', recept.zeeGloeit);
        })
      );
    }
    el.appendChild(r2);
    const [r3, k3] = rij();
    const gloei = knop('<span class="groot">✨</span><span>Gloeien</span>', 'kaart', (b) => {
      zet('zeeGloeit', !recept.zeeGloeit);
      b.classList.toggle('aan', recept.zeeGloeit);
      geluid.pling(3);
    }, { aan: recept.zeeGloeit });
    k3.appendChild(gloei);
    el.appendChild(r3);
  },

  kleur(el) {
    const [r, k] = rij();
    for (const t of K.THEMAS) {
      const g = t.grond;
      const aan = JSON.stringify(recept.grond) === JSON.stringify(g);
      k.appendChild(
        knop(
          `<span class="strook">${['strand', 'laag', 'midden', 'hoog', 'top'].map((s) => `<i style="background:${g[s]}"></i>`).join('')}</span><span>${t.label}</span>`,
          'kaart thema',
          (b) => {
            bewaarStap();
            recept.grond = { ...g };
            kies(k, b);
            geluid.plop();
            wijzig();
          },
          { aan }
        )
      );
    }
    el.appendChild(r);
  },

  hamer(el) {
    zetPenseel('hamer');
    const [r, k] = rij();
    k.append(
      knop('<span class="groot">⛰️</span><span>Berg omhoog</span>', 'kaart', (b) => {
        penseel.richting = 1;
        kies(k, b);
        geluid.klik();
      }, { aan: penseel.richting > 0 }),
      knop('<span class="groot">🕳️</span><span>Kuil graven</span>', 'kaart', (b) => {
        penseel.richting = -1;
        kies(k, b);
        geluid.klik();
      }, { aan: penseel.richting < 0 })
    );
    el.appendChild(r);
    el.appendChild(maatKeuze());
    el.insertAdjacentHTML('beforeend', '<div class="tip">Draaien? Veeg naast je planeet.</div>');
  },

  kwast(el) {
    zetPenseel('kwast');
    const [r, k] = rij();
    for (const c of K.VERF) {
      k.appendChild(
        kleurBol(c, '', !penseel.gum && penseel.kleur === c, (b) => {
          penseel.kleur = c;
          penseel.gum = false;
          kies(k, b);
          geluid.plop();
        })
      );
    }
    k.appendChild(
      knop('🧽', 'kleurbol gum', (b) => {
        penseel.gum = true;
        kies(k, b);
        geluid.klik();
      }, { aan: penseel.gum, titel: 'Gum' })
    );
    el.appendChild(r);
    el.appendChild(maatKeuze());
    el.insertAdjacentHTML('beforeend', '<div class="tip">Draaien? Veeg naast je planeet.</div>');
  },

  lucht(el) {
    const [r1, k1] = rij('Lucht');
    for (const l of K.LUCHT) {
      k1.appendChild(
        kleurBol(l.kleur, l.label, recept.lucht === l.kleur, (b) => {
          zet('lucht', l.kleur);
          kies(k1, b);
          geluid.plop();
        })
      );
    }
    el.appendChild(r1);
    el.appendChild(schuif('🏜️', '🌧️', recept.wolken, 0, 1, (v) => (recept.wolken = v)));
    const [r2, k2] = rij('Wolken');
    for (const w of K.WOLKEN) {
      k2.appendChild(
        kleurBol(w.kleur, w.label, recept.wolkKleur === w.kleur, (b) => {
          bewaarStap();
          recept.wolkKleur = w.kleur;
          if (recept.wolken < 0.15) recept.wolken = 0.5;
          kies(k2, b);
          geluid.plop();
          wijzig();
          toonPaneel('lucht', false);
        })
      );
    }
    k2.appendChild(
      knop('<span class="groot">⛈️</span><span>Stormachtig</span>', 'kaart klein', (b) => {
        bewaarStap();
        recept.onweer = !recept.onweer;
        if (recept.onweer && recept.wolken < 0.3) recept.wolken = 0.55;
        b.classList.toggle('aan', recept.onweer);
        if (recept.onweer) {
          // Meteen een storm laten zien, zodat je weet wat het doet.
          maakStorm(true);
          stem.zeg('Nu komen er vaker stormen. Maar niet altijd!');
        }
        wijzig();
      }, { aan: recept.onweer })
    );
    el.appendChild(r2);
  },

  klimaat(el) {
    const regel = (titel, links, rechts, veld, standaard) => {
      el.insertAdjacentHTML('beforeend', `<div class="rij-titel klimaat-titel">${titel}</div>`);
      el.appendChild(schuif(links, rechts, recept[veld] ?? standaard, 0, 1, (v) => (recept[veld] = v)));
    };
    regel('Warm of koud?', '❄️', '🔥', 'temperatuur', 0.5);
    regel('Seizoenen: winter en zomer', '🌤️', '⛄', 'seizoenen', 0.3);
    regel('Woestijnen', '🌿', '🏜️', 'woestijn', 0.2);
    regel('IJskappen', '🟫', '🧊', 'ijskappen', 0);
    el.insertAdjacentHTML('beforeend', '<div class="tip">Woestijnen, ijs en oerwouden komen vanzelf op de plekken waar het warm, koud, droog of nat is.</div>');
  },

  bos(el) {
    el.appendChild(
      schuif('🏜️', '🌲🌲', recept.bomen, 0, 1, (v) => (recept.bomen = v))
    );
    // Meerdere soorten tegelijk: tik om aan of uit te zetten (minstens één blijft aan).
    const [r1, k1] = rij('Welke bomen? Je mag er meer kiezen');
    const huidig = recept.boomVormen && recept.boomVormen.length ? recept.boomVormen : [recept.boomVorm || 'den'];
    for (const b of K.BOMEN) {
      k1.appendChild(
        knop(`<span class="groot">${icoon("boom-" + b.id, b.icoon)}</span><span>${b.label}</span>`, 'kaart', () => {
          const aan = huidig.includes(b.id);
          if (aan && huidig.length === 1) return;
          bewaarStap();
          recept.boomVormen = aan ? huidig.filter((x) => x !== b.id) : [...huidig, b.id];
          recept.boomVorm = recept.boomVormen[0];
          if (recept.bomen < 0.1) recept.bomen = 0.5;
          geluid.plop();
          wijzig();
          toonPaneel('bos', false);
        }, { aan: huidig.includes(b.id) })
      );
    }
    el.appendChild(r1);
    const [r2, k2] = rij(huidig.includes('paddenstoel') ? 'Bladeren' : '');
    for (const c of K.BOOMKLEUREN) {
      k2.appendChild(
        kleurBol(c, '', recept.boomKleur === c, (b) => {
          zet('boomKleur', c);
          kies(k2, b);
          geluid.plop();
        })
      );
    }
    el.appendChild(r2);
    // Paddenstoelen hebben een eigen kleur: standaard rood met witte stippen.
    if (huidig.includes('paddenstoel')) {
      const [r3, k3] = rij('🍄 Paddenstoelen');
      const gekozen = recept.paddenstoelKleur || PADDENSTOEL_ROOD;
      for (const c of [PADDENSTOEL_ROOD, ...K.BOOMKLEUREN.filter((x) => x !== '#e8483a')]) {
        k3.appendChild(
          kleurBol(c, '', gekozen === c, (b) => {
            zet('paddenstoelKleur', c === PADDENSTOEL_ROOD ? null : c);
            kies(k3, b);
            geluid.plop();
          })
        );
      }
      el.appendChild(r3);
    }
  },

  wezens(el) {
    const lijst = recept.wezens || [];
    const [r, k] = rij();
    k.appendChild(
      knop('<span class="groot">✏️</span><span>Nieuw wezen tekenen</span>', 'kaart nieuw-wezen', async () => {
        geluid.klik();
        stopVolg();
        const w = await openTekentafel({ heeftWater: () => recept.zee > 0 });
        if (!w) {
          if (gereedschap === 'wezens') toonPaneel('wezens', false);
          return;
        }
        bewaarStap();
        recept.wezens = [...(recept.wezens || []), w];
        wijzig();
        opslaan();
        geluid.geboorte();
        stem.zeg(`Daar is ${w.naam}! Kijk, hij leeft!`);
        if (gereedschap === 'wezens') toonPaneel('wezens', false);
        // Even wachten tot ze geplaatst zijn, dan erheen vliegen.
        setTimeout(() => {
          const d = wezens.willekeurigDier(w.id);
          if (d) bezoek(d, w);
        }, 400);
      })
    );
    el.appendChild(r);
    for (const w of lijst) {
      const kaart = document.createElement('div');
      kaart.className = 'wezenkaart';
      const info = leven.info(w.id);
      const stand = !info
        ? `${K.BEWEGINGEN.find((b) => b.id === w.beweging).icoon} × ${w.aantal}`
        : info.soort.uitgestorven !== null
          ? '🪦 uitgestorven'
          : `${rolTekst(info)} · 👪 ${telTekst(info.totaal)} · ${info.tijdperk.icoon} ${info.tijdperk.naam}`;
      kaart.innerHTML = `<img src="${beeldVan(w).open}" alt=""><div class="wezen-info"><b></b><span>${stand}</span></div>`;
      kaart.querySelector('b').textContent = w.naam;
      const knoppen = document.createElement('div');
      knoppen.className = 'wezen-knoppen';
      // Elke knop heeft een woordje eronder; lang drukken leest het voor.
      const label = (emoji, woord, id) => `<span>${icoon(id, emoji)}</span><small>${woord}</small>`;
      knoppen.append(
        knop(label(w.echt ? '🔒' : '✏️', w.echt ? 'Op slot' : 'Teken', w.echt ? 'ui-slot' : 'ui-teken'), 'kleurbol plus wezenknop' + (w.echt ? ' op-slot' : ''), async () => {
          geluid.klik();
          // Eenmaal echt gemaakt is een wezen af: niet meer aanpassen.
          if (w.echt) {
            stem.zeg(`${w.naam} is echt geworden. Die kun je niet meer veranderen.`);
            return toonMelding(`🔒 ${w.naam} is echt en blijft zo`, 2500);
          }
          stopVolg();
          const nieuw = await openTekentafel({ heeftWater: () => recept.zee > 0, bestaand: w });
          if (!nieuw) return toonPaneel('wezens', false);
          bewaarStap();
          recept.wezens = recept.wezens.map((x) => (x.id === w.id ? nieuw : x));
          wijzig();
          opslaan();
          leven.pasAan(nieuw);
          geluid.pling(3);
          stem.zeg(`${nieuw.naam} ziet er nu zo uit!`);
          toonPaneel('wezens', false);
        }, { titel: 'Aanpassen of inkleuren' }),
        knop(label(w.echt && w.weergave === 'echt' ? '🖍️' : '✨', w.echt ? (w.weergave === 'echt' ? 'Tekening' : 'Echt') : 'Maak echt', w.echt && w.weergave === 'echt' ? 'ui-krijt' : 'ui-tover'), 'kleurbol plus wezenknop toverknop', () => maakEchtKnop(w), { titel: w.echt ? (w.weergave === 'echt' ? 'Terug naar de tekening' : 'Laat de echte versie zien') : 'Maak echt' }),
        knop(label('👀', 'Bezoek', 'ui-bezoek'), 'kleurbol plus wezenknop', () => {
          const d = wezens.willekeurigDier(w.id);
          if (d) {
            geluid.zwiep();
            bezoek(d, w);
          }
        }, { titel: 'Bezoeken' }),
        knop(label('🔊', 'Luister', 'ui-luister'), 'kleurbol plus wezenknop', () => maakGeluid(w, 1), { titel: 'Luister' }),
        knop(label('📜', 'Verhaal', 'verhaal'), 'kleurbol plus wezenknop', () => {
          geluid.klik();
          toonPaneel('verhaal', true);
        }, { titel: 'Hun verhaal' })
      );
      // Weghalen staat apart (niet naast het verhaal) en gaat alleen met vasthouden. Het wezen
      // vertrekt met een ruimteschip; met de oeps-knop komt het met zijn hele verhaal terug.
      const weg = knop(`<span class="houd-ring"></span>${label('🛸', 'Weg', 'ui-weg')}`, 'kleurbol plus wezenknop wezen-weg', () => {}, { titel: 'Weg met het ruimteschip' });
      houdVast(weg, {
        uitleg: `Moet ${w.naam} met het ruimteschip weg?`,
        klaar: () => {
          bewaarStap();
          recept.wezens = recept.wezens.filter((x) => x.id !== w.id);
          wijzig();
          opslaan();
          stem.zeg(`${w.naam} is met het ruimteschip vertrokken. Wil je hem terug? Tik op de oeps-knop.`);
          toonPaneel('wezens', false);
        },
      });
      knoppen.append(weg);
      kaart.appendChild(knoppen);
      el.appendChild(kaart);
    }
    if (!lijst.length) el.insertAdjacentHTML('beforeend', '<div class="tip">Nog geen wezens. Teken er eentje!</div>');
    else el.insertAdjacentHTML('beforeend', '<div class="tip">Tik op een wezen op je planeet!</div>');
  },

  verhaal(el) {
    const w = leven.w;
    const lijst = recept.wezens || [];
    if (!w || !lijst.length) {
      el.insertAdjacentHTML('beforeend', '<div class="tip">Er woont nog niemand op je planeet. Teken een wezen bij 🐾 Wezens!</div>');
      return;
    }
    el.insertAdjacentHTML('beforeend', `<div class="verhaal-jaar">Jaar ${telTekst(w.jaar)} op ${recept.naam || 'je planeet'}</div>`);
    const k = leven.klimaat();
    const fase = FASEN[k.fase] || FASEN.gewoon;
    const warmte = k.temp > 0.08 ? ' · 🌡️ warmer dan normaal' : k.temp < -0.08 ? ' · ❄️ kouder dan normaal' : '';
    el.insertAdjacentHTML('beforeend', `<div class="soort-stand klimaatregel">Klimaat: ${fase.icoon} ${fase.naam}${warmte}${k.vervuiling > 0.1 ? ' · 🏭 rokerige lucht' : ''}</div>`);
    for (const wz of lijst) {
      const info = leven.info(wz.id);
      if (!info) continue;
      const s = info.soort;
      const kaart = document.createElement('div');
      kaart.className = 'soortkaart';
      const dood = s.uitgestorven !== null;
      const welvaart = info.groepen.reduce((a, g) => a + (g.cap ? Math.min(1, g.cap / Math.max(g.pop, 1e-6)) * g.pop : 0), 0) / Math.max(1, info.totaal);
      const gevoel = dood ? '🪦' : welvaart > 0.8 ? '😊' : welvaart > 0.5 ? '🙂' : '😟';
      const tech = TECH.map((t) => { if (!s.tech.includes(t.id)) return ""; const tn = techNaam(t.id, s); return `<span title="${tn.naam}">${tn.icoon}</span>`; }).join("")
      // Een uitvinding die "slaapt" (donkere tijden): grijs, en ze komt terug als het beter gaat.
      const slaapt = s.vlaggen.slaapt && !dood ? `<span class="slaapt" title="${techNaam(s.vlaggen.slaapt, s).naam} slaapt even">${techNaam(s.vlaggen.slaapt, s).icoon}💤</span>` : "";
      kaart.innerHTML = `
        <img src="${beeldVan(wz).open}" alt="" class="${dood ? 'dood' : ''}">
        <div class="soort-info">
          <b></b>
          <div class="soort-stand">${dood ? `Uitgestorven in jaar ${telTekst(s.uitgestorven)}${s.oorzaak && OMDAT[s.oorzaak] ? `, omdat ${OMDAT[s.oorzaak]}` : ''}` : `${rolTekst(info)} · ${info.tijdperk.icoon} ${info.tijdperk.naam} · 👪 ${telTekst(info.totaal)} · ${gevoel}`}</div>
          ${!dood && info.stammen > 1 ? `<div class="soort-stand">🏕️ ${info.stammen} stammen</div>` : ''}
          <div class="meters"></div>
          <div class="soort-tech">${tech + slaapt || '<span class="dim">Nog niets ontdekt</span>'}</div>
        </div>`;
      kaart.querySelector('b').textContent = meervoud(wz.naam);
      // Drie gezichtjes: eten, water, warmte. Tikken leest voor hoe het gaat en waarom.
      const m = !dood && leven.meters(wz.id);
      if (m) {
        const vak = kaart.querySelector('.meters');
        for (const [sleutel, icoon, woord] of [['eten', '🍎', 'Eten'], ['water', '💧', 'Water'], ['warmte', '🌡️', 'Warmte']]) {
          const v = m[sleutel];
          const b = document.createElement('button');
          b.className = 'meter ' + (v > 0.66 ? 'goed' : v > 0.33 ? 'matig' : 'slecht');
          b.innerHTML = `<span>${icoon}</span><span>${v > 0.66 ? '😊' : v > 0.33 ? '😐' : '😟'}</span>`;
          b.title = woord;
          b.onclick = () => {
            const was = stem.aan;
            stem.aan = true;
            stem.zeg(m.zinnen[sleutel]);
            stem.aan = was;
          };
          vak.appendChild(b);
        }
      }
      el.appendChild(kaart);
    }
    const tijdlijn = document.createElement('div');
    tijdlijn.className = 'tijdlijn';
    const plaatjes = Object.fromEntries(lijst.map((x) => [x.id, beeldVan(x).open]));
    for (const e of w.kroniek.slice(-60).reverse()) {
      const rij = document.createElement('div');
      rij.className = 'gebeurtenis belang' + e.belang;
      rij.innerHTML = `<span class="g-icoon">${e.icoon}</span><div class="g-tekst"><small>Jaar ${telTekst(e.jaar)}</small><span></span></div>${e.soort && plaatjes[e.soort] ? `<img src="${plaatjes[e.soort]}" alt="">` : ''}`;
      rij.querySelector('.g-tekst span').textContent = e.tekst;
      rij.addEventListener('click', () => {
        const was = stem.aan;
        stem.aan = true;
        stem.zeg(e.tekst);
        stem.aan = was;
      });
      tijdlijn.appendChild(rij);
    }
    el.appendChild(tijdlijn);
    el.insertAdjacentHTML('beforeend', '<div class="tip">Tik op een regel om hem voor te laten lezen.</div>');
    $('#verhaalknop .bolletje').hidden = true;
    nieuwTeller = 0;
  },

  ruimte(el) {
    const [r1, k1] = rij('Ring');
    k1.appendChild(
      knop('🚫', 'kleurbol geen', (b) => {
        zet('ring', null);
        kies(k1, b);
        geluid.klik();
      }, { aan: !recept.ring, titel: 'Geen ring' })
    );
    for (const c of K.RINGKLEUREN) {
      k1.appendChild(
        kleurBol(c, '', recept.ring && recept.ring.kleur === c, (b) => {
          zet('ring', { kleur: c, breedte: recept.ring ? recept.ring.breedte : 0.5 });
          kies(k1, b);
          geluid.zwiep();
          toonPaneel('ruimte', false);
        })
      );
    }
    el.appendChild(r1);
    if (recept.ring) {
      el.appendChild(schuif('▫️', '⬜', recept.ring.breedte, 0, 1, (v) => (recept.ring = { ...recept.ring, breedte: v })));
    }
    const [r2, k2] = rij('Manen');
    recept.manen.forEach((m, i) => {
      k2.appendChild(
        kleurBol(m.kleur, 'Tik voor een andere kleur', false, () => {
          bewaarStap();
          const j = (K.MAANKLEUREN.indexOf(m.kleur) + 1) % K.MAANKLEUREN.length;
          recept.manen = recept.manen.map((x, k) => (k === i ? { ...x, kleur: K.MAANKLEUREN[j] } : x));
          geluid.plop();
          wijzig();
          toonPaneel('ruimte', false);
        }, '🌙')
      );
    });
    if (recept.manen.length < 5) {
      k2.appendChild(
        knop('➕', 'kleurbol plus', () => {
          bewaarStap();
          recept.manen = [...recept.manen, { kleur: K.MAANKLEUREN[recept.manen.length % K.MAANKLEUREN.length], grootte: 0.2 + Math.random() * 0.8 }];
          geluid.pling(recept.manen.length);
          wijzig();
          toonPaneel('ruimte', false);
        }, { titel: 'Maan erbij' })
      );
    }
    if (recept.manen.length) {
      k2.appendChild(
        knop('➖', 'kleurbol plus', () => {
          bewaarStap();
          recept.manen = recept.manen.slice(0, -1);
          geluid.zwiep();
          wijzig();
          toonPaneel('ruimte', false);
        }, { titel: 'Maan weg' })
      );
    }
    el.appendChild(r2);
  },

  naam(el) {
    const d = document.createElement('div');
    d.className = 'naamrij';
    d.innerHTML = `<input class="naamveld" maxlength="24" placeholder="Naam van je planeet" value="${(recept.naam || '').replace(/"/g, '&quot;')}">`;
    const inp = d.querySelector('input');
    inp.addEventListener('focus', bewaarStap, { once: true });
    inp.addEventListener('input', () => {
      recept.naam = inp.value;
      toonNaam();
      opslaan();
    });
    d.appendChild(
      knop('🎲', 'kleurbol plus', () => {
        bewaarStap();
        recept.naam = K.verzinNaam();
        inp.value = recept.naam;
        toonNaam();
        geluid.pling(2);
        stem.zeg(recept.naam);
        opslaan();
      }, { titel: 'Verzin een naam' })
    );
    el.appendChild(d);
    const [r, k] = rij();
    k.appendChild(knop(`<span class="groot">${icoon('feest', '🎉')}</span><span>Mijn planeet is klaar!</span>`, 'kaart feest', feest));
    el.appendChild(r);
    // Alleen je eigen planeet kun je weggooien. En ook dan gaat hij eerst naar de prullenbak,
    // waar papa hem nog een maand terug kan halen.
    if (!magWissen(wie)) return;
    const weg = knop('<span class="houd-ring"></span>🗑️ Helemaal opnieuw beginnen', 'opnieuw', () => {});
    houdVast(weg, {
      uitleg: 'Wil je een nieuwe planeet? Dan gaat deze naar de prullenbak.',
      klaar: () => {
        leven.bewaar();
        legInPrullenbak(wie);
        delete planeten[wie];
        delete fotos[wie];
        leven.wis(wie);
        schrijf(OPSLAG, planeten);
        schrijf(FOTOS, fotos);
        const ik = wie;
        sluitPaneel();
        ruimOp();
        wie = ik;
        geschiedenis = [];
        startGeboorte();
        bouwDock();
      },
    });
    el.appendChild(weg);
  },

  wens(el) {
    const wensen = lees(WENSEN, []);
    const d = document.createElement('div');
    d.className = 'wens';
    const opnemen = knop('<span class="opname-stip"></span>', 'opneem', () => wisselOpname(opnemen, el), { titel: 'Opnemen' });
    d.appendChild(opnemen);
    const tekst = document.createElement('div');
    tekst.className = 'wens-tekst';
    tekst.innerHTML = `<input class="naamveld" placeholder="Of laat papa het opschrijven"><button class="kleurbol plus" title="Bewaren">💾</button>`;
    tekst.querySelector('button').onclick = () => {
      const v = tekst.querySelector('input').value.trim();
      if (!v) return;
      bewaarWens({ tekst: v });
      geluid.pling(4);
      toonPaneel('wens', false);
    };
    d.appendChild(tekst);
    el.appendChild(d);
    const lijst = document.createElement('div');
    lijst.className = 'wenslijst';
    for (const w of wensen.slice().reverse()) {
      const regel = document.createElement('div');
      regel.className = 'wensregel';
      const datum = new Date(w.wanneer).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
      regel.innerHTML = `<b>${naamVan(w.wie)}</b><span>${datum}</span>`;
      if (w.audio) {
        const speel = knop('▶️', 'kleurbol plus', () => new Audio(w.audio).play());
        regel.appendChild(speel);
      }
      if (w.tekst) regel.insertAdjacentHTML('beforeend', `<span class="wenstekst"></span>`), (regel.querySelector('.wenstekst').textContent = w.tekst);
      lijst.appendChild(regel);
    }
    el.appendChild(lijst);
  },
};

function maatKeuze() {
  const [r, k] = rij();
  k.append(
    knop('<span class="stip klein"></span>', 'kleurbol maat', (b) => {
      penseel.groot = false;
      kies(k, b);
      geluid.klik();
    }, { aan: !penseel.groot, titel: 'Klein' }),
    knop('<span class="stip"></span>', 'kleurbol maat', (b) => {
      penseel.groot = true;
      kies(k, b);
      geluid.klik();
    }, { aan: penseel.groot, titel: 'Groot' })
  );
  return r;
}

// Knop vasthouden om water te gieten of weg te laten lopen.
let gieten = 0, bubbelTijd = 0;
function vasthouden(knopEl, richting) {
  const start = (e) => {
    e.preventDefault();
    if (gieten === 0) bewaarStap();
    gieten = richting;
    knopEl.classList.add('ingedrukt');
  };
  const stop = () => {
    if (gieten === richting) gieten = 0;
    knopEl.classList.remove('ingedrukt');
  };
  knopEl.dataset.vasthouden = '1';
  knopEl.addEventListener('pointerdown', start);
  knopEl.addEventListener('pointerup', stop);
  knopEl.addEventListener('pointerleave', stop);
  knopEl.addEventListener('pointercancel', stop);
}

// Iets weggooien gaat nooit met één tik: je houdt de knop drie tellen vast. Een ring loopt vol
// en de stem telt af. Laat je eerder los, dan gebeurt er niets.
function houdVast(knopEl, { tellen = 3, uitleg, klaar }) {
  knopEl.classList.add('houdknop');
  knopEl.dataset.vasthouden = '1';
  let start = 0, raf = 0, gezegd = 0;
  const reset = () => {
    cancelAnimationFrame(raf);
    start = 0;
    knopEl.style.setProperty('--p', 0);
    knopEl.classList.remove('ingedrukt');
  };
  const loop = () => {
    const t = (performance.now() - start) / 1000;
    knopEl.style.setProperty('--p', Math.min(1, t / tellen));
    const tel = Math.floor(t);
    if (tel > gezegd && tel < tellen) {
      gezegd = tel;
      stem.zeg(['', 'twee', 'één'][tel] || '');
      geluid.pling(tel);
    }
    if (t >= tellen) {
      reset();
      geluid.zwiep();
      klaar();
      return;
    }
    raf = requestAnimationFrame(loop);
  };
  knopEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    start = performance.now();
    gezegd = 0;
    knopEl.classList.add('ingedrukt');
    stem.zeg('drie');
    geluid.pling(0);
    raf = requestAnimationFrame(loop);
  });
  const los = () => {
    if (!start) return;
    const kort = performance.now() - start < 400;
    reset();
    stem.zeg(kort ? `${uitleg} Houd de knop drie tellen vast.` : 'Losgelaten. Er is niets weggegooid.');
  };
  knopEl.addEventListener('pointerup', los);
  knopEl.addEventListener('pointerleave', los);
  knopEl.addEventListener('pointercancel', los);
  knopEl.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ================= Wensen opnemen =================
let opname = null;
async function wisselOpname(knopEl, paneelEl) {
  if (opname) {
    opname.stop();
    return;
  }
  try {
    const stroom = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stroom, { audioBitsPerSecond: 32000 });
    const stukjes = [];
    rec.ondataavailable = (e) => stukjes.push(e.data);
    rec.onstop = () => {
      stroom.getTracks().forEach((t) => t.stop());
      clearTimeout(rec.maxTimer);
      geluid.opname(false);
      opname = null;
      knopEl.classList.remove('neemt-op');
      const blob = new Blob(stukjes, { type: rec.mimeType });
      const lezer = new FileReader();
      lezer.onload = () => {
        if (bewaarWens({ audio: lezer.result })) {
          geluid.pling(4);
          stem.zeg('Dankjewel! Papa krijgt je wens te horen.');
        } else toonMelding('Er is geen plek meer voor wensen', 2500);
        if (gereedschap === 'wens') toonPaneel('wens', false);
      };
      lezer.readAsDataURL(blob);
    };
    stem.stil();
    geluid.opname(true);
    rec.start();
    opname = rec;
    knopEl.classList.add('neemt-op');
    // Hooguit 15 seconden: een opname neemt veel plek in het geheugen van de tablet.
    rec.maxTimer = setTimeout(() => rec.state === 'recording' && rec.stop(), 15000);
  } catch {
    toonMelding('De microfoon doet het niet. Laat papa het opschrijven!', 3000);
  }
}
function bewaarWens(w) {
  const wensen = lees(WENSEN, []);
  wensen.push({ wie, wanneer: Date.now(), ...w });
  const ok = schrijf(WENSEN, wensen);
  wolk.planStuur('wensen', 2000);
  return ok;
}

// ================= Boetseren en verven =================
const straal = new THREE.Raycaster();
const muis = new THREE.Vector2();
function raakPunt(e) {
  const rect = doek.getBoundingClientRect();
  muis.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  straal.setFromCamera(muis, camera);
  return planeet ? planeet.raak(straal.ray) : null;
}
const aanwijzers = new Set();
doek.addEventListener(
  'pointerdown',
  (e) => {
    aanwijzers.add(e.pointerId);
    if (geboorte) {
      tikGeboorte();
      return;
    }
    if (!penseel.modus || !planeet || penseel.draai) return;
    if (aanwijzers.size > 1) {
      stopTekenen();
      return;
    }
    const r = raakPunt(e);
    if (!r) return;
    controls.enabled = false;
    penseel.tekenen = true;
    penseel.nr = (recept.penseel.reduce((m, p) => Math.max(m, p.n), 0) || 0) + 1;
    bewaarStap();
    dep(r, true);
  },
  { capture: true }
);
doek.addEventListener('pointermove', (e) => {
  if (!penseel.modus || !planeet || penseel.draai) return;
  const r = raakPunt(e);
  zetCursor(r);
  if (penseel.tekenen && r) dep(r, false);
});
function stopTekenen() {
  penseel.tekenen = false;
  penseel.laatste = null;
  controls.enabled = true;
}
window.addEventListener('pointerup', (e) => {
  aanwijzers.delete(e.pointerId);
  if (penseel.tekenen) stopTekenen();
});
window.addEventListener('pointercancel', (e) => {
  aanwijzers.delete(e.pointerId);
  if (penseel.tekenen) stopTekenen();
});

function penseelStraal() {
  if (penseel.modus === 'hamer') return penseel.groot ? 0.2 : 0.1;
  return penseel.groot ? 0.12 : 0.05;
}
function dep(r, eerste) {
  const nu = performance.now();
  const rs = penseelStraal();
  if (!eerste) {
    if (nu - penseel.tijd < 45) return;
    if (penseel.laatste && penseel.laatste.angleTo(r) < rs * 0.35) return;
  }
  penseel.tijd = nu;
  penseel.laatste = r.clone();
  const p = { x: +r.x.toFixed(4), y: +r.y.toFixed(4), z: +r.z.toFixed(4), r: rs, n: penseel.nr };
  if (penseel.modus === 'hamer') {
    p.t = 'h';
    p.a = penseel.richting * (penseel.groot ? 0.07 : 0.09);
    if (eerste || Math.random() < 0.3) penseel.richting > 0 ? geluid.rommel() : geluid.schep();
  } else if (penseel.gum) {
    p.t = 'g';
  } else {
    p.t = 'v';
    p.k = penseel.kleur;
    if (eerste || Math.random() < 0.25) geluid.kwast();
  }
  recept.penseel = [...recept.penseel, p];
  wijzig();
}
const omhoog = new THREE.Vector3(0, 0, 1);
function zetCursor(r) {
  if (!r) {
    cursor.visible = false;
    return;
  }
  cursor.visible = true;
  const s = planeet.grondStraal(r);
  cursor.position.copy(r).multiplyScalar(s + 0.004 * recept.grootte);
  cursor.quaternion.setFromUnitVectors(omhoog, r);
  cursor.scale.setScalar(Math.sin(penseelStraal()) * s * 0.75);
  cursor.material.color.set(penseel.modus === 'kwast' && !penseel.gum ? penseel.kleur : '#ffffff');
}

// ================= Wezens: tikken, horen, bezoeken =================
function wijzigWezen(id, velden) {
  bewaarStap();
  recept.wezens = recept.wezens.map((w) => (w.id === id ? { ...w, ...velden } : w));
  wijzig();
  opslaan();
  if (gereedschap === 'wezens') toonPaneel('wezens', false);
}

// ✨ Maak echt: van de tekening een echt ogend wezen maken (zelfde motor als KIZZO).
// Bestaat de echte versie al, dan wisselt de knop tussen tekening en echt.
let toveren = false;
async function maakEchtKnop(w) {
  if (toveren) return;
  if (w.echt) {
    geluid.zwiep();
    zetWezen(w.id, { weergave: w.weergave === 'echt' ? 'tekening' : 'echt' });
    stem.zeg(w.weergave === 'echt' ? `${w.naam} is weer een tekening.` : `Daar is de echte ${w.naam}!`);
    return;
  }
  const status = await echtStatus(wie, wolk.code);
  if (!status.kan) return toonMelding(wolk.aan ? 'De toverknop werkt nu even niet. Probeer het later nog eens.' : 'Papa moet eerst de wolk aanzetten (☁️ op het startscherm).', 4000);
  if (status.over <= 0) {
    stem.zeg('Je toverkracht is op voor vandaag. Morgen kan het weer!');
    return toonMelding('✨ Toverkracht op voor vandaag. Morgen weer!', 4000);
  }
  // Eerst de vacht kiezen als dat nog niet gebeurd is: dat maakt het echte wezen veel beter.
  const huid = w.huid || (await kiesHuid(w));
  if (!huid) return;
  vraag(`Let op: als ${w.naam} echt is, kun je hem niet meer veranderen. Je kunt vandaag nog ${status.over} keer toveren. Wil je ${w.naam} echt maken?`, async () => {
    toveren = true;
    toonMelding('✨ Toveren... even geduld ✨');
    stem.zeg(`Ik ga ${w.naam} echt maken. Even geduld, dit duurt een halve minuut.`);
    const twinkel = setInterval(() => geluid.pling(Math.floor(Math.random() * 5)), 1400);
    try {
      const { echt, over } = await vraagEcht(wie, { ...w, huid }, wolk.code);
      zetWezen(w.id, { huid, echt, weergave: 'echt' });
      verbergMelding();
      geluid.geboorte();
      stem.zeg(`Kijk! ${w.naam} is echt geworden!${over > 0 ? '' : ' Je toverkracht is nu op voor vandaag.'}`);
      setTimeout(() => {
        const d = wezens.willekeurigDier(w.id);
        if (d) bezoek(d, { ...w, naam: w.naam });
      }, 600);
    } catch (e) {
      verbergMelding();
      const tekst = e.status === 429 ? 'Je toverkracht is op voor vandaag.' : 'Het toveren is niet gelukt. Probeer het straks nog eens.';
      toonMelding(tekst, 4000);
      stem.zeg(tekst);
      console.warn('Maak echt mislukt:', e.message);
    } finally {
      clearInterval(twinkel);
      toveren = false;
    }
  });
}

function zetWezen(id, velden) {
  recept.wezens = recept.wezens.map((x) => (x.id === id ? { ...x, ...velden } : x));
  wijzig();
  opslaan();
  if (gereedschap === 'wezens') toonPaneel('wezens', false);
}

// Klein keuzescherm: wat voor vacht of huid heeft dit wezen?
function kiesHuid(w) {
  return new Promise((klaar) => {
    const v = $('#vraag');
    v.querySelector('.vraag-tekst').innerHTML = `Wat voor vacht of huid heeft ${w.naam.replace(/[<>&]/g, '')}?<div class="keuzes huidkeuze"></div>`;
    const lijst = v.querySelector('.huidkeuze');
    for (const h of K.HUIDEN) {
      const b = document.createElement('button');
      b.className = 'kaart';
      b.innerHTML = `<span class="groot">${icoon("huid-" + h.id, h.icoon)}</span><span>${h.label}</span>`;
      b.onclick = () => {
        geluid.plop();
        v.hidden = true;
        zetWezen(w.id, { huid: h.id });
        klaar(h.id);
      };
      lijst.appendChild(b);
    }
    v.querySelector('.ja').hidden = true;
    v.querySelector('.nee').textContent = 'Toch niet';
    v.querySelector('.nee').onclick = () => {
      v.hidden = true;
      klaar(null);
    };
    v.hidden = false;
    stem.zeg(`Wat voor vacht of huid heeft ${w.naam}? Veren, pluizig, vacht, schubben, glad, een pantser of stekels?`);
  }).finally(() => {
    const v = $('#vraag');
    v.querySelector('.ja').hidden = false;
    v.querySelector('.nee').textContent = 'Nee';
  });
}

function maakGeluid(w, hoogte) {
  if (w.geluid) {
    const a = new Audio(w.geluid);
    a.preservesPitch = false; // grote wezens klinken lager, kleine hoger
    a.playbackRate = hoogte;
    a.play().catch(() => {});
  } else geluid.boing(hoogte);
}

function tikDier({ soort, dier }) {
  dier.sprong = 1;
  dier.pauze = 0.6;
  const hoogte = { mier: 1.5, hond: 1.1, olifant: 0.85, reus: 0.7 }[soort.maat] || 1;
  maakGeluid(soort, hoogte);
  const plek = houder.localToWorld(dier.mesh.position.clone()).addScaledVector(dier.dir, dier.maat * 1.2);
  vuurwerk.knal(plek, ['#ff5fb0', '#ffd34d', '#9cff8a', '#5ac8fa'][Math.floor(Math.random() * 4)], {
    aantal: 40,
    grootte: Math.max(0.012, dier.maat * 0.6),
    kracht: Math.max(0.02, dier.maat * 3),
  });
  toonMelding(soort.naam, 1500);
}

function bezoek(dier, soort) {
  volg = dier;
  controls.enabled = false;
  controls.autoRotate = false;
  toonMelding(`Op bezoek bij ${soort.naam}!`, 2200);
}

function stopVolg() {
  if (!volg) return;
  volg = null;
  camera.up.set(0, 1, 0);
  controls.enabled = true;
}

// Een tik (niet slepen) op de planeet: zit daar een wezen?
const tikStart = { x: 0, y: 0, t: 0, aan: false };
doek.addEventListener('pointerdown', (e) => {
  tikStart.x = e.clientX;
  tikStart.y = e.clientY;
  tikStart.t = performance.now();
  tikStart.aan = true;
});
doek.addEventListener('pointermove', (e) => {
  if (tikStart.aan && volg && Math.hypot(e.clientX - tikStart.x, e.clientY - tikStart.y) > 12) stopVolg();
});
doek.addEventListener('wheel', stopVolg, { passive: true });
doek.addEventListener('pointerup', (e) => {
  if (!tikStart.aan) return;
  tikStart.aan = false;
  if (geboorte || penseel.modus || !planeet) return;
  if (Math.hypot(e.clientX - tikStart.x, e.clientY - tikStart.y) > 10 || performance.now() - tikStart.t > 500) return;
  const rect = doek.getBoundingClientRect();
  muis.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  straal.setFromCamera(muis, camera);
  const raak = wezens.raakBij(straal.ray, muis, camera, rect.width, rect.height);
  if (raak) tikDier(raak);
  else if (volg) stopVolg();
});

const volgDoel = new THREE.Vector3(), volgKijk = new THREE.Vector3();
function volgCamera(dt) {
  if (!volg.mesh.parent) return stopVolg();
  const pos = houder.localToWorld(volg.mesh.position.clone());
  const n = volg.dir;
  const afstand = volg.maat * 6 + 0.035;
  volgDoel.copy(pos).addScaledVector(n, afstand * 0.55).addScaledVector(volg.koers, -afstand);
  camera.position.lerp(volgDoel, 1 - Math.exp(-dt * 2.5));
  camera.up.lerp(n, 1 - Math.exp(-dt * 4)).normalize();
  volgKijk.copy(pos).addScaledVector(n, volg.maat * 0.6);
  camera.lookAt(volgKijk);
}

function rolTekst(info) {
  if (info.rol === 'heerser') return `👑 grootste bouwers ${info.rijk === 'zee' ? 'in de zee' : 'op het land'}`;
  if (info.rol === 'huisdier') return `🐕 huisdier van de ${meervoud(leven.w.soorten[info.soort.vlaggen.getemdDoor].naam)}`;
  if (info.soort.vlaggen.heuvels && !info.soort.tech.includes('taal')) return '⛰️ heuvelbouwers';
  if (info.soort.tech.includes('taal')) return '🗣️ slim';
  return '🐾 wild dier';
}

// ================= Nieuwe soorten die vanzelf ontstaan =================
async function nieuweSoortErbij(s) {
  if (!recept || !s.afkomst) return;
  const lijst = recept.wezens || [];
  const ouders = s.afkomst.ouders.map((id) => lijst.find((x) => x.id === id)).filter(Boolean);
  // Stamt hij af van een echt gemaakt wezen, dan wordt hij zelf ook echt.
  const basis = ouders[0] ? { ...ouders[0], plaatje: beeldVan(ouders[0]).open, dicht: beeldVan(ouders[0]).dicht, verhouding: beeldVan(ouders[0]).verhouding } : null;
  const beeld = await plaatjeVoorNieuweSoort({
    ouder: basis,
    tint: s.afkomst.tint,
    vlekken: s.afkomst.soort === 'kruising' ? s.afkomst.vlekken : null,
    zaad: s.id,
    kleur: s.kleur,
  });
  if (!recept || (recept.wezens || []).some((x) => x.id === s.id)) return;
  const wezen = {
    id: s.id,
    naam: s.naam,
    ...beeld,
    beweging: s.beweging,
    maat: s.maat,
    aantal: 0,
    kijkt: basis ? basis.kijkt : 'rechts',
    huid: basis ? basis.huid || null : null,
    geluid: (ouders[Math.floor(Math.random() * ouders.length)] || {}).geluid || null,
    ontstaan: s.afkomst.soort, // 'kruising' of 'afsplitsing'
  };
  recept.wezens = [...(recept.wezens || []), wezen];
  wezenIds = recept.wezens.map((w) => w.id).join(',');
  wezensVuil = true;
  opslaan();
  if (gereedschap === 'wezens') toonPaneel('wezens', false);
}

// ================= Het leven: nieuws, jaartal, terwijl je weg was =================
let nieuwTeller = 0;
function telTekst(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toLocaleString('nl-NL', { maximumFractionDigits: 1 }) + ' miljoen';
  return n.toLocaleString('nl-NL');
}

function werkJaarBij() {
  const w = leven.w;
  const heeft = !!(w && Object.keys(w.soorten).length);
  $('#verhaalknop').hidden = !heeft || !!geboorte;
  const fase = heeft && w.klimaat && w.klimaat.fase !== 'gewoon' ? FASEN[w.klimaat.fase] : null;
  // ⏩ zolang het snelle begin duurt: het jaartal telt eerlijk, de tijd gaat alleen sneller.
  $('#jaar').textContent = heeft ? `${snelBezig(w) ? '⏩ ' : ''}Jaar ${telTekst(w.jaar)}${fase ? ` · ${fase.icoon} ${fase.naam}` : ''}` : '';
}
setInterval(werkJaarBij, 2000);

// Live nieuws terwijl je speelt: een kaartje bovenin, het grote nieuws wordt voorgelezen.
function toonNieuws(lijst) {
  if (leven.bezig || !wie) return;
  const belangrijk = lijst.filter((e) => e.belang >= 2);
  if (!belangrijk.length) return;
  const vak = $('#nieuws');
  for (const e of belangrijk.slice(-3)) {
    const k = document.createElement('div');
    k.className = 'nieuwtje';
    k.innerHTML = `<span>${e.icoon}</span><div></div>`;
    k.querySelector('div').textContent = e.tekst;
    vak.appendChild(k);
    setTimeout(() => k.classList.add('weg'), 7000);
    setTimeout(() => k.remove(), 7600);
  }
  geluid.pling(4);
  const groot = belangrijk.filter((e) => e.belang >= 3);
  if (groot.length && !opname) stem.zeg(groot[groot.length - 1].tekst);
  if (gereedschap !== 'verhaal') {
    nieuwTeller += belangrijk.length;
    const b = $('#verhaalknop .bolletje');
    b.hidden = false;
    b.textContent = nieuwTeller > 9 ? '9+' : nieuwTeller;
  } else toonPaneel('verhaal', false);
  werkJaarBij();
}

function duurTekst(minuten) {
  if (minuten < 60) return `${Math.max(1, Math.round(minuten))} minuten`;
  if (minuten < 60 * 24) return `${Math.round(minuten / 60)} uur`;
  const d = Math.round(minuten / 1440);
  return d === 1 ? 'een dag' : `${d} dagen`;
}

// Scherm bij binnenkomst: wat er allemaal gebeurd is sinds de vorige keer.
function toonWeg(weg) {
  const el = $('#weg');
  const naam = recept.naam || 'je planeet';
  // Niet te veel tegelijk voor een kind van 6: de vijf belangrijkste laten zien, er drie voorlezen.
  const lijst = [...weg.nieuws].sort((a, b) => b.belang - a.belang || b.jaar - a.jaar).slice(0, 5).sort((a, b) => a.jaar - b.jaar);
  const voorlezen = [...lijst].sort((a, b) => b.belang - a.belang).slice(0, 3).sort((a, b) => a.jaar - b.jaar);
  const meer = weg.nieuws.length > voorlezen.length;
  const plaatjes = Object.fromEntries((recept.wezens || []).map((x) => [x.id, beeldVan(x).open]));
  el.innerHTML = `
    <div class="weg-doos">
      <h2>Terwijl je weg was...</h2>
      <p class="weg-uitleg">Je was ${duurTekst(weg.minuten)} weg. Op ${naam} zijn ${telTekst(weg.jaren)} jaren voorbij gegaan!</p>
      <div class="weg-lijst"></div>
      <button class="tt-klaar weg-verder">Verder kijken 🌍</button>
    </div>`;
  el.hidden = false;
  const vak = el.querySelector('.weg-lijst');
  lijst.forEach((e, i) => {
    const k = document.createElement('div');
    k.className = 'gebeurtenis belang' + e.belang;
    k.style.animationDelay = `${0.6 + i * 1.2}s`;
    k.innerHTML = `<span class="g-icoon">${e.icoon}</span><div class="g-tekst"><small>Jaar ${telTekst(e.jaar)}</small><span></span></div>${e.soort && plaatjes[e.soort] ? `<img src="${plaatjes[e.soort]}" alt="">` : ''}`;
    k.querySelector('.g-tekst span').textContent = e.tekst;
    vak.appendChild(k);
    setTimeout(() => geluid.pling(i), 600 + i * 1200);
  });
  stem.rij(['Terwijl je weg was, is er van alles gebeurd op je planeet!', ...voorlezen.map((e) => e.tekst), ...(meer ? ['Er gebeurde nog veel meer. Kijk maar in je verhaalboek!'] : [])]);
  el.querySelector('.weg-verder').onclick = () => {
    geluid.zwiep();
    stem.stil();
    el.hidden = true;
    el.innerHTML = '';
  };
}

$('#wensknop').addEventListener('click', () => {
  geluid.klik();
  if (gereedschap === 'wens') sluitPaneel();
  else toonPaneel('wens', true);
});

$('#verhaalknop').addEventListener('click', () => {
  geluid.klik();
  if (gereedschap === 'verhaal') sluitPaneel();
  else toonPaneel('verhaal', true);
});

// ================= Weer =================
// Het kind kiest het gemiddelde (hoe nat, hoe stormachtig). Het weer zelf wisselt: bewolkte en
// heldere tijden, en stormen die ontstaan, over de planeet trekken en weer uitdoven. Alleen in een
// storm flitst de bliksem. Het klimaat uit de levensmotor (droogte, natte tijd, ijstijd) telt mee.
let flitsKracht = 0;
const weer = { stormen: [], t: Math.random() * 1000 };

function weerStap(dt) {
  const k = leven.klimaat();
  const stormig = leven.stormKans(recept);
  weer.t += dt;
  // Langzame golven: een paar minuten bewolkt, dan weer helderder.
  const golf = 0.5 + 0.3 * Math.sin(weer.t / 97) + 0.2 * Math.sin(weer.t / 41 + 1.3);
  let dekking = recept.wolken * Math.pow(k.nat, 0.7) * (0.65 + 0.7 * golf);

  for (const s of weer.stormen) {
    s.leeftijd += dt;
    s.dir.applyAxisAngle(s.as, s.snel * dt).normalize();
    const t = s.leeftijd / s.duur;
    s.kracht = Math.min(1, t * 6, (1 - t) * 5); // aanzwellen, razen, uitdoven
    if (s.kracht > 0.45 && Math.random() < dt * 0.7 * s.kracht) flitsIn(s);
  }
  weer.stormen = weer.stormen.filter((s) => s.leeftijd < s.duur);
  if (weer.stormen.length < 4 && recept.wolken > 0 && Math.random() < dt * 0.01 * stormig * (0.4 + dekking)) maakStorm();
  dekking += weer.stormen.reduce((a, s) => a + s.kracht * 0.04, 0);
  planeet.zetWeer({ dekking, stormen: weer.stormen.map((s) => ({ dir: s.dir, straal: s.straal, kracht: s.kracht })) });

  // In een ijstijd groeien de ijskappen echt; als het warm wordt smelten ze.
  const z = zicht(recept);
  if (snel && snel.r && z.ijskappen !== snel.r.ijskappen && !stelBezig) vuil = true;
}

function maakStorm(dichtbij = false) {
  const dir = new THREE.Vector3().randomDirection();
  if (dichtbij) dir.lerp(camera.position.clone().normalize(), 0.75).normalize();
  // Stormen trekken ongeveer met de breedtegraden mee, zoals echt weer.
  const as = new THREE.Vector3(0, 1, 0).add(new THREE.Vector3().randomDirection().multiplyScalar(0.25)).normalize();
  weer.stormen.push({ dir, as, snel: (0.01 + Math.random() * 0.015) * (Math.random() < 0.5 ? 1 : -1), straal: 0.22 + Math.random() * 0.22, duur: 50 + Math.random() * 90, leeftijd: 0, kracht: 0 });
}

function flitsIn(s) {
  if (!planeet) return;
  const t = new THREE.Vector3().randomDirection();
  t.addScaledVector(s.dir, -t.dot(s.dir)).normalize();
  const plek = s.dir.clone().addScaledVector(t, Math.random() * Math.sin(s.straal) * 0.8).normalize();
  bliksem.position.copy(plek).multiplyScalar(1.06 * recept.grootte);
  flitsKracht = 1;
  // Donder: luider als de storm aan jouw kant van de planeet is.
  const dichtbij = plek.dot(camera.position.clone().normalize());
  if (dichtbij > 0.4 && Math.random() < 0.5) setTimeout(() => geluid.donder(Math.min(1, (dichtbij - 0.4) * 1.8)), 200 + Math.random() * 900);
}

// Wat er op de planeet te zien is: de keuzes van het kind plus het klimaat van nu.
function zicht(r) {
  const k = leven.klimaat();
  const ijs = Math.round(Math.max(0, Math.min(1, r.ijskappen + k.ijs - k.vervuiling * 0.3)) * 20) / 20;
  return ijs === r.ijskappen ? r : { ...r, ijskappen: ijs };
}

// ================= Feest =================
function feest() {
  recept.klaar = true;
  opslaan();
  sluitPaneel();
  clearTimeout(hdTimer);
  geluid.fanfare();
  const naam = recept.naam || `de planeet van ${naamVan(wie)}`;
  toonMelding(`🎉 ${naam} 🎉`, 4500, true);
  stem.zeg(`Hoera! ${naam} is klaar! Ik maak hem nu extra mooi.`);
  // Na het vuurwerk wordt de planeet omgetoverd tot de mooie versie.
  const mijn = sessie;
  setTimeout(() => {
    if (mijn !== sessie) return;
    if (hdKlopt()) {
      toonPlaneet(hd);
      return;
    }
    toonMelding('✨ Toveren... ✨');
    bouwHD(true);
  }, 4600);
  const kleuren = ['#ffd34d', '#ff5fb0', '#5ac8fa', '#9cff8a', '#ff6a3a', '#c9a8ff'];
  for (let i = 0; i < 9; i++) {
    setTimeout(() => {
      const plek = new THREE.Vector3().randomDirection().multiplyScalar(recept.grootte * (1.6 + Math.random() * 0.8));
      plek.lerp(camera.position.clone().normalize().multiplyScalar(1.8), 0.35);
      vuurwerk.knal(plek, kleuren[i % kleuren.length]);
      geluid.knal();
    }, 300 + i * 380);
  }
  // Even uitzoomen, zodat de hele planeet in beeld is.
  zoomDoel = beginAfstand() * recept.grootte;
}
let zoomDoel = 0;

// ================= Meldingen en vragen =================
let meldingTimer = null;
// Een melding wordt ook voorgelezen, tenzij er net al iets gezegd wordt (dan zegt die zin
// meestal hetzelfde, en anders zou de melding hem afbreken).
function toonMelding(tekst, duur = 0, groot = false) {
  if (!stem.bezig) stem.zeg(tekst);
  melding.textContent = tekst;
  melding.classList.toggle('groot', groot);
  melding.hidden = false;
  clearTimeout(meldingTimer);
  if (duur) meldingTimer = setTimeout(verbergMelding, duur);
}
function verbergMelding() {
  melding.hidden = true;
}
function vraag(tekst, ja) {
  const v = $('#vraag');
  v.querySelector('.vraag-tekst').textContent = tekst;
  v.hidden = false;
  stem.rij([tekst, 'Ja of nee?']);
  v.querySelector('.ja').onclick = () => {
    v.hidden = true;
    geluid.zwiep();
    ja();
  };
  v.querySelector('.nee').onclick = () => {
    v.hidden = true;
    geluid.klik();
  };
}

// Lang drukken op een knop zegt wat hij doet (titels zie je niet op een tablet). Dan gebeurt er
// verder niets, zodat je rustig kunt uitzoeken wat een knop doet.
{
  let timer = null, gezegd = null;
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.vasthouden) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const tekst = b.title || b.getAttribute('aria-label') || b.textContent;
      if (!tekst || !tekst.trim()) return;
      const was = stem.aan;
      stem.aan = true;
      stem.zeg(tekst);
      stem.aan = was;
      gezegd = b;
    }, 550);
  }, true);
  const stop = () => clearTimeout(timer);
  document.addEventListener('pointerup', stop, true);
  document.addEventListener('pointercancel', stop, true);
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && (Math.abs(e.movementX) > 6 || Math.abs(e.movementY) > 6)) stop();
  }, true);
  document.addEventListener('click', (e) => {
    if (gezegd && e.target.closest('button') === gezegd) {
      e.stopPropagation();
      e.preventDefault();
    }
    gezegd = null;
  }, true);
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('button')) e.preventDefault();
  });
}

// ================= Bovenbalk =================
$('#huis').addEventListener('click', () => {
  geluid.klik();
  const vorige = wie;
  if (planeet && !geboorte) {
    planeten[wie] = recept;
    schrijf(OPSLAG, planeten);
    maakFoto();
  }
  // Na het opslaan van de wereld (in toonStart) meteen naar de wolk.
  if (vorige) setTimeout(() => wolk.stuur(vorige), 50);
  if (geboorte) {
    scene.remove(geboorte.stof.punten);
    geboorte.stof.opruimen();
    geboorte = null;
    verbergMelding();
  }
  toonStart();
});
knopTerug.addEventListener('click', terug);
// Muziek aan of uit (wordt onthouden op dit apparaat).
// Geluid: één knop in de balk, met daarachter twee grote schakelaars (voorlezen en muziek).
// Zo zet een kind niet per ongeluk het voorlezen uit als hij de muziek bedoelt.
const geluidMenu = $('#geluidmenu');
const knopStem = $('#stemknop'), knopMuziek = $('#muziekknop');
const zetSchakelaars = () => {
  knopStem.classList.toggle('uit-gezet', !stem.aan);
  knopMuziek.classList.toggle('uit-gezet', !geluid.muziekAan);
};
zetSchakelaars();
$('#geluidknop').addEventListener('click', (e) => {
  e.stopPropagation();
  geluid.klik();
  geluidMenu.hidden = !geluidMenu.hidden;
});
document.addEventListener('pointerdown', (e) => {
  if (!geluidMenu.hidden && !e.target.closest('#geluidmenu, #geluidknop')) geluidMenu.hidden = true;
});
knopStem.addEventListener('click', () => {
  stem.aan = !stem.aan;
  zetSchakelaars();
  if (!stem.aan) {
    stem.stil();
    const was = stem.aan;
    stem.aan = true;
    stem.zeg('Voorlezen staat uit.');
    stem.aan = was;
  } else stem.zeg('Voorlezen staat aan.');
});
knopMuziek.addEventListener('click', () => {
  geluid.muziek(!geluid.muziekAan);
  zetSchakelaars();
  stem.zeg(geluid.muziekAan ? 'Muziek aan.' : 'Muziek uit.');
});

// ================= Camera =================
function cameraBijwerken() {
  if (!planeet) {
    controls.minDistance = 1;
    return 1;
  }
  const g = planeet.grondStraal(camera.position) * houder.scale.x;
  const afstand = camera.position.length();
  const hoogte = Math.max(0.0001, afstand - g);
  const R = recept.grootte;
  controls.minDistance = g + 0.02 * R;
  const rel = hoogte / R;
  controls.rotateSpeed = THREE.MathUtils.clamp(rel * 0.9, 0.04, 0.9);
  controls.zoomSpeed = THREE.MathUtils.clamp(rel * 1.6, 0.25, 1.2);
  controls.autoRotate = !penseel.modus && !gieten && !geboorte && !volg;
  controls.autoRotateSpeed = 0.35 * THREE.MathUtils.clamp(rel, 0.05, 1);
  camera.near = Math.max(0.0005, hoogte * 0.3);
  return rel;
}
// Op een smal of staand scherm verder weg beginnen, zodat de hele planeet erop past.
function beginAfstand() {
  const a = Number.isFinite(camera.aspect) && camera.aspect > 0 ? camera.aspect : 1;
  return 4.6 * Math.max(1, 1.15 / a);
}
function kantel(rel) {
  const k = 1 - THREE.MathUtils.smoothstep(rel, 0.03, 0.45);
  if (k > 0) camera.rotateX(k * 1.25);
}
function aanpassenAanScherm() {
  const b = window.innerWidth, h = window.innerHeight;
  // Onzichtbaar tabblad (hoogte 0): wachten op een echte maat, anders rekent de camera zich vast.
  if (!b || !h) return;
  renderer.setSize(b, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(b, h);
  // De gloed is zacht en wazig: op halve maat zie je geen verschil, maar het is veel lichter.
  const pr = renderer.getPixelRatio();
  bloei.setSize(Math.round((b * pr) / 2), Math.round((h * pr) / 2));
  camera.aspect = b / h;
  camera.updateProjectionMatrix();
  meetPaneel();
}
window.addEventListener('resize', aanpassenAanScherm);
aanpassenAanScherm();

// ================= Zuinig op zwakke tablets =================
// Haalt het spel geen ±28 beelden per seconde, dan stap voor stap iets uit: eerst de gloed,
// dan iets minder scherp, dan de begroeiing van dichtbij. Onthouden per apparaat.
const zuinig = {
  niveau: 0,
  som: 0,
  aantal: 0,
  sinds: 0,
  fps: 0,
  slecht: 0,
  goed: 0,
  zet(n) {
    this.niveau = Math.max(0, Math.min(3, n));
    renderer.setPixelRatio(this.niveau >= 2 ? 1 : Math.min(window.devicePixelRatio, 1.5));
    aanpassenAanScherm();
    try {
      localStorage.setItem('planeetmakers-zuinig', String(this.niveau));
    } catch {}
  },
  meet(dt) {
    if (!planeet || geboorte || dt <= 0) return;
    this.som += dt;
    this.aantal++;
    if (this.som < 4) return;
    this.fps = this.aantal / this.som;
    const fpsEl = document.querySelector('#tijdknoppen .tk-fps');
    if (fpsEl) fpsEl.textContent = Math.round(this.fps) + ' fps · stand ' + this.niveau;
    // Niet meten vlak na zware momenten (laden, mooie versie bouwen, inhalen).
    if (performance.now() - this.sinds > 8000) {
      if (this.fps < 28) (this.slecht++, (this.goed = 0));
      else if (this.fps > 55) (this.goed++, (this.slecht = 0));
      else this.slecht = this.goed = 0;
      // Pas na twee slechte metingen op rij een stapje zuiniger; na vier ruim goede weer terug.
      if (this.slecht >= 2 && this.niveau < 3) this.zet(this.niveau + 1), this.rust();
      else if (this.goed >= 4 && this.niveau > 0) this.zet(this.niveau - 1), this.rust();
    }
    this.som = 0;
    this.aantal = 0;
  },
  rust() {
    this.sinds = performance.now();
    this.som = this.aantal = this.slecht = this.goed = 0;
  },
};
try {
  zuinig.niveau = Math.min(3, Number(localStorage.getItem('planeetmakers-zuinig')) || 0);
} catch {}
if (zuinig.niveau >= 2) renderer.setPixelRatio(1);
zuinig.sinds = performance.now();

// ================= Hoofdlus =================
const klok = new THREE.Clock();
const zonPlek = new THREE.Vector3();
const zonRichting = new THREE.Vector3();
const asY = new THREE.Vector3(0, 1, 0);
renderer.setAnimationLoop((nu) => {
  const dt = Math.min(klok.getDelta(), 0.05);
  // Op het startscherm of als de app op de achtergrond staat: niets tekenen, batterij sparen.
  if (document.hidden || !startScherm.hidden) return;

  if (gieten && recept) {
    const oud = recept.zee;
    recept.zee = THREE.MathUtils.clamp(recept.zee + gieten * dt * 0.14, 0, 0.97);
    if (recept.zee !== oud) {
      if (gieten > 0 && oud === 0) recept.zee = 0.03;
      wijzig();
      bubbelTijd -= dt;
      if (bubbelTijd <= 0) {
        geluid.bubbel();
        bubbelTijd = 0.09;
      }
    }
  }
  if (vuil && snel && !stelBezig) {
    vuil = false;
    stelBezig = true;
    const mijn = sessie;
    snel.stel(zicht(recept)).then(() => {
      if (mijn !== sessie) return;
      stelBezig = false;
      leven.planeetVeranderd(snel, recept);
      // Is de mooie versie verouderd? Dan de snelle laten zien tot de nieuwe klaar is.
      if (planeet === hd && !hdKlopt()) toonPlaneet(snel);
      if (recept.klaar && !gereedschap) planHD();
      else planFoto();
    });
    opslaan();
  }

  if (zoomDoel) {
    const a = camera.position.length();
    camera.position.setLength(a + (zoomDoel - a) * Math.min(1, dt * 2));
    if (Math.abs(zoomDoel - a) < 0.01) zoomDoel = 0;
  }

  // Is de camera ooit ontspoord (geen getal meer), dan terug naar een veilige plek.
  if (!Number.isFinite(camera.position.x + camera.position.y + camera.position.z)) {
    stopVolg();
    camera.position.set(0, 0.6, 4.4).setLength(beginAfstand());
  }
  const rel = cameraBijwerken();
  if (!volg) controls.update();

  // Paneel onderin: planeet een stukje omhoog schuiven zodat hij zichtbaar blijft.
  const doelVerschuiving = paneelHoogte * 0.45;
  kijkVerschuiving += (doelVerschuiving - kijkVerschuiving) * Math.min(1, dt * 6);
  if (kijkVerschuiving > 0.5) {
    camera.setViewOffset(window.innerWidth, window.innerHeight, 0, kijkVerschuiving, window.innerWidth, window.innerHeight);
  } else camera.clearViewOffset();
  camera.updateProjectionMatrix();

  if (volg) volgCamera(dt);
  else kantel(rel);
  camera.updateMatrixWorld();

  if (wezensVuil && recept) {
    wezens.zet(recept.wezens || []);
    wezensVuil = false;
    const ids = (recept.wezens || []).map((w) => w.id).join(',');
    if (ids !== wezenIds && snel) {
      wezenIds = ids;
      leven.syncSoorten(recept).then(werkJaarBij);
    }
  }
  if (planeet && !geboorte) {
    wezens.update(dt, camera, houder);
    beschaving.update(dt);
  }

  zonPlek.copy(camera.position).normalize().multiplyScalar(10).applyAxisAngle(asY, -1.0);
  zonPlek.y += 3;
  zon.position.copy(zonPlek);

  if (planeet) {
    planeet.update(dt, zonRichting.copy(zonPlek).normalize());
    if (!geboorte) {
      weerStap(dt);
      planeet.detail(camera, zuinig.niveau < 3);
    }
  }
  flitsKracht = Math.max(0, flitsKracht - dt * 3.5);
  const flikker = flitsKracht > 0 ? flitsKracht * (0.6 + Math.random() * 0.4) : 0;
  bliksem.intensity = flikker * 12;
  if (planeet && planeet.wolken) {
    planeet.wolken.material.emissive.set('#dfe9ff');
    planeet.wolken.material.emissiveIntensity = flikker * 0.35;
  }

  if (geboorte) geboorte.stof.update(dt);
  groeiAnimatie(nu);
  vuurwerk.update(dt);
  // Gloed alleen als de tablet het aankan (zie zuinig hieronder).
  if (zuinig.niveau >= 1) renderer.render(scene, camera);
  else composer.render();
  zuinig.meet(dt);
});

window.__maker = { camera, controls, wezens, leven, beschaving, weer, maakStorm, get planeet() { return planeet; }, get recept() { return recept; }, get volg() { return volg; } }; // alleen voor testen
// Geopend via een koppel-link (?familie=...)? Dan hoort dit apparaat voortaan bij de familie.
if (wolk.koppelUitLink()) setTimeout(() => toonMelding('☁️ Gekoppeld! De planeten komen eraan...', 3500), 300);
$('#kiesknop').addEventListener('click', () => {
  geluid.klik();
  openKiezen({ makers: K.MAKERS, opBewaard: () => wolk.planStuur('wensen', 2000) });
});
$('#wolkknop').addEventListener('click', () => {
  geluid.klik();
  toonWolk();
});
// ================= Testomgeving (?sandbox=1) =================
// Voor papa: tijd vooruit spoelen en sneller laten lopen, om te zien hoe een wereld zich
// ontwikkelt. Alles staat in eigen laatjes en gaat nooit naar de wolk.
if (SANDBOX) {
  document.body.classList.add('zandbak');
  $('#start').insertAdjacentHTML('afterbegin', '<div class="zandbak-band">🧪 Testomgeving: niets hiervan komt op de echte planeten</div>');
  const el = document.createElement('div');
  el.id = 'tijdknoppen';
  el.className = "dicht";
  el.innerHTML = `<button class="tk-titel">🧪 Tijd</button><span class="tk-fps"></span>
    <button data-min="60">+1 uur</button><button data-min="1440">+1 dag</button><button data-min="10080">+1 week</button><button data-min="43200">+1 maand</button>
    <span class="tk-scheiding"></span>
    <button data-snel="1" class="aan">1x</button><button data-snel="60">60x</button><button data-snel="600">600x</button>`;
  makerScherm.appendChild(el);
  el.querySelector('.tk-titel').addEventListener('click', () => el.classList.toggle('dicht'));
  el.querySelectorAll('[data-min]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!leven.actief) return toonMelding('Er leeft nog niets op deze planeet. Teken eerst een wezen!', 2500);
      el.classList.add('bezig');
      toonMelding('⏩ Even doorrekenen...');
      const weg = await leven.spoel(Number(b.dataset.min));
      el.classList.remove('bezig');
      verbergMelding();
      if (!weg) return;
      werkJaarBij();
      if (weg.nieuws.length) toonWeg(weg);
      else toonMelding(`⏩ ${telTekst(weg.jaren)} jaar verder. Er gebeurde niets bijzonders.`, 3000);
    })
  );
  el.querySelectorAll('[data-snel]').forEach((b) =>
    b.addEventListener('click', () => {
      leven.snelheid = Number(b.dataset.snel);
      el.querySelectorAll('[data-snel]').forEach((x) => x.classList.toggle('aan', x === b));
      geluid.klik();
    })
  );
}

// Vraag de browser het geheugen van de planeten niet zomaar op te ruimen als de tablet vol raakt.
navigator.storage?.persist?.().catch(() => {});
toonStart();
