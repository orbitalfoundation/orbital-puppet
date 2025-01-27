
let rcounter = 1000
let typing = 0

let microphone = true
let llm_local = true
let bargein = true
let autosubmit = true
let showagent = true

//
// paint text
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
// deal with user hitting 'submit' button
//

PuppetControlSubmit.onclick = () => {
	// get text if any
	const text = PuppetChatInputTextArea.value.trim()
	// clear input
	PuppetChatInputTextArea.value = ''
	// clear typing check
	typing = 0
	// print local text if any
	textToChatWindow(text,true)
	// publish to other listeners outside of this scope - empty text is treated as a barge in
	sys({
		human:{
			text,
			confidence:1,
			spoken:false,
			final:true,
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
	// get user input
	const text = PuppetChatInputTextArea.value.trim()
	// in general disable speaking from overriding text input - @todo this is not being set in stt
	typing = text && text.length ? true : false
	// ignore incomplete input
	if (event.key !== 'Enter' || event.shiftKey || event.altKey) return
	// discard this event only so that it does not stuff a cr into the output
	event.preventDefault()
	// note that empty text can be sent (forces a barge in that stops the bot)
	PuppetControlSubmit.onclick()
}

PuppetControlMicrophone.onclick = (e) => {
	microphone = PuppetControlMicrophone.classList.toggle('active') ? true : false
	PuppetMicrophonePanel.style.display = microphone ? 'block' : 'none'
	sys({stt:{microphone}})
	textToChatWindow(`Setting microphone to ${microphone ? 'on' : 'off'}`,false)
}

PuppetControlLocal.onclick = (e) => {
	llm_local = PuppetControlLocal.classList.toggle('active') ? true : false
	sys({human:{llm_local}})
	textToChatWindow(`Setting reasoning to ${llm_local ? 'local' : 'remote'}`,false)
}

PuppetControlBarge.onclick = (e) => {
	bargein = PuppetControlBarge.classList.toggle('active') ? true : false
	sys({stt:{bargein}})
	textToChatWindow(`Setting bargein to ${bargein ? 'on' : 'off'}`,false)
}

PuppetControlAuto.onclick = (e) => {
	autosubmit = PuppetControlAuto.classList.toggle('active') ? true : false
	sys({stt:{autosubmit}})
	textToChatWindow(`Setting autosubmit to ${autosubmit ? 'on' : 'off'}`,false)
}

PuppetControlAgent.onclick = (e) => {
	showagent = PuppetControlAgent.classList.toggle('active');
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

	// intercept spoken traffic
	if(blob.human && blob.human.spoken) {
		// by convention nobody wants typed text to be erased by spoken text
		if(typing) {
			textToChatWindow(`Blocking spoken utterance while typing (${blob.human.text})`,true)
			return { force_abort_sys: true }
		}
		// if barge in is not enabled then don't really allow any spoken text to get much further
		if(!bargein) {
			console.log("chat - blocking bargein")
			PuppetChatInputTextArea.value = blob.human.text
			return { force_abort_sys: true }
		}
		// it is nice to be able to disable auto submit of final spoken utterances especially in noisy spaces
		if(blob.human.final && !autosubmit) {
			console.log("chat - blocking autosubmit")
			PuppetChatInputTextArea.value = blob.human.text
			return { force_abort_sys: true }
		}

		// for now let's treat 'stop' or 'stop please' or 'please stop' as just barge in not final
		if(blob.human.text.startsWith('stop')) {
			blob.human.final = false
		}

		// generally speaking final spoken text is allowed onwards; and also append it to chat history
		if(blob.human.final) {
			PuppetChatInputTextArea.value = ''
			textToChatWindow(blob.human.text,true)
		}
		// non final spoken utterances can be pasted to the input window - but don't set the 'typing' count
		else {
			PuppetChatInputTextArea.value = blob.human.text
		}
	}

	// paste ai text to the chat window
	if(blob.breath) {
		textToChatWindow(blob.breath.breath,false)
	}

	// print status messages
	if(blob.status) {
		textToChatWindow(blob.status.text,false)
	}
}

export const chat_system = {
	uuid:"chat-handler",
	resolve
}

