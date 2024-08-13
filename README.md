# Puppet - May 2024

Real time open source web based conversational interfaces using 3d embodied puppets driven by llms with voice, facial and body performances leveraging many third party components.

Note that I fully expect this work to be obsolete within a few months. There is a rapidly growing body of work around the orchestration of embodied full body performances. We should see rapid evolution of the space within the next year or so - for example see the NVIDIA Audio2Face (https://youtu.be/DGEIRuXP8hQ?si=CNWY3I73q_SuK0YF) and ongoing research into body performances ( https://openhuman-ai.github.io/awesome-gesture_generation/ ).

## Features / Notes

	* input
		* text chat is supported
		* local voice recognition is used; not using any third party server
		* voice recognition with reasonable blocking support for not hearing active speaking puppets (npc doesn't hear npc)
		* escape key and detection of voice interruptions
		* new conversations pre-empt old conversations

	* llm and voice generation and audio timing
		* openai is used for reasoning
		* openai is used for voice generation
		* openai is used for stt whisper based voice timing estimation for visemes
		* could print the llm text to the chat window for clarity
		x could try groq - cannot get proxified cors stuff to work :(
		* make sure fragment on comma
		* llm via websocket
		* llm via local worker
		* tts and stt via local worker

	* facial performances
		* speaking - supported for rpm, cc4/reallusion and retargeted vrm rigs
		* blinking, facial ticks - supported for rpm, cc4/reallusion and retargeted vrms
		* head gaze turning and eye saccades - supported for rpm - body parts may need renaming for reallusion, vrm may need special indexing
		* gaze works with animation
		* optional vrm support with a blender python script that can be run in a commandline headless mode for bulk conversions

	* body performances
		* animations can be specified in scene and can play them with the text command '/anim dance' for example; there is a concept of a 'default' or idle animation also
		* there is reasonable blending between animations and the default animation just loops forever
		* npc gaze works even if in default - specifically circumvents head
		* optional mixamo converter support to convert fbx to glbs - as a headless blender python script for bulk conversions
		* llm prompt does deliver performance to animate body with
		* vrm body support using retargeting

## TODO

	* polish
		- the talking heads lipsync support has a few hacks in it and also should be later in pipeline, not in reasoning
		- remove 150 ms hack from talking heads
		- interruption support - see https://x.com/trydaily/status/1815530613434417241 for better voice stuff timing and interruption ?

##	Understanding Avatars, rigging, art pipelines, tools and resources

* Avatars in general

	* Ready Player Me (RPM) is an excellent source for custom avatars with permissive licensing
	* RPM supports exactly what we want for face animation - RPM GLB assets work "as is" with no changes at all; don"t even have to use blender.
	* Character Creator 4 (CC4) can also be used although licensing can be problematic depending on how you use it; use blender to convert to FBX to GLB
	* Reallusion and CC4 also provides avatars although licensing is problematic in some cases depending on your raw sources
	* Metahuman has licensing issues that preclude its use
	* There"s an emerging set of machine learning driven avatar solutions that may help soon for creating unencumbered avatar assets
	* Different avatar sources use different naming for bones and shapes often in arbitrary and annoying ways that require renaming prior to use
	* See https://www.youtube.com/watch?v=vjL4g8oYj7k for an example of where the industry is going for machine learning based solutions circa 2024

* Rigs, Shape Keys, Visemes

	* We are mostly focused on articulating the face/head with shape keys / blend shapes / morph targets (different tools use different words).
	* Internally we _only_ support Oculus and ARKit facial morph targets.
	* See: https://docs.readyplayer.me/ready-player-me/api-reference/avatars/morph-targets/oculus-ovr-libsync
	* See: https://docs.readyplayer.me/ready-player-me/api-reference/avatars/morph-targets/apple-arkit

* You can use Ready Player Me to create avatars - be certain to download ARKit and Oculus Viseme targets:

	* See: https://docs.readyplayer.me/ready-player-me/api-reference/rest-api/avatars/get-3d-avatars
	* Example: https://models.readyplayer.me/664956c743dbd726eefeb99b.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png

* GLB, FBX, Quirks

	* GLTF/GLB the preferred format that avatars can be specified in (Graphics Library Transmission Format); Blender supports it.
	* Note there"s an annoying industry split between T pose avatars and A pose avatars - you may have issues if your avatar is in A pose.
	* Mixamo can magically auto-rig avatars into a t-pose if you send an FBX and then apply a t-pose and then export again.
	* Blender is useful but there are a ton of small quirks to be aware of:
		- Sometimes textures are not opaque and this looks weird - you have to select the meshes then the materials and mark them as opaque / no alpha.
		- Weirdly Mixamo FBX animations don't play well in 3js - I tend to re-export them as glb animations with no skin via blender.
		- Sometimes Mixamo cannot understand texture paths; if you export from Mixamo with a skin you should be able to see the skin in Blender.

* VRMS specifically

	* Some developers like VRM for performance reasons for scenarios with many avatars.
	* This engine detects and supports VRM models that have the correct facial targets.
	* In this folder you should see a file called 'blender-puppet-rpm-to-vrm.py' which can be used to decorate VRM rigs with the RPM facial targets. This can be pasted into the blender scripting interface and run as is on a loaded VRM puppet if that VRM puppet arrives from a CC4 or Reallusion pipeline. - Otherwise you'll have to figure out some way to define the correct facial targets yourself (possibly by modifying this script or painfully remapping each desired shape key by hand in Blender - which may take hours).

	* For more commentary on VRM in general see:

	https://hackmd.io/@XR/avatars
	https://vrm-addon-for-blender.info/en/
	https://vrm.dev/en/univrm/blendshape/univrm_blendshape/
	https://vrm-addon-for-blender.info/en/scripting-api/
	https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/expressions.md

* body performances - other resources

	* https://openhuman-ai.github.io/awesome-gesture_generation/
	* https://medium.com/human-centered-ai/chi24-preprint-collection-hci-ai-0caac4b0b798
	* https://www.youtube.com/watch?v=LNidsMesxSE ... a detailed video on the state of the art in video-game animation blending
	* https://cascadeur.com ... a commercial animation blending system
	* https://assetstore.unity.com/packages/tools/animation/animation-designer-210513 ... an embeddable animation blending system

* facial performances

	* Puppet Synchronizes the mouth movements with the audio helps provide a sense of presence and aliveness that makes an avatar more engaging and evocative.
	* Presence is also conveyed by emotions (happy, sad, peplex), speaking pauses, synchronized body gestures, breathing, gaze, blinking and so on
	* Especially important to avoid uncanny valley effects - if you can"t make it absolutely real then don"t try - go for a cartoony effect instead
	* A speech to text tool (whisper) to understand spoken text and generate visemes (facial morph targets) to play back
	* Not supported yet: NVIDIA audio2face uses machine learning to translate raw audio to facial morph targets
	* See : https://www.nvidia.com/en-us/ai-data-science/audio2face/

* speech recognition

	* Whisper to convert audio to text in order to extract phonemes and visemes to later play back on the puppet
	* https://huggingface.co/spaces/Xenova/whisper-speaker-diarization/tree/main/whisper-speaker-diarization
	* https://console.groq.com/docs/speech-text
	* https://github.com/webaverse-studios/CharacterCreator/blob/stable/src/library/lipsync.js ... a cute raw audio to viseme converter amplitude hack
	* Oculus also has a real time audio to viseme tool but it is obsolete and runs only in some operating systems

* speech

	* There are many text to speech libraries you can use; just pick one you like

* voice recognition

	* We"ve found that the browser built in voice recognition is good enough
	* Interruption detection can be a hassle - we have attempted to deal with it by having pauses in speech and shorter soliloquies from the LLM

* reasoning

	* We just use chatgpt but you can use anything for reasoning that you like; even hard-coded decision trees
	* A worker based llm that is 100% local is also available
	* It"s best to carefully build your prompts to encourage LLM brevity as well as RAG to stay topic focused - this can be hard.

* Other web based engines for face performances

	https://github.com/met4citizen/TalkingHead <- used extensively in this project
	https://github.com/bornfree/talking_avatar
	https://discourse.threejs.org/t/add-lip-sync-to-existing-3d-model-of-head/49943
	https://threejs.org/examples/webgl_morphtargets_face
	https://github.com/exokitxr/avatars/blob/master/README.md

* Other random interesting references

	https://threejs.org/examples/webgl_morphtargets_face.html
	https://hiukim.github.io/mind-ar-js-doc/more-examples/threejs-face-blendshapes/
	https://docs.aws.amazon.com/polly/latest/dg/ph-table-english-us.html
	http://www.visagetechnologies.com/uploads/2012/08/MPEG-4FBAOverview.pdf
	https://www.youtube.com/watch?v=4JGxN8q0BIw ... a demonstration of the unsupported obsolete non-source code but not terrible oculus to viseme tool
	https://crazyminnowstudio.com/posts/salsa-lipsync-in-webgl-with-amplitude/ 
	https://x.com/trydaily/status/1815530613434417241 ... very nice circa summer 2024 responsive text chat with interruption detection

## The Puppet pipeline in general:

Generally:

1) Users can type or speak a query; the user needs to spatially be near the avatar.
2) Queries are piped to an LLM such as ChatGPT
3) The response paragraph has multiple 'sentences'. Each sentence may have an [emotion] in brackets as well if the llm is so prompted.
4) The response is broken into fragments based on the largest "breath" - such as separated by commas, dashes or periods.
5) Each fragment is piped to text to speech engine (in this case an OpenAI text to speech service)
6) The resultant audio blob is passed to a speech to text engine to extract the word timing (Whisper is used)
7) The entire result consisting of a text fragment, an audio fragment, and analyzed audio timing is sent to the client for playback
8) The client adds the new fragment to a playback queue
9) The client plays the next item on the queue when it is done with the previous
10) Audio starts and also the facial visemes synchronized with the audio playback
11) Eyes may fix the gaze on a nearby player and or move off the player randomly or gaze at other nearby players
12) Face emotional expression (happy, sad and so on) may be set if the LLM has specified an emotion
13) Eyes may saccade
14) Breathing may occur
15) Hand gestures may start or update randomly
16) Body pose fidgits may occur if idle
17) Tiny facial muscle movement fidgets may occur
18) Richer gestures such as pointing are not supported yet
19) The avatar does not turn to face the player yet

