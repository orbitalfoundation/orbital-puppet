
const isServer = typeof window === 'undefined'

import { PuppetFace } from './PuppetFace.js'
import { Audio } from './Audio.js'

const BREAK_DURATION = 100

export class PuppetQueue extends PuppetFace {

	_performances = []
	audio = null
	recent = null
	received = null
	busy = false

	update(time,delta) {
		super.update(time,delta)
		this.face_update(null,time,delta)
	}

	async perform(performance=null) {

		// @todo if a future conversation arrives then flush all and jump to it

		// throw away old conversations that arrived late
		if(performance && this.received) {
			if(performance.conversation < this.received.conversation) {
				console.error('puppet performance old conversation?',performance,this.received)
				return				
			}
			if(performance.conversation == this.recent.conversation && performance.segment < this.received.segment) {
				console.error('puppet performance old segment?',performance,this.received)
				return
			}
		}
		this.received = { ...performance }

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
			console.log("************ totally done")
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
