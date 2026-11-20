// SPDX-License-Identifier: AGPL-3.0-or-later
// Real recorded audio sample engine using Web Audio API AudioBuffers (zero latency)

export type SoundProfile =
  | "creams"
  | "typewriter"
  | "click"
  | "osu"
  | "holy_panda"
  | "mx_blue"
  | "mx_brown"
  | "mx_black"
  | "topre"
  | "model_m"
  | "pop"
  | "pentatonic"
  | "hitmarker"
  | "beep"
  | "off";

export type KeyType = "press" | "space" | "backspace";

export const ALL_SOUND_PROFILES: SoundProfile[] = [
  "creams",
  "typewriter",
  "click",
  "osu",
  "holy_panda",
  "mx_blue",
  "mx_brown",
  "mx_black",
  "topre",
  "model_m",
  "pop",
  "pentatonic",
  "hitmarker",
  "beep",
  "off"
];

export const QUICK_SOUND_PROFILES: SoundProfile[] = [
  "creams",
  "typewriter",
  "click",
  "osu"
];

const VALID_PROFILES: SoundProfile[] = ALL_SOUND_PROFILES;

type RawAudioPack = "creams" | "typewriter" | "click" | "osu";

const PACK_URLS: Record<RawAudioPack, string[]> = {
  creams: [
    "/sounds/creams/1.wav",
    "/sounds/creams/2.wav",
    "/sounds/creams/3.wav",
    "/sounds/creams/4.wav",
    "/sounds/creams/5.wav",
    "/sounds/creams/6.wav"
  ],
  typewriter: [
    "/sounds/typewriter/1.wav",
    "/sounds/typewriter/2.wav",
    "/sounds/typewriter/3.wav",
    "/sounds/typewriter/4.wav",
    "/sounds/typewriter/5.wav",
    "/sounds/typewriter/6.wav"
  ],
  click: [
    "/sounds/click/1.wav",
    "/sounds/click/2.wav",
    "/sounds/click/3.wav"
  ],
  osu: [
    "/sounds/osu/1.wav",
    "/sounds/osu/2.wav",
    "/sounds/osu/3.wav"
  ]
};

// Map virtual sound profiles to their underlying raw audio pack (if any)
const PROFILE_BASE_PACK: Partial<Record<SoundProfile, RawAudioPack>> = {
  creams: "creams",
  typewriter: "typewriter",
  click: "click",
  osu: "osu",
  holy_panda: "creams",
  mx_blue: "click",
  mx_brown: "creams",
  mx_black: "creams",
  topre: "creams",
  model_m: "typewriter"
};

