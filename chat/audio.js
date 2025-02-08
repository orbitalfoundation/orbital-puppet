
const uuid = 'audio_system'

let context = null

async function resolve_queue(perform,handler,sys) {

	if(!context) context = new AudioContext({sampleRate:16000})

	handler.queue.push(perform)
	if(handler.queue.length != 1) return

	sys({config:{noisy:true}})

	while(handler.queue.length) {

		const perform = handler.queue[0]

		// promisfy sound playback in queued order
		await new Promise((happy,sad)=>{
			context.decodeAudioData(perform.audio, (audioBuffer) => {

// test firing a synced packet as a helper for the puppet
console.log("audio - gonna play buffer, duration =",audioBuffer.duration)
sys({puppetsync: perform})

				try {
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
				} catch(err) {
				}
			})
		})

		handler.queue.shift()
	}

	sys({config:{noisy:false}})					
}

function resolve(blob,sys) {

	if(!blob || blob.time || blob.tick) return

	// for now lets have one handler but later there could be multiple audio emitters in a scene @todo
	let candidates = Object.values(this._handlers)
	const handler = candidates.length ? candidates[0] : null
	if(!handler) return

	// stop handler if there is a bargein
	if(blob.perform && blob.perform.bargein) {
		handler.queue = []
		if(handler._sound) {
			handler._sound.stop()
			handler._sound.disconnect()
			handler._sound = null
			sys({config:{noisy:false}})
		}
	}

	// ignore?
	if(!blob.perform || !blob.perform.audio || blob.perform.human) return

	// handle - do not await
	resolve_queue(blob.perform,handler,sys)
}

export const audio_system = {
	uuid,
	resolve,
	_handlers: { default: { queue: [] } }
}
