# Kingswarm — Game Design Document (v1.0 rebuild)

Single source of design truth. Evidence lives in `design/research/*.md`. Numbers are starting values; bot sims and playtests tune them, and the tuned values live in `src/sim/tuning.ts` (code wins over this file for numbers, this file wins for intent).

## 1. The game in one breath

**Your swarm is your gun.** You are a tiny King on a diorama island. A crowd of critters follows you; hold fire and you hose them, one after another, at whatever you point at. Where they land they bite, guard and capture. Win a 2-minute battle against a rival King, draft a Mutation that rewrites how your swarm behaves, and climb a ladder of five rivals to the Crown. Fifteen minutes a run, a different swarm every time.

Audience: people who love Clash Royale, Castle Crashers, Pikmin, Plants vs Zombies, 2-player browser games. Plays instantly in a browser; keyboard + mouse, gamepad, later touch.

## 2. Pillars (every feature must serve one; anything else is bloat)

1. **One control layer.** Move, aim, hold to fire, recall, dash, two abilities. Never unit selection, build menus or a second command mode. (Owner playtest: two layers = "too complex, not fun".)
2. **Every battle asks a question.** Each rival King is a readable character with a gimmick and a counter, Punch-Out style. Buildings have roles. "More critters wins" is never the whole answer.
3. **Every run builds a different swarm.** Draft 1 of 3 Mutations after each win. Mutations change behaviour and combine; they never read "+x%".
4. **Readable chaos.** 100 units on screen and you always know where your King is, what is yours, what hurts. Clarity beats spectacle.
5. **A juicy toy.** Firing the swarm must feel great with nothing at stake: arcs, splats, squash, sound. Real audio, never beeps.
6. **Instant.** Click to playing in under 10 seconds. Battles 1.5 to 2.5 minutes. A run is 12 to 15 minutes. Restart in one click.

**Bloat guard — out of scope for 1.0:** currencies, shops, stat-grind, daily quests, login rewards, chests, trophies-only ladders, unit selection, tech trees, accounts, chat, more than two sides in a battle.

## 3. Battle rules

World units: 1 unit ≈ a critter's arm span; a King is ~1.1 wide; the arena is 32 × 18, fully visible from a fixed tilted camera. Two teams: Blue (you, bottom-left Throne) and Red (rival, top-right Throne). Maps are point-symmetric.

### 3.1 The King
- Moves with acceleration (snappy: reaches top speed in ~0.1 s, stops in ~0.08 s). Dash: short burst, brief invulnerability, ~2.2 s cooldown.
- Has HP; regenerates slowly after 3 s without damage. At 0 HP the King falls: respawns at his Throne after 5 s, his followers go idle where they stand, and the rival gains **Rampage** (8 s: faster move, faster cooldowns).
- Auto-swings at enemy critters that touch him (weak; the swarm is the weapon).
- Two abilities on cooldown (Ability, Ultimate), defined per hero (§5).

### 3.2 The swarm gun
- Critters hatch at your buildings and run to you; they **follow** in a loose crowd.
- **Hold fire:** every 0.13 s up to 3 followers are thrown at the aim point (range-clamped), flying in an arc for 0.3–0.7 s. Out of followers = out of ammo.
- **Landing:** a small splash damages and knocks back enemy critters, and hurts the rival King if it lands on him. Then the critter stays where it landed:
  - on or next to a building → it **garrisons** there (guards, captures, stays until recalled or dead);
  - in the open → it **holds** for ~2.5 s, fighting anything near, then runs back to you (the ammo loop).
- **Recall** (whistle): every critter of yours that is not in the air runs back to you.
- Critters fight in melee on their own. A critter has 3 HP and bites for 1.

### 3.3 Buildings
| Building | Role |
|---|---|
| **Throne** | Your home. Hatches critters fast. Your King respawns here. If the rival captures it you lose. |
| **Hut** | Hatches critters slowly and raises your swarm cap. The economy. |
| **Tower** | Hatches nothing. Shoots enemy critters and Kings in range. A defended zone to go around, out-range or siege. (Introduced by the second rival, not in battle 1.) |
| **The Crown** | Centre of the map. Before it opens it is a **Well** (neutral fast hatchery, worth holding). When it opens it is the win objective. |

