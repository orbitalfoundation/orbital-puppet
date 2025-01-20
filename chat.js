
import sys from 'https://cdn.jsdelivr.net/npm/orbital-sys@latest/src/sys.js'

let rcounter = 1000
let typing = 0

//
// register a system that watches for a few events and paints them to the html display as feedback
//

function resolve(blob) {
	if(!blob || blob.time || blob.tick) return
	if(blob.human && blob.human.text && blob.human.spoken && blob.human.text.length && !typing) {
		if(blob.human.final) {
			sendToChatHistory(blob.human.text,false)
		} else {
			PuppetChatInputTextArea.value = blob.human.text
		}
	}
	if(blob.breath) {
		sendToChatHistory(blob.breath.breath,false)
	}
}

sys({
	uuid:"companion-intelligence-chat-handler",
	resolve
})

//
// send a message to the llm
//

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

function fixHeight() {

    // hack - having trouble getting the css to do this magically
    // max-height: calc(100vh - 240px);

    const h0 = PuppetContainer.offsetHeight - 10
    const w0 = PuppetContainer.offsetWidth
    const h1 = PuppetAbout.offsetHeight
    const h2 = PuppetChatHistory.offsetHeight
    const h3 = w0 < 800 ? volume001.offsetHeight : 0
    const h4 = PuppetBottom.offsetHeight
    const h5 = PuppetMicrophonePanel.offsetHeight
    let height = h0 - h1 - h3 - h4 - h5
    console.log("width",w0,"container",h0,"header",h1,"chat before",h2,"volume",h3,"bottom",h4,"mike",h5,"computed",height)
    PuppetChatHistory.style.maxHeight = `${height}px`
    PuppetChatHistory.style.height = `${height}px`

}

function sendToChatHistory(message,isUser=true) {
    const newMessage = document.createElement('div');
    newMessage.className = isUser ? 'PuppetChatUser' : 'PuppetChatAgent';
    newMessage.textContent = message;
    PuppetChatHistory.appendChild(newMessage);
    PuppetChatHistory.scrollTop = PuppetChatHistory.scrollHeight;
    PuppetChatInputTextArea.value = '';
    fixHeight()
}

function submitMessage() {
    const message = PuppetChatInputTextArea.value.trim();
    if (message && message.length) {
    	sendToChatHistory(message,true)
        sendToPuppet(message)
    }
}

PuppetChatInputTextArea.onkeydown = (event) => {
	typing = PuppetChatInputTextArea.value.length ? true : false
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
		typing = 0
        submitMessage();
		event.preventDefault()
    }
}

PuppetControlMicrophone.onclick = (e) => {
    e.target.classList.toggle('active');
	if (e.target.classList.contains('active')) {
		PuppetMicrophonePanel.style.display = 'block';
	} else {
		PuppetMicrophonePanel.style.display = 'none';
	}
    fixHeight()
}

PuppetControlAgent.onclick = (e) => {
    const active = e.target.classList.toggle('active');
    document.querySelectorAll('.PuppetMainRight').forEach(elem=>{
        elem.style.display = active  ? 'block' : 'none'
    })
    fixHeight()
}

PuppetControlBarge.onclick = (e) => {
    e.target.classList.toggle('active');
	// - update!!! @todo
}

PuppetControlAuto.onclick = (e) => {
    e.target.classList.toggle('active');
	// - update!!! @todo
}

PuppetControlSubmit.onclick = submitMessage

