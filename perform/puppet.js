
//
// puppet performance service driven by audio packets enhanced with spoken text and timings
//

const uuid = 'puppet-system'


// the bus, captured from the second arg of resolve() when this service is registered
let bus = null
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

function perform(volume,perform,time) {

	if(!volume || !perform) return

	// an emotion? @todo may need to give duration - but this may interfere with speech
	if(perform.emotion) {
		emote(volume,perform.emotion)
	}

	// a body action @todo
	if(perform.action) {
	}

	// anchor the viseme sequence at the audio's actual output time (set by audio.js, accounts for
	// hardware latency) when available, otherwise now
	const anchor = perform._startMs || time
	volume.sequence = visemes_sequence(volume,perform.lipsync,anchor)

	// a test approach: set a time to be completed by
	volume.relaxation = volume.sequence.length ? volume.sequence[volume.sequence.length-1].ts[1] : 0

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

	// test: relax after a certain time; dampening to rest
	if(!volume.relaxation || volume.relaxation < time ) {
		facial_ticks(volume,time)   // was facial_ticks(volume.time) — wrong args, so tics never ran
		visemes_to_rig(volume,time,0.9)
	}

	// actively speaking
	else {
		visemes_update(volume,time)
		visemes_to_rig(volume,time)
	}

}


async function resolve(blob) {
	bus = arguments[1] || bus

	// use our own timestamp for now
	const time = performance.now()

	// update existing puppets
	if(blob.tick) {
		Object.values(this._puppets).forEach(blob => {
			update(blob.volume,time)
		})
		return
	}

	// register new puppets if any
	if(blob.puppet && blob.volume && blob.uuid) {
		if(blob.obliterate) {
			delete this._puppets[blob.uuid]
		} else {
			this._puppets[blob.uuid] = blob
			console.log('puppet - tracking puppet', blob.uuid)
		}
	}

	// pick a puppet as target of traffic
	const puppets = Object.values(this._puppets)
	const puppet = puppets.length ? puppets[0] : null
	if(!puppet) return

	// detect barge in traffic and force stop performance
	if(blob.perform && blob.perform.bargein) {
		rest(puppet.volume)
		console.log("puppet relaxing due to bargein")
	}

	// start a performance if any (lipsync = HeadTTS visemes/timing rides along with the audio)
	if(blob.puppetsync && !blob.puppetsync.human && blob.puppetsync.audio && blob.puppetsync.lipsync) {
		rest(puppet.volume)
		perform(puppet.volume,blob.puppetsync,time)
	}

}

///
/// this is a system that gets run every tick and watches events, it tracks puppets and helps choregraph their behavior
///

export const puppet_system = {
	id: uuid,
	uuid,
	resolve,
	_puppets:{},
}
