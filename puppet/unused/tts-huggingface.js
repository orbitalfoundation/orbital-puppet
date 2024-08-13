

///
/// TTS via hugging face
///
/// Unused because we don't get exact phoneme start times in the models i see available so far
/// Amazon polly may be another option at some point
/// Note that hugging face tends to export flac, i can peek at the flac to try estimate the duration
///
///

import { flac_estimate_duration } from './flac-estimate-duration.js'

export async function tts_hugging_face(action) {
	if(!action || !action.tts || !action.tts.flac) return
	try {
		action.tts.body = JSON.stringify({inputs:action.text})
		const response = await fetch(action.tts.url,action.tts)
		if(!response.ok) {
			console.error("puppet:tts error",response,action)
			this.actions.shift()
			this._dequeue()
			return
		}
		const buf = await response.arrayBuffer()
		const raw = new Uint8Array(buffer)
		let encoded = ''
		// @todo this uses window must not do so
		for(const value of raw) { encoded += String.fromCodePoint(value) }
		action.b64encoded = "data:audio/flac;base64,"+window.btoa( encoded )
		action.duration = flac_estimate_duration(raw)
	} catch(err) {
		console.error("huggingface failure",err)
		this.actions.shift()
		this._dequeue()
		return
	}
}


