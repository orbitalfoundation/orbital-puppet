
//
// 
// This is a refactoring of Mika Suominen's excellent talking heads project
// 
// See work at https://github.com/met4citizen
// 
// Runs on client side only
//
// @todo may remove class and just stuff all the variables in volume
//

import * as THREE from 'three'

const uuid = 'puppet-class-instance'

import { blink } from './perform/blink.js'
import { emote } from './perform/emote.js'
import { facial_ticks } from './perform/facial-ticks.js'
import { gaze, gaze_update } from './perform/gaze.js'
import { visemes_sequence, visemes_to_rig, visemes_update } from './perform/visemes.js'

export class PuppetClass {

	uuid
	queue = []

	volume = null
	sound = null

	///
	/// associate a puppet with a volume - can be done at any time
	///

	configure(volume) {
		this.volume = volume
		volume.dirty = {}
		volume.sequence = []
		volume.relaxation = 0
	}

	///
	/// relax all effects immediately
	///

	stop() {
		console.log(uuid,"... stopping all")
		if(!this.volume) return
		this.volume.relaxation = 0
		this.volume.sequence = []
		this.queue = []
		emote(this.volume,'neutral')
		if(this.sound) {
			this.sound.disconnect()
			this.sound = null
		}
	}

	///
	/// obliterate
	///

	obliterate() {
		this.obliterated = true
		stop()
	}


	///
	/// do performance
	///

	perform(performance) {
		if(this.obliterated) return
		this.queue.push(performance)
		if(this.queue.length == 1) this._start_next_performance()
	}

	// next perf
	async _start_next_performance() {

		// next?
		if(this.obliterated) return
		if(!this.volume || !this.volume.node) return
		if(!this.queue.length) return
		const volume = this.volume

		const performance = this.queue[0]

		// facial emotion
		if(performance.emotion) {
			emote(volume,performance.emotion)
		}

		// action
		if(performance.action) {
			// tbd
		}

		// sequence viseme performance to play right now
		volume.sequence = visemes_sequence(volume,performance.whisper)

		// may gaze at the player when starting an utterance
		// console.log('*** npc puppet gaze begin',performance.segment)
		// this.gaze(-1,-1,performance.segment < 2 ? 0 : 0.5 )

		// start audio - a slight hassle due to callback architecture - drives whole system forward
		if(performance.audio) {

			const handle = (sound) => {
				this.sound=sound
			}

			const completed = () => {
				this.sound = null
				sys({ audio_done: { final: performance.final ? true : false }})
				this.queue.shift()
				this._start_next_performance()
			}

			audio_play(performance.audio,handle,completed)

		} else {
			console.log("**** puppet performance with no audio",performance)
			// unsure what to do exactly if no audio time data
			setTimeout(()=>{
				this.queue.shift()
				this._start_next_performance()				
			},1000)
		}
	}

	///
	/// update facial performance over time
	///

	update(time,delta) {

		// @todo improve
		// for now use performance.now() because i am setting fiddly little timer based effects
		time = performance.now()

		// sanity check
		const volume = this.volume
		if(!volume || !volume.node) return

		// @todo update body

		// blink
		blink(volume,time)

		// @todo gaze at player
		// this.gaze_update()

		// an experimental approach for relaxation after effects - may revise
		if(!volume.relaxation || volume.relaxation < time ) {
			facial_ticks(volume.time)
			visemes_to_rig(volume,time,0.9)
		}

		// actively speaking
		else {
			visemes_update(volume,time)
			visemes_to_rig(volume,time)
		}


	}

}

//
// @todo stuff this somewhere better
// probably should be a part of volume - but has to callback to here
//

let context

function audio_play(data,handle,completed) {
	try {
		if(!context) context = new AudioContext({sampleRate:16000})

		if(context.state === 'suspended') {
			context.resume()
			console.warn(uuid,"... audio was suspended!")
		}

		const callback = (audioBuffer) => {
			let sound = context.createBufferSource()
			sound.buffer = audioBuffer
			sound.connect(context.destination)
			//console.log("... audio buffer duration is expected to be",sound.buffer.duration * 1000)
			handle(sound)
			sound.addEventListener('ended', ()=>{
				sound.disconnect()
				completed()
			})
			sound.start()
		}

		const err = (error) => {
			console.log("... audio error",error)
		}

		context.decodeAudioData(data,callback,err)
	} catch(err) {
		console.error(err)
		completed()
	}
}






