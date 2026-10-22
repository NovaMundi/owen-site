// De tekentafel: een wezen tekenen, daarna kiezen hoe hij leeft. Geeft een wezen-object terug
// (of null als het kind stopt). De tekening wordt een sticker met wit randje en knipperogen.

import { geluid } from './geluid.js';
import { stem } from './stem.js';
import * as K from './keuzes.js';
import { lees, schrijf } from './opslag.js';
import { icoon } from './iconen.js';

const MAAT = 768; // tekenvel in pixels
const OOG = [24, 40, 62];
const DIK = [10, 24, 48];

export function openTekentafel({ heeftWater, bestaand = null }) {
  return new Promise((klaar) => {
    const el = document.getElementById('tekentafel');
    el.hidden = false;
    el.innerHTML = `
      <div class="tt-kop">
        <button class="rond tt-stop" title="Stoppen">✕</button>
        <div class="tt-titel">${bestaand ? 'Pas je wezen aan' : 'Teken je wezen'}</div>
        <button class="rond tt-lees" title="Voorlezen">🔈</button>
      </div>
      <div class="tt-midden">
        <div class="tt-vel">
          <canvas class="tt-teken" width="${MAAT}" height="${MAAT}"></canvas>
          <canvas class="tt-ogen" width="${MAAT}" height="${MAAT}"></canvas>
        </div>
      </div>
      <div class="tt-gereedschap">
        <div class="tt-rij">
          <button class="tt-knop aan" data-tool="kwast" title="Kwast">🖌️</button>
          <button class="tt-knop" data-tool="vul" title="Vullen">🪣</button>
          <button class="tt-knop" data-tool="oog" title="Ogen">👀</button>
          <button class="tt-knop" data-tool="gum" title="Gum">🧽</button>
          <span class="tt-scheiding"></span>
          <button class="tt-knop tt-maat" data-maat="0"><i style="width:10px;height:10px"></i></button>
          <button class="tt-knop tt-maat aan" data-maat="1"><i style="width:18px;height:18px"></i></button>
          <button class="tt-knop tt-maat" data-maat="2"><i style="width:28px;height:28px"></i></button>
          <span class="tt-scheiding"></span>
          <button class="tt-knop tt-oeps" title="Oeps">↩️</button>
          <button class="tt-knop tt-wis" title="Alles weg">🗑️</button>
        </div>
        <div class="tt-rij tt-kleuren"></div>
        <button class="tt-klaar">Klaar! ✨</button>
      </div>`;

    const teken = el.querySelector('.tt-teken');
    const ogen = el.querySelector('.tt-ogen');
    const tc = teken.getContext('2d', { willReadFrequently: true });
    const oc = ogen.getContext('2d');
    let tool = 'kwast', maat = 1, kleur = '#1c1c1e';
    const acties = [];
    let bezig = null;
    const uitleg = bestaand
      ? 'Kleur je wezen in met het emmertje, teken erbij of geef hem nieuwe ogen.'
      : 'Teken je wezen! Met de ogen-knop geef je hem ogen die knipperen. Het papier gaat niet mee, alleen jouw tekening.';
    stem.zeg(uitleg);

    // Bestaand wezen aanpassen: de tekening als ondergrond, de ogen weer los zodat ze blijven knipperen.
    // Nieuw wezen, en vorige keer halverwege gestopt? Dan ligt die tekening er nog.
    const concept = bestaand ? null : leesConcept();
    const onder = bestaand || concept;
    if (onder) {
      const img = new Image();
      img.onload = () => {
        const basis = onder.tekening ? volVel(img) : zonderRand(img);
        acties.unshift({ t: 'basis', canvas: basis });
        for (const o of onder.ogen || []) acties.push({ t: 'oog', x: o.x, y: o.y, r: o.r });
        tekenAlles();
      };
      img.src = onder.tekening || onder.plaatje;
      if (concept) setTimeout(() => stem.zeg('Je tekening van de vorige keer ligt er nog! Wil je opnieuw beginnen? Tik dan op de prullenbak.'), 2500);
    }
    // Stoppen gooit de tekening niet weg: hij wordt bewaard voor de volgende keer.
    const bewaarConcept = () => {
      if (bestaand) return;
      let start = 0;
      acties.forEach((a, i) => a.t === 'wis' && (start = i + 1));
      const rest = acties.slice(start);
      if (!rest.length) return zetConcept(null); // leeg gemaakt: niets te bewaren
      const ruw = teken.toDataURL('image/webp', 0.85);
      const ogenLijst = rest.filter((a) => a.t === 'oog' && !a.weg).map(({ x, y, r }) => ({ x: Math.round(x), y: Math.round(y), r }));
      zetConcept({ tekening: ruw.startsWith('data:image/webp') ? ruw : teken.toDataURL('image/png'), ogen: ogenLijst });
    };

    // Kleuren
    const kleurRij = el.querySelector('.tt-kleuren');
    for (const c of K.TEKENKLEUREN) {
      const b = document.createElement('button');
      b.className = 'kleurbol' + (c === kleur ? ' aan' : '');
      b.style.setProperty('--k', c);
      b.onclick = () => {
        kleur = c;
        kleurRij.querySelectorAll('.aan').forEach((x) => x.classList.remove('aan'));
        b.classList.add('aan');
        if (tool === 'gum' || tool === 'oog') kiesTool('kwast');
        geluid.plop();
      };
      kleurRij.appendChild(b);
    }
    const kiesTool = (t) => {
      tool = t;
      el.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('aan', b.dataset.tool === t));
    };
    el.querySelectorAll('[data-tool]').forEach((b) =>
      b.addEventListener('click', () => {
        kiesTool(b.dataset.tool);
        geluid.klik();
        if (b.dataset.tool === 'oog') stem.zeg('Tik waar de ogen moeten komen.');
        if (b.dataset.tool === 'vul') stem.zeg('Tik in een vlak om het te kleuren.');
      })
    );
    el.querySelectorAll('[data-maat]').forEach((b) =>
      b.addEventListener('click', () => {
        maat = +b.dataset.maat;
        el.querySelectorAll('[data-maat]').forEach((x) => x.classList.toggle('aan', x === b));
        geluid.klik();
      })
    );
    el.querySelector('.tt-oeps').onclick = () => {
      if (!acties.length) return;
      acties.pop();
      tekenAlles();
      geluid.zwiep();
    };
    el.querySelector('.tt-wis').onclick = () => {
      if (!acties.length) return;
      acties.push({ t: 'wis' });
      tekenAlles();
      geluid.poef();
    };
    el.querySelector('.tt-lees').onclick = () => stem.zeg(uitleg);
    el.querySelector('.tt-stop').onclick = () => {
      geluid.klik();
      bewaarConcept();
      if (!bestaand && acties.length) stem.zeg('Ik bewaar je tekening. De volgende keer kun je verder tekenen.');
      sluit(null);
    };

    // ---- Tekenen ----
    const punt = (e) => {
      const r = teken.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * MAAT, ((e.clientY - r.top) / r.height) * MAAT];
    };
    function lijnStuk(a, van, naar) {
      tc.save();
      tc.globalCompositeOperation = a.gum ? 'destination-out' : 'source-over';
      tc.strokeStyle = a.kleur;
      tc.fillStyle = a.kleur;
      tc.lineWidth = a.dikte;
      tc.lineCap = tc.lineJoin = 'round';
      tc.beginPath();
      tc.moveTo(van[0], van[1]);
      tc.lineTo(naar[0], naar[1]);
      tc.stroke();
      tc.restore();
    }
    function voerUit(a) {
      if (a.t === 'lijn') {
        const p = a.punten;
        lijnStuk(a, p[0], p[0]);
        for (let i = 1; i < p.length; i++) lijnStuk(a, p[i - 1], p[i]);
        if (a.gum) for (const o of acties) if (o.t === 'oog' && !o.weg && a.punten.some((q) => Math.hypot(q[0] - o.x, q[1] - o.y) < o.r)) o.weg = true;
      } else if (a.t === 'basis') tc.drawImage(a.canvas, 0, 0);
      else if (a.t === 'vul') vul(tc, Math.round(a.x), Math.round(a.y), a.kleur);
      else if (a.t === 'wis') {
        tc.clearRect(0, 0, MAAT, MAAT);
        oc.clearRect(0, 0, MAAT, MAAT);
      }
    }
    function tekenAlles() {
      tc.clearRect(0, 0, MAAT, MAAT);
      oc.clearRect(0, 0, MAAT, MAAT);
      for (const a of acties) delete a.weg;
      let start = 0;
      acties.forEach((a, i) => a.t === 'wis' && (start = i + 1));
      for (let i = start; i < acties.length; i++) if (acties[i].t !== 'oog') voerUit(acties[i]);
      tekenOgen(oc, acties.slice(start), false);
    }

    ogen.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        ogen.setPointerCapture(e.pointerId);
      } catch {}
      const p = punt(e);
      if (tool === 'vul') {
        const a = { t: 'vul', x: p[0], y: p[1], kleur };
        acties.push(a);
        voerUit(a);
        geluid.bubbel();
      } else if (tool === 'oog') {
        acties.push({ t: 'oog', x: p[0], y: p[1], r: OOG[maat] });
        tekenAlles();
        geluid.plop();
      } else {
        bezig = { t: 'lijn', kleur, dikte: DIK[maat] * (tool === 'gum' ? 1.6 : 1), gum: tool === 'gum', punten: [p] };
        lijnStuk(bezig, p, p);
      }
    });
    ogen.addEventListener('pointermove', (e) => {
      if (!bezig) return;
      const p = punt(e);
      const vorig = bezig.punten[bezig.punten.length - 1];
      if (Math.hypot(p[0] - vorig[0], p[1] - vorig[1]) < 2) return;
      bezig.punten.push(p);
      lijnStuk(bezig, vorig, p);
    });
    const loslaten = () => {
      if (!bezig) return;
      acties.push(bezig);
      if (bezig.gum) tekenAlles();
      bezig = null;
    };
    ogen.addEventListener('pointerup', loslaten);
    ogen.addEventListener('pointercancel', loslaten);

    el.querySelector('.tt-klaar').onclick = () => {
      let start = 0;
      acties.forEach((a, i) => a.t === 'wis' && (start = i + 1));
      const sticker = maakSticker(teken, acties.slice(start).filter((a) => a.t === 'oog' && !a.weg));
      if (!sticker) {
        stem.zeg('Teken eerst een wezen!');
        geluid.klik();
        return;
      }
      geluid.pling(3);
      // De ruwe tekening en de ogen bewaren, zodat je hem later nog kunt aanpassen.
      const ogenLijst = acties.slice(start).filter((a) => a.t === 'oog' && !a.weg).map(({ x, y, r }) => ({ x: Math.round(x), y: Math.round(y), r }));
      const ruw = teken.toDataURL('image/webp', 0.85);
      eigenschappen({ ...sticker, tekening: ruw.startsWith('data:image/webp') ? ruw : teken.toDataURL('image/png'), ogen: ogenLijst });
    };

    // ---- Stap 2: hoe leeft hij? ----
    // Bij aanpassen blijven beweging, grootte en aantal zoals de natuur ze heeft gemaakt.
    function eigenschappen(sticker) {
      const w = bestaand
        ? { ...bestaand, ...sticker }
        : {
            huid: null,
            echt: null,
            id: 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e4),
            naam: K.verzinNaam().split(' ')[0],
            ...sticker,
            beweging: 'lopen',
            maat: 'hond',
            aantal: 3,
            kijkt: 'rechts',
            geluid: null,
          };
      // Tekening veranderd? Dan klopt de echte versie niet meer; die kan opnieuw gemaakt worden.
      if (bestaand && bestaand.echt && sticker.tekening !== bestaand.tekening) {
        w.echt = null;
        w.weergave = 'tekening';
      }
      const verberg = bestaand ? ' hidden' : '';
      el.innerHTML = `
        <div class="tt-kop">
          <button class="rond tt-stop" title="Stoppen">✕</button>
          <div class="tt-titel">${bestaand ? 'Bijna klaar!' : 'Hoe leeft hij?'}</div>
          <button class="rond tt-lees" title="Voorlezen">🔈</button>
        </div>
        <div class="tt-eigen">
          <div class="tt-voorbeeld"><img class="tt-dier loop-${w.beweging}${w.kijkt === 'links' ? ' gespiegeld' : ''}" src="${w.plaatje}" alt=""></div>
          <div class="tt-keuzes">
            <div class="rij-titel"${verberg}>Hoe beweegt hij?</div>
            <div class="keuzes tt-beweging"${verberg}></div>
            <div class="rij-titel"${verberg}>Hoe groot is hij?</div>
            <div class="keuzes tt-groot"${verberg}></div>
            <div class="rij-titel"${verberg}>Hoeveel zijn er?</div>
            <div class="keuzes tt-aantal"${verberg}></div>
            <div class="rij-titel">Wat voor vacht of huid heeft hij?</div>
            <div class="keuzes tt-huid"></div>
            <div class="rij-titel">Welke kant kijkt hij op?</div>
            <div class="keuzes tt-kant">
              <button class="kaart${w.kijkt === 'links' ? ' aan' : ''}" data-kant="links"><span class="groot">⬅️</span></button>
              <button class="kaart${w.kijkt !== 'links' ? ' aan' : ''}" data-kant="rechts"><span class="groot">➡️</span></button>
            </div>
            <div class="rij-titel">Hoe heet hij? En hoe klinkt hij?</div>
            <div class="naamrij">
              <input class="naamveld" maxlength="18" value="${w.naam}">
              <button class="kleurbol plus tt-verzin" title="Verzin een naam">🎲</button>
              <button class="opneem klein tt-opneem" title="Geluid opnemen"><span class="opname-stip"></span></button>
              <button class="kleurbol plus tt-speel" title="Luister" hidden>▶️</button>
            </div>
          </div>
        </div>
        <button class="tt-klaar tt-zet">${bestaand ? 'Klaar met aanpassen ✨' : 'Zet hem op mijn planeet! 🌍'}</button>`;
      stem.zeg(bestaand ? 'Mooi! Wat voor vacht of huid heeft hij? En wil je hem nog een andere naam of een ander geluid geven?' : 'Wat een gaaf wezen! Hoe beweegt hij? Hoe groot is hij? Wat voor vacht heeft hij? En hoeveel zijn er?');
      if (w.geluid) el.querySelector('.tt-speel').hidden = false;
      const dier = el.querySelector('.tt-dier');
      const kaarten = (houder, lijst, actief, maak, kies) => {
        for (const item of lijst) {
          const b = document.createElement('button');
          b.className = 'kaart' + (actief(item) ? ' aan' : '');
          b.innerHTML = maak(item);
          b.onclick = () => {
            houder.querySelectorAll('.aan').forEach((x) => x.classList.remove('aan'));
            b.classList.add('aan');
            geluid.plop();
            kies(item);
          };
          houder.appendChild(b);
        }
      };
      kaarten(el.querySelector('.tt-beweging'), K.BEWEGINGEN, (b) => b.id === w.beweging, (b) => `<span class="groot">${icoon("beweeg-" + b.id, b.icoon)}</span><span>${b.label}</span>`, (b) => {
        w.beweging = b.id;
        dier.className = 'tt-dier loop-' + b.id + (w.kijkt === 'links' ? ' gespiegeld' : '');
        stem.zeg(b.id === 'zwemmen' && !heeftWater() ? 'Je planeet heeft nog geen water! Giet eerst wat water, anders gaat hij over het land.' : b.zeg);
      });
      kaarten(el.querySelector('.tt-groot'), K.MATEN, (m) => m.id === w.maat, (m) => `<span class="groot">${icoon("maat-" + m.id, m.icoon)}</span><span>${m.label}</span>`, (m) => {
        w.maat = m.id;
        dier.style.setProperty('--maat', { mier: 0.45, hond: 0.7, olifant: 0.9, reus: 1.05 }[m.id]);
      });
      kaarten(el.querySelector('.tt-huid'), K.HUIDEN, (h) => h.id === w.huid, (h) => `<span class="groot">${icoon("huid-" + h.id, h.icoon)}</span><span>${h.label}</span>`, (h) => {
        if (w.huid !== h.id && w.echt) w.echt = null; // andere huid: het echte plaatje klopt niet meer
        w.huid = h.id;
        stem.zeg(h.label);
      });
      kaarten(el.querySelector('.tt-aantal'), K.AANTALLEN, (a) => a === w.aantal, (a) => `<span class="groot getal">${a}</span>`, (a) => {
        w.aantal = a;
        if (a === 1) stem.zeg('Let op: alleen kan hij geen familie krijgen. Kies er meer als je wilt dat ze kindjes krijgen!');
      });
      dier.style.setProperty('--maat', 0.7);
      el.querySelectorAll('[data-kant]').forEach((b) =>
        b.addEventListener('click', () => {
          w.kijkt = b.dataset.kant;
          el.querySelectorAll('[data-kant]').forEach((x) => x.classList.toggle('aan', x === b));
          dier.classList.toggle('gespiegeld', w.kijkt === 'links');
          geluid.klik();
        })
      );
      const naamVeld = el.querySelector('.naamveld');
      naamVeld.oninput = () => (w.naam = naamVeld.value.trim());
      el.querySelector('.tt-verzin').onclick = () => {
        w.naam = K.verzinNaam().split(' ')[0];
        naamVeld.value = w.naam;
        geluid.pling(2);
        stem.zeg(w.naam);
      };
      const speel = el.querySelector('.tt-speel');
      speel.onclick = () => new Audio(w.geluid).play();
      const opneem = el.querySelector('.tt-opneem');
      opneem.onclick = async () => {
        if (opneem.classList.contains('neemt-op')) return;
        stem.stil();
        opneem.classList.add('neemt-op');
        const url = await neemOp(3);
        opneem.classList.remove('neemt-op');
        if (url) {
          w.geluid = url;
          speel.hidden = false;
          new Audio(url).play();
        } else stem.zeg('De microfoon doet het niet. Dan maakt hij een grappig geluidje.');
      };
      el.querySelector('.tt-lees').onclick = () => stem.zeg('Hoe beweegt hij? Hoe groot is hij? Hoeveel zijn er? En hoe heet hij?');
      el.querySelector('.tt-stop').onclick = () => {
        geluid.klik();
        if (!bestaand) {
          zetConcept({ tekening: sticker.tekening, ogen: sticker.ogen });
          stem.zeg('Ik bewaar je tekening. De volgende keer kun je verder.');
        }
        sluit(null);
      };
      el.querySelector('.tt-zet').onclick = () => {
        if (!w.naam) w.naam = 'Wezen';
        if (!bestaand) zetConcept(null);
        sluit(w);
      };
    }

    function sluit(w) {
      el.hidden = true;
      el.innerHTML = '';
      klaar(w);
    }
  });
}

