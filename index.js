
//
// Load the orbital pub/sub service and then load up a few systems that will handle message traffic
//

import sys from 'orbital-sys/src/sys.js'

sys({
	load:[

		// 3d scene system - observes {volume} components and makes a 3d display on a named div or volume001
		'orbital-volume/volume.js',

		// voice activity detector and stt using whisper with bargein and audio echo cancellation
		// 'here/chat/vad.js',
		// 'here/chat/stt-whisper.js',

		// alternatively a built in stt (doesn't allow bargein or audio echo cancellation)
		'orbital-puppet/chat/stt-sys.js',

		// user interface - placed here in chain because may block some events
		'orbital-puppet/chat-ux.js',

		// reason using an llm
		'orbital-puppet/chat/llm.js',

		// text to speech using a wasm based tts and speech diarization and then an audio player
		'orbital-puppet/chat/tts.js',
		'orbital-puppet/chat/stt-diarization.js',
		'orbital-puppet/chat/audio.js',

		// built-in tts has poor results because it doesn't tell us the duration of the audio output
		// 'here/chat/tts-sys.js',

		// puppet performance - watches for audio packets that are decorated with viseme data
		'orbital-puppet/perform/puppet.js',

		// a fun audio effect
		// 'orbital-puppet/audio-effect.js'
	]
})

//
// a 3d scene - these are messages that get piped to the 3d volume service above and rendered as 3d geometry
//

sys([

	{
		uuid: "scene001",
		volume: {
			geometry: 'scene',
			div: 'volume001',
			near: 0.1,
			far: 100,
			cameraPosition:[0,1.5,1], // @todo move this behavior to camera
			cameraTarget:[0,1.5,0],
			cameraMin: 1,
			cameraMax: 100,
			//background: 0x000000,
			//alpha: false,
			//axes: true,
			prettier: true,
			roomlighting: true,
		}
	},

	{
		uuid: "camera001",
		volume: {
			geometry: 'camera',
			nocontrols: false,
			pose:{
				position:[0,1.5,1],
				love:[0,1.5,0]
			}
		}
	},

	/*
	{
		uuid: "light001",
		volume: {
			geometry:'light',
			light:'directional',
			intensity: 0.8,
			color: 0xffffff,
			pose:{
				position:[1,1,1]
			},
		}
	},

	{

		uuid: "light002",
		volume: {
			geometry:'light',
			light:'ambient',
			color: 0xffffff,
			intensity: 0.3
		}
	},
	*/

	{
		uuid:"backdrop001",
		unused_volume: {
			geometry:'file',
			url:'assets/venues/virtual_store_cute_pastelle.glb',
			metadata: {
				provenance: 'https://sketchfab.com/3d-models/virtual-store-cute-pastelle-953f0f8517eb4af1b1ba5bf85601f7dd',
				creator: 'https://sketchfab.com/mshayan02',
				license: "CC Attribution-NonCommercial",
			},
			transform:{
				whd:[1,1,1],
				xyz:[0,0,1.5],
				ypr:[0,3,0],
			},
		}
	},

	//
	// puppet
	//

	{
		uuid: 'alexandria',

		// decorate this entity with a 3d geometry
		volume: {
			geometry: 'file',
			url: 'assets/avatars/rpm-mixamo-t-posed.glb',
			pose: {
				position: [0,0,0]
			},
			animations: { default: `${import.meta.url}/../assets/animations/unarmed-idle.glb` },
		},

		// decorate entity with viseme support on the geometry if any
		puppet: {},

		// general configuration - stuffed here for now
		config: {
			microphone: true,
			bargein: false,
			autosubmit: false,
		},

		// decorate entity with the ability to understand human traffic on the pub/sub network
		llm: {
			stream: true,
			messages: [{
				role: "system",
				content: `
					Please take on the role of Alex, a female human librarian at the library of alexandria.
					You're in a shared virtual space with some patrons and are having a voice based conversation.
					Please be brief in your responses, a single sentence is fine.
					`,
			}],
			temperature: 0.3,
			max_tokens: 256,

			llm_local: true, // set to false to use remote endpoint below
			//llm_url: 'https://localhost:11434/v1/chat/completions',
			//llm_auth: '',
			//llm_model: 'deepseek-r1:7b',
			//llm_model: 'deepseek-r1:70b',
			//llm_model: 'llama3.2:latest',
			//llm_url: 'https://api.openai.com/v1/chat/completions',
			//llm_model: 'gpt-4o',
			//llm_auth: '',
		},

		// for local tts this is a setup using piper - if the 'voice' parameter is set to garbage it will crash
		tts: {
			remote: false,
			voice: 'en_US-hfc_female-medium',
			speed: 1,
			volume: 1,
			language: "en",
			trim: 0
		},

		// for remote tts this would talk to a remote endpoint - turn off the above
		unused_remote_tts: {
			url: 'https://api.openai.com/v1/audio/speech',
			bearer: '',
			model: "tts-1",
			// for openai the voices are alloy, echo, fable, onyx, shimmer, nova - onyx is male
			voice: "shimmer",
			speed: 1,
			volume: 1,
			language: "en",
			trim: 0
		},

		// decorate entity with the ability to convert speech output to animated viseme performances
		diarization: {
			remote: false,
			url: 'https://api.openai.com/v1/audio/speech',
			bearer: '',
		},

	},
])

