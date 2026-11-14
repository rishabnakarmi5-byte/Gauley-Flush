import type { Drawing } from './kit';
export { drawingToString } from './kit';
import { mandala } from './mandala';
import { ganesh } from './ganesh';
import { laxmi } from './laxmi';
import { buddha } from './buddha';
import { stupa } from './stupa';
import { pagoda } from './pagoda';
import { himal } from './himal';
import { prayerFlags } from './prayer-flags';
import { dhaka } from './dhaka';
import { vajra } from './vajra';
import { lotus } from './lotus';
import { kalash } from './kalash';
import { butterLamp } from './butter-lamp';
import { singingBowl } from './singing-bowl';
import { madal } from './madal';
import { khukuri } from './khukuri';
import { prayerWheel } from './prayer-wheel';
import { dharahara } from './dharahara';
import { krishnaMandir } from './krishna-mandir';
import { torana } from './torana';
import { doko } from './doko';
import { rhododendron } from './rhododendron';
import { mithilaFish } from './mithila-fish';
export const DRAWINGS: Record<string, Drawing> = {
  ganesh, laxmi, buddha, mandala, pagoda, stupa, himal, 'prayer-flags': prayerFlags, dhaka,
  vajra, lotus, kalash, 'butter-lamp': butterLamp, 'singing-bowl': singingBowl, madal, khukuri, 'prayer-wheel': prayerWheel, dharahara,
  'krishna-mandir': krishnaMandir, torana, doko, rhododendron, 'mithila-fish': mithilaFish,
};
