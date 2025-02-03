///
/// this is a test blob of code - it listens to the raw real time audio
/// it generates viseme information
/// it also paints a display of the energy bars based on an fft
///


// this is from character creator under an MIT license
// see https://github.com/webaverse-studios/CharacterCreator/blob/stable/src/library/lipsync.js

const BoundingFrequencyMasc = [0, 400, 560, 2400, 4800]
const BoundingFrequencyFem = [0, 500, 700, 3000, 6000]
const IndicesFrequencyFemale= []
const IndicesFrequencyMale = []
const FFT_SIZE = 1024
const samplingFrequency = 44100

for (let m = 0; m < BoundingFrequencyMasc.length; m++) {
	IndicesFrequencyMale[m] = Math.round(((2 * FFT_SIZE) / samplingFrequency) * BoundingFrequencyMasc[m])
}

for (let m = 0; m < BoundingFrequencyFem.length; m++) {
	IndicesFrequencyFemale[m] = Math.round(((2 * FFT_SIZE) / samplingFrequency) * BoundingFrequencyFem[m])
}

function createAudioMeter(audioContext) {
	const processor = audioContext.createScriptProcessor(512)
	processor.onaudioprocess = (event) => {
		const buf = event.inputBuffer.getChannelData(0)
		const bufLength = buf.length
		let sum = 0
		let x
		// eslint-disable-next-line no-plusplus
		for (let i = 0; i < bufLength; i++) {
			x = buf[i]
			if (Math.abs(x) >= processor.clipLevel) {
				processor.clipping = true
				processor.lastClip = window.performance.now()
			}
			sum += x * x
		}
		const rms = Math.sqrt(sum / bufLength)
		processor.volume = Math.max(rms, processor.volume * processor.averaging)
	}
	processor.clipping = false
	processor.lastClip = 0
	processor.volume = 0
	processor.clipLevel = 0.98
	processor.averaging = 0.95
	processor.clipLag = 750
	processor.connect(audioContext.destination)
	processor.checkClipping = () => {
		if (!processor.clipping) {
			return false
		}
		if (processor.lastClip + processor.clipLag < window.performance.now()) {
			processor.clipping = false
		}
		return processor.clipping
	}
	processor.shutdown = () => {
		processor.disconnect()
		processor.onaudioprocess = null
	}
	return processor
}


export class PuppetAudio2Viseme {

	startFile(file) {

		if(!this.audioContext) {
			this.audioContext = new AudioContext()
		}

		if (this.mediaStreamSource) {
			this.mediaStreamSource.stop()
		}

		if(!this.analyzer) {
			this.analyzer = this.audioContext.createAnalyser()
			this.analyzer.smoothingTimeConstant = 0.5
			this.analyzer.fftSize = FFT_SIZE
		}

		this.audioContext.decodeAudioData(file).then((buffer) => {
			this.mediaStreamSource = this.audioContext.createBufferSource()
			this.mediaStreamSource.buffer = buffer
			this.meter = LipSync.createAudioMeter(this.audioContext)
			this.mediaStreamSource.connect(this.meter)
			this.mediaStreamSource.connect(this.audioContext.destination)
			this.mediaStreamSource.start()

			// connect the output of mediaStreamSource to the input of analyzer
			this.mediaStreamSource.connect(this.analyzer)
		})

	}

