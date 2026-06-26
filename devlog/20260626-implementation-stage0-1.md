# 2026-06-26 — implementation: Stage 0 (bus migration) + Stage 1 (HeadTTS)

Implemented autonomously per "keep going, push as far as you can." Follows the plan in
[20260625-bus-migration-and-modernization-research.md](20260625-bus-migration-and-modernization-research.md).
**Not yet verified in a browser** — syntax-clean (`node --check`) and matched to the real HeadTTS API,
but the runtime behavior (esp. the audio/viseme timing) needs an in-browser eyeball.

## Done

**Stage 0 — bus + volume migration** (commit `db2cbb5`)
- `orbital-sys` → `@orbitalfoundation/bus`; local `orbital-volume` → published
  `@orbitalfoundation/orbital-volume` (index.html import map, index.js `createBus`/`bus.resolve`).
- Every service dropped the old global `sys()`: it now captures `bus` from `resolve()`'s 2nd arg
  on registration, `sys({...})` → `bus.resolve({...})`, and exports an `id`. Uniform, cleaner.

**Stage 1 — HeadTTS, the timing hack is dead** (commits `89fc58f`, `9f6364f`)
- `chat/tts.js` uses **HeadTTS** (Kokoro, in-browser) — audio + Oculus visemes + timing in one call,
  published as `perform.lipsync`. Wired to HeadTTS's real `onmessage` API (verified against its demo:
  `message.type==='audio'`, `message.data` carries audio + visemes together; `transformersModule` +
  `voiceURL` CDN URLs; `audioEncoding:'wav'`, no `audioCtx` so audio comes back encoded).
- **Deleted `chat/stt-diarization.js`** + its manifest entry + the dead `diarization` component — the
  whole "TTS audio → Whisper → recover timing" hack is gone.
- `perform/visemes.js`: `visemes_sequence` builds the anim sequence straight from HeadTTS Oculus
  visemes (`vtimes`/`vdurations`), with a word-timing fallback for cloud TTS without visemes.
- `perform/puppet.js`: `perform.whisper` → `perform.lipsync`.
- `chat/audio.js`: robust decode (AudioBuffer | ArrayBuffer | typed-array), default-rate AudioContext
  (HeadTTS is 24 kHz), tidier queue.
- `index.js`: voice → `af_bella` (Kokoro).

**Stage 2 — LLM**: no change needed. `chat/llm.js` already imports WebLLM via `esm.run` (latest) and
runs `Llama-3.2-1B-Instruct-q4f32_1-MLC` — a current, research-endorsed small model. The local/remote
toggle (`llm_local`) already covers the desktop-local / mobile-hosted split.

**Cleanup**: removed dead `effect.js` (empty) and `unused/` (spectograph, rawaudio2viseme); slimmed
README into `devlog/` (original preserved as `20240801-original-design-and-revisions.md`).

## Known risks / things to watch in-browser
1. **HeadTTS runtime envelope** — coded to the demo's `onmessage`/`message.data` shape, but if the
   audio field isn't a decodable wav buffer (e.g. it's a raw PCM typed-array or an AudioBuffer),
   `audio.js`'s `toAudioBuffer()` already handles AudioBuffer + ArrayBuffer + typed-array; a raw-PCM
   case (no wav header) would need a `createBuffer` path. Watch the console on first speech.
2. **Viseme timing offset** — `visemes.js` `LEAD = 0`; `vtimes` are ms from audio start and we anchor
   at `performance.now()` when playback begins. If lips lead/lag, tune `LEAD`.
3. **Remote (OpenAI) TTS has no lip-sync** — audio only. Cartesia (phoneme timing) is the follow-up.
4. **three.js 0.176 vs volume built on 0.148** — likely fine (volume uses modern `outputColorSpace`),
   but first suspect if rendering looks off. Latitude given to patch volume.

## Not done (follow-ups, some need you)
- **Browser verification** of the HeadTTS speech + lip-sync (the one real unknown).
- **Stage 2b** — Moonshine STT + the AEC barge-in fix (route TTS through an AEC-visible path + Smart
  Turn v3). Voice input currently uses the built-in `stt-sys.js`.
- **Stage 3** — the three modes (chat / corner-overlay ambassador / 3D world) as three manifests, and
  an embeddable module entry (puppet is meant to be "stuffed on a website easily").
- **Publish `@orbitalfoundation/orbital-puppet`** — needs (a) the embeddable-module entry above and
  (b) your npm OTP (the token is a Publish-type, so each publish needs a fresh 2FA code).
