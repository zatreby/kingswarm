// Watch one bot match as text: a line per interval with each King's intent, position, swarm and
// the Thrones' control, plus every tell, bark, capture and King death as it happens.
//   npx tsx tools/sim/trace.ts --a average --b gorm --seed 1 [--levelB 4] [--every 1] [--duration 150 --crown 90]
import { buildingsOwned, createWorld, step } from '../../src/sim';
import type { PlayerInput } from '../../src/sim';
import { createBot, matchConfig, profileFor } from '../../src/ai';
import { parseArgs } from './args';

const a = parseArgs(process.argv.slice(2));
const pa = profileFor(a.str('a', 'average'), a.num('levelA', 0));
const pb = profileFor(a.str('b', 'bumble'), a.num('levelB', a.num('level', 0)));
const seed = a.num('seed', 1);
const cfg = matchConfig({
  seed, map: a.str('map', 'meadow'), duration: a.num('duration', 150), crownOpensAt: a.num('crown', 90),
  sides: [{ profile: pa, hero: a.opt('heroA') as never, mutations: a.list('mutA') as never },
    { profile: pb, hero: a.opt('heroB') as never, mutations: a.list('mutB') as never }],
}, [pa, pb]);
const w = createWorld(cfg);
const bots = [createBot(0, pa, seed), createBot(1, pb, seed)];
const every = Math.round(a.num('every', 1) * 60);
const f = (n: number) => n.toFixed(1).padStart(5);

while (w.phase !== 'over' && w.time < cfg.duration + 60) {
  const inputs = [bots[0].think(w), bots[1].think(w)] as [PlayerInput, PlayerInput];
  for (let t = 0; t < 2; t++) {
    for (const s of bots[t].drainSignals()) {
      console.log(`${f(w.time)}  [${t ? 'R' : 'B'}] ${s.kind === 'tell' ? `TELL ${s.tell} at (${s.x.toFixed(1)},${s.y.toFixed(1)}) lead ${s.lead.toFixed(2)}` : `"${s.text}"`}`);
    }
  }
  step(w, inputs);
  for (const e of w.events) {
    if (e.type === 'capture') console.log(`${f(w.time)}  [${e.team ? 'R' : 'B'}] captures ${e.kind}#${e.building} (was ${e.prev})`);
    if (e.type === 'heroDown') console.log(`${f(w.time)}  [${e.team ? 'R' : 'B'}] King down`);
    if (e.type === 'matchEnd') console.log(`${f(w.time)}  END winner ${e.winner ? 'R' : 'B'} by ${e.reason}`);
  }
  if (w.tick % every === 0) {
    const parts = [0, 1].map((t) => {
      const h = w.heroes[t];
      let n = 0;
      for (const c of w.critters) if (c.alive && c.team === t) n++;
      const th = w.buildings[w.thrones[t]];
      return `${t ? 'R' : 'B'} (${f(h.x)},${f(h.y)}) hp${String(Math.round(h.hp)).padStart(4)} f${String(h.followers).padStart(3)}/${String(n).padStart(3)} b${buildingsOwned(w, t as 0 | 1)} thr${String(Math.round(th.control)).padStart(4)} ${bots[t].intent}`;
    });
    console.log(`${f(w.time)}  ${parts[0].padEnd(80)} | ${parts[1]}`);
  }
}