The support harness for the above capabilities includes:

* client/server model (all clients see the same puppet performance)
* buffering traffic; the client cannot play back all performances at once so a buffering scheme is needed
* squelching of traffic to prevent overloading of puppet (cannot talk to puppet while is is busy talking)
x coqui (python based TTS module that spits out phoneme timing information also) [deprecated]
* openai whisper and TTS support (replacing coqui)
* chat based text input dialog (a way to actually talk to the puppet if you don"t want to use voice)
* voice recognition (using built in browser capabilities
* voice recognition disabling while puppets are speaking (to prevent them responding to themselves)
* puppet "stop" command (escape key) to flush all buffered state
- puppet listen to voice interruptions (not done)

Other features to include later:

	* sparse voxel octree dynamic pathfinding and navigation so that puppets can walk around

## Understanding the two pipeline options in even more detail:

There are two pipelines in puppet that do the same:

	a) One pipeline that uses Talking Heads ( a third party tool )
	b) My own pipeline that uses the same data but is broken apart into more organized fragments, and will be the basis for future extensions. These pipelines both do the following:

The flow:

1) On the instance server we get the user text.

2) Paragraphs are broken into smaller sentence fragments (on period and comma boundaries) and cleaned up.

3) Each sentence is passed to a text to speech (still on the server).

