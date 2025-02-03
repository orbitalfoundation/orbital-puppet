
//
// puppet performance service driven by audio packets enhanced with spoken text and timings
//

const uuid = 'puppet-system'

import { blink } from './blink.js'
import { emote } from './emote.js'
import { facial_ticks } from './facial-ticks.js'
import { gaze, gaze_update } from './gaze.js'
import { visemes_sequence, visemes_to_rig, visemes_update } from './visemes.js'

function rest(volume) {
	volume.dirty = {}
	volume.sequence = []
	volume.relaxation = 0
	emote(volume,'neutral')
}

function perform(volume,perform) {

	if(!volume || !perform) return

	if(perform.emotion) {
		emote(volume,perform.emotion)
	}

	if(perform.action) {
		// body actions are not enabled @todo
	}

	// build performance sequence over time - use optional timing data if present
	// @todo turn on the non whisper path
	volume.sequence = visemes_sequence(volume,perform.whisper)

	// gaze at player on performances that at are at the start of a sequence
	const segment = perform.bcounter ? perform.bcounter : 0
	gaze(volume,-1,-1,segment < 2 ? 0 : 0.5 )
}

function update(volume,time) {

	// @todo improve for now use performance.now() because i am setting fiddly little timer based effects
	time = performance.now()

	// blink
	blink(volume,time)

	// gaze at player
	gaze_update(volume,time)

	// an experimental approach for relaxation after effects - may revise
	if(!volume.relaxation || volume.relaxation < time ) {
		facial_ticks(volume.time)
		visemes_to_rig(volume,time,0.9)
	}

	// else actively speaking
	else {
		visemes_update(volume,time)
		visemes_to_rig(volume,time)
	}

}


async function resolve(blob) {

	// update existing puppets
	if(blob.tick) {
		Object.values(this._puppets).forEach(blob => {
			update(blob.volume)
		})
		return
	}

	// register new puppets if any
	if(blob.puppet && blob.volume && blob.uuid) {
		if(blob.obliterate) {
			delete this._puppets[blob.uuid]
		} else {
			this._puppets[blob.uuid] = blob	
		}
	}

	// pick a puppet as target of traffic
	const puppets = Object.values(this._puppets)
	const puppet = puppets.length ? puppets[0] : null
	if(!puppet) return

	// detect barge in traffic and force stop performance
	if(blob.perform && blob.perform.bargein) {
		rest(puppet.volume)
	}

	// start a performance if any
	if(blob.perform && !blob.perform.human && blob.perform.audio && blob.perform.whisper) {
		//console.log("puppet - got performance to do",puppet,blob.perform)
		perform(puppet.volume,blob.perform)
	}

}

///
/// this is a system that gets run every tick and watches events, it tracks puppets and helps choregraph their behavior
///

export const puppet_system = {
	uuid,
	resolve,
	_puppets:{},
}
