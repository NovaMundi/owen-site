// Het account op dit apparaat, net als bij KIZZO Learn: de ouder maakt in het ouderportaal een
// QR-code per kind. Het kind scant hem één keer (een link met ?k=<geheime code>); dit apparaat
// onthoudt het kind en opent daarna altijd meteen het eigen account, op elk adres.
//
// De stand van de app:
//   'spelen' - er is een kind op dit apparaat: spelen op de eigen planeten
//   'kijken' - geen kind (een bezoeker op de website van een kind): alleen kijken, de etalage
//   'oud'    - testomgeving, papa's laptop, of een tablet met de oude koppeling (tot hij de QR scant)
//
// Dit bestand gebruikt localStorage zelf (niet opslag.js): het account hoort bij het apparaat,
// niet bij de testomgeving of de kijkstand.

const SLEUTEL = 'planeetmakers-account';
const WOLK_STAND = 'planeetmakers-wolk-v1';
export const FUNCTIE = location.hostname.endsWith('jakevanpelt.com') || location.port === '8888' ? '/.netlify/functions/planeet-gezin' : 'https://jakevanpelt.com/.netlify/functions/planeet-gezin';

const leesRuw = (k, s) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? s;
  } catch {
    return s;
  }
};
const schrijfRuw = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

const params = new URLSearchParams(location.search);
const SANDBOX = params.has('sandbox');
let account = leesRuw(SLEUTEL, { kinderen: [], actief: null });

// Net gescand? Dan dit kind onthouden (meer kinderen op één tablet kan ook) en de code uit het adres halen.
const nieuw = (params.get('k') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
if (nieuw.length >= 10 && !SANDBOX) {
  if (!account.kinderen.some((k) => k.slug === nieuw)) account.kinderen.push({ slug: nieuw, id: null, naam: null });
  account.actief = nieuw;
  schrijfRuw(SLEUTEL, account);
  params.delete('k');
  history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : ''));
}
export const NET_GESCAND = nieuw.length >= 10;

const oudeKoppeling = !!leesRuw(WOLK_STAND, {})?.code;
const lokaal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
export const MODUS = SANDBOX ? 'oud' : account.actief ? 'spelen' : oudeKoppeling || lokaal ? 'oud' : 'kijken';

export const actief = () => account.kinderen.find((k) => k.slug === account.actief) || null;
export const kinderenOpApparaat = () => account.kinderen.filter((k) => k.id);
// Wat de server over het actieve kind zei (ook bewaard voor als er even geen internet is).
export let info = actief()?.info || null;

export function wissel(slug) {
  if (!account.kinderen.some((k) => k.slug === slug)) return;
  account.actief = slug;
  schrijfRuw(SLEUTEL, account);
  location.reload();
}

// De nieuwste instellingen ophalen (aantal planeten, toveren, DNA, broers en zussen...).
// Werkt de QR-code niet meer (nieuwe gemaakt, kind verwijderd), dan dat kind van dit apparaat halen.
export async function laadInfo() {
  const k = actief();
  if (!k) return null;
  try {
    const r = await fetch(`${FUNCTIE}?actie=ik`, { headers: { 'x-kind': k.slug }, signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined });
    if (r.status === 401) {
      account.kinderen = account.kinderen.filter((x) => x.slug !== k.slug);
      account.actief = account.kinderen[0]?.slug || null;
      schrijfRuw(SLEUTEL, account);
      return { verlopen: true };
    }
    if (!r.ok) return info;
    info = await r.json();
    Object.assign(k, { id: info.kind.id, naam: info.kind.naam, info });
    schrijfRuw(SLEUTEL, account);
    return info;
  } catch {
    return info; // geen internet: met wat we nog weten
  }
}

export const kop = () => {
  const k = actief();
  return k ? { 'x-kind': k.slug } : {};
};

// Een eigen planeet wel of niet laten zien op de website van het kind.
export async function zetPubliek(planeet, aan) {
  const k = actief();
  if (!k) return false;
  try {
    const r = await fetch(`${FUNCTIE}?actie=publiek`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-kind': k.slug }, body: JSON.stringify({ planeet, aan }) });
    if (!r.ok) return false;
    const lijst = new Set(info.kind.publiek || []);
    if (aan) lijst.add(planeet);
    else lijst.delete(planeet);
    info.kind.publiek = [...lijst];
    schrijfRuw(SLEUTEL, account);
    return true;
  } catch {
    return false;
  }
}

// De etalage van de website waarop we nu zijn (alleen kijken).
export async function haalEtalage() {
  try {
    const r = await fetch(`${FUNCTIE}?actie=etalage&site=${encodeURIComponent(location.hostname)}`);
    return r.ok ? await r.json() : { naam: null, planeten: [] };
  } catch {
    return { naam: null, planeten: [] };
  }
}
