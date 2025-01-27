
const uuid = 'audio_system'

let context = null

async function resolve_queue(audio,handler,sys) {

	if(!context) context = new AudioContext({sampleRate:16000})

	handler._queue.push(audio)
	if(handler._queue.length != 1) return

	while(handler._queue.length) {

		const audio = handler._queue[0]

		// promisfy sound playback in queued order
		const p = new Promise((happy,sad)=>{
			context.decodeAudioData(audio.data, (audioBuffer) => {
				let sound = handler._sound = context.createBufferSource()
				sound.buffer = audioBuffer
				sound.connect(context.destination)
				sound.addEventListener('ended', (results) => {
					if(sound) {
						sound.disconnect()
						handler._sound = sound = null
					}
					happy()
				})
				context.resume()
				sound.start()
			})
		})

		await p()

		// helpful to know this for ux
		// sys({ audio_done: { final: audio.final ? true : false }})

		handler._queue.shift()
	}
}

function resolve(blob,sys) {

	if(!blob || blob.time || blob.tick) return

	// save audio producing objects - there's some contention between two different users of namespace
	if(blob.audio && blob.uuid && !blob.audio.data) {
		const handler = this._handlers[blob.uuid] = blob
		handler._queue = []
	}

	// find handler for event - pick first one for now improve later @todo
	let candidates = Object.values(this._handlers)
	const handler = candidates.length ? candidates[0] : null
	if(!handler) return

	// stop handler if there is a bargein
	if(blob.human && blob.human.bargein) {
		console.log("audio - got barge in")
		handler._queue = []
		if(handler._sound) {
			console.log("audio - stopping")
			handler._sound.stop()
			handler._sound.disconnect()
			handler._sound = null
		}
	}

	// ignore non audio data
	if(!blob.audio || !blob.audio.data) return

	// handle - do not await
	_resolve_queue(blob.audio,handler,sys)
}

export const audio_system = {
	uuid,
	resolve,
	_handlers: {}
}
