
const uuid = 'tts-system'

// the bus, captured from resolve()'s 2nd arg at registration
let bus = null

////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Text to speech via HeadTTS (met4citizen) — a Kokoro-82M neural TTS that runs in the browser
// (WebGPU, WASM fallback) and returns audio TOGETHER WITH word/phoneme timing and Oculus visemes.
//
// This replaces the old @diffusionstudio/vits-web worker AND the entire "run the audio back through
// Whisper to recover word timing" diarization hack — the timing is now native to the TTS.
// See devlog/20260625-bus-migration-and-modernization-research.md.
//
// A remote (OpenAI) path is kept for power users; it returns audio with no timing (no lip-sync yet —
// a Cartesia/phoneme path is the planned follow-up).
//
////////////////////////////////////////////////////////////////////////////////////////////////////////

import { HeadTTS } from 'https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/+esm'

// NOTE: the npm package ships the code but NOT the voices/dictionaries (.bin/.txt data), so those
// must be loaded from jsDelivr's GitHub mirror (/gh/), which serves the full repo. The module itself
// comes from npm /+esm above.
const HEADTTS_GH = 'https://cdn.jsdelivr.net/gh/met4citizen/HeadTTS@1.3.0'
const DEFAULT_VOICE = 'af_bella'

let headtts = null
let headttsReady = null

// lazily construct + connect HeadTTS once, reused across utterances (real API per the HeadTTS demo:
// CDN module URLs, connect(), setup(), and results delivered via onmessage — not awaited).
function initHeadTTS(config = {}) {
	if (headttsReady) return headttsReady
	const voice = config.voice || DEFAULT_VOICE
	headtts = new HeadTTS({
		transformersModule: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0/dist/transformers.min.js',
		workerModule: `${HEADTTS_GH}/modules/worker-tts.mjs`,
		dictionaryURL: `${HEADTTS_GH}/dictionaries/`,
		voiceURL: `${HEADTTS_GH}/voices`,
		endpoints: ['webgpu', 'wasm'],   // run in-browser; webgpu preferred, wasm fallback
		languages: ['en-us'],
		voices: [voice],
	})
	headttsReady = headtts.connect().then(() => {
		// no audioCtx is passed, so audio comes back encoded (wav) for audio.js to decode in its own context
		headtts.setup({ voice, language: 'en-us', speed: config.speed || 1, audioEncoding: 'wav' })
		return headtts
	})
	return headttsReady
}

