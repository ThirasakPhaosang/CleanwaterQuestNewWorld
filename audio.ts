// Lightweight audio manager for music/SFX/UI with WebAudio, with graceful fallbacks.
type VolKey = 'master' | 'music' | 'sfx' | 'ui';

class AudioManager {
  private ctx: AudioContext | null = null;
  private gains: Record<VolKey, GainNode> | null = null;
  private started = false;
  // Removed generative/ambient layers; keep a simple file-based player only
  private musicNodes: null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private cache: Map<string, AudioBuffer> = new Map();
  private vols: Record<VolKey, number> = { master: 0.5, music: 0.5, sfx: 0.5, ui: 0.5 };

  constructor() {
    const saved = localStorage.getItem('audioVols');
    if (saved) {
      try { this.vols = { ...this.vols, ...(JSON.parse(saved) as any) }; } catch {}
    }
  }

  init = async () => {
    if (this.started) return;
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return; // No WebAudio support
    this.ctx = new Ctx();
    const master = this.ctx.createGain();
    const music = this.ctx.createGain();
    const sfx = this.ctx.createGain();
    const ui = this.ctx.createGain();
    music.connect(master); sfx.connect(master); ui.connect(master);
    master.connect(this.ctx.destination);
    this.gains = { master, music, sfx, ui };
    this.applyVolumes();
    this.started = true;
  };

  private applyVolumes() {
    if (!this.gains) return;
    const now = this.ctx!.currentTime;
    this.gains.master.gain.setTargetAtTime(this.vols.master, now, 0.01);
    this.gains.music.gain.setTargetAtTime(this.vols.music, now, 0.01);
    this.gains.sfx.gain.setTargetAtTime(this.vols.sfx, now, 0.01);
    this.gains.ui.gain.setTargetAtTime(this.vols.ui, now, 0.01);
    localStorage.setItem('audioVols', JSON.stringify(this.vols));
  }

  getVolume = (k: VolKey) => this.vols[k];
  setVolume = (k: VolKey, v: number) => { this.vols[k] = Math.max(0, Math.min(1, v)); this.applyVolumes(); };

