
const isServer = typeof window === 'undefined'

export class LLMSocket {

	socket = null
	isOpen = false
	messageQueue = []
	callback = null
	url = null
	terms = []

	async open(url) {

		if(isServer || typeof WebSocket === 'undefined') {
			this.WebSocket = await import('ws')
		} else {
			this.WebSocket = WebSocket
		}

		if(this.socket) return

		try {
			this.socket = new this.WebSocket(url)
		} catch(err) {
			this.error(error)
			return
		}

		this.socket.addEventListener('open', () => {
			this.isOpen = true
			this.flushQueue()
		})

		this.socket.addEventListener('close', () => {
			this.close()
		})

		this.socket.addEventListener('message', event => {
			this.receive(event)
		})

		this.socket.addEventListener('error', error => {
			this.error(error)
		})
	}

	flushQueue() {
		while (this.messageQueue.length > 0) {
			const datagram = this.messageQueue.shift()
			this.socket.send(JSON.stringify(datagram))
		}
	}

	close() {
		if (this.socket) {
			this.socket.close()
		}
		this.socket = null
		this.isOpen = false
	}

	error(err) {
		console.error('puppet socket error',err)
	}

	send(datagram) {
		this.callback = datagram.callback
		this.url = datagram.url
		datagram = { ... datagram }
		delete datagram.callback
		delete datagram.url
		if (this.isOpen) {
			try {
				this.socket.send(JSON.stringify(datagram))
			} catch(err) {
				this.error(err)
			}
		} else {
			this.messageQueue.push(datagram)
			this.open(this.url)
		}
	}

	buffer = []
	busy = 0

	receive(event=null) {

		if(event) {
			//console.log('puppet socket - push',event,this.buffer.length)
			this.buffer.push(event)
		}

		if(!this.buffer.length) {
			return
		}

		if(this.busy) {
			//console.warn('puppet socket - busy',event,this.busy)
			return
		}

		event = this.buffer.shift()
		//console.log('puppet socket - pull',event)

		let term = null
		try {
			const response = JSON.parse(event.data.toString())
			if(!response || response.error || !response.data) {
				console.error('puppet socket response error - discarding',response)
				return this.receive()
			}
			term = response.data.token
		} catch(err) {
			console.error('puppet socket parsing error - discarding',err)
			return this.receive()
		}

		if(!term || !term.length) return this.receive()

		if(term !== '<END>') {
			this.terms.push(term)
			if(term=='.' && this.terms.length > 2 && this.terms.at(-2) != ' ' && !isNaN(this.terms.at(-2)) && this.terms.at(-3) != '.') {
				// detect saying ['499','.','99'] and avoid segmenting here
				// console.log("puppet socket - detected a number",this.terms.at(-3),this.terms.at(-2), this.terms.at(-1) )
				return this.receive()
			}
			if(!term.includes('.') && !term.includes(',') && !term.includes('?')) return this.receive()
		}

		const str = this.terms.join('')
		this.terms = []
		if(!str.length) return this.receive()
		//console.log('socket sending',str)
		if(this.callback) {
			this.busy++
			this.callback(str).then(()=>{
				this.busy--
				this.receive()
			}).catch(err => {
				this.busy--
				this.receive()
			})
		}
	}
}






