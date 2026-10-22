// De ontdekkingsboom van een soort, zoals de technologieboom in Civilization: van links (holen
// en nesten) naar rechts (raketten). Wat ontdekt is staat in kleur met het jaar en hoe het
// gebeurde; de volgende stap licht op met hoe ver ze zijn en wat ze nog nodig hebben; de rest is
// nog op slot. Tik op een ontdekking en je hoort wat het is en wat het mogelijk maakt.

import { stem } from './stem.js';
import { geluid } from './geluid.js';
import { beeldVan } from './wezens.js';
import { TECH, TECH_BY, SLIM_DREMPEL, meervoud, techNaam } from './leven/sim.js';
import { techIcoon } from './iconen.js';

// Wat een ontdekking voor de wezens betekent (in kindertaal).
const BETEKENT = {
  nesten: 'Een veilig plekje om te slapen. Er overleven meer jongen.',
  stokken: 'Met gereedschap vinden ze meer eten.',
  taal: 'Ze kunnen samen plannen maken en verhalen vertellen. Daardoor leren ze veel sneller.',
  vuur: 'Koken en warm blijven: meer eten, en ze kunnen in de kou wonen.',
  vissen: 'Eten uit de zee.',
  hutten: 'Een echt dorp, veilig in de winter.',
  landbouw: 'Het eten groeit vanzelf. Er kunnen veel meer wezens wonen.',
  boten: 'Over het water naar andere eilanden.',
  wiel: 'Sneller reizen en handelen, en bruggen bouwen.',
  metaal: 'Sterk gereedschap: zelfs dichte oerwouden worden bewoonbaar.',
  schrift: 'Alles opschrijven: steden, sneller leren, en ziektes worden minder erg.',
  kristal: 'Kracht uit kristallen: een eigen weg naar machines.',
  sterren: 'Nadenken over de ruimte, en over wie de wereld gemaakt heeft.',
  machines: 'Fabrieken en grote steden. Maar ook rook.',
  stroom: 'Licht in de steden, en nog sneller leren.',
  schoon: 'Energie uit zon en wind: de lucht wordt weer schoon.',
  raket: 'Naar de ruimte!',
};
// Wat de planeet moet bieden.
const EIS = {
  vuur: 'Ze moeten vuur zien: bliksem, lava of een vulkaan',
  kust: 'Ze moeten bij de kust of de zee wonen',
  vruchtbaar: 'Ze hebben vruchtbare grond met water nodig',
  boot: 'Ze moeten bij een kust met bomen wonen',
  metaal: 'Er moet metaal in de bergen zitten',
  magie: 'Er moeten glimmende kristallen zijn',
};

const telTekst = (n) => Math.floor(n).toLocaleString('nl-NL');
const veilig = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

function voorwaarden(t, s) {
  // Een volk bij de lava kent het vuur al voordat het praat (zie sim.js).
  return t.id === 'vuur' && s.thuisLand === 'lava' ? ['stokken'] : t.na;
}
function diepteVan() {
  const d = {};
  const reken = (id) => {
    if (d[id] !== undefined) return d[id];
    const t = TECH_BY[id];
    d[id] = t.na.length ? 1 + Math.max(...t.na.map((x) => (Array.isArray(x) ? Math.min(...x.map(reken)) : reken(x)))) : 0;
    return d[id];
  };
  TECH.forEach((t) => reken(t.id));
  return d;
}

