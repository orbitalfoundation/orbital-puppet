
const uuid = 'llm_system'

// feels easiest to just fetch these from the web
import * as webllm from "https://esm.run/@mlc-ai/web-llm"

// this is the only model that behaves well

const selectedModel = "Llama-3.1-8B-Instruct-q4f32_1-MLC"
// const selectedModel = "gemma-2-2b-it-q4f16_1-MLC"

// these models just seem to behave badly in a variety of different ways
//const selectedModel = "TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC"
//const selectedModel = 'snowflake-arctic-embed-s-q0f32-MLC-b4'
//const selectedModel = "Llama-3.2-3B-Instruct-q4f16_1-MLC"
// Llama-3.2-1B-Instruct-q4f16_1-MLC
// const selectedModel = "SmolLM2-360M-Instruct-q4f16_1-MLC" // this works and is extremely stupid

// length of an utterance till it is considered 'a full breaths worth'
const MIN_BREATH_LENGTH = 20

// local flags for background loaded llm
let engine = null
let loading = false
let ready = false
let rcounter = 1000
let bcounter = 0

// worker - as a string because dynamic imports are a hassle with rollup/vite
const workerString = `
import * as webllm from 'https://esm.run/@mlc-ai/web-llm';
const handler = new webllm.WebWorkerMLCEngineHandler();
self.onmessage = (msg) => { handler.onmessage(msg); };
`

async function load(sys) {
	if(loading) return
	loading = true

	try {

		sys({status:{color:(ready?'ready':'loading'),text:`Loading local model ${selectedModel}`}})

		const initProgressCallback = (status) => {
			sys({status:{color:(ready?'ready':'loading'),text:status.text}})
		}

		const completed = (_engine) => {
			engine = _engine
			ready = true
			sys({status:{color:(ready?'ready':'loading'),text:'Ready'}})
		}

		// service workers seem to be starved of cpu/gpu
		const USE_SERVICE_WORKER = false

		if(USE_SERVICE_WORKER) {
			navigator.serviceWorker.register("/sw.js",{type:'module'}).then( registration => {
				console.log('llm: service worker message',registration)
			})
			webllm.CreateServiceWorkerMLCEngine(selectedModel,{initProgressCallback}).then(completed)
		} else {
			const worker = new Worker(URL.createObjectURL(new Blob([workerString],{type:'text/javascript'})),{type:'module'})
			webllm.CreateWebWorkerMLCEngine(worker,selectedModel,{initProgressCallback}).then(completed)
		}

	} catch(err) {
		console.error("llm - worker fetch error",err)
	}
}


function processThinkBlocks(input) {
	const thinkBlocks = [];
	
	// Use replace with a callback to capture and remove <think> blocks
	const cleanedResponse = input.replace(/<think>(.*?)<\/think>/gs, (match, content) => {
	  thinkBlocks.push(content.trim()); // Add the contents of the <think> block to the array
	  return ""; // Remove the block from the original response
	});
  
	return { cleanedResponse, thinkBlocks };
  }

function llm_remote(llm,sys) {

	// get the timestamp associated with the current work
	const interrupt = llm._latest_interrupt

	// configure body - with some flexibility hacked in for other servers aside from openai
	let body = {
		model: llm.llm_model || 'gpt-3.5-turbo',
		messages:llm.messages
	}
	if(llm.llm_flowise === true) {
		body.question = llm.messages[llm.messages.length-1].text
	}
	body = JSON.stringify(body)

console.log("llm - sending datagramp to remote",body)

	// set fetch props
	const props = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
//	illegal cors error in header allow		'Last-Interrupt': interrupt,
		},
		body
	}

	if(llm.llm_auth && llm.llm_auth.length) {
		props.headers.Authorization = `Bearer ${llm.llm_auth}`
	}

	// fetch llm response - this must not block so do not await
	try {

		fetch(llm.llm_url,props).then(response => {

			if(!response.ok) {
				console.error("llm: reasoning error",llm,response)
				return
			}

			// throw away old traffic - @todo may have to use the one from props
			if(interrupt < llm._latest_interrupt) return

			// split up the input into smaller chunks for the tts and send onwards
			rcounter++
			bcounter=0
			response.json().then( json => {

				let sentence = null
				if(json.choices) {
					// openai
					sentence = json.choices[0].message.content
				} else if(json.text) {
					// some other weird system
					sentence = json.text
				}
				if(sentence && sentence.length) {

					// print deepseek to console
					const { cleanedResponse, thinkBlocks } = processThinkBlocks(sentence);
					if(thinkBlocks.length) {
						sys({status:{text:thinkBlocks.join(' ')}})	
					}
					if(!cleanedResponse || !cleanedResponse.length) return
					llm.messages.push( { role: "assistant", content:cleanedResponse } )

					const fragments = cleanedResponse.split(/[.!?]|,/);
					fragments.forEach(breath => {
						sys({perform:{text:breath,breath,ready:true,final:true,interrupt,rcounter,bcounter}})
						bcounter++
					})
				}
			})
		})

	} catch(err) {
		console.error("llm: reasoning catch error - bad remote url?",err)
	}
}