4) Generation of "anim" property is built (on the server):

   Each word in each sentence is passed to a viseme generator.
   Note that talking heads goes directly from words to visemes - skipping phonemes.
   A data structure is returned that is a sequence of playback hints with these fields:

		name: a command name - typically "viseme" (as opposed to say "break" or "audio") or other commands
		mark: a counter that increments once per word
   		ts: the time stamp start, end, duration of the viseme
   		vs: the viseme name in ready player me format and the intensity

5) Generation of "whisper" timing data property is built (on the server):

   OpenAI whisper is used to generate word timing.
   This duplicates some of the work above!
   In fact in some cases the above "anim" prop is not used at all.
   This property has these fields:

		wdurations: [ 280, 120, 200, 139, ... ]	-> the number of milliseconds of length of each word
		words: [ what, can, i do, ... ] -> the actual words
		wtimes: [ -150, 130, 250, 450, ... ] -> when the word actually starts in the timewise sequence

	Note that the wtimes are adjusted to start at -150 milliseconds - I feel this is a hack ands should be removed.
	But in general these word timings are an excellent way to synchronize the visemes to text.
	And in fact on the client side they run throughthe same pipeline in (4) to go from words directly to visemes.

6) The client catches blobs of data telling it what to perform. I call these "performances".
   A given "blob" is something like this:

		"audio" -> a b64 encoded buffer of audio that gets turned into a raw audio buffer for playback
		"anim" -> the property described in (4) above - basically a collection of visemes and timing
		"whisper" -> the property described in (5) above - a collection of word timings

7)	The "whisper" data is passed to "lipsyncConvert()" (see TalkingHead/modules/lipsync-queue.mjs)
	This is turned from word timings directly into sequenced visemes over time to play back.
	The output is a new list of viseme timings that looks like this:

		template: name "viseme",
		ts: [ start, end, end? ] in absolute time units (milliseconds)
		vs: [ viseme name, level or intensity, 0 ]

	Now the playback engine stuffs these into an anim queue for playback.

8) The TH animation queue tackles several different kinds of animation.
   It looks to see if a specific fragment is before or after the current time.
   It sets the degree of the morph target based on its estimation of the timing.
   This is similar to audio attack, sustain, decay, release

9) For my own purposes I have a simplified facial viseme playback queue handler - like so:
   - Given word timings from whisper.
   - I pass these to lipsyncConvert() to get a big array of visemes to play at a given point in time.
   - Every frame I iterate that whole array and the visemes that are in the right time window I set.

