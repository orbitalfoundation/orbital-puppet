# 2026-06-25 — orbital-puppet: bus migration + modernization research & plan

Status: **planning only, no code changed.** This devlog captures (a) how puppet works today,
(b) a deep research pass on the 2025–2026 landscape for the fragile parts (TTS timing/visemes,
LLM, STT/VAD, lip-sync), and (c) a staged plan + open decisions. Sources are inline.

---

## 0. TL;DR

- **The "pipe TTS audio back through Whisper to recover word timing" hack is now obsolete.** The
  timing was always inside the VITS/Kokoro **duration predictor**; `@diffusionstudio/vits-web`
  just never surfaced it. Modern exports/wrappers expose it directly.
- **Keystone replacement: [HeadTTS](https://github.com/met4citizen/HeadTTS)** — from the *same
  author* (met4citizen) whose lip-sync code we already borrow. It's a Kokoro-82M neural TTS that
  runs **in-browser** (WebGPU/WASM) and emits **audio + word/phoneme timestamps + Oculus visemes
  directly**, MIT, CDN-importable (bundler-free). Our `perform/visemes.js` already consumes Oculus
  visemes, so it's close to a drop-in and **deletes `chat/stt-diarization.js` entirely** (398
  lines + a whole Whisper model).
- Work splits into **Stage 0: bus + volume migration** (mechanical, mirrors orbital-volume) and
  **Stage 1+: modernization** (HeadTTS, LLM refresh, STT/VAD cleanup).
- Four decisions are the user's to make (see §7).

---

## 1. How puppet works today

ECS / late-binding, same as orbital-volume. One entity (`alexandria` in `index.js`) carries
`volume + puppet + llm + tts + diarization + config` components; each service in the manifest
observes its component. Imports the **old `orbital-sys`** and the **local `orbital-volume`**.

Conversational pipeline:
```
LLM (chat/llm.js)          WebLLM local (mlc-ai) or remote OpenAI/Ollama → text in "breath" fragments
TTS (chat/tts.js)          VITS WASM worker (@diffusionstudio/vits-web@1.0.3) → audio, NO timing
DIARIZATION                ⚠️ the hack: TTS audio → onnx-community/whisper-small_timestamped
(chat/stt-diarization.js)     (transformers.js) → word timestamps
LIPSYNC                    met4citizen code (talking-heads/lipsync-queue.js, lipsync-en.js):
                              words→phonemes→Oculus visemes → timed `anim` sequence
PERFORM (perform/*.js)     visemes (15 Oculus targets) + blink + gaze + emote on the rig
```
Voice input: `chat/stt-whisper.js` + `ricky0123/vad` (barge-in), or built-in STT. Render:
orbital-volume. Config in `index.js` uses a **Piper voice** (`en_US-hfc_female-medium`) and
`llm_local: true` (WebLLM) by default, with remote OpenAI/Ollama paths commented in.

The README's own Revision 4 already admits: *"running whisper after tts is silly … the tts is
not returning exact word timings."* That's the thing the research below resolves.

---

## 2. Viseme timing — the big win

**Core mechanism (most important finding):** VITS-family models (Kokoro, Piper, StyleTTS2) run a
*duration predictor* that emits per-phoneme frame counts *before* the vocoder. Divide by the
model's frame rate (Kokoro ≈ 80) → phoneme/word start/end times. No forced alignment, no STT. The
catch: a *standard* ONNX export consumes that tensor internally and doesn't expose it; a
*timestamped* export does.

