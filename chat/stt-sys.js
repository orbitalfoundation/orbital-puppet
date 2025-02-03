
const uuid = 'stt-sys-system'

const voicesys = {

	recognizer: null,
	allowed: true,
	desired: false,

	init: function() {

		if(this.recognizer) return

		this.recognizer = new (window.SpeechRecognition || window.webkitSpeechRecognition)()
		this.recognizer.lang = 'en-US'
		this.recognizer.continuous = true
		this.recognizer.interimResults = true

		this.recognizer.start2 = ()=>{
			if(this.recognizer.active) return
			try {
				this.recognizer.start()
				//console.log(uuid,"recognizer start")
			} catch(err) {
				//console.log(uuid,"recognizer started but with error")
			}
			this.recognizer.active = true
		}

		this.recognizer.stop2 = ()=>{
			if(!this.recognizer.active) return
			try {
				this.recognizer.stop() // abort() seems to misbehave sadly
				//console.log(uuid,"recognizer stopped")
			} catch(err) {
				//console.log(uuid,"recognizer stopped but with error")
			}
			this.recognizer.active = false
		}

		this.recognizer.kick = (event)=> {
			if(event) {
				// the speech system 'times out'
				//console.error(uuid,'speech recognition error', event.error);
			}
			// calling abort() seems to leave the engine in a weird half state
			//this.recognizer.abort()
			this.recognizer.stop()
			setTimeout(()=>{ this.recognizer.start() },200)
		}

		this.recognizer.onerror = this.recognizer.kick

		let rcounter = 1
		let bcounter = 1

		// collect a full sentence and stop listening when has a full sentence
		this.recognizer.onresult = (event) => {
			for (let i = event.resultIndex; i < 1 && i < event.results.length; ++i) {
				const data = event.results[i]
				const text = data[0].transcript
				const confidence = data[0].confidence
				const final = data.isFinal
				const comment = `User vocalization ${bcounter} final ${final}`

				const blob = {
					perform:{
						text: text.trim(),
						interrupt: performance.now(),
						confidence,
						spoken:true,
						human:true,
						comment,
						rcounter,bcounter,
						final,
						bargein:true
					}
				}

				sys(blob)

				if(!final) {
					bcounter++
				} else {
					rcounter++
					bcounter=1
					this.recognizer.kick()
				}
			}
		}
	},

	updateListening: function() {
		if(!this.recognizer) return
		this.allowed && this.desired ? this.recognizer.start2() : this.recognizer.stop2()
	},

	setAllowed: function (state=true) {
		this.allowed = state
		this.updateListening()
	},

	setDesired: async function (state=true) {
		this.desired = state
		this.init()
		this.updateListening()
	},

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// stt using browser built in capabilities
///		- pretty broken generally; the people working on browser libs simply are not doing a good job here
///		- doesn't support audio echo cancellation even though webrtc supports it
///		- therefore listening to human voice must be explicitly disabled while other audio is playing
///		- has some hiccups around being stopped or started; is overly pendantic about starting twice
///		- we don't get any timing data even though it must know timing internally of utterance
///		- always force requires user interaction with screen before microphone can be turned on unlike other uses of microphone
///		- times out and must be reset every few seconds of silence
///
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function resolve(blob) {

	if(blob.config && blob.config.hasOwnProperty('noisy')) {
		//console.log("system stt speaker status",blob.config.noisy)
		voicesys.setAllowed(blob.config.noisy ? false : true )
	}

	if(blob.config && blob.config.hasOwnProperty('microphone')) {
		voicesys.setDesired(blob.config.microphone ? true : false )
	}

}

export const stt_sys_system = {
	uuid,
	resolve,
}


