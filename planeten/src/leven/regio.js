// Leest de planeet uit: wat heeft elk gebied te bieden? Hier worden de keuzes van het kind
// (kleuren, water, bomen, bergen, onweer...) vertaald naar eten, water, warmte en grondstoffen.

import * as THREE from 'three';

const AANTAL = 240;

function hsl(c) {
  const o = {};
  c.getHSL(o, THREE.SRGBColorSpace);
  return o;
}

// Wat voor water is het? Drinkbaar, eetbaar, gevaarlijk of magisch.
function waterSoort(recept) {
  const c = hsl(new THREE.Color(recept.waterKleur));
  if (recept.zeeGloeit) {
    if (c.h < 0.12 || c.h > 0.95) return { naam: 'lava', drink: 0, eten: 0, leef: 0, vuur: 1, magie: 0, metaal: 0.2 };
    return { naam: 'gloed', drink: 0.4, eten: 0.3, leef: 0.4, vuur: 0.3, magie: 0.6, metaal: 0 };
  }
  if (c.l > 0.85) return { naam: 'melk', drink: 1, eten: 0.9, leef: 0.8, vuur: 0, magie: 0, metaal: 0 };
  if (c.s > 0.3 && c.h > 0.04 && c.h < 0.11 && c.l < 0.35) return { naam: 'chocola', drink: 0.7, eten: 1, leef: 0.8, vuur: 0, magie: 0.1, metaal: 0 };
  if (c.h > 0.11 && c.h < 0.17) return { naam: 'goud', drink: 0.6, eten: 0.5, leef: 0.7, vuur: 0, magie: 0.2, metaal: 0.5 };
  if (c.h > 0.2 && c.h < 0.4 && c.s > 0.5) return { naam: 'slijm', drink: 0.35, eten: 0.4, leef: 0.6, vuur: 0, magie: 0.2, metaal: 0 };
  if (c.h > 0.75 && c.h < 0.98) return { naam: 'limonade', drink: 0.8, eten: 0.6, leef: 0.7, vuur: 0, magie: 0.4, metaal: 0 };
  if (c.h > 0.68 && c.h <= 0.75) return { naam: 'paars', drink: 0.7, eten: 0.6, leef: 0.8, vuur: 0, magie: 0.5, metaal: 0 };
  return { naam: 'water', drink: 1, eten: 0.7, leef: 1, vuur: 0, magie: 0, metaal: 0 };
}

// Wat zegt de kleur van de grond? Groen groeit, wit is koud, donker en rood is vulkanisch.
function grondUitKleur(c) {
  const { h, s, l } = hsl(c);
  if (l > 0.82 && s < 0.35) return { soort: 'ijs', vrucht: 0.02, warm: -0.4, steen: 0.1, vuur: 0, metaal: 0, magie: 0 };
  if (l < 0.13 || (s > 0.45 && (h < 0.04 || h > 0.97) && l < 0.55)) return { soort: 'lava', vrucht: 0.08, warm: 0.3, steen: 0.6, vuur: 0.6, metaal: 0.45, magie: 0 };
  if (s < 0.18) return { soort: 'berg', vrucht: 0.12, warm: 0, steen: 0.8, vuur: 0, metaal: 0.2, magie: 0 };
  if (h >= 0.17 && h < 0.47) return { soort: 'vlakte', vrucht: 0.45 + s * 0.55, warm: 0, steen: 0.1, vuur: 0, metaal: 0, magie: 0 };
  if (h >= 0.04 && h < 0.17) return l > 0.45 ? { soort: 'woestijn', vrucht: 0.12, warm: 0.2, steen: 0.3, vuur: 0.05, metaal: 0.1, magie: 0 } : { soort: 'vlakte', vrucht: 0.35, warm: 0.05, steen: 0.3, vuur: 0, metaal: 0.15, magie: 0 };
  if (h >= 0.47 && h < 0.7) return { soort: 'ijs', vrucht: 0.15, warm: -0.15, steen: 0.3, vuur: 0, metaal: 0, magie: 0.3 };
  if (h >= 0.7 && h < 0.97) return { soort: 'magie', vrucht: 0.4, warm: 0.05, steen: 0.2, vuur: 0, metaal: 0, magie: 0.8 };
  return { soort: 'lava', vrucht: 0.15, warm: 0.2, steen: 0.5, vuur: 0.3, metaal: 0.3, magie: 0 };
}

const BOOM = {
  den: { eten: 0.8, hout: 1, magie: 0 },
  bol: { eten: 1, hout: 0.9, magie: 0 },
  palm: { eten: 1.1, hout: 0.6, magie: 0 },
  paddenstoel: { eten: 1.2, hout: 0.3, magie: 0.2 },
  kristal: { eten: 0.2, hout: 0, magie: 0.9 },
};

