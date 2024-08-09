
const isServer = typeof window === 'undefined'

import { lipsyncQueue, lipsyncGetProcessor } from '../talkinghead/modules/lipsync-queue.mjs'

import { PuppetSocket } from './PuppetSocket.js'

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

let globalsegment = 0

export async function puppetReason(scope,prompt,callback) {

	if(!prompt || !prompt.length) {
		console.error('puppet reason - nothing to reason about')
		return
	}
	console.log("puppet reason - got prompt",prompt)

	// increment a conversation counter which is important for throwing away old conversations per puppet
	if(!scope.conversationCounter) {
		//console.warn("puppet - restarting conversation counter",scope)
		scope.conversationCounter = 10000
	}

	// track a few facts
	scope.prompt = prompt
	scope.conversationCounter++
	scope.segmentCounter = 0
	
	// say something specific - (test code for developer support)
	if(prompt.startsWith('/say')) {
		const text = prompt.slice(4).trim()
		await puppetFragment(scope,text,callback)
	}

	// reason based on a socket?
	else if(scope.socket) {
		if(!scope._socket) {
			scope._socket = new PuppetSocket()
		}
		scope.socket.callback = async (text) => {
			await puppetFragment(scope,text,callback)
		}
		scope.socket.prompt = prompt
		scope._socket.send(scope.socket)
	}

	// reason via rest
	else if(scope.reason) {
		const text = await puppet_reason_llm(scope.reason,prompt)
		await puppetFragment(scope,text,callback)
	}

	else {
		const text = "This npc has no reasoning ability"
		await puppetFragment(scope,text,callback)
	}

}

lipsyncGetProcessor("en")
let busy = 0

async function puppetFragment(scope,text,callback) {

	if(!scope || !callback || !text || !text.length) {
		console.error("puppet reason - has nothing to do!",scope,text,callback)
		return
	}

	//
	// for now patch up utterances around dollars such as $9.99
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

	console.log("puppet reason - fragment queue is", queue,busy)

	if(busy) {
		console.error('puppet reason - fragment queue overloaded',busy)
	}

	busy++

	for(const blob of queue) {

		// store a few facts about which performance this is - useful for aborting conversations
		blob.prompt = scope.prompt
		blob.conversation = scope.conversationCounter
		blob.segment = scope.segmentCounter++
		blob.global = globalsegment++
		console.log('puppet reason - sending blob',blob.text,blob.conversation,blob.segment,blob.global,queue.length)

		// the lipsync queue returns an array of text objects or nothing
		if(!blob.text || !blob.text.length) {
			delete blob.text
			delete blob.actions
		}

		else {

			// turn into a string from a hash
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
		// tts and stt using openai
		//

		if(blob.text && blob.text.length && scope.tts && scope.tts.bearer === "openai") {

			const buffer = await puppet_reason_tts(scope.tts,blob.text)

			if(!buffer) {
				console.error("puppet reason - failed to talk to tts",blob)
				return
			}

			if(isServer) {
				const binary = Buffer.from(buffer).toString('binary');
				blob.audio = Buffer.from(binary, 'binary').toString('base64');
			} else {
				const uint8buf = new Uint8Array(buffer)
				const arrayu8 = Array.from(uint8buf)
				let binaryu8 = ''; arrayu8.forEach(elem => { binaryu8+= String.fromCharCode(elem) })
				//const binaryu8 = String.fromCharCode.apply(null,arrayu8) // this is blowing the stack
				// don't bother packaging this up as a playable file but rather let the client do that if desired
				// blob.audio = "data:audio/mp3;base64," + window.btoa( binary )
				blob.audio = window.btoa(binaryu8)
			}

			//
			// stt
			//

			if(scope.whisper && buffer) {
				blob.whisper = await puppet_reason_stt(scope.whisper,buffer)
				if(!blob.whisper) {
					console.error('puppet reason - failed to get whisper timings')
				}
			}
		}


		callback(blob)
	}

	busy--

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

//
// @summary utility to call openai for reasoning
// @param reason - bucket of json with properties for calling remote llm
// @param prompt - text to pass to llm
// @return text - actual text of response from llm or null
// @todo may want to return an error message on failure
//

async function puppet_reason_llm(reason,prompt) {

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
		messages: [
			{ role: "system", content: reason.backstory },
			{ role: "user", content: prompt }
		]
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
// utility to call openai for whisper timing segmentation 
//

async function puppet_reason_stt(whisper_args,bufferArray) {

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

		const response = await fetch(url, props )

		if(!response.ok) {
			console.error("puppet stt - whisper bad response",response)
			return null
		}

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




