
const uuid = 'whisper_system'

//
// xenova whisper - https://huggingface.co/spaces/Xenova/whisper-web
//

function mobileTabletCheck() {
	// https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
	let check = false;
	(function (a) {
		if (
			/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(
				a,
			) ||
			/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
				a.substr(0, 4),
			)
		)
			check = true;
	})(
		navigator.userAgent ||
			navigator.vendor ||
			("opera" in window && typeof window.opera === "string"
				? window.opera
				: ""),
	);
	return check;
}

const isMobileOrTablet = mobileTabletCheck();

const DEFAULTS = {
	SAMPLING_RATE: 16000,
	DEFAULT_AUDIO_URL: '', //`https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav`,
	DEFAULT_MODEL: "Xenova/whisper-tiny",  //'distil-whisper/distil-small.en',
	DEFAULT_SUBTASK: null, //"transcribe",
	DEFAULT_LANGUAGE: null, //"english",
	DEFAULT_QUANTIZED: true, // isMobileOrTablet,
	DEFAULT_MULTILINGUAL: false,
};

const xenovaWorker = `
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Disable local models
env.allowLocalModels = false;

// Define model factories
// Ensures only one model is created of each type
class PipelineFactory {
	static task = null;
	static model = null;
	static quantized = null;
	static instance = null;

	constructor(tokenizer, model, quantized) {
		this.tokenizer = tokenizer;
		this.model = model;
		this.quantized = quantized;
	}

	static async getInstance(progress_callback = null) {
		if (this.instance === null) {
			this.instance = pipeline(this.task, this.model, {
				quantized: this.quantized,
				progress_callback,

				// For medium models, we need to load the no_attentions revision to avoid running out of memory
				revision: this.model.includes("/whisper-medium") ? "no_attentions" : "main"
			});
		}

		return this.instance;
	}
}

self.addEventListener("message", async (event) => {
	const message = event.data;

	let transcript = await transcribe(
		message.audio,
		message.model,
		message.multilingual,
		message.quantized,
		message.subtask,
		message.language,
	);
	if (transcript === null) return;

	self.postMessage({
		status: "complete",
		task: "automatic-speech-recognition",
		data: transcript,
		interrupt : event.data.interrupt,
		final: event.data.final,
		rcounter: event.data.rcounter,
		bcounter: event.data.bcounter
	});
});

class AutomaticSpeechRecognitionPipelineFactory extends PipelineFactory {
	static task = "automatic-speech-recognition";
	static model = null;
	static quantized = null;
}

const transcribe = async (
	audio,
	model,
	multilingual,
	quantized,
	subtask,
	language,
) => {

	const isDistilWhisper = model.startsWith("distil-whisper/");

	let modelName = model;
	if (!isDistilWhisper && !multilingual) {
		modelName += ".en"
	}

	const p = AutomaticSpeechRecognitionPipelineFactory;
	if (p.model !== modelName || p.quantized !== quantized) {
		// Invalidate model if different
		p.model = modelName;
		p.quantized = quantized;

		if (p.instance !== null) {
			(await p.getInstance()).dispose();
			p.instance = null;
		}
	}

	// Load transcriber model
	let transcriber = await p.getInstance((data) => {
		self.postMessage(data);
	});

	const time_precision =
		transcriber.processor.feature_extractor.config.chunk_length /
		transcriber.model.config.max_source_positions;

	// Storage for chunks to be processed. Initialise with an empty chunk.
	let chunks_to_process = [
		{
			tokens: [],
			finalised: false,
		},
	];

	// TODO: Storage for fully-processed and merged chunks
	// let decoded_chunks = [];

	function chunk_callback(chunk) {
		let last = chunks_to_process[chunks_to_process.length - 1];

		// Overwrite last chunk with new info
		Object.assign(last, chunk);
		last.finalised = true;

		// Create an empty chunk after, if it not the last chunk
		if (!chunk.is_last) {
			chunks_to_process.push({
				tokens: [],
				finalised: false,
			});
		}
	}

	// Inject custom callback function to handle merging of chunks
	function callback_function(item) {
		let last = chunks_to_process[chunks_to_process.length - 1];

		// Update tokens of last chunk
		last.tokens = [...item[0].output_token_ids];

		// Merge text chunks
		// TODO optimise so we don't have to decode all chunks every time
		let data = transcriber.tokenizer._decode_asr(chunks_to_process, {
			time_precision: time_precision,
			return_timestamps: true,
			force_full_sequences: false,
		});

		self.postMessage({
			status: "update",
			task: "automatic-speech-recognition",
			data: data,
		});
	}

	// Actually run transcription
	let output = await transcriber(audio, {
		// Greedy
		top_k: 0,
		do_sample: false,

		// Sliding window
		chunk_length_s: isDistilWhisper ? 20 : 30,
		stride_length_s: isDistilWhisper ? 3 : 5,

		// Language and task
		language: language,
		task: subtask,

		// Return timestamps
		return_timestamps: true,
		force_full_sequences: false,

		// Callback functions
		callback_function: callback_function, // after each generation step
		chunk_callback: chunk_callback, // after each chunk is processed
	}).catch((error) => {
		self.postMessage({
			status: "error",
			task: "automatic-speech-recognition",
			data: error,
		});
		return null;
	});

	return output;
};
`

