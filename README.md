# Orbital Puppet

A 'no strings attached' voice-to-voice conversational 3d puppet with rigged face visemes for the browser.

See a demo at https://orbitalfoundation.github.io/orbital-puppet/

Notes:

Intended to be driven within an orbital-sys based system ( see https://github.com/orbitalfoundation ) but can probably be made to work standalone as well. You will need to load your own 3d model if you don't leverage the orbital tooling - see https://github.com/orbitalfoundation/orbital-volume for the model loader used here.

Animates eyes, mouth visemes, facial expressions, head rotation.

Generates open whisper stt data including word timestamps. Leverages Mika's viseme generator here: https://github.com/met4citizen/TalkingHead although may eventually switch to a trained neural network for audio to visemes.

## Why have embodied puppets?

* Embodied interfaces may be satisfying to people who are not adapted to 2d interfaces or who were not part of the first wave of technology adoption. For example less than 20% of people can touch type fluently, and there are still billions of people who have never used a computer.

* As humans we have wetware that processes human faces and gestures. It can be a more powerful learning mechanism or communication mechanism - there may be some papers on this.

* Syncing mouth movement provides a sense of presence and aliveness - the avatar is more engaging.

* Presence as a whole is conveyed by accurate emotions, breath pauses and breathing, body guestures matching conversation, body language in general, blinking, facial ticks, and gaze as well.

* Uncanny Valley. Avatars do not need to look real. RPM models are actually pretty much perfect.

## Code layout

The design consists of several independent pieces wired together:

```
1) STT - speech to text support based on vits open whisper
		- publishes stt events
		- publishes barge-in events (using a voice activity detector)

2) UX - [deprecated - see example code in index.js that does this instead]
	  - a fragment of html that produces a text chat input window
		- listens to stt events and may disallow interruptions
		- listens to barge-in events and may disallow them if settings are disallowed
		- listens to 'status' events and paints to the status bar
		- listens to 'history' events and paints to the chat history
		- publishes chat events

3) LLM - a wasm based llm that only runs on desktop or higher powered devices
		- listens to chat events
		- listens to barge-in events and aborts any ongoing reasoning if out of date
		- publishes status events
		- publishes history events
		- publishes 'breath' events

4) TTS - a wasm based tts component; also has its own stt in order to get word timings for visemes
		- listens to breath events
		- listens to barge in events to abort out of date tts work
		- publishes audio out events

5) PUPPET - a 3js and readyplayerme rigged 3d puppet
		- listens to audio_in events
		- listens to barge-in events and aborts out of date animation work
		- publishes status out events on audio completion
```

## Manifests

This system leverages orbital-sys which has an idea of declarative manifests. There are some manifests here that describe the system as a whole.

1) LLM description manifest. Describes a single LLM in the 'scene' - with an idea that at some point there may be more than one.

2) Scene overall. Simply describing lighting, camera, avatar and the like.

3) The above code components and wiring is also described in the same declarative grammar.

# Revisions

## Revision 1: Text (done)

In the first pass I threw together a text based interface to client side llm - basically just a shim around this client side llm module:

  https://github.com/mlc-ai/web-llm

The completed goals for the first pass were:

1) Cleary handle user input using text chat window
2) Clearly indicate status of llm: loading, thinking, speaking ready
3) Allow forced stopping of the bot at any time
4) Use a 'breath' segmentation approach to break response into fragments

Notes:

* orbital-sys -> I use another project of mine https://github.com/orbitalfoundation/orbital-sys as a pubsub module to decouple components. This is experimental.

* Vite -> Stopped using vite as a compiler - there seems to be some issue with dynamic imports and service workers.

* Mobile -> There is still an issue with mobile being crushed by the weight of the llm model and the requirement for WebGPU. I feel like this will be generally improved by the industry over the next few months, but you can try other models. On iOS you have to enable webgpu. However even then it may still crash on mobile since the default model is so large.

* Service Workers -> For some reason service workers seem starved of gpu/cpu - disabled.

## Revision 2: Voice Output (done)

In the second pass I added voice output using wasm based blobs (as opposed to built in speech generation).

Goals that were accomplished here:

1) Avoid built in speech output support due to lack of viseme support for word timing and inability to intercept audio data at all, or accurate time estimation, and also due to low quality voices.

2) Evaluate WASM based TTS. Try different background worker solutions for lowest possible latency in TTS generation. This is the choice I ended up with: https://www.npmjs.com/package/@diffusionstudio/vits-web - https://huggingface.co/docs/transformers/en/model_doc/vits . 

3) Speak in breath fragments. Send each fragment for audio processing right away. It may also make sense to introduce 100 or 200 millisecond gaps between breath fragments to listen for human interruption (a later feature).

## Revision 3: Voice Input (done)

Goals: The human participant should be able to speak naturally and have the llm capture complete sentences which it should then translate to text locally, and then be able to respond intelligently. As a critical feature the human should be able to interrupt the llm (this is referred to as 'barge in' and requires a 'vad' - voice activity detector).

Notes:

* This is an excellent VAD that runs on mobile without requiring webgpu: https://github.com/ricky0123/vad

* The built in voice support does not participate in audio echo cancelation - so the browser will hear itself talking and think that is human input. Also, even starting or stopping the built-in voice support seems to somehow disable AEC - overally built in voice support is poorly written, and doesn't play well with others.

Approaches and workarounds:

