// A minimal fake Web Audio context for Vitest (node has no Web Audio). It records what the mixer
// does and evaluates AudioParam automation, so tests can assert voices, levels and envelopes.
// Test-only: nothing in the game imports this file.

type Ev =
  | { k: 'set'; t: number; v: number }
  | { k: 'lin'; t: number; v: number }
  | { k: 'target'; t: number; v: number; tau: number };

export class FakeParam {
  private evs: Ev[] = [];
  constructor(private base: number) {}
  get value(): number { return this.base; }
  set value(v: number) { this.base = v; }
  setValueAtTime(v: number, t: number) { this.add({ k: 'set', t, v }); return this; }
  linearRampToValueAtTime(v: number, t: number) { this.add({ k: 'lin', t, v }); return this; }
  setTargetAtTime(v: number, t: number, tau: number) { this.add({ k: 'target', t, v, tau }); return this; }
  cancelScheduledValues(t: number) { this.evs = this.evs.filter(e => e.t < t); return this; }
  private add(e: Ev) { this.evs.push(e); this.evs.sort((a, b) => a.t - b.t); }
  /** The automated value at time t (Web Audio semantics for set / linear ramp / setTarget). */
  valueAt(t: number): number {
    let v = this.base, vt = 0;
    let tgt: { v: number; tau: number; t: number; from: number } | null = null;
    const cur = (time: number) => (tgt ? tgt.v + (tgt.from - tgt.v) * Math.exp(-(time - tgt.t) / tgt.tau) : v);
    for (const e of this.evs) {
      if (e.t > t) {
        if (e.k === 'lin') { const from = cur(vt); return from + (e.v - from) * ((t - vt) / (e.t - vt)); }
        break;
      }
      if (e.k === 'target') tgt = { v: e.v, tau: e.tau, t: e.t, from: cur(e.t) };
      else { v = e.v; tgt = null; }
      vt = e.t;
    }
    return cur(t);
  }
}

class FakeNode {
  readonly outputs: FakeNode[] = [];
  constructor(readonly kind: string) {}
  connect(n: FakeNode) { this.outputs.push(n); return n; }
  disconnect() { this.outputs.length = 0; }
}

export class FakeBuffer {
  readonly length: number;
  readonly numberOfChannels: number;
  constructor(readonly duration: number, readonly sampleRate = 44100, channels = 1) {
    this.length = Math.round(duration * sampleRate);
    this.numberOfChannels = channels;
  }
  getChannelData() { return new Float32Array(this.length); }
}

export class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  readonly playbackRate = new FakeParam(1);
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;
  constructor() { super('source'); }
  start(t = 0) { if (this.startedAt !== null) throw new Error('InvalidStateError'); this.startedAt = t; }
  stop(t = 0) { if (this.startedAt === null) throw new Error('InvalidStateError'); this.stoppedAt = t; }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
  constructor() { super('gain'); }
}

export class FakePanner extends FakeNode {
  readonly pan = new FakeParam(0);
  constructor() { super('panner'); }
}

export interface FakeContextOptions {
  /** Reject every decode (corrupt files). */
  failDecode?: boolean;
  /** Leave out createStereoPanner (old Safari). */
  noPanner?: boolean;
  /** Duration of every decoded buffer. */
  bufferDuration?: number;
}

export class FakeContext {
  currentTime = 0;
  readonly sampleRate = 48000;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  readonly destination = new FakeNode('destination');
  readonly sources: FakeSource[] = [];
  readonly gains: FakeGain[] = [];
  readonly panners: FakePanner[] = [];
  decodes = 0;
  createStereoPanner?: () => FakePanner;

  constructor(private readonly o: FakeContextOptions = {}) {
    if (!o.noPanner) this.createStereoPanner = () => { const p = new FakePanner(); this.panners.push(p); return p; };
  }

  resume() { this.state = 'running'; return Promise.resolve(); }
  createGain() { const g = new FakeGain(); this.gains.push(g); return g; }
  createBufferSource() { const s = new FakeSource(); this.sources.push(s); return s; }
  createBuffer(ch: number, len: number, rate: number) { return new FakeBuffer(len / rate, rate, ch); }
  createDynamicsCompressor() {
    const n = new FakeNode('compressor') as FakeNode & Record<string, FakeParam>;
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new FakeParam(0);
    return n;
  }
  createWaveShaper() { return Object.assign(new FakeNode('shaper'), { curve: null as Float32Array | null, oversample: 'none' }); }
  decodeAudioData(_b: ArrayBuffer) {
    this.decodes++;
    return this.o.failDecode ? Promise.reject(new Error('EncodingError')) : Promise.resolve(new FakeBuffer(this.o.bufferDuration ?? 0.3));
  }

  /** Voice sources (non-looping) started at exactly time t. */
  startedAt(t: number) { return this.sources.filter(s => !s.loop && s.startedAt === t && s.buffer && s.buffer.length > 1); }
  /** Voice sources (excludes the 1-sample unlock blip and music loops). */
  get voices() { return this.sources.filter(s => s.buffer !== null && s.buffer.length > 1 && s.startedAt !== null && (s.buffer.duration < 5)); }
}

/** Cast helper: the mixer and engine take real DOM types. */
export const asCtx = (f: FakeContext) => f as unknown as AudioContext;
export const asBuffer = (b: FakeBuffer) => b as unknown as AudioBuffer;
