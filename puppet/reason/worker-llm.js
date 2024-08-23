

const selectedModel = "Llama-3.1-8B-Instruct-q4f32_1-MLC"
import * as webllm from "./web-llm.js" //https://esm.run/@mlc-ai/web-llm"
let engine = null
let ready = false

self.addEventListener('message', async (e) => {
	if(!engine) {
		await new Promise((resolve,reject) => {
			engine = new webllm.MLCEngine({
				initProgressCallback: (status)=>{
					if(!ready && status.progress === 1) {
						ready = true
						console.log('puppet worker llm - loaded llm')
						resolve()
					}
				}
			})
			engine.reload(selectedModel)
		})
	}
	if(!e.data.messages) return
	if(!ready) {
		console.warn('puppet worker llm - is not ready',e)
		return
	}
	const messages = e.data.messages
	console.log("npc worker llm got message to respond to",messages)
	const reply = await engine.chat.completions.create({messages})
	self.postMessage({reply:reply.choices[0].message.content})
})