- [YES] Hook up a barge-in detector while using built in STT. Not great results, built in STT is pretty buggy.
- [YES] Use a voice activity detector in general and use a web based whisper module. Works, is a bit sluggish.
- [YES] Provide more visual feedback cues on VAD (would help)
- [NO] Turning off the microphone during speaking - tested - works "ok" but the lack of barge-in can be annoying.
- [NO] Try built in speech to text. Tested and it is terrible.
- [NO] Have a 'stop talking' button? (not hands free)
- [NO] Have a 'press to speak' button? (not hands free)
- [NO] Pause briefly in sentences to listen for barge in (not so strong as an idea)
- [NO] Semantic level analysis of voice to detect self-vocalizations (hmmm probably too much latency; VAD is better)
- [NO] Try just turning down the browser volume? (Tested and actually it works "ok")
- [NO] Fallback to server side Voice Recognition? (I'd prefer not to do this because I want a no strings client)

Other resources:

- https://github.com/ricky0123/vad
- https://picovoice.ai/blog/javascript-voice-activity-detection/ 
- https://github.com/kdavis-mozilla/vad.js/

- https://webrtc.googlesource.com/src/+/refs/heads/main/modules/audio_processing/aec3/
- https://www.mathworks.com/help/audio/ug/acoustic-echo-cancellation-aec.html#
- https://news.ycombinator.com/item?id=40918152
- https://dev.to/fosteman/how-to-prevent-speaker-feedback-in-speech-transcription-using-web-audio-api-2da4

- https://github.com/huggingface/transformers.js/tree/v3/examples/webgpu-whisper (works well)
- https://huggingface.co/distil-whisper/distil-small.en
- https://github.com/pluja/whishper -> https://github.com/m-bain/whisperX (not standalone)
- https://github.com/Vaibhavs10/insanely-fast-whisper (not standalone)
- https://github.com/ggerganov/whisper.cpp (unfortunately does not work on mobile SIMD WASM issue)
- https://github.com/homebrewltd/ichigo (interesting but not exactly what we want)
- https://github.com/FL33TW00D/whisper-turbo (webgpu)
- https://huggingface.co/spaces/Xenova/distil-whisper-web (seems slow?)
- https://huggingface.co/spaces/Xenova/whisper-web
- https://huggingface.co/spaces/Xenova/whisper-word-level-timestamps
- https://www.reddit.com/r/LocalLLaMA/comments/1fvb83n/open_ais_new_whisper_turbo_model_runs_54_times/ 


## Revision 4: Animated Pupppet (done) 

The primary challenge of an animated puppet face is to map audio to facial performances. I used the first approach below for now. These are a few approaches:

1) Mika's work here is excellent - he exercises a few approaches and this is what I dropped into this project: https://github.com/met4citizen/TalkingHead . Whisper is used to get word timings and then phonemes are mapped to visemes and overall the effect is quite good. It still however tends to focus on just mouth related performance rather than an 'emotional' full face performance. Note also that running whisper after tts is silly - but the tts is not returning exact word timings. Ideally the original TTS generator (VITS at the moment) could do this - but it is not exposed in off the shelf builds. For now Xenova Whisper seems to do a good job of recovering word timing - see: https://huggingface.co/spaces/Xenova/whisper-web ).

2) STT without whisper. A similar approach not using whisper is to just take all the phonemes and 'smear them out' over the duration of the sound sample, and to then map those phonemes to visemes at that time.

3) Neural net approach. Other options here are to manufacture our own neural network that maps spectographic analysis of audio to visemes directly. There are several examples of this in the wild. NVIDIA of course has a well known audio to face model. Oculus had one also - these are both kind of opaque - with unclear licensing. There are several open source solutions, and today it would not be hard to train a model given the tools available (such as face tracking tools that already use oculus visemes):

- https://github.com/liukuangxiangzi/audio2viseme
- https://github.com/yzhou359/VisemeNet_tensorflow
- https://github.com/MicrosoftDocs/azure-ai-docs/blob/main/articles/ai-services/speech-service/how-to-speech-synthesis-viseme.md
- https://linchaobao.github.io/viseme2023/
- https://github.com/fire/mfcc-viseme-gan
- https://github.com/marty1885/OpenViseme
- https://stackoverflow.com/questions/73806104/make-a-realtime-realistic-3d-avatar-with-text-to-speech-viseme-lip-sync-and-em
- https://github.com/ggerganov/whisper.cpp/discussions/167
- https://build.nvidia.com/nvidia/audio2face-3d

## Other web based engines and references for face performances

https://github.com/met4citizen/TalkingHead <- used extensively in this project
https://github.com/bornfree/talking_avatar
https://discourse.threejs.org/t/add-lip-sync-to-existing-3d-model-of-head/49943
https://threejs.org/examples/webgl_morphtargets_face
https://github.com/exokitxr/avatars/blob/master/README.md

https://threejs.org/examples/webgl_morphtargets_face.html
https://hiukim.github.io/mind-ar-js-doc/more-examples/threejs-face-blendshapes/
https://docs.aws.amazon.com/polly/latest/dg/ph-table-english-us.html
http://www.visagetechnologies.com/uploads/2012/08/MPEG-4FBAOverview.pdf
https://www.youtube.com/watch?v=4JGxN8q0BIw ... a demonstration of the unsupported obsolete non-source code but not terrible oculus to viseme tool
https://crazyminnowstudio.com/posts/salsa-lipsync-in-webgl-with-amplitude/ 
https://x.com/trydaily/status/1815530613434417241 ... very nice circa summer 2024 responsive text chat with interruption detection
