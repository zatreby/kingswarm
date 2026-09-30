#!/usr/bin/env node
// Studio tool: drive the game in headless Chromium (real GPU) and capture screenshots.
//   node tools/shot.mjs <url> <out.png> [--wait ms] [--size WxH] [--steps steps.json] [--eval "js"]
// steps.json is an array of steps run in order:
//   {"wait":500} {"eval":"window.__ks.debug()"} {"key":"down:w"} {"key":"up:w"} {"key":"press:q"}
//   {"mouse":[640,360,"move"|"down"|"up"|"click"]} {"shot":"shots/a.png"} {"log":"js expression"}
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); if (i < 0) return def; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const wait = +opt('wait', 1500), size = opt('size', '1280x720').split('x').map(Number), stepsFile = opt('steps', null), evalJs = opt('eval', null);
const [url, out] = argv;
if (!url) { console.error('usage: node tools/shot.mjs <url> <out.png> [--wait ms] [--size WxH] [--steps file] [--eval js]'); process.exit(2); }

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}]`, m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(url);
await page.waitForTimeout(wait);
if (evalJs) console.log('eval ->', JSON.stringify(await page.evaluate(evalJs)));
if (stepsFile) {
  for (const s of JSON.parse(readFileSync(stepsFile, 'utf8'))) {
    if (s.wait) await page.waitForTimeout(s.wait);
    else if (s.eval) await page.evaluate(s.eval);
    else if (s.log) console.log('log ->', JSON.stringify(await page.evaluate(s.log)));
    else if (s.key) { const [a, k] = s.key.split(':'); if (a === 'down') await page.keyboard.down(k); else if (a === 'up') await page.keyboard.up(k); else await page.keyboard.press(k); }
    else if (s.mouse) { const [x, y, a] = s.mouse; await page.mouse.move(x, y); if (a === 'down') await page.mouse.down(); else if (a === 'up') await page.mouse.up(); else if (a === 'click') await page.mouse.click(x, y); }
    else if (s.shot) { await page.screenshot({ path: s.shot }); console.log('shot ->', s.shot); }
  }
}
if (out) { await page.screenshot({ path: out }); console.log('shot ->', out); }
await browser.close();