### Browser-local TTS that exposes timing/visemes
| Option | Timing | Visemes | Notes | License |
|---|---|---|---|---|
| **HeadTTS** ⭐ | word + phoneme | **Oculus 15 directly** | Kokoro-82M ONNX, WebGPU ~0.27 RTF / WASM; CDN `@met4citizen/headtts@1.3/+esm`; **English-only** | MIT (Kokoro Apache-2.0) |
| **Kokoro-82M-v1.0-ONNX-timestamped** | word/phoneme (raw `durations` tensor ÷80) | derive yourself | for custom pipelines via onnxruntime-web / transformers.js | Apache-2.0 |
| **piper-plus** (ayutaz) | phoneme (JSON/TSV/SRT) | derive (feed Mika's lipsync) | **keeps our current Piper voice**, WASM browser build, **multilingual** | MIT (note: OHF-Voice piper fork is GPL — avoid) |
| stock `kokoro-js`, stock transformers.js TTS, `@diffusionstudio/vits-web`, sherpa-onnx, KittenTTS | ❌ none | — | audio-only — would force the STT hack | various |

### Cloud TTS that exposes timing/visemes
| Provider | Timing | Visemes | Browser | Latency | Note |
|---|---|---|---|---|---|
| **Cartesia Sonic** ⭐ | **word + phoneme** | derive (phoneme→viseme is direct) | ✅ ephemeral token + WS | ~40–100 ms | lowest latency; best cloud fit for Oculus rig |
| **Azure Neural TTS** | viseme-offset | **native: 22 viseme IDs + 55 ARKit blendshapes @60fps** | ✅ JS Speech SDK | standard | only native-viseme option (ARKit-ordered, not Oculus) |
| **Amazon Polly** | word + **viseme** speech marks | native (IPA visemes) | proxy | — | generative engine drops speech marks; use standard/neural |
| **Rime** | word only | derive | ✅ WS (proxy) | ~120–225 ms | has on-prem option |
| **ElevenLabs** | **character-level only** | derive | ✅ | ~75 ms | char timestamps, not phonemes/visemes |
| OpenAI TTS, Deepgram Aura, PlayHT | ❌ none | — | proxy | — | **ruled out** — audio-only, would force the STT hack |

### Audio-driven fallback (engine-agnostic, for any TTS without timing)
- **wawa-lipsync** (MIT, 190★): Web Audio FFT → emits the exact RPM Oculus morph names
  (`viseme_aa`, `viseme_PP`…). Real-time, drops straight onto an RPM avatar. Frequency-heuristic
  (approximate) but zero-config. https://github.com/wass08/wawa-lipsync
- **HeadAudio** (met4citizen, MIT): AudioWorklet, audio→Oculus visemes in real time.
- Higher acoustic quality: **wLipSync** (MFCC, MIT) — needs Unity-authored profiles.
- Offline highest fidelity: **Rhubarb** (MIT CLI) / `lip-sync-engine` WASM — 6–9 Preston-Blair
  shapes, map to RPM yourself; not real-time.

### TalkingHead upstream status
Healthy: v1.7.0 (Dec 2025), three.js r180, MIT. Still rule-based phoneme→viseme (Oculus). Lipsync
modules (`lipsync-en.mjs` etc.) are standalone, render-independent ES modules — our borrowed
approach remains legitimate, just better-fed. `speakAudio()` accepts `words/wtimes` **or**
`visemes/vtimes`. Spun out HeadTTS (text→visemes) and HeadAudio (audio→visemes).

---

## 3. Viseme / blendshape standards (for mapping)

- **Oculus / OVR (15)** — `sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, I, O, U`. RPM exposes
  these as `viseme_*` morph targets. **This is our rig's native set** (what perform/visemes.js uses).
- **ARKit (52)** — FACS muscle blendshapes (capture-oriented), not per-phoneme. RPM also ships these.
- **Azure (22 viseme IDs)** — finer (splits diphthongs, has ɝ/h); its blendshape mode = ARKit-52 +
  3 roll channels = 55 @60fps. Clean Azure-ID→Oculus mapping table exists (collapses diphthongs).
- **VRM (5 vowels)** — 0.x `A/I/U/E/O`; 1.0 `aa/ih/ou/ee/oh`. Any 15/22-viseme source must collapse
  to 5 (consonants approximated/dropped) unless the model carries extended VSeeFace consonant clips.
- Lossiness: Azure-22 → Oculus-15 → VRM-5. Biggest perceptible loss going to VRM is bilabial
  closure (PP/FF).

---

## 4. LLM (in-browser + remote)

- **WebLLM** (`@mlc-ai/web-llm` v0.2.84, Apache-2.0): in-browser WebGPU, **OpenAI-API compatible**
  (one URL swap to go cloud), **bundler-free** via `import * as webllm from "https://esm.run/@mlc-ai/web-llm"`.
  ~80% of native speed. Keep it.
- **transformers.js v4** (Feb 2026, `@huggingface/transformers`, Apache-2.0): WebGPU runtime
  rewritten in C++; alternative HF-native path; CDN-importable.
- **Small models** (Q4): Qwen2.5-0.5B (~491MB) / 1.5B (~940MB), Llama-3.2-1B (~808MB), Phi-3.5-mini
  (MIT, ~2GB), SmolLM2. Most permissive: **Qwen2.5 & SmolLM2 (Apache), Phi-3.5 (MIT)**; Llama 3.2
  (community license) and Gemma (Gemma terms) have restrictions.
- **WebGPU** is now default in all major browsers (Chrome 113+, Safari 26 / iOS 26, Firefox 141+
  Windows). The old "WebGPU required" pain is mostly gone *on desktop*.
- **Mobile reality (unchanged pain):** iOS Safari buffer caps (256MB–~1GB), tabs crash ~100–200MB;
  only ≤~1B models reliably run. **Plan: desktop → local WebLLM; mobile → tiny model or hosted.**

---

## 5. STT + VAD (voice input — the Revision-3 nightmare)

- **STT:** **Moonshine** (Tiny 27M / Base 58M, MIT, CDN ESM) is the fast browser-local choice now —
  beats Whisper-Tiny on speed *and* accuracy for short utterances; replaces the sluggish Xenova
  whisper-web. whisper-turbo is accurate but ~1.5GB — wrong tool. *(moonshine-js still depends on
  ricky0123/vad.)*
- **Web Speech API is finally viable on Chromium** — Chrome 139 (Aug 2025) added real **on-device**
  mode (`processLocally`, `install()`, `available()`); lowest latency, no download. Not sole
  solution (Safari cloud-only, Firefox flagged off) → pair with Moonshine fallback. Worth revisiting
  since the README wrote off built-in STT.
- **Echo / barge-in — clean modern answer:**
  1. The #1 missed gotcha: browser AEC only cancels audio it can *see*. Decoding TTS PCM and
     scheduling raw `AudioBuffer`s yourself **defeats AEC** → mic re-hears the avatar. Route TTS
     through an `<audio>`/WebAudio path the browser models; enable `echoCancellation`; allow 2–5s
     warm-up.
  2. Replace naive VAD-gating with **Silero VAD + Smart Turn v3** (pipecat, 8MB, ~12ms CPU semantic
     end-of-turn). `ricky0123/vad` still has no built-in AEC (issue #190 open).

---

## 6. Realtime / all-in-one conversational APIs — surveyed, and they DON'T fit

OpenAI Realtime, Gemini Live, ElevenLabs Conversational, Hume EVI, and the voice-agent frameworks
(Pipecat BSD, LiveKit Agents Apache, Vapi, Retell, Daily/Pipecat-Cloud) were all checked. **None
emit native viseme/phoneme/word-timing** — they stream PCM audio + (at most) an untimed transcript.
Their "avatar" story is either (a) derive visemes client-side from audio (wawa-lipsync / HeadAudio),
or (b) forward audio to an avatar-as-a-service (Simli/Tavus/HeyGen/D-ID) that returns **rendered
video, not viseme data** — which can't drive our custom three.js mesh. Hume EVI uniquely streams
**emotion/prosody scores** — irrelevant to lip-sync but a possible future feed for the *emote/mood*
layer (`perform/emote.js`). Net: these trade away the no-strings-local ethos and still need a
viseme layer, so they're **not the default** — at most a "cloud easy mode."

---

## 7. The staged plan

- **Stage 0 — Bus + volume migration (mechanical, ship first).** `orbital-sys → @orbitalfoundation/bus`
  (`createBus` + `bus.resolve([...])`, `resolve(event,bus)`); local `orbital-volume →
  @orbitalfoundation/orbital-volume`. Same `sys`→`bus` / `uuid`→`id` work as volume. Get puppet
  running on the new stack with the *existing* pipeline untouched. Independent of all decisions below.
- **Stage 1 — Kill the timing hack via HeadTTS.** Swap `chat/tts.js`; **delete
  `chat/stt-diarization.js`**; feed HeadTTS's native Oculus visemes/timing into `perform/visemes.js`.
  Keep a cloud TTS path (Cartesia or Azure) + wawa-lipsync/HeadAudio fallback for no-timing audio.
- **Stage 2 — LLM refresh.** Keep WebLLM (bundler-free) + remote; update models; mobile-aware default.
- **Stage 2b — Voice-input cleanup.** Moonshine (or Web Speech on-device) + the AEC-routing fix +
  Silero/Smart-Turn.
- **Stage 3 — Three modes = three manifests** on one engine: chat+puppet (current `index.html`),
  corner-overlay "ambassador" (cf. `orbital2024/orbital-website/orbital-pitch2`), 3D world (cf.
  prismatic.blue). Cheap once migrated; preserves super-late-binding.
- **Stage 4 (optional) — viseme quality + full-face "emotional" performance** (the README's
  aspiration), evaluating HeadTTS vs HeadAudio vs wawa-lipsync.

## Open decisions (the user's call)
1. **Local TTS engine:** **HeadTTS** (switch to a Kokoro voice, least work, native Oculus visemes)
   **vs piper-plus** (keep the current Piper voice `en_US-hfc_female-medium`, smaller change, feed
   Mika's mapping). HeadTTS is English-only; piper-plus is multilingual.
2. **Default posture:** local-first on desktop + **hosted fallback on mobile** (recommended) vs
   all-local everywhere (mobile will struggle).
3. **Cloud TTS when used:** **Cartesia** (phoneme timing, ~40ms, Oculus-friendly) vs Azure (native
   visemes, ARKit-shaped).
4. **Publish as `@orbitalfoundation/orbital-puppet`** too (like volume)?

Recommendation: start **Stage 0** (safe, decision-independent, identical playbook to orbital-volume),
then Stage 1 with HeadTTS.

---

## Key sources
- HeadTTS https://github.com/met4citizen/HeadTTS · HeadAudio https://github.com/met4citizen/HeadAudio · TalkingHead https://github.com/met4citizen/TalkingHead
- Kokoro timestamped ONNX https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX-timestamped · piper-plus https://github.com/ayutaz/piper-plus
- Cartesia timestamps https://docs.cartesia.ai/api-reference/tts/sse · Azure visemes https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme · Polly speech marks https://docs.aws.amazon.com/polly/latest/dg/using-speechmarks.html
- WebLLM https://github.com/mlc-ai/web-llm · transformers.js v4 https://huggingface.co/blog/transformersjs-v4
- Moonshine https://github.com/moonshine-ai/moonshine-js · Web Speech on-device https://github.com/WebAudio/web-speech-api/blob/main/explainers/on-device-speech-recognition.md · Smart Turn v3 https://huggingface.co/pipecat-ai/smart-turn-v3 · ricky0123/vad https://github.com/ricky0123/vad
- wawa-lipsync https://github.com/wass08/wawa-lipsync · Rhubarb https://github.com/DanielSWolf/rhubarb-lip-sync · wLipSync https://github.com/mrxz/wLipSync
- RPM morph targets https://docs.readyplayer.me/ready-player-me/api-reference/avatars/morph-targets · VRM expressions https://github.com/vrm-c/vrm-specification
