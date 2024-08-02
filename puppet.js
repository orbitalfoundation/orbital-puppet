
const isServer = typeof window === 'undefined'

const BREAK_DURATION = 100

import { Audio } from './puppet-audio.js'
import { Face } from './puppet-face.js'

//import { TalkingHeadArticulate } from './talkinghead/modules/talkinghead-articulate.mjs'

///
/// Puppet Core
///
/// This is largely a queue that feeds events to the puppet face, audio and body
///
/// There is a legacy talkingheads path (third party) and a newer path (not as complete but broken apart into smaller more digestible pieces)
///

export class Puppet {

	face = null
	audio = null
	queue = []
	occupied = false

	talkinghead = null

	constructor(parts) {

		if(isServer) {
			console.error("puppet performance - should be run on client only")
			return
		}

		if(typeof TalkingHeadArticulate != 'undefined') {
			this.talkinghead = new TalkingHeadArticulate()
			this.talkinghead.usenode(parts.node)
			this.talkinghead.camera = parts.camera
			this.talkinghead.lookAtCamera(2000)
		} else {
			this._performance_next = this._performance_next.bind(this)
			this.audio = new Audio()
			this.face = new Face(parts)
		}
	}

	performance_append(perf) {

// @todo if this is a new conversation then must abort previous conversation

		if(typeof TalkingHeadArticulate != 'undefined') {
			const blob = perf.whisper ? perf.whisper : perf
			if(perf.audio) blob.audio = perf.audio
			if(perf.actions && perf.actions.length) blob.mood = perf.actions[0]
			this.talkinghead.speakAudio(blob,"en")
		} else {
			this.queue.push(perf)
			if(!this.occupied) this._performance_next()
		}
	}

	async _performance_next() {

		if(!this.queue.length) {
			this.occupied = false
			return
		}

		this.occupied = true
		const perf = this.queue.shift()

		// pause - @todo is a timeout a good idea to advance the queue or should performance_update do this?
		if(perf.hasOwnProperty('break')) {
			const milliseconds = perf.break || BREAK_DURATION
			setTimeout(this._performance_next, milliseconds )
			return
		}

		// if there is a performance callback start then call it
		if(perf._performance_started_callback) {
			perf._performance_started_callback(perf)
		}

		// set current performance if any
		if(perf.audio || (perf.actions && perf.actions.length)) {
			try {
				if(perf.audio) {
					// if there is audio then advance after audio is done
					await this.audio.playAudioBuffer(perf.audio,BREAK_DURATION,this._performance_next)
					this.face.perform(perf)
				} else {
					// @todo right now if there is no audio then there's no estimation of the duration of this performance - improve
					this.face.perform(perf)
					this._performance_next()
				}
			} catch(err) {
				console.error("puppet performance - audio error",err)
				this._performance_next()
			}
			return
		}
	}

	performance_update(animation,time,delta) {
		if(typeof TalkingHeadArticulate != 'undefined') {
		    let dt = this.talkinghead.animateTime(time)
		    if(dt) {
				const o = this.talkinghead.animateBuildList()
				this.talkinghead.animateSpeech(o,dt)
				this.talkinghead.animateBody(o,dt)
		    }
			this.occupied = this.talkinghead.isSpeaking ? true : false
		} else {
			this.face.update(animation,time,delta)
		}
	}

}


