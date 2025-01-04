
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

	// if barge in is NOT enabled then ignore any non final audio
	// any final audio always flushes and resets all 
	if(blob.human.spoken && !blob.human.final && !this.bargein) {
		return
	}

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
