// Shared measurement helpers for the audio pipeline (no npm dependencies, only ffmpeg/ffprobe).
// Nobody on the team can listen, so every choice is backed by numbers from here:
//   dur / lead / tail   silence-trimmed length, leading silence, decay time to -40 dB
//   peak, rms           dBFS over the active region
//   lufsM               loudest 400 ms momentary loudness (EBU R128 M), clip padded with silence.
//                       For clips <= 400 ms this equals the integrated loudness of the padded clip.
//   attack              ms from onset (-40 dB re peak) to 90 % of peak amplitude
//   centroid            spectral centroid in Hz over the active region (bright = high)
//   air                 share of spectral energy above 3 kHz in percent (whoosh/hiss/click detail; thumps ~0)
//   cenA>cenB           centroid of the first and last third of the active region (rising or falling sweep)
//   f0A>f0B             median fundamental of the first and last third for pitched frames (0 = unpitched);
//                       tells a rising chime from a falling one without listening
//   pitch               median normalised autocorrelation peak (40 Hz - 2 kHz) of loud frames:
//                       > 0.8 clearly pitched (beep/bell), < 0.5 noisy or clustered (thud, whoosh)
import { execFileSync, spawnSync } from 'node:child_process';

export const SR = 44100;

export function probe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=channels,sample_rate:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  const j = JSON.parse(out);
  return { duration: parseFloat(j.format.duration), channels: j.streams[0].channels, rate: +j.streams[0].sample_rate };
}

