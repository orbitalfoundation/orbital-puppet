


/* hack ... 
<script src="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.19/dist/bundle.min.js"></script>
*/

function loadScript(src) {
  var script = document.createElement('script');
  script.src = src;
  script.type = 'text/javascript';
  document.head.appendChild(script);
}

loadScript("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.js")
loadScript("https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.19/dist/bundle.min.js")

export const parts = { load: [

	// anchor: import.meta.url,

	// publishes new {human} packet including {human.bargein}
	// arguably could publish a dedicated {stop} or naked {bargein} for clarity @todo
	import.meta.url + '/../chat/stt.js',
	// import.meta.url + '/../utils/stt-sys.js',

	// observes {human} packets and paint to display
	// observes {human} packets and mark up the packet with one of the llm ai participants as a target
	// observes {breath} packets and paint to display
	import.meta.url + '/../chat/ux.js',

	// observes {human} packets and may publish global {breath} packets
	// observes {human.bargein} packets for barge in detection
	import.meta.url + '/../chat/llm.js',

	// observes {breath} packets and generate {speech} packets
	// observes {human.bargein} packets only for barge in detection
	import.meta.url + '/../chat/tts.js',

	// observes {audio} packets
	// observes {human.bargein} packets only for barge in detection
	// disabled for now since puppet below has to orchestrate more tightly
	// 'here/src/audio.js',

	// puppet system will bind to puppet instances to perform the packets and also play the audio
	import.meta.url + '/../puppet.js'
]}

//
// config options
// note the hack in the name to force this to be the last export due to the fact that exports are always alphabetical
// and we want this to load _after_ the services above
//

export const zzz_configuration = {configuration:{
	// microphone on or off
	microphone: true,
	// system stt
	builtin_stt: false,
	// barge in allowed - allow spoken aborts (although important for speech to speech it can be overly annoying in noisy environments)
	bargein: false,
	// auto-submit complete spoken utterances; a nice feature in voice to voice interactions
	autosubmit: false,
	// use local llm (fetched as a wasm module but sadly does not run on mobile and is compute heavy)
	local: false,
	// remote url of llm service if any
	url: null,
	// bearer token for authentication for remote fetch - @todo note this is exposed on the client - may want to use jwt
	auth: null,
	// override any llm specific pre-prompt for the system as in 'you are a helpful digital assistant'
	prompt: null,
	// for openai this is a low cost model
	model: 'gpt-3.5-turbo',
	// specific voice for piper
	voice: null,
}}


//
// @test - replaced the stt to ux pubsub broadcast with a more narrow explicit wire
// @note - alphabetical order of exports, wires has to come last right in export naming

//export const wires = {
//	wire:[
//		"stt_system", "stt.human_out", "ux_system", "ux.human_in",
//	]
//}


/*

@test above is a wiring harness idea - dec 20 2024

	- entities can explicitly mark inputs and output handlers; can be at entity level or component level
	- explicit wires can be constructed that bypass pub-sub and are late binding direct method calls
	- other wires to hook up if this test feels good:

			stt.text_out -> ux.text_in

			ux.text_out -> llm.text_in
			ux.stop     -> llm.stop
			  			-> tts.stop
			  			-> puppet.stop

			llm.text_out -> tts.text_in

			tts.audio_out -> puppet.audio_in

	- also these can be visually painted
	- can introduce position in space for behave graph style layout on a per wire basis
	- can introduce position placement of parent object
	- can introduce property setters on a public field concept

*/





