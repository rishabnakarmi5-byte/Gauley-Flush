// Wide strip (band y=170-230): a catenary string of square prayer flags, each with a tiny wind-horse mark.
import { type Drawing, p, flat } from './kit';
import { f } from './geom';

const Y0 = 176, SAG = 22;
const sy = (x: number) => Y0 + SAG * (1 - Math.pow((x - 200) / 176, 2));
const string = (() => { let d = `M24 ${f(sy(24))}`; for (let x = 36; x <= 376; x += 12) d += `L${x} ${f(sy(x))}`; return d; })();
const flags = (() => {
  const els: Drawing = [];
  const n = 10, w = 25, gap = (352 - n * w) / (n + 1);
  for (let i = 0; i < n; i++) {
    const x0 = 24 + gap + i * (w + gap), x1 = x0 + w, y0 = sy(x0), y1 = sy(x1), h = 28;
    const flutter = i % 2 ? 2.5 : -2.5;
    els.push(p(`M${f(x0)} ${f(y0)}V${f(y0 + h)}Q${f(x0 + w / 2)} ${f(y0 + h + flutter + (y1 - y0) / 2)} ${f(x1)} ${f(y1 + h)}V${f(y1)}`));
    const mx = (x0 + x1) / 2 - 1, my = (y0 + y1) / 2 + h * 0.52;
    // wind-horse (lungta): jewel above a small galloping horse, drawn as a few fine strokes
    els.push(p(`M${f(mx)} ${f(my - 8)}l-2.4 -3l2.4 -3l2.4 3Z`));
    els.push(p(`M${f(mx - 6)} ${f(my)}H${f(mx + 4)}L${f(mx + 6.5)} ${f(my - 5)}L${f(mx + 10)} ${f(my - 5.5)}L${f(mx + 10.5)} ${f(my - 3)}L${f(mx + 7.5)} ${f(my - 2.5)}`));
    els.push(p(`M${f(mx - 6)} ${f(my)}L${f(mx - 8.5)} ${f(my + 5.5)}M${f(mx - 3.5)} ${f(my)}L${f(mx - 5)} ${f(my + 5.5)}M${f(mx + 2.5)} ${f(my)}L${f(mx + 5)} ${f(my + 5.5)}M${f(mx + 4)} ${f(my)}L${f(mx + 8)} ${f(my + 4)}M${f(mx - 6)} ${f(my)}C${f(mx - 9)} ${f(my - 1)} ${f(mx - 10.5)} ${f(my + 2)} ${f(mx - 10)} ${f(my + 4)}`));
  }
  return els;
})();

export const prayerFlags: Drawing = flat(p(string), flags);
