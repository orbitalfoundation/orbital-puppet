
// @todo this should run in nodejs also

export class PuppetSocket {

	socket = null
	isOpen = false
	messageQueue = []
	callback = null
	url = null
	terms = []

	open(url) {

		if(this.socket) return

		try {
			this.socket = new WebSocket(url)
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
	busy = false

	async receive(event) {

		// push to a buffer
		this.buffer.push(event)

		// if buffer is busy then return - hopefully buffer is still being exhausted below
		if(this.buffer.length>1) {
			console.warn('puppet socket - noticed buffer busy?',this.busy)
			return
		}
		this.busy = true

		// exhaust buffer
		while(this.buffer.length) {

			const event = this.buffer.shift()

			// from the server we get back stuff like this:
			//
			// isTrusted
			// bubbles
			// cancelable
			// data => actual meat
			// data.session_id
			// type 'message'

			try {

				const response = JSON.parse(event.data.toString()) // @todo is this necessary?

				// response.session_id <- could be set to conversation id

				if(!response || response.error || !response.data) {
					console.error('puppet socket response error - discarding',response)
					return
				}

				const term = response.data.token

				if(!term || !term.length) return

				if(term !== '<END>') {
					this.terms.push(term)
					if(!term.includes('.') && !term.includes(',') && !term.includes('?')) return
				}

				const str = this.terms.join('')
				this.terms = []
				if(!str.length) return
				if(this.callback) await this.callback(str)

			} catch(err) {
				console.error('puppet socket parsing error - discarding',err)
				return
			}
		}

		this.busy = false
	}

}






