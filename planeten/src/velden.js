// Gedeeld door de hoofdpagina en de rekenhulp (werker), zodat beide precies dezelfde vorm berekenen.

const glad = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Continent, bergkam en fijn detail in één richting. Schrijft in `uit` (lengte 3).
export function velden(ruis, ruwheid, x, y, z, uit) {
  const vervorm = ruis.lagen(x + 7.1, y, z, 3, 1.5) * 0.35;
  const c = ruis.lagen(x + vervorm, y + vervorm, z, 5, 0.9 + ruwheid * 0.6);
  uit[0] = c;
  uit[1] = ruis.kammen(x, y, z, 5, 2.2 + ruwheid * 2) * glad(-0.05, 0.35, c);
  uit[2] = ruis.lagen(x, y, z, 4, 8) * (0.04 + ruwheid * 0.08);
  return uit;
}

// Waar is het van nature nat of droog? Grote vlekken, zodat woestijnen en oerwouden ontstaan.
export function vocht(ruis, x, y, z) {
  return ruis.lagen(x + 31.7, y - 11.3, z + 5.1, 4, 1.4);
}

// Kleine kleurvariatie zodat grenzen tussen grondsoorten niet strak zijn.
export function wiebel(ruis, x, y, z) {
  return ruis.ruis3(x * 9, y * 9, z * 9) * 0.05 + ruis.ruis3(x * 31, y * 31, z * 31) * 0.02;
}
