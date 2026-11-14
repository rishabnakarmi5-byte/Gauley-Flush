// Wide strip (band y=170-230): Dhaka-topi textile pattern; period 40 so it tiles seamlessly left to right.
import { type Drawing, p, flat } from './kit';

const N = 10, P = 40;
const rep = (f: (x: number) => string) => Array.from({ length: N }, (_, k) => f(k * P)).join('');
const stepTop = `M0 178${rep(x => `h10v6h10v-6h10v6h10v-6`)}`;
const stepBot = `M0 222${rep(x => `h10v-6h10v6h10v-6h10v6`)}`;
const diamonds = rep(x => `M${x} 200L${x + 20} 187L${x + 40} 200L${x + 20} 213Z`);
const inner = rep(x => `M${x + 11} 200L${x + 20} 194L${x + 29} 200L${x + 20} 206Z`);
const knot = (x: number) => `M${x - 2.2} 192a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0M${x - 2.2} 208a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0`;
const knots = rep(knot) + knot(N * P);

export const dhaka: Drawing = flat(
  p('M0 171H400'), p('M0 229H400'), p(stepTop), p(stepBot),
  p(diamonds), p(inner), p(knots),
);
