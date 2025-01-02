import * as webllm from 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm';
const handler = new webllm.ServiceWorkerMLCEngineHandler();
console.log("llm service worker starting up...")
self.onmessage = (msg) => {
	console.log("llm service worker got a message ...",msg)
	handler.onmessage(msg);
};
