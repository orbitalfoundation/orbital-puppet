
const uuid = 'ux_system'

// global config
let allow_localllm = false
let allow_bargein = false
let allow_microphone = false
let allow_autosubmit = false
let llm_url = "https://api.openai.com/v1/chat/completions"
let llm_auth = ""
let desired = true
let systemPrompt = "You are a helpful digital agent"
let typing = 0
let rcounter = 1

// inject chat widget into dom - @todo this is slightly hacky
const results = await fetch(import.meta.url+'/../ux-html.html')
const html = await results.text()
const parser = new DOMParser()
const src = parser.parseFromString(html,'text/html')
const div = document.getElementById('volume001') || document.body // @todo this is a hack
src.body.childNodes.forEach(child => { div.appendChild(child.cloneNode(true)) })

PuppetChatOpen.onclick = () => {
	PuppetChatOpen.style.display='none'
	PuppetChatWindow.style.display='block'
	PuppetChatInput.focus()
}

PuppetChatClose.onclick = () => {
	PuppetChatOpen.style.display='block'
	PuppetChatWindow.style.display='none'
}

PuppetChatMike.onclick = (e) => {
	e.target.classList.toggle('off')
	allow_microphone = e.target.classList.toggle('on')
	textToChatHistory(allow_microphone ? 'Microphone on' : 'Microphone off')
}

PuppetChatLocal.onclick = (e) => {
	e.target.classList.toggle('off')
	allow_localllm = e.target.classList.toggle('on')
	sys({llm_configure:{local:allow_localllm,url:llm_url,auth:llm_auth}})
	textToChatHistory(allow_localllm ? 'Local LLM' : 'External LLM')
}

PuppetChatBarge.onclick = (e) => {
	e.target.classList.toggle('off')
	allow_bargein = e.target.classList.toggle('on')
	textToChatHistory(allow_bargein ? 'Barge-in Enabled' : 'Barge-in Disabled')
}

PuppetChatAuto.onclick = (e) => {
	e.target.classList.toggle('off')
	allow_autosubmit = e.target.classList.toggle('on')
	textToChatHistory(allow_autosubmit ? 'Voice to Voice On' : 'Voice to Voice Off')
}

PuppetChatInput.oninput = (e) => {
	//PuppetChatInput.style.height = 'auto'
	//PuppetChatInput.style.height = `${PuppetChatInput.scrollHeight}px`
}

PuppetChatInput.addEventListener('keydown', (e) => {
	typing = PuppetChatInput.value.length ? true : false
	if (e.key !== 'Enter' || e.shiftKey) return
	typing = 0
	e.preventDefault();
	PuppetChatSubmit.onclick()
})

PuppetChatSubmit.onclick = (e) => {
	const text = PuppetChatInput.value
	textInputClear()
	sendToPuppet(text)
	textToChatHistory(text,'You')
}

function textInputClear() {
	PuppetChatInput.value = ''
	PuppetChatInput.style.height = 'auto'
}

function textToChatHistory(text,sender='Support') {
	if (!text || !text.length) return
	const message = document.createElement('div')
	message.textContent = `${sender||'Support'}: ${text}`;
	PuppetChatHistory.appendChild(message)
	PuppetChatHistory.scrollTop = PuppetChatHistory.scrollHeight
}

function setStatus(text='Ready',style='ready') { 
	if(!style) style = 'ready'
	if(!text || typeof text !== 'string') text = style
	PuppetChatStatus.className = `status-${style}`
	PuppetChatStatus.textContent = text.charAt(0).toUpperCase() + text.slice(1);
}

function sendToPuppet(text) {
	if(!text || !text.length) return
	const interrupt = performance.now()
	sys({
		human:{
			text,
			confidence:1,
			spoken:false,
			final:true,
			interrupt,
			rcounter,
			bcounter:1,
			bargein:true
		}
	})
	rcounter++
}

let _vad_timeout = null

///
/// events can come from the text widgets above, but also from voice pathways
///

