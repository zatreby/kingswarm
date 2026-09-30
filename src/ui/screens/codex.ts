import { HEROES, MUTATIONS, MUTATION_IDS, TAGS } from '../catalog';
import { btn, h, icon, mutationChip, pic, portrait, shell, tagChip, traitChip } from '../dom';
import { abilityIcon, heroIcon, mutationIcon, picto, tagIcon } from '../icons';
import type { CodexModel, CodexMutationView, MutationId } from '../types';
import type { Ctx, ScreenInst } from './common';

type Tab = NonNullable<CodexModel['tab']>;

export function codexScreen(m: CodexModel, _ctx: Ctx): ScreenInst {
  const el = shell('codex', 'Codex');
  let tab: Tab = m.tab ?? 'mutations';
  const byId = new Map<MutationId, CodexMutationView>(m.mutations.map(v => [v.id, v]));
  const found = MUTATION_IDS.filter(id => byId.get(id)?.discovered).length;
  const beaten = m.rivals.filter(r => r.beaten).length;
  const heroes = m.heroes.filter(x => x.unlocked).length;

  const tabs: Record<Tab, HTMLButtonElement> = {} as never;
  const tablist = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Codex sections' });
  const body = h('div', { class: 'codex-body', role: 'tabpanel' });
  const mk = (t: Tab, label: string, count: string) => {
    const b = h('button', { type: 'button', role: 'tab', class: 'tab' }, label, h('span', { class: 'tab-count' }, count));
    b.addEventListener('click', () => setTab(t));
    tabs[t] = b;
    tablist.append(b);
  };
  mk('mutations', 'Mutations', `${found}/${MUTATION_IDS.length}`);
  mk('rivals', 'Rivals', `${beaten}/${m.rivals.length}`);
  mk('heroes', 'Heroes', `${heroes}/${m.heroes.length}`);

  const setTab = (t: Tab) => {
    tab = t;
    (Object.keys(tabs) as Tab[]).forEach(k => { tabs[k].setAttribute('aria-selected', String(k === t)); tabs[k].tabIndex = 0; });
    body.replaceChildren(t === 'mutations' ? mutationsTab() : t === 'rivals' ? rivalsTab() : heroesTab());
    body.scrollTop = 0;
  };

  const mutationsTab = () => {
    const detail = h('div', { class: 'codex-detail card', 'aria-live': 'polite' });
    const showDetail = (id: MutationId) => {
      const v = byId.get(id);
      const info = MUTATIONS[id];
      detail.replaceChildren();
      if (v?.discovered) {
        detail.className = `codex-detail card tagband-${info.tags[0]}`;
        detail.append(icon(mutationIcon(id), 'cd-ic'), h('b', { class: 'cd-name' }, info.name), h('p', { class: 'cd-text' }, info.text),
          h('span', { class: 'cd-tags' }, ...info.tags.map(tagChip)), h('span', { class: 'cd-picks' }, `Picked ${v.picks}×`));
      } else if (info.tags.length > 1) {
        detail.className = 'codex-detail card';
        detail.append(h('span', { class: 'cd-duo' }, icon(tagIcon(info.tags[0])), h('b', null, '+'), icon(tagIcon(info.tags[1]))),
          h('b', { class: 'cd-name' }, 'Hidden Duo'), h('p', { class: 'cd-text' }, `Own a ${TAGS[info.tags[0]].name} and a ${TAGS[info.tags[1]].name} Mutation to find it.`));
      } else {
        detail.className = 'codex-detail card';
        detail.append(pic('question', 'cd-ic'), h('b', { class: 'cd-name' }, 'Not found yet'), h('p', { class: 'cd-text' }, 'Win battles to see new Mutations in the draft.'));
      }
    };
    const grid = h('div', { class: 'codex-grid' });
    MUTATION_IDS.forEach(id => {
      const v = byId.get(id);
      const info = MUTATIONS[id];
      const duo = info.tags.length > 1;
      let tile: HTMLElement;
      if (v?.discovered) {
        tile = h('button', { type: 'button', class: `ctile tagband-${info.tags[0]}${duo ? ' duo tag2-' + info.tags[1] : ''}`, 'aria-label': `${info.name}, picked ${v.picks} times. ${info.text}` },
          icon(mutationIcon(id), 'ctile-ic'), h('span', { class: 'ctile-name' }, info.name),
          v.picks ? h('span', { class: 'ctile-picks' }, `×${v.picks}`) : null);
      } else if (duo) {
        tile = h('button', { type: 'button', class: 'ctile unknown duo-hidden', 'aria-label': `Hidden Duo: ${TAGS[info.tags[0]].name} plus ${TAGS[info.tags[1]].name}` },
          h('span', { class: 'ctile-duo' }, icon(tagIcon(info.tags[0])), h('b', null, '+'), icon(tagIcon(info.tags[1]))), h('span', { class: 'ctile-name' }, 'Duo'));
      } else {
        tile = h('button', { type: 'button', class: 'ctile unknown', 'aria-label': 'Undiscovered Mutation' }, pic('question', 'ctile-ic'), h('span', { class: 'ctile-name' }, '???'));
      }
      tile.addEventListener('focus', () => showDetail(id));
      tile.addEventListener('pointerenter', () => showDetail(id));
      grid.append(tile);
    });
    const firstFound = MUTATION_IDS.find(id => byId.get(id)?.discovered) ?? MUTATION_IDS[0];
    showDetail(firstFound);
    return h('div', { class: 'codex-muts' }, grid, detail);
  };

  const rivalsTab = () => h('ul', { class: 'codex-rivals' }, ...m.rivals.map(cr => {
    const r = cr.rival;
    return h('li', { class: `card crow${cr.met ? '' : ' unmet'}`, tabindex: '0', 'aria-label': `${r.name}. ${cr.beaten ? 'Beaten' : cr.met ? 'Met' : 'Not met yet'}.` },
      portrait(cr.met ? r.portrait : undefined, 'crow-portrait', true),
      h('div', { class: 'crow-main' },
        h('b', { class: 'crow-name' }, cr.met ? r.name : '???', r.boss ? h('span', { class: 'boss-tag' }, 'Boss') : null),
        h('span', { class: 'crow-title' }, cr.met ? r.title : 'Not met yet'),
        cr.met ? h('span', { class: 'crow-traits' }, traitChip(r.traits[0]), traitChip(r.traits[1]), ...r.mutations.map(mutationChip)) : null),
      h('div', { class: 'crow-side' },
        cr.beaten && r.flaw
          ? h('p', { class: 'crow-flaw' }, h('span', { class: 'mini-label' }, 'Flaw'), r.flaw)
          : h('p', { class: 'crow-flaw locked' }, pic('lock'), 'Beat them once to learn their flaw.'),
        cr.best.length ? h('span', { class: 'crow-best' }, ...cr.best.map(b => h('span', { class: 'best' }, icon(heroIcon(b.hero), 'best-ic'), h('span', null, `${b.crownLevel ? 'CL ' + b.crownLevel : 'Std'} · ${b.result}`)))) : null));
  }));

  const heroesTab = () => h('div', { class: 'codex-heroes' }, ...m.heroes.map(hv => {
    const info = HEROES[hv.id];
    return h('div', { class: `card chero${hv.unlocked ? '' : ' locked'}`, tabindex: '0', 'aria-label': `${info.name}. ${hv.unlocked ? info.playstyle : 'Locked. ' + (hv.unlockHint ?? '')}` },
      icon(heroIcon(hv.id), 'chero-ic'),
      h('b', { class: 'hero-name' }, info.name),
      h('span', { class: 'hero-style' }, info.playstyle),
      hv.unlocked
        ? h('ul', { class: 'hero-abil' }, ...info.abilities.map(a => h('li', null, icon(abilityIcon(a.icon), 'hero-abil-ic'), h('span', { class: 'hero-abil-t' }, h('b', null, a.name), h('span', null, a.text)))))
        : h('span', { class: 'hero-unlock' }, pic('lock'), hv.unlockHint ?? 'Locked'),
      h('span', { class: 'chero-stats' },
        h('span', { class: 'stat' }, h('small', null, 'Runs won'), h('b', null, String(hv.runsWon))),
        h('span', { class: 'stat' }, h('small', null, 'Best Crown Level'), h('b', null, hv.bestCrownLevel ? String(hv.bestCrownLevel) : '–'))));
  }));

  el.append(h('div', { class: 'card codex-card' },
    h('header', { class: 'codex-head' },
      btn('Back', m.onBack, { kind: 'plain', size: 'sm', icon: picto('back'), verb: 'back', cls: 'back-btn' }),
      h('h1', { class: 'display card-title' }, 'Codex'),
      tablist),
    body));
  setTab(tab);
  tabs[tab].setAttribute('data-autofocus', '');
  return { el, back: m.onBack };
}
