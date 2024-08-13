
///
/// TTS using coqui for now
///
/// Accepts a paragraph of text and calls a handler for each resultant audio chunk returned
/// Returns this to the handler : phonemes,b64encoded,duration,text
///

async function tts_coqui(tts,text) {
	try {
		const promptData = { prompt:text }
		const response = await fetch(tts.url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(promptData)
		})
		if(!response.ok) {
			console.error("puppet:tts error",response)
		} else {
			const data = await response.json()
			const phonemes = data.word_boundaries.map( ({offset,text}) => ({text,offset:offset*1000}) )
			const audio = "data:audio/wav;base64,"+data.base64
			const duration = data.duration * 1000
			return { phonemes,audio,duration }
		}
	} catch(err) {
		console.error("puppet::tts error",err)
	}
	return null
}


