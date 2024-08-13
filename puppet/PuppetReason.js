
const isServer = typeof window === 'undefined'

import { lipsyncQueue, lipsyncGetProcessor } from '../talkinghead/modules/lipsync-queue.mjs'

import { PuppetSocket } from './PuppetSocket.js'

// debugging sanity check
let globalsegment = 0

// local llm worker
const worker_llm = new Worker((new URL('./worker-llm.js', import.meta.url)).href, { type: 'module' })
worker_llm.postMessage({load:true})

// local tts worker
const worker_tts = new Worker((new URL('./worker-tts.js', import.meta.url)).href, { type: 'module' })

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// @summary Perform reasoning and speech to text and generate word timings and passes many 'performances' back in a callback
/// @param scope A persistent object that contains many props for driving this module - some state is written to it
/// @param prompt The text that the caller wishes to have an llm reason about
/// @param callback Returns 'performance' objects containing audio, word timestamps, visemes, breaks, emotions and actions to perform
///
/// Done as a separate file to make it independent and modular so can be used in other projects
///
/// Goals:
///
/// 	- this code can run on server OR client and will broadcast performances to all clients
///		- this source file is intended to be modular/reusable and independent of any specific larger project or framing
///		- given a prompt, build out speech and visemes for a puppet to playback in 3d
///		- may call a reasoning engine if desired
///		- may call tts
///		- may even call an stt to get word timing
///		- may generates phonemes / visemes and whatnot
///		- @note keys may be be exposed if this is run on client - best to run on server side
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export async function puppetReason(scope,callback,prompt=null) {

	// sanity check
	if(!scope || !callback) return

	// buffer prompts to prevent overloading
	if(!scope._prompt_queue) {
		scope._prompt_queue = []
	}

	// add to queue
	if(prompt && prompt.length) {
		scope._prompt_queue.push(prompt)
	}

	// nothing to do?
	if(!scope._prompt_queue.length) {
		//console.log("puppet reason queue exhausted")
		return
	}

	// throw away most of the queue and work on the last item only
	prompt = scope._prompt_queue.at(-1)
	scope._prompt_queue = [prompt]

	// track a few facts
	scope._prompt = prompt
	scope.conversationCounter = scope.conversationCounter ? scope.conversationCounter+1 : 1
	scope.segmentCounter = 0

	// say something specific - (test code for developer support)
	if(prompt.startsWith('/say')) {
		const text = prompt.slice(4).trim()
		await puppetFragment(scope,text,callback)
		scope._prompt_queue.shift()
		await puppetReason(scope,callback,null)
		return
	}

	// reasoning - via socket - does not need history
	if(scope.socket) {
		scope.socket.prompt = prompt
		scope.socket.callback = async (text) => {
			await puppetFragment(scope,text,callback)
			scope._prompt_queue.shift()
			await puppetReason(scope,callback,null)
			return
		}
		if(!scope._socket) scope._socket = new PuppetSocket()
		scope._socket.send(scope.socket)
		return
	}

	// reasoning is absent
	if(!scope.reason) {
		const text = "This npc has no reasoning ability"
		await puppetFragment(scope,text,callback)
		scope._prompt_queue.shift()
		await puppetReason(scope,callback,null)
		return
	}

	// update reasoning history
	if(!scope.reason._messages) {
		scope.reason._messages = [
			{ role: "system", content: scope.reason.backstory },
		]
	}
	scope.reason._messages.push({ role: "user", content: prompt })

	// reason via client side llm
	if(true && worker_llm) { // || reason.bearer == 'mlc-ai') {
		const messages = scope.reason._messages
		worker_llm.postMessage({messages})
		worker_llm.onmessage = async (event) => {
			console.log('got message',event)
			const text = event.data.reply
			await puppetFragment(scope,text,callback)
			scope._prompt_queue.shift()
			await puppetReason(scope,callback,null)
		}
		return
	}

	// reasoning - via rest
	const text = await puppet_reason_llm(scope.reason,prompt)
	await puppetFragment(scope,text,callback)
	scope._prompt_queue.shift()
	await puppetReason(scope,callback,null)
}

// @todo remove this
lipsyncGetProcessor("en")

///
/// a single prompt can return many text fragments - digest now
///