- **Capture by presence:** a building's ring fills for the only team standing on it (critters and the King both count). Contested = frozen. Owned buildings must first be drained, and flip with a partial ring (so a quick recapture is possible: reversible captures are the comeback valve).
- Swarm cap = base + per Hut held. Hatch intervals differ per building type.

### 3.4 Match arc and winning
- **Open phase:** expand, skirmish, duel.
- **Crown opens** (at 60 s remaining by default; earlier in early-ladder battles so they run shorter): hold the Crown alone for 10 s cumulative-with-decay to win outright. At the same moment **Frenzy** starts: both sides hatch twice as fast. This is the forcing climax that kills stalemates.
- **Win:** capture the rival Throne, or hold the Crown, or hold more buildings when time runs out. Tie at time-out → overtime: next capture wins.
- Target mix of endings across bot sims: Throne 30–45%, Crown 35–50%, time-out under 20%. Target lead changes per battle ≥ 1 in most matches.

## 4. Mutations (the one content system)

A Mutation is a rule rewrite attached to a team. The same system powers: the player's drafted build, each rival's identity, ladder difficulty (rivals gain Mutations), and Versus drafts. Each has a tag; **Duo** Mutations are only offered once you own both tags. Mutated critters look different so a build is visible on the battlefield.

Tags: **Boom** (explosions, area), **Brood** (numbers, economy), **Bite** (what a hit does), **King** (your hero).

| Mutation | Tag | Rewrite |
|---|---|---|
| Bombers | Boom | 1 in 4 of your critters hatches as a Bomber: explodes where it lands, big splash, then it is gone. |
| Shockwave | Boom | Every landing knocks enemies away hard and briefly stuns them. |
| Scorch | Boom | Landings leave a burning patch for 3 s that hurts enemy critters standing in it. |
| Splitters | Brood | When one of your critters dies it splits into two Runts (1 HP, half bite, cannot split). |
| Boomtown | Brood | Your buildings hatch 60% faster while you hold fewer buildings than the rival. |
| Militia | Brood | A building you capture instantly gains 3 free guards; your garrisons bite twice as hard. |
| Big Litter | Brood | +10 swarm cap and you start each battle with a full swarm. |
| Brutes | Brood | Your critters are Brutes: bigger, 3× HP, slower, heavy landings; your swarm cap is halved. |
| Leeches | Bite | Every hit on the rival King heals you. |
| Frostbite | Bite | Landings chill: enemies are slowed for 2 s (Kings less so). |
| Piercers | Bite | Thrown critters fly flat and fast in a line, hitting every enemy along the path instead of arcing. |
| Homing | Bite | Thrown critters curve toward the nearest enemy close to where you aimed. |
| Archer Huts | King | Your Huts and Throne shoot arrows at enemies near them. |
| Trample | King | Your dash crushes enemy critters in its path and recharges 40% faster. |
| Royal Guard | King | 5 Guards never leave your side and are never fired; they intercept attackers. |
| Rapid Fire | King | You fire 60% faster with a wider spread. |
| Long Arm | King | +40% throw range and faster flight. |
| Second Wind | King | Once per battle, instead of falling you burst in a shockwave and heal to half. |
| **Duo** Chain Reaction | Boom+Brood | Runts explode when they die. |
| **Duo** Cryo Bombs | Boom+Bite | Bomber explosions freeze everything they hit for 1 s. |
| **Duo** Conscription | Brood+King | When the rival King falls, his nearby critters join you. |
| **Duo** Bloodrage | Bite+King | Rampage lasts until you are hit 3 times. |

Rules: 3 options per draft, no duplicates of owned Mutations, 1 reroll per run, max 5 Mutations + the hero's own. Draft options are biased so at least one counters the next rival's gimmick (the player sees who is next).

## 5. Heroes

Three, each a playstyle. All share move/dash/fire/recall.
- **Brawler** — *Stomp* (crush everything around you) · *Kingscall* (summon a wave of critters, heal). The default; teaches commitment.
- **Blink** — *Blink* (teleport with your followers toward the aim point) · *Vortex* (drag enemies to a point, stun). Fragile, mobile.
- **Warden** — *Turret* (plant a thorn turret that shoots for 12 s) · *Rampart* (shield + heal). Slow, holds ground.

## 6. Rival Kings (the ladder)

