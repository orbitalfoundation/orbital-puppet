
import { lipsyncConvert } from '../talking-heads/lipsync-queue.js'

//
// Build a timed viseme sequence for the rig.
//
// `lipsync` is HeadTTS output: { visemes:[Oculus ids], vtimes:[ms], vdurations:[ms], words, wtimes, wdurations }.
// HeadTTS gives Oculus visemes + timing natively, so we map them straight to anim items — no Whisper,
// no forced alignment, no word->phoneme re-estimation. `time` is performance.now() at playback start;
// vtimes are ms from the start of the audio.
//
// Fallback: if only word timing is present (e.g. a cloud TTS that returns words but not visemes),
// run Mika's word->phoneme->viseme estimator (lipsyncConvert).
//
// LEAD nudges visemes slightly ahead of the audio; tune to taste.
//

const LEAD = 0

export function visemes_sequence(volume, lipsync, time) {

	if (!lipsync) return []

	// native HeadTTS visemes — the fast, accurate path
	if (lipsync.visemes && lipsync.vtimes && lipsync.visemes.length) {
		const sequence = []
		for (let i = 0; i < lipsync.visemes.length; i++) {
			const v = lipsync.visemes[i]
			if (!v || v === 'sil') continue
			const t = time + lipsync.vtimes[i] - LEAD
			const d = (lipsync.vdurations && lipsync.vdurations[i]) || 80
			const mag = (v === 'PP' || v === 'FF') ? 0.9 : 0.6
			sequence.push({
				ts: [ t - Math.min(60, (2 * d) / 3), t + d + Math.min(60, d / 2) ],
				vs: { ['viseme_' + v]: [null, mag] },
			})
		}
		return sequence
	}

	// fallback: word timing -> Mika's phoneme estimator (cloud TTS without native visemes)
	if (lipsync.words && lipsync.words.length && lipsync.wtimes) {
		const whisper = lipsync.words.map((w, i) => ({
			word: w,
			start: (lipsync.wtimes[i]) / 1000,
			end: (lipsync.wtimes[i] + (lipsync.wdurations ? lipsync.wdurations[i] : 200)) / 1000,
		}))
		const o = lipsyncConvert(whisper, 'en')
		const sequence = o && o.anim || []
		for (const item of sequence) {
			item.ts[0] += time
			item.ts[1] += time
			item.ts[2] += time
		}
		return sequence
	}

	return []
}

//
// given a large collection of targets, apply those that are in the right time window
//
// @todo we throw away the supplied time because the performance init doesn't have it
// @note i go out of my way to set the unused visemes to zero
// @note i have fiddled with the attack and release to get something that feels ok - it is a bit jittery
//

export function	visemes_update(volume,time) {

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