async function puppetFragment(scope,text,callback) {

	if(!scope || !callback || !text || !text.length) {
		console.error("puppet reason - has nothing to do!",scope,text,callback)
		return
	}

	//
	// hack: for now patch up utterances around dollars such as $9.99 prior to lipsync
	//

	text = fix_dollars(text)

	//
	// build a queue of separated word text[] fragments from the input phrase
	//
	// @todo this is kind of overkill; it's nice to clean up the sentences but visemes produced here are thrown away later and rebuilt
	// @todo if a websockets approach or a streaming approach was used then llm would return small fragments
	//
	// see https://x.com/trydaily/status/1815530613434417241
	//

	let queue = lipsyncQueue(text)

	for(const blob of queue) {

		// store a few facts about which performance this is - useful for aborting conversations
		blob.prompt = scope._prompt
		blob.conversation = scope.conversationCounter
		blob.segment = scope.segmentCounter++
		blob.global = globalsegment++

		console.log('puppet reason - sending blob',blob.text,blob.conversation,blob.segment,blob.global,queue.length)

		// not an utterance?
		if(!blob.text || !blob.text.length) {
			delete blob.text
			delete blob.actions
		}

		// turn back into string
		else {

			// turn tokens into a string from a hash
			let text = blob.text.map( term => { return term.word }).join(' ')

			// at least rewrite as string
			blob.text = text

			// may also pluck out actions
			const { results, actions } = extract_tokens(text)
			if(actions && actions.length) {
				blob.text = results
				blob.actions = actions
			}
		}
	

		// helper
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


		//
		// TTS and STT using coqui
		// this path is disabled for now
		// it did work well
		// the approach is slightly different from whisper in that it returns phonemes which then use a lookup table for visemes
		//
		// else if(blob.text && scope.tts && scope.tts.bearer == "coqui") {
		//	const results = await tts_coqui(scope.tts,blob.text)
		//	Object.assign(blob,results)
		// } else
		//

		//
		// tts using a built in model
		// sadly this does not yield word timings - although they may improve in the future? check for updates @todo
		//

		if(typeof worker_tts !== 'undefined' && blob.text && blob.text.length) {
			console.log("tts")
			worker_tts.postMessage({text:blob.text})
			console.log("tts2")
			worker_tts.onmessage = async (event) => {
			console.log("tts3")
				const buffer = event && event.data ? event.data.buffer : null
				if(!buffer) return
				blob.audio = buffer_to_bytes(buffer)
				if(true) {
					blob.whisper = await puppet_reason_stt_local(null,buffer)
				} else if(scope.whisper) {
					blob.whisper = await puppet_reason_stt(scope.whisper,buffer)
				}
				callback(blob)
			}
			return
		}

		//
		// tts and stt using openai
		//

		else if(blob.text && blob.text.length && scope.tts && scope.tts.bearer === "openai") {

			const buffer = await puppet_reason_tts(scope.tts,blob.text)

			// @todo - unsure why this isn't needed - the above was supposed to be an mp3 but it appears to be raw? or do other tools handle mp3 also?
			// @todo - could try run it through local mp3 mp3-estimate-duration.js logic?
			// audioContext.decodeAudioData(buffer)

			if(!buffer) {
				console.error("puppet reason - failed to talk to tts",blob)
				return
			}

			blob.audio = buffer_to_bytes(buffer)
			if(true) {
				blob.whisper = await puppet_reson_stt_local(null,buffer)
			} else if(scope.whisper) {
				blob.whisper = await puppet_reason_stt(scope.whisper,buffer)
			}
		}

		callback(blob)
	}

}

//
// convenience function - right now [actions] are stuffed into the response - strip these out
//

function extract_tokens(str="") {
	const regex = /\[(\w+)\]/g
	let actions = []
	let results = str.replace(regex, (match, action) => { actions.push(action); return '' })
	results = results.replace(/\s+/g, ' ').trim();
	return { results, actions }
}


// test gemini on google canary - did not work
/*
import { pipeline } from './libs/transformers.min.js'
async function test() {
	const generator = await pipeline('text-generation', 'Xenova/gemini-nano')
	const messages = [
	  { role: 'system', content: 'You are a helpful assistant.' },
	  { role: 'user', content: 'Write me a poem.' },
	];
	const output = await generator(messages, { temperature: 0.6, top_k: 5 });
	console.log(output)
	alert(output)
}
*/

//
// @summary utility to call openai for reasoning
// @param reason - bucket of json with properties for calling remote llm
// @param prompt - text to pass to llm
// @return text - actual text of response from llm or null
// @todo may want to return an error message on failure
//

