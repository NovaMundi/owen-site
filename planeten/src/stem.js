// Voorlezen met de stem van de browser, zodat Jake niet hoeft te lezen.

let stemNL = null;
function kiesStem() {
  const stemmen = speechSynthesis.getVoices();
  stemNL =
    stemmen.find((s) => s.lang === 'nl-NL' && /google|natural|online/i.test(s.name)) ||
    stemmen.find((s) => s.lang === 'nl-NL') ||
    stemmen.find((s) => s.lang && s.lang.startsWith('nl')) ||
    null;
}
if ('speechSynthesis' in window) {
  kiesStem();
  speechSynthesis.onvoiceschanged = kiesStem;
}

export const stem = {
  aan: true,
  zeg(tekst) {
    if (!this.aan || !('speechSynthesis' in window) || !tekst) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(tekst);
    u.lang = 'nl-NL';
    if (stemNL) u.voice = stemNL;
    u.rate = 0.95;
    u.pitch = 1.1;
    speechSynthesis.speak(u);
  },
  // Meerdere zinnen achter elkaar voorlezen.
  rij(teksten) {
    if (!this.aan || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    for (const tekst of teksten) {
      const u = new SpeechSynthesisUtterance(tekst);
      u.lang = 'nl-NL';
      if (stemNL) u.voice = stemNL;
      u.rate = 0.95;
      u.pitch = 1.1;
      speechSynthesis.speak(u);
    }
  },
  stil() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  },
};