const PENTATONIC_FREQS = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private buffers: Partial<Record<RawAudioPack, AudioBuffer[]>> = {};
  private loadingPacks = new Set<string>();
  private errorBuffer: AudioBuffer | null = null;
  private errorLoading = false;
  private pentatonicIndex = 0;

  private profile: SoundProfile = (() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("soundProfile") as SoundProfile | null;
      if (saved && VALID_PROFILES.includes(saved)) return saved;
    }
    return "creams";
  })();

  private volume: number = (() => {
    if (typeof localStorage !== "undefined") {
      const v = Number(localStorage.getItem("soundVolume"));
      if (v > 0 && v <= 1) return v;
    }
    return 0.75;
  })();

  constructor() {
    if (typeof window !== "undefined") {
      // Preload selected pack on first user interaction
      const unlock = () => {
        this.ensureContext();
        window.removeEventListener("keydown", unlock);
        window.removeEventListener("pointerdown", unlock);
      };
      window.addEventListener("keydown", unlock, { once: true });
      window.addEventListener("pointerdown", unlock, { once: true });
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx) {
      const raw = PROFILE_BASE_PACK[this.profile];
      if (raw) {
        this.loadRawPack(this.ctx, raw);
      }
      this.loadErrorSound(this.ctx);
    }
    return this.ctx;
  }

  private loadRawPack(ctx: AudioContext, pack: RawAudioPack): void {
    if (this.buffers[pack] || this.loadingPacks.has(pack)) return;
    this.loadingPacks.add(pack);

    const urls = PACK_URLS[pack];
    Promise.all(
      urls.map((u) =>
        fetch(u)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("404"))))
          .then((ab) => ctx.decodeAudioData(ab))
      )
    )
      .then((decoded) => {
        this.buffers[pack] = decoded;
      })
      .catch(() => {
        this.loadingPacks.delete(pack);
      });
  }

  private loadErrorSound(ctx: AudioContext): void {
    if (this.errorBuffer || this.errorLoading) return;
    this.errorLoading = true;
    fetch("/sounds/error.wav")
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("404"))))
      .then((ab) => ctx.decodeAudioData(ab))
      .then((decoded) => {
        this.errorBuffer = decoded;
      })
      .catch(() => {
        this.errorLoading = false;
      });
  }

  public getProfile(): SoundProfile {
    return this.profile;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(v: number): void {
    this.volume = Math.max(0.1, Math.min(1, v));
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("soundVolume", String(this.volume));
    }
    this.playKey("press");
  }

  public setProfile(p: SoundProfile): void {
    this.profile = p;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("soundProfile", p);
    }
    if (p !== "off") {
      const ctx = this.ensureContext();
      if (ctx) {
        const raw = PROFILE_BASE_PACK[p];
        if (raw) {
          this.loadRawPack(ctx, raw);
        }
        setTimeout(() => this.playKey("press"), 40);
      }
    }
  }

  public playKey(keyType: KeyType = "press"): void {
    if (this.profile === "off") return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Synthesized audio profiles (Zero network requests, instant playback)
    if (this.profile === "pop") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const startFreq = keyType === "space" ? 380 : keyType === "backspace" ? 540 : 460 + Math.random() * 60;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.05);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.4 * this.volume, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
      return;
    }

    if (this.profile === "pentatonic") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";

      const freq = PENTATONIC_FREQS[this.pentatonicIndex % PENTATONIC_FREQS.length];
      this.pentatonicIndex++;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.35 * this.volume, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
      return;
    }

    if (this.profile === "beep") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      const freq = keyType === "space" ? 640 : keyType === "backspace" ? 1100 : 880;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.18 * this.volume, now + 0.002);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.038);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
      return;
    }

    if (this.profile === "hitmarker") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(keyType === "space" ? 1800 : 2600, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.025);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.3 * this.volume, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
      return;
    }

    // 2. Sample-based audio profiles (Raw recordings & modeled switch acoustic filters)
    const rawPack = PROFILE_BASE_PACK[this.profile] ?? "creams";
    const packBuffers = this.buffers[rawPack];
    if (!packBuffers || packBuffers.length === 0) {
      this.loadRawPack(ctx, rawPack);
      return;
    }

    const sample = packBuffers[Math.floor(Math.random() * packBuffers.length)];
    const src = ctx.createBufferSource();
    src.buffer = sample;

    const gain = ctx.createGain();
    let playbackRate = keyType === "space" ? 0.92 : keyType === "backspace" ? 1.06 : 1.0;
    let gainValue = 0.85 * this.volume;

    // Switch acoustic modeling profiles
    if (this.profile === "holy_panda") {
      playbackRate *= 0.84;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1900;
      gainValue = 0.95 * this.volume;
      src.playbackRate.value = playbackRate;
      gain.gain.value = gainValue;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now);
      return;
    }

    if (this.profile === "mx_blue") {
      playbackRate *= 1.22;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 650;
      gainValue = 0.75 * this.volume;
      src.playbackRate.value = playbackRate;
      gain.gain.value = gainValue;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now);
      return;
    }

    if (this.profile === "mx_brown") {
      playbackRate *= 1.12;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1250;
      filter.Q.value = 0.8;
      gainValue = 0.82 * this.volume;
      src.playbackRate.value = playbackRate;
      gain.gain.value = gainValue;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now);
      return;
    }

    if (this.profile === "mx_black") {
      playbackRate *= 0.72;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1100;
      gainValue = 0.9 * this.volume;
      src.playbackRate.value = playbackRate;
      gain.gain.value = gainValue;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now);
      return;
    }

    if (this.profile === "topre") {
      playbackRate *= 0.64;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 750;
      gainValue = 1.0 * this.volume;
      src.playbackRate.value = playbackRate;
      gain.gain.value = gainValue;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now);
      return;
    }

    if (this.profile === "model_m") {
      playbackRate *= 1.32;
      const filter = ctx.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = 2300;
      filter.gain.value = 6;
      gainValue = 0.85 * this.volume;
      src.playbackRate.value = playbackRate;
      gain.gain.value = gainValue;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now);
      return;
    }

    // Default playback (creams, typewriter, click, osu)
    src.playbackRate.value = playbackRate;
    gain.gain.value = gainValue;
    src.connect(gain).connect(ctx.destination);
    src.start(now);
  }

  public playError(): void {
    if (this.profile === "off") return;
    const ctx = this.ensureContext();
    if (!ctx || !this.errorBuffer) return;

    const src = ctx.createBufferSource();
    src.buffer = this.errorBuffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.55 * this.volume;
    src.connect(gain).connect(ctx.destination);
    src.start(ctx.currentTime);
  }
}

export const soundEngine = new SoundEngine();
