
const uuid = 'tts-system'

////////////////////////////////////////////////////////////////////////////////////////////////////////
// tts local wasm worker using vits - slower on older machines
////////////////////////////////////////////////////////////////////////////////////////////////////////

//
// import tts worker right now
// declare worker as a string and fetch wasm from cdn due to vites import map failing on dynamic imports
//

const ttsString = `
import * as tts from 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm'
self.addEventListener('message', (e) => {
	const text = e.data.text || 'please supply some text'
	const voiceId = e.data.voice || 'en_US-hfc_female-medium'
	tts.predict({text,voiceId}).then(audio => {
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

/////////////////////////////////////////////////////////////////////////////////////////////////////////
// tss remote - using openai
/////////////////////////////////////////////////////////////////////////////////////////////////////////

async function perform_tts_remote(args) {

	const props = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${args.bearer||''}`
		},
		body: JSON.stringify({
			model: args.model || "tts-1",
			voice: args.voice || "shimmer",
			input: args.text,
		}),
	}

	const url = args.url || 'https://api.openai.com/v1/audio/speech'

	try {
		const response = await fetch(url,props)
		if(!response.ok) {
			console.error("puppet:tts error",response)
			return null
		}
		const buffer = await response.arrayBuffer()
		return { data: buffer }
	} catch(err) {
	  console.error('Error:', err)
	}
	return null
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////
// perform tts
/////////////////////////////////////////////////////////////////////////////////////////////////////////

