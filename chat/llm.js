
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

// worker - as a string because dynamic imports are a hassle with rollup/vite
const workerString = `
import * as webllm from 'https://esm.run/@mlc-ai/web-llm';
const handler = new webllm.WebWorkerMLCEngineHandler();
self.onmessage = (msg) => { handler.onmessage(msg); };
`

async function load() {
	if(loading) return
	loading = true

	try {

		sys({status:{color:(ready?'ready':'loading'),text:`Loading local model ${selectedModel}`}})

		const initProgressCallback = (status) => {
			console.log(status.text)
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
				console.log('llm - service worker message',registration)
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

function llm_remote(sys,llm,tts,rcounter,bcounter,interrupt) {

	// configure body - with some flexibility hacked in for other servers aside from openai
	let body = {
		model: llm.llm_model || 'gpt-3.5-turbo',
		messages:llm.messages
	}
	if(llm.llm_url && llm.llm_url.includes('openai') == false) {
		body.question = text
	}
	body = JSON.stringify(body)

	// set fetch props
	const props = {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${llm.llm_auth||""}`,
			'Content-Type': 'application/json',
		},
		body
	}

	// fetch llm response - this must not block so do not await
	try {

		fetch(llm.llm_url,props).then(response => {

			if(!response.ok) {
				console.error("llm reasoning error",response)
				return
			}

			// throw away old traffic
			if(interrupt < llm._last_interrupt) {
				return
			}

			response.json().then( json => {
				let sentence = null
				if(json.choices) {
					// openai
					sentence = json.choices[0].message.content
				} else if(json.text) {
					// some other weird system
					sentence = json.text
				}
				if(sentence) {
					const fragments = sentence.split(/[.!?]|,/);
					fragments.forEach(breath => {
						sys({breath:{breath,tts,ready:true,final:true,rcounter,bcounter,interrupt}})
					})
				}
			})
		})

	} catch(err) {
		//sys({breath:{breath:"error talking to remote url",tts,ready:true,final:true,rcounter,bcounter,interrupt}})
		console.error("puppet: reasoning catch error",err)
	}

	return
}

function llm_local(sys,llm,tts,rcounter,bcounter,interrupt) {

	// start reasoning
	llm.thinking = true

	// helper: publish each breath fragment as it becomes large enough
	let breath = ''
	const breath_helper = (fragment=null,finished=false) => {
		if(!fragment || !fragment.length || finished) {
			if(breath.length) {
				bcounter++
				sys({breath:{breath,tts,ready,final:true,rcounter,bcounter,interrupt}})
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
			bcounter++
			sys({breath:{breath,tts,ready,final:false,rcounter,bcounter,interrupt}})
			breath = fragment.slice(i)
		}
	}

	// helper: a callback per chunk
	const helper = async (asyncChunkGenerator) => {

		// iterate over async iterables ... @todo can we abort this if we wish?
		for await (const chunk of asyncChunkGenerator) {
			if(!chunk.choices || !chunk.choices.length || !chunk.choices[0].delta) continue
			const content = chunk.choices[0].delta.content
			const finished = chunk.choices[0].finish_reason
			if(llm._last_interrupt > interrupt) return // work is out of date
			breath_helper(content,finished === 'stop')
		}

		// stuff the final message onto the llm history
		const paragraph = await engine.getMessage()
		llm.messages.push( { role: "assistant", content:paragraph } )

		if(llm._last_interrupt > interrupt) return // work is out of date
		sys({breath:{paragraph,breath:'',tts,ready,final:true,rcounter,bcounter,interrupt}})
	}

	console.log("llm: thinking about text 2")

	// begin streaming support of llm text responses as breath chunks
	engine.chat.completions.create(llm).then(helper)
}

const llm_entities = {}

async function resolve(blob,sys) {

	// ignore
	if(!blob || blob.tick || blob.time) return

	// accumulate a list of entities that have llm reasoning in them
	if(blob.llm && blob.uuid) {
		llm_entities[blob.uuid] = blob
	}
	
	// ignore if not a request from a human
	if(!blob.human) return

	// decide which llm to talk to
	let candidates = Object.values(llm_entities)
	const entity = candidates.length ? candidates[0] : {}
	if(!entity) {
		sys({breath:{breath:"Please configure me",ready,final:true,rcounter,bcounter,interrupt}})
		return
	}	
	const llm = entity.llm
	const tts = entity.tts || null

	// this is the highest counter that the callbacks will know about
	const rcounter = blob.human.rcounter || 1
	let bcounter = blob.human.bcounter || 1

	// override settings?
	if(blob.human.hasOwnProperty('llm_local')) {
		llm.llm_local = blob.human.llm_local ? true : false
		sys({breath:{breath:`Llm set ${llm.llm_local?'local':'remote'}`,ready,final:true,rcounter,bcounter}})
	}

	// ignore if no barge in
	if(!blob.human.bargein) return

	// the interrupt time is the set when a valid barge in makes older work obsolete
	const interrupt = llm._last_interrupt = blob.human.interrupt

	// if this specific llm was doing local reasoning, always force stop local whenever new content arrives
	if(llm.thinking && engine && engine.interruptGenerate) {
		console.log("llm: stopping")
		engine.interruptGenerate()
		llm.thinking = false
	}

	// for local reasoning requests, if not ready, start loading the brains
	if(llm.llm_local && !ready) {
		load()
		sys({breath:{breath:"Loading local llm",ready,final:true,rcounter,bcounter,interrupt}})
		return
	}

	// if utterance is incomplete (such as a barge in) then done - caller MUST set final also to do work
	if(!blob.human.final) return

	// get text if any - caller should supply text to work on
	const text = blob.human.text
	if(!text || !text.length) return

	console.log("llm: thinking about ",text)

	// stuff new human utterance onto the durable llm reasoning context - this is session persistent
	llm.messages.push( { role: "user", content:text } )

	// use a remote endpoint?
	if(!llm.llm_local) {
		llm_remote(sys,llm,tts,rcounter,bcounter,interrupt)
	} else {
		llm_local(sys,llm,tts,rcounter,bcounter,interrupt)
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// llm-helper resolve
///
/// listens for things like {human:{text:"how are you?"},llm:{},tts:{}}
///
/// publishes {llm:{breath:"llm response fragment",final:true|false}}
///
////////////////////////////////////////////////////////////////////////////////////////////////////

export const llm_system = {
	uuid,
	resolve,
	//singleton: true // an unused idea to distinguish systems from things that get multiply instanced @todo
}

