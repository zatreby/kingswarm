import { describe, expect, it } from 'vitest';
import { GOLDEN, MAX_LEVEL, PROFILES, PROXIES, RIVALS, scaleProfile } from './profiles';
import type { IntentKind } from './types';

describe('profiles', () => {
  it('the six rivals carry the GDD §6 heroes, Mutations and signature plays', () => {
    const want: Record<string, [string, string[], string]> = {
      bumble: ['brawler', [], 'hoardPush'],
      pip: ['warden', ['archerHuts'], 'crownPush'],
      brood: ['brawler', ['splitters', 'bigLitter'], 'flood'],
      gorm: ['brawler', ['brutes'], 'warParty'],
      sable: ['blink', ['homing', 'frostbite'], 'ambush'],
      mora: ['warden', ['royalGuard', 'bombers', 'secondWind'], 'crownPush'],
    };
    expect([...RIVALS].sort()).toEqual(Object.keys(want).sort());
    for (const id of RIVALS) {
      const p = PROFILES[id];
      expect(p.hero).toBe(want[id][0]);
      expect(p.mutations).toEqual(want[id][1]);
      expect(p.plays).toContain(want[id][2]);
      expect(p.flaw.length).toBeGreaterThan(10);
    }
  });

  it('every profile is plain data', () => {
    for (const p of Object.values(PROFILES)) expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });

  it('rivals have a short line for every intent and for their tell', () => {
    const keys: (IntentKind | 'tell')[] = ['expand', 'defend', 'raid', 'huntKing', 'takeCrown', 'regroup', 'tell'];
    for (const id of RIVALS) {
      for (const k of keys) {
        const lines = PROFILES[id].barks[k];
        expect(lines && lines.length, `${id} has no ${k} bark`).toBeTruthy();
        for (const l of lines!) expect(l.split(/\s+/).length, `${id}: "${l}"`).toBeLessThanOrEqual(4);
      }
    }
  });

  it('Crown Levels sharpen execution and unlock tactics, never stats', () => {
    for (const id of RIVALS) {
      const base = PROFILES[id];
      let prev = scaleProfile(base, 0);
      expect(prev.skill.tellLeadS).toBeGreaterThanOrEqual(0.6);
      expect(prev.skill.tellLeadS).toBeLessThanOrEqual(1.5);
      for (let lv = 1; lv <= MAX_LEVEL; lv++) {
        const p = scaleProfile(base, lv);
        expect(p.skill.reactionMs).toBeLessThanOrEqual(prev.skill.reactionMs);
        expect(p.skill.aimErrorDeg).toBeLessThanOrEqual(prev.skill.aimErrorDeg);
        expect(p.skill.tellLeadS).toBeLessThanOrEqual(prev.skill.tellLeadS);
        expect(p.skill.tellLeadS).toBeGreaterThanOrEqual(0.6);
        for (const t of prev.tactics) expect(p.tactics).toContain(t);
        expect(p.handicapHatchMul, 'economy handicap is a level-0 thing only').toBeUndefined();
        expect(p.mutations.length).toBeGreaterThanOrEqual(prev.mutations.length);
        prev = p;
      }
      const top = scaleProfile(base, MAX_LEVEL);
      expect(top.skill.reactionMs).toBeLessThan(scaleProfile(base, 0).skill.reactionMs);
      expect(top.tactics.length).toBeGreaterThan(base.tactics.length);
      expect(top.mutations.length).toBe(base.mutations.length + 2);
    }
  });

  it('only the first two rivals get an economy handicap', () => {
    for (const id of RIVALS) {
      const h = scaleProfile(PROFILES[id], 0).handicapHatchMul;
      if (id === 'bumble' || id === 'pip') expect(h).toBeLessThan(1);
      else expect(h).toBeUndefined();
    }
  });

  it('player proxies get sharper from novice to expert and never announce', () => {
    const [n, a, e] = PROXIES.map((id) => PROFILES[id].skill);
    expect(n.reactionMs).toBeGreaterThan(a.reactionMs);
    expect(a.reactionMs).toBeGreaterThan(e.reactionMs);
    expect(n.aimErrorDeg).toBeGreaterThan(a.aimErrorDeg);
    expect(a.aimErrorDeg).toBeGreaterThan(e.aimErrorDeg);
    expect(n.recallEfficiency).toBeLessThan(e.recallEfficiency);
    for (const s of [n, a, e]) expect(s.tellLeadS).toBe(0);
  });

  it('has the six golden scripted bots', () => {
    expect([...GOLDEN].sort()).toEqual(['crownCamp', 'idle', 'monkey', 'spamFire', 'throneRush', 'turtleForever']);
  });
});
