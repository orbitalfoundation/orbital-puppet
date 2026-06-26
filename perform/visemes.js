
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
// Apply the active visemes for `time` to the rig targets, smoothly.
//
// HeadTTS gives dense phoneme visemes (~60-90ms each). The old model (fast *0.85 decay + steep
// cubic attack/release, snapping each viseme on/off) flapped the mouth — measurably ~40 open/close
// reversals/sec (see test/viseme-harness.mjs). Instead we:
//   1. compute a TARGET per viseme from a smooth cosine bell over each active window, taking the
//      strongest active value per key (overlapping windows coarticulate rather than fight), then
//   2. low-pass the displayed value toward that target, which removes the per-frame jitter.
//
// SMOOTH (0..1 per frame): lower = smoother/slower; higher = snappier. Tune in the harness.
//

const SMOOTH = 0.30

const VISEME_KEYS = [
	'viseme_PP','viseme_FF','viseme_TH','viseme_DD','viseme_kk','viseme_CH','viseme_SS',
	'viseme_nn','viseme_RR','viseme_aa','viseme_E','viseme_I','viseme_O','viseme_U',
]

export function visemes_update(volume,time) {

	if(!volume.visemes) {
		volume.visemes = {}
		for(const k of VISEME_KEYS) volume.visemes[k] = 0
	}
	const visemes = volume.visemes

	// 1) target for this instant — smooth bell per active viseme window, strongest-wins per key
	const target = {}
	for(const k of VISEME_KEYS) target[k] = 0

	for(const item of volume.sequence) {
		const begins = item.ts[0]
		const ends = item.ts[1]
		if(begins > time || ends < time) continue
		const span = ends - begins
		const u = span > 0 ? (time - begins) / span : 0
		const env = Math.sin(Math.PI * Math.max(0, Math.min(1, u)))   // 0 at edges, 1 mid-window
		for(const k in item.vs) {
			const mag = item.vs[k][1] * env
			if(mag > target[k]) target[k] = mag
		}
	}

	// 2) low-pass the displayed value toward the target (this is what kills the flapping)
	for(const k of VISEME_KEYS) {
		const next = visemes[k] + (target[k] - visemes[k]) * SMOOTH
		visemes[k] = next < 0.004 ? 0 : next
		volume.targets[k] = visemes[k]
	}
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
