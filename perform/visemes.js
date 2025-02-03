
import { lipsyncConvert } from '../talking-heads/lipsync-queue.js'

export function visemes_sequence(volume,whisper,time) {

	time = performance.now() // for now get it ourselves

	if(!whisper) {
		console.warn("puppet - no whisper data") // @todo compute a different way
		return []
	}

	const o = lipsyncConvert(whisper,"en")
	const sequence = o && o.anim || []


	// test: try relaxation approach to damping the facial performance over time
	for(const item of sequence) {
		// @todo remove the fudge factor coming in from Mika's code
		item.ts[0] += time + 150
		item.ts[1] += time + 150
		item.ts[2] += time + 150
		volume.relaxation = Math.max(volume.relaxation,item.ts[1]) // @todo can migrate out?
	}

	return sequence
}

//
// given a large collection of targets, apply those that are in the right time window
//
// @todo we throw away the supplied time because the performance init doesn't have it
// @note i go out of my way to set the unused visemes to zero
// @note i have fiddled with the attack and release to get something that feels ok - it is a bit jittery
//

export function	visemes_update(volume,time) {

	time = performance.now() // @todo revert to supplied args

	const attack = 50
	const release = 60

	// track visemes here for now
	if(!volume.visemes) {
		volume.visemes = {
			'viseme_PP': 0,
			'viseme_FF': 0,
			'viseme_TH': 0,
			'viseme_DD': 0,
			'viseme_kk': 0,
			'viseme_CH': 0,
			'viseme_SS': 0,
			'viseme_nn': 0,
			'viseme_RR': 0,
			'viseme_aa': 0,
			'viseme_E': 0,
			'viseme_I': 0,
			'viseme_O': 0,
			'viseme_U': 0,
		}
	}

	const visemes = volume.visemes

	// as a test generally speaking i am dampening the visemes after they are set
	// this is separate from the relaxation idea above
	// it's arguable if this looks good on the face @todo evaluate more? non-linear curves might make sense also

	Object.entries(visemes).forEach( ([k,v]) => {
		visemes[k] = v > 0.01 ? v * 0.85 : 0
	})

	// for the current moment in time - set morph targets
	// @note playing with different timings on visemes to reduce jitter and be more realistic

	for(const item of volume.sequence) {
		const begins = item.ts[0]
		const ends = item.ts[1]

		if(begins > time || ends < time) continue
		Object.entries(item.vs).forEach( ([k,v]) => {
			v = v[1]
			if((time - begins) < attack) v *= Math.pow((time-begins)/attack,3)
			if((ends - time) < release) v *= Math.pow((release-(ends-time))/release,3)
			visemes[k] = v
		})
	}

	// copy visemes over to actual targeting system for rendering to the real puppet
	Object.entries(visemes).forEach( ([k,v]) => {
		volume.targets[k] = v
	})
}

//
// apply targets (names and floats) to the actual rig
// dictionary always indicates a group of targets not just necessarily one
//

export function visemes_to_rig(volume,time,amplify=1.0) {
	if(!volume.targets) return

	// test to reduce work
	if(!volume.dirty) volume.dirty = {}

	Object.entries(volume.targets).forEach(([k,v])=>{

		// linear global fader - useful for returning to a neutral pose gracefully - @note this is just an idea being tried out may deprecate
		if(amplify != 1.0) {
			v = volume.targets[k] = v*amplify
		}

		// touch only dirty targets - a test optimization to reduce banging on animation system
		if(v === volume.dirty[k]) return
		volume.dirty[k]=v

		// vrms are already correctly mapped and also use english rather than a dictionary lookoup; so set and return
		if(volume.vrm) {
			volume.vrm.expressionManager.setValue(k,v)
			return
		}

		// set numerical targets for rpm and others
		const group = volume.dictionary[k]
		if(!group) return
		volume.morphs.forEach(part=>{
			group.forEach(index => {
				part.morphTargetInfluences[index] = v
			})
		})
	})
}
