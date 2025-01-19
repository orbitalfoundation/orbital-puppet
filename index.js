
//
// Load the orbital pub/sub service and then load up a few systems that will handle message traffic
//

import sys from 'https://cdn.jsdelivr.net/npm/orbital-sys@latest/src/sys.js'

sys({
	load:[

		// 3d scene system - observes {volume} components and makes a 3d display on a named div or volume001
		'https://cdn.jsdelivr.net/npm/orbital-volume/volume.js',

		// puppet speech to text system - publishes new {human} packet including {human.bargein}
		'https://cdn.jsdelivr.net/npm/orbital-puppet@1.2.3/chat/stt.js',

		// puppet reasoning system - observes {human} packets including {human.bargein} and may publish global {breath} packets
		'https://cdn.jsdelivr.net/npm/orbital-puppet@1.2.3/chat/llm.js',

		// puppet text to speech system - observes {breath} packets and generate {speech} packets - also observes {human.bargein}
		'https://cdn.jsdelivr.net/npm/orbital-puppet@1.2.3/chat/tts.js',

		// puppet animation system - binds to a {puppet} that references 3d geometry
		// also observes {audio} packets and animates a specified geometry - also observes {human.bargein}
		'https://cdn.jsdelivr.net/npm/orbital-puppet@1.2.3/puppet.js'
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
		uuid: 'alexandria',
		volume: {
			geometry: 'file',
			url: 'assets/avatars/rpm-mixamo-t-posed.glb',
			pose: {
				position: [0,0,0]
			},
			animations: { default: "assets/animations/unarmed-idle.glb" },
		},
		puppet: {},

		// @todo unused but may want to do this to allow configuration
		stt: {
			// microphone on or off
			microphone: true,
			// built-in stt
			builtin_stt: false,
			// barge in allowed - allow spoken aborts (although important for speech to speech it can be overly annoying in noisy environments)
			bargein: true,
			// auto-submit complete spoken utterances; a nice feature in voice to voice interactions
			autosubmit: true,
		
		},

		llm: {
			stream: true,
			messages: [{
				role: "system",
				content: "you are a helpful digital agent",
			}],
			temperature: 0.3,
			max_tokens: 256,

			llm_local: true,
			llm_url: 'https://api.openai.com/v1/chat/completions',
			llm_auth: '',
			llm_model: 'gpt-4o' //'llama3.3:latest',

		},

		tts: {
			remote: false,
			url: 'https://api.openai.com/v1/audio/speech',
			bearer: '',
			model: "tts-1",
			// for openai the voices are alloy, echo, fable, onyx, shimmer, nova - onyx is male
			// voice: "shimmer",
			// local voice for piper - male or female work
			voice: 'en_US-hfc_female-medium',
			speed: 1,
			volume: 1,
			language: "en",
			trim: 0,

			// do stt for whisper timings remotely
			whisper_remote: false,
		}
	},
])
