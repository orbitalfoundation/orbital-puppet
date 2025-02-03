
const uuid = 'tts-system'

////////////////////////////////////////////////////////////////////////////////////////////////////////
// tts local wasm worker using vits - slower on older machines
//
// declare worker as a string and fetch wasm from cdn due to vites import map failing on dynamic imports
//
// @todo it would be nice to use one copy of onyx
// @todo even having these present at all seems to crash the client on mobile
//
////////////////////////////////////////////////////////////////////////////////////////////////////////

const ttsString = `
import * as tts from 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm'
self.addEventListener('message', (e) => {
	const text = e.data.text || 'please supply some text'
	const voiceId = e.data.voice || 'en_US-hfc_female-medium'
	tts.predict({text,voiceId}).then(audio => {
		new Promise((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = () => resolve(reader.result)
			reader.onerror = () => reject(reader.error)
			reader.readAsArrayBuffer(audio)
		}).then(audio => {
			self.postMessage(audio)
		})
	})
})
`

const worker_tts = new Worker(URL.createObjectURL(new Blob([ttsString],{type:'text/javascript'})),{type:'module'})

//
// utility to correct pronounciation of dollars
//

function numberToWords(num) {
	const a = [
			'', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
			'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
	];
	const b = [
			'', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'
	];

	const numToWords = (n) => {
			if (n < 20) return a[n];
			if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? '-' + a[n % 10] : '');
			if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + numToWords(n % 100) : '');
			return numToWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
	};

	return numToWords(num);
}

function convertAmountToWords(amount) {
	const [dollars, cents] = amount.toFixed(2).split('.')
	const dollarPart = numberToWords(parseInt(dollars))
	const centPart = numberToWords(parseInt(cents))
	return `${dollarPart} dollars${cents > 0 ? ' and ' + centPart + ' cents' : ''}`
}

function fixDollars(sentence) {
	return sentence.replace(/\$\d+(\.\d{1,2})?/g, (match) => {
			const amount = parseFloat(match.replace('$', ''))
			return convertAmountToWords(amount)
	});
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////
// tss remote - using openai
/////////////////////////////////////////////////////////////////////////////////////////////////////////

async function perform_tts_remote(args) {

	const url = args.url || 'https://api.openai.com/v1/audio/speech'

	const props = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${args.bearer||''}`
		},
		body: JSON.stringify({
			model: args.model || "tts-1",
			voice: args.voice || "shimmer",
			input: args.text,
		}),
	}

	try {
		const response = await fetch(url,props)
		if(!response.ok) {
			console.error("puppet:tts error",response)
			return null
		}
		const buffer = await response.arrayBuffer()
		return { data: buffer }
	} catch(err) {
	  console.error('Error:', err)
	}
	return null
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////
// perform tts - async promise returns results
/////////////////////////////////////////////////////////////////////////////////////////////////////////

function perform_tts(perform,tts) {

	// patch up dollar sounds
	const text = fixDollars(perform.text).replace(/[*<>#%-]/g, "")
	if(!text || !text.length) return
	const args = {...tts, text }

	// hack - don't send this to worker
	delete args._queue

	// allow remote tts for performance
	if(tts && tts.remote && tts.url) {
		return perform_tts_remote(args)
	}

	// do local tts - returning results to promise to awaiting caller
	return new Promise((happy,sad)=>{
		worker_tts.onmessage = async (event) => { happy(event) }
		worker_tts.postMessage(args)
	})
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////
// tts queue - convert audio to text one by one
/////////////////////////////////////////////////////////////////////////////////////////////////////////

let rcounter = 1000
let bcounter = 0

async function resolve_one(perform,handler,sys) {
	const interrupt = perform.interrupt
	if(interrupt && handler._latest_interrupt > interrupt) return
	const results = await perform_tts(perform,handler)
	if(!results || !results.data) return
	if(interrupt && handler._latest_interrupt > interrupt) return
	rcounter++
	sys({perform:{
		text: perform.text,
		audio:results.data,
		interrupt,
		human: perform.human ? true : false,
		final: perform.final ? true : false,
		rcounter: perform.rcounter || rcounter,
		bcounter: perform.bcounter || bcounter
	}})
}

async function resolve_queue(perform,handler,sys) {
	handler._queue.push(perform)
	if(handler._queue.length != 1) return
	while(handler._queue.length) {
		await resolve_one(handler._queue[0],handler,sys)
		handler._queue.shift()
	}
}

function resolve(blob,sys) {

	// ignore?
	if(!blob || blob.tick || blob.time) return

	// accumulate entities that handle tts as per orbital ecs architecture
	if(blob.tts && blob.uuid) {
		const handler = this._handlers[blob.tts.uuid] = blob.tts
		handler._queue = []
	}

	// find handler for event - pick first one for now improve later @todo
	let candidates = Object.values(this._handlers)
	const handler = candidates.length ? candidates[0] : null
	if(!handler) return

	// stop all if there is a bargein from a human
	if(blob.perform && blob.perform.human && blob.perform.bargein) {
		handler._latest_interrupt = blob.perform.interrupt
		handler._queue = []
	}

	// ignore?
	if( !blob.perform ||
		blob.perform.human ||
		!blob.perform.text ||
		!blob.perform.text.length ||
		blob.perform.audio
		) return

	// resolve - do not await because it will seize up the orbital sys message bus
	resolve_queue(blob.perform,handler,sys)
}

export const tts_system = {
	_handlers: [],
	uuid,
	resolve,
}

