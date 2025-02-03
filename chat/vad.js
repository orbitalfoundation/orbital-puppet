
const uuid = 'vad_system'

function loadScript(url) {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script')
		script.src = url
		script.onload = resolve
		script.onerror = reject
		document.head.appendChild(script)
	})
}
const onnxWASMBasePath = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/'
await loadScript(`${onnxWASMBasePath}ort.js`)
await loadScript('https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.22/dist/bundle.min.js')

function configure(state,sys) {

	// paranoia
	if(!state || !sys) {
		console.error("whisper configure error")
		return
	}

	//
	// reconfigure?
	//

	if(state.vad) {
		state.microphone ? state.vad.start() : state.vad.pause()
		return
	}

	//
	// publish final audio or just human vocalization / barge-in detected
	//

	const vad_helper = (probs=null,audio=null) => {
		const confidence = probs && probs.isSpeech ? probs.isSpeech : 1
		if(confidence < (state.threshold || 0.8)) return
		const final = audio ? true : false
		if(final) { state.bcounter = 0; state.rcounter++ } else { state.bcounter++ }
		const perform = {
			audio,
			confidence,
			spoken:true,
			human:true,
			bargein:true,
			final: audio ? true : false,
			rcounter : state.rcounter,
			bcounter : state.bcounter,
			interrupt: performance.now(),
		}
		sys({perform})
	}

	//
	// start up the vad once
	//

	try {
		globalThis.vad.MicVAD.new({
			onnxWASMBasePath,
			positiveSpeechThreshold:state.threshold || 0.8,
			minSpeechFrames: 5,
			preSpeechPadFrames: 10,
			model: "v5",
			onFrameProcessed: (args) => { vad_helper(args,null) },
			onSpeechStart: (args) => {},
			onSpeechEnd: (audio) => { vad_helper(null,audio) }
		}).then(vad => {
			state.vad = vad
			state.microphone ? state.vad.start() : state.vad.pause()
		})
	} catch(err) {
		console.error(uuid,err)
	}

}

///
/// voice activity detector - can set microphone off and on using { vad: { microphone: boolean }}
///

export const vad_system = {

	uuid,

	_state: {
		microphone: false,
		threshold: 0.8,
		rcounter: 1000,
		bcounter: 0
	},

	resolve: function(blob,sys) {
		if(!blob || blob.tick || blob.time) return
		if(blob.config) {
			if(blob.config.hasOwnProperty('microphone')) this._state.microphone = blob.config.microphone
		}
	}
}

// start this right away for now - relies on sys being global
if(globalThis.sys)configure(vad_system._state,globalThis.sys)