// Standaard de korte weergave (wat ze kunnen en de volgende stap, ook voor een kind van 6);
// de hele boom zit achter een knop, voor Owen en papa.
export function openOntdekkingsboom({ wezen, leven, heel = false }) {
  const info = leven.info(wezen.id);
  if (!info) return;
  const s = info.soort;
  const w = leven.w;
  document.getElementById('ontdekkingsboom')?.remove();

  const heeft = (id) => s.tech.includes(id);
  const naOk = (t) => voorwaarden(t, s).every((x) => (Array.isArray(x) ? x.some(heeft) : heeft(x)));
  const status = (t) => (heeft(t.id) ? 'ontdekt' : s.vlaggen.slaapt === t.id ? 'slaapt' : naOk(t) && s.uitgestorven === null ? 'volgende' : 'slot');
  // Wanneer en hoe: uit het geheugen van de soort, of anders uit het verhaal.
  const hoeEnWanneer = (t) => {
    if (s.ontdekt && s.ontdekt[t.id]) return s.ontdekt[t.id];
    const ic = techNaam(t.id, s).icoon;
    const e = w.kroniek.find((x) => x.soort === s.id && x.icoon === ic);
    return e ? { jaar: e.jaar, hoe: e.tekst } : null;
  };

  // Indeling: kolommen naar diepte, van links naar rechts.
  const diepte = diepteVan();
  const kolommen = [];
  for (const t of TECH) (kolommen[diepte[t.id]] ||= []).push(t);
  const KB = 150, KH = 104, BB = 128, BH = 84, RAND = 20;
  const hoogsteKolom = Math.max(...kolommen.map((k) => k.length));
  const plek = {};
  kolommen.forEach((kol, x) => kol.forEach((t, y) => (plek[t.id] = { x: RAND + x * KB, y: RAND + (y + (hoogsteKolom - kol.length) / 2) * KH })));
  const breedte = RAND * 2 + (kolommen.length - 1) * KB + BB, hoogte = RAND * 2 + (hoogsteKolom - 1) * KH + BH;

  // Lijnen tussen ontdekkingen.
  let lijnen = '';
  for (const t of TECH) {
    for (const x of voorwaarden(t, s)) {
      const opties = Array.isArray(x) ? x : [x];
      for (const v of opties) {
        const a = plek[v], b = plek[t.id];
        const x1 = a.x + BB, y1 = a.y + BH / 2, x2 = b.x, y2 = b.y + BH / 2, m = (x1 + x2) / 2;
        const klasse = heeft(v) && heeft(t.id) ? 'klaar' : heeft(v) ? 'open' : 'dicht';
        lijnen += `<path class="${klasse}${opties.length > 1 ? ' of' : ''}" d="M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}"/>`;
        if (opties.length > 1 && v === opties[0]) lijnen += `<text x="${m}" y="${(y1 + y2) / 2 - 4}" class="of-tekst">of</text>`;
      }
    }
  }

  const knopen = TECH.map((t) => {
    const st = status(t);
    const tn = techNaam(t.id, s);
    const p = plek[t.id];
    let onder = '';
    if (st === 'ontdekt') {
      const h = hoeEnWanneer(t);
      onder = h ? `jaar ${telTekst(h.jaar)}` : 'ontdekt';
    } else if (st === 'volgende') {
      const voortgang = Math.min(1, s.kennis / t.kosten);
      onder = `<i class="balk"><i style="width:${Math.round(voortgang * 100)}%"></i></i>`;
    } else if (st === 'slaapt') onder = 'slaapt even 💤';
    return `<button class="knoop ${st}" data-id="${t.id}" style="left:${p.x}px;top:${p.y}px"><span class="ic">${techIcoon(t.id, s, tn.icoon, 'ico ob-ico')}</span><b>${veilig(tn.naam)}</b><small>${onder}</small></button>`;
  }).join('');

  const pad = s.beweging === 'zwemmen' ? ' (het pad van de zee)' : s.beweging === 'vliegen' ? ' (het pad van de lucht)' : '';
  // Korte weergave: wat ze al kunnen (kleine plaatjes) en waar ze nu mee bezig zijn (groot).
  const kunnen = TECH.filter((t) => heeft(t.id));
  const bezig = TECH.filter((t) => status(t) === 'volgende');
  const kort = `<div class="ob-kort">
      <h3>Dit kunnen ze al</h3>
      <div class="ob-kunnen">${kunnen.length ? kunnen.map((t) => `<button class="knoop klein" data-id="${t.id}" title="${veilig(techNaam(t.id, s).naam)}">${techIcoon(t.id, s, techNaam(t.id, s).icoon, 'ico ob-ico')}</button>`).join('') : '<span class="dim">Nog niets. Dat komt nog!</span>'}</div>
      ${bezig.length ? `<h3>Hier zijn ze nu mee bezig</h3><div class="ob-bezig">${bezig.map((t) => `<button class="knoop groot" data-id="${t.id}"><span class="ic">${techIcoon(t.id, s, techNaam(t.id, s).icoon, 'ico ob-ico')}</span><b>${veilig(techNaam(t.id, s).naam)}</b><i class="balk"><i style="width:${Math.round(Math.min(1, s.kennis / t.kosten) * 100)}%"></i></i></button>`).join('')}</div>` : ''}
      <button class="opnieuw ob-heel">🌳 De hele boom bekijken</button>
    </div>`;
  const el = document.createElement('section');
  el.id = 'ontdekkingsboom';
  el.innerHTML = `<div class="ob-doos">
    <div class="ob-kop"><img src="${veilig(beeldVan(wezen).open)}" alt=""><div><h2>Ontdekkingen van de ${veilig(meervoud(wezen.naam))}</h2><small>${s.tech.length} van de ${TECH.length} ontdekt${pad}. Tik op een ontdekking!</small></div><button class="rond ob-dicht" title="Dicht">✕</button></div>
    ${heel ? `<div class="ob-veld"><div class="ob-boom" style="width:${breedte}px;height:${hoogte}px"><svg width="${breedte}" height="${hoogte}">${lijnen}</svg>${knopen}</div></div>` : kort}
    <div class="ob-uitleg">Tik op een ontdekking om te horen wat het is.</div>
  </div>`;
  document.body.appendChild(el);

  const uitleg = el.querySelector('.ob-uitleg');
  const sluit = () => {
    stem.stil();
    el.remove();
  };
  el.querySelector('.ob-dicht').onclick = () => {
    geluid.klik();
    sluit();
  };
  el.addEventListener('click', (e) => {
    if (e.target === el) sluit();
  });
  el.querySelectorAll('.knoop').forEach((k) =>
    k.addEventListener('click', () => {
      const t = TECH_BY[k.dataset.id];
      const tn = techNaam(t.id, s);
      const st = status(t);
      const volgende = TECH.filter((x) => voorwaarden(x, s).some((v) => (Array.isArray(v) ? v.includes(t.id) : v === t.id))).map((x) => techNaam(x.id, s).naam.toLowerCase());
      const zinnen = [tn.naam + '.'];
      if (st === 'ontdekt') {
        const h = hoeEnWanneer(t);
        if (h) zinnen.push(`Ontdekt in jaar ${telTekst(h.jaar)}. ${h.hoe}`);
      } else if (st === 'slaapt') zinnen.push('Deze ontdekking slaapt even, door de donkere tijden. Als het weer beter gaat, komt ze terug.');
      else if (st === 'volgende') {
        const ver = Math.min(1, s.kennis / t.kosten);
        if (ver < 1) zinnen.push(`Hier zijn ze nu mee bezig. Ze zijn al ${Math.round(ver * 100)} procent op weg.`);
        else zinnen.push('Ze weten er al genoeg voor, maar ze missen nog iets.');
        if (t.id === 'taal' && s.genen.slim < SLIM_DREMPEL) zinnen.push('Hun hersenen zijn nog niet groot genoeg om te praten. Dat duurt nog een tijd.');
        if (t.eis && EIS[t.eis]) zinnen.push((ver < 1 ? 'Straks geldt: ' : '') + EIS[t.eis] + '.');
      } else {
        const nodig = voorwaarden(t, s).map((x) => (Array.isArray(x) ? x.map((y) => techNaam(y, s).naam.toLowerCase()).join(' of ') : techNaam(x, s).naam.toLowerCase()));
        zinnen.push(`Nog op slot. Eerst nodig: ${nodig.join(' en ')}.`);
      }
      zinnen.push(BETEKENT[t.id] || '');
      if (volgende.length) zinnen.push(`Daarna kunnen ze: ${volgende.join(', ')}.`);
      uitleg.textContent = zinnen.filter(Boolean).join(' ');
      el.querySelectorAll('.knoop.gekozen').forEach((x) => x.classList.remove('gekozen'));
      k.classList.add('gekozen');
      geluid.plop();
      const was = stem.aan;
      stem.aan = true;
      stem.rij(zinnen.filter(Boolean));
      stem.aan = was;
    })
  );
  el.querySelector('.ob-heel')?.addEventListener('click', () => {
    geluid.klik();
    stem.stil();
    openOntdekkingsboom({ wezen, leven, heel: true });
  });
  if (!heel) return;
  // Meteen naar de plek waar ze nu zijn (de eerste "volgende" ontdekking).
  const nu = el.querySelector('.knoop.volgende') || [...el.querySelectorAll('.knoop.ontdekt')].pop();
  if (nu) el.querySelector('.ob-veld').scrollLeft = Math.max(0, parseFloat(nu.style.left) - 120);
}
