
// this does not work - i guess the rollup skips this
// import * as tts from '@diffusionstudio/vits-web'

// directly embedded @diffusionstudio/vits-web locally due to rollup failing to deal with workers
import * as tts from './vits-web.js';

self.addEventListener('message', async (e) => {
	if(e.data.text) {
		const text = e.data.text
		console.log('worker text to speech translating',text)
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



