
const STREAMINFO = 0,
		PADDING = 1,
		APPLICATION = 2,
		SEEKTABLE = 3,
		VORBIS_COMMENT = 4,
		CUESHEET = 5,
		PICTURE = 6,
		INVALID = 127,
		STREAMINFO_SIZE = 34;

function createBinaryString (nMask) {
	// nMask must be between -2147483648 and 2147483647
	for (var nFlag = 0, nShifted = nMask, sMask = ""; nFlag < 32;
		 nFlag++, sMask += String(nShifted >>> 31), nShifted <<= 1);
	return sMask;
}

///
/// https://github.com/audiocogs/flac.js/blob/master/src/demuxer.js
///

export function flac_estimate_duration(raw) {

	let length = raw.length
	console.log("flac: raw length is ",length,"rough estimate of duration is ",length/32)

	let cursor = 0

	const read = (amount=1) => {
		let total = 0
		while(amount) {
			total=total<<8
			total|=raw[cursor]
			amount--
			cursor++
		}
		return total
	}

	const flac = [ read(), read(), read(), read() ]
	if(flac[0] != 102 || flac[1] != 76 || flac[2] != 97 || flac[3] != 67) {
		console.error("flac: not a flac")
		return 0
	}

	while(cursor<length) {

		const flags = read(1)
		const last = (flags & 0x80) === 0x80
		const kind = flags & 0x7F
		const size = read(3)

		console.log(last,kind,size)

		if(kind==0) {

			const minBlockSize = read(2)
			const maxBlockSize = read(2)
			const minFrameSize = read(3)
			const maxFrameSize = read(3)
			console.log({minBlockSize,maxBlockSize,minFrameSize,maxFrameSize})

			const bits = read(4) 

			//console.log( createBinaryString(bits) )

			const sampleRate = bits >> (32-20) // i only want 20 bits (bits 0-19)
			const channelsPerFrame = (bits >> (32-23)) & 7 // i only want 3 bits (20,21,22)
			const bitsPerChannel = (bits >> (32-29)) & 63 // i only want 5 bits (24,25,26,27,28)				
			const sampleCountRaw = ( (bits & 15) << 32 | read(4) )
			const sampleCount = sampleCountRaw || (length/2) // try hard to get a sample count even if inaccuate ...
			const duration = sampleCount / sampleRate * 1000 
			const md5hash = read(16)

			console.log({channelsPerFrame,bitsPerChannel,sampleRate,sampleCountRaw,sampleCount,duration})

			return duration
		}

		cursor += size
		break
	}

	return length / 4 // hack estimate time length 
}

