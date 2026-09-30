# Fun AI for Kingswarm: rival commanders, PvE, difficulty, and bot-sim testing

Researched 2026-09-30. Tags: [V] = read in a fetched page or a PDF converted locally (slides/papers); [S] = search snippet or secondary summary only; UNVERIFIED = could not confirm. Fetch summaries came from a small model, so numbers tagged [V] are as summarised. "Proposal" and "(tune)" mark my design inferences, not facts.
Repo context [V, read from kingswarm.html]: today's rival is a 4-mode FSM (`retreat/hunt/crown/expand`, re-decided every `diff.think` s) whose difficulty is `think, spawn (rival hut spawn slowdown), hunt, strong, ult, speed, stomp`. `src/sim/` in the rebuild is still empty, so the sim/AI split below is greenfield.

## Bottom line for Kingswarm

1. **Do not build GOAP or a big behavior tree. Use utility scoring to pick 1 of ~6 "intents", and a small Action stack to execute it.** F.E.A.R.'s planner pays off with many decoupled goals/actions across character types [V]; the rival has one body and six intents. Dave Mark/Kevin Dill utility (response curves, veto, inertia, weighted-random-from-top-n) is the fit [V].
2. **A personality is a data row, not a code path**: weight vector + 2 signature "plays" + 1 tell + 1 exploitable flaw. Halo 2 solved the same problem with "Styles" (whitelist/blacklist behaviors) and character inheritance to avoid "10,350 different numbers" [V].
3. **The AI must play through the same input pipe as a human** (move vector, aim point, fire, dash) via a delay queue with aim error. Then difficulty = execution error + tactic repertoire, the same bot code is the balance-test bot, and there is no silent cheating.
4. **Perceived intelligence is mostly legibility.** Ship a "tell" for every consequential rival decision: F.E.A.R. did coordination via dialogue that was "smoke and mirrors" decided after the fact, and Halo's leader/follower formation makes the boss identifiable by position [V]. Kingswarm equivalent: banner/horn + ring + 1-line bark, never a beep.
5. **Difficulty by unlocking tactics and shrinking errors; use economy handicaps only at the bottom tiers; label any real cheat "Cheater".** Do not rubber-band the rival's stats (Mario Kart evidence: punishes the leader, feels unfair [V]). Adapt PvE pacing instead (L4D Director adjusts frequency, not amplitude [V]).
6. **Neutral PvE = a Director + camps + one boss cadence, all seeded.** L4D's "structured unpredictability": randomised intervals, a shuffled boss deck (Tank/Witch/Nothing, no repeats) [V]. Vampire Survivors shows simple homing enemies in overwhelming numbers plus a soft-timer Reaper are enough [V].
7. **Boss = a composition test with one signature mechanic per phase, weak point exposed by the swarm's positioning** (Halo 3 leader "break", Pikmin back-weak-point [S]). 2-3 phases max [S]. Riot explicitly rejects skill-gate bosses because PvE "gets solved at high levels" [V]: reward is team-wide and modest, the fight is about swarm mix, not reflexes.
8. **Bot-sim first, headless, seeded, same TS sim as the game.** Track 8 metrics (below). Rule-based personality bots first; RL later only if rule bots stop finding balance problems (Riot LoR used self-play RL, Ubisoft Roller Champions retrains in 1-4 days [V], but both are large investments).
9. **Keep scripted "golden bots" as regression tests** (idle, turtle-forever, rush, crown-camp, spam-fire, random-input monkey) with tolerance bands in CI. Valve did automated stress tests with bots at accelerated game time [V].
10. **Cap the rival's simultaneous engagements**, like Half-Life's "no more than 2 attack at once" [V, gamedeveloper DDA article]. With hold-to-fire swarms, one rival wave at a time keeps fights readable at 2.5 min.

## 1. Architecture recommendation

