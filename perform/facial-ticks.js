//
// small random facial ticks @todo could be improved to be more random
//

const clamp = (num, a, b) => Math.max(Math.min(num, Math.max(a, b)), Math.min(a, b));

export function facial_ticks(volume,time) {
	if(!volume || !volume.targets) return

	const ticks = [
		'mouthDimpleLeft','mouthDimpleRight', 'mouthLeft', 'mouthPress',
		'mouthStretchLeft', 'mouthStretchRight',
		// 'mouthShrugLower', 'mouthShrugUpper', 'noseSneerLeft', 'noseSneerRight', 'mouthRollLower', 'mouthRollUpper',
		'browDownLeft', 'browDownRight', 'browOuterUpLeft', 'browOuterUpRight',  'browInnerUp',
		'cheekSquintLeft', 'cheekSquintRight'
	]

	// fiddle with the frequency and velocity of the effect
	const v = clamp(Math.sin(time/700)*10-10+1,0,1)

	// nothing to do
	if(!v) {
		volume.tick_current = 0
		return
	}

	// may pick a new tick
	if(!volume.tick_current) {
		volume.tick_current = ticks[ Math.floor( Math.random() * ticks.length ) ]
	}

	// animate tick
	volume.targets[volume.tick_current] = v / 2.0

}