// Welk stuk land hoort bij welk eiland of werelddeel? Land dat aan elkaar vastzit krijgt
// hetzelfde nummer. Over zee kom je alleen met een boot, vleugels, zwemmen, of heel soms per
// ongeluk op een drijvende boomstam.
export function labelEilanden(regios) {
  for (const r of regios) r.eiland = r.land ? -1 : null;
  let nr = 0;
  for (const start of regios) {
    if (!start.land || start.eiland >= 0) continue;
    const rij = [start];
    start.eiland = nr;
    while (rij.length) {
      const a = rij.pop();
      for (const b of a.buren) {
        const n = regios[b];
        if (n.land && n.eiland < 0) {
          n.eiland = nr;
          rij.push(n);
        }
      }
    }
    nr++;
  }
}

export function maakRegios(planeet) {
  const r = planeet.r;
  // Middelpunten gelijkmatig over de bol (Fibonacci-spiraal).
  const mid = [];
  for (let i = 0; i < AANTAL; i++) {
    const y = 1 - (i / (AANTAL - 1)) * 2, rr = Math.sqrt(1 - y * y), th = i * 2.399963229728653;
    mid.push(new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr));
  }
  // Elk punt van de planeet hoort bij het dichtstbijzijnde middelpunt.
  const n = planeet.n, d = planeet.dirs, col = planeet.geo.attributes.color.array;
  const zeeR = planeet.zeeR, minR = planeet.radGesorteerd[0], basis = zeeR || minR;
  const som = Array.from({ length: AANTAL }, () => ({ tel: 0, land: 0, t: 0, kr: 0, kg: 0, kb: 0, warm: 0, ijs: 0, toendra: 0, woestijn: 0, oerwoud: 0 }));
  for (let i = 0; i < n; i++) {
    const x = d[i * 3], y = d[i * 3 + 1], z = d[i * 3 + 2];
    let beste = 0, bd = -2;
    for (let k = 0; k < AANTAL; k++) {
      const m = mid[k];
      const dot = x * m.x + y * m.y + z * m.z;
      if (dot > bd) {
        bd = dot;
        beste = k;
      }
    }
    const s = som[beste];
    s.tel++;
    const rad = planeet.rad[i];
    if (zeeR === 0 || rad > zeeR) {
      s.land++;
      s.t += (rad - basis) / Math.max(1e-4, planeet.maxR - basis);
      s.kr += col[i * 3];
      s.kg += col[i * 3 + 1];
      s.kb += col[i * 3 + 2];
      s.warm += planeet.warmte ? planeet.warmte[i] : 0.5;
      const b = planeet.bioom ? planeet.bioom[i] : 0;
      if (b === 1) s.ijs++;
      else if (b === 2) s.toendra++;
      else if (b === 3) s.woestijn++;
      else if (b === 4) s.oerwoud++;
    }
  }

  const ws = waterSoort(r);
  // Bij een mix van bomen tellen de eigenschappen van alle soorten mee.
  const vormen = r.boomVormen && r.boomVormen.length ? r.boomVormen : [r.boomVorm];
  const boom = { eten: 0, hout: 0, magie: 0 };
  for (const v of vormen) for (const k of Object.keys(boom)) boom[k] += (BOOM[v] || BOOM.den)[k] / vormen.length;
  const lucht = hsl(new THREE.Color(r.lucht));
  const luchtWarm = lucht.s > 0.3 && (lucht.h < 0.12 || lucht.h > 0.95) ? 0.08 : lucht.l > 0.85 ? -0.05 : 0;
  const regen = r.wolken * 0.75 + (r.onweer ? 0.1 : 0); // gemiddelde regen; het klimaat varieert daaromheen

  const regios = mid.map((m, id) => {
    const s = som[id];
    const landFrac = s.tel ? s.land / s.tel : 0;
    const land = landFrac > 0.5;
    const t = s.land ? s.t / s.land : 0;
    const kleur = s.land ? new THREE.Color(s.kr / s.land, s.kg / s.land, s.kb / s.land) : new THREE.Color(r.waterKleur);
    const g = grondUitKleur(kleur);
    const lat = Math.abs(m.y);
    // Warmte komt van de planeet zelf (temperatuur, breedtegraad, hoogte), kleur geeft een beetje extra.
    let temp = s.land ? s.warm / s.land + g.warm * 0.3 + luchtWarm : 0.66 - Math.pow(lat, 1.6) * 0.5 + (r.temperatuur - 0.5) * 0.9;
    if (r.zeeGloeit && ws.naam === 'lava') temp += 0.1;
    // Klimaatzone van dit gebied.
    const deel = (x) => (s.land ? x / s.land : 0);
    const zone = deel(s.woestijn) > 0.4 ? 'woestijn' : deel(s.oerwoud) > 0.4 ? 'oerwoud' : deel(s.ijs) > 0.5 ? 'ijs' : deel(s.toendra) > 0.4 ? 'toendra' : null;
    if (zone === 'woestijn') {
      g.vrucht *= 0.25;
      g.soort = 'woestijn';
    }
    if (zone === 'oerwoud') g.vrucht = Math.min(1.1, g.vrucht + 0.3);
    if (zone === 'ijs') g.soort = 'ijs';
    if (zone === 'toendra') g.vrucht *= 0.5;
    // Kraters brengen metaal (meteorieten!).
    let krater = 0;
    for (const k of planeet.kraterLijst || []) if (m.dot(k.v) > Math.cos(k.straal * 1.5 + 0.1)) krater = Math.max(krater, k.diepte);
    const bosKan = land && t < 0.62 && zone !== 'ijs' && zone !== 'woestijn' && g.soort !== 'ijs' ? (zone === 'oerwoud' ? 1.5 : zone === 'toendra' ? 0.5 : 1) : 0;
    const bos = r.bomen * bosKan;
    return {
      id,
      dir: [m.x, m.y, m.z],
      land,
      landFrac,
      hoogte: t,
      temp: Math.max(0, Math.min(1, temp)),
      grond: g.soort,
      vruchtbaar: land ? g.vrucht : 0,
      plant: land ? Math.min(1.3, g.vrucht * (0.4 + 0.7 * bos * boom.eten) + 0.05) : 0,
      hout: land ? bos * boom.hout : 0,
      steen: land ? Math.min(1, g.steen + t * r.bergen) : 0,
      metaal: land ? Math.min(1, g.metaal + krater * 0.7 + (t > 0.55 ? r.bergen * 0.35 : 0)) : 0,
      vuur: 0,
      vuurBron: 'stenen',
      magie: Math.min(1, (land ? g.magie : 0) + bos * boom.magie),
      zeevoedsel: !land || landFrac < 0.95 ? ws.eten * (1 + Math.min(3, r.manen.length) * 0.08) : 0,
      zeeLeefbaar: ws.leef,
      water: 0,
      kust: false,
      buren: [],
      soort: 'vlakte',
      zone,
      _bos: bos,
      _drink: ws.drink,
      _g: g,
    };
  });

  // Buren: de zes dichtstbijzijnde gebieden.
  for (const a of regios) {
    const lijst = [];
    for (const b of regios) if (b !== a) lijst.push([b.id, a.dir[0] * b.dir[0] + a.dir[1] * b.dir[1] + a.dir[2] * b.dir[2]]);
    lijst.sort((p, q) => q[1] - p[1]);
    a.buren = lijst.slice(0, 6).map((p) => p[0]);
  }
  for (const a of regios) {
    a.kust = a.land && (a.landFrac < 0.9 || a.buren.some((b) => !regios[b].land));
    const ijsBij = a.buren.some((b) => regios[b].grond === 'ijs') || a.grond === 'ijs';
    if (a.land) a.water = Math.min(1, Math.max(a.kust ? a._drink : 0, regen * 0.8, ijsBij ? 0.3 : 0, a.hoogte > 0.5 ? 0.25 : 0.05));
    else a.water = 1;
    if (a.zone === 'woestijn' && !a.kust) a.water *= 0.35;
    if (a.zone === 'oerwoud') a.water = Math.min(1, a.water + 0.3);
    // Vuur dat er altijd is: lava aan de kust of een vulkaan. Bliksem in een bos kan alleen als er
    // echt een storm is; dat rekent de levensmotor uit met het klimaat van dat moment.
    const lava = a.kust ? ws.vuur : 0, vulkaan = a._g.vuur;
    a.vuur = Math.min(1, Math.max(lava, vulkaan));
    a.vuurBron = lava >= vulkaan ? 'lava' : 'vulkaan';
    a.bliksem = a._bos * 0.6;
    a.magie = Math.min(1, a.magie + (a.kust ? ws.magie : 0));
    if (a.kust) a.metaal = Math.min(1, a.metaal + ws.metaal);
    // Dicht, warm en vol eten: een oerwoud. Paradijs voor wilde dieren, lastig voor de heerser.
    a.oerwoud = a.land && (a.zone === 'oerwoud' || (a.hout > 0.45 && a.plant > 0.7 && a.temp > 0.5));
    a.soort = !a.land ? 'zee' : a.grond === 'lava' ? 'lava' : a.grond === 'ijs' || a.temp < 0.2 ? 'ijs' : a.hoogte > 0.6 ? 'berg' : a.grond === 'magie' ? 'magie' : a.grond === 'woestijn' ? 'woestijn' : a.hout > 0.35 ? 'bos' : a.kust ? 'kust' : 'vlakte';
    delete a._bos;
    delete a._drink;
    delete a._g;
  }
  labelEilanden(regios);
  return {
    regios,
    planeet: { manen: r.manen.length, grootte: r.grootte, water: ws.naam, wolken: r.wolken, onweer: !!r.onweer, ijskappen: r.ijskappen, seizoenen: r.seizoenen ?? 0.3, temperatuur: r.temperatuur ?? 0.5 },
  };
}
