
const uuid = 'tts-system'

const voiceId = 'en_US-hfc_female-medium'

////////////////////////////////////////////////////////////////////////////////////////////////////////
// tts
////////////////////////////////////////////////////////////////////////////////////////////////////////

//
// import tts worker right now
// declare worker as a string and fetch wasm from cdn due to vites import map failing on dynamic imports
//

const ttsString = `
import * as tts from 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm'
self.addEventListener('message', (e) => {
	tts.predict({text:e.data,voiceId: 'en_US-hfc_female-medium'}).then(audio => {
		new Promise((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = () => resolve(reader.result)
			reader.onerror = () => reject(reader.error)
			reader.readAsArrayBuffer(audio)
		}).then(audio => {
			self.postMessage(audio)
		})
	})
})
`

const worker_tts = new Worker(URL.createObjectURL(new Blob([ttsString],{type:'text/javascript'})),{type:'module'})

//
// utility to correct pronounciation of dollars
//

function numberToWords(num) {
	const a = [
			'', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
			'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
	];
	const b = [
			'', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'
	];

	const numToWords = (n) => {
			if (n < 20) return a[n];
			if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? '-' + a[n % 10] : '');
			if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + numToWords(n % 100) : '');
			return numToWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
	};

	return numToWords(num);
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
	});
}

function chew(text) {
	if(!text || !text.length) return null
	return new Promise((happy,sad)=>{
		worker_tts.onmessage = async (event) => { happy(event) }
		worker_tts.postMessage(text)
	})
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////
// speech diarization
//
// a local stt worker to generate timing data for speech audio
// @todo one way to avoid this code would be if the speech generator generated timing data
// @todo another way to avoid this code is to spread phoneme timing over the duration of the audio
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////


const url = new URL('./whisper/whisper-diarization-worker.js', import.meta.url)
const worker_stt = new Worker(url.href, { type: 'module' })
worker_stt.postMessage({ type: 'load', data: { device:'webgpu' } })

function speechWorker(audio) {
	return new Promise((resolve, reject) => {
		worker_stt.postMessage({ type: 'run', data: { audio, language:'english' } })
		worker_stt.onmessage = (event) => {
			switch(event.data.status) {
			default: break
			case 'error':
			case 'complete': {
				if(event.data.result && event.data.result.transcript && event.data.result.transcript.chunks)
				if(event.data.result.segments && event.data.result.segments.length)
				{
					//console.log("done")
					const chunks = event.data.result.transcript.chunks
					const speaker = event.data.result.segments[0].label
					resolve({chunks,speaker})
				} else {
					resolve({})
				}
			}
		}}
	})
}

async function speechDiarization(bufferArray) {

	const whisper = {
		words: [],
		wtimes: [],
		wdurations: [],
		markers: [],
		mtimes: []
	}

	//
	// extract audio from ArrayBuffer
	//

	const audioContext = new window.AudioContext({sampleRate: 16000 })
	let audioData = await audioContext.decodeAudioData(bufferArray)
	let audio
	if (audioData.numberOfChannels === 2) {
		const SCALING_FACTOR = Math.sqrt(2)
		let left = audioData.getChannelData(0)
		let right = audioData.getChannelData(1)
		audio = new Float32Array(left.length)
		for (let i = 0; i < audioData.length; ++i) {
			audio[i] = SCALING_FACTOR * (left[i] + right[i]) / 2
		}
	} else {
		audio = audioData.getChannelData(0)
	}

	//
	// perform transcription
	// Add words to the whisperAudio object
	// @todo the -150 is a hack... it's setting timing for later in pipeline and probably should not be set here
	//

	let words = await speechWorker(audio)
	words.chunks.forEach( x => {
		whisper.words.push( x.text );
		whisper.wtimes.push( 1000 * x.timestamp[0] - 150 );
		whisper.wdurations.push( 1000 * (x.timestamp[1] - x.timestamp[0]) );
	})

	return whisper
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////
// resolve support
/////////////////////////////////////////////////////////////////////////////////////////////////////////

async function _resolve_queue() {
	while(true) {
		if(!this._queue.length) return
		const blob = this._queue[0]
		const interrupt = blob.breath.interrupt

		const time1 = performance.now()

		// tts
		const text = fixDollars(blob.breath.breath).replace(/[*<>#%-]/g, "")
		const results = await chew(text)

		// interrupted?
		if(this._bargein > interrupt) {
			this._queue = []
			return
		}

		// data error?
		if(!results || !results.data) {
			this._queue_shift()
			continue
		}

		const time2 = performance.now()

		// diarization
		const whisper = await speechDiarization(results.data.slice(0))

		const time3 = performance.now()
		//console.log(uuid,'it took',time3-time1,'milliseconds to say',text,'(',time1,time2,time3,')')

		// interrupted?
		if(this._bargein > interrupt) {
			this._queue = []
			return
		}

		const final = blob.breath.final ? true : false
		//console.log(uuid,"tts got valid results",blob,results)
		sys({audio:{data:results.data,whisper,interrupt,final}})
		this._queue.shift()
	}
}

//
// resolve - @note must not be async else will stall rest of pipeline
//

function resolve(blob,sys) {

	// when was most recent bargein detected?
	if(blob.human && blob.human.interrupt) this._bargein = blob.human.interrupt

	// barge in? - @todo in a scenario with multiple llms it may not make sense to stop all of them on any interruption
	if(blob.human) {
		this._queue = []
	}

	// queue breath segments
	if(!blob.breath || !blob.breath.breath) return
	this._queue.push(blob)
	if(this._queue.length !== 1) return
	this._resolve_queue()
}

export const tts_system = {
	uuid,
	resolve,
	_queue:[],
	_resolve_queue,
	_bargein: 0,
	//singleton: true // an idea to distinguish systems from things that get multiply instanced @todo
}