// synthesize one fragment -> { audio: <wav bytes>, lipsync: {visemes,vtimes,vdurations,words,...} }
// HeadTTS delivers an "audio" message whose .data carries BOTH the audio and the lip-sync timing.
// We serialize calls (see resolve_queue) so a single onmessage handler per call is safe.
function perform_tts_local(text, config) {
	return initHeadTTS(config).then(() => new Promise((resolve) => {
		let done = false
		headtts.onmessage = (message) => {
			if (done) return
			if (message.type === 'audio') {
				done = true
				const d = message.data || {}
				let audio = d.audio
				// normalize a typed-array to its ArrayBuffer so audio.js can decodeAudioData it
				if (audio && !(audio instanceof ArrayBuffer) && audio.buffer instanceof ArrayBuffer) audio = audio.buffer
				resolve({
					audio,
					lipsync: {
						visemes: d.visemes, vtimes: d.vtimes, vdurations: d.vdurations,
						words: d.words, wtimes: d.wtimes, wdurations: d.wdurations,
					},
				})
			} else if (message.type === 'error') {
				done = true
				console.error('tts - HeadTTS error', message.data)
				resolve(null)
			}
		}
		headtts.synthesize({ input: text })
	}))
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////
// remote tts - using openai (audio only, no viseme timing yet)
/////////////////////////////////////////////////////////////////////////////////////////////////////////

async function perform_tts_remote(args) {
	const url = args.url || 'https://api.openai.com/v1/audio/speech'
	const props = {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.bearer || ''}` },
		body: JSON.stringify({ model: args.model || 'tts-1', voice: args.voice || 'shimmer', input: args.text }),
	}
	try {
		const response = await fetch(url, props)
		if (!response.ok) { console.error('puppet:tts error', response); return null }
		return { audio: await response.arrayBuffer(), lipsync: null }
	} catch (err) {
		console.error('Error:', err)
	}
	return null
}

//
// utility to correct pronounciation of dollars
//

function numberToWords(num) {
	const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
		'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
	const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
	const numToWords = (n) => {
		if (n < 20) return a[n]
		if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? '-' + a[n % 10] : '')
		if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + numToWords(n % 100) : '')
		return numToWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '')
	}
	return numToWords(num)
}

function convertAmountToWords(amount) {
	const [dollars, cents] = amount.toFixed(2).split('.')
	const dollarPart = numberToWords(parseInt(dollars))
	const centPart = numberToWords(parseInt(cents))
	return `${dollarPart} dollars${cents > 0 ? ' and ' + centPart + ' cents' : ''}`
}

function fixDollars(sentence) {
	return sentence.replace(/\$\d+(\.\d{1,2})?/g, (match) => {
		const amount = parseFloat(match.replace('$', ''))
		return convertAmountToWords(amount)
	})
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////
// synthesize one perform fragment -> audio (+lipsync) and republish on the bus
/////////////////////////////////////////////////////////////////////////////////////////////////////////

let rcounter = 1000
let bcounter = 0

async function perform_tts(perform, tts) {
	const text = fixDollars(perform.text).replace(/[*<>#%-]/g, '')
	if (!text || !text.length) return null
	if (tts && tts.remote && tts.url) return perform_tts_remote({ ...tts, text })
	return perform_tts_local(text, tts || {})
}

async function resolve_one(perform, handler) {
	const interrupt = perform.interrupt
	if (interrupt && handler._latest_interrupt > interrupt) return
	const results = await perform_tts(perform, handler)
	if (!results || !results.audio) return
	if (interrupt && handler._latest_interrupt > interrupt) return
	rcounter++
	bus.resolve({ perform: {
		text: perform.text,
		audio: results.audio,
		lipsync: results.lipsync || null,   // Oculus visemes + timing from HeadTTS (null for remote)
		interrupt,
		human: perform.human ? true : false,
		final: perform.final ? true : false,
		rcounter: perform.rcounter || rcounter,
		bcounter: perform.bcounter || bcounter,
	}})
	console.log('tts - publishing audio... text =', perform.text, 'visemes =', results.lipsync ? results.lipsync.visemes.length : 0)
}

async function resolve_queue(perform, handler) {
	handler._queue.push(perform)
	if (handler._queue.length != 1) return
	while (handler._queue.length) {
		await resolve_one(handler._queue[0], handler)
		handler._queue.shift()
	}
}

function resolve(blob, _bus) {
	bus = _bus || bus

	// ignore?
	if (!blob || blob.tick || blob.time) return

	// accumulate entities that handle tts as per orbital ecs architecture
	if (blob.tts && blob.uuid) {
		const handler = this._handlers[blob.tts.uuid] = blob.tts
		handler._queue = []
	}

	// find handler for event - pick first one for now improve later @todo
	let candidates = Object.values(this._handlers)
	const handler = candidates.length ? candidates[0] : null
	if (!handler) return

	// stop all if there is a bargein from a human
	if (blob.perform && blob.perform.human && blob.perform.bargein) {
		handler._latest_interrupt = blob.perform.interrupt
		handler._queue = []
	}

	// ignore non-speakable / already-audio / human traffic
	if (!blob.perform || blob.perform.human || !blob.perform.text || !blob.perform.text.length || blob.perform.audio) return

	// do not await - would seize up the bus dispatch
	resolve_queue(blob.perform, handler)
}

export const tts_system = {
	id: uuid,
	_handlers: [],
	uuid,
	resolve,
}