// ---- Halve tekening bewaren (één, op dit apparaat) ----
const CONCEPT = 'planeetmakers-concept-v1';
const leesConcept = () => lees(CONCEPT, null);
const zetConcept = (c) => schrijf(CONCEPT, c);

// ---- Ondergrond voor het aanpassen van een wezen ----
// Een eerder bewaarde ruwe tekening past precies op het vel.
function volVel(img) {
  const c = document.createElement('canvas');
  c.width = c.height = MAAT;
  c.getContext('2d').drawImage(img, 0, 0, MAAT, MAAT);
  return c;
}

// Oudere wezens hebben alleen de sticker: midden op het vel zetten en het witte randje weghalen.
function zonderRand(img) {
  const c = document.createElement('canvas');
  c.width = c.height = MAAT;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const schaal = Math.min(600 / img.width, 600 / img.height);
  const bw = img.width * schaal, bh = img.height * schaal;
  ctx.drawImage(img, (MAAT - bw) / 2, (MAAT - bh) / 2, bw, bh);
  const beeld = ctx.getImageData(0, 0, MAAT, MAAT);
  const d = beeld.data;
  // Laag voor laag de witte pixels aan de buitenkant wegpellen.
  const lagen = Math.ceil(7 * schaal) + 2;
  for (let l = 0; l < lagen; l++) {
    const weg = [];
    for (let y = 1; y < MAAT - 1; y++) {
      for (let x = 1; x < MAAT - 1; x++) {
        const o = (y * MAAT + x) * 4;
        if (d[o + 3] < 20 || d[o] < 225 || d[o + 1] < 225 || d[o + 2] < 225) continue;
        const buur = [o - 4, o + 4, o - MAAT * 4, o + MAAT * 4];
        if (buur.some((b) => d[b + 3] < 20)) weg.push(o);
      }
    }
    if (!weg.length) break;
    for (const o of weg) d[o + 3] = 0;
  }
  ctx.putImageData(beeld, 0, 0);
  return c;
}

