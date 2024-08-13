
// this is a sliver of the rather large talking heads source code - the part that manages audio 

/**
* @class Talking Head Audio
* @author Mika Suominen
* 
* Audio support
* 
*/
export class Audio {

	/**
	* @constructor
	*/
	constructor() {

		this.animSlowdownRate = 1

		// Audio context and playlist
		this.Ctx = new AudioContext();
		//this.Source = this.Ctx.createBufferSource();
		this.BackgroundSource = this.Ctx.createBufferSource();
		this.BackgroundGainNode = this.Ctx.createGain();
		this.GainNode = this.Ctx.createGain();
		this.ReverbNode = this.Ctx.createConvolver();
		this.setReverb(null); // Set dry impulse as default
		this.BackgroundGainNode.connect(this.ReverbNode);
		this.GainNode.connect(this.ReverbNode);
		this.ReverbNode.connect(this.Ctx.destination);
		this.Playlist = [];

		// Create a lookup table for base64 decoding
		const b64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
		this.b64Lookup = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
		for (let i = 0; i < b64Chars.length; i++) this.b64Lookup[b64Chars.charCodeAt(i)] = i;

	}

	/**
	* Convert a Base64 MP3 chunk to ArrayBuffer.
	* @param {string} chunk Base64 encoded chunk
	* @return {ArrayBuffer} ArrayBuffer
	*/
	b64ToArrayBuffer(chunk) {

		// Calculate the needed total buffer length
		let bufLen = 3 * chunk.length / 4;
		if (chunk[chunk.length - 1] === '=') {
			bufLen--;
			if (chunk[chunk.length - 2] === '=') {
				bufLen--;
			}
		}

		// Create the ArrayBuffer
		const arrBuf = new ArrayBuffer(bufLen);
		const arr = new Uint8Array(arrBuf);
		let i, p = 0, c1, c2, c3, c4;

		// Populate the buffer
		for (i = 0; i < chunk.length; i += 4) {
			c1 = this.b64Lookup[chunk.charCodeAt(i)];
			c2 = this.b64Lookup[chunk.charCodeAt(i+1)];
			c3 = this.b64Lookup[chunk.charCodeAt(i+2)];
			c4 = this.b64Lookup[chunk.charCodeAt(i+3)];
			arr[p++] = (c1 << 2) | (c2 >> 4);
			arr[p++] = ((c2 & 15) << 4) | (c3 >> 2);
			arr[p++] = ((c3 & 3) << 6) | (c4 & 63);
		}

		return arrBuf;
	}

	/**
	* Concatenate an array of ArrayBuffers.
	* @param {ArrayBuffer[]} bufs Array of ArrayBuffers
	* @return {ArrayBuffer} Concatenated ArrayBuffer
	*/
	concatArrayBuffers(bufs) {
		let len = 0;
		for( let i=0; i<bufs.length; i++ ) {
			len += bufs[i].byteLength;
		}
		let buf = new ArrayBuffer(len);
		let arr = new Uint8Array(buf);
		let p = 0;
		for( let i=0; i<bufs.length; i++ ) {
			arr.set( new Uint8Array(bufs[i]), p);
			p += bufs[i].byteLength;
		}
		return buf;
	}


	/**
	* Convert PCM buffer to AudioBuffer.
	* NOTE: Only signed 16bit little endian supported.
	* @param {ArrayBuffer} buf PCM buffer
	* @return {AudioBuffer} AudioBuffer
	*/
	pcmToAudioBuffer(buf) {
		const arr = new Int16Array(buf);
		const floats = new Float32Array(arr.length);
		for( let i=0; i<arr.length; i++ ) {
			floats[i] = (arr[i] >= 0x8000) ? -(0x10000 - arr[i]) / 0x8000 : arr[i] / 0x7FFF;
		}
		const audio = this.Ctx.createBuffer(1, floats.length, this.opt.pcmSampleRate );
		audio.copyToChannel( floats, 0 , 0 );
		return audio;
	}

