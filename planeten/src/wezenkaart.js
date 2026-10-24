// De kaart van een wezen: tik op zijn plaatje en je ziet alles over hem. Een groot plaatje, wie
// hem tekende en wanneer, hoeveel er nu zijn, wat ze ontdekt hebben, in wie ze geloven en hun
// grootste momenten uit het verhaal. Alles kan worden voorgelezen.

import { stem } from './stem.js';
import { geluid } from './geluid.js';
import { beeldVan } from './wezens.js';
import { TECH, OMDAT, meervoud, techNaam, geloofNaam, godNaam } from './leven/sim.js';
import { MAKERS } from './keuzes.js';
import { openOntdekkingsboom } from './ontdekkingsboom.js';
import { techIcoon } from './iconen.js';

const telTekst = (n) => {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toLocaleString('nl-NL', { maximumFractionDigits: 1 }) + ' miljoen';
  return n.toLocaleString('nl-NL');
};
const veilig = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

// Wanneer getekend? Het nummer van een getekend wezen begint met het tijdstip (w + tijd in 36-tallen).
function getekendOp(id) {
  const t = parseInt(String(id).slice(1, 9), 36);
  if (!Number.isFinite(t) || t < 1.6e12 || t > Date.now() + 1e10) return null;
  return new Date(t);
}