function resolve(blob,sys) {

	if(blob.time || blob.tick) return

	// paint 'ready' when actually done talking - @todo this feels a bit sloppy
	if(blob.audio_done && blob.audio_done.final) {
		setStatus('Ready')
	}

	// paint status messages
	if(blob.status) {
		setStatus(blob.status.text,blob.status.color || 'loading')
		//blob.status.progress >= 1.0 ? setStatus(null,'ready') : setStatus(text,'loading')
		//const match = text.match(/Loading model from cache\[(\d+)\/(\d+)\]/);
		//if (match) {
		//	const [current, total] = match.slice(1).map(Number);
		//	//updateProgressOnDisplay(current, total);
		//}
	}

	// paint llm breath fragments - could force the llm to publish history fragments instead @todo
	if(blob.breath) {
		if(blob.breath.breath) {
			textToChatHistory(blob.breath.breath,'Agent')
		}
		if(blob.breath.final) {
			setStatus('Done Thinking','thinking')
		}
	}

	// ignore anything that is not a human utterance
	if(!blob.human) return
	const human = blob.human
	const text = human.text

	// hack workaround - sometimes barge-ins will occur without any closure - and ux will be hung
	if(human.spoken) {
		if(_vad_timeout) clearTimeout(_vad_timeout)
		_vad_timeout = null
		if(!human.final) {
			_vad_timeout = setTimeout( ()=> {
				console.log(uuid,'...resetting to ready')
				// disabled for now - annoying to flush text
				//PuppetChatInput.value = ''
				setStatus('Ready')
			},5000)
		}
	}

	// Deal with spoken input
	if(human.spoken) {

		// Always ignore spoken events if typing
		if(typing) {
			textToChatHistory(`Ignoring spoken text while typing: ${human.text}`,'System')
			return { force_abort_sys: true }
		}

		// Show spoken partials or completed
		PuppetChatInput.value = text

		// If barge in events are disabled then don't allow them to percolate through
		if(!human.final && !allow_bargein) {
			return { force_abort_sys: true }
		}

		// Auto-submissions are disabled? Do allow partials (barge in events) through
		if(human.final && !allow_autosubmit) {
			return { force_abort_sys: true }			
		}

	} else {

		// debugging - bypass llm if text starts with 'say' - and throw away the original request
		if(text.startsWith('say') && text.length > 5) {
			const breath = text.substring(4)
			const interrupt = performance.now()
			sys({breath:{breath,interrupt,ready:true,final:true}})
			return { force_abort_sys: true }
		}

		// debugging - auth, url - and throw away original request
		if(text.startsWith('auth') && text.length > 5) {
			llm_auth = text.substring(5).trim()
			const interrupt = performance.now()
			sys({llm_configure:{local:allow_localllm,url:llm_url,auth:llm_auth}})
			textToChatHistory('Set Remote Auth')
			return { force_abort_sys: true }
		}

		// debugging - auth, url - and throw away original request
		if(text.startsWith('url') && text.length > 5) {
			llm_url = text.substring(4).trim()
			const interrupt = performance.now()
			sys({llm_configure:{local:allow_localllm,url:llm_url,auth:llm_auth}})
			textToChatHistory('Set Remote URL')
			return { force_abort_sys: true }
		}

	}

	// pretend we are in a multi agent scenario; there can be multiple llms and multiple puppets
	// decide on one to associate the traffic with as a target
	// as the packet continues to flow through all observers the llm-system will use this fact

	human.target = 'default'
	human.systemContent = systemPrompt

	// try provide some reasonable feedback at this time
	if(human.final) {
		setStatus('Thinking','thinking')
	} else {
		setStatus('Barge-in','thinking')		
	}
}

export const ux_system = {
	uuid,
	ux: {
		// @test - explicit late binding wires for inbound and outbound events for performance
		human_in: function(blob,sys) { resolve(blob,sys) },
		text_out: () => {}
	},
	resolve
}
