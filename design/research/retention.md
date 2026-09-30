# Multi-day "one more run" pull without live-service servers — research for Kingswarm

Scope: Vampire Survivors (VS), Brotato, Hades, Slay the Spire (STS), Balatro, Nuclear Throne, Clash Royale, Plants vs Zombies (PvZ), Castle Crashers, Spelunky Daily.
Confidence tags: [P] primary (dev slides/interview/GDC), [S] secondary (wiki/press/analysis), [I] my inference, UNVERIFIED = could not confirm in this session.

## Bottom line for Kingswarm

1. Put the pull INSIDE the run, not around it. Every game studied that "lasts" has a draft of 3-4 options that produces a build you can talk about (Balatro jokers, Hades boons, Brotato shop, VS evolutions). Kingswarm's charms were pre-run stat tweaks with no build fantasy; that is why they were ignored.
2. Drafted upgrades must change swarm BEHAVIOUR (boomerang volley, splitters, hut-capture bursts, orbiters), not +x% numbers, and must combine (two-tag "duo" upgrades, Hades Tier-3 / VS evolution style). Draft happens in a menu between battles, so it adds a choice layer, not a second real-time control layer (the owner's complexity complaint).
3. Make a "run" = a chain of short battles (target 5 battles + boss, ~12-15 min total; battle length ramping ~60s to ~150s, Brotato-style ramp). Owner disliked 4-min matches; 2-3 min is the ceiling, not the average. [I]
4. Meta-progression = unlock OPTIONS, not power: new upgrade cards, critter types, heroes, rival tricks. STS has zero permanent power; Balatro/Brotato/Nuclear Throne unlock content and difficulty tiers. Any permanent stat must be earned on every run including losses, be respec-able, and never be the main hook (Hades Mirror model).
5. Long tail = a sequential, cumulative difficulty ladder per hero (Brotato Danger 0-5, Balatro 8 stakes, STS Ascension, Hades Heat). Each tier should ADD new content (new rival trick, elite battle, double boss), not just HP/damage; STS2 cut 20 levels to 10 because half were marginal.
6. Kill the daily quest. Peer-reviewed evidence (n=178) says checklist rewards feel like "a chore / like a job". If you want a daily, copy Spelunky: same seed for everyone, ONE attempt, a mode that changes how you play. The deterministic sim makes a static, serverless date-seeded run feasible (Wordle was client-side only).
7. Keep online PvP separate from drafted runs. STS's designer says single-player is what lets overpowered combos exist without "warping" anyone else. Run mode = PvE vs AI rival; online/couch = symmetric alternating draft from a shared pool, best of 3. [I]
8. Design the loss screen: show the build, the near-miss ("Crown 8.4/10s", "Throne at 9%"), and one-tap restart with a fresh 1-of-3 start pick. Near-misses raise desire to replay ONLY when the player felt in control (Clark 2009), so the draft must be the player's decision. Do not fake near-misses or use slot-machine imagery (Balatro got a PEGI 3+ to 18+ change over "gambling imagery").
9. Add a Hades-style assist, not a wall: after losses, a small capped bonus (Hades God Mode: +20% resistance, +2% per death, cap 80%; toggle, no content lock). Difficulty walls kill story/mastery pull (Kasavin).
10. Instrument runs locally now (pick rate, win rate per upgrade, run length) and export from owner playtests. STS's dev talk: metrics + weekly updates + low barrier to playtesters; "data is evidence, not a conclusion".

Challenge to the studio direction: run-based + drafted upgrades is strongly supported. The 3D diorama is NOT a retention lever (no evidence found; VS and Brotato are plain 2D). Ship the draft and ladder on the current 2D build first if schedule matters. [I]

## 1. Mechanism evidence, game by game

### Vampire Survivors
- Run length 15/20/30 min by stage. Level-up choose from 3-4 options; Galante: "three to four options when leveling up... dislikes only two... more is overwhelming". [P] https://www.androidpolice.com/vampire-survivors-developer-interview/
- Weapons have 8 tiers, passives 5; 6 weapon + 6 passive slots. Analysis (JB Oger) calculates ~12 items in 30 min would be a reward every 2.5 min, but tiers make it every ~23 s: trickle progression beats step progression. [S] https://jboger.substack.com/p/the-secret-sauce-of-vampire-survivors
- Evolution = weapon at max level (usually 8) + specific passive owned + open a boss chest after ~10 min. The recipe is the discovery layer; community wikis carry it. [S] https://vampire.survivors.wiki/w/Evolution , https://www.pcgamesn.com/vampire-survivors/weapon-evolutions
- Meta: gold buys permanent PowerUps (stat tweaks) + challenge/achievement-gated stage, weapon, character unlocks; base game 56 characters (34 standard + 22 secret, per a fan guide; UNVERIFIED count). https://en.wikipedia.org/wiki/Vampire_Survivors , https://rogueranker.com/vampire-survivors-guide/
- Same analysis notes the same choices recur ("options you decline will probably show up again"), so strategy sits in combo assembly, not each pick. Galante said casino-game work inspired chest openings (reported by Oger; UNVERIFIED primary).
- Ethos: "treat players like adults... monetization upfront and fair"; sold at ~2.69 EUR; content updates free (25+ staff by 2024). [P] androidpolice link above; https://toucharcade.com/2024/08/02/vampire-survivors-interview-apple-arcade-exclusive-content-xbox-game-pass-ps5-features-cross-save/

### Brotato (closest structural analogue to "short battles + draft")
- 20 waves; wave 1 = 20 s, +5 s per wave up to 60 s (waves 9-19), wave 20 = 90 s with 1-2 bosses. Total combat = 1,050 s = 17.5 min (my sum) plus a shop/upgrade screen after EVERY wave. [S] https://brotato.wiki.spellsandguns.com/Waves
- Dev's stated goal: survivor-like horde + autochess-style shop for "unique builds through weapon synergies". [S] https://en.wikipedia.org/wiki/Brotato
- Danger 0-5 unlock sequentially by winning; each level inherits the previous. D1 new enemies; D2 elite/horde on wave 11-12; D3 +12% dmg/HP; D4 +26% and 3 elite/horde waves; D5 +40% and TWO bosses (-25% HP each). Nightmare beyond. Winning tiers/achievements unlock characters (D5 unlocks Demon). [S] https://brotato.wiki.spellsandguns.com/Danger_Levels , https://steamcommunity.com/sharedfiles/filedetails/?id=2896126855
- Accessibility sliders (enemy dmg/HP/speed) let strugglers dial down and vets dial up to 200% ("%runs"). Wiki: "completely normal for new players to have trouble beating even Danger 0".
- Scale: 40k wishlists pre-EA; >1M copies in Early Access, >10M by 2025. [S] Wikipedia link above.

### Hades
- Structure: room reward = boon from an Olympian (4 rarities Common/Rare/Epic/Heroic, 100+ boons). Duo and Legendary boons need prerequisite boons from two gods (Tier 3 needs 2 lower-tier boons) = synergy gating. Choices-per-offer (3) UNVERIFIED here. [S] https://hades.wiki.fextralife.com/Boons , https://hades.fandom.com/wiki/Legendary_Boons
- Kasavin: "If the whole game is structured around dying and restarting, then we had to make sure the moment of death isn't about rage-quitting." "Reactivity... those moments where you feel the game is paying attention." [P] https://www.gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death
- On difficulty walls: "There's nothing more frustrating... engaged with the story, but then you just hit a difficulty wall" so they built mitigation systems (God Mode). [P] https://www.gamedeveloper.com/design/roguelikes-and-narrative-design-with-i-hades-i-creative-director-greg-kasavin
- God Mode: 20% damage resistance +2% per death, cap 80%, toggleable, no achievement/content lock. [S] https://hades.fandom.com/wiki/God_Mode
- Mirror of Night (permanent stat tweaks) works because: currency earned every run, respec for a few cheap Keys with full refund, two-option upgrades (power vs trade-off), later rows locked behind run-earned Keys. [S] https://www.thegamer.com/hades-mirror-of-night-roguelite-progression/
- Heat / Pact of Punishment unlocks after first win; per-modifier ranks (Hard Labor +20% enemy dmg per rank x5; Lasting Consequences -25% healing x4; Jury Summons +20% enemies x3...), each rank = Heat; re-earn rewards per Heat level per weapon. [S] https://www.rpgsite.net/feature/10287-hades-pact-of-punishment-heat-modifiers-and-how-to-maximize-your-rewards
- Heat was inspired by STS Ascension (secondary report of a Kasavin interview; UNVERIFIED wording). Run ~25-40 min; first escape typically attempt ~15-20 (forum anecdotes only). [S]

### Slay the Spire
- Giovannetti GDC 2019 slides: 20 Ascension levels "unlocked sequentially", framed as "Player Skill Stratification"; Early Access (1 yr) added weekly updates, Discord (18,168 pieces of feedback), Ascension, streamers; 3 characters, 250+ cards, 150+ items; "Every card should have a place (also avoid anything too warping)"; "Single player + rogue-like" is the balance advantage; "Data is evidence, not a conclusion"; "Lower the barrier between you, your playtesters and your audience. Update more often." 1.5M copies at the time. [P] https://media.gdcvault.com/gdc2019/presentations/Giovannetti_Anthony_SlayTheSpire.pdf
- Ascension is cumulative: A1 elites ~60% more, A2-4 enemy dmg by class, A5 heal 75% after boss, A6 start 90% HP, A10 unplayable curse, A11 -1 potion, A20 double boss. STS2 compressed to 10 levels because many steps "introduced only marginal changes". [S] https://allthings.how/slay-the-spire-2-ascension-explained-every-level-and-how-it-differs-from-the-original/
- No permanent power: meta is only unlocking content and difficulty rungs, tracked per character.

### Balatro
- 8 antes x 3 blinds, 150 jokers, 15 decks, 8 cumulative stakes (Red: no small-blind reward, Green: faster score scaling, Black: Eternal jokers, Blue: -1 discard, Purple: faster scaling, Orange: Perishable, Gold: Rental $3). Stakes unlock per deck by winning the previous one; winning tiers/stakes unlocks decks and puts stickers on jokers/decks. Joker slots capped at 5. [S] https://balatrowiki.org/w/Stakes , https://en.wikipedia.org/wiki/Balatro_(video_game)
- LocalThunk: no score preview on purpose: "more fun when you set up your Rube Goldberg machine and watch it go before knowing whether or not the hand will win the round." Escalating sound + sequential card/joker triggers make resolution the reward. Players still calculate it, which he calls a cursed design problem. [P via S] https://gmtk.substack.com/p/balatros-cursed-design-problem
- Playtesters tracking the deck manually -> he added a deck view, i.e. remove chores, keep suspense. Demos were "instrumental" to iteration; "unlock all" option = "simply a net positive". [P] https://toucharcade.com/2024/03/18/balatro-interview-mobile-port-localthunk-dlc-plans-updates-new-jokers-demo-feedback/
- Origin signal: a friend put "ten, 20, 30 hours" into the prototype. Sales 5M+ by Jan 2025. [P] https://www.rollingstone.com/culture/rs-gaming/balatro-localthunk-interview-1235214060/

### Nuclear Throne
- 4 random mutation choices per level-up; character-specific ultra mutation at level 10; final boss 7-3 then "loop" with much higher difficulty; 13 characters (11 unlockable, 2 secret); daily/weekly leaderboard modes. [S] https://en.wikipedia.org/wiki/Nuclear_Throne
- Vlambeer developed in public (bi-weekly livestreams) and iterated in Early Access. [P] https://www.gdcvault.com/play/1020034/Performative-Game-Development-The-Design . I could not retrieve talk text on run length or unlock cadence: UNVERIFIED.

### Clash Royale (core loop, server-dependent)
- Match 3 min + overtime (2 min sudden death, last min triple elixir as of current wiki). 4 chest slots; chest timers Silver 3h / Gold 8h / Magical 12h; free chest every 4h; Crown Chest after 10 crowns, once per 24h; upgrades need duplicate copies + coins (scarcity gating). [S] https://www.gamedeveloper.com/business/deconstructing-clash-royale , https://clashroyale.fandom.com/wiki/Basics_of_Battle
- The same analysis author says the slot/timer system "converted me into paying to skip timers": retention via friction+monetization; needs trusted server time. Not transferable; the useful part is the 3-minute unit and "one slot free = one reason to play now".

### Plants vs Zombies
- 5 stages x 10 levels; a new plant is unlocked at the end of nearly every level; every stage's 5th level is a mini-game; shop opens after 3-4; Zen Garden after 5-4. Reviewers: constant new plants "kept the game fresh"; each new plant = new strategy; Adventure felt like a long tutorial. [S] https://en.wikipedia.org/wiki/Plants_vs._Zombies_(video_game)
- Fan (GDC 2012): tutorial done by experimenting in a controlled environment; "If the tutorial hadn't been done well... the other elements of the game wouldn't have mattered." [P] https://www.gamedeveloper.com/design/gdc-2012-10-tutorial-tips-from-i-plants-vs-zombies-creator-george-fan (page text not retrievable; quote via search summary).
- Lesson for Kingswarm: first-week retention = one new toy per battle, and each toy is a new SWARM verb.

### Castle Crashers
- Per-character XP to level 99, points allocated to stats; weapons and 29 Animal Orbs (pets giving bonuses) found via specific conditions; arena challenges unlock characters; 4-player co-op where each player's XP/gold/weapons persist independently. [S] https://en.wikipedia.org/wiki/Castle_Crashers , https://castlecrashers.fandom.com/wiki/Animal_Orbs
- It is a collect-and-level loop that suits couch co-op but is stat-driven; the owner's charms verdict suggests stats alone will not carry it. No developer retention statement found: UNVERIFIED.

### Spelunky Daily (daily done right)
- One shared seed per day, one attempt, per-day leaderboard. Reviewer: risk "teaches new methods", he reached the final level 5 times in two weeks; players shared videos of the same seed; Halo/CoD-style "Kill 20 players" dailies were "neat little addition" only. [S] https://www.gamedeveloper.com/design/the-understated-genius-of-the-i-spelunky-i-daily-challenge
- Wordle (serverless model): client-side, one puzzle/day for all, results-share grid drove virality. [S] https://en.wikipedia.org/wiki/Wordle

## 2. Anti-patterns (with evidence)

- Stat-tweak unlocks: community/design commentary says permanent power makes players feel "they're not really playing... just grinding"; the recommended alternative is sidegrades (new items/characters). [S] https://bugnet.io/blog/how-to-design-a-roguelite-meta-progression , https://www.resetera.com/threads/do-you-like-meta-progression-in-your-roguelikes-roguelites.1341955/ . Counter-examples (VS PowerUps, Hades Mirror) survive only because currency is guaranteed per run, resets are cheap, and the real hook is elsewhere. Kingswarm's own playtest already confirms.
- Daily quests / login rewards: Frommel & Mandryk 2022, n=178, 115 games: rewards read as motivating for some, but "obligation", "a chore", "like a job", FOMO; those playing just to collect showed higher externally-regulated motivation and obsessive passion. Their recommendations: reduce missing-out, keep rewards optional. [P] https://dl.acm.org/doi/10.1145/3549489 (read via https://research-portal.uu.nl/ws/files/140472596/3549489.pdf)
- Timers/energy/chest slots: need server clock, exist to sell skips. Skip.
- Marginal difficulty rungs (STS1 A2-A4, A12): compress; every tier should be felt.
- Fun-optimising information leaks (Balatro score math): hide or reveal deliberately, never half-hide. Soren Johnson quote via GMTK: "given the opportunity, players will optimize the fun out of a game."
- Root cause (self-determination theory): competence, autonomy, relatedness each independently predicted enjoyment and future engagement (Przybylski, Rigby, Ryan 2010). Draft = autonomy; ladder = competence; couch/online duo = relatedness. Charms/quests deliver none. [P] https://selfdeterminationtheory.org/SDT/documents/2010_PrzybylskiRigbyRyan_ROGP.pdf
- Near-miss ethics: Clark et al. 2009 (Neuron): near-misses were less pleasant but increased desire to play, only when the player controlled the choice. Powerful and gambling-adjacent; use it honestly. [P] https://pubmed.ncbi.nlm.nih.gov/19217383/

## 3. Mechanisms ranked by fit for hero + swarm, 2-3 min battles

Score 1-5 (fit / cost). Rank 1 = build first.

| # | Mechanism | Fit | Why for Kingswarm | Cost |
|---|---|---|---|---|
| 1 | Draft-of-3 behaviour-changing swarm upgrades with tags + slot cap (5-6) | 5 | Menu-time choice, no new control layer; synergy = talkable builds; shooting stays great | M |
| 2 | Chain of short battles with ramp, boss last, instant restart (Brotato) | 5 | Directly matches the 2-3 min unit; Brotato proves 20-90 s combat + shop works | M |
| 3 | Sequential cumulative ladder per hero, new content per rung (Danger/Ascension) | 5 | Cheap replay depth; sim + AI variants make rungs easy; gives mastery target | S-M |
| 4 | Unlock options by doing, not spending; PvZ one-new-toy cadence | 5 | Fixes "ignored charms"; drives day-1/2 return | M (content) |
| 5 | Hidden recipes / duo upgrades / secrets (VS evolutions, Hades duo) | 4 | Discovery + community sharing without servers | M |
| 6 | Loss screen: build recap, near-miss facts, retry (Kasavin "death not rage-quit") | 4 | Nearly free; fits "one more" trigger | S |
| 7 | Assist that scales with losses (Hades God Mode) | 4 | Keeps casual owner-style players inside the loop | S |
| 8 | Opt-in Heat-style modifiers with rewards | 3 | Late-game only; needs ladder first | S |
| 9 | Seeded daily, one attempt (Spelunky/Wordle) | 3 | Deterministic sim makes it cheap; ritual w/o quest; leaderboard needs server, so share-code/ghost only | S-M |
| 10 | Draft-duel PvP (symmetric alternating pick) | 3 | Reuses drafts for couch/online; unproven in my sources [I] | M |
| 11 | Per-hero stat XP (Castle Crashers) | 2 | Couch flavour only; contradicts owner verdict | M |
| 12 | Chest timers / daily quests / login streaks / trophy-only ladders | 1 | Evidence negative or server-bound | - |

## 4. Proposed structures (numbers are starting hypotheses [I], tune with playtest telemetry)

### A. "Conquest Run" (recommended MVP)
- Run: 6 battles (5 + boss rival with 2 tricks), ~12-15 min. Battle length 60/75/90/105/120/150 s (arena shrink or Crown opens earlier so battles resolve; keeps winner-take-all).
- Start: pick hero (3) + 1-of-3 starting "banner" (a behaviour). 
- Draft: after every battle 1-of-3 (mixed tags), 1 reroll per run, skip allowed; battle 3 offers a rare-tier; slots capped at 5 upgrades + 1 relic. Duo upgrades appear only when two matching tags owned (Hades Tier-3 rule).
- Loss: lose a battle = run ends (Brotato) but progress counters (unlock meters) fill on every battle played. God-Mode-lite: +3% swarm regen per lost run, cap 30%, toggle.
- Unlock cadence: runs 1-10 = something new every run (upgrade card or critter type; ~12 new cards + 1 hero by run 10). Runs 10-40 = Danger 1-5 per hero, sequential, each with new rival behaviour (elite battle at D2, faster rival at D3, double rival at D5). 40+ = Heat modifiers, sticker per hero/Danger, 5+ hidden duo recipes.
- Expected: 3-5 runs per sitting, day-3 return driven by "I want Danger 2 on Sapper" and unfound recipes.

### B. "Rival Map" (STS-style branching)
- Run: 10 nodes on a 3-lane map (battle, elite battle, shop/draft, event, rest), ~20-25 min; 6-7 battles of 75-150 s; finale = throne assault.
- Draft: after each battle; shops let you sell/reshape (Balatro sell-to-pivot).
- Unlock: cards/relics per hero; Ascension 1-8 (compressed, each step meaningfully different, per STS2 lesson). 
- Cost: highest content + UI cost, risks the owner's complexity complaint (pathing = extra decisions). Only after A proves the draft.

### C. "Draft Duel" (couch 2P + online 1v1) with optional daily seed
- Match: best of 3 battles of 90-120 s, ~7 min. Players alternate picks from a shared pool of 6 cards before each battle (chess-like symmetry). Deterministic sim makes online cheap.
- Unlock: new cards enter the shared pool as you play. Open design question: draft from a common pool only, or from each player's owned cards (fairness vs. reward for playing). No source settles it.
- Daily seed (Spelunky/Wordle): run A with one fixed seed per date, one attempt, share string; no accounts, no server.
- Do not mix with A's meta power; PvP stays symmetric.

## 5. Open risks / UNVERIFIED
- No first-party data on "runs to day-3 return" for any game; cadence numbers in section 4 are inference.
- Hades boon offer size (3) and Kasavin's STS-Ascension quote: not confirmed in a primary source here.
- Nuclear Throne talk contents and Castle Crashers dev statements: not retrieved.
- Fetch tool summaries were weak for several pages; quotes flagged [P via S] come through secondary text.
- Near-miss framing is gambling-adjacent; check store ratings (PEGI/ESRB) before adding slot-like presentation.
- Draft power in PvE can trivialise 1v1 AI: needs rival scaling tied to upgrade count.