export function toonWezenKaart({ wezen, leven, maker, opBezoek, opGeluid, opDna }) {
  document.getElementById('wezenkaart-groot')?.remove();
  const w = leven.w;
  const info = leven.info(wezen.id);
  const s = info && info.soort;
  const naam = wezen.naam;
  const m = meervoud(naam);
  const dood = s && s.uitgestorven !== null;
  const makerNaam = (MAKERS.find((x) => x.id === maker) || {}).naam || 'Papa';

  // Afkomst: getekend, of vanzelf ontstaan.
  let afkomst = '';
  if (s && s.afkomst) {
    const ouders = (s.afkomst.ouders || []).map((id) => w.soorten[id]?.naam).filter(Boolean).map(meervoud);
    afkomst = s.afkomst.soort === 'kruising' ? `Ontstaan uit de ${ouders.join(' en de ')}` : `Afgesplitst van de ${ouders[0] || 'anderen'}`;
  } else {
    const op = getekendOp(wezen.id);
    afkomst = wezen.gestuurdDoor ? `DNA gekregen van ${wezen.gestuurdDoor}` : `Getekend door ${makerNaam}${op ? ' op ' + op.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}`;
  }

  // Ontdekkingen, met naam.
  const ontdekt = s ? TECH.filter((t) => s.tech.includes(t.id)).map((t) => ({ ...techNaam(t.id, s), id: t.id })) : [];

  // Grootste momenten: de belangrijke berichten over deze soort uit het verhaal.
  const momenten = w ? w.kroniek.filter((e) => e.soort === wezen.id && e.belang >= 3).slice(-6) : [];

  // Bijzonderheden.
  const extra = [];
  if (s?.geloof) extra.push(`🙏 ${geloofNaam(s.geloof)}: ze denken dat de Grote ${godNaam(s.geloof)} hun wereld gemaakt heeft`);
  if (s?.vlaggen.getemdDoor && w.soorten[s.vlaggen.getemdDoor]) extra.push(`🐕 Huisdier van de ${meervoud(w.soorten[s.vlaggen.getemdDoor].naam)}`);
  if (s?.vlaggen.heuvels) extra.push('⛰️ Ze bouwen grote heuvels');
  if (s?.vlaggen.brug) extra.push('🌉 Ze hebben bruggen gebouwd');
  if (info?.rol === 'heerser') extra.push(`👑 De grootste bouwers ${info.rijk === 'zee' ? 'in de zee' : 'op het land'}`);
  const meters = !dood && leven.meters(wezen.id);

  const el = document.createElement('section');
  el.id = 'wezenkaart-groot';
  const plaatje = beeldVan(wezen).open;
  el.innerHTML = `<div class="wk-doos">
    <button class="rond wk-dicht" title="Dicht">✕</button>
    <div class="wk-kop">
      <img class="wk-plaatje ${dood ? 'dood' : ''}" src="${veilig(plaatje)}" alt="">
      <div class="wk-titel">
        <h2>${veilig(m)}</h2>
        <div class="wk-sub">${veilig(afkomst)}</div>
        ${s ? `<div class="wk-sub">Op de planeet sinds jaar ${telTekst(s.sinds || 0)}</div>` : ''}
      </div>
    </div>
    ${s ? `<div class="wk-cijfers">
      ${dood
        ? `<div class="wk-cijfer wijd"><b>🦴 Uitgestorven</b><span>in jaar ${telTekst(s.uitgestorven)}${s.oorzaak && OMDAT[s.oorzaak] ? ', omdat ' + OMDAT[s.oorzaak] : ''}</span></div>`
        : `<div class="wk-cijfer"><b>👪 ${telTekst(info.totaal)}</b><span>nu</span></div>
           <div class="wk-cijfer"><b>🏆 ${telTekst(s.piek || info.totaal)}</b><span>het meeste ooit</span></div>
           <div class="wk-cijfer"><b>${info.tijdperk.icoon}</b><span>${info.tijdperk.naam}</span></div>
           <div class="wk-cijfer"><b>🏕️ ${info.stammen}</b><span>${info.stammen === 1 ? 'stam' : 'stammen'}</span></div>`}
    </div>` : '<p class="weg-uitleg">Dit wezen woont nog niet op de planeet.</p>'}
    ${meters ? `<div class="wk-meters">${[['eten', '🍎'], ['water', '💧'], ['warmte', '🌡️']].map(([k, ic]) => `<button class="meter ${meters[k] > 0.66 ? 'goed' : meters[k] > 0.33 ? 'matig' : 'slecht'}" data-k="${k}"><span>${ic}</span><span>${meters[k] > 0.66 ? '😊' : meters[k] > 0.33 ? '😐' : '😟'}</span></button>`).join('')}</div>` : ''}
    ${extra.length ? `<div class="wk-extra">${extra.map((x) => `<span>${veilig(x)}</span>`).join('')}</div>` : ''}
    <h3>Ontdekt</h3>
    <div class="wk-ontdekt">${ontdekt.length ? ontdekt.map((t) => `<span><i>${techIcoon(t.id, s, t.icoon)}</i>${veilig(t.naam)}</span>`).join('') : '<span class="dim">Nog niets</span>'}</div>
    ${momenten.length ? `<h3>Grootste momenten</h3><div class="wk-momenten">${momenten.map((e) => `<button class="gebeurtenis belang3" data-tekst="${veilig(e.tekst)}"><span class="g-icoon">${veilig(e.icoon)}</span><div class="g-tekst"><small>Jaar ${telTekst(e.jaar)}</small><span>${veilig(e.tekst)}</span></div></button>`).join('')}</div>` : ''}
    <div class="wk-knoppen">
      ${!dood && s ? '<button class="tt-klaar wk-bezoek">👀 Bezoeken</button>' : ''}
      ${s ? '<button class="tt-klaar wk-boom">🌳 Ontdekkingsboom</button>' : ''}
      <button class="tt-klaar wk-luister">🔊 Luister</button>
      <button class="tt-klaar wk-lees">📖 Lees voor</button>
      ${opDna && !(s && s.afkomst) ? '<button class="tt-klaar wk-dna">🧬 DNA sturen</button>' : ''}
    </div>
  </div>`;
  document.body.appendChild(el);

  const sluit = () => {
    stem.stil();
    el.remove();
  };
  el.addEventListener('click', (e) => {
    if (e.target === el) sluit();
  });
  el.querySelector('.wk-dicht').onclick = () => {
    geluid.klik();
    sluit();
  };
  el.querySelector('.wk-bezoek')?.addEventListener('click', () => {
    sluit();
    opBezoek && opBezoek();
  });
  el.querySelector('.wk-luister').onclick = () => opGeluid && opGeluid();
  el.querySelector('.wk-dna')?.addEventListener('click', () => {
    sluit();
    opDna();
  });
  el.querySelector('.wk-boom')?.addEventListener('click', () => openOntdekkingsboom({ wezen, leven }));
  el.querySelector('.wk-ontdekt')?.addEventListener('click', () => openOntdekkingsboom({ wezen, leven }));
  el.querySelectorAll('.wk-momenten .gebeurtenis').forEach((b) => (b.onclick = () => stem.zeg(b.dataset.tekst)));
  el.querySelectorAll('.wk-meters .meter').forEach((b) => (b.onclick = () => stem.zeg(meters.zinnen[b.dataset.k])));

  // Voorlezen: een kort verhaaltje over dit wezen.
  const zinnen = [`Dit zijn de ${m}.`, afkomst + '.'];
  if (s && !dood) zinnen.push(`Er zijn er nu ${telTekst(info.totaal)}. Ze leven in de ${info.tijdperk.naam}.`);
  if (dood) zinnen.push(`Ze zijn uitgestorven${s.oorzaak && OMDAT[s.oorzaak] ? ', omdat ' + OMDAT[s.oorzaak] : ''}.`);
  if (ontdekt.length) zinnen.push(`Ze hebben ${ontdekt.length} dingen ontdekt. Het laatste was: ${ontdekt[ontdekt.length - 1].naam}.`);
  zinnen.push(...extra.map((x) => x.replace(/^\S+\s/, '') + '.'));
  el.querySelector('.wk-lees').onclick = () => {
    const was = stem.aan;
    stem.aan = true;
    stem.rij(zinnen);
    stem.aan = was;
  };
  geluid.plop();
  // Meteen één korte zin (voor wie nog niet leest); de rest met "Lees voor".
  stem.zeg(!s ? `Dit is ${wezen.naam}.` : dood ? `Dit waren de ${m}.` : `Dit zijn de ${m}! Er zijn er nu ${telTekst(info.totaal)}.`);
}
