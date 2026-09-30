# Netcode research: browser P2P 1v1 (later 2v2), ~300 units, invite-by-link, no paid backend

Researched 2026-09-30. Tags: [V] = read on the primary page this session, [S] = secondary or search-summary only, [M] = measured or computed by me, [UNVERIFIED] = could not confirm.

## Bottom line for Kingswarm

- Keep host-authoritative snapshots + interpolation for v1 and for 2v2 (star topology, host in the middle). Do NOT switch to lockstep or rollback now. Lockstep adds input delay to hero WASD/dash, which is the wrong trade for an action hero (AoE tolerated 250 ms only because it is an RTS). Rollback resimulation of 300 units plus AI is a CPU risk on phones/low-end laptops (section 1).
- The prototype's snapshot is the real problem, not the architecture. It sends 300 critters as JSON arrays: 6.6 KB per snapshot, about 790 kbps at 15 Hz [M]. A quantized binary delta is about 25-75 kbps at 15-20 Hz [M, assumptions in section 2]. That is a 10-30x cut and makes TURN relay affordable.
- Interpolate 3 send intervals behind (150 ms at 20 Hz), not 1. Gaffer's rule is 3x the send interval so two consecutive lost packets still leave data to interpolate toward [V]. The prototype's `dtSnap` scheme is effectively 1 snapshot behind and stutters on any loss.
- Predict only the guest's own hero (move/dash), reconcile by replaying unacknowledged inputs against each snapshot. Never predict the swarm. Render the guest's own followers with a decaying offset so they do not lag visibly behind a predicted hero (my design inference, section 3).
- Add TURN before launch. STUN-only fails roughly 10-20% of pairs by the only numbers I could source (2015-16 callstats.io: 22% needed relay, 12% failed overall [V]), and school/corporate Wi-Fi that blocks UDP is likely for this audience. Use Cloudflare Realtime TURN (1,000 GB/month free, then $0.05/GB [V]) with credentials minted by a tiny Cloudflare Worker, never a key in the static page. Fallback: Metered free plan (key embedded, hard-capped quota).
- Signaling: keep PeerJS Cloud only as a stopgap. It is alive (status 200 OK today) but has no SLA, 203 open issues, and its last release was 2025-06-07 [V]. Its `reliable:false` is only "unordered", not lossy (section 4). Plan a move to native RTCPeerConnection + a ~100-line Worker/Durable Object signaling room (free tier), or Trystero (v0.25.4, released 2026-08-30, active [V]) if you never want to run anything.
- Make the simulation a deterministic fixed-step pure function from day one (list in section 8) even though v1 ships snapshots. It costs almost nothing now and keeps rollback, lockstep, replays, spectating, and a 3D-diorama renderer with interpolation all open.
- Forbid `Math.sin/cos/pow/exp/atan2/hypot` and `**` in sim code. The ECMAScript spec marks them implementation-approximated [V]; only `+ - * /` and `Math.sqrt` are exact.
- Defer: rollback, lockstep, dedicated authoritative server, WebTransport (client-server only, no P2P), matchmaking, reconnect, anti-cheat.

## 1. Architecture comparison for 300 units in JS

| | Host-authoritative snapshot + interp | Deterministic lockstep | Rollback (GGPO-style) |
|---|---|---|---|
| Bandwidth | State-dependent, 25-75 kbps quantized [M] | Inputs only; "one million objects with the same bandwidth as one" [V Gaffer] | Inputs only |
| Own-hero latency | ~0 with prediction | Input delay = latency, ~100 ms buffer typical [V Gaffer] | ~0 (3 frames delay is the example [V SnapNet]) |
| Sim determinism needed | No (host is truth) | Bitwise, cross-browser | Bitwise, cross-browser, plus save/restore of full state |
| CPU | Host runs sim; guest only interpolates | All run sim once | Resim up to 15 frames in one frame budget, ~1.1 ms per resim frame at 60 Hz [V SnapNet] |
| Failure mode | Host advantage (~RTT/2 + interp delay), host quitting ends match | Desync (hard to debug: AoE said desyncs were their hardest bug [V]); slowest peer stalls everyone | Spiral of death; mispredicted 300-unit states visibly pop |
| 2v2 | Star: host uploads 3 streams, ~150 kbps | Waits on slowest of 4; SnapNet cites ~57% of 8-player games hit a laggy peer [V] | Same plus 4-way input prediction |
| Existence proof | Prototype v0.5 | AoE 1500 archers on 28.8k, 200 ms turns, 250 ms latency imperceptible [V]; Shards of Stone browser RTS, 12,000 ticks byte-identical on Chromium/Firefox/WebKit [V] | Telegraph (JS GGPO port) exists [S]; no 300-unit browser example found |

