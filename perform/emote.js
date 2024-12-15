
import { animMoods } from '../talking-heads/anim-moods.js'

//import { animEmojis } from './talking-heads/anim-emojis.js'

///
/// set a facial emotion right now
/// @todo this could be a larger more complex performance system later on rather than a single frame
///

export function	emote(volume,emotion) {
	if(!volume || !volume.targets) return
	//console.log('puppet face - trying to do an emotion',emotion)
	if(!emotion || !emotion.length) return
	const fields = animMoods[emotion.toLowerCase()]
	if(!fields || !fields.baseline) return
	Object.entries(fields.baseline).forEach(([k,v]) => { volume.targets[k] = v })
	// hold face for a while as a test @todo this feels a bit artificial
	volume.relaxation = Math.max( volume.relaxation, performance.now() + 3000 )
}

