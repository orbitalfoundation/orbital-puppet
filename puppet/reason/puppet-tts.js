//
// utility to call openai for tts
//

export async function puppet_reason_tts(tts,text) {

	const props = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: tts.model || "tts-1",
			voice: tts.voice || "shimmer",
			input: text,
		}),
	}

	if(globalThis.secrets && globalThis.secrets.openai) {
		props.headers.Authorization = `Bearer ${globalThis.secrets.openai}`
	}

	const url = tts.url || 'https://api.openai.com/v1/audio/speech'

	try {
		const response = await fetch(url,props)
		if(!response.ok) {
			console.error("puppet:tts error",response)
			return null
		}

		return await response.arrayBuffer()

	} catch(err) {
	  console.error('Error:', err)
	}
	return null
}


