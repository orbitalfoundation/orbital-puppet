
//
// Load the orbital pub/sub service and then load up a few systems that will handle message traffic
//

import sys from 'https://cdn.jsdelivr.net/npm/orbital-sys@latest/src/sys.js'

sys({
	load:[

		// 3d scene management - observes {volume} events
		'https://cdn.jsdelivr.net/npm/orbital-volume/volume.js',

		// voice activity detector and stt using whisper with bargein and audio echo cancellation
		// 'here/chat/vad.js',
		// 'here/chat/stt-whisper.js',

		// alternatively a built in stt (doesn't allow bargein or audio echo cancellation)
		'here/chat/stt-sys.js',

		// user interface - placed here in chain because may block some events
		'here/chat-ux.js',

		// reason using an llm
		'here/chat/llm.js',

		// text to speech using a wasm based tts and speech diarization and then an audio player
		'here/chat/tts.js',
		'here/chat/stt-diarization.js',
		'here/chat/audio.js',

		// alternatively a built in text to speech system can be used
		// 'here/chat/tts-sys.js',

		// puppet performance
		'here/perform/puppet.js',

		// a fun audio effect
		'here/audio-effect.js'
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
	// 		- volume {} component defines the geometry
	//		- puppet {} component deals with animating the geometry for human faces and bodies
	//		- llm {} component watches for breath messages and eventually drives the puppet component
	//

	{
		// uuid - mandatory 
		uuid: 'alexandria',

		// 3d geometry
		volume: {
			geometry: 'file',
			url: 'https://models.readyplayer.me/664956c743dbd726eefeb99b.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
			pose: {
				position: [0,0,0]
			},
			animations: { default: `${import.meta.url}/../assets/animations/unarmed-idle.glb` },
		},

		// puppet effects - required if you want to animate this puppet
		puppet: {},

		// configure llm - mandatory
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

			llm_local: true,
			llm_url: 'http://localhost:11434/v1/chat/completions',
			llm_model: 'deepseek-r1:7b',
			//llm_model: 'deepseek-r1:70b',
			//llm_model: 'llama3.2:latest',

			//llm_url: 'https://api.openai.com/v1/chat/completions',
			//llm_model: 'gpt-4o',
			//llm_auth: '',

		},

		// configure tts props - mandatory
		tts: {
			remote: false,
			url: 'https://api.openai.com/v1/audio/speech',
			bearer: '',
			model: "tts-1",
			// for openai the voices are alloy, echo, fable, onyx, shimmer, nova - onyx is male
			//voice: "shimmer",
			// local voice for piper - male or female work
			voice: 'en_US-hfc_female-medium',
			speed: 1,
			volume: 1,
			language: "en",
			trim: 0
		},

		stt: {
			remote: false,
			url: 'https://api.openai.com/v1/audio/speech',
			bearer: '',
		},

	},
])


// @todo could add a timeout feature to sys nodes
setTimeout( ()=>{
	const text = "All systems nominal"
	sys({perform:{text,final:true,human:false,interrupt:performance.now()}})
},2000)