```
Sim (pure TS, fixed step, seeded RNG, no DOM)
  ├─ Director      : PvE intensity + camp/mob/boss scheduler (seeded)         [macro pacing]
  ├─ Commander AI  : Perception -> Utility(intent) -> Play stack -> InputFrame [per rival]
  └─ Tell layer    : emits TellEvents {kind, pos, t_before_effect, bark_id}    [renderer/audio consume]
```
- **Perception**: reads the same world state as a player but through a stale snapshot (`reaction_ms` old) plus memory of last-seen swarm positions. Valve's bots used "imperfect knowledge, simulated aiming, reaction times" to make bot replacements feel fair [V, L4D slides].
- **Intent scoring (utility)**: intents = `Expand(hut)`, `Defend(hut)`, `Raid(hut/throne)`, `HuntHero`, `TakeCrown`, `Regroup`, plus `ClearCamp(camp)`. Each has considerations with response curves (swarm ratio, distance, hut value, own-hero HP, time to Crown, enemy hero exposure). Score = sum of weighted considerations x multipliers, 0 = veto [V]. Add an **inertia consideration** (bonus to the current intent, decays over 3-5 s (tune)) and pick **weighted-random among top 2** so the same board does not always give the same move [V: Mark/Dill weapon-selection example: tuning + range + inertia + random noise + veto considerations]. Personality = per-consideration weights.
- **Execution (Play stack)**: Valve's Action model is a good template: `OnStart/Update/OnEnd/OnSuspend/OnResume`, transitions `ChangeTo/SuspendFor/Done(reason)`, events bubbling child->buried->parent, and **a reason string on every transition for realtime debug** [V]. Steal the reason strings: they double as bark text and as bot-sim logs.
- **Ability layer stays hidden from the player's control model** (owner rejected two control layers), but the rival may use hero abilities as *plays* inside intents (`Raid` may include a dash) and each use gets a tell.
- **Why not F.E.A.R. GOAP**: its own paper says complex squad behaviors (flank, pincer) were *not implemented*; they "emerge" from simple cover-seeking and were then narrated by dialogue [V]. Kingswarm's map is 15 nodes; use the same trick with 6 intents.
- **Why not pure BT**: Halo 2's BT/DAG value was reuse and designer hackability ("value explicitness above all else") [V]; utility gives that with less authoring for 6 intents. Use small BT-style sequences only inside Plays (e.g. Feint = split, wait, commit).

## 2. Rival personalities (5) and their tells

Existing roster names/lines in kingswarm.html (Bumble, Pip, Sable, Gorm, Vex, Queen Mora) map cleanly. Each: intent bias, signature play, tell (fair warning), flaw (how a player wins). All numbers (tune).
| Rival | Bias | Signature play | Tell (>= 0.8-1.2 s before effect) | Flaw to exploit |
|---|---|---|---|---|
| **Gorm the Rusher** | Raid + HuntHero early, ignores Defend | Single all-in wave at Throne ~0:35-0:50 with everything above cap x0.6 | War-horn + red banner over his hero, swarm turns red-tinted | After the wave he has ~8 s "Regroup" with an empty base; recapture window |
| **Pip the Turtle** | Defend/Expand near own half | Fortifies huts (visible garrison rings), does nothing aggressive until Crown opens, then one committed Crown push | Shield-rings pulse; Crown push announced by lantern on his hero at 1:20 | Never contests neutral camps or the far huts; loses the economy race |
| **Sable the Trickster** | Feint utility 30%, HuntHero on stragglers | *Feint*: split swarm 60/40, decoy leg heads at hut A with a dust trail, real leg commits to B after 1.5-2 s | Decoy leg has a tiny "?" shimmer and slower formation; real leg has the banner | Over-splits, so both legs are weak; hold-to-fire on the real leg wins |
| **Vex the Hunter** | HuntHero + opportunistic recapture of huts *you just took* | Third-party: waits for the player's capture fight to finish, then snipes the hut at <30% guard | Crosshair mark on the target hut ~1 s before her swarm arrives | Ignores economy; falls behind on cap if you stay home and guard |
| **Bumble the Hoarder** | Expand max, Regroup to cap | Waits until swarm >= 90% cap, then one big blob push at nearest enemy hut | Swarm-meter glow over his hero fills, visible to all | Predictable timing; blob is slow, so kite and split-fire |
Boss-level 6th: **Queen Mora (Crown-holder)** = a boss wrapper (section 3) with Turtle + Hunter weights that switches at 50% Throne HP. Personality dial = weight vector + inheritance from a base row (Halo 2 character hierarchies [V]). Player-facing readout: rival card at match start with 2 icons ("rushes", "feints") so knowledge carries across matches (chess.com/opening-book feel, and the "days" pull).
- **Barks (data-driven, short)**: intent-change lines ("Push!"), status ("Where'd they go?"), failure ("I've got nowhere to go!"). F.E.A.R. used dialogue to *explain lack of action* and even vocalised reinforcements it never implemented; it preferred two-speaker exchanges to solo announcements [V]. For Kingswarm use text bubbles and a distinct musical stinger per rival (horn, chime, drum), not beeps. UNVERIFIED that bubbles read at a fixed tilted 3D camera; test in the diorama spike.
- **Anti-frustration**: no rival acts with zero tell; no instant hero kills from off-screen; no hidden speed boosts. Tune "tell lead time" per tier (Rookie 1.5 s, Elite 0.6 s (tune)).