- My microbenchmark [M]: a toy 300-unit sim (spatial hash, separation, steering, typed arrays, Node 22/V8) costs 0.38 ms per tick; typed-array state save costs under 1 microsecond. 6-tick resim = 2.3 ms, 12-tick = 4.5 ms. The real sim (hero, AI, projectiles, hut logic) will be several times heavier and phones 3-5x slower, so budget 10-20 ms of a 33 ms tick. Feasible on desktop, tight on mobile. Re-measure with the real sim before committing.
- Rollback needs low latency: SnapNet says 100-150 ms prediction windows "tend to get unplayable quickly" for rollback [V]. Browser P2P across continents often exceeds that, and snapshot+prediction degrades more gracefully.
- Verdict: snapshot for the swarm, prediction for the hero. If a later mode wants 2v2 at 100+ units per side or replays, revisit lockstep for the swarm only.

## 2. Bandwidth math for 300 units [M]

Prototype measured: 300 critters as `[id,x,y,owner,state,stun,fly]` JSON = 6,596 B, 792 kbps at 15 Hz. PeerJS default serialization is BinaryPack, so the wire size is probably 30-40% lower [UNVERIFIED], still about 500 kbps.

Proposed encoding (assumptions, not measured on a real sim):
- Unit ids are stable slot indices, so no id per unit. Position quantized to 12+11 bits (arena about 2000x1000 at ~0.5 px), owner 1 bit, state 3 bits, stun 1 bit = 28 bits, 3.5 B per unit.
- Full keyframe: 300 x 3.5 = 1,050 B, so 126 kbps at 15 Hz, 168 kbps at 20 Hz. It fits one 1,200 B datagram, which matters because a fragmented unreliable message is lost if any fragment is lost [V SnapNet].
- Delta vs last acked snapshot: 1 dirty bit per unit + 14 bits per moving unit (6-bit dx/dy deltas plus state-change flag).

| moving fraction | bytes/snapshot | 15 Hz | 20 Hz |
|---|---|---|---|
| 30% | 207 | 25 kbps | 33 kbps |
| 50% | 312 | 37 kbps | 50 kbps |
| 80% | 470 | 56 kbps | 75 kbps |

- Add ~60 B per packet for UDP/DTLS/SCTP headers, about 10 kbps at 20 Hz. Guest to host inputs at 30 Hz, about 12 B each, are under 5 kbps.
- Gaffer's cube demo is the calibration: 17.37 Mbps raw down to 256 kbps through smallest-three quaternion, 512 values/meter position quantization, and delta vs acked baselines, with unchanged objects costing 1 bit [V]. Our 2D units are far cheaper than 3D cubes with orientation. He also uses a priority accumulator so important objects (hero, fighting units) update more often [V].
- Keep keyframes every ~1 s (or on ack loss) so a dropped delta chain self-heals. Send hero, huts, crown, and events on a separate reliable ordered channel.
- Relay cost per match at ~55 kbps for 150 s is about 1 MB. Cloudflare's 1,000 GB free covers about a million fully relayed matches. Metered's 20 GB (if you get it) covers about 20k. The current JSON snapshot (15 MB per match) would cover only about 1,300 matches on Metered.

## 3. Client-side prediction for the guest's hero

- Standard method: number each input, keep unacked inputs, on each snapshot set hero to the authoritative state and replay unacked inputs [V Gambetta]. It requires the movement step to be deterministic given state + input, easy for a hero moving against static walls.
- Kingswarm specifics (my inference from the prototype code): hero movement is `moveHero` plus dash, independent of the swarm, so it can be extracted as a pure function shared by host and guest. Send input at 30 Hz with `seq`, move vector, aim point, fire flag (the prototype already does most of this in `guestTick`). Snap if error exceeds a threshold (the prototype uses 260 px), otherwise smooth-correct over ~100 ms.
- Predicted hero vs interpolated swarm creates a visible gap: your hero is at t+RTT/2 while its followers are at t-150 ms. Fix: for critters in `follow` state, render at `snapshotPos + (predictedHero - interpolatedHero)` and decay the offset as the critter leaves follow state.
- Firing ("the swarm is your gun") is host-resolved. On mouse-down the guest can spawn cosmetic tracer/launch effects instantly, then swap to authoritative critters when snapshots arrive. Do not let the guest decide hits.
- Remote input prediction (for the host, when guest input packets are late): repeat last input, optionally with decay over a few ticks [V SnapNet].
- Host advantage is inherent to peer-hosted authority (host has zero latency on its own hero). Acceptable for casual 1v1; a dedicated server (section 8) is the only real fix.

