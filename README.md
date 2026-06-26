# Orbital Puppet

A voice-to-voice, LLM-driven **3D talking puppet** that runs in the browser — all-local (in-browser
LLM/TTS/STT via WASM/WebGPU) or wired to cloud APIs. Embodied, reactive, no bundler.

![puppet screenshot](screenshot.png?raw=true "puppet")

## Run

Static ES modules — serve the folder and open `index.html`:

```sh
npx serve .
```

Demo: https://orbitalfoundation.github.io/orbital-puppet/

## How it works

Built on [`@orbitalfoundation/bus`](https://github.com/orbitalfoundation/orbital-bus) (late-binding
pub/sub) and [`@orbitalfoundation/orbital-volume`](https://github.com/orbitalfoundation/orbital-volume)
(declarative three.js). One entity (see [`index.js`](index.js)) is decorated with
`volume + puppet + llm + tts` components; independent services observe the shared traffic and
cooperate — the app self-assembles from the manifest:

- **STT** — speech in (Whisper + VAD barge-in)
- **LLM** — reasoning (local WebLLM or remote OpenAI/Ollama), emitted in "breath" fragments
- **TTS** — speech out, with viseme timing for lip-sync
- **PUPPET** — drives visemes, gaze, blink, and emotion on a Ready Player Me rig

## Design notes & devlog

This is an older project with a lot of accumulated thinking, kept out of this README and in
[`devlog/`](devlog):

- [20240801 — original design + Rev 1–4 history](devlog/20240801-original-design-and-revisions.md) (the rationale, the lip-sync/TTS/STT research, why each choice was made)
- [20260625 — bus migration + modernization research & plan](devlog/20260625-bus-migration-and-modernization-research.md) (the move to `@orbitalfoundation/bus`, killing the TTS→STT timing hack via HeadTTS, and the staged plan)

## License

MIT