function llm_local(llm,sys) {

	// get the timestamp associated with the current work
	const interrupt = llm._latest_interrupt

	// start reasoning locally
	llm.thinking = true
	rcounter++
	bcounter = 0

	// helper: publish each breath collection of words as it becomes long enough for tts to bother with it
	let breath = ''
	const breath_helper = (fragment=null,finished=false) => {

		if(llm._latest_interrupt > interrupt) {
			console.log('llm: skipping - work is old',interrupt,llm)
			return
		}

		if(!fragment || !fragment.length || finished) {
			if(breath.length) {
				const final = true
				sys({perform:{text:breath,breath,ready,final,interrupt}})
				breath = ''
			}
			return
		}

		const match = fragment.match(/.*?[.,!?]/);
		if(breath.length < MIN_BREATH_LENGTH || !match) {
			breath += fragment
		} else {
			const i = match[0].length
			breath += fragment.slice(0,i)
			const final = false
			sys({perform:{text:breath,breath,ready,final,interrupt,rcounter,bcounter}})
			console.log("llm - publishing - fragment =",breath,"tim e=",interrupt)
			breath = fragment.slice(i)
			bcounter++
		}
	}

	// async helper: a callback per chunk - the lower level engine hangs if this is not fully consumed
	const helper = async (asyncChunkGenerator) => {

		if(!asyncChunkGenerator[Symbol.asyncIterator]) {
			const choices = asyncChunkGenerator.choices
			if(!choices || !choices.length) return
			const content = choices[0].message.content
			const finished = choices[0].finish_reason
			breath_helper(content,finished === 'stop')
		}
		else 

		// iterate over async iterables ... note that seems like this loop should not be aborted early
		for await (const chunk of asyncChunkGenerator) {
			if(!chunk.choices || !chunk.choices.length || !chunk.choices[0].delta) continue
			const content = chunk.choices[0].delta.content
			const finished = chunk.choices[0].finish_reason
			breath_helper(content,finished === 'stop')
		}

		// stuff the entire final message onto the llm history
		const paragraph = await engine.getMessage()
		llm.messages.push( { role: "assistant", content:paragraph } )
	}

	// begin streaming support of llm text responses as 'breath' packets
	engine.chat.completions.create(llm).then(helper)
}

const llm_entities = {}

async function resolve(blob,sys) {

	// ignore?
	if(!blob || blob.tick || blob.time) return

	// accumulate a list of entities that have llm reasoning in them
	if(blob.llm && blob.uuid) {
		llm_entities[blob.uuid] = blob
	}

	// override settings?
	if(blob.config && blob.config.hasOwnProperty('llm_local')) {
		llm.llm_local = blob.config.llm_local ? true : false
	}

	// else ignore if not a request from a human
	if(!blob.perform || blob.perform.human !== true) return

	// ignore if no barge in set - callers must set this
	if(!blob.perform.bargein) return

	// decide which llm to talk to
	let candidates = Object.values(llm_entities)
	const entity = candidates.length ? candidates[0] : {}
	if(!entity) {
		console.error('llm: No llm found')
		return
	}	
	const llm = entity.llm

	// stop local reasoning
	if(llm.thinking && engine && engine.interruptGenerate) {
		engine.interruptGenerate()
		llm.thinking = false
	}

	// late load llm - don't do this early since it crashes mobile @todo improve
	if(llm.llm_local && !ready) {
		load(sys)
		return
	}

	// only reason about final utterances - callers must set final
	if(!blob.perform.final) return

	// only reason about valid text - callers must set text
	const text = blob.perform.text
	if(!text || !text.length) return

	// remember human utterance as part of an ongoing session durable conversation
	llm.messages.push( { role: "user", content:text } )

	// update the latest interrupt - important for throwing away obsolete requests
	llm._latest_interrupt = blob.perform.interrupt

	// do work
	console.log("llm - reasoning on input =",text,"time =",blob.perform.interrupt)
	llm.llm_local ? llm_local(llm,sys) : llm_remote(llm,sys)
}

////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// llm-helper resolve
///
/// listens for things like {human:{text:"how are you?"}}
///
/// publishes {llm:{breath:"llm response fragment",final:true|false},interrupt}
///
////////////////////////////////////////////////////////////////////////////////////////////////////

export const llm_system = {
	uuid,
	resolve,
}