// ---- Ogen ----
function tekenOgen(ctx, acties, dicht, onder = null) {
  for (const o of acties) {
    if (o.t !== 'oog' || o.weg) continue;
    const { x, y, r } = o;
    ctx.save();
    if (!dicht) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1c1c1e';
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1c1c1e';
      ctx.beginPath();
      ctx.arc(x + r * 0.25, y + r * 0.05, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + r * 0.42, y - r * 0.15, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Dicht: ooglid in de kleur eronder, met een donker streepje.
      ctx.fillStyle = onder ? onder(x, y) : '#f5c6a5';
      ctx.beginPath();
      ctx.arc(x, y, r * 1.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1c1c1e';
      ctx.lineWidth = r * 0.18;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, y - r * 0.2, r * 0.75, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ---- Sticker maken: bijsnijden, wit randje, open en dichte ogen ----
function maakSticker(teken, ogen) {
  const tc = teken.getContext('2d', { willReadFrequently: true });
  const data = tc.getImageData(0, 0, MAAT, MAAT).data;
  const onder = (x, y) => {
    const o = (Math.round(Math.min(MAAT - 1, Math.max(0, y))) * MAAT + Math.round(Math.min(MAAT - 1, Math.max(0, x)))) * 4;
    return data[o + 3] < 60 ? '#f5c6a5' : `rgb(${data[o]},${data[o + 1]},${data[o + 2]})`;
  };
  const versie = (dicht) => {
    const c = document.createElement('canvas');
    c.width = c.height = MAAT;
    const ctx = c.getContext('2d');
    ctx.drawImage(teken, 0, 0);
    tekenOgen(ctx, ogen, dicht, onder);
    return c;
  };
  const open = versie(false), dicht = versie(true);
  const od = open.getContext('2d').getImageData(0, 0, MAAT, MAAT).data;
  let x0 = MAAT, y0 = MAAT, x1 = -1, y1 = -1;
  for (let y = 0; y < MAAT; y++)
    for (let x = 0; x < MAAT; x++)
      if (od[(y * MAAT + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0 || (x1 - x0) * (y1 - y0) < 80) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const schaal = Math.min(1, 236 / Math.max(bw, bh));
  const rand = 7;
  const W = Math.round(bw * schaal) + rand * 2, H = Math.round(bh * schaal) + rand * 2;

  const plak = (bron) => {
    const uit = document.createElement('canvas');
    uit.width = W;
    uit.height = H;
    const ctx = uit.getContext('2d');
    // Wit silhouet, een paar pixels dikker, voor het stickerrandje.
    const sil = document.createElement('canvas');
    sil.width = W;
    sil.height = H;
    const sc = sil.getContext('2d');
    sc.drawImage(bron, x0, y0, bw, bh, rand, rand, bw * schaal, bh * schaal);
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = '#ffffff';
    sc.fillRect(0, 0, W, H);
    for (let i = 0; i < 16; i++) {
      const h = (i / 16) * Math.PI * 2;
      ctx.drawImage(sil, Math.cos(h) * (rand - 2), Math.sin(h) * (rand - 2));
    }
    ctx.drawImage(bron, x0, y0, bw, bh, rand, rand, bw * schaal, bh * schaal);
    const webp = uit.toDataURL('image/webp', 0.9);
    return webp.startsWith('data:image/webp') ? webp : uit.toDataURL('image/png');
  };
  return { plaatje: plak(open), dicht: plak(dicht), verhouding: W / H };
}

// ---- Emmertje: vlak vullen ----
function vul(ctx, sx, sy, hex) {
  if (sx < 0 || sy < 0 || sx >= MAAT || sy >= MAAT) return;
  const beeld = ctx.getImageData(0, 0, MAAT, MAAT);
  const d = beeld.data;
  const s = (sy * MAAT + sx) * 4;
  const [tr, tg, tb, ta] = [d[s], d[s + 1], d[s + 2], d[s + 3]];
  const n = parseInt(hex.slice(1), 16);
  const [fr, fg, fb] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const leegDoel = ta < 100;
  const lijkt = (o) => {
    if (leegDoel) return d[o + 3] < 100;
    return d[o + 3] >= 100 && Math.abs(d[o] - tr) + Math.abs(d[o + 1] - tg) + Math.abs(d[o + 2] - tb) < 90;
  };
  if (!leegDoel && Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 6) return;
  const gezien = new Uint8Array(MAAT * MAAT);
  const stapel = [sx, sy];
  while (stapel.length) {
    const y = stapel.pop(), x0 = stapel.pop();
    let x = x0;
    while (x >= 0 && !gezien[y * MAAT + x] && lijkt((y * MAAT + x) * 4)) x--;
    x++;
    let boven = false, onder = false;
    while (x < MAAT && !gezien[y * MAAT + x] && lijkt((y * MAAT + x) * 4)) {
      const i = y * MAAT + x;
      gezien[i] = 1;
      d[i * 4] = fr;
      d[i * 4 + 1] = fg;
      d[i * 4 + 2] = fb;
      d[i * 4 + 3] = 255;
      if (y > 0) {
        const ok = !gezien[i - MAAT] && lijkt((i - MAAT) * 4);
        if (ok && !boven) stapel.push(x, y - 1);
        boven = ok;
      }
      if (y < MAAT - 1) {
        const ok = !gezien[i + MAAT] && lijkt((i + MAAT) * 4);
        if (ok && !onder) stapel.push(x, y + 1);
        onder = ok;
      }
      x++;
    }
  }
  ctx.putImageData(beeld, 0, 0);
}

// ---- Geluid opnemen (een paar seconden) ----
export async function neemOp(seconden) {
  try {
    const stroom = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stroom, { audioBitsPerSecond: 32000 });
    const stukjes = [];
    rec.ondataavailable = (e) => stukjes.push(e.data);
    const klaar = new Promise((r) => (rec.onstop = r));
    rec.start();
    setTimeout(() => rec.state === 'recording' && rec.stop(), seconden * 1000);
    await klaar;
    stroom.getTracks().forEach((t) => t.stop());
    const blob = new Blob(stukjes, { type: rec.mimeType });
    return await new Promise((r) => {
      const lezer = new FileReader();
      lezer.onload = () => r(lezer.result);
      lezer.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