  ensure = async () => { if (!this.started) await this.init(); if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume(); };

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    try {
      if (this.cache.has(url)) return this.cache.get(url)!;
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      const buf = await this.ctx!.decodeAudioData(arr);
      this.cache.set(url, buf);
      return buf;
    } catch {
      return null;
    }
  }

  private makeNoiseBuffer() {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, sampleRate * 1.5, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    return buffer;
  }

  private playOsc(freq: number, dur = 0.12, type: OscillatorType = 'sine', gain = 0.5, dest: GainNode, attack = 0.01) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(dest);
    const now = this.ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now); o.stop(now + dur + 0.02);
  }

  private playNoise(dur = 0.2, cutoff = 800, dest: GainNode) {
    if (!this.ctx) return;
    const buf = this.makeNoiseBuffer();
    if (!buf) return;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.4;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff;
    src.connect(lp); lp.connect(g); g.connect(dest);
    const now = this.ctx.currentTime;
    g.gain.setValueAtTime(0.001, now); g.gain.exponentialRampToValueAtTime(0.4, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.start(now); src.stop(now + dur + 0.05);
  }
  private delay(dest: GainNode, time = 0.18, feedback = 0.25) {
    if (!this.ctx) return dest;
    const d = this.ctx.createDelay(1.0);
    d.delayTime.value = time;
    const fg = this.ctx.createGain(); fg.gain.value = feedback;
    d.connect(fg); fg.connect(d);
    const mix = this.ctx.createGain(); mix.gain.value = 0.6;
    d.connect(mix);
    mix.connect(dest);
    return d as unknown as GainNode;
  }
  private r(min: number, max: number) { return min + Math.random() * (max - min); }

  uiClick = async () => { await this.ensure(); if (!this.gains) return; this.playOsc(880, 0.06, 'triangle', 0.35, this.gains.ui); };
  uiOpen = async () => { await this.ensure(); if (!this.gains) return; this.playOsc(660, 0.12, 'sine', 0.3, this.gains.ui); };
  uiClose = async () => { await this.ensure(); if (!this.gains) return; this.playOsc(520, 0.08, 'sine', 0.25, this.gains.ui); };

  sfx = {
    hookDrop: async () => { await audio.ensure(); if (!audio.gains) return; const d = audio.delay(audio.gains.sfx, 0.14, 0.2); audio.playNoise(0.2, 900, d); audio.playOsc(260 + audio.r(-12,12), 0.12, 'sawtooth', 0.32, d); },
    hookRaise: async () => { await audio.ensure(); if (!audio.gains) return; const d = audio.delay(audio.gains.sfx, 0.12, 0.22); audio.playOsc(420, 0.08, 'triangle', 0.28, d); audio.playOsc(660, 0.07, 'triangle', 0.22, d); },
    collect: async () => { await audio.ensure(); if (!audio.gains) return; const d = audio.delay(audio.gains.sfx, 0.16, 0.22); audio.playOsc(820 + audio.r(-30,30), 0.08, 'square', 0.32, d); setTimeout(()=>audio.playOsc(1240, 0.08, 'square', 0.25, d), 40); },
    binHover: async () => { await audio.ensure(); if (!audio.gains) return; audio.playOsc(980 + audio.r(-60,60), 0.05, 'sine', 0.18, audio.gains.ui); },
    binDrop: async () => { await audio.ensure(); if (!audio.gains) return; const d = audio.delay(audio.gains.sfx, 0.12, 0.25); audio.playNoise(0.12, 1200, d); },
    correct: async () => { await audio.ensure(); if (!audio.gains) return; const base = 720 + audio.r(-20,20); const d = audio.delay(audio.gains.sfx, 0.14, 0.2); audio.playOsc(base, 0.08, 'triangle', 0.28, d); setTimeout(() => audio.playOsc(base*4/3, 0.1, 'triangle', 0.28, d), 70); },
    wrong: async () => { await audio.ensure(); if (!audio.gains) return; const d = audio.delay(audio.gains.sfx, 0.18, 0.25); audio.playNoise(0.22, 600, d); },
    treasure: async () => { await audio.ensure(); if (!audio.gains) return; const d = audio.delay(audio.gains.sfx, 0.22, 0.28); [880, 1175, 1568].forEach((f,i)=> setTimeout(()=>audio.playOsc(f, 0.18, 'sine', 0.26, d, 0.02), i*90)); },
    result: async () => { await audio.ensure(); if (!audio.gains) return; const d = audio.delay(audio.gains.sfx, 0.2, 0.25); audio.playOsc(660, 0.18, 'sine', 0.28, d); setTimeout(()=>audio.playOsc(990, 0.22, 'sine', 0.24, d), 120); }
  };

  startMusic = async (kind: 'menu' | 'game') => {
    await this.ensure(); if (!this.gains) return;
    this.stopMusic();
    // Play only the bundled files (no fallback/generative layers)
    const menuTracks = [
      'audio/mainmenu/perfect-beauty-191271.mp3'
    ];
    const gameTracks = [
      'audio/game/beach-fun-2-336147.mp3',
      'audio/game/beach-fun-336146.mp3',
      'audio/game/play-fun-336143.mp3',
      'audio/game/playing-fun-on-the-beach-336145.mp3'
    ];
    const list = kind === 'menu' ? menuTracks : gameTracks;
    const pick = list[(Math.random() * list.length) | 0];
    const buf = await this.loadBuffer(pick);
    if (!buf) return;
    const src = this.ctx!.createBufferSource();
    src.buffer = buf; src.loop = true;
    // Let master 'music' gain control the volume (we set it to 0.5 at start)
    src.connect(this.gains.music);
    src.start();
    this.musicSource = src;
  };

  stopMusic = () => {
    if (!this.ctx) return;
    try { this.musicSource?.stop(); } catch {}
    this.musicSource = null;
  };
}

export const audio = new AudioManager();
export default audio;

