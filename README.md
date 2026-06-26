# Orbital Puppet

A voice-to-voice, LLM-driven **3D talking puppet** that runs in the browser — all-local (in-browser
LLM/TTS/STT via WASM/WebGPU) or wired to cloud APIs. Embodied, reactive, no bundler.

![Alex, the conversational ambassador, embedded on a web page](puppet-example.png?raw=true "Orbital Puppet — an embeddable ambassador")

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
- [20260626 — implementation: Stage 0 + Stage 1](devlog/20260626-implementation-stage0-1.md) (what actually got built: bus migration, HeadTTS, cleanup, and what's left)

## Credits

The lip-sync and viseme work here stands on the shoulders of **Mika Suominen
([@met4citizen](https://github.com/met4citizen))**, and this project is grateful for it:

- **[TalkingHead](https://github.com/met4citizen/TalkingHead)** — the phoneme → Oculus-viseme
  lip-sync approach. The modules under [`talking-heads/`](talking-heads) are derived from his
  MIT-licensed code (`lipsync-en`, the lipsync queue, anim moods/emojis).
- **[HeadTTS](https://github.com/met4citizen/HeadTTS)** — the in-browser Kokoro TTS that returns
  audio together with native Oculus visemes and timing, which this project uses for speech and
  lip-sync (and which let us delete an entire Whisper-based timing hack).

Thank you, Mika.

## License

MIT