## 4. Transport and signaling options

| Option | Status (verified 2026-09-30) | Fit |
|---|---|---|
| PeerJS 1.5.5 | Last npm release 2025-06-07; repo pushed 2026-02-27; 203 open issues [V, npm + GitHub API]. Cloud status page reported 200 OK [S]. Docs say to self-host for significant traffic and warn of shared-namespace ID collisions [V] | Fine for prototype. `reliable:false` maps to `createDataChannel({ordered:false})` with NO `maxRetransmits`, so stale snapshots are still retransmitted (PeerJS `negotiator.ts` tag v1.5.5 [V]) |
| Trystero 0.25.4 | Released 2026-08-30; pushed 2026-09-27; 13 open issues [V]. Signaling over Nostr/MQTT/BitTorrent/Firebase/Supabase, no server of yours; `turnConfig`/`rtcConfig` supported [V] | Zero-ops invite-by-room-name. Depends on third-party public relays; reliability of those is [UNVERIFIED]. Data channel options for unreliable delivery not confirmed |
| simple-peer 9.11.1 | Last release 2022-02-17; last push 2024-06-26 [V] | Stagnant, skip |
| Native RTCPeerConnection + own signaling | Full control: `ordered:false, maxRetransmits:0` snapshot channel plus reliable control channel | Best long-term. Signaling Worker + Durable Object on the free plan: 100k req/day, WebSocket messages billed 20:1, hibernation avoids idle duration cost [V] |
| WebTransport | Baseline since Safari 26.4 (Chrome 97, Firefox 114, ~91% global support) [V caniuse] | Client-to-server only. Not P2P, so it needs a game server; only relevant if you later run authoritative servers |

- Migration path: hide PeerJS behind `Transport {send(channel, bytes), onmessage, onclose}` so swapping to native or Trystero is a one-file change.

## 5. TURN in 2026 and static-site credentials

| Provider | Free terms | Notes |
|---|---|---|
| Cloudflare Realtime TURN | 1,000 GB/month free, then $0.05/GB (egress only, ingress free); STUN free and unlimited [V FAQ]. Ports: 3478 udp/tcp, 443 udp/tls, 80 tcp, 5349 tls [V] | Anycast. No TCP relaying to peers, no IPv6 relay. Credentials up to 48 h TTL [V]. Whether a credit card or paid plan is required to enable it: [UNVERIFIED] (a community thread "No-CC TURN free tier" exists but was unreadable, 403) |
| Metered (Open Relay) | Official page: 20 GB/month; pricing page: 500 MB/month; a comparison site says 0.5 GB without a card, 20 GB with a card, no overages [S]. Account + API key required [V]. Ports 80/443, TURNS supported [V] | Terms: "the TURN server can and will go down without notice", no guarantees [V]. Paid: $99/mo for 150 GB [V] |
| ExpressTURN | Claims 1 TB; one comparison says 100 GB and users report tests stopping until upgrade [S] | Treat as [UNVERIFIED] |
| Xirsys | 0.5 GB/month free [S] | Too small |

