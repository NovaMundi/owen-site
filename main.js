import jokes from './jokes.js';
import illusies from './illusions.js';

// Dag van het jaar — basis voor alle "van de dag" secties
const nu = new Date();
const dagVanHetJaar = Math.floor((nu - new Date(nu.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));

// ═══════════════════════════════
//  GRAPJE VAN DE DAG
// ═══════════════════════════════
let grapIndex = dagVanHetJaar % jokes.length;

function laadGrapje(index) {
  const grapje = jokes[index];
  document.getElementById('grapje-teller').textContent = `Grap #${index + 1} van de ${jokes.length}`;
  document.getElementById('grapje-vraag').textContent = grapje.setup;
  document.getElementById('grapje-antwoord').textContent = grapje.punchline;
  document.getElementById('grapje-antwoord').classList.add('verborgen');
  document.getElementById('willekeurig-knop').classList.add('verborgen');
  document.getElementById('onthul-knop').classList.remove('verborgen');
}

document.getElementById('onthul-knop').addEventListener('click', () => {
  document.getElementById('grapje-antwoord').classList.remove('verborgen');
  document.getElementById('willekeurig-knop').classList.remove('verborgen');
  document.getElementById('onthul-knop').classList.add('verborgen');
});

document.getElementById('willekeurig-knop').addEventListener('click', () => {
  let nieuw;
  do { nieuw = Math.floor(Math.random() * jokes.length); } while (nieuw === grapIndex);
  grapIndex = nieuw;
  laadGrapje(grapIndex);
});

laadGrapje(grapIndex);

// ═══════════════════════════════
//  ILLUSIE VAN DE DAG
// ═══════════════════════════════
let illusieIndex = dagVanHetJaar % illusies.length;

async function haalIllusieAfbeelding(wikipedia) {
  try {
    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikipedia)}`
    );
    const data = await resp.json();
    return data.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

async function laadIllusie(index) {
  const illusie = illusies[index];

  document.getElementById('illusie-naam').textContent = illusie.naam;
  document.getElementById('illusie-beschrijving').textContent = illusie.beschrijving;
  document.getElementById('illusie-uitleg').textContent = illusie.uitleg;
  document.getElementById('illusie-emoji').textContent = illusie.emoji;

  document.getElementById('illusie-uitleg').classList.add('verborgen');
  document.getElementById('illusie-willekeurig-knop').classList.add('verborgen');
  document.getElementById('illusie-onthul-knop').classList.remove('verborgen');

  // Afbeelding ophalen
  const imgEl = document.getElementById('illusie-afbeelding');
  const emojiEl = document.getElementById('illusie-emoji');
  imgEl.classList.add('verborgen');
  emojiEl.classList.remove('verborgen');

  const url = await haalIllusieAfbeelding(illusie.wikipedia);
  if (url) {
    imgEl.src = url;
    imgEl.alt = illusie.naam;
    imgEl.onload = () => {
      emojiEl.classList.add('verborgen');
      imgEl.classList.remove('verborgen');
    };
  }
}

document.getElementById('illusie-onthul-knop').addEventListener('click', () => {
  document.getElementById('illusie-uitleg').classList.remove('verborgen');
  document.getElementById('illusie-willekeurig-knop').classList.remove('verborgen');
  document.getElementById('illusie-onthul-knop').classList.add('verborgen');
});

document.getElementById('illusie-willekeurig-knop').addEventListener('click', () => {
  let nieuw;
  do { nieuw = Math.floor(Math.random() * illusies.length); } while (nieuw === illusieIndex);
  illusieIndex = nieuw;
  laadIllusie(illusieIndex);
});

laadIllusie(illusieIndex);
