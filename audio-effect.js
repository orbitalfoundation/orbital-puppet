const canvas = document.getElementById('PuppetMicrophonePanel');
const canvasCtx = canvas.getContext('2d');

canvas.width = window.innerWidth * 0.8;
canvas.height = 300;

const startAudio = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    visualizeAudio(stream);
  } catch (err) {
    console.error('Error accessing microphone:', err);
  }
}

setTimeout(startAudio,1000)

function visualizeAudio(stream) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);

  source.connect(analyser);
  analyser.fftSize = 1024;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    requestAnimationFrame(draw);

    analyser.getByteFrequencyData(dataArray);

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

  draw();
}
