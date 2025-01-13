
const uuid = 'stt_system'

//import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/+esm";

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// xenova stt whisper - https://huggingface.co/spaces/Xenova/whisper-web
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

	// Do some work...
	// TODO use message data
	let transcript = await transcribe(
		message.audio,
		message.model,
		message.multilingual,
		message.quantized,
		message.subtask,
		message.language,
	);
	if (transcript === null) return;

	// Send the result back to the main thread
	self.postMessage({
		status: "complete",
		task: "automatic-speech-recognition",
		data: transcript,
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

//const worker = new Worker(new URL("./stt-xenova-worker.js", import.meta.url), { type: "module" });

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// https://github.com/ricky0123/vad - voice activity detector - used to pluck out chunks of voice from microphone
// has built in echo cancellation
// system voice recognition doesn't participate in audio echo cancellation - it is pretty broken in other ways also
// @todo for code clarity this actually could be a class - it has some declarations associated with it
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const positiveSpeechThreshold = 0.8

// @todo the code clarity here is poor
//system_stt: false,
//microphone: true,
//bargein: false,
//autosubmit: false,

async function start() {

	// while 'this' is preserved through the closures it is more clear to be explicit
	const context = this

	// response counter, increments once per full final response
	let rcounter = 1

	// breath counter, increments per fraction of a response captured then is reset
	let bcounter = 1

	//
	// publish a message to pub sub observers
	//
	const publish = (human={}) => {
	
		// @todo actually disable microphone, for now i just ingore all events instead
		if(!this.microphone) return

		const defaults = {
			text:"",
			interrupt: performance.now(),
			confidence:1,
			final:false,
			spoken:true,
			rcounter, bcounter,
		}

		if(human.final) {
			rcounter++
			bcounter = 1
		} else {
			bcounter++
		}

		// merge overtop defaults
		human = Object.assign(defaults,human)

		// if bargein enabled then all human voice will interrupt / force stop all downstream effects always
		if(this.bargein) human.bargein = true

		// if autosubmit is off then mark as not 'final' event - although incomplete events are allwed thru
		if(!this.autosubmit) human.final = false

		// publish - testing out an idea of formal outputs interfaces on components rather than directly to sys()
		context.human_out({ human },sys)

	}

	//
	// barge-in and audio completion callback
	//

	const vad_helper = (probs=null,audio=null) => {

		// if a probability is supplied and it is not likely speech then return
		const confidence = probs && probs.isSpeech ? probs.isSpeech : 1
		if(confidence < positiveSpeechThreshold) return

		// publish barge in to local pubsub observers - marking it as not final here
		const comment = `User vocalization heard ${bcounter}`
		publish({confidence,final:false,comment})

		// if actual audio has arrived then may pass it onto stt for real processing
		if(audio && !this.system_stt) {
			worker.postMessage({
				audio,
				model: DEFAULTS.DEFAULT_MODEL,
				multilingual: DEFAULTS.DEFAULT_MULTILINGUAL,
				quantized: DEFAULTS.DEFAULT_QUANTIZED,
				subtask: DEFAULTS.DEFAULT_SUBTASK,
				language: DEFAULTS.DEFAULT_LANGUAGE,
			})
		}
	}

	//
	// stt callback
	//

	const stt_helper = (event) => {
		if(!event.data) return
	    switch(event.data.status) {
	    default:
	    case 'initiate':
	    case 'download':
	    case 'progress':
	    case 'done':
	        return
	    case 'update':
	    case 'complete':
	    	// fall thru
	    }

		const final = event.data.status === 'complete'

		let text = final ? event.data.data.text : event.data.data[0]
		if(text && typeof text === 'string') text = text.trim(); else text = ""

	    const comment = final ? `STT final: ${text}` : `STT in-progress: ${text}`

		// workaround hack - there is a bug in the vad where it needs to be reset - @todo examine
		if(final && this._vad_timeout) { clearTimeout(this._vad_timeout); this._vad_timeout = 0 }

		// publish to the local pubsub group
		publish({text,final,comment})
	}

	worker.addEventListener("message", stt_helper )

	//
	// load ricky's vad system like so for now
	// @todo newer revs of this engine do not work for some reason
	//

    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });

    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.19/dist/bundle.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });

	//
	// start up the vad - this drives the custom stt system
	// detect barge-in events and final audio and generally driven stt processing
	// due to the deferred load of the script above a retry strategy is used for loading for now @todo improve
	//

	try {
		console.log("stt: starting voice activity detection")
		const myvad = await globalThis.vad.MicVAD.new({
			positiveSpeechThreshold,
			minSpeechFrames: 5,
			preSpeechPadFrames: 10,
			model: "v5",
			onFrameProcessed: (probs) => { vad_helper(probs,null) },
			onSpeechEnd: (audio) => { vad_helper(null,audio) }
		})
		myvad.start()
	} catch(err) {
		console.error(uuid,err)
	}

}

///
/// an stt manager - publishes human utterances and uses rickys excellent barge in detector
///
/// publishing salient details are:
///
///		{ human: {
///			text:'full or partial utterance',
///			rcounter, bcounter,
///			interrupt,
///			spoken: true,
///			final:true/false,
///		} }
///
/// the interrupt field is used as a timestamp to detect when barge in is more recent than last job
///

export const stt_system = {

	uuid,

	// a more or less self contained speech to text component - playing with component layout
	// note that these fields could directly pollute the entity namespace but might trigger other observers
	// generally it feels better to package a component as a single blob and leave root namespace open

	stt: {
		canonical:true, // @todo think of other ways to reserve schema namespaces for components
		schema:true, // a schema reservation idea @todo continue to refine this idea
		system_stt: false,
		microphone: true,
		bargein: false,
		autosubmit: false,
		start,

		// @test this is a test - this method handle can be overridden by a direct wire if desired
		human_out: (blob,sys)=> { sys(blob) }
	},

	// reserve the term 'stt' in entity namespace to be extra clear that components should not collide
	// @todo an easier way to do this would be to just mark the component itself as canonical or schema true
	schema: { stt: {}, },

	// watch public event streams - @todo could use a filter at sys level to catch configuration without conditional
	resolve: function(blob,sys) {
		if(!blob || blob.tick || blob.time) return
		if(blob.stt) {
			if(blob.stt.hasOwnProperty('system_stt')) {
				// @todo tbd. system stt sucks so badly it is not used - but it should be enabled at least at some point
				this.stt.system_stt = blob.stt.system_stt
			}
			if(blob.stt.hasOwnProperty('microphone')) {
				// @todo turn microphone off or on - @todo always on for now - i just block the return data
				this.stt.microphone = blob.stt.microphone
			}
			if(blob.stt.hasOwnProperty('bargein')) {
				// @todo right now we have to publish non-final or 'barge in' because ux needs to see spoken fragments
				// so this doesn't actually do anything here right now
				this.stt.bargein = blob.stt.bargein
			}
			if(blob.stt.hasOwnProperty('autosubmit')) {
				// for now we just block final events; so they should show up in ux as incomplete or not final events
				this.stt.autosubmit = blob.stt.autosubmit
			}
		}
	},

	//singleton: true // an idea to distinguish systems from things that get multiply instanced @todo
}

stt_system.stt.start()