Each rival = hero + signature Mutations + AI personality + arena layout + voice (barks shown as speech bubbles). The AI plays through the same input struct as a human, with human-like limits (reaction delay, aim error), so it can never cheat and bots double as testers.

| # | Rival | Hero | Signature | Personality / the question it asks |
|---|---|---|---|---|
| 1 | **Bumble the Meek** | Brawler | none | Dawdles, forgets to recall. The tutorial: can you capture and fire? |
| 2 | **Pip the Tinkerer** | Warden | Archer Huts; arena has Towers | Turtle. Can you siege: out-range, flank, bait the turret? |
| 3 | **Mother Brood** | Brawler | Splitters, Big Litter | Floods the map. Do you have area damage and do you hold the Well? |
| 4 | **Gorm the Glutton** | Brawler | Brutes | Rusher; marches on your Throne. Can you defend, kite and focus? |
| 5 | **Queen Sable** | Blink | Homing, Frostbite | Assassin; hunts your King. Can you dodge and keep a guard? |
| Boss | **King Mora the Crowned** | Warden | Royal Guard, Bombers, Second Wind | Two phases: turtles, then storms the Crown. Everything you learned. |

A run = 5 battles: rivals 1–4 in rising order (after the first clear, order and arenas vary) then the Boss. Battle length ramps: Crown opens at 0:45 of a 1:45 battle for the first rival, up to 1:30 of 2:30 for the Boss.

## 7. The run (Conquest)

1. **Start:** pick a hero → battle 1 immediately (first-ever launch drops straight into a guided battle 1).
2. **After each win:** draft 1 of 3 Mutations, see the next rival and their gimmick, go.
3. **Lives:** 2 Crowns. A lost battle costs one and you rematch the same rival. Zero = run over.
4. **End screen (win or lose):** your build, the near-miss facts ("Crown held 8.4 of 10 s", "Throne at 9%"), what you unlocked, one button: **New run**.
5. **Unlocks are options, never power:** the first ten runs each unlock something (a Mutation enters the pool, a hero, a rival variant). Afterwards: **Crown Levels** 1–8, sequential per hero, each adding something felt (rivals gain a Mutation, elite rematch, shorter Crown timer, two-phase early rivals).
6. **Codex:** discovered Mutations, Duo recipes (hidden until found), rivals beaten per hero and Crown Level. The collection is the long-tail goal.
7. **Assist (toggle):** after each lost run, hatch rate +5% up to +30%; resets on a win. Never locks content.

## 8. Versus (after the run is fun)

Couch 2-player, vs-AI quick battle, online by invite link (host-authoritative, see `design/research/netcode.md`). Symmetric: both players draft from the same offered Mutations, best of 3. No meta power crosses into Versus.

## 9. Presentation

- **Look:** low-poly toy diorama island in a sea, warm sun, soft shadows, chunky outlined units, saturated team colours (blue/red with colour-blind-safe shape cues), Kings with crowns and capes. Fixed camera, whole arena visible at 16:9; letterbox gracefully.
- **Feel:** squash and stretch on every hop and landing, hit-stop on big moments only, restrained shake with a settings toggle, particles that read at a glance. Values: `design/research/game-feel.md`.
- **Audio:** sampled SFX with pitch variation, a layered music track that intensifies when the Crown opens, short stingers for capture / King down / victory. Master, music and SFX volume; mute. 
- **UI:** DOM overlay. HUD shows only: timer + Crown bar, building counts, your swarm (with you / away / cap), ability cooldowns, rival ability tells. Everything else is diegetic (capture rings, HP bars on Kings).

## 10. Milestones

- **M1 — The Toy:** deterministic sim + diorama renderer + feel + audio; one polished battle vs an AI rival, keyboard/mouse + gamepad. Gate: firing is a joy in screenshots/video review and bot metrics hit §3.4 targets.
- **M2 — The Run:** Mutations, the six rivals, draft and ladder UI, lives, end screens, unlocks, codex, onboarding, settings/pause.
- **M3 — Ship:** Versus (couch, vs-AI, online), touch controls, bundle under 5 MB initial, accessibility, deploy to the public URL.
- **M4 — Playtest loops:** balance by bot sims, critique by fresh-eyes reviewers, fix, repeat until it is genuinely fun.
