
import { puppet_reason_tts } from './puppet-tts.js'
import { puppet_reason_stt, puppet_reason_stt_local } from './puppet-stt.js'
import { lipsyncQueue } from '../shared/lipsync-queue.mjs'
import { fix_dollars } from './fix_dollars.js'

// buffer handling differs on server
const isServer = typeof window === 'undefined'

// a local tts worker
const worker_tts = new Worker((new URL('./worker-tts.js', import.meta.url)).href, { type: 'module' })

// debugging sanity check
let globalsegment = 0

///
/// a single prompt can return many text fragments - digest now
///

export async function puppet_fragment(scope,text,callback) {

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

	let queue = lipsyncQueue(text)

	for(const blob of queue) {

		// store a few facts about which performance this is - useful for aborting conversations
		blob.prompt = scope._prompt
		blob.conversation = scope.conversationCounter
		blob.segment = scope.segmentCounter++
		blob.global = globalsegment++

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

			// helper
			const extract_tokens = (str="") => {
				const regex = /\[(\w+)\]/g
				let actions = []
				let results = str.replace(regex, (match, action) => { actions.push(action); return '' })
				results = results.replace(/\s+/g, ' ').trim();
				return { results, actions }
			}

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

		// helper to finalize audio work
		const stt_audio_whisper = async (scope,blob,buffer) => {
			if(!buffer) {
				console.error("puppet reason - failed to talk to tts",blob)
				return
			}
			blob.audio = buffer_to_bytes(buffer)
			if(scope.whisper && scope.whisper.handler === 'local') {
				blob.whisper = await puppet_reason_stt_local(null,buffer)
			} else if(scope.whisper) {
				blob.whisper = await puppet_reason_stt(scope.whisper,buffer)
			}
		}

		//
		// TTS and STT using coqui
		// this path is disabled for now
		// it did work well
		// the approach is slightly different from whisper in that it returns phonemes which then use a lookup table for visemes
		//
		// else if(blob.text && scope.tts && scope.tts.handler == "coqui") {
		//	const results = await tts_coqui(scope.tts,blob.text)
		//	Object.assign(blob,results)
		// } else
		//

		//
		// tts and stt using a built in model
		// wrap in a promise so that it only does deals with one tts/stt pair at a time
		//

		if(scope.tts.handler === 'local' && typeof worker_tts !== 'undefined' && blob.text && blob.text.length) {
			await new Promise((resolve)=>{
				worker_tts.postMessage({text:blob.text})
				worker_tts.onmessage = async (event) => {
					const buffer = event && event.data ? event.data.buffer : null
					await stt_audio_whisper(scope,blob,buffer)
					resolve()
				}
			})
		}

		//
		// tts and stt using openai
		//

		else if(blob.text && blob.text.length && scope.tts && scope.tts.handler === "openai") {
			const buffer = await puppet_reason_tts(scope.tts,blob.text)
			// @todo - unsure why this isn't needed - the above was supposed to be an mp3 but it appears to be raw? or do other tools handle mp3 also?
			// @todo - could try run it through local mp3 mp3-estimate-duration.js logic?
			// audioContext.decodeAudioData(buffer)
			await stt_audio_whisper(scope,blob,buffer)
		}

		// pass back whatever i got
		callback(blob)

	}

}