async function puppet_reason_llm(reason,messages) {

	// configure for various targets
	if(reason.bearer !== 'openai') {
		console.error("puppet reason - no llm found")
		return null
	}

	// configure fetch
	const props = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		}
	}

	// set bearer
	if(globalThis.secrets && globalThis.secrets.openai) {
		props.headers.Authorization = `Bearer ${globalThis.secrets.openai}`
	}

	// encode blob for openai
	props.body = JSON.stringify({
		model: reason.model || 'gpt-3.5-turbo',
		messages
	})

	// url
	const url = reason.url || 'https://api.openai.com/v1/chat/completions'

	// do reasoning
	try {
		const response = await fetch(url,props)
		if(!response.ok) {
			console.error("puppet: reasoning error",response)
			return
		}
		const json = await response.json()
		if(reason.bearer === 'openai') {
			return json.choices[0].message.content
		} else {
			return json.error || json.data.response
		}
	} catch(err) {
		console.error("puppet: reasoning catch error",err)
	}

	return null
}

//
// utility to call openai for tts
//

export async function puppet_reason_tts(tts,text) {

	const props = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: tts.model || "tts-1",
			voice: tts.voice || "shimmer",
			input: text,
		}),
	}

	if(globalThis.secrets && globalThis.secrets.openai) {
		props.headers.Authorization = `Bearer ${globalThis.secrets.openai}`
	}

	const url = tts.url || 'https://api.openai.com/v1/audio/speech'

	try {
		const response = await fetch(url,props)
		if(!response.ok) {
			console.error("puppet:tts error",response)
			return null
		}

		return await response.arrayBuffer()

	} catch(err) {
	  console.error('Error:', err)
	}
	return null
}

//
// utility to call whisper for timing
//


const url = new URL('../whisper/whisper-diarization-worker.js', import.meta.url)
const worker = new Worker(url.href, { type: 'module' })
worker.postMessage({ type: 'load', data: { device:'webgpu' } })

function transcribe(audio) {
	return new Promise((resolve, reject) => {
		worker.postMessage({ type: 'run', data: { audio, language:'english' } })
		worker.onmessage = (event) => {
			switch(event.data.status) {
			default: break
			case 'error':
			case 'complete': {
				if(event.data.result && event.data.result.transcript && event.data.result.transcript.chunks)
				if(event.data.result.segments && event.data.result.segments.length)
				{
					console.log("done")
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

async function puppet_reason_stt_local(whisper_args,bufferArray) {

	try {

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

		// @todo awaiting is not good
		console.log("puppet reason local await to transcribe start",performance.now())
		let words = await transcribe(audio)
		console.log("puppet reason local await to transcribe done",performance.now())
		console.log(words)

		const whisperAudio = {
			words: [],
			wtimes: [],
			wdurations: [],
			markers: [],
			mtimes: []
		}

		// @todo i think i should just ship the word timings to the client and call it a day

		// Add words to the whisperAudio object
		// @todo the -150 is a hack... it's setting timing for later in pipeline and probably should not be set here

		words.chunks.forEach( x => {
			// @ts-ignore
			whisperAudio.words.push( x.text );
			// @ts-ignore
			whisperAudio.wtimes.push( 1000 * x.timestamp[0] - 150 );
			// @ts-ignore
			whisperAudio.wdurations.push( 1000 * (x.timestamp[1] - x.timestamp[0]) );
		})

		return whisperAudio

	} catch(err) {
		console.error("puppet stt - whisper error",err)
	}

	return null
}

async function puppet_reason_stt(whisper_args,bufferArray) {

	//////////////////////////////////////////////////////////////////////////////////////////////
	// tediously encode a form in a way that it will be digested by a server
	//////////////////////////////////////////////////////////////////////////////////////////////

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
		const file = new Uint8Array(bufferArray)

		const GROQ = false // @todo look at whisper_args

		// other important fields - @todo use whisper_args
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
			},
			body
		}

		if(globalThis.secrets && globalThis.secrets.openai) {
			props.headers.Authorization = `Bearer ${globalThis.secrets.openai}`
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

//
// 
//


//
// hack code to fix up how dollar amounts are said
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

function fix_dollars(sentence) {
	return sentence.replace(/\$\d+(\.\d{1,2})?/g, (match) => {
			const amount = parseFloat(match.replace('$', ''))
			return convertAmountToWords(amount)
	});
}




