
let rcounter = 1000
let typing = 0

let microphone = false
let llm_local = true
let bargein = true
let autosubmit = true
let showagent = true

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
// deal with user hitting submit
//

PuppetControlSubmit.onclick = () => {
	const text = PuppetChatInputTextArea.value.trim()
	PuppetChatInputTextArea.value = ''
	typing = 0
	textToChatWindow(text,true)
	sys({
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
	sys({config:{microphone}})
}

PuppetControlLocal.onclick = (e) => {
	llm_local = PuppetControlLocal.classList.toggle('active') ? true : false
	textToChatWindow(`Setting reasoning to ${llm_local ? 'local' : 'remote'}`,false)
	sys({config:{llm_local}})
}

PuppetControlBarge.onclick = (e) => {
	bargein = PuppetControlBarge.classList.toggle('active') ? true : false
	textToChatWindow(`Setting bargein to ${bargein ? 'on' : 'off'}`,false)
	sys({config:{bargein}})
}

PuppetControlAuto.onclick = (e) => {
	autosubmit = PuppetControlAuto.classList.toggle('active') ? true : false
	textToChatWindow(`Setting autosubmit to ${autosubmit ? 'on' : 'off'}`,false)
	sys({config:{autosubmit}})
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

	// print any status messages
	if(blob.status) {
		textToChatWindow(blob.status.text,false)
	}
}

export const chat_system = {
	uuid:"chat-handler",
	resolve
}