const worker = new Worker(URL.createObjectURL(new Blob([xenovaWorker],{type:'text/javascript'})),{type:'module'})

// looks like the model needs an initial message to warm up
worker.postMessage({
	model: DEFAULTS.DEFAULT_MODEL,
	multilingual: DEFAULTS.DEFAULT_MULTILINGUAL,
	quantized: DEFAULTS.DEFAULT_QUANTIZED,
	subtask: DEFAULTS.DEFAULT_SUBTASK,
	language: DEFAULTS.DEFAULT_LANGUAGE,
})
worker.onmessage = (event) => {
	if(event.data.status !== 'done') return
	console.log('whisper: fully loaded')
}

function resolve(blob,sys) {

	if(!blob || blob.time || blob.tick) return

	if(!blob.perform || !blob.perform.audio || blob.perform.text || !blob.perform.human) return

	// barge in on any incomplete processing - allowing only a single utterance to be evaluated
	// arguably there could be a mode where all raw utterances are evaluated? @todo
	const interrupt = this._latest_interrupt = blob.perform.interrupt

	// do not convert incomplete utterances for now
	if(!blob.perform.final)	return

	const audio = blob.perform.audio
	const human = blob.perform.human ? true : false
	const rcounter = blob.perform.rcounter ? blob.perform.rcounter : (this.rcounter++)
	const bcounter = blob.perform.bcounter ? blob.perform.bcounter : (this.bcounter++)

	worker.postMessage({
		audio,
		interrupt,
		rcounter,
		bcounter,
		final: blob.perform.final,
		model: DEFAULTS.DEFAULT_MODEL,
		multilingual: DEFAULTS.DEFAULT_MULTILINGUAL,
		quantized: DEFAULTS.DEFAULT_QUANTIZED,
		subtask: DEFAULTS.DEFAULT_SUBTASK,
		language: DEFAULTS.DEFAULT_LANGUAGE,
	})

	worker.onmessage = (event) => {

		if(!event || !event.data) return
		switch(event.data.status) {
			default:
			case 'initiate':
			case 'download':
			case 'progress':
				//console.log('whisper: loading ',event.data.progress)
			case 'done':
				console.log("whisper: fully loaded")
				return
			case 'update':
				return
			case 'complete':
				// fall thru
		}

		// throw away old sentences if they were overriden by new events above
		if(this._latest_interrupt && this._latest_interrupt > event.data.interrupt) {
			// console.warn('whisper - work obsolete ignoring',this._latest_interrupt,event.data.interrupt)
			return
		}

		// ignore if no text
		const complete = event.data.status === 'complete'
		let text = complete ? event.data.data.text : event.data.data[0]
		if(!text || !text.length) return
		if(text && typeof text === 'string') text = text.trim(); else text = ""

		// 'final' as a concept is a function of complete supplied utterance and completely converted
		const final = event.data.final && complete

		// publish 
		const perform = {
			audio,
			text,
			confidence:1,
			spoken:true,
			human,
			bargein:true,
			final,
			interrupt,
			rcounter: event.data.rcounter,
			bcounter: event.data.bcounter
		}

		sys({perform})
	}

}

///
/// whisper - given performance packets with audio will publish a performance packet with text
///

export const whisper_system = {
	uuid,
	resolve,
	_rcounter:1000,
	_bcounter:0
}

