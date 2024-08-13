
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

export async function puppet_reason_llm(reason,messages) {

	// configure for various targets
	if(reason.handler !== 'openai') {
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
		if(reason.handler === 'openai') {
			return json.choices[0].message.content
		} else {
			return json.error || json.data.response
		}
	} catch(err) {
		console.error("puppet: reasoning catch error",err)
	}

	return null
}