// Decode to mono float32 at 44.1 kHz through an optional ffmpeg filter chain.
export function decode(file, filter = '', channels = 1) {
  const args = ['-v', 'error', '-i', file, '-ac', String(channels), '-ar', String(SR)];
  if (filter) args.push('-af', filter);
  args.push('-f', 'f32le', '-');
  const r = spawnSync('ffmpeg', args, { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg decode failed for ${file}: ${r.stderr}`);
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
}

// EBU R128 momentary max (LUFS) and true peak (dBTP) of a file through a filter chain.
export function loudness(file, filter = '', pad = 1, inArgs = []) {
  const chain = [filter, `apad=pad_dur=${pad}`, 'ebur128=peak=true:framelog=verbose'].filter(Boolean).join(',');
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-v', 'verbose', ...inArgs, '-i', file, '-af', chain, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const txt = r.stderr;
  let mMax = -Infinity;
  for (const m of txt.matchAll(/ M:\s*(-?[\d.]+)\s/g)) mMax = Math.max(mMax, parseFloat(m[1]));
  const i = /I:\s+(-?[\d.]+) LUFS\s*\n/.exec(txt.split('Summary:')[1] ?? '');
  const tp = /Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(txt.split('Summary:')[1] ?? '');
  return { lufsM: mMax, lufsI: i ? parseFloat(i[1]) : NaN, truePeak: tp ? parseFloat(tp[1]) : NaN };
}

const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));

export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

const median = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

// Metrics from mono samples (already decoded). Works on the raw clip, so lead/tail are reported.
export function analyze(x) {
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  if (peak < 1e-5) return { dur: 0, lead: 0, tail: 0, peak: -Infinity, rms: -Infinity, attack: 0, centroid: 0, air: 0, pitch: 0, cenA: 0, cenB: 0, f0A: 0, f0B: 0 };
  // 1 ms amplitude envelope (max abs per ms)
  const step = SR / 1000 | 0;
  const env = [];
  for (let i = 0; i < x.length; i += step) {
    let m = 0;
    for (let k = i; k < Math.min(i + step, x.length); k++) m = Math.max(m, Math.abs(x[k]));
    env.push(m);
  }
  const thr = peak * 0.01; // -40 dB re peak
  const first = env.findIndex((v) => v >= thr);
  let last = env.length - 1;
  while (last > 0 && env[last] < thr) last--;
  const pk = env.indexOf(Math.max(...env));
  let att = first;
  while (att < env.length && env[att] < peak * 0.9) att++;
  // active region samples
  const a0 = first * step, a1 = Math.min(x.length, (last + 1) * step);
  let ss = 0;
  for (let i = a0; i < a1; i++) ss += x[i] * x[i];
  const rms = Math.sqrt(ss / Math.max(1, a1 - a0));
  // spectral frames of 2048 (Hann), hop 1024, only frames within -25 dB of the loudest frame
  const N = a1 - a0 < 2600 ? 1024 : 2048, hop = N / 2; // shorter frames for clips under ~60 ms so they are not mostly zero padding
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const frames = [];
  for (let s = a0; s < a1 || frames.length === 0; s += hop) {
    const seg = new Float32Array(N);
    let e = 0;
    for (let i = 0; i < N; i++) { const v = (x[s + i] ?? 0); seg[i] = v; e += v * v; }
    frames.push({ s, e, seg });
    if (s + hop >= a1) break;
  }
  const eMax = Math.max(...frames.map((f) => f.e));
  const loud = frames.filter((f) => f.e >= eMax * 0.003);
  let cNum = 0, cDen = 0;
  const pitches = []; let hiE = 0, allE = 0;
  const per = []; // per loud frame: centroid, f0
  for (const f of loud) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = f.seg[i] * win[i];
    fft(re, im);
    for (let k = 2; k < N / 2; k++) {
      const p = re[k] * re[k] + im[k] * im[k] + 1e-20;
      const hz = (k * SR) / N;
      cNum += hz * p * f.e; cDen += p * f.e; // weight frames by energy
      allE += p * f.e; if (hz > 3000) hiE += p * f.e;
    }
    // normalised autocorrelation peak, lags for 2 kHz .. 40 Hz (subsampled by 2 for speed)
    let cN = 0, cD = 0;
    for (let k = 2; k < N / 2; k++) { const p = re[k] * re[k] + im[k] * im[k]; cN += ((k * SR) / N) * p; cD += p; }
    let r0 = 0;
    for (let i = 0; i < N; i++) r0 += f.seg[i] * f.seg[i];
    let best = 0, bestLag = 0;
    for (let lag = 22; lag < Math.min(1100, N / 2 - 1); lag++) {
      let acc = 0;
      for (let i = 0; i + lag < N; i += 2) acc += f.seg[i] * f.seg[i + lag];
      const v = (acc * 2) / (r0 * (N - lag) / N + 1e-20);
      if (v > best * 1.02) { best = v; bestLag = lag; } // shortest lag among near-equal peaks avoids octave-down errors
    }
    pitches.push(Math.min(1, best));
    per.push({ cen: cN / cD, f0: best > 0.85 ? SR / bestLag : 0 });
  }
  const third = Math.max(1, Math.floor(per.length / 3));
  const med = (a) => (a.length ? median(a) : 0);
  const A = per.slice(0, third), B = per.slice(per.length - third);
  return {
    cenA: med(A.map((v) => v.cen)), cenB: med(B.map((v) => v.cen)),
    f0A: med(A.filter((v) => v.f0).map((v) => v.f0)), f0B: med(B.filter((v) => v.f0).map((v) => v.f0)),
    dur: (last - first + 1) / 1000,
    lead: first / 1000,
    tail: (last - pk) / 1000,
    peak: db(peak),
    rms: db(rms),
    attack: att - first,
    centroid: cNum / cDen,
    air: (100 * hiE) / allE,
    pitch: median(pitches),
  };
}

export function measure(file, filter = '') {
  const x = decode(file, filter);
  return { ...analyze(x), ...loudness(file, filter) };
}

export const fmt = (m) =>
  `dur ${m.dur.toFixed(3).padStart(6)}s lead ${(m.lead * 1000).toFixed(0).padStart(3)}ms tail ${m.tail.toFixed(2).padStart(5)}s ` +
  `pk ${m.peak.toFixed(1).padStart(6)} rms ${m.rms.toFixed(1).padStart(6)} M ${m.lufsM.toFixed(1).padStart(6)} ` +
  `att ${String(m.attack).padStart(3)}ms cen ${m.centroid.toFixed(0).padStart(5)}Hz air ${m.air.toFixed(0).padStart(2)}% pitch ${m.pitch.toFixed(2)} ` +
  `sweep ${m.cenA.toFixed(0)}>${m.cenB.toFixed(0)} f0 ${m.f0A.toFixed(0)}>${m.f0B.toFixed(0)}`;

// Onset (spectral flux) envelope at hop 256, for tempo/beat work on music.
export function onsetEnvelope(x, N = 1024, hop = 256) {
  const flux = [];
  let prev = new Float64Array(N / 2);
  for (let s = 0; s + N <= x.length; s += hop) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[s + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    fft(re, im);
    let fl = 0;
    const cur = new Float64Array(N / 2);
    for (let k = 1; k < N / 2; k++) { cur[k] = Math.log(1 + 100 * Math.hypot(re[k], im[k])); fl += Math.max(0, cur[k] - prev[k]); }
    prev = cur; flux.push(fl);
  }
  const m = flux.reduce((a, b) => a + b, 0) / flux.length;
  return { env: flux.map((v) => v - m), fps: SR / hop };
}