## 3. Neutral PvE, camps and bosses

**What works in the references**
- **Left 4 Dead Director** [V, Valve slides]: population = superposition of frequency classes: wanderers (high), mobs of 20-30 (medium), specials (medium), bosses (low), items (low/medium). Mobs at randomised 90-180 s intervals (Normal); 75% of mobs spawn "behind" the team. Bosses: dealt from a shuffled deck {Tank, Witch, Nothing}, no back-to-back repeats, and *not affected by pacing* so they change the pacing. Pacing FSM: Build Up -> Sustain Peak (3-5 s) -> Peak Fade -> Relax (30-45 s), driven by a crude "emotional intensity" (rises on damage taken, decays only when not engaged). "Algorithm adjusts pacing, not difficulty; amplitude is not changed, frequency is."
- **Vampire Survivors** [V, wiki]: enemies mostly home straight at the player (some fixed-direction or wavy variants); one wave per minute; hard cap 300 alive before periodic spawning stops; bosses spawn in set waves and can drop treasure; a "Reaper" arrives at the time limit and repeats each minute (resistant, HP scaling) so runs end. Lesson: simple behaviors + number + cadence + a soft timer.
- **Halo 3 leadership** [V, Microsoft Learn]: highest-rank unit leads, stays at the back near the objective; followers fan out in front; leader orders the attack after a pause; **kill the leader and followers "break"**, each type visibly differently (Brutes scatter or charge, Grunts flee, Jackals huddle) then recover when no longer threatened. Bungie framed it as a way to get encounter variety "without requiring increased variations in character types" and the leader as a mini boss. This is the best single template for a swarm camp.
- **MOBA neutrals** [V, PCGamesN quoting Riot]: objectives appear at intervals to pull players into high-stakes fights; Baron will not be a "Dark Souls boss" because "PvE like that ends up getting really solved at high levels" and trivialised by experts.
- **Thronefall** [V, dev interview]: removed *what/where to build*, leaving only *when*, and keeps the hero in the fight; complexity layered progressively. [S] enemy composition escalates by night (bowmen -> horsemen, catapults, bombs). Pikmin [S, Pikipedia]: Bulborb weak spot on the back; variants add weak points (Bilious has three).
- **Clash Royale bots**: Supercell has not publicly confirmed bots; community claims they exist below ~4,000 trophies with simple decks [S, esports.net]. UNVERIFIED; do not cite as fact.

