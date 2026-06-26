
let rcounter = 1000
let typing = 0

let microphone = false
let llm_local = true
let bargein = true
let autosubmit = true
let showagent = true

// the bus, captured from resolve()'s 2nd arg at registration (DOM handlers fire later, after that)
let bus = null

//
// paint text to user screen
//

function textToChatWindow(text,isUser=true) {
	if(!text || !text.length) return
	const node = document.createElement('div');
	node.className = isUser ? 'PuppetChatUser' : 'PuppetChatAgent';
	node.textContent = text;
	PuppetChatHistory.appendChild(node);
	PuppetChatHistory.scrollTop = PuppetChatHistory.scrollHeight;
}

//
// update the in-place status indicator (model loading, thinking, speaking, ready) — replaces text
// rather than appending, so progress updates don't spam the chat history. auto-hides when ready.
//

function setStatus(text, ready=false) {
	const el = document.getElementById('PuppetStatus')
	if(!el) return
	if(!text) { el.hidden = true; return }
	el.textContent = text
	el.hidden = false
	clearTimeout(el._hideTimer)
	if(ready) el._hideTimer = setTimeout(() => { el.hidden = true }, 1500)
}

//
// deal with user hitting submit
//

PuppetControlSubmit.onclick = () => {
	const text = PuppetChatInputTextArea.value.trim()
	PuppetChatInputTextArea.value = ''
	typing = 0
	textToChatWindow(text,true)
	bus.resolve({
		perform:{
			text,
			confidence:1,
			spoken:false,
			final:true,
			human:true,
			interrupt : performance.now(),
			rcounter,
			bcounter:1,
			bargein:true
		}
	})
	rcounter++
}

//
// deal with the user hitting return
//

PuppetChatInputTextArea.onkeydown = (event) => {
	const text = PuppetChatInputTextArea.value.trim()
	// in general disable speaking from overriding text input
	typing = text && text.length ? true : false
	if (event.key !== 'Enter' || event.shiftKey || event.altKey) return
	// discard this event only so that it does not stuff a cr into the output
	event.preventDefault()
	// note that it is totally ok to send an empty line of text - acts as a barge in
	PuppetControlSubmit.onclick()
}

PuppetControlMicrophone.onclick = (e) => {
	microphone = PuppetControlMicrophone.classList.toggle('active') ? true : false
	//PuppetMicrophonePanel.style.display = microphone ? 'block' : 'none'
	textToChatWindow(`Setting microphone to ${microphone ? 'on' : 'off'}`,false)
	bus.resolve({config:{microphone}})
}

PuppetControlLocal.onclick = (e) => {
	llm_local = PuppetControlLocal.classList.toggle('active') ? true : false
	textToChatWindow(`Setting reasoning to ${llm_local ? 'local' : 'remote'}`,false)
	bus.resolve({config:{llm_local}})
}

PuppetControlBarge.onclick = (e) => {
	bargein = PuppetControlBarge.classList.toggle('active') ? true : false
	textToChatWindow(`Setting bargein to ${bargein ? 'on' : 'off'}`,false)
	bus.resolve({config:{bargein}})
}

PuppetControlAuto.onclick = (e) => {
	autosubmit = PuppetControlAuto.classList.toggle('active') ? true : false
	textToChatWindow(`Setting autosubmit to ${autosubmit ? 'on' : 'off'}`,false)
	bus.resolve({config:{autosubmit}})
}

PuppetControlAgent.onclick = (e) => {
	showagent = PuppetControlAgent.classList.toggle('active')
	document.querySelectorAll('.PuppetMainRight').forEach(elem=>{
		elem.style.display = showagent  ? 'block' : 'none'
	})
}

//
// register a chat observer - handles a few events
//

function resolve(blob) {
	bus = arguments[1] || bus

	// ignore
	if(!blob || blob.time || blob.tick) return

	// @todo handle .config

	// intercept spoken traffic by human only
	if(blob.perform && blob.perform.spoken && blob.perform.human === true) {

		const text = blob.perform.text

		if(text && text.length) {

			// disallow spoken text over typed text
			if(typing) {
				textToChatWindow(`Blocking spoken utterance while typing (${text})`,true)
				return { force_abort_sys: true }
			}

			// special case for 'stop'
			if(text.startsWith('stop')) {
				blob.perform.final = false
			}

			// display
			if(blob.perform.final && autosubmit) {
				PuppetChatInputTextArea.value = ''
				textToChatWindow(text,true)
			} else {
				PuppetChatInputTextArea.value = text
			}
		}

		// bargein?
		if(!blob.perform.final && !bargein) {
			console.log("chat - blocking bargein")
			return { force_abort_sys: true }
		}

		// abort autosubmit?
		if(blob.perform.final && !autosubmit) {
			console.log("chat - blocking autosubmit")
			return { force_abort_sys: true }
		}
	}

	// paste ai text to the chat window
	if(blob.perform && !blob.perform.human && !blob.perform.audio) {
		textToChatWindow(blob.perform.text,false)
	}

	// surface status (model loading progress, thinking, speaking, ready) in the in-place indicator
	if(blob.status) {
		setStatus(blob.status.text, blob.status.color === 'ready')
	}
}

export const chat_system = {
	id:"chat-handler",
	uuid:"chat-handler",
	resolve
}

