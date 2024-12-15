//
// blink both eyes at a frequency and velocity - @todo this could be improved
//

const clamp = (num, a, b) => Math.max(Math.min(num, Math.max(a, b)), Math.min(a, b));

export function blink(volume,time) {
	if(!volume || !volume.targets) return
	const v = clamp(Math.sin(time/900)*800-800+1,0,1)
	volume.targets.eyeBlinkLeft = v
	volume.targets.eyeBlinkRight = v
}

