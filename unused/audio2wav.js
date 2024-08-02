// https://www.npmjs.com/package/audio-buffer

export function audioBufferToWav(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const interleaved = new Float32Array(length * numberOfChannels);
  const channels = [];

  for (let channel = 0; channel < numberOfChannels; channel++) {
    channels.push(audioBuffer.getChannelData(channel));
  }

  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      interleaved[i * numberOfChannels + channel] = channels[channel][i];
    }
  }

  const wavBuffer = encodeWav(interleaved, numberOfChannels, sampleRate);
  const base64Chunks = [];

  for (let i = 0; i < wavBuffer.length; i += 1024) {
    const chunk = wavBuffer.slice(i, i + 1024);
    const base64Chunk = btoa(String.fromCharCode.apply(null, chunk));
    base64Chunks.push(base64Chunk);
  }

  return base64Chunks.join('');
}

function encodeWav(samples, numChannels, sampleRate) {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * bytesPerSample, true);

  floatTo16BitPCM(view, 44, samples);

  return new Uint8Array(buffer);
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[offset] = Math.floor(s < 0 ? s * 0x8000 : s * 0x7FFF);
    output[offset + 1] = Math.floor(s < 0 ? s * 0x8000 : s * 0x7FFF) >> 8;
  }
}