- Can credentials live in a static site? Cloudflare's docs say keep the TURN key server-side, "don't share it with the browser"; a key can mint unlimited credentials [V]. Correct pattern: a Worker `/ice` endpoint calls `POST rtc.live.cloudflare.com/v1/turn/keys/{id}/credentials/generate-ice-servers` with `{"ttl": N}` and returns only the temporary `iceServers` [V]. Workers Free: 100k requests/day, 10 ms CPU, 50 subrequests [V].
- Hardening the Worker: TTL 900 s (a match is 150-270 s plus lobby); call it only when a lobby is created/joined and on ICE failure. Cloudflare wants more than 50% of issued credentials actually used [V], so do not pre-mint on page load. Add a Turnstile check (free, 20 widgets, 10 hostnames each, unlimited challenges [V]) and a Workers rate-limit binding (per-location, eventually consistent, "not an accurate accounting system" [V]; free-plan availability [UNVERIFIED]). Leaked credentials still relay arbitrary traffic until TTL expires; there is a revoke endpoint [V]. Whether Cloudflare offers a hard spend cap: [UNVERIFIED], so set an analytics alert (usage shows in 30 s [V]).
- Metered's API key is designed to be fetched client-side (`https://{app}.metered.live/api/v1/turn/credentials?apiKey=...` [V]) and free plans are quota-capped, so abuse can only exhaust the quota, not bill you. Reasonable backup provider; treat as secondary given the no-uptime-guarantee terms.
- Self-hosting coturn on an always-free VM is possible but adds ops and is not verified here.

## 6. NAT traversal success with STUN only

- Only dated data found: callstats.io, Jan 2015-Feb 2016: 22% of conferences needed some TURN, 9% needed TCP, 12% overall failed to connect, 85% of failures were NAT/firewall traversal [V webrtcHacks]. Bloggeek: "around 80%" resolve via local/STUN, and 0-50% relay depending on audience [V].
- Tailscale (a stronger hole-puncher than plain WebRTC ICE) estimates ">90%" direct with a relay for the long tail, and reports a guest Wi-Fi that blocks all outbound UDP except DNS [V]. So TURN over TLS/443 matters for schools and offices.
- No 2026 primary data exists that I could find. Practical estimate for planning: 80-90% direct with STUN-only, worse on carrier-grade NAT and school networks [UNVERIFIED as a 2026 number]. Instrument it: log `getStats()` selected candidate-pair type (host/srflx/relay) and ICE failures to get your own rate.
- Current prototype config is STUN-only (google x2, cloudflare) [M, kingswarm.html line 142], so the ~10-20% failure is live today.

## 7. Cross-browser floating point determinism

- Spec: `Math.sin`, `Math.pow`, `Math.exp`, etc. return an "implementation-approximated Number value" [V, tc39/ecma262 spec.html]. Only IEEE `+ - * /` (and `Math.sqrt`, `abs`, `floor`, `round`) are exact [S].
- Evidence of divergence [S]: V8 and SpiderMonkey use different fdlibm ports, JavaScriptCore uses system cmath; V8 had a `Math.pow(5,42)` mismatch bug (Chromium issue 40625237). A sweep of 20,000 inputs found Node 26.9 vs Chromium 141 (both V8) differing on `Math.sin` for 543 inputs and `Math.cos` for 627 [V, sunset-driver issue 471]. So even one engine drifts across versions. Reported JSC-vs-V8 disagreement percentages (pow 9%, exp 10%) come from a search summary I could not reproduce [UNVERIFIED].
- Gaffer's summary: IEEE basic ops are reproducible only under the same compiler/flags/FPU settings; transcendental functions differ between AMD and Intel; FMA and reordering break it; Supreme Commander forced 24-bit FPU precision and asserted it every tick [V]. JS has no FMA or x87 exposure, which removes most of that, but WASM notes only NaN bit patterns are nondeterministic and relaxed SIMD explicitly is [V].
- Recipe (Shards of Stone): deterministic math helpers built only from correctly rounded operations, strict iteration order, total functions, and a cross-engine harness in Chromium, Firefox, and WebKit comparing per-tick state hashes [V]. Adopt this even if you never ship lockstep; it doubles as your regression test for replays.

## 8. Recommended approach, day-one rules, and deferrals

Versus mode v1: host runs the authoritative sim at fixed 30 Hz; sends quantized delta snapshots at 15-20 Hz on an unreliable channel and events on a reliable one; guest sends 30 Hz inputs, predicts its hero, interpolates everything else 150 ms behind; ICE = STUN + Worker-minted Cloudflare TURN (TLS 443 included).

