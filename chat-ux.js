
import sys from 'https://cdn.jsdelivr.net/npm/orbital-sys@latest/src/sys.js'

let llm_local = true
let rcounter = 1000
let typing = 0

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
    e.target.classList.toggle('active');
	if (e.target.classList.contains('active')) {
		PuppetMicrophonePanel.style.display = 'block';
	} else {
		PuppetMicrophonePanel.style.display = 'none';
	}
}

PuppetControlLocal.onclick = (e) => {
    const active = e.target.classList.toggle('active');
	llm_local = active ? true : false
	sys({human:{llm_local}})
	textToChatWindow('Settings: setting reasoning to',llm_local ? 'local' : 'remote',false)
}

PuppetControlAgent.onclick = (e) => {
    const active = e.target.classList.toggle('active');
    document.querySelectorAll('.PuppetMainRight').forEach(elem=>{
        elem.style.display = active  ? 'block' : 'none'
    })
}

PuppetControlBarge.onclick = (e) => {
    e.target.classList.toggle('active');
	// - update!!! @todo
}

PuppetControlAuto.onclick = (e) => {
    e.target.classList.toggle('active');
	// - update!!! @todo
}

//
// register a chat observer - handles a few events
//

function resolve(blob) {

	// ignore
	if(!blob || blob.time || blob.tick) return

	// block spoken human utterances if user is typing
	if(blob.human && blob.human.spoken && typing) {
		textToChatWindow(`Blocking spoken utterance while typing (${blob.human.text})`,true)
		return { force_abort_sys: true }
	}

	// paste spoken human utterances to chat
	if(blob.human && blob.human.spoken && !typing) {
		if(blob.human.final) {
			PuppetChatInputTextArea.value = ''
			textToChatWindow(blob.human.text,true)
		} else {
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