**Proposal for a 2.5-min match (all times tune)**
- **Seeded Director**: a "Relax/Build" intensity meter fed by hero HP loss, swarm losses and recent captures; it modulates *neutral* spawns only (never rival stats). Neutral events every 25-40 s randomised; no two identical in a row.
- **Camps ("Nests")**: neutral huts guarded by N critters of a distinct type with a Halo-style **Chieftain at the back**. Kill the Chieftain -> guards scatter/flee for 4 s and the Nest is capturable. Reward: a hut with a unique critter type or +cap. 2 camps on the map, one per side, one contestable (mid).
- **Boss cadence**: shuffled deck of {Brood Mother, Bulwark, Nothing} appears ~0:55 as a neutral in the arena centre; whoever's swarm lands the kill gets the team-wide reward. At 1:30 the Crown opens (existing). In overtime a **Reaper-style Wraith** spawns and re-spawns every 20 s (Vampire Survivors soft timer) so matches always end.
- **Boss mechanics (each 2 phases; phase 2 adds one verb, not more HP)**:
  1. *Bulwark*: frontal armor (shots do ~10%), weak back; turns slowly and telegraphs a turn with a 1.2 s swivel. Forces the swarm to circle. Phase 2: shield-slam ring, 1.5 s wind-up (boss telegraph guidance: burst attacks should give 1.5-3 s to avoid [S]).
  2. *Brood Mother*: spawns homing adds every 6 s; three egg sacs are the weak points, destroying all stops adds and stuns her 4 s. Phase 2: sacs regrow if not killed within 10 s.
  3. *Stomper*: ground-slam rings that scatter critters, fast stagger window after each slam (vulnerability window = reward for dodging).
- **Fairness**: bosses hit critters, not the Hero directly, unless the Hero stands in a ring; ring size and timing always shown.

## 4. Difficulty knobs and DDA

**Knobs (Commander AI)** [proposal, mapped to the existing `diff` fields]
| Knob | Rookie | Elite | Notes |
|---|---|---|---|
| `reaction_ms` (perception staleness) | 700 | 200 | humans ~200-250 ms simple reaction (well-known; not re-verified here) |
| `think` (decision interval, existing) | 0.9 s | 0.35 s | existing formula already scales 0.9 -> 0.45 |
| `aim_error_deg` (swarm shot spread, worse while moving) | 10 | 2 | BotPrize: capping aim accuracy on rapid moves helped bots read as human [S] |
| `tactics_unlocked` (Style whitelist) | Expand, Defend | + Feint, thirdparty, camps, Crown timing | Halo 2 Styles [V] |
| `tell_lead_s` | 1.5 | 0.6 | fairness, readable to novices |
| `recall_efficiency` (swarm control) | 0.5 | 0.95 | uses recall like the player |
| `econ_mult` (existing `spawn`) | 1.5x slower | 1.0 | only Rookie-Bronze; visible as "Handicap" chip |
| `info` (memory/fog for rival) | last-seen only | full | Mushroom Wars 2 hides info at high levels [S] |
| `aggression_scale` | 0.6 | 1.0 | scales personality weights |
| `max_concurrent_pushes` | 1 | 2 | Half-Life "max 2 attackers" [V] |
- **Named cheats**: SC2 has explicit "Cheater 1/2/3" (vision, +resources, both) above the non-cheating Elite [S, Liquipedia/search]. Offer a visibly labelled "Cheater" tier only after Elite is beatable; never mix cheats into normal tiers.
- **Difficulty is a ladder of *behaviors*, so ranked/tier progress shows the player a new rival trick each step**: this replaces the ignored stat charms with something they notice.

