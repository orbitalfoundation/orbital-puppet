

const selectedModel = "Llama-3.1-8B-Instruct-q4f32_1-MLC"
import * as webllm from "https://esm.run/@mlc-ai/web-llm"
let engine = null
let ready = false

self.addEventListener('message', async (e) => {
	if(!engine) {
		await new Promise((resolve,reject) => {
			engine = new webllm.MLCEngine({
				initProgressCallback: (status)=>{
					ready = status.progress == 1
					if(ready) {
						console.log('loading',status)
						resolve()
					}
				}
			})
			engine.reload(selectedModel)
		})
	}
	if(e.data.messages) {
		const messages = e.data.messages
		const reply = await engine.chat.completions.create({messages})
        self.postMessage({reply:reply.choices[0].message.content})
	}
})
