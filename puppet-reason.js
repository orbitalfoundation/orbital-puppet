
import { secrets } from './secrets.js'

const isServer = typeof window === 'undefined'

import { lipsyncQueue, lipsyncGetProcessor } from './talkinghead/modules/lipsync-queue.mjs'

function extract_tokens(str="") {
	const regex = /\[(\w+)\]/g
	let actions = []
	let results = str.replace(regex, (match, action) => { actions.push(action); return '' })
	results = results.replace(/\s+/g, ' ').trim();
	return { results, actions }
}

///
/// Do reasoning, speech to text, time stamp generation and call a callback with many fragments
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
///
/// @note keys will be exposed if this is run on client - best to run on server side
///

export async function puppet_reason(scope,prompt,callback) {

	if(!scope.conversationCounter) {
		scope.conversationCurrent = 10000
		scope.conversationCounter = 10000
	} else {
		scope.conversationCounter++
	}

	//console.log("puppet reason - got prompt",prompt)

	let text = null

	// developer support skip reasoning and just say something on demand - @todo move up to developer shell
	if(prompt.startsWith('/say')) {
		text = prompt.slice(4).trim()
	}

	// reason
	else if(scope.reason) {
		text = await puppet_reason_llm(scope.reason,prompt)
		if(!text) {
			text = 	"Having trouble responding due to network error"
		}
		console.log("puppet reason: got response",text)
	} else {
		text = "This npc has no reasoning ability"
	}

	if(!text || !text.length) {
		console.error("puppet reason - has nothing to say")
		return []
	}

	//
	// build a queue of separated word text[] fragments from the input phrase
	//
	// @todo this is kind of overkill; it's nice to clean up the sentences but visemes produced here are thrown away later and rebuilt
	// @todo if a websockets approach or a streaming approach was used then llm would return small fragments
	//
	// see https://x.com/trydaily/status/1815530613434417241
	//

	await lipsyncGetProcessor("en")

	let queue = lipsyncQueue(text)

	let segment = 0

	for(const blob of queue) {

		// track original prompt
		blob.prompt = prompt

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
	
		// store a few facts about which performance this is - useful for aborting conversations
		blob.conversation = scope.conversationCounter
		blob.segment = segment++
		blob.segmentsTotal = queue.length

	
		// tts using openai for now
		let buffer = null
		delete blob.audio

		if(blob.text && blob.text.length && scope.tts && scope.tts.bearer == "openai") {

			buffer = await puppet_reason_tts(scope.tts,blob.text)

			if(!buffer) {
				console.error("puppet reason : failed to talk to tts",blob)
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
		}

		//
		// tts using coqui
		// this path is disabled for now
		// it does work well
		// the approach is slightly different from whisper in that it returns phonemes which then use a lookup table for visemes
		//
		// else if(blob.text && scope.tts && scope.tts.bearer == "coqui") {
		//	const results = await tts_coqui(scope.tts,blob.text)
		//	Object.assign(blob,results)
		// }
		//

		// speech to text using openai - generate word timings; the benefit being that any tts can be used - it is a bit slower
		if(scope.whisper && buffer) {
			blob.whisper = await puppet_reason_stt(scope.whisper,buffer)
			if(!blob.whisper) {
				console.error('puppet reason - failed to get whisper timings')
			}
		}

		callback(blob)
	}

}

function fetch_wrapper(url,options) {
	options.headers.Authorization = `Bearer ${secrets.openai}`
	return fetch(url,options)
	// can proxy here if i wish @todo
}


async function puppet_reason_llm(reason,prompt) {

	const command = {
		method: 'POST',
		headers: {  'Content-Type': 'application/json' }
	}

	// configure for various targets
	if(reason.bearer === 'openai') {
	 	reason.url = reason.url || 'https://api.openai.com/v1/chat/completions'
		command.headers.Authorization = `Bearer ${reason.bearer}`
		command.body = JSON.stringify({
			model: reason.model || 'gpt-3.5-turbo',
			messages: [
				{ role: "system", content: reason.backstory },
				{ role: "user", content: prompt }
			]
		})
	} else if(reason.bearer = "ir") {
		const enable_rag = reason.hasOwnProperty('rag') ? reason.rag : false
		command.body = JSON.stringify({prompt,enable_rag})
	} else {
		console.error("puppet reason - unhandled type")
		return null
	}

	// have endpoint do reasoning
	try {
		const response = await fetch_wrapper(reason.url,command)
		if(response.ok) {
			const json = await response.json()
			if(reason.bearer === 'openai') {
				return json.choices[0].message.content
			} else {
				return json.error || json.data.response
			}
		}
		console.error("puppet: reasoning error",response)
	} catch(err) {
		console.error("puppet: reasoning catch error",err)
	}

	return null
}

export async function puppet_reason_tts(tts,text) {
	const url = tts.url || 'https://api.openai.com/v1/audio/speech'
	try {
		const response = await fetch_wrapper(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${tts.bearer}`,
			},
			body: JSON.stringify({
				model: tts.model || "tts-1",
				voice: tts.voice || "shimmer",
				input: text,
			}),
		})
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


async function puppet_reason_stt(props,bufferArray) {

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

		const GROQ = false // @todo look at props bearer

		// other important fields - @todo fetch from props
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

		const headers = {
			'Content-Type': `multipart/form-data; boundary=${boundary}`,
			'Content-Length': totalLength,
			'Authorization': `Bearer ${props.bearer}`,
		}

		const response = await fetch_wrapper(url, {
			method: "POST", headers, body
		})

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

		// @todo from talking heads - signaling animations need to be not functions - just don't do these here ideally
		/*
		// Add timed callback markers to the audio object
		const startSegment = async () => {
			// Look at the camera
			head.lookAtCamera(500);
			head.speakWithHands();
		};

		// Add timed callback markers to the whisperAudio object
		json.segments.forEach( x => {
			if ( x.start > 2 && x.text.length > 10 ) {
				whisperAudio.markers.push( startSegment );
				whisperAudio.mtimes.push( 1000 * x.start - 1000 );
			}
		});
		*/

		return whisperAudio

	} catch(err) {
		console.error("puppet stt - whisper error",err)
	}

	return null
}





















