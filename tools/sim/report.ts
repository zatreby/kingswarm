// Text rendering of a bot-sim Summary, with the GDD §3.4 / fun-ai.md §5 target bands beside the numbers.
import type { Summary } from '../../src/ai/stats';

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const n1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const n2 = (x: number | null) => (x === null || !Number.isFinite(x) ? '-' : x.toFixed(2));
const band = (ok: boolean) => (ok ? 'ok ' : 'OFF');

export function formatSummary(s: Summary, label: string): string {
  const L: string[] = [];
  const row = (k: string, v: string, target = '', ok?: boolean) =>
    L.push(`  ${k.padEnd(26)} ${v.padEnd(34)} ${ok === undefined ? '   ' : band(ok)} ${target}`);
  L.push(`== ${label}  (n=${s.n}; A=${s.a}, B=${s.b})`);
  row('A win rate (95% CI)', `${pct(s.winRateA)}  [${pct(s.ciA[0])}, ${pct(s.ciA[1])}]`);
  row('A / B / draws', `${s.winsA} / ${s.winsB} / ${s.draws}`);
  row('Blue-seat win rate', pct(s.seat0WinRate), 'mirror 48-52%');
  const e = s.endings;
  row('ending throne', pct(e.throne), 'GDD 30-45%', e.throne >= 0.3 && e.throne <= 0.45);
  row('ending crown', pct(e.crown), 'GDD 35-50%', e.crown >= 0.35 && e.crown <= 0.5);
  row('ending time + overtime', `${pct(e.time)} + ${pct(e.overtime)}`, 'GDD < 20%', e.time + e.overtime < 0.2);
  row('draw (overtime cap)', pct(e.draw));
  row('length median p10 p90 (s)', `${n1(s.length.median)}  ${n1(s.length.p10)}  ${n1(s.length.p90)}`);
  row('first capture med p90 (s)', `${n1(s.firstCapture.median)}  ${n1(s.firstCapture.p90)}  (>30s ${pct(s.firstCapture.over30)})`, 'p50 10-20', s.firstCapture.median >= 10 && s.firstCapture.median <= 20);
  row('lead changes mean/median', `${n1(s.leadChanges.mean)} / ${n1(s.leadChanges.median)}  (>=1 ${pct(s.leadChanges.atLeast1)})`, 'GDD >=1 in most; median >=2', s.leadChanges.atLeast1 > 0.5);
  row('comeback rate', `${s.comebackRate === null ? '-' : pct(s.comebackRate)}  (n=${s.comebackN})`, '20-35%', s.comebackRate !== null && s.comebackRate >= 0.2 && s.comebackRate <= 0.35);
  row('snowball index', n2(s.snowball), '0.3-0.6', s.snowball !== null && s.snowball >= 0.3 && s.snowball <= 0.6);
  row('King deaths A / B', `${n2(s.kingDeathsA)} / ${n2(s.kingDeathsB)}`);
  row('volleys/min A / B', `${n1(s.volleysPerMinA)} / ${n1(s.volleysPerMinB)}`);
  row('critters thrown/min A / B', `${n1(s.thrownPerMinA)} / ${n1(s.thrownPerMinB)}`);
  row('avg swarm A / B', `${n1(s.swarmA)} / ${n1(s.swarmB)}`);
  row('avg followers A / B', `${n1(s.followersA)} / ${n1(s.followersB)}`);
  const f = s.flags;
  row('flag: 30 s capture drought', pct(f.drought30), 'alarm if high');
  row('flag: King idle > 10 s A/B', `${pct(f.kingIdle10A)} / ${pct(f.kingIdle10B)}`, '0%', f.kingIdle10A === 0 && f.kingIdle10B === 0);
  row('flag: NaN matches', String(f.nan), '0', f.nan === 0);
  row('tells (lies)', `${f.tells} (${f.tellLies})`, '0 lies', f.tellLies === 0);
  row('unstucks per match', n2(f.unstucksPerMatch));
  return L.join('\n');
}

/** One compact line, for sweeps. */
export function formatLine(s: Summary, label: string): string {
  const e = s.endings;
  return [
    label.padEnd(28),
    `A ${pct(s.winRateA).padStart(6)} [${pct(s.ciA[0])},${pct(s.ciA[1])}]`.padEnd(28),
    `thr ${pct(e.throne).padStart(6)} crn ${pct(e.crown).padStart(6)} time ${pct(e.time + e.overtime).padStart(6)}`,
    `len ${n1(s.length.median).padStart(5)}`,
    `1stcap ${n1(s.firstCapture.median).padStart(4)}`,
    `lead ${n1(s.leadChanges.mean)}`,
    `cb ${s.comebackRate === null ? '  -' : pct(s.comebackRate)}`,
    `snow ${n2(s.snowball)}`,
    `lies ${s.flags.tellLies}`,
  ].join('  ');
}