	startMicrophone() {

		if (!navigator.mediaDevices) {
			console.error("puppet: unable to start audio microphone")
			return
		}

		if(!this.audioContext) {
			this.audioContext = new AudioContext()
		}

		if (this.mediaStreamSource) {
			this.mediaStreamSource.stop()
		}

		if(!this.analyzer) {
			this.analyzer = this.audioContext.createAnalyser()
			this.analyzer.smoothingTimeConstant = 0.5
			this.analyzer.fftSize = FFT_SIZE
		}

		navigator.mediaDevices.getUserMedia({"audio": true}).then((stream) => {
			this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream)
			this.meter = createAudioMeter(this.audioContext)
			this.mediaStreamSource.connect(this.meter)
			this.mediaStreamSource.connect(this.analyzer)
		}).catch((err) => {
			console.error("puppet: cannot access microphone",err)
			return
		})

//		this.draw()
	}

	draw() {

		const WIDTH = 1024
		const HEIGHT = 400
		const OSCILLOSCOPE = false
		const FREQUENCYBAR = true

		if(!this.canvas) {
			// make a drawing target also
			const canvas = this.canvas = document.createElement("canvas")
			canvas.width = WIDTH
			canvas.height = HEIGHT
			canvas.style.cssText = `position:absolute;top:0;left:0;z-index:100;border:3px solid red;width:${WIDTH}px;height:${HEIGHT}px;background:blue`
			document.body.append(canvas)
			this.draw = this.draw.bind(this)
			console.log("puppet: made canvas")

			const context = this.canvas.getContext("2d");

			var centerX = canvas.width / 2;
			var centerY = canvas.height / 2;
			var radius = 70;

			context.beginPath();
			context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
			context.fillStyle = 'purple';
			context.fill();
			context.lineWidth = 5;
			context.strokeStyle = '#003300';
			context.stroke();
		}

		// clear display
		const context = this.canvas.getContext("2d");
		context.fillStyle = `rgb(0 0 0)`
		context.fillRect(0, 0, WIDTH, HEIGHT)
		context.lineWidth = 2

		// capture some uints
		const bufferLength = this.analyzer.frequencyBinCount;
		const spectrum = new Uint8Array(bufferLength)

		if(OSCILLOSCOPE) {
			this.analyzer.getByteTimeDomainData(spectrum)
			context.strokeStyle = "rgb(0 0 0)"
			context.beginPath()
		}
		else if(FREQUENCYBAR) {
			// ideally the fftSize should be smaller...
			this.analyzer.getByteFrequencyData(spectrum)
		}

		// draw
		let x = 0;

		for (let i = 0; i < bufferLength; i++) {
			if(FREQUENCYBAR) {
				const barWidth = (WIDTH / bufferLength) * 2.5
				const barHeight = spectrum[i] / 2 * 4
				context.fillStyle = `rgb(${barHeight + 100} 50 50)`
				context.fillRect(x,0,barWidth,barHeight)
				x += barWidth + 1;
			} else if( OSCILLOSCOPE) {
				const v = spectrum[i] / 128.0;
				const y = v * (HEIGHT / 2);
				if (i === 0) {
					context.moveTo(x, y);
				} else {
					context.lineTo(x, y);
				}
				x += WIDTH / bufferLength;
			}
		}
		if(OSCILLOSCOPE) {
			context.lineTo(WIDTH, HEIGHT / 2);
			context.stroke();
		}

		setTimeout( this.draw.bind(this), 200 )
//		requestAnimationFrame(this.draw)
	}

	destroy() {
		if(this.meter) {
			this.meter.shutdown()
			this.meter = null
		}
		if(this.mediaStreamSource) {
			this.mediaStreamSource.disconnect()
		}
		if(this.audioContext) {
			this.audioContext.close().catch(() => {}) || Promise.resolve()
		}
	}

	_update_internal() {      

		function getSensitivityMap(spectrum) {
			const sensitivity_threshold = 0.5
			const stPSD = new Float32Array(spectrum.length)
			for (let i = 0; i < spectrum.length; i++) {
				stPSD[i] = sensitivity_threshold + (spectrum[i] + 20) / 140
			}
			return stPSD
		}

		if(!this.analyzer) {
			return { oh:0, ee: 0, ah: 0 }
		}

		const spectrum = new Float32Array(this.analyzer.frequencyBinCount)

		// Populate frequency data for computing frequency intensities
		this.analyzer.getFloatFrequencyData(spectrum) // getByteTimeDomainData gets volumes over the sample time

		// Populate time domain for calculating RMS
		// this.analyzer.getFloatTimeDomainData(spectrum)
		// RMS (root mean square) is a better approximation of current input level than peak (just sampling this frame)
		// spectrumRMS = getRMS(spectrum);

		const sensitivityPerPole = getSensitivityMap(spectrum)

		// Lower and higher voices have different frequency domains, so we'll separate and max them
		const EnergyBinMasc = new Float32Array(BoundingFrequencyMasc.length)
		const EnergyBinFem = new Float32Array(BoundingFrequencyFem.length)

		// Masc energy bins (groups of frequency-depending energy)
		for (let m = 0; m < BoundingFrequencyMasc.length - 1; m++) {
			for (let j = IndicesFrequencyMale[m]; j <= IndicesFrequencyMale[m + 1]; j++)
				if (sensitivityPerPole[j] > 0) EnergyBinMasc[m] += sensitivityPerPole[j]
			EnergyBinMasc[m] /= IndicesFrequencyMale[m + 1] - IndicesFrequencyMale[m]
		}

		// Fem energy bin
		for (let m = 0; m < BoundingFrequencyFem.length - 1; m++) {
			for (let j = IndicesFrequencyMale[m]; j <= IndicesFrequencyMale[m + 1]; j++)
				if (sensitivityPerPole[j] > 0) EnergyBinFem[m] += sensitivityPerPole[j]
			EnergyBinMasc[m] /= IndicesFrequencyMale[m + 1] - IndicesFrequencyMale[m]
			EnergyBinFem[m] = EnergyBinFem[m] / (IndicesFrequencyFemale[m + 1] - IndicesFrequencyFemale[m])
		}
		const oh =
			Math.max(EnergyBinFem[1], EnergyBinMasc[1]) > 0.2
				? 1 - 2 * Math.max(EnergyBinMasc[2], EnergyBinFem[2])
				: (1 - 2 * Math.max(EnergyBinMasc[2], EnergyBinFem[2])) * 5 * Math.max(EnergyBinMasc[1], EnergyBinFem[1])

		const ah = 3 * Math.max(EnergyBinMasc[3], EnergyBinFem[3])
		const ee = 0.8 * (Math.max(EnergyBinMasc[1], EnergyBinFem[1]) - Math.max(EnergyBinMasc[3], EnergyBinFem[3]))
		return { oh, ee, ah }

		// what this is returning
		// seems to mix the ee and the oh up

		// what i am actually seeing:

		// oh -> lights up just the left; leaving the right empty
		// ah -> lights up the lower frequencies, where the left is lit and the right is not; kind of like a triangle really
		// ee -> lights up more to the right
		// ss -> lights up more to the right ; way more than the others

	}

	visemes = { oh:0.0, ee:0.0, ah:0.0 }
	targets = { oh:0.0, ee:0.0, ah:0.0 }

	update(deltaTime,face) {
		if (!this.meter) return
		this.targets = this._update_internal()
		this.visemes.oh += (this.targets.oh - this.visemes.oh)/2
		this.visemes.ee += (this.targets.ee - this.visemes.ee)/2
		this.visemes.ah += (this.targets.ah - this.visemes.ah)/2
		face._morph_target_set("viseme_O",this.visemes.oh)
		face._morph_target_set("viseme_E",this.visemes.ee)
		face._morph_target_set("viseme_aa",this.visemes.ah)
	}

}

///
/// unused unwritten - there are fancier ways to convert audio to visemes - study more later @todo
///

function visemes_from_audio() {
	// this approach is implemented elsewhere
	// https://commons.emich.edu/cgi/viewcontent.cgi?article=1095&context=honors
	// https://arxiv.org/pdf/2301.06059.pdf
	// https://people.umass.edu/~yangzhou/visemenet/visemenet.pdf
	// https://github.com/Rudrabha/LipGAN
	// we could do audio analysis such as with https://meyda.js.org/audio-features
}

