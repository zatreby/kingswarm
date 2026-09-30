# Kingswarm distribution research: browser portals, itch, Steam wrappers (as of 2026-09-30)

Confidence tags: [P] primary source (official docs / dev's own post), [S] secondary blog or aggregator, UNVERIFIED = could not confirm.

## Bottom line for Kingswarm

1. **Go browser-first, but treat the browser build as the funnel, not the business.** Portal money is small for a first game ([S] Poki DevRel via IndieGameBusiness, Apr 2026: realistic $500-3,000/month). The one proven path for a web-tech game to real money is web build -> Steam (Vampire Survivors: itch.io browser build Mar 2021 -> Steam early access Dec 17 2021 at $2.99, 30k+ concurrent by Jan 2022).
2. **Sequence: own-host/itch playtest -> CrazyGames (non-exclusive) -> Steam demo -> Steam launch. Do NOT sign Poki's default web-exclusive deal (5 years, no other portals/aggregators) until the Steam plan is set.** Poki leaves Steam/consoles/app stores free, but blocks CrazyGames/GameSnacks etc. (Poki deal page). Poki's non-exclusive option is a one-off flat fee, no revenue share.
3. **Portal core = solo run mode + same-keyboard 2P versus.** Poki lists 130+ "2 player" games and CrazyGames 200+ ([S]); both are dedicated categories where Kingswarm's couch mode fits. Online 1v1 is a bonus, not the portal hook.
4. **Online-by-link must be re-plumbed for portals.** v0.5 loads PeerJS from cdnjs and fonts from Google Fonts (kingswarm.html lines 2, 101). Poki blocks all external requests by default (CDN libs never allowed; multiplayer servers only via CSP approval, needs live privacy policy); GameSnacks forbids any external call. PeerJS cloud + public STUN are unlisted, so treat them as UNVERIFIED-for-approval. Plan: bundle everything; own signaling + TURN on our domain; online off in portal builds until approved.
5. **Hard size budget: 5 MB initial / 8 MB total** (Poki's "good web game" line; also GameSnacks 5 MiB target, YouTube Playables 15 MiB target). CrazyGames allows 50 MB initial but only 20 MB for mobile-homepage eligibility. Three.js alone is ~190 KB gzip untreeshaken (measured below), so 3D is affordable; audio and textures are the real risk.
6. **Time-to-gameplay: first `gameplayStart` within 10 s of click, one menu click max (CrazyGames full launch), no login, guest-first.** Poki grades conversion-to-play (avg 70%) against category averages; loads >10 s lose players (Poki).
7. **Structure the roguelite run around ad-break seams** (between runs, after a draft pick), 6+ minute sessions (Poki average playtime; Player Fit test needs avg >3 min). Rewarded ads only for optional perks, never progression gates.
8. **Build one codebase with a platform adapter** (`web-itch`, `poki`, `crazygames`, `steam-electron`) covering ads, save, gameplay events, external links, online on/off. Portal SDK calls must never leak into sim code.
9. **Steam wrapper = Electron (or NW.js), not Tauri**, for a Three.js game. Tauri on Linux uses WebKitGTK with documented WebGL/perf problems; Steam Deck is Linux.
10. **Steam plan:** page live >= 2 weeks (hard rule), ideally months; demo (15-30 min, cliffhanger ending) live >= 1 month before Next Fest; realistic price $9.99-14.99. Next Fest slots: Oct 2026 (too soon), Feb 2027, Jun 2027.

## 1. Portals: requirements side by side

| | Poki | CrazyGames | GameSnacks (Google) | YouTube Playables |
|---|---|---|---|---|
| Initial size | "should not exceed 5 MB", 8 MB total [P web-engine guide] | <=50 MB initial, <=250 MB total, <=1500 files; **<=20 MB for mobile homepage**; gameplay <=20 s [P] | <15 MiB must, <5 MiB should [P] | <30 MB must, <15 MB should; total <250 MB; <=8,000 files; files <512 KB ideal [P] |
| Load/interactive | >10 s loses players [P] | <=20 s to gameplay [P] | interactive 1 s, playable 15 s on 10 Mbps [P] | <5 s [P] |
| Aspect | Scale to 16:9 (640x360, 836x470, 1031x580) [P] | Must handle iframes 800x450 to 1920x1080; legible at devicePixelRatio 1 [P] | 16:9 landscape recommended, 9:16 portrait mandatory [P] | n/a |
| Input | desktop + mobile + tablet; tablets forced to mobile controls [P] | touch + mouse + keyboard [P] | touch + mouse mandatory, keyboard rec, gamepad optional [P] | n/a |
| External requests | blocked by default; approval via Settings > CSP [P] | own servers needed for multiplayer (e.g. Photon) [S] | none allowed [P] | n/a |
| Ads | Poki SDK only, no timers, mute on ad [P] | CG SDK only, must work with AdBlock on [P] | SDK only, ad opportunity >= once/min [P] | n/a |
| Revenue | Web-exclusive: rev share on Poki-driven players, **100% of organic/direct traffic to dev**; deal terms "indicative", % undisclosed [P]. Non-exclusive: flat fee, no share [P] | % not in official docs. 60% ads / 70% purchases quoted from 2026 GameMaker jam terms [S, primary UNVERIFIED]. Payout monthly at EUR 100 min [P] | not stated | not stated |
| Exclusivity | 5 years web-only default [P] | none; Steam/app stores/other portals OK [P] | n/a | n/a |

Other Poki rules [P]: `gameplayStart()` fires on first player input, not on load; `gameplayStop()` on any interruption; no SDK events during midroll/rewarded; ESC or Space toggles pause; localStorage wrapped in try/catch (must work in incognito); external links only via `PokiSDK.openExternalLink`; studio logo on load screen only; rewarded buttons need a video icon, never green; Google Analytics cannot be approved.
Other CrazyGames rules [P]: SDK v3 loaded from `https://sdk.crazygames.com/crazygames-sdk-v3.js`, `await CrazyGames.SDK.init()`, `loadingStart/Stop`, `gameplayStart/Stop`, `ad` and `banner` modules, `data` module (localStorage-compatible API, debounced 1 s, syncs guest -> cloud on login). Guest play mandatory; external logins (Google/Facebook) prohibited; English mandatory; PEGI 12 content; no custom fullscreen button; no cross-promotion or app-store links; physics must survive 144/165 Hz; Chrome/Edge required, Safari per game, Chromebook 4 GB RAM smoothness. Multiplayer: invite links, room info via SDK, "instant multiplayer" flow, persistent room across rounds, chat toggle. Two launch stages: Basic (no SDK, no ads, no revenue) then Full (SDK, invited on engagement).

## 2. How a portal grades a first session (Poki as the clearest public model)

- Poki funnel [P]: Level 2 playtest -> **Player Fit test** (500 players, ~5 h; pass = avg playtime >3 min AND >=25% of plays >3 min; target 5+ min) -> **Web Fit test** (~10,000 players, 3-5 days; three metrics scored 0-5 vs category average: CTR, average time on page, conversion to play measured at first `gameplayStart`). Example action/adventure average: 1.5% CTR, 4 min on page, 70% C2P. Passing = "potential fit", then final review.
- Poki says the average game reaches ~70% conversion and 6+ min playtime [S via search summary; the 70%/4 min figures are [P] in the Web Fit doc].
- So: the first thumbnail, the 5-10 s load, and the first-30-seconds onboarding are graded before any monetization. Design a 20-second "you are shooting critters" start with no tutorial screen.
- Audience skews young and school-device heavy on .io-style hits: Shell Shockers ~39% Chromebooks, ~10% mobile, 10-15 yo, 300-350k DAU in school term, 80-90% ad revenue, low-seven-figure annual [S GameDiscover deep dive]. Lesson: test on a 4 GB Chromebook, mouse-optional (trackpad) aiming.
- Poki DevRel: top performers are casual, puzzle, idle, hyper-casual, arcade; "Poki's audience plays significantly on mobile" [S IndieGameBusiness]. No public mobile percentage found (UNVERIFIED).

## 3. Money reality on portals

- First web game: $500-3,000/month realistic [S, Poki DevRel interview, Apr 20 2026]. Top Poki studios up to EUR 1M/year; one dev reported 67M gameplays over 5 games in 2025 [S Cinevva, unaudited].
- Rewarded video eCPM: US $15-28, EU $8-15, tier-3 $1-3; interstitials ~half [S Cinevva]. One 2018 dataset: EUR 1.20 per 1,000 plays on CrazyGames [S, dated, low confidence].
- Flat license: non-exclusive $300-800 per portal, exclusive $5,000+ up to $25,000+ [S Cinevva, low confidence].
- itch.io: ~80% of pages earn $0-50/month [S]. itch HTML5 supports donations only, no direct sales [P itch docs]; default platform cut 10%, creator-adjustable 0-100% [P/S].
- Newgrounds: ZIP with index.html at root [S tutorials]; Newgrounds.io API gives medals and scoreboards; ad share reported ~$0.30 per 1,000 views [S wiki, old]. Upside is community/reviews, not income.
- Takeaway: portals pay per play-minute at scale; a 2-5 min replayable loop with ad seams beats a deep 40-minute campaign there. Steam wants the opposite. The run-based mode can serve both if runs are 6-10 min and meta depth sits between them.

## 4. itch.io and Newgrounds (technical facts)

- itch HTML5 [P]: <=1,000 files after extraction, <=200 MB per file, ~500 MB total, filenames <=240 chars, ZIP only, relative paths, external requests must be HTTPS; "click to play" default, fullscreen button optional; "Mobile Friendly" flag forces fullscreen launch on mobile.
- Newgrounds: HTML5 as ZIP; 3 GB upload limit [S, low confidence]. Both work as playtest hosts and as the only place to put a Steam wishlist button (portals forbid cross-promotion, CG forbids app-store links, Poki restricts external links).

## 5. Steam via Electron / NW.js / Tauri, with examples

- **Vampire Survivors** [P Wikipedia summary + Phaser news]: built 2020 on Phaser, released free on itch.io (browser) Mar 31 2021 with minimal engagement, Steam EA Dec 17 2021 at $2.99 (credits list Phaser 3 and "RexPlugins Electron"), $4.99 on Sep 22 2022, 1.0 on Oct 20 2022, later ported to Unity (v1.6, Aug 2023, per GamingOnLinux [S]). Sales estimates ~6M Steam copies [S, estimates vary]. Caution: the browser build did not make it viral; YouTube creators did after the Steam release. The lesson is "web-tech is a valid Steam shipping stack and a cheap prototype path", not "browser hit -> Steam hit".
- **CrossCode**: built on heavily modified impact.js (80-90% of engine changed) [P Radical Fish blog #277]; shipped with NW.js (dev post: "CrossCode now runs with NW.js 0.35.5", fixing Windows memory leaks and Linux/macOS crashes) [P blog p=6904]. Web Audio memory waste at >100 kHz sample rate was a reported issue [S].
- **Cookie Clicker** (web 2013, official Steam version) and **Antimatter Dimensions** (web 2016, Steam page exists) [P Steam pages]; wrapper tech UNVERIFIED.
- Only Electron and NW.js are officially supported by the two Steamworks bindings (steamworks.js, greenworks) [S webgamedev.com]. Electron builds are 100 MB+ [S].
- Electron caveats [S, GitHub/dev reports]: Steam overlay needs a second window and constant repaint; recent Electron versions reportedly break Steam Input gamepad (Electron 25.2.0 cited as good); Steam Deck needs `no-sandbox`, `no-zygote`, `in-process-gpu`, `disable-dev-shm-usage` and `libsteam_api.so` on `LD_LIBRARY_PATH`; save to app-data JSON so it Steam-Cloud syncs. Test Steam Input on Deck before committing to an Electron version.
- Tauri: WebKitGTK on Linux has WebGL context-lost and slow-frame reports (Tauri's own Linux graphics doc + issues #6559, #3988) [P/S]. Avoid for the 3D build.
- Steam economics [P Steam Direct]: $100 app fee, recouped after $1,000 adjusted gross; store page review 1-5 days; page public >= 2 weeks before release; 30 days from fee payment to release. Valve cut 30% up to $10M, 25% to $50M, 20% above [S].

## 6. Steam: price, demo, Next Fest, store page

- Pricing [S]: median indie $10.99-15.64; survivors-likes/roguelites mostly $14.99-19.99; under $9.99 for <3-4 h or viral/co-op games. Vampire Survivors began at $2.99. Recommendation (judgment): launch at $9.99-12.99 with local 2P + solo runs + online in the box; nothing that looks like F2P/.io monetization.
- Next Fest [P Steamworks]: one-time participation per game; needs public store page + public demo; demo submitted 3 weeks before (5 weeks for press preview); demo can stay up forever; no fee; press sees games 10 days early; pick max 2 categories; put a feedback link in the demo menu.
- Next Fest results [P Zukowski 2026-04-13 + benchmarks page]: median wishlists earned Feb 2026 = 806 (Feb 2025: 1,079); tiers: bronze 0-999, silver 1,000-6,999, gold 7,000-9,999, diamond 10,000+; games entering with <1,000 wishlists rarely climb (median ~460); 3,000+ pre-fest wishlists dominate top tiers ("Next Fest is a harvest, not a planting season"); demos up 1+ month early beat shadow-drops (~2.5x median [S]). Demo length: 20 min matched 2 h; end on a cliffhanger [S presskit.gg].
- Wishlist volume [P benchmarks, updated June 2026]: 5,000 (bronze) / 8,000 (silver) / 50,000 (gold) launch wishlists. Week-one conversion ~12-27% by tier (2020 study), while 2026 secondary sources say ~10-11 first-week sales per 100 wishlists. Plan on 10-20%.
- 68-88% of wishlists come from people who never played the demo [S, Zukowski Feb 2025 survey]: capsule + trailer matter more than the demo itself.
- Store page [S consensus]: gameplay in first 5 s of trailer; genre named in first 10 words of short description; use all 20 tags; capsule readable small; 8-12% median visitor -> wishlist rate.
- Kingswarm's browser build can serve as the "demo" for wishlists (itch/own-site with a Steam button) months before a Next Fest, with Steam demo built from the same code.

## 7. Recommended go-to-market path

1. **Now-Q1:** rebuild in TS + Vite; ship `web-itch` playtest builds (free, no ads) to gather retention data on the run mode. Wishlist button and Discord link live here only.
2. **Prototype gate:** keep an internal metric copying Poki's: % reaching first gameplay, avg minutes per session (target >4 min, C2P >70%).
3. **Portal launch:** CrazyGames Basic Launch (no SDK needed) to test, then Full Launch with SDK, ads at run seams, guest play, invite-link 1v1. Try Poki Player/Web Fit tests only if willing to accept web exclusivity, or negotiate a non-exclusive flat fee. Decide exclusivity after seeing CG numbers.
4. **Steam:** publish Coming Soon page as early as art allows (target 3+ months before Feb or Jun 2027 Next Fest); Electron build; steamworks.js for achievements/cloud; test Steam Deck with gamepad; demo = solo run (15-30 min) with cliffhanger; Next Fest Feb or Jun 2027, launch 4-8 weeks later.
5. **Kill criteria:** if pre-fest wishlists <1,000 at 6 weeks out, skip Next Fest slot (one-time use) and slip to the next.

## 8. Technical constraints to honor from day one

- **Budget:** initial payload <=5 MB gz (JS+critical assets), total <=8 MB for portal build; <=1,000 files (itch), <=1,500 (CG). Steam build can add high-quality audio/music. Lazy-load music and non-first-arena assets. Measured, Three.js 0.186.1 minified (jsDelivr Terser): `three.module.min.js` 393 KB (90 KB gzip / 75 KB brotli) plus `three.core.min.js` 416 KB (104 KB gzip / 84 KB brotli) = ~194 KB gzip before tree-shaking. Poki cites 151 KB for Three.js [P]. Ship Brotli; prefer compressed textures (KTX2) or flat-shaded low-poly with vertex colors and no textures.
- **Rendering:** fixed-timestep deterministic sim independent of display Hz (CG requires 144/165 Hz safety); `InstancedMesh` for critters; quality tiers (DPR cap 1-1.5 on mobile, shadows/post-processing off by default); test at 4 GB Chromebook and low-memory Android. Keep JS heap < 512 MB (Playables).
- **Resolution:** letterboxed 16:9 stage that scales to any iframe from 640x360 up to 1920x1080 (and 800x450 minimum on CG), text legible at DPR 1; UI in safe-area insets; portrait handling on mobile either supported or a rotate prompt; Poki mobile must "cover the full screen".
- **Input:** mouse+keyboard, touch (virtual stick + tap/hold-to-fire at aim point; tablets always get touch UI on Poki), gamepad (Gamepad API; Steam Input on Deck), plus same-keyboard 2P. Hold-to-fire suits touch. Prevent page scroll/zoom and text selection (`user-select:none`, `touch-action:none`).
- **Lifecycle:** pause on `visibilitychange`/blur in solo/local (call `gameplayStop`), ESC/Space pause, resume on gesture; resume `AudioContext` inside a user gesture (iOS interrupts audio); mute on ad. Note: the repo's "worker timer keeps sim ticking in hidden tabs" (commit 02d18d8) must apply to online matches only, not portal solo/local.
- **Audio:** real SFX/music, mute toggle, no autoplay before first input, master volume persisted; music loaded after first gameplay.
- **Save:** `Storage` interface with adapters (localStorage in try/catch, CG `data` module, Steam Cloud JSON file); saves <500 KB; must work in incognito and without login; version-tag saves. No stat-charm meta as a gate to fun (owner feedback), keep meta tiny.
- **Network:** zero third-party requests in portal builds (bundle fonts, PeerJS/netcode, analytics optional and off); relative asset paths; HTTPS only; own signaling/TURN reachable only after portal CSP approval; sitelock (`*.crazygames.com` plus `https://app.crazygames.com` and `capacitor://app.crazygames.com` for iOS app) if using frame-ancestors CSP.
- **Content/legal:** English strings first, locale from SDK; PEGI 12 (fantasy cartoon fine); no external links, splash screens, competing portal branding, or in-game fullscreen button on CG; privacy policy URL needed for CSP approvals and any data beyond SDK events.
- **QA matrix:** Chrome/Edge (required), Firefox, Safari desktop and iOS, Android Chrome, ChromeOS 4 GB, Steam Deck under Electron, with AdBlock on and off, and incognito.

## 9. Where the evidence challenges the studio direction

- "Ship in browser first, Steam later" is right only if the browser build is designed as a demo funnel; portal revenue alone will not fund a rebuild (~$500-3,000/mo typical).
- Deep drafted-upgrade runs fit Steam; portals reward short sessions with fast replays. Keep run length tunable (6-10 min portal vs 15-30 min Steam demo) rather than fixed.
- 3D diorama is viable (Three.js is small), but portal audiences are heavily on low-end school laptops and phones; budget frame time for that hardware first.
- Online play by link is an advantage only where allowed; on Poki/GameSnacks it may be gated or blocked.

## UNVERIFIED / gaps

- CrazyGames and Poki exact revenue-share percentages (CG 60/70 only via secondary citing jam terms; Poki "50/50 with marketing" from Poki's own deal text summary not confirmed).
- Whether Poki/CrazyGames approve PeerJS cloud signaling or public STUN/TURN for WebRTC.
- Wrapper tech for Cookie Clicker and Antimatter Dimensions Steam builds.
- Poki/CrazyGames mobile traffic share; Newgrounds current revenue terms and upload limits; Steam Next Fest October 2026 lineup.
- Vampire Survivors "6M copies" is an estimate range.

## Sources

- Poki requirements https://developers.poki.com/guide/requirements-quality ; deal types https://developers.poki.com/guide/revenue-deal-types ; engine guide https://developers.poki.com/guide/web-engine ; external resources https://developers.poki.com/guide/external-resources-policy ; web fit https://developers.poki.com/guide/web-fit-test ; player fit https://developers.poki.com/guide/player-fit-test ; working with Poki https://developers.poki.com/guide/working-with-poki
- CrazyGames https://docs.crazygames.com/requirements/intro/ , /requirements/gameplay/ , /requirements/technical/ , /requirements/multiplayer/ , /requirements/account-integration/ , /faq/ , /sdk/intro/ , https://docs.crazygames.com/resources/html5/sitelock/ , https://docs.crazygames.com/sdk/data/
- GameSnacks https://developers.google.com/gamesnacks/developer ; YouTube Playables https://developers.google.com/youtube/gaming/playables/certification/requirements_stability
- itch.io https://itch.io/docs/creators/html5 ; Newgrounds.io https://www.newgrounds.io/
- IndieGameBusiness/Poki DevRel https://indiegamebusiness.com/web-gaming-for-indie-developers/ ; Cinevva monetization https://app.cinevva.com/guides/web-game-monetization ; Shell Shockers https://newsletter.gamediscover.co/p/deep-dive-shell-shockers-multi-million
- Vampire Survivors https://en.wikipedia.org/wiki/Vampire_Survivors ; https://phaser.io/news/2024/02/vampire-survivors-space-54 ; https://www.gamingonlinux.com/2023/07/vampire-survivors-switching-to-new-game-engine-on-august-17/
- CrossCode https://www.radicalfishgames.com/?p=277 ; https://www.radicalfishgames.com/?p=6904
- Wrappers https://www.webgamedev.com/publishing/desktop ; https://phaser.io/news/2025/03/publishing-web-games-on-steam-with-electron ; https://github.com/alexanderthurn/steam-electron-build ; https://v2.tauri.app/develop/debug/linux-graphics/ ; https://store.steampowered.com/app/1454400/Cookie_Clicker/ ; https://store.steampowered.com/app/1399720/Antimatter_Dimensions/
- Steam https://partner.steamgames.com/steamdirect ; https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest (+ /tips) ; https://howtomarketagame.com/2026/04/13/making-sense-of-the-february-2026-steam-next-fest/ ; https://howtomarketagame.com/benchmarks/ ; https://presskit.gg/blog/steam-next-fest-2026-results ; https://www.steampageanalyzer.com/blog/steam-store-page-conversion-benchmarks ; https://gtstu.com/steam-indie-game-pricing-strategy/
- Three.js sizes measured 2026-09-30 from https://cdn.jsdelivr.net/npm/three@0.186.1/build/ (gzip -9, brotli default).