Must be true of the simulation architecture from day one:
1. `step(state, inputs[tick]) -> state`, fixed timestep, no DOM, audio, `Date`, `performance.now`, or `Math.random`. Seeded integer PRNG (e.g. mulberry32 with `Math.imul`); seed exchanged in the lobby.
2. State in flat typed arrays (struct-of-arrays) with stable slot ids, plus `serialize()`, `deserialize()`, `hash()`. This yields snapshots, save/restore for rollback, replays, and desync detection from one mechanism.
3. No transcendental `Math.*`, no `**`, no `hypot`/`atan2`. Use sqrt, lookup tables, or small polynomials. Iterate in index order. Avoid float-keyed sorts without tie-breaks.
4. Inputs are small quantized structs `{tick, seq, mx, my, aimx, aimy, buttons}`. All player actions go through them (the two-layer RTS-drag controls being cut helps here).
5. Simulation emits events (sfx, particles, screenshake) as data; the renderer consumes them. The 3D diorama renders `lerp(prev, curr, alpha)` and never mutates sim state.
6. Hero movement/dash is a separable pure step so the guest can predict it.
7. Transport is an interface; messages under about 1,200 B; a protocol version + build hash handshake.
8. CI: run the sim headless in Node and in Chromium/Firefox/WebKit (Playwright) with a fixed seed and scripted inputs; compare tick hashes.

Defer: rollback and lockstep (only if hash tests are green and a mode needs them); 2v2 until 1v1 is stable (star topology works, host upload ~150 kbps); a dedicated authoritative server on a Durable Object (would remove host advantage and NAT issues, but by my arithmetic from the free-tier limits [V] a 128 MB DO for 150 s costs about 19 GB-s and 450 billed requests, roughly 220 matches/day free, so it only fits a small audience); WebTransport; reconnect/migration; anti-cheat; matchmaking.

## Sources

- Gaffer On Games: https://gafferongames.com/post/deterministic_lockstep/ , https://gafferongames.com/post/snapshot_compression/ , https://gafferongames.com/post/state_synchronization/ , https://gafferongames.com/post/snapshot_interpolation/ , https://gafferongames.com/post/floating_point_determinism/
- SnapNet: https://www.snapnet.dev/blog/netcode-architectures-part-1-lockstep/ , .../part-2-rollback/ , .../part-3-snapshot-interpolation/
- AoE lockstep: https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond
- Gambetta prediction: https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html
- Shards of Stone (browser lockstep): https://www.shardsofstone.com/blog/from-jass-to-json-modern-web-rts-modding
- ECMAScript spec: https://raw.githubusercontent.com/tc39/ecma262/main/spec.html (sec-math.sin) ; WASM nondeterminism: https://github.com/WebAssembly/design/blob/main/Nondeterminism.md ; V8 sweep: https://github.com/jjgroenendijk/sunset-driver/issues/471 ; Chromium pow: https://issues.chromium.org/issues/40625237
- Cloudflare TURN: https://developers.cloudflare.com/realtime/turn/ , /faq/ , /generate-credentials/ ; Workers limits: https://developers.cloudflare.com/workers/platform/limits/ ; DO pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/ ; Turnstile: https://developers.cloudflare.com/turnstile/plans/ ; Rate limiting: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ ; blog: https://blog.cloudflare.com/introducing-cloudflare-realtime-and-realtimekit/
- Metered: https://www.metered.ca/tools/openrelay/ , /terms-and-conditions/ , https://www.metered.ca/stun-turn ; comparison [S]: https://bloggeek.me/webrtc-tools/nat-hosted/
- PeerJS: https://peerjs.com/server/cloud , https://github.com/peers/peerjs , https://raw.githubusercontent.com/peers/peerjs/v1.5.5/lib/negotiator.ts ; npm registry and GitHub API for release dates; Trystero: https://github.com/dmotz/trystero ; simple-peer: https://github.com/feross/simple-peer
- WebTransport support: https://caniuse.com/webtransport
- NAT stats: https://webrtchacks.com/usage-stats/ , https://bloggeek.me/webrtc-turn/ , https://tailscale.com/blog/how-nat-traversal-works
- Local measurements: sim/bandwidth microbenchmark (Node 22 V8) run in the session scratchpad; prototype code at /home/turbo/creative-game/kingswarm.html lines 142, 290-315, 690.

## Open items to verify before launch

- Does Cloudflare TURN require a card or paid plan on a new account, and is there a hard spend cap?
- Metered free quota (0.5 GB vs 20 GB) and its terms for a public game.
- Real sim tick cost and state size, then re-run the rollback arithmetic on a mid-range phone.
- Your own relay/ICE-failure rate from `getStats()` telemetry.
