

import { synthesize } from './unused-tts-synth.js'

///
/// for some reason this approach is extraordinarily slow - so it is not used @todo delete
///

export async function audio_preload(args,success,fail) {
	try {
		let audio = new Audio()
		const load = () => {
			return new Promise((resolve) => {
				audio.addEventListener("loadedmetadata",resolve)
				audio.src = "data:audio/wav;base64," + args.audio
			})
		}
		await load()
		success(audio)
		return
	} catch(err) {
		console.error("audio: source error",err,args)
	}
	fail()
}

///
/// the browser built in voice has several serious problems - using this is not recommended @todo delete
///		- no sense of duration
///		- only one voice at a time (a real blocker)
///		- lack of choice in voices
///

export async function audio_play(args,callback_on_done=null) {

	//
	// play audio from file?
	//

	if(args._audio) {
		try {
			// play once
			const options = {
				capture: true,
				passive: true,
				once: true
			}
			const done = () => {
				args._audio.removeEventListener('ended',listener,options)
				if(callback_on_done) callback_on_done()
			}
			const listener = args._audio.addEventListener('ended',done,options)
			args._audio.play()
		} catch(err) {
			console.error("puppet: cannot play audio - user did not click on document first?",err)
		}
		return
	}

	//
	// play voice using built in browser synth - must compute duration since the built in synth does not know (insanely)
	//
	// if no tts or no audio encoded data then if synth then go ahead and generate synth locally and start playing it now
	// this is a client only capability and can act as a fallback if tts fails
	// built in synth has several serious design defects; such as no timing estimates, and only one at a time
	//

	if(args.hasOwnProperty('synth') && args.sentence && args.sentence.length) {
		try {
			const duration = synthesize({
				text: args.text,
				lang: "en-US",
				voice: "mary",
				rate: 1,
				pitch: 1,
				onend: callback_on_done
			})
			args.duration = duration
			return
		} catch(err) {
			console.error("puppet: cannot play audio - user did not click on document first?")
		}
	}

	if(callback_on_done) callback_on_done()
	return false
}
