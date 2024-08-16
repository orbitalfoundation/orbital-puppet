
import { puppet_fragment } from './puppet-fragment.js'

import { puppet_reason_llm } from './puppet-llm.js'

import { LLMSocket } from './LLMSocket.js'

// a local llm worker
const worker_llm = new Worker((new URL('./worker-llm.js', import.meta.url)).href, { type: 'module' })
worker_llm.postMessage({load:true})

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

export async function puppet_reason(scope,callback,prompt=null) {

	// sanity check
	if(!scope || !callback) return

	// queue to buffer requests while working
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

	// throw away most of the queue and work on the last item only for now
	prompt = scope._prompt_queue.at(-1)
	scope._prompt_queue = [prompt]

	// track a few facts
	scope._prompt = prompt
	scope.conversationCounter = scope.conversationCounter ? scope.conversationCounter+1 : 1
	scope.segmentCounter = 0

	// say something specific - (test code for developer support)
	if(prompt.startsWith('/say')) {
		const text = prompt.slice(4).trim()
		await puppet_fragment(scope,text,callback)
		scope._prompt_queue.shift()
		await puppet_reason(scope,callback,null)
		return
	}

	// reasoning via socket
	if(scope.socket) {
		scope.socket.prompt = prompt
		if(!scope._socket) scope._socket = new LLMSocket()
		scope.socket.callback = async (text) => {
			await puppet_fragment(scope,text,callback)
			scope._prompt_queue.shift()
			await puppet_reason(scope,callback,null)
			return
		}
		scope._socket.send(scope.socket)
		return
	}

	// reasoning is absent
	if(!scope.reason || !scope.reason.messages) {
		const text = "This npc has no reasoning ability"
		await puppet_fragment(scope,text,callback)
		scope._prompt_queue.shift()
		await puppet_reason(scope,callback,null)
		return
	}

	// reasoning history for local llm and openai
	scope.reason.messages.push({ role: "user", content: prompt })

	// reason via client side llm
	if(typeof worker_llm !== 'undefined' && scope.reason.handler === 'mlc-ai') {
		const messages = scope.reason.messages
		worker_llm.postMessage({messages})
		worker_llm.onmessage = async (event) => {
			console.log('puppet - local llm reason - got response',event)
			const text = event.data.reply
			if(!text || !text.length) return
			scope.reason.messages.push({ role:"tool", content: text})
			await puppet_fragment(scope,text,callback)
			scope._prompt_queue.shift()
			await puppet_reason(scope,callback,null)
		}
		return
	}

	// reasoning via rest gateway
	const text = await puppet_reason_llm(scope.reason,prompt)
	await puppet_fragment(scope,text,callback)
	scope._prompt_queue.shift()
	await puppet_reason(scope,callback,null)

}