	/**
	* Play background audio.
	* @param {string} url URL for the audio, stop if null.
	*/
	async playBackgroundAudio( url ) {

		// Fetch audio
		let response = await fetch(url);
		let arraybuffer = await response.arrayBuffer();

		// Play audio in a loop
		this.stopBackgroundAudio()
		this.BackgroundSource = this.Ctx.createBufferSource();
		this.BackgroundSource.loop = true;
		this.BackgroundSource.buffer = await this.Ctx.decodeAudioData(arraybuffer);
		this.BackgroundSource.playbackRate.value = 1 / this.animSlowdownRate;
		this.BackgroundSource.connect(this.BackgroundGainNode);
		this.BackgroundSource.start(0);

	}

	/**
	* Stop background audio.
	*/
	stopBackgroundAudio() {
		try { this.BackgroundSource.stop(); } catch(error) {}
		this.BackgroundSource.disconnect();
	}

	/**
	* Setup the convolver node based on an impulse.
	* @param {string} [url=null] URL for the impulse, dry impulse if null
	*/
	async setReverb( url=null ) {
		if ( url ) {
			// load impulse response from file
			let response = await fetch(url);
			let arraybuffer = await response.arrayBuffer();
			this.ReverbNode.buffer = await this.Ctx.decodeAudioData(arraybuffer);
		} else {
			// dry impulse
			const samplerate = this.Ctx.sampleRate;
			const impulse = this.Ctx.createBuffer(2, samplerate, samplerate);
			impulse.getChannelData(0)[0] = 1;
			impulse.getChannelData(1)[0] = 1;
			this.ReverbNode.buffer = impulse;
		}
	}

	/**
	* Set audio gain.
	* @param {number} Gain, if null do not change
	* @param {number} background Gain for background audio, if null do not change
	*/
	setMixerGain( value, background ) {
		if ( value !== null ) {
			this.GainNode.gain.value = value;
		}
		if ( background !== null ) {
			this.BackgroundGainNode.gain.value = background;
		}
	}

	callback = null
	latched = false

	//
	// @summary Start raw audio - catch errors yourself
	// @param {audio} raw audio buffer to play audibly
	// @param {delay} 
	//

	async play(audio,delay=100,_callback=null) {

		if(this.latched) {
			console.error('puppet audio - was still playing something')
			return
		}
		this.latched = true

		this.callback = _callback

		// If Web Audio API is suspended, try to resume it
		if ( this.Ctx.state === "suspended" ) {
			const resume = this.Ctx.resume();
			const timeout = new Promise((_r, rej) => setTimeout(() => rej("p2"), 1000));
			await Promise.race([resume, timeout]);
		}

		try {

			if(typeof audio === 'AudioBuffer') {
				// use as is
			} else if ( Array.isArray(audio) ) {
				// Convert from PCM samples
				let buf = this.concatArrayBuffers(audio);
				audio = this.pcmToAudioBuffer(buf);
			} else if(typeof audio === 'string') {
				const buf = this.b64ToArrayBuffer(audio)
				audio = await this.Ctx.decodeAudioData(buf)
			} else {
				// unsure what to do in this case
			}

			// the source has to be created anew
			this.Source = this.Ctx.createBufferSource();
			this.Source.buffer = audio;
			this.Source.playbackRate.value = 1 / this.animSlowdownRate;
			this.Source.connect(this.GainNode);
			this.Source.addEventListener('ended', () => {
				this.latched = false
				if(this.Source) {
					this.Source.disconnect()
					this.Source = null
				}
				if(this.callback) this.callback();
			}, { once: true });

			// Play
			this.Source.start(delay/1000);
		} catch(err) {
			console.error("puppet audio playback failed!",err,audio)
			if(this.Source) {
				this.Source.disconnect()
				this.Source.stop()
				this.Source = null
			}
			this.latched = false
			if(this.callback) this.callback()
		}
	}

	stop() {
		this.callback = null
		this.latched = false
		if(this.Source) {
			this.Source.disconnect()
			this.Source.stop()
			this.Source = null
		}
		// no point in calling callback()
	}
}
