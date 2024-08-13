/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// use browser internal sound synthesis - built in stt sucks for many disappointing reasons unrelated to core performance - do not use
///
/// https://talkrapp.com/speechSynthesis.html <- lots of good tips here
///
/// There are several design defects in the built in tts api:
///     - only one voice at a time - which is really a problem for multi-agent environments
///     - a library of avaliable voices has to be fetched prior to being able to use those voices
///     - there is low information about the duration of an utterance prior to uttering it
///		- inconsistent timing
///		- cannot pipe audio where i want it
///		- voices themselves are poor
///
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// there's an issue where the synth doesn't preload voices and cannot play; so forceload voices early

let latched = 0
const synth_kickstart = () => {
	if(latched) return
	latched = 1
	if(typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') return
	//console.log("puppet::synth getting voices early")
	const synth = window.speechSynthesis
	synth.getVoices()
	synth.onvoiceschanged = (e) => {
		synth.getVoices()
	}
}
synth_kickstart()

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// attempting to use built in stt - which totally sucks - what an incredibly poor effort
// crude duration estimation support because the people that build the speech synthesis support left out this among many other features
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const syllables = (word) => {
	word = word.toLowerCase()
	word = word.replace(/(?:[^laeiouy]|ed|[^laeiouy]e)$/, '')
	word = word.replace(/^y/, '')
	//return word.match(/[aeiouy]{1,2}/g).length
	var syl = word.match(/[aeiouy]{1,2}/g)
	return syl ? syl.length : 0
}

const durations = {}

export function synthesize_estimate(text="hello",rate=1) {
	let duration = 0
	if(!text) {
		console.error("synthesize: no text")
		return
	}
	text.split(' ').forEach( token => {
		let average = 0
		let times = durations[token]
		if(!times || !times.length) {
			average = syllables(token) * 150
		} else if(times.length == 1) {
			average = times[0]
		} else {
			average = times.reduce((a, b) => a + b) / times.length
		}
		duration += average
	})
	duration = duration / rate
	//console.log("puppet::synth speaking sentence, duration estimation is",duration," and source text is",text)
	return duration
}

function _synthesize_estimate_insert(word,elapsed,time) {
	if(!word) return
	let times = durations[word]
	if(!times) times = durations[word] = []
	if(times.length>9) times.shift()
	const duration = elapsed - time
	times.push(duration)
	const average = times.reduce((a, b) => a + b) / times.length
	//console.log("puppet:synth:boundary word estimation word=",word,"duration=",duration,average,"syllables=",syllables(word))
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// utter something - return a time estimate - sadly this has to be estimated
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function synthesize(args={
		text:"hello",
		lang: "en-US",
		voice: "mary",
		rate: 1,
		pitch: 1,
		onend: null
	}) {

	// sanity checks
	if(!args.text || !args.text.length) return 0
	if(typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined' ) return 0

	const duration = synthesize_estimate(args.text,args.rate)

	const speech = window.speechSynthesis

	// stop whatever was going on
	speech.cancel()

	// try find voice as per user request as a number or a string
	const voices = speech.getVoices()
	if(!voices || voices.length < 1) {
		console.error("puppet::synth need at least one voice")
		return 0
	}
	let voice = args.voice || -1
	if (typeof voice === 'string' || voice instanceof String) {
		const str = voice
		for(voice=0;voice<voices.length;voice++) {
			//console.log(voices[voice])
			if(voices[voice].name === str) break
		}
	}
	if(voice >= 0 && voice >= voices.length) {
		console.warn("puppet::synth explicitly chosen voice is not found")
		voice = 0
	}

	// build utterance
	const utterance = new SpeechSynthesisUtterance(text)
	utterance.lang = args.lang || "en-US"
	utterance.rate = args.rate || 1
	utterance.pitch = args.pitch || 1
	utterance.voice = voices[voice]

	// speak - and watch activity to estimate durations since speech module doesn't provide it (which is ridiculuously bad design)
	let time = 0
	let previous = null
	utterance.onstart = (e) => {
		time = e.elapsedTime
	}
	utterance.onboundary = (e) => {
		// this could be used to 'just in time' do visemes? 
		if(previous)_synthesize_estimate_insert(previous,e.elapsedTime,time)
		previous = text.slice(e.charIndex, e.charIndex + e.charLength)
		time = e.elapsedTime
	}
	utterance.onend = (e) => {
		if(action.onend) action.onend()
	}
	speech.speak(utterance)

	// return this if we can
	return duration
}

