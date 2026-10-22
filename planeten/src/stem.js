// Voorlezen met de stem van de browser, zodat Jake niet hoeft te lezen.
//
// Tablets laten de stem pas praten nadat je ergens op getikt hebt. Wat daarvoor gezegd moet
// worden, bewaren we tot de eerste tik, anders hoort het kind de welkomstzin nooit.

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

let wachtend = null;
const magAl = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
if (kan && !magAl()) {
  const eersteTik = () => {
    window.removeEventListener('pointerdown', eersteTik, true);
    if (wachtend) setTimeout(() => stem.rij(wachtend), 50);
    wachtend = null;
  };
  window.addEventListener('pointerdown', eersteTik, true);
}

// Emoji niet voorlezen ("zandloper", "raket"): alleen de woorden.
const schoon = (t) => String(t).replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();

function uiting(tekst) {
  const u = new SpeechSynthesisUtterance(schoon(tekst));
  u.lang = 'nl-NL';
  if (stemNL) u.voice = stemNL;
  u.rate = 0.95;
  u.pitch = 1.1;
  return u;
}

export const stem = {
  aan: true,
  get bezig() {
    return kan && (speechSynthesis.speaking || speechSynthesis.pending);
  },
  zeg(tekst) {
    if (!this.aan || !kan || !tekst || !schoon(tekst)) return;
    if (!magAl()) return void (wachtend = [tekst]);
    speechSynthesis.cancel();
    speechSynthesis.speak(uiting(tekst));
  },
  // Meerdere zinnen achter elkaar voorlezen.
  rij(teksten) {
    if (!this.aan || !kan) return;
    if (!magAl()) return void (wachtend = teksten);
    speechSynthesis.cancel();
    for (const tekst of teksten) if (schoon(tekst)) speechSynthesis.speak(uiting(tekst));
  },
  stil() {
    wachtend = null;
    if (kan) speechSynthesis.cancel();
  },
};
