# Genre teardown: hero + crowd / minion-commander games (what gives depth vs shallowness)

Researched 2026-09-30. Evidence tags: [V] = read in a fetched page, [S] = search snippet or secondary summary only, UNVERIFIED = could not confirm.
Caveat: the fetch tool summarises pages with a small model, so figures marked [V] are as summarised, not verbatim quotes. Wikipedia and wiki pages are secondary. The "Proposal" items are my design inferences, not facts.

## Bottom line for Kingswarm

1. **The shallowness is not the meta layer, it is that there is one unit type and nothing to counter.** Slither/Agar-style decisions are "when to boost, chase or avoid, where to roam" (MDA analysis [V]). Crowd City is "touch white people" for 2 minutes with cosmetic-only skins [S]. Kingswarm today has 1 critter type and near-identical huts (only the Well and Crown differ; from kingswarm.html: 15 nodes, `critters` are one kind). Depth has to come from composition, not more stat charms.
2. **Add 4 critter types in a simple cycle plus 1 utility type, and make type come from the hut you hold, not from a menu.** Composition then becomes a map-control decision (walk to hut X) and stays on the single control layer (move + hold-to-fire). Details in "Proposal" below.
3. **Give the swarm-gun ammo identity.** Hold-to-fire is the part the owner loves, so types must change how the *firing* feels (fast stream, heavy slow shots, arcing splash, fast cappers). Do not add a second selection or command layer (the owner already rejected two layers; every good comparable below has exactly one).
4. **Add 3 map features that create decisions per minute:** (a) 1-2 chokepoints/gates on the routes between halves, (b) terrain that only certain types cross or fire over, (c) a neutral guarded objective (PvE camp) that rewards a specific type mix. Keep the Crown as the single high-value late objective.
5. **Comeback = structure, not rubber-banding.** Use (a) time-escalating tempo for both sides (Clash Royale double elixir at final minute), (b) reversible captures (Mushroom Wars 2: a captured building only drops one level; recapture within 1 s keeps it), (c) multiple ways to win (Clash Royale 3-star scoring: 1+1+3). Avoid rich-get-richer power-ups (Minion Masters' Mana Frenzy for the fully levelled master is an explicit snowball).
6. **Meta that works changes the decision space; stat tweaks do not.** What held players in these games: deck/squad composition (Clash Royale 8-card deck, Tooth and Tail 6 of 20 units, Bad North commanders), mastery challenges (Thronefall missions, 54 perks pick 5, 18 mutators), permadeath stakes (Bad North, Kingdom heir). Charms as passive % tweaks match none of these, which is consistent with the owner's "ignored charms".
7. **Run structure: 3-6 minute rounds strung into a 15-25 minute run with drafts between rounds** (Bad North islands ~5-6 min [V]; Clash Royale 3 min + overtime [V]; Thronefall maps 15-45 min [S]). Drafted upgrades should be *type-level rewrites* ("Bruisers now taunt"), i.e. Thronefall's "more depth in existing systems, not more breadth".
8. **Guard against the known failure modes:** cheapest unit dominates (Tooth and Tail T1 spam), bigger army always wins (T&T "preventative, little reactive play"), fortress stalemates (Mushroom Wars 2), sedate pacing (Kingdom), 1v1-only online dying for lack of population (Tooth and Tail: 5-6 concurrent players in 2025-26 [V, Steambase]). Ship a strong vs-AI and co-op/run mode first.

## 1. Why .io crowd games feel shallow (evidence)

- **Decision inventory is tiny and stateless.** Slither.io: continuous movement, boost with a size cost, eat, die-to-food. Decisions are boost timing, target choice, safe periphery vs dense centre [V: mechanicsofmagic.com MDA]. There is no composition, no build, no counter relationship, and no persistence after death: "once a game ends there is no any persistence" [V: gamedeveloper.com slither critique]. Bigger worms become targets with "no meaningful defense" [V].
- **Count Masters:** the core decision is gate arithmetic, "+10" vs "x2", a mental-maths test under pressure [S]. Every unit is identical, so outcome is a number comparison. Hyper-casual reports ~1.38% D30 retention [S: segwise.ai; secondary, low confidence], and reviewers blame ad frequency, not depth [S].
- **Crowd City (Voodoo):** 2-minute matches, absorb neutral pedestrians by touching them [S]. Its meta is one currency ("People") and cosmetic-only skins; a mission system whose "lack of depth and gameplay impact" limits it [V: adriancrook.com]. Its successor pattern (Mob Control) added cards, leagues, season pass and base timers, i.e. retention came from the *meta economy*, not deeper play [V]. That is the route the owner already found unsatisfying.
- **Diagnosis for Kingswarm:** you have hold-to-fire (a real skill verb) but the outcome of every fight is "more critters win". Add (1) unit identity, (2) counters, (3) places where position matters, then the stream of decisions changes from "roam and grow" to "read the opponent's mix and pick a fight".

## 2. Game-by-game teardown

**Pikmin 1-4 (Nintendo EAD)**
- Pikmin 1: 30-day limit, ~13 min/day, 25 mandatory ship parts of 30, max 100 Pikmin on field, 3 types [V: Wikipedia]. Director Hino: the direction clicked when he "first saw multiple Pikmin working together to carry a big opponent" [V]. The throw verb came from wanting to control a big group with the C-stick, then became grab-and-throw [S].
- Types are **capability keys, not stat sticks**: Red fire-immune/strong, Yellow thrown higher and electric-immune, Blue water-safe (P1); White fast + poison + digs, Purple ~10x carry strength + stun (P2); Rock breaks crystal, Winged flies (P3); Ice freezes, Glow night-only and invincible (P4) [S: Wikipedia, Inverse, Pikipedia]. Hazards decide which type you need.
- The field cap (100; Pikmin 4 starts at 20, +10 per Flarlic [V]) is deliberate: "players must rely on more than just having a large number of Pikmin" [V: Pikipedia]. Also a perf reason.
- **Dandori** = plan efficiently in advance; Miyamoto: the strength is irreversibility, "to prevent Pikmin from dying, you need to practice dandori" [S]. Pikmin 4 removed hard day limits and added Oatchi (a second controllable, "power of 10 Pikmin"), rewind and Glow types to lower the barrier [V: Nintendo Ask the Developer]. Note the control model is still hero + one squad + throw.
- **Lesson:** meaningful decisions come from *cost of losing units* + *task/hazard diversity*, not from unit count. Kingswarm critters respawn from huts for free, so a loss costs nothing; add stakes (e.g. Bruisers cost 3 cap and hurt to lose).

**Tooth and Tail (Pocketwatch, 2017)**
- Goal: "Hearthstone StarCraft"; "boiled [the genre] down to its components, and rebuilt it" [V: gamedeveloper.com]. Strategy and improvisation over click speed; most play uses 2 buttons; matches 5-12 min [V: Gamereactor, Steam]. A single commander carries the camera, moves, fights and builds, which removes camera control and selection; scouting is costly because you cannot scout, build and fight at once [V].
- Deck: pick 6 of 20 units (15 offence in 3 tiers by cost/time, 5 defences) before the match, no changes mid-match [V: Wikipedia]. Warrens look identical per tier, so opponents see the tier but not the unit: hidden information [V].
- Criticism: T1 spam (Squirrels + Lizards in nearly every game, T2 "situational", T3 Fox rare) [V: Steam discussion]; campaign difficulty spikes and AI advantage [V: Gamecritics, PC Gamer snippet]; the flag-bearer must be physically present to command, so units "sat passively" [V]; randomised resource placement can start unfair [V]; overall reliance on food where "a larger army can overwhelm a defending player" [S]. PC Gamer: selection limited to all units or all of one type [S]. Steam 82% positive of 1,760 (store) / 3,316 of 4,154 (Steambase), yet peak concurrent only 86 and ~5 now [V].
- **Lessons:** commander-with-banner is the closest analogue to Kingswarm and it worked as one layer. But cheap-swarm dominance and "bigger army wins" reappear if your default critter is the best value. Hidden information (visual tier tells) is cheap depth. 1v1 competitive-only content needs a population.

**Overlord (Triumph, 2007)**
- Four minion colours are role/capability keys: Brown melee and can pick up dropped gear, Red ranged fire (immune to fire), Green stealth/backstab and clear poison gas, Blue healers that revive minions and the only ones that swim [S: Wikipedia, Fandom]. Control: hold both mouse buttons and sweep to direct the swarm; the Overlord himself acts in third person [S].
- **Lesson:** four types with a distinct verb each is legible to a general audience; "sweep to direct" is the only swarm command layer.

**Right Click to Necromance (Juicy Beast, 48-hour jam, 2015)**
- You start with 5 swordsmen and right-click to raise fallen enemies into your army; difficulty escalates fast; huge YouTube pickup [S]. Design detail beyond that: UNVERIFIED (no primary retrospective found).
- **Lesson:** a single verb that turns the *opponent's losses into your growth* is a strong hook, but it is inherently snowballing; do not copy without a brake.

**Thronefall (Grizzly Games)**
- Day = build, night = defend. Player: hero on horse, auto-attack for accessibility with optional active weapons; no direct unit orders, so "focus solely on which buildings to build and in which order" [V: int-magazine, gamedeveloper.com]. Buildings snap to preset sites; removing free placement improved level design [V]. When players asked for more choices, the dev added "multiple variations of facility upgrades" (depth in existing systems, not breadth) [V].
- 315,000 units, >$1.5M gross, $7 EA price, 6.9% refunds, 35%+ played 5+ h [V: GameDiscover]. 10 hand-made maps of 15-45 min, 9 weapons, 54 perks (pick up to 5), 18 mutators [S: TheSixthAxis, others]. Criticisms: without mutators it is too easy; difficulty tuning inconsistent; one map let enemies run around a wall [S].
- **Lessons:** (1) removing controls (placement, unit orders) sharpened decisions; (2) the long tail was optional challenge layers (missions, mutators) that change how you play, not power progression; (3) layer complexity: the game "starts out simple but gets more and more complex" [V].

**Bad North (Plausible Concept, 2018)**
- Place squads on a tile grid; units choose their own attack timing so the sim hides complexity beneath light UI [V: Nintendo UK]. Islands take ~5-6 min [V]. Commander permadeath: soldiers are replaceable but a dead commander loses the squad and upgrades forever [V]. Chokepoints emerge from the discrete tile space; "placing your troops on a specific tile vs the one next to it is clearly understandable in the landscape" [V].
- Classes: Infantry (shielded, counters archers and axe-throwers), Pikemen (reach, hold lines), Archers (must thin waves) [S]. Metacritic 72 Switch / 74 PC / 65 Xbox [S]. Players complain the meta collapses to Infantry/Infantry/Pikemen/Archers and gets stale [S: Steam thread].
- **Lessons:** 3 classes + a clear terrain read = enough tactics for 5-6 minute rounds. Two-thirds of the value is *readable terrain*. Its weakness (few classes, one meta) is what drafted rewrites must fix.

**Mushroom Wars 2 (Zillion Whales, 2016)**
- Send a share of a hut's population to another node; buildings: Village (spawns), Tower (shoots, no spawn), Forge (boosts unit stats), plus Domination and King-of-the-Hill villages; Village/Tower/Forge convert into each other for 30 units and start at level 1; villages/towers upgrade 3 times at 20 units each [V: mw2.su, wiki]. Captured building drops one level; recapture within 1 s avoids the drop [V]. 8 heroes / 4 tribes with skills [V: Wikipedia].
- Criticism: "play can grow tedious," fortress stalemates and attrition wars over one tower [V: Tech-Gaming, 76%]. Metacritic 76 PC / 72 Switch [S].
- **Lessons:** hut *roles* (spawn vs turret vs buff) make one map rich; the conversion trade (spend units to change a hut's job) is a great single-tap decision. Stalemates come from defender advantage without a forcing objective; the Crown timer is that forcing device.

**Clash Royale (Supercell)**
- 3-minute match; elixir 1 per 2.8 s, 1.4 s in the final minute (double), ~0.93 s in overtime (triple); 3 towers (2x1 star, King 3 stars); overtime first tower wins [S: fandom/wiki, Wikipedia; V: gamedeveloper.com]. 8-card deck, 4 in hand, 5th shown [V]. Counters are rock-paper-scissors plus targeting priorities (Giant ignores troops; Skeleton Army splits defence; splash beats swarm; archers hit air) [V].
- Decision rhythm: often no card is played "for around 15 seconds" while both wait, so the real decision is *when not to act* [V: Three days with Clash Royale]. Meta hooks: chests every 3-4 h and daily, new arena at 20 trophies [V], i.e. the meta wraps a mechanically deep 3-minute core.
- **Lessons:** waiting/baiting is a decision; give Kingswarm a resource or cooldown that makes "hold fire, flank, or commit" real. Scoring structure gives comeback paths. The classic cycle (swarm > tank > splash/ranged > swarm) works with 3 units.

**Minion Masters (BetaDwarf)**
- 1v1 lane-ish tower battle; 4 cards in hand, mana regenerates; the master levels during battle and, when fully levelled, gains Mana Frenzy (much faster casting), described as "game-deciding" [S: Google Play/preview reviews]. Deeper mechanics UNVERIFIED (wiki fetch blocked).
- **Lesson:** a mid-match power spike gives a clear goal but is a snowball; if used, make it contestable (take the well) and short.

**Fat Princess (Titan Studios, 2009)**
- CTF twist: feed the enemy-held princess cake so she is heavier to carry; 6 classes (Villager, Worker, Priest, Ranger, Mage, Warrior), 16v16; hat-based visual class ID; minimal UI [V: gamedeveloper.com, Wikipedia]. Design intent: paper-scissors-stone, team synergy (warrior + 2 priests = "indestructobot"), and counters that flip a lock-out ("one chicken bomb and the whole enemy team are chickens") [V].
- A.V. Club criticism: results tend to be "quick decisions between teams of unmatched skill, or long slogs" [V: Wikipedia summary], i.e. snowball without a comeback valve. Metacritic 79 PS3 [S].
- **Lessons:** one objective mechanic with a public, visible state (princess weight) creates constant micro-decisions; a "chicken bomb" style cheap counter-tool stops lock-outs; instantly readable class silhouettes.

**Castle Crashers (The Behemoth, 2008)**
- 4-player co-op beat-em-up; small RPG layer (Strength/Magic/Defense/Agility), unlockable characters, weapons and animal orbs per player [S: Wikipedia, wikis]. No primary design retrospective found; why it replays is UNVERIFIED.
- **Lesson (weak evidence):** the pull is co-op + collection of characters with distinct play, more than stat depth. This supports character/type variety over % charms.

**Kingdom Two Crowns (Noio / Licorice)**
- One-button "pay" verb plus movement; physical coin purse (no numbers) that also acts as health, spills when full [V: gamedeveloper.com, S]. Roguelike runs auto-scale from too easy to too hard; two-crown version adds heir/"decay" so failure keeps most structures [V]. Units: archers, builders, farmers, knights [V]. Sales >300,000 in six months [V: Wikipedia]. Criticism: sedate pacing, frustrating rebuild phases, lack of direct villager command, co-op undermines tension [V].
- **Lessons:** one verb can carry a full strategy game if every decision is *spatial + economic*; a visible, physical resource beats a number; failure that preserves progress (heir) beats hard reset.

## 3. Cross-cutting patterns

**Meaningful decisions per minute (analyst estimates, not measured):** Clash Royale ~4-8 plays/min with deliberate 15 s pauses [V]; Bad North ~3-6 placements per 5-6 min island [V]; Thronefall ~1-3 build picks/min in the day phase [S]; Pikmin ~ continuous task allocation over 13 min days [V]; Tooth and Tail 5-12 min with flag movement plus warren builds [V]. Pattern: the deeper games have **few decisions per minute, each with visible consequences and irreversible cost**. Shallow games have many reflex inputs and no irreversible choices. Target for Kingswarm: 4-6 real decisions per 150 s (which hut, when to commit the swarm, whether to contest Crown, when to convert a hut).

**Rock-paper-scissors kept simple:** 3 units in a cycle plus targeting rules (Clash Royale), 3 classes plus terrain (Bad North), 4 capability colours (Overlord), 3 base classes with support (Fat Princess). Rules that keep it legible: distinct silhouette/colour per type (Fat Princess hats, Thronefall outlines [V]), each type has one clear job, and the *counter is a different type, not a bigger number*.

**Map features that create tactics:** chokepoints from discrete tiles (Bad North [V]); building roles/conversion (Mushroom Wars 2 [V]); high-value single objectives (Domination/King-of-the-Hill villages in MW2 [V]; Kingdom's Greed portal; Kingswarm's Crown); hazards that key unit types (Pikmin water/fire/electric [S]); hidden info (T&T warrens [V]).

**Comeback:** time-escalation for both sides (CR double/triple elixir), multi-target scoring (CR 1+1+3 stars), reversible captures (MW2), cheap disrupting tools (Fat Princess chicken bomb), inherited failure (Kingdom heir). Snowball examples to avoid: Mana Frenzy, corpse-raising, "bigger army wins" (T&T).

**One control layer:** Pikmin (move + throw + group whistle; Oatchi is the only real added layer [V]); Tooth and Tail (2 buttons, commander carries camera [V]); Thronefall (move + auto-attack, build order only [V]); Bad North (place squads, they self-time [V]); Kingdom (move + pay [V]); Clash Royale (drag one card); Overlord (sweep command); Fat Princess (swap class by hat). None ask the player to command units *and* use hero abilities at once.

## Proposal: 4 critter types + 1 utility, and map features (least complexity, most depth)

All numbers are starting points to playtest, not evidence-backed values. Type is set by **hut type** (visible shape/colour); a hut spawns only its type; the swarm mix = the huts you hold. Firing sends whatever is in the swarm, each with its own projectile behaviour.
1. **Biter** (default hut, cheap, 1 cap): fast stream, low damage each. Wins by mass and DPS vs Bruisers. Loses to Lobber splash.
2. **Bruiser** (2-3 cap): slow heavy shot that punches through and soaks; beats Lobbers by reaching and absorbing them; loses to Biter swarms melting it.
3. **Lobber** (1-2 cap): arcing splash that clears Biter clumps and can fire *over* walls; fragile and slow; loses to Bruisers reaching them.
   Cycle: Biter > Bruiser > Lobber > Biter (Clash Royale swarm/tank/splash logic [V]).
4. **Runner/Sapper** (utility, off-cycle): fast, captures huts ~2-3x quicker and cracks turrets, dies to anything. Gives raiding and a reason to fear flank.
   (Optional 5th later: **Warden/Healer** in the Overlord-Blue or Fat Princess-Priest role. Skip until 1-4 are tuned.)
- **Hut/keys, not menus:** the Well (fast spawn) and Crown stay; add hut variants per type; let a hut convert type for a small cap cost (MW2's 30-unit conversion [V]) = the single-tap "re-tool" decision.
- **Map feature A, chokepoints/gates:** 1-2 narrow passes between halves; Lobbers/Bruisers dominate them, Biters flood around; creates fights *at places*.
- **Map feature B, terrain that keys types:** a river/ravine that only Runners cross fast, walls Lobbers fire over, a fire/thorn patch that damages non-Bruisers (Pikmin-style capability gates [S]).
- **Map feature C, neutral guarded objective:** a mid-map camp/beast that a Bruiser-heavy mix clears to reveal a temporary bonus (extra cap or a free hut). Gives dandori-style planning and a PvE puzzle for co-op/vs-AI runs.
- **Keep** the Crown at 1:30 as the forcing objective (kills stalemates); add tempo escalation (spawn rate up for both sides at 1:00, like double elixir).
- **Run-draft (between rounds):** offer 3 type-level rewrites (e.g. "Biters split in two on death", "Lobber shots leave a burning patch", "Bruisers taunt nearby Lobbers"), 1 pick per round, run of 3-5 rounds. This is Thronefall-style variants in existing systems [V].

## Pitfalls to avoid (with source)
- Cheapest type dominates all matches (T&T Squirrel/Lizard spam [V]): give Biters a hard counter and a real cap cost.
- "Bigger army wins" with no reactive answer (T&T [S]): keep defender tools (turrets, chokepoints) and one cheap disrupt.
- Adding a second control layer to make types matter (owner already said no; Pikmin 4's Oatchi is the only precedent and it came with rewind/assist to compensate [V]).
- Passive % meta (charms) and login-style quests (Crowd City missions "lack depth and gameplay impact" [V]).
- Stalemate turtling (Mushroom Wars 2 [V]) and sedate pacing (Kingdom [V]).
- Difficulty that is trivial without opt-in mutators (Thronefall [S]); design AI tiers, not only mutators.
- Snowball rewards (Mana Frenzy [S], corpse-raising [S], Fat Princess long slogs [V]).
- Online-only competitive with no AI/co-op fallback (T&T population [V]).

## Sources
- https://www.gamedeveloper.com/design/crafting-i-tooth-tail-i-a-gamepad-rts-that-aims-to-i-hearthstone-starcraft-i-
- https://www.gamereactor.eu/andy-schatz-on-tooth-and-tail/ ; https://heavymag.com.au/fighting-tooth-nail-pocketwatch-ceo-andy-schatz/
- https://en.wikipedia.org/wiki/Tooth_and_Tail ; https://gamecritics.com/brad-gallaway/tooth-and-tail-review/ ; https://steamcommunity.com/app/286000/discussions/0/2765630416811619948 ; https://steambase.io/games/tooth-and-tail ; https://store.steampowered.com/app/286000/Tooth_and_Tail/
- https://en.wikipedia.org/wiki/Pikmin_(video_game) ; https://www.pikminwiki.com/Pikmin_limit ; https://www.nintendo.com/en-za/News/2023/July/Ask-the-Developer-Vol-10-Pikmin-4-Chapter-2-2416062.html ; https://www.siliconera.com/pikmin-4-developer-interview-explains-the-concept-of-dandori/ ; https://www.inverse.com/gaming/pikmin-4-find-get-red-yellow-ice-blue-purple-rock-winged-glow-white
- https://www.gamedeveloper.com/design/mastering-minimalism-and-layering-complexity-with-strategy-game-thronefall ; https://newsletter.gamediscover.co/p/deep-dive-how-thronefall-went-minimal ; https://int-magazine.com/interview/paul-schnepf-of-thronefall/ ; https://www.thesixthaxis.com/2023/08/03/thronefall-review/
- https://www.nintendo.com/en-gb/News/2018/April/Interview-Taking-on-hordes-of-invading-Vikings-in-Bad-North-1368315.html ; https://en.wikipedia.org/wiki/Bad_North
- https://mw2.su/en/physics_en/buildings/ ; https://www.tech-gaming.com/mushroom-wars-2/ ; https://en.wikipedia.org/wiki/Mushroom_Wars_2
- https://www.gamedeveloper.com/design/three-days-with-clash-royale ; https://www.gamedeveloper.com/design/breaking-down-supercell-s-next-hit-clash-royale ; https://clashroyale.fandom.com/wiki/Elixir (search snippet; page fetch blocked)
- https://gamedeveloper.com/pc/interview-why-it-s-what-s-inside-i-fat-princess-i-that-counts ; https://en.wikipedia.org/wiki/Fat_Princess
- https://www.gamedeveloper.com/design/-i-kingdom-two-crowns-i-and-the-practical-intersection-of-pixel-art-and-roguelike-design ; https://en.wikipedia.org/wiki/Kingdom_Two_Crowns
- https://mechanicsofmagic.com/2022/04/11/mda-slither-io/ ; https://www.gamedeveloper.com/design/what-can-teach-us-slither-io-about-game-design-and-what-would-i-change- ; https://adriancrook.com/how-to-build-engaging-economies-in-hybridcasual-games-lessons-from-crowd-city-and-mob-control/ ; https://www.brsoftech.com/blog/why-voodoo-is-best-hyper-casual-game-company/
- Snippet-only: https://overlord.fandom.com/wiki/Minion ; https://minionmasters.fandom.com/wiki/Minion_Masters ; https://juicybeast.itch.io/right-click-to-necromance ; https://en.wikipedia.org/wiki/Castle_Crashers ; https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies

## Not verified / gaps
- Minion Masters, Right Click to Necromance and Castle Crashers: no primary design retrospective found; claims are from store/wiki snippets.
- Count Masters/Crowd City retention numbers: no primary data; the D30 1.38% is a vendor blog average for hyper-casual, not for these titles.
- Clash Royale elixir/overtime numbers came from search snippets (wiki fetch returned 402); overtime rules have changed over versions, so check the current patch.
- Pikmin 3 day count (3-4) and Pikmin 4 "no time limit" are as summarised from Nintendo's interview page; not re-checked against the game.
- Decisions-per-minute figures are my estimates.
