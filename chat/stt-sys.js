
const uuid = 'stt-sys-system'

///
/// built in voice recognition - a singleton
///

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
				console.log(uuid,"recognizer start")
			} catch(err) {
				console.log(uuid,"recognizer started but with error")
			}
			this.recognizer.active = true
		}

		this.recognizer.stop2 = ()=>{
			if(!this.recognizer.active) return
			try {
				this.recognizer.abort()
				console.log(uuid,"recognizer stopped")
			} catch(err) {
				console.log(uuid,"recognizer stopped but with error")
			}
			this.recognizer.active = false
		}

		// stop listening on an error
		this.recognizer.onerror = (event) => {
			console.error(uuid,'speech recognition error', event.error);
			this.setAllowed(false)
		}

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
					human:{
						text: text.trim(),
						timestamp: performance.now(),
						confidence,
						spoken:true,
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
					this.setAllowed(false)
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
/// stt using built in detection
///	- ignores echo cancellation so it hears the local speech produced by this app, not just the microphone
///	- has lots of weird problems such as stop start
///	- looks like it is just not really usable in this scenario
///
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function resolve(blob) {

	// if speakers are truly done then also listen - @todo this feels a bit messy
	if(blob.speakers_done && blob.speakers_done.final) {
		//console.log(uuid,"speaking is done so listen now",blob)
		voicesys.setAllowed(true)		
	}

	// its possible to discern if it is a good time to listen by watching general barge in traffic
	if(blob.human && blob.human.bargein) {
		//console.log(uuid,"barge in to listen - may lose a word")
		voicesys.setAllowed(true)
	}

	// an external caller may advise us when there are no other sounds being played
	if(blob.stt && blob.stt.hasOwnProperty('allowed')) {
		voicesys.setAllowed(blob.stt.allowed?true:false)
	}

	// an external caller has to advise if the user has clicked a button to allow built in stt
	if(blob.stt && blob.stt.hasOwnProperty('desired')) {
		voicesys.setDesired(blob.stt.desired?true:false)
	}

}

export const stt_sys_system = {
	uuid,
	resolve,
	//singleton: true // an idea to distinguish systems from things that get multiply instanced @todo
}


