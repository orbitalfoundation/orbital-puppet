
// a local stt worker
const url = new URL('./whisper/whisper-diarization-worker.js', import.meta.url)
const worker_stt = new Worker(url.href, { type: 'module' })
worker_stt.postMessage({ type: 'load', data: { device:'webgpu' } })

//
// utility to call whisper for timing
//

function transcribe(audio) {
	return new Promise((resolve, reject) => {
		worker_stt.postMessage({ type: 'run', data: { audio, language:'english' } })
		worker_stt.onmessage = (event) => {
			switch(event.data.status) {
			default: break
			case 'error':
			case 'complete': {
				if(event.data.result && event.data.result.transcript && event.data.result.transcript.chunks)
				if(event.data.result.segments && event.data.result.segments.length)
				{
					console.log("done")
					const chunks = event.data.result.transcript.chunks
					const speaker = event.data.result.segments[0].label
					resolve({chunks,speaker})
				} else {
					resolve({})
				}
			}
		}}
	})
}

export async function puppet_reason_stt_local(whisper_args,bufferArray) {

	try {

		const audioContext = new window.AudioContext({sampleRate: 16000 })
		let audioData = await audioContext.decodeAudioData(bufferArray)
		let audio
		if (audioData.numberOfChannels === 2) {
			const SCALING_FACTOR = Math.sqrt(2)
			let left = audioData.getChannelData(0)
			let right = audioData.getChannelData(1)
			audio = new Float32Array(left.length)
			for (let i = 0; i < audioData.length; ++i) {
				audio[i] = SCALING_FACTOR * (left[i] + right[i]) / 2
			}
		} else {
			audio = audioData.getChannelData(0)
		}

		// @todo awaiting is not good
		console.log("puppet reason local await to transcribe start",performance.now())
		let words = await transcribe(audio)
		console.log("puppet reason local await to transcribe done",performance.now())

		const whisperAudio = {
			words: [],
			wtimes: [],
			wdurations: [],
			markers: [],
			mtimes: []
		}

		// @todo i think i should just ship the word timings to the client and call it a day

		// Add words to the whisperAudio object
		// @todo the -150 is a hack... it's setting timing for later in pipeline and probably should not be set here

		words.chunks.forEach( x => {
			// @ts-ignore
			whisperAudio.words.push( x.text );
			// @ts-ignore
			whisperAudio.wtimes.push( 1000 * x.timestamp[0] - 150 );
			// @ts-ignore
			whisperAudio.wdurations.push( 1000 * (x.timestamp[1] - x.timestamp[0]) );
		})

		return whisperAudio

	} catch(err) {
		console.error("puppet stt - whisper error",err)
	}

	return null
}

export async function puppet_reason_stt(whisper_args,bufferArray) {

	//////////////////////////////////////////////////////////////////////////////////////////////
	// tediously encode a form in a way that it will be digested by a server
	//////////////////////////////////////////////////////////////////////////////////////////////

	try {

		// for some reason this fails on some nodejs installs due to some kind of weird pipe error
		// const blob = new Blob([bufferArray])
		// const form = new FormData()
		// form.append('file', blob, 'audio.mp3')
		// form.append("model", "whisper-1")
		// form.append("language", "en")
		// form.append("response_format", "verbose_json" )
		// form.append("timestamp_granularities[]", "word" )
		// form.append("timestamp_granularities[]", "segment" )

		// the file itself from a raw ArrayBuffer
		const file = new Uint8Array(bufferArray)

		const GROQ = false // @todo look at whisper_args

		// other important fields - @todo use whisper_args
		const args = {
			model: GROQ ? "whisper-large-v3" : "whisper-1",
			language: "en",
			response_format: "verbose_json",
			"timestamp_granularities[]": "word",
			file,
		}

		// build list of parts as an array
		const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
		let parts = []
		for(const [k,v] of Object.entries(args)) {
			parts.push(`--${boundary}\r\n`)
			if(k === 'file') {
				parts.push(
					'Content-Disposition: form-data; name="file"; filename="file.mp3"\r\n',
					'Content-Type: application/octet-stream\r\n\r\n',
					v,
					'\r\n'
				)
			} else {
				parts.push(
					`Content-Disposition: form-data; name="${k}";\r\n\r\n`,
					v,
					'\r\n'
				)
			}
		}
		parts.push(`--${boundary}--\r\n`)

		// estimate length of everything
		let totalLength = 0
		parts.forEach(part=>{ totalLength += part.length })

		let body = ""

		if(isServer) {
			// browser clients don't define 'Buffer' but it is typically stable for servers
			body = Buffer.allocUnsafe(totalLength);
			let offset = 0
			parts.forEach(part => {
				if (typeof part === 'string') {
					offset += body.write(part, offset, 'utf8');
				} else if (part === file || Buffer.isBuffer(part)) {
					file.forEach(c=>{ body.writeUInt8(c,offset); offset++ })
					//part.copy(body, offset);
					//offset += part.length;
				}
			})
		} else {
			// this approach can fail on some servers but works on clients
			body = new Blob(parts, { type: 'multipart/form-data' });
		}

		let url = GROQ ? "https://api.groq.com/openai/v1/audio/transcriptions" : "https://api.openai.com/v1/audio/transcriptions"

		const props = {
			method: 'POST',
			headers: {
				'Content-Type': `multipart/form-data; boundary=${boundary}`,
				'Content-Length': totalLength,
			},
			body
		}

		if(globalThis.secrets && globalThis.secrets.openai) {
			props.headers.Authorization = `Bearer ${globalThis.secrets.openai}`
		}

		///////////////////////////////////////////////////////////////////////////////////////////////////////
		// call the server
		///////////////////////////////////////////////////////////////////////////////////////////////////////

		const response = await fetch(url, props )

		if(!response.ok) {
			console.error("puppet stt - whisper bad response",response)
			return null
		}

		//////////////////////////////////////////////////////////////////////////////////////////////////////
		// pull out the word timings
		////////////////////////////////////////////////////////////////////////////////////////////////////////

		const json = await response.json()

		if(!json.words || !json.words.length) {
			console.error("puppet stt - whisper no data")
			return null
		}

		const whisperAudio = {
			words: [],
			wtimes: [],
			wdurations: [],
			markers: [],
			mtimes: []
		}

		// Add words to the whisperAudio object
		// @todo the -150 is a hack... it's setting timing for later in pipeline and probably should not be set here

		json.words.forEach( x => {
			// @ts-ignore
			whisperAudio.words.push( x.word );
			// @ts-ignore
			whisperAudio.wtimes.push( 1000 * x.start - 150 );
			// @ts-ignore
			whisperAudio.wdurations.push( 1000 * (x.end - x.start) );
		})

		return whisperAudio

	} catch(err) {
		console.error("puppet stt - whisper error",err)
	}

	return null
}



