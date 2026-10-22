// Voorlezen, zodat Jake niet hoeft te lezen.
//
// Vaste zinnen zijn één keer ingesproken met een warme stem (kunst/stem/, zie
// tools/stem-zinnen.mjs). Zinnen met namen of nieuws van de planeet leest de tablet zelf voor.
//
// Tablets laten geluid pas toe nadat je ergens op getikt hebt. Wat daarvoor gezegd moet worden,
// bewaren we tot de eerste tik, anders hoort het kind de welkomstzin nooit.

import { geluid } from './geluid.js';

let stemNL = null;
function kiesStem() {
  const stemmen = speechSynthesis.getVoices();
  stemNL =
    stemmen.find((s) => s.lang === 'nl-NL' && /google|natural|online/i.test(s.name)) ||
    stemmen.find((s) => s.lang === 'nl-NL') ||
    stemmen.find((s) => s.lang && s.lang.startsWith('nl')) ||
    null;
}
const kan = 'speechSynthesis' in window;
if (kan) {
  kiesStem();
  speechSynthesis.onvoiceschanged = kiesStem;
}

// Welke zinnen zijn ingesproken?
let opnames = {};
fetch(new URL('../kunst/stem/index.json', import.meta.url))
  .then((r) => (r.ok ? r.json() : {}))
  .then((j) => (opnames = j))
  .catch(() => {});

let wachtend = null;
const magAl = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
if (!magAl()) {
  const eersteTik = () => {
    window.removeEventListener('pointerdown', eersteTik, true);
    if (wachtend) setTimeout(() => stem.rij(wachtend), 50);
    wachtend = null;
  };
  window.addEventListener('pointerdown', eersteTik, true);
}

// Emoji niet voorlezen ("zandloper", "raket"): alleen de woorden.
const schoon = (t) => String(t).replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();

// Eén rij met zinnen die na elkaar worden gezegd; een nieuwe zin breekt de rij af.
let rij = [];
let speler = null; // het geluid dat nu speelt (ingesproken zin)
let ronde = 0;

function zegEen(tekst, mijn) {
  return new Promise((klaar) => {
    if (mijn !== ronde) return klaar();
    const bestand = opnames[tekst];
    if (bestand) {
      const a = new Audio(new URL('../kunst/stem/' + bestand, import.meta.url));
      speler = a;
      a.onended = a.onerror = () => {
        if (speler === a) speler = null;
        klaar();
      };
      a.play().catch(() => {
        speler = null;
        tts(tekst, klaar);
      });
      return;
    }
    tts(tekst, klaar);
  });
}
function tts(tekst, klaar) {
  if (!kan) return klaar();
  const u = new SpeechSynthesisUtterance(tekst);
  u.lang = 'nl-NL';
  if (stemNL) u.voice = stemNL;
  u.rate = 0.95;
  u.pitch = 1.1;
  u.onend = u.onerror = () => klaar();
  speechSynthesis.speak(u);
}
function stop() {
  ronde++;
  rij = [];
  if (speler) {
    speler.pause();
    speler = null;
  }
  if (kan) speechSynthesis.cancel();
}
async function speel(teksten) {
  stop();
  const mijn = ronde;
  geluid.muziekZacht(true); // muziek even zachter, zodat je de stem goed hoort
  for (const t of teksten.map(schoon).filter(Boolean)) {
    if (mijn !== ronde) return;
    await zegEen(t, mijn);
  }
  if (mijn === ronde) geluid.muziekZacht(false);
}

export const stem = {
  aan: true,
  get bezig() {
    return !!speler || (kan && (speechSynthesis.speaking || speechSynthesis.pending));
  },
  zeg(tekst) {
    if (!this.aan || !tekst || !schoon(tekst)) return;
    if (!magAl()) return void (wachtend = [tekst]);
    speel([tekst]);
  },
  // Meerdere zinnen achter elkaar voorlezen.
  rij(teksten) {
    if (!this.aan) return;
    if (!magAl()) return void (wachtend = teksten);
    speel(teksten);
  },
  stil() {
    wachtend = null;
    stop();
    geluid.muziekZacht(false);
  },
};
