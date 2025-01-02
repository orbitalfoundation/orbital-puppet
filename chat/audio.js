
const uuid = 'audio_system'

let rcounter = 0
let bcounter = 0
let context = null
let sound = null

function play_audio(data) {
	return new Promise((happy,sad)=>{
		if(!context) context = new AudioContext({sampleRate:16000})
		context.decodeAudioData(data, (audioBuffer) => {
			sound = context.createBufferSource()
			sound.buffer = audioBuffer
			sound.connect(context.destination)
			sound.addEventListener('ended', (results) => {
				// stop the sound - remove it - but it can also be removed externally
				if(sound) {
					sound.disconnect()
					sound = null
				}
				happy()
			})
			context.resume()
			sound.start()
		})
	})
}

async function _resolve_queue() {
	while(true) {
		if(!this._queue.length) break
		const blob = this._queue[0]
		await play_audio(blob.audio.data)
		sys({ audio_done: { final: blob.audio.final ? true : false }})
		this._queue.shift()
	}
}

//
// resolve - @note must not be async else will stall rest of pipeline
//

function resolve(blob,sys) {

	// barge in? - @todo in a scenario with multiple llms it may not make sense to stop all of them on any interruption
	if(blob.human) {
		this._queue = []
		if(sound) {
			sound.disconnect()
			sound = null
		}
	}

	// queue audio
	if(!blob.audio || !blob.audio.data) return
	this._queue.push(blob)
	if(this._queue.length !== 1) return
	this._resolve_queue()
}

export const audio_system = {
	uuid,
	resolve,
	_queue: [],
	_resolve_queue,
	_bargein: 0,
	//singleton: true // an idea to distinguish systems from things that get multiply instanced @todo
}
