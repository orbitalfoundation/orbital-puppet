
const uuid = 'audio_system'

// the bus, captured from resolve()'s 2nd arg at registration
let bus = null
let context = null

// accept whatever the TTS handed us: an already-decoded AudioBuffer, an encoded ArrayBuffer
// (wav, from HeadTTS / OpenAI), or a typed array wrapping one — return a playable AudioBuffer.
async function toAudioBuffer(audio) {
	if (audio instanceof AudioBuffer) return audio
	const ab = (audio instanceof ArrayBuffer) ? audio : (audio && audio.buffer) || audio
	return await context.decodeAudioData(ab)
}

async function resolve_queue(perform, handler) {

	if (!context) context = new AudioContext()

	handler.queue.push(perform)
	if (handler.queue.length != 1) return

	bus.resolve({ config: { noisy: true } })

	while (handler.queue.length) {

		const perform = handler.queue[0]

		let audioBuffer
		try {
			audioBuffer = await toAudioBuffer(perform.audio)
		} catch (err) {
			console.error('audio - could not decode audio', err)
			handler.queue.shift()
			continue
		}

		// Anchor lip-sync to when the audio will actually be AUDIBLE — now plus the context's output
		// latency — not to when we call start(). vtimes are ms from audio start, so the puppet adds
		// them to this. (Without this, visemes lead the sound by the hardware buffer latency.)
		const startMs = performance.now() + (context.outputLatency || 0) * 1000
		perform._startMs = startMs

		// diagnostic: compare audio length vs the viseme span (catches any systematic vtime offset)
		const lp = perform.lipsync
		if (lp && lp.visemes && lp.visemes.length) {
			const n = lp.visemes.length
			const span = lp.vtimes[n - 1] + (lp.vdurations ? lp.vdurations[n - 1] : 0)
			console.log(`audio - dur=${audioBuffer.duration.toFixed(2)}s  visemes n=${n} span=[${lp.vtimes[0] | 0}..${span | 0}]ms  outLatency=${((context.outputLatency || 0) * 1000) | 0}ms`)
		}

		// hand the puppet the synced packet (audio + lipsync) just before playback begins
		bus.resolve({ puppetsync: perform })

		// play it, awaiting completion so the queue stays in order
		await new Promise((happy) => {
			let sound = handler._sound = context.createBufferSource()
			sound.buffer = audioBuffer
			sound.connect(context.destination)
			sound.addEventListener('ended', () => {
				if (sound) { sound.disconnect(); handler._sound = sound = null }
				happy()
			})
			context.resume()
			sound.start()
		})

		handler.queue.shift()
	}

	bus.resolve({ config: { noisy: false } })
}

function resolve(blob, _bus) {
	bus = _bus || bus

	if (!blob || blob.time || blob.tick) return

	// for now lets have one handler but later there could be multiple audio emitters in a scene @todo
	let candidates = Object.values(this._handlers)
	const handler = candidates.length ? candidates[0] : null
	if (!handler) return

	// stop handler if there is a bargein
	if (blob.perform && blob.perform.bargein) {
		handler.queue = []
		if (handler._sound) {
			handler._sound.stop()
			handler._sound.disconnect()
			handler._sound = null
			bus.resolve({ config: { noisy: false } })
		}
	}

	// ignore?
	if (!blob.perform || !blob.perform.audio || blob.perform.human) return

	// handle - do not await
	resolve_queue(blob.perform, handler)
}

export const audio_system = {
	id: uuid,
	uuid,
	resolve,
	_handlers: { default: { queue: [] } }
}
