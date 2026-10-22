// Rekent op de achtergrond de tijd in die voorbij is gegaan terwijl niemand keek.
import { inhalen } from './sim.js';

onmessage = (e) => {
  const { wereld, regios, jaren, nu } = e.data;
  inhalen(wereld, regios, jaren, nu);
  postMessage({ wereld });
};
