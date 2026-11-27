"use client";

export type SoundEffectKey = "click" | "pass" | "wrong";

export const SOUND_FILES: Record<SoundEffectKey, string> = {
  click: "/sounds/annut.mp4",
  pass: "/sounds/dungdapan.mp4",
  wrong: "/sounds/sai.mp4",
};

const MUTE_STORAGE_KEY = "ccv_sound_muted";

let audioCtx: AudioContext | null = null;
const decodedBuffers = new Map<SoundEffectKey, AudioBuffer>();
const decodingPromises = new Map<SoundEffectKey, Promise<AudioBuffer | null>>();
const htmlAudioPool = new Map<SoundEffectKey, HTMLAudioElement>();
let activeFeedbackSource: AudioBufferSourceNode | null = null;
let activeFeedbackElement: HTMLAudioElement | null = null;
let activeClickSource: AudioBufferSourceNode | null = null;
let preloaded = false;

function canUseAudio(): boolean {
  return typeof window !== "undefined";
}

function getAudioContext(): AudioContext | null {
  if (!canUseAudio()) return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) {
      audioCtx = new Ctor();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function getHtmlAudio(key: SoundEffectKey): HTMLAudioElement | null {
  if (!canUseAudio()) return null;
  let el = htmlAudioPool.get(key);
  if (!el) {
    el = new Audio(SOUND_FILES[key]);
    el.preload = "auto";
    el.volume = key === "click" ? 0.72 : 0.9;
    htmlAudioPool.set(key, el);
  }
  return el;
}

async function ensureBuffer(key: SoundEffectKey): Promise<AudioBuffer | null> {
  if (decodedBuffers.has(key)) return decodedBuffers.get(key) ?? null;
  if (decodingPromises.has(key)) return decodingPromises.get(key) ?? null;

  const ctx = getAudioContext();
  if (!ctx) return null;

  const task = (async () => {
    try {
      const response = await fetch(SOUND_FILES[key], { cache: "force-cache" });
      if (!response.ok) return null;
      const arr = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arr);
      decodedBuffers.set(key, buffer);
      return buffer;
    } catch {
      return null;
    } finally {
      decodingPromises.delete(key);
    }
  })();

  decodingPromises.set(key, task);
  return task;
}

export function isSoundMuted(): boolean {
  if (!canUseAudio()) return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean) {
  if (!canUseAudio()) return;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // ignore storage errors
  }
  if (muted) {
    stopAllSounds();
  }
  window.dispatchEvent(new CustomEvent("ccv-sound-mute-change", { detail: { muted } }));
}

export function stopAllSounds() {
  try {
    activeClickSource?.stop();
  } catch {}
  activeClickSource = null;
  try {
    activeFeedbackSource?.stop();
  } catch {}
  activeFeedbackSource = null;
  if (activeFeedbackElement) {
    try {
      activeFeedbackElement.pause();
      activeFeedbackElement.currentTime = 0;
    } catch {}
    activeFeedbackElement = null;
  }
}

export function preloadSounds() {
  if (!canUseAudio() || preloaded) return;
  preloaded = true;
  (["click", "pass", "wrong"] as SoundEffectKey[]).forEach((key) => {
    const el = getHtmlAudio(key);
    el?.load();
    void ensureBuffer(key);
  });
}

function playViaHtmlAudio(key: SoundEffectKey) {
  const baseEl = getHtmlAudio(key);
  if (!baseEl) return;

  if (key === "click") {
    const clone = baseEl.cloneNode(true) as HTMLAudioElement;
    clone.volume = 0.72;
    void clone.play().catch(() => {});
    return;
  }

  if (activeFeedbackElement) {
    try {
      activeFeedbackElement.pause();
      activeFeedbackElement.currentTime = 0;
    } catch {}
  }
  baseEl.currentTime = 0;
  baseEl.volume = 0.9;
  activeFeedbackElement = baseEl;
  void baseEl.play().catch(() => {});
}

export function playSound(key: SoundEffectKey) {
  if (!canUseAudio() || isSoundMuted()) return;

  if (key !== "click") {
    stopAllSounds();
  }

  const ctx = getAudioContext();
  const cachedBuf = decodedBuffers.get(key);

  if (ctx && cachedBuf && ctx.state === "running") {
    try {
      const source = ctx.createBufferSource();
      source.buffer = cachedBuf;
      const gain = ctx.createGain();
      gain.gain.value = key === "click" ? 0.72 : 0.92;
      source.connect(gain);
      gain.connect(ctx.destination);
      if (key === "click") {
        activeClickSource = source;
        source.onended = () => {
          if (activeClickSource === source) activeClickSource = null;
        };
      } else {
        activeFeedbackSource = source;
        source.onended = () => {
          if (activeFeedbackSource === source) activeFeedbackSource = null;
        };
      }
      source.start(0);
      return;
    } catch {
      // fall through to HTMLAudioElement
    }
  }

  // Trigger decode in background for next presses and play immediately via HTMLAudioElement
  void ensureBuffer(key);
  playViaHtmlAudio(key);
}
