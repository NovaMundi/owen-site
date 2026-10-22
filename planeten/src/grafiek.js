// De geschiedenis van de planeet in één plaatje: per soort een lijn met hoeveel het er waren,
// van het begin tot nu (zoals de demografie in Civilization). Grote momenten staan als stip op de
// tijdlijn eronder; tik erop en je hoort wat er gebeurde.

const B = 320, H = 160, L = 34, R = 8, T = 10, O = 30; // maat en randen (links ruimte voor getallen)

const veilig = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const telKort = (n) => (n >= 1e6 ? Math.round(n / 1e5) / 10 + 'm' : n >= 1000 ? Math.round(n / 100) / 10 + 'k' : String(Math.round(n)));

export function geschiedenisGrafiek(w, plaatjes, opTik) {
  const soorten = Object.values(w.soorten).filter((s) => s.hist && s.hist.length >= 2);
  if (!soorten.length) return null;
  const begin = Math.min(...soorten.map((s) => s.hist[0][0]));
  const eind = Math.max(w.jaar, begin + 1);
  const hoogste = Math.max(10, ...soorten.flatMap((s) => s.hist.map((p) => p[1])));
  // Wortelschaal: een kleine soort is dan nog te zien naast een hele grote.
  const x = (j) => L + ((j - begin) / (eind - begin)) * (B - L - R);
  const y = (n) => T + (1 - Math.sqrt(n / hoogste)) * (H - T - O);

  let svg = '';
  // Hulplijnen met getallen.
  for (const f of [0.25, 1]) {
    const n = hoogste * f;
    svg += `<line x1="${L}" x2="${B - R}" y1="${y(n)}" y2="${y(n)}" class="gr-hulp"/><text x="${L - 4}" y="${y(n) + 3}" class="gr-getal">${telKort(n)}</text>`;
  }
  svg += `<line x1="${L}" x2="${B - R}" y1="${y(0)}" y2="${y(0)}" class="gr-as"/>`;
  for (const s of soorten) {
    const punten = s.hist.map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`);
    // Leeft hij nog? Dan de lijn doortrekken tot nu.
    if (s.uitgestorven === null) {
      const laatste = s.hist[s.hist.length - 1];
      punten.push(`${x(eind).toFixed(1)},${y(laatste[1]).toFixed(1)}`);
    }
    const k = s.kleur;
    const kleur = k && typeof k.h === 'number' ? `hsl(${Math.round(k.h * 360)} ${Math.round(Math.max(0.45, k.s || 0) * 100)}% 45%)` : '#8a7cff';
    svg += `<polyline points="${punten.join(' ')}" class="gr-lijn${s.uitgestorven !== null ? ' dood' : ''}" stroke="${kleur}"/>`;
    // Het plaatje van de soort aan het eind van zijn lijn: zo weet je welke lijn van wie is.
    const [ex, ey] = punten[punten.length - 1].split(',').map(Number);
    if (plaatjes[s.id]) svg += `<image href="${veilig(plaatjes[s.id])}" x="${ex - 9}" y="${ey - 17}" width="18" height="18"${s.uitgestorven !== null ? ' opacity="0.45"' : ''}/>`;
  }
  // Grote momenten op de tijdlijn.
  const momenten = w.kroniek.filter((e) => e.belang >= 3 && e.jaar >= begin);
  // Stippen die over elkaar zouden vallen: alleen de nieuwste laten zien.
  let vorige = Infinity;
  momenten.reverse().forEach((e) => {
    if (vorige - x(e.jaar) < 26) return;
    vorige = x(e.jaar);
    const k = w.kroniek.indexOf(e);
    svg += `<g class="gr-moment" data-k="${k}"><circle cx="${x(e.jaar)}" cy="${H - O / 2 + 1}" r="12"/><text x="${x(e.jaar)}" y="${H - O / 2 + 6}">${veilig(e.icoon)}</text></g>`;
  });

  const el = document.createElement('div');
  el.className = 'grafiek';
  el.innerHTML = `<div class="grafiek-kop">📈 Hoeveel waren er?</div><svg viewBox="0 0 ${B} ${H}">${svg}</svg><div class="grafiek-uitleg">Elke lijn is een soort. Tik op een stip!</div>`;
  el.querySelectorAll('.gr-moment').forEach((m) =>
    m.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const e = w.kroniek[+m.dataset.k];
      if (!e) return;
      el.querySelector('.grafiek-uitleg').textContent = `Jaar ${Math.floor(e.jaar).toLocaleString('nl-NL')}: ${e.tekst}`;
      opTik && opTik(e);
    })
  );
  return el;
}
