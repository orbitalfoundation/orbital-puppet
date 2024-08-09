
const isServer = typeof window === 'undefined'

import { PuppetFace } from './PuppetFace.js'
import { Audio } from './Audio.js'

const BREAK_DURATION = 100

export class PuppetQueue extends PuppetFace {

	_performances = []
	audio = null
	recent = null
	busy = false
	conversation = -1
	segment = 0

	update(time,delta) {
		super.update(time,delta)
		this.face_update(null,time,delta)
	}

	stop() {

		// throw away anything in current conversation
		this.conversation++
		this.segment = 0

		// throw away all existing performances
		this._performances = []

		// stop other systems
		super.stop()

		// stop audio
		if(this.audio) this.audio.stop()

		// not busy
		this.busy = false
	}


	async perform(performance=null) {

if(performance) {
console.log(performance.text,performance.conversation,performance.segment)
}

		if(!performance) {
			//console.warn('puppet queue flushing')
		}

		// @todo if a future conversation arrives then flush all and jump to it

		if(performance) {

			// skip to current conversation - stop old if any
			if(performance.conversation > this.conversation) {
				if(this.conversation >= 0) this.stop()
			}

			// throw away old conversations that arrived late
			else if(performance.conversation < this.conversation) {
				console.error('puppet queue old conversation?',performance,this.conversation)
				return
			}

			else if(performance.segment < this.segment) {
				console.error('puppet queue old segment?',performance,this.conversation,this.segment)
				//return
			}

			// set ratchet
			this.conversation = performance.conversation
			this.segment = performance.segment
		}

		// buffer performance
		if(performance) {
			this._performances.push(performance)
		}

		// still chewing on something
		if(this.recent && this.recent.completed == false) {
			return
		}

		// truly done?
		if(!this._performances.length) {
			this.busy = false
			return
		}

		// peel off next performance
		performance = this._performances.shift()
		this.recent = { ... performance }

		// start working on this one
		this.recent.completed = false
		this.busy = true

		// handle a pause event
		if(performance.hasOwnProperty('break')) {
			setTimeout( ()=>{
				this.recent.completed = true
				this.perform()
			}, performance.break || BREAK_DURATION)
			return
		}

		// call callback if any
		if(performance.callback) {
			performance.callback()
		}

		// perform body
		if(performance.actions) {
			performance.actions.forEach(action => {
				if(this.clumps[action]) {
					this.animationStart(action)
				}
			})
		}

		// perform visemes
		this.face_start_performance(performance)

		// perform audio
		if(performance.audio) {
			if(!this.audio)this.audio = new Audio()
			await this.audio.play(performance.audio,BREAK_DURATION,() => {
				this.recent.completed = true
				this.perform()
			})
			return
		}

		// advance right away to flush queue if no callbacks setup
		this.recent.completed = true
		this.perform()
	}

}