function perform_tts(breath) {

	// patch up dollar sounds
	const text = fixDollars(breath.breath).replace(/[*<>#%-]/g, "")
	if(!text || !text.length) return
	const args = { ...breath.tts, text }

	// allow remote tts for performance
	if(breath.tts && breath.tts.remote && breath.tts.url) {
		return perform_tts_remote(args)
	}

	// do local tts
	return new Promise((happy,sad)=>{
		worker_tts.onmessage = async (event) => { happy(event) }
		worker_tts.postMessage(args)
	})
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// speech diarization local worker - slow on older machines
//
// a local stt worker to generate timing data for speech audio
//
// @todo one way to avoid this code would be if the speech generator generated timing data
// @todo another way to avoid this code is to spread phoneme timing over the duration of the audio
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////

const diary_worker_string = `

//import { pipeline, AutoProcessor, AutoModelForAudioFrameClassification } from '@xenova/transformers';
//import { pipeline, AutoProcessor, AutoModelForAudioFrameClassification } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2'
//import { pipeline, AutoProcessor, AutoModelForAudioFrameClassification } from './transformers.min.js'

import { pipeline, AutoProcessor, AutoModelForAudioFrameClassification } from 'https://cdn.jsdelivr.net/npm/orbital-puppet@1.1.4/chat/whisper/transformers.min.js'

const PER_DEVICE_CONFIG = {
    webgpu: {
        dtype: {
            encoder_model: 'fp32',
            decoder_model_merged: 'q4',
        },
        device: 'webgpu',
    },
    wasm: {
        dtype: 'q8',
        device: 'wasm',
    },
};

/**
 * This class uses the Singleton pattern to ensure that only one instance of the model is loaded.
 */
class PipelineSingeton {
    static asr_model_id = 'onnx-community/whisper-small_timestamped';
    static asr_instance = null;

    static segmentation_model_id = 'onnx-community/pyannote-segmentation-3.0';
    static segmentation_instance = null;
    static segmentation_processor = null;

    static async getInstance(progress_callback = null, device = 'webgpu') {
        this.asr_instance ??= pipeline('automatic-speech-recognition', this.asr_model_id, {
            ...PER_DEVICE_CONFIG[device],
            progress_callback,
        });

        this.segmentation_processor ??= AutoProcessor.from_pretrained(this.segmentation_model_id, {
            progress_callback,
        });
        this.segmentation_instance ??= AutoModelForAudioFrameClassification.from_pretrained(this.segmentation_model_id, {
            // NOTE: WebGPU is not currently supported for this model
            // See https://github.com/microsoft/onnxruntime/issues/21386
            device: 'wasm',
            dtype: 'fp32',
            progress_callback,
        });

        return Promise.all([this.asr_instance, this.segmentation_processor, this.segmentation_instance]);
    }
}

async function load({ device }) {
    self.postMessage({
        status: 'loading',
        data: 'Loading models ('+device+')...'
    });

    // Load the pipeline and save it for future use.
    const [transcriber, segmentation_processor, segmentation_model] = await PipelineSingeton.getInstance(x => {
        // We also add a progress callback to the pipeline so that we can
        // track model loading.
        self.postMessage(x);
    }, device);

    if (device === 'webgpu') {
        self.postMessage({
            status: 'loading',
            data: 'Compiling shaders and warming up model...'
        });

        await transcriber(new Float32Array(16_000), {
            language: 'en',
        });
    }

    self.postMessage({ status: 'loaded' });
}

async function segment(processor, model, audio) {
    const inputs = await processor(audio);
    const { logits } = await model(inputs);
    const segments = processor.post_process_speaker_diarization(logits, audio.length)[0];

    // Attach labels
    for (const segment of segments) {
        segment.label = model.config.id2label[segment.id];
    }

    return segments;
}

async function run({ audio, language }) {
    const [transcriber, segmentation_processor, segmentation_model] = await PipelineSingeton.getInstance();

    const start = performance.now();

    // Run transcription and segmentation in parallel
    const [transcript, segments] = await Promise.all([
        transcriber(audio, {
            language,
            return_timestamps: 'word',
            chunk_length_s: 30,
        }),
        segment(segmentation_processor, segmentation_model, audio)
    ]);
    console.table(segments, ['start', 'end', 'id', 'label', 'confidence']);

    const end = performance.now();

    self.postMessage({ status: 'complete', result: { transcript, segments }, time: end - start });
}

// Listen for messages from the main thread
self.addEventListener('message', async (e) => {
    const { type, data } = e.data;

    switch (type) {
        case 'load':
            load(data);
            break;

        case 'run':
            run(data);
            break;
    }
});
`

//const url = new URL('./whisper/whisper-diarization-worker.js', import.meta.url)
//const worker_stt = new Worker(url.href, { type: 'module' })
const worker_stt = new Worker(URL.createObjectURL(new Blob([diary_worker_string],{type:'text/javascript'})),{type:'module'})

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

async function perform_stt_local(arrayBuffer) {

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
	let audioData = await audioContext.decodeAudioData(arrayBuffer)
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
// stt remote
/////////////////////////////////////////////////////////////////////////////////////////////////////////

const isServer = typeof window === 'undefined'

const buffer_to_bytes = (buffer) => {
	if(isServer) {
		const binary = Buffer.from(buffer).toString('binary');
		return Buffer.from(binary, 'binary').toString('base64');
	} else {
		const uint8buf = new Uint8Array(buffer)
		const arrayu8 = Array.from(uint8buf)
		let binaryu8 = ''; arrayu8.forEach(elem => { binaryu8+= String.fromCharCode(elem) })
		//const binaryu8 = String.fromCharCode.apply(null,arrayu8) // this is blowing the stack
		// don't bother packaging this up as a playable file but rather let the client do that if desired
		// blob.audio = "data:audio/mp3;base64," + window.btoa( binary )
		return window.btoa(binaryu8)
	}
}

async function perform_stt_remote(config,arrayBuffer) {

	try {

		// for some reason this fails on some nodejs installs due to some kind of weird pipe error
		// const blob = new Blob([bufferArray])
		// const form = new FormData()
		// form.append('file', blob, 'audio.mp3')
		// form.append("model", "whisper-1")
		// form.append("language", "en")
		// form.append("response_format", "verbose_json" )
		// form.append("timestamp_granularities[]", "word" )
		// form.append("timestamp_granularities[]", "segment" )

		// the file itself from a raw ArrayBuffer
		const file = new Uint8Array(arrayBuffer)

		const GROQ = false // @todo look at config

		const args = {
			model: GROQ ? "whisper-large-v3" : "whisper-1",
			language: "en",
			response_format: "verbose_json",
			"timestamp_granularities[]": "word",
			file,
		}

		// build list of parts as an array
		const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
		let parts = []
		for(const [k,v] of Object.entries(args)) {
			parts.push(`--${boundary}\r\n`)
			if(k === 'file') {
				parts.push(
					'Content-Disposition: form-data; name="file"; filename="file.mp3"\r\n',
					'Content-Type: application/octet-stream\r\n\r\n',
					v,
					'\r\n'
				)
			} else {
				parts.push(
					`Content-Disposition: form-data; name="${k}";\r\n\r\n`,
					v,
					'\r\n'
				)
			}
		}
		parts.push(`--${boundary}--\r\n`)

		// estimate length of everything
		let totalLength = 0
		parts.forEach(part=>{ totalLength += part.length })

		let body = ""

		if(isServer) {
			// browser clients don't define 'Buffer' but it is typically stable for servers
			body = Buffer.allocUnsafe(totalLength);
			let offset = 0
			parts.forEach(part => {
				if (typeof part === 'string') {
					offset += body.write(part, offset, 'utf8');
				} else if (part === file || Buffer.isBuffer(part)) {
					file.forEach(c=>{ body.writeUInt8(c,offset); offset++ })
					//part.copy(body, offset);
					//offset += part.length;
				}
			})
		} else {
			// this approach can fail on some servers but works on clients
			body = new Blob(parts, { type: 'multipart/form-data' });
		}

		let url = GROQ ? "https://api.groq.com/openai/v1/audio/transcriptions" : "https://api.openai.com/v1/audio/transcriptions"

		const props = {
			method: 'POST',
			headers: {
				'Content-Type': `multipart/form-data; boundary=${boundary}`,
				'Content-Length': totalLength,
				Authorization: `Bearer ${config.bearer||''}`
			},
			body
		}

		///////////////////////////////////////////////////////////////////////////////////////////////////////
		// call the server
		///////////////////////////////////////////////////////////////////////////////////////////////////////

		const response = await fetch(url, props )

		if(!response.ok) {
			console.error("puppet stt - whisper bad response",response)
			return null
		}

		//////////////////////////////////////////////////////////////////////////////////////////////////////
		// pull out the word timings
		////////////////////////////////////////////////////////////////////////////////////////////////////////

		const json = await response.json()

		if(!json.words || !json.words.length) {
			console.error("puppet stt - whisper no data")
			return null
		}

		const whisperAudio = {
			words: [],
			wtimes: [],
			wdurations: [],
			markers: [],
			mtimes: []
		}

		// Add words to the whisperAudio object
		// @todo the -150 is a hack... it's setting timing for later in pipeline and probably should not be set here

		json.words.forEach( x => {
			// @ts-ignore
			whisperAudio.words.push( x.word );
			// @ts-ignore
			whisperAudio.wtimes.push( 1000 * x.start - 150 );
			// @ts-ignore
			whisperAudio.wdurations.push( 1000 * (x.end - x.start) );
		})

		return whisperAudio

	} catch(err) {
		console.error("puppet stt - whisper error",err)
	}

	return null
}

const perform_stt = async (config,arrayBuffer) => {

	const buffer = arrayBuffer.slice(0)

	if(!buffer) {
		return
	}

	if(config && config.whisper_remote) {
		const whisper = await perform_stt_remote(config,buffer)
		return whisper
	} else {
		const whisper = await perform_stt_local(buffer)
		return whisper
	}
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

		// process tts chunk
		const results = await perform_tts(blob.breath)

		// interrupted? is current work obsolete? check after the delay abouve
		if(interrupt && this._last_interrupt > interrupt) {
			console.log("tts flushing 0",this._last_interrupt,interrupt)
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
		const whisper = await perform_stt(blob.breath.tts,results.data)
		const time3 = performance.now()
		//console.log(uuid,'it took',time3-time1,'milliseconds to say',blob,'(',time1,time2,time3,')')

		// interrupted?
		if(interrupt && this._last_interrupt > interrupt) {
			console.log("tts flushing!",this._last_interrupt,interrupt)
			this._queue = []
			return
		}

		const final = blob.breath.final ? true : false
		sys({audio:{data:results.data,whisper,interrupt,final}})
		this._queue.shift()
	}
}

//
// resolve
// @note must not use await else will stall rest of pipeline
//

function resolve(blob,sys) {

	// bargein sets the current age limit of valid data; using last valid barge in as a floor
	if(blob.human && blob.human.bargein) {
		this._last_interrupt = blob.human.interrupt
		this._queue = []
	}

	// queue breath segments
	if(blob.breath && blob.breath.breath && blob.breath.breath.length) {
		this._queue.push(blob)
		if(this._queue.length === 1) {
			this._resolve_queue()
		}
	}
}

export const tts_system = {
	uuid,
	resolve,
	_queue:[],
	_resolve_queue,
	_last_interrupt: 0,
	//singleton: true // an idea to distinguish systems from things that get multiply instanced @todo
}