**Dynamic difficulty: evidence**
- **RE4 hidden "rank"** [S]: scale 1-10, moves with accuracy/hits/deaths; changes damage, enemy aggression, even spawns. Never officially stated; exact numbers UNVERIFIED (speedrun.com guide returned 403).
- **Mario Kart rubber banding** [V, gamedeveloper]: speeds and item tables tied to position; visible, "feels unfair", and makes lead-holding suboptimal. **God Hand** [V]: visible difficulty meter, transparency worked better than hiding (contradicts Ernest Adams's "hide it" advice as quoted). **XCOM** [V]: displayed hit % is inflated on Easy; hides true odds. **Silent Hill: Shattered Memories** [V]: removes enemy senses, fewer enemies after deaths. **Hamlet** (Hunicke/Chapman, Half-Life) [S]: tracks resource consumption, intervenes when a failure is predicted.
- **Verdict for Kingswarm**: (a) no hidden stat DDA on the rival; (b) PvE Director may modulate frequency (L4D) because it is already random; (c) after 2 consecutive losses show a *visible* offer ("Rival looks easier: drop a tier?") and after 3 wins offer a step up; (d) a simple structural handicap beats algorithms (billiards "most elegant" [V]): the trailing side's neutral camp respawns faster, everyone sees it.

## 5. Bot-vs-bot balance testing plan

**Harness**
- `sim` is pure TS (Node + browser), seeded PRNG (own Mulberry32-style; **no `Math.random`**), fixed 60 Hz step, `step(state, inputs)`. Bots implement `decide(view) -> InputFrame` (same as human). Runs 2000+ matches/config in `worker_threads` or vitest; a replay = `(seed, config, inputs)`.
- **Determinism**: assert equal state hash every 60 ticks between two runs with the same seed; same-machine replay determinism is realistic, cross-machine float determinism is not guaranteed (Gaffer on Games: differences across compilers/OS/instruction sets "make it almost impossible") [V, search summary]. Keep `Math.sin/cos/pow` out of authoritative paths or accept "same engine only". Netcode is host-authoritative snapshots, so this only matters for CI reproducibility.
- **Sample sizes**: 95% CI half-width of +-2 pp on a 50% win rate needs ~2,400 games (1.96*sqrt(.25/n)); a Dominion balancing paper found ~2,000 sims a good tradeoff [S]. Use 300 for smoke, 2,400 for gates.
- **Sweep/tune**: search over hut interval, cap, camp reward, boss timing with an evolutionary loop whose fitness = deviation of matchup win rates from 50%, with NSGA-II to minimise number of changed parameters (Hearthstone meta paper; 100 games per matchup in its experiments) [V]. Riot ran RL self-play on LoR decks and made its "balance score" a designer KPI (48% win vs top humans; started with 1 deck, then 10) [V, Anyscale]; Ubisoft used training-curve Elo to spot an underpowered combo in Roller Champions [V].

**Metrics (with design target bands; targets are my proposals, calibrate on human playtests)**
| Metric | Definition | Target / alarm |
|---|---|---|
| Win-rate matrix | personality x personality x hero x seat (P1/P2 side) | mirror seats 48-52%; no personality >60% vs field; intransitive cycles are OK (rock-paper-scissors) |
| Skill ladder | tier i vs tier i-1 | Elite >= 80% vs Rookie; adjacent 55-65%; monotonic |
| Match length | median, p10, p90; % ending by Throne / Crown / timeout / overtime | median 2:00-2:30; p90 < 3:00; timeout < 10% |
| Time-to-first-capture | first hut flip by either side | p50 10-20 s; > 30 s = dead opening |
| Lead changes | sign flips of lead score L = 0.5*hut share + 0.3*swarm share + 0.2*hero HP share, with a +-0.05 hysteresis band | median >= 2 per match |
| Comeback rate | P(win \| behind by >= 0.15 L at 60 s) | 20-35%; < 10% = snowball, > 45% = lead means nothing |
| Snowball index | corr(L at 60 s, outcome) | 0.3-0.6 |
| Degeneracy flags | no capture in 30 s (stalemate), hero idle %, kills per match, critter cap saturation time, stuck/NaN, camp-farming loops | any > threshold fails the build |
- Also log per-personality **"tell hit rate"** (how often a tell is followed by the announced action within lead time) so tells never lie, and **Director load** (intensity time series vs rival pushes).
- **Calibrate against humans**: compare bot metric distributions against real playtest telemetry (owner sessions); L4D's bots were designed to reproduce decisions players make, and used to assume a 4-player team for tuning [V]. UNVERIFIED how well rule bots track human comeback rates: expect a systematic gap and treat absolute values as *relative* comparisons between builds.

**Scripted player-bots as regression tests** (vitest, fixed seeds, checked-in baseline JSON; nightly big sweep, PR smoke)
1. `IdleBot` must lose to every personality by 2:30 (sanity).
2. `TurtleForever` (never leaves base) must not stall a match past timeout, and should lose to Bumble/Vex.
3. `ThroneRush` scripted path: must not win before 0:45 against Elite Pip (anti-rush guard).
4. `CrownCamp`: reach Crown at 1:30, hold 10 s; must be interruptible, win rate 20-40% vs Elite.
5. `SpamFire`: holds fire all match; must not beat Elite (guards hold-to-fire dominance).
6. `Monkey` (random inputs, 10k matches): no NaN, no negative counts, no throw, conservation of critters (spawned - dead = alive).
7. `Dash-abuse` / ability-loop bot for exploits.
Assertions are bands (e.g. "ThroneRush win-rate <= 10%"), not exact, and a drift > 5 pp vs baseline fails CI. Keep one Playwright e2e that boots the built page, runs 20 s of `Monkey` via the debug hook, and screenshots (the repo already has `playwright` and `tools/shot.mjs`).

## 6. Open risks
- Tell readability at a fixed tilted camera with 100+ critters is untested (diorama spike only).
- Cross-engine float determinism unverified; decide whether CI-only reproducibility is enough.
- Target bands above are priors; the first 30-50 human playtests should reset them.
- DDA "offer a tier change" UX untested; the owner ignored charms, so prompts may also be ignored.

## Sources
- F.E.A.R. (Orkin, GDC 2006): https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf , https://gdcvault.com/play/1013282/Three-States-and-a-Plan [V, PDF]
- Halo 2 AI (Isla, GDC 2005): https://www.gamedeveloper.com/programming/gdc-2005-proceeding-handling-complexity-in-the-i-halo-2-i-ai [V]; Halo 3 leadership: https://learn.microsoft.com/en-us/halo-master-chief-collection/h3/ai/leadership [V]; BT survey/pitfalls: https://www.gameaipro.com/GameAIPro3/GameAIPro3_Chapter09_Overcoming_Pitfalls_in_Behavior_Tree_Design.pdf [S, not read]
- Utility AI (Mark/Dill, GDC 2010): https://media.gdcvault.com/gdc10/slides/MarkDill_ImprovingAIUtilityTheory.pdf [V, PDF]; IAUS overview: https://www.gameai.com/iaus.php , https://www.gdcvault.com/play/1018040/Architecture-Tricks-Managing-Behaviors-in [S]
- Left 4 Dead (Booth, Valve 2009): https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf [V, PDF]
- DDA: https://www.gamedeveloper.com/design/more-than-meets-the-eye-the-secrets-of-dynamic-difficulty-adjustment [V]; https://www.gamedeveloper.com/design/game-changers-dynamic-difficulty [V]; Hamlet: https://users.cs.northwestern.edu/~hunicke/pubs/Hamlet.pdf [S]; RE4 rank: https://residentevil.fandom.com/wiki/Game_Rank_(RE4) [S]
- Vampire Survivors: https://vampire.survivors.wiki/w/Enemies [V]; Thronefall: https://www.gamedeveloper.com/design/mastering-minimalism-and-layering-complexity-with-strategy-game-thronefall [V]; Pikmin: https://www.pikminwiki.com/Bulborb [S]
- MOBA neutrals: https://www.pcgamesn.com/league-of-legends/league-of-legends-how-to-jungle [V]; boss beats: https://www.gamedeveloper.com/design/boss-battle-design-and-structure [V]
- Bots/balance: Riot LoR RL https://www.anyscale.com/blog/riot-games-and-deep-reinforcement-learning-in-gaming [V]; Ubisoft Roller Champions https://arxiv.org/pdf/2012.06031 [V, PDF]; Hearthstone meta https://arxiv.org/abs/1907.01623 [V, PDF]; autonomous-agent balance https://arxiv.org/pdf/2304.08699 [V, abstract only]; Dominion https://ojs.aaai.org/index.php/AAAI/article/download/21552/version/19839/21301 [S]
- Human-like bots: https://en.wikipedia.org/wiki/Computer_game_bot_Turing_test [S]; SC2 AI levels: https://liquipedia.net/starcraft2/Artificial_Intelligence [S]; Gaffer determinism: https://gafferongames.com/post/floating_point_determinism/ [S]; Clash Royale bots: https://www.esports.net/news/mobile-games/does-clash-royale-have-bots/ [S, UNVERIFIED]
