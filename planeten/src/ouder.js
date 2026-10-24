// Ouderportaal (net als bij KIZZO Learn): kinderen toevoegen, per kind instellen hoeveel planeten,
// hoe vaak toveren, DNA sturen en toegang tot elkaars planeten, en per kind een QR-code om een
// tablet te koppelen. Zie netlify/functions/planeet-gezin.mjs.
import qrcode from '../vendor/qrcode.js';
import { FUNCTIE } from './account.js';

const SESSIE = 'planeetmakers-ouder';
const $ = (s, el = document) => el.querySelector(s);
const veilig = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
let sessie = localStorage.getItem(SESSIE) || null;
let gezin = null;
const inhoud = $('#inhoud');

function meld(tekst) {
  const m = $('#melding');
  m.textContent = tekst;
  m.hidden = false;
  clearTimeout(meld.t);
  meld.t = setTimeout(() => (m.hidden = true), 3500);
}

async function api(actie, body) {
  const r = await fetch(`${FUNCTIE}?actie=${actie}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(sessie ? { 'x-ouder-sessie': sessie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && sessie && !['login', 'registreer'].includes(actie)) {
    sessie = null;
    localStorage.removeItem(SESSIE);
    toonInloggen();
    throw new Error('Log opnieuw in.');
  }
  if (!r.ok) throw new Error(d.fout || 'Er ging iets mis.');
  return d;
}

// De link in de QR-code: deze site, de planeten, met de geheime code van het kind.
const linkVan = (slug) => new URL(`./?k=${encodeURIComponent(slug)}`, location.href).href;

// ---------- Inloggen of account maken ----------
function toonInloggen(stand = 'login') {
  $('#uitloggen').hidden = true;
  inhoud.innerHTML = `
    <section class="kaart">
      <div class="tabs">
        <button data-stand="login" class="${stand === 'login' ? '' : 'uit'}">Inloggen</button>
        <button data-stand="nieuw" class="${stand === 'nieuw' ? '' : 'uit'}">Account maken</button>
      </div>
      <p class="uitleg">${stand === 'login' ? 'Log in om je kinderen en hun tablets te beheren.' : 'Maak een account voor je gezin. Daarna voeg je je kinderen toe en koppel je hun tablets met een QR-code.'}</p>
      <form>
        <label for="email">E-mailadres</label>
        <input id="email" type="email" autocomplete="email" required>
        <label for="pin">Pincode (4 tot 8 cijfers)</label>
        <input id="pin" type="password" inputmode="numeric" autocomplete="${stand === 'login' ? 'current-password' : 'new-password'}" pattern="[0-9]{4,8}" required>
        ${stand === 'nieuw' ? '<label for="startcode">Startcode (alleen als je die hebt gekregen)</label><input id="startcode" type="text" autocomplete="off">' : ''}
        <div class="knoppen"><button type="submit">${stand === 'login' ? 'Inloggen' : 'Account maken'}</button></div>
        <div class="fout"></div>
      </form>
    </section>`;
  inhoud.querySelectorAll('[data-stand]').forEach((b) => (b.onclick = () => toonInloggen(b.dataset.stand)));
  $('form', inhoud).onsubmit = async (e) => {
    e.preventDefault();
    const knop = $('button[type=submit]', inhoud);
    knop.disabled = true;
    $('.fout', inhoud).textContent = '';
    try {
      const d = await api(stand === 'login' ? 'login' : 'registreer', { email: $('#email').value, pin: $('#pin').value, startcode: $('#startcode')?.value || undefined });
      sessie = d.sessie;
      localStorage.setItem(SESSIE, sessie);
      await laadGezin();
    } catch (fout) {
      $('.fout', inhoud).textContent = fout.message;
      knop.disabled = false;
    }
  };
}

// ---------- Het gezin ----------
async function laadGezin() {
  inhoud.innerHTML = '<section class="kaart"><p class="uitleg">Even laden...</p></section>';
  gezin = await api('gezin');
  toonGezin();
}

function toonGezin() {
  $('#uitloggen').hidden = false;
  inhoud.innerHTML = `
    <section class="kaart">
      <h2>Jouw gezin</h2>
      <p class="uitleg">Voeg je kinderen toe en stel per kind in wat ze mogen. Elk kind koppelt zijn eigen tablet met een QR-code en komt daarna altijd meteen in zijn eigen planeten.</p>
      <label class="schakel"><input type="checkbox" id="familieplaneet" ${gezin.familieplaneet ? 'checked' : ''}> 🏠 Familieplaneet: één planeet waar alle kinderen samen aan bouwen</label>
    </section>
    <div id="kinderen"></div>
    <section class="kaart">
      <h2>Kind toevoegen</h2>
      <form id="nieuw-kind" class="rij"><input type="text" id="nieuw-naam" placeholder="Naam" maxlength="20" required style="flex:1;min-width:180px"><button type="submit">+ Toevoegen</button></form>
    </section>`;
  $('#familieplaneet').onchange = (e) => bewaar('gezin-zet', { familieplaneet: e.target.checked }, e.target.checked ? 'De familieplaneet staat aan.' : 'De familieplaneet staat uit.');
  $('#nieuw-kind').onsubmit = async (e) => {
    e.preventDefault();
    const naam = $('#nieuw-naam').value.trim();
    if (!naam) return;
    if (await bewaar('kind', { naam }, `${naam} is toegevoegd. Maak nu een QR-code voor de tablet.`)) $('#nieuw-naam').value = '';
  };
  const vak = $('#kinderen');
  if (!gezin.kinderen.length) vak.innerHTML = '<section class="kaart"><p class="uitleg">Nog geen kinderen. Voeg er hieronder een toe.</p></section>';
  for (const k of gezin.kinderen) vak.appendChild(kindKaart(k));
}

async function bewaar(actie, body, gelukt) {
  try {
    gezin = await api(actie, body);
    toonGezin();
    if (gelukt) meld(gelukt);
    return true;
  } catch (fout) {
    meld(fout.message);
    return false;
  }
}

function kindKaart(k) {
  const el = document.createElement('section');
  el.className = 'kaart';
  el.innerHTML = `
    <div class="kind-kop"><input type="text" class="naam" value="${veilig(k.naam)}" maxlength="20" aria-label="Naam"></div>
    <div class="instellingen">
      <div><label>Aantal planeten</label><div class="teller" data-veld="planeten" data-min="1" data-max="5"><button class="zacht" data-d="-1">−</button><b>${k.planeten}</b><button class="zacht" data-d="1">+</button></div></div>
      <div><label>Toveren per dag (✨ Maak echt)</label><div class="teller" data-veld="toveren" data-min="0" data-max="10"><button class="zacht" data-d="-1">−</button><b>${k.toveren}</b><button class="zacht" data-d="1">+</button></div></div>
      <div><label>Planeten van broers en zussen</label>
        <select class="elkaar">
          <option value="nee" ${k.elkaar === 'nee' ? 'selected' : ''}>Niet</option>
          <option value="kijken" ${k.elkaar === 'kijken' ? 'selected' : ''}>Alleen kijken</option>
          <option value="bouwen" ${k.elkaar === 'bouwen' ? 'selected' : ''}>Samen bouwen</option>
        </select></div>
      <div><label>&nbsp;</label><label class="schakel"><input type="checkbox" class="dna" ${k.dna ? 'checked' : ''}> 🧬 DNA sturen naar broers en zussen</label></div>
      <div style="grid-column:1/-1"><label>Website om planeten te laten zien (mag leeg)</label><input type="text" class="website" value="${veilig(k.website || '')}" placeholder="bijvoorbeeld owenvanpelt.com"></div>
    </div>
    <div class="qr-vak"></div>
    <div class="knoppen">
      <button class="toon-qr">${k.slug ? '📷 QR-code tonen' : '📷 QR-code maken'}</button>
      ${k.slug ? '<button class="zacht nieuwe-qr">🔄 Nieuwe QR-code</button>' : ''}
      <button class="gevaar weg">Verwijderen</button>
    </div>`;
  const zet = (velden, tekst) => bewaar('kind-zet', { id: k.id, ...velden }, tekst);
  $('.naam', el).onchange = (e) => zet({ naam: e.target.value }, 'Naam bewaard.');
  el.querySelectorAll('.teller').forEach((t) =>
    t.querySelectorAll('button').forEach((b) =>
      (b.onclick = () => {
        const nu = Math.max(+t.dataset.min, Math.min(+t.dataset.max, k[t.dataset.veld] + +b.dataset.d));
        if (nu !== k[t.dataset.veld]) zet({ [t.dataset.veld]: nu });
      })
    )
  );
  $('.elkaar', el).onchange = (e) => zet({ elkaar: e.target.value }, 'Bewaard.');
  $('.dna', el).onchange = (e) => zet({ dna: e.target.checked }, e.target.checked ? 'DNA sturen staat aan.' : 'DNA sturen staat uit.');
  $('.website', el).onchange = (e) => zet({ website: e.target.value }, 'Website bewaard.');
  $('.toon-qr', el).onclick = async () => {
    if (!k.slug) {
      if (!(await bewaar('kind-qr', { id: k.id }))) return;
      const nieuw = gezin.kinderen.find((x) => x.id === k.id);
      return toonQr(document.querySelector(`[data-kind="${k.id}"] .qr-vak`) || inhoud, nieuw);
    }
    toonQr($('.qr-vak', el), k);
  };
  $('.nieuwe-qr', el)?.addEventListener('click', async () => {
    if (!confirm(`Nieuwe QR-code voor ${k.naam}? De oude werkt dan niet meer: de tablet die nu gekoppeld is, moet de nieuwe code opnieuw scannen.`)) return;
    if (await bewaar('kind-qr', { id: k.id }, 'Nieuwe QR-code gemaakt. De oude werkt niet meer.')) toonQr(document.querySelector(`[data-kind="${k.id}"] .qr-vak`), gezin.kinderen.find((x) => x.id === k.id));
  });
  $('.weg', el).onclick = () => {
    if (!confirm(`${k.naam} verwijderen uit je gezin? De tablet van ${k.naam} kan dan niet meer spelen. De planeten blijven bewaard.`)) return;
    bewaar('kind-weg', { id: k.id }, `${k.naam} is verwijderd.`);
  };
  el.dataset.kind = k.id;
  return el;
}

function toonQr(vak, k) {
  if (!vak || !k?.slug) return;
  const link = linkVan(k.slug);
  const q = qrcode(0, 'M');
  q.addData(link);
  q.make();
  vak.innerHTML = `<div class="qr">${q.createSvgTag({ cellSize: 6, margin: 3, scalable: true })}
    <div class="qr-tekst"><b>QR-code van ${veilig(k.naam)}</b><br>Open de camera op de tablet van ${veilig(k.naam)}, richt hem op deze code en tik op de link. Vanaf dan opent de tablet altijd meteen de planeten van ${veilig(k.naam)}.<br><br>Laat deze code alleen aan je eigen kind zien.
    <div class="knoppen"><button class="zacht kopieer">📋 Link kopiëren</button></div></div></div>`;
  $('.kopieer', vak).onclick = async () => {
    try {
      await navigator.clipboard.writeText(link);
      meld('Link gekopieerd.');
    } catch {
      meld('Kopiëren lukte niet.');
    }
  };
  vak.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

$('#uitloggen').onclick = async () => {
  try {
    await api('uitloggen', {});
  } catch {}
  sessie = null;
  localStorage.removeItem(SESSIE);
  toonInloggen();
};

if (sessie) laadGezin().catch(() => toonInloggen());
else toonInloggen();
