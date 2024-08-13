
// this does fetch
// import * as onnxw from '/node_modules/onnxruntime-web/dist/esm/ort.wasm.min.js'


// this does not work - i guess the rollup skips this
// import * as tts from '@diffusionstudio/vits-web'

// this does fetch but not dependencies
import * as tts from './vits-web.js';


//import * as onnxc from '/node_modules/onnxruntime-common/dist/esm/index.js'

// import '@diffusionstudio/vits-web'
//import * as tts from '@diffusionstudio/vits-web';
//import '/node_modules/@onnxruntime-web/dist/esm/ort.all.min.js'

console.log("********************** starting")

self.addEventListener('message', async (e) => {
	console.log("got message",e)
	if(e.data.text) {
		const text = e.data.text
		console.log(1,tts)
		const wav = await tts.predict({text,voiceId: 'en_US-hfc_female-medium'})
		console.log(2)
		const buffer = await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = () => reject(reader.error);
			reader.readAsArrayBuffer(wav);
		});
		console.log(3)
	    self.postMessage({buffer})
	}
})



