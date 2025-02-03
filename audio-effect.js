
let desired = true
let allowed = false
let stream
let audioContext
let analyser
let source
let bufferLength
let dataArray

let canvas
let canvasCtx

function draw() {
  if(!canvas || !canvasCtx) return
  requestAnimationFrame(draw);
  if(desired && allowed) {
    analyser.getByteFrequencyData(dataArray);
  } else {
    for (let i = 0; i < bufferLength; i++) {
      dataArray[i] = dataArray[i] / 2
    }
  }
  canvasCtx.fillStyle = '#111';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
  const barWidth = (canvas.width / bufferLength);
  let barHeight;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    barHeight = dataArray[i];
    canvasCtx.fillStyle = `rgb(50,${barHeight + 100},${barHeight + 100})`;
    let y = canvas.height/2
    canvasCtx.fillRect(x, y, barWidth, barHeight / 2 );
    canvasCtx.fillRect(x, y, barWidth, -barHeight / 2 );
    x += barWidth + 1;
  }
}

async function configure(id) {

  if(!desired || !allowed) {
    if(audioContext) {
      audioContext.suspend()
    }
    return
  }

  if(audioContext) {
    audioContext.resume()
    return
  }

  stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  audioContext = new (window.AudioContext || window.webkitAudioContext)()
  analyser = audioContext.createAnalyser()
  source = audioContext.createMediaStreamSource(stream)
  source.connect(analyser)
  analyser.fftSize = 1024
  bufferLength = analyser.frequencyBinCount
  dataArray = new Uint8Array(bufferLength)

  canvas = document.getElementById(id)
  if(canvas) canvasCtx = canvas.getContext('2d')
  draw()

}

function resolve(blob) {

  if(!blob || blob.tick || blob.time) return

  // the effect should be off while locally noisy
  if(blob.config && blob.config.hasOwnProperty('noisy')) {
    desired = blob.config.noisy ? false : true
    configure(this._canvas)
  }

  // the effect should be off unless asked to be on
  if(blob.config && blob.config.hasOwnProperty('microphone')) {
    allowed = blob.config.microphone ? true : false
    configure(this._canvas)
  }

}

export const audio_effect_system = {
  uuid:"audio_effect_system",
  resolve,
  _canvas:'PuppetMicrophonePanel'
}

