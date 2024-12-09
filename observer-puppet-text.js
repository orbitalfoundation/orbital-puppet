
const isServer = typeof window === 'undefined'

let text_chat_window_open = false

//
// @summary helper to scan a scene for a nearby npc to talk to
// @param orbital sys backpointer
// @param xyz location of interest
//

const _find_nearby_npc = (sys,xyz) => {

	// query volatile local state for puppets
	const entities = sys.query({puppet:true})

	// randomize just to prevent any kind of order dependent biases in targeting
	entities.sort(() => Math.random() - 0.5)

	let best = null
	let distance = 9999999
	for(const entity of entities) {

		// can hold a conversation?
		if(!entity.puppet.reason) continue

		// distance?
		else if(entity.volume && entity.volume.transform && entity.volume.transform.xyz && xyz) {
			const xyz1 = entity.volume.transform.xyz
			let x = xyz1[0] - xyz[0]
			let y = xyz1[1] - xyz[1]
			let z = xyz1[2] - xyz[2]
			let d = x*x + y*y + z*z
			if( d > 10*10) continue
			if( d < distance ) {
				distance = d
				best = entity
			}
		} else {
			best = entity
			break
		}
	}

	return best
}

//
// @summary publish a player text conversation to the network
// @param text to publish
// @param sys backpointer to orbital sys
// @note assumes that something with a navigation component is the player
//

function _publish_chat_to_network(sys,text) {

	if(!text || !text.length) return

	// multicast text to network - not associated with a given uuid since these are throwaway @todo may want a db durable flag instead
	const packet = {
		network: {},
		conversation:{
			text,
		}
	}

	// find the 'self' player if any
	const speakers = sys.query({navigation:true})
	if(!speakers || !speakers.length || !speakers[0].volume || !speakers[0].volume.transform || !speakers[0].volume.transform.xyz) {
		console.error("text chat: bad speaker?",speakers)
	} else {
		packet.conversation.sponsoruuid = speakers[0].uuid
		packet.conversation.sponsorname = speakers[0].name
		const xyz = packet.conversation.xyz = speakers[0].volume.transform.xyz

		// send to nearby npc if any as well
		const npc = _find_nearby_npc(sys,xyz)
		if(npc) {
			packet.reason = {
				npcuuid: npc.uuid,
				prompt: text
			}
		}

	}

	sys.resolve(packet)

}

///
/// @summary an orbital observer that injects a html layout and will also publish user text activity
///
/// ux support for text chat box with a bit of history
///
///		+ helps with text chat between players and players and between players and npcs
///		+ integrates with paper and paints a text input dialog
///		+ integrates lightly with volume for distance detection (useful for npcs)
///		+ will detect nearest npcs - reducing some of the burden on npcs to figure this out
///		+ speech to text is enabled or disabled based on if this is open or closed
///

export const puppet_text_chat_ux = {

	uuid: 'orbital/puppet/observer-text-chat',

	// this is an actual paper component - it wwill intercept this and paint to the display
	// the dom element is injected into the paper node so the text_chat_uuid idea is not needed @todo use

	paper: {
		css: 'position:absolute;bottom:40px;right:10px;width:90%;font-size:2em;border:3px solid red;z-index:111000',
		children: [
			{
				css: 'display:none;width:100%;padding-left:4px;height:190px;background:rgba(200, 54, 54, 0.5)',
				kind: 'div',
				content: null,
			},
			{
				css: 'display:none;position:absolute;padding-left:4px;bottom:0px;left:0px;width:100%;outline:none;opacity:0.9;font-size:1em;border:0px;border-radius:5px;background:blue',
				kind:'input',
				onchange: (event,parent,sys) => {
					if(!event || !event.target || !event.target.value.length) return
					_publish_chat_to_network(sys,event.target.value)
					event.target.value = ''
				}
			},
			{
				css: 'position:absolute;bottom:0px;right:0px;font-size:1.9em;font-size:2em;',
				content:`💬`,
				onclick: (args,paper,sys)=>{
					const a = args.target.parentNode.children[0].style
					const b = args.target.parentNode.children[1].style
					const state = a.display == 'block'
					a.display = b.display = state ? 'none' : 'block'
					text_chat_window_open = state ? false : true
				}
			}
		]
	},

	//
	// update the displayed ux with text chatter from anywhere including both locally and network
	//
	// @summary this is an actual message observer conponent - on the main orbital bus - watching for text conversations
	//

	resolve: function (blob) {

		if(isServer) return
		if(blob.tick) return
		if(!blob.conversation) return
		const text = blob.conversation.sponsorname + ': ' + blob.conversation.text

		// because this entity is registered wholesale in the client volatile storage it is legal to peek at the .paper component here
		if(!this || !this.paper || !this.paper._dom || !this.paper._dom.children) {
			console.error('observer text chat - paper node missing')
			return
		}

		// @todo 'paper' should be reactive ideally
		// const elem = { kind:'div', css:'font-size:2em', content:value }
		//if(chatbox.children.length>5) chatbox.children.shift()
		//chatbox.children.splice(chatbox.children.length-1,0,elem)

		// hack around the lack of reactivity of 'paper'
		const elem = document.createElement('div')
		elem.innerHTML = text
		const history = this.paper._dom.children[0]
		history.appendChild(elem)
		if(history.children.length>4) history.removeChild(history.firstChild)
	}

}

///////////////////////////////////////////////////////////////////////////

let recognition = null
let enabled = false

function voice_recognizer_set(sys,allow = true ) {
	try {
		if(!recognition) {
			recognition = new webkitSpeechRecognition()
			recognition.continuous = true
			recognition.interimResults = true
			recognition.onresult = function(event) {
				for (var i = event.resultIndex; i < event.results.length; ++i) {
					const text = event.results[i][0].transcript
					if (event.results[i].isFinal && text && text.length) {
						console.log("voice_recognizer final",text)
						_publish_chat_to_network(sys,text)
					} else {
						//console.log('chat widget: speech to text interim: ' + transcript);
					}
				}
			}
		}
		if(allow) {
			// seems to need a bit of time
			setTimeout( ()=> {
				if(!enabled) {
					console.log("observer text voice: listening")
					recognition.start()
					enabled = true
				}
			},300)
		} else {
			console.log("observer text voice: paused!!")
			recognition.abort()
			enabled = false
		}
	} catch(err) {
		console.log('chat widget: speech to text error: ' + err)
	}
}

let voice_state = false
let voice_allowed = false

///
/// @summary orbital observer - a voice recognizer system that busy polls for listening on or off
///
/// @todo perhaps puppets can publish a 'disallow voice until' based on active utterances
/// or they can publish if they are busy
/// we really shouldn't peek into the internals of other things
///
/// for now busy poll to see if puppets are speaking and if so make sure voice is disabled
/// also for now only allow voice if text window is open also
/// may need some kind of squelch or push to talk - especially in multiplayer - this all needs thought @todo
///

export const voice_recognizer_observer = {
	resolve: (blob,sys) => {
		if(isServer) return
		if(!blob.tick) return
		const entities = sys.query({puppet:true})
		voice_allowed = true
		entities.forEach( (entity) => {
			if(entity.puppet && entity.puppet.busy) {
				voice_allowed = false
			}
		})
		const state = voice_allowed && text_chat_window_open
		if(state != voice_state) {
			voice_state = state
			voice_recognizer_set(sys,state)
		}
	}
}
