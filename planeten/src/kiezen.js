// "Wat wil jij erbij?" De jongens kiezen zelf wat er als volgende in het spel komt (blok C uit
// het panelgesprek). Grote getekende kaarten, alles wordt voorgelezen, hooguit drie favorieten.
// De keuze komt in de wensenlijst terecht (en gaat via de wolk naar papa).

import { stem } from './stem.js';
import { geluid } from './geluid.js';
import { lees, schrijf } from './opslag.js';
import { icoon } from './iconen.js';

export const OPTIES = [
  { id: 'regen', label: 'Regen maken', zeg: 'Regen maken! Jij laat het regenen op een plek, en kijkt wat er met de wezens gebeurt.' },
  { id: 'bliksem', label: 'Bliksem', zeg: 'Bliksem! Met een flits kan er vuur ontstaan. Misschien leren je wezens zo het vuur kennen.' },
  { id: 'boom', label: 'Bomen planten', zeg: 'Bomen planten! Jij plant een zaadje, en er groeit een bos waar wezens kunnen wonen.' },
  { id: 'museum', label: 'Museum met botten', zeg: 'Een museum met botten! Van wezens die er niet meer zijn, blijven de botten bewaard.' },
  { id: 'stickers', label: 'Stickerboek', zeg: 'Een stickerboek! Bij elke ontdekking op je planeet krijg je een sticker.' },
  { id: 'cadeau', label: 'Cadeautjes', zeg: 'Cadeautjes! Je stuurt met een raketje een cadeau naar de planeet van je broer.' },
];
export const KIES_ZINNEN = ['Wie kiest er?', 'Kies wat jij het leukste vindt. Je mag er drie kiezen!', 'Dankjewel! Papa krijgt je keuze te horen.', 'Je hebt er al drie. Tik op een kaart om hem weer weg te halen.'];

export function openKiezen({ makers, opBewaard }) {
  const el = document.createElement('section');
  el.id = 'kiezen';
  document.body.appendChild(el);
  const sluit = () => {
    stem.stil();
    el.remove();
  };

  // Stap 1: wie kiest er?
  el.innerHTML = `<div class="kies-doos"><h2>Wie kiest er?</h2><div class="kies-wie"></div><button class="opnieuw kies-dicht">Sluiten</button></div>`;
  el.querySelector('.kies-dicht').onclick = sluit;
  stem.zeg('Wie kiest er?');
  for (const m of makers) {
    const b = document.createElement('button');
    b.className = 'tt-klaar kies-naam';
    b.textContent = m.naam;
    b.onclick = () => {
      geluid.plop();
      kaarten(m);
    };
    el.querySelector('.kies-wie').appendChild(b);
  }

  // Stap 2: de kaarten.
  function kaarten(maker) {
    const gekozen = new Set();
    el.innerHTML = `<div class="kies-doos breed"><h2>Wat wil jij erbij, ${maker.naam}?</h2><p class="weg-uitleg">Kies wat jij het leukste vindt. Je mag er drie kiezen!</p>
      <div class="kies-kaarten"></div><button class="tt-klaar kies-klaar" disabled>Klaar! ✨</button><button class="opnieuw kies-dicht">Sluiten</button></div>`;
    el.querySelector('.kies-dicht').onclick = sluit;
    stem.zeg('Kies wat jij het leukste vindt. Je mag er drie kiezen!');
    const klaar = el.querySelector('.kies-klaar');
    for (const o of OPTIES) {
      const k = document.createElement('button');
      k.className = 'kies-kaart';
      k.innerHTML = `${icoon('kies-' + o.id, '', 'kies-plaat')}<span>${o.label}</span><i class="hartje">❤️</i>`;
      k.onclick = () => {
        if (gekozen.has(o.id)) {
          gekozen.delete(o.id);
          k.classList.remove('aan');
          geluid.zwiep();
        } else if (gekozen.size >= 3) {
          stem.zeg('Je hebt er al drie. Tik op een kaart om hem weer weg te halen.');
          return;
        } else {
          gekozen.add(o.id);
          k.classList.add('aan');
          geluid.pling(gekozen.size + 1);
          stem.zeg(o.zeg);
        }
        klaar.disabled = gekozen.size === 0;
      };
      el.querySelector('.kies-kaarten').appendChild(k);
    }
    klaar.onclick = () => {
      const namen = OPTIES.filter((o) => gekozen.has(o.id)).map((o) => o.label);
      const wensen = lees('planeetmakers-wensen-v1', []);
      wensen.push({ wie: maker.id, wanneer: Date.now(), tekst: 'Ik kies: ' + namen.join(', '), keuze: [...gekozen] });
      schrijf('planeetmakers-wensen-v1', wensen);
      opBewaard && opBewaard();
      geluid.fanfare();
      stem.zeg('Dankjewel! Papa krijgt je keuze te horen.');
      el.querySelector('.kies-doos').innerHTML = `<h2>Dankjewel, ${maker.naam}! 🎉</h2><p class="weg-uitleg">Jij koos: ${namen.join(', ')}</p><button class="tt-klaar kies-dicht">Verder</button>`;
      el.querySelector('.kies-dicht').onclick = sluit;
    };
  }
}
