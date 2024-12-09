

import { PuppetBody } from './PuppetBody.js'
import { RPMFace2Reallusion } from './RPMFace2Reallusion.js'
import { animMoods } from '../shared/anim-moods.mjs'
import { lipsyncConvert } from '../shared/lipsync-queue.mjs'

const clamp = (num, a, b) => Math.max(Math.min(num, Math.max(a, b)), Math.min(a, b));

const BREAK_DURATION = 100

///
/// @summary puppet face focused rigging support
///

export class PuppetFace extends PuppetBody {

	// a list of bones that have morph targets - these should be on the face/head
	morphable = []

	// an optional helper table of english names to an array of indexes for bone morph targets such as "mouthSmile" : [ 23,32 ] or Mouth_Smile_L and Mouth_Smile_R
	dictionary = {}

	// english named targets to floats ... reflecting the degree of the named morph target we want to apply... in rpm rig notation
	targets = {}

	// mark if targets are 'dirty' or not and need updating; to reduce pressure on the engine
	dirty = {}

	// vrm hint - see blender-puppet-rpm-to-vrm.py which injects rpm target names into vrm rigs
	vrm = null

	// the current animation sequence that is being played; consists of a series of internal time slice effects
	sequence = []

	// an idea (being explored) of overall relaxation so that when sequences are done the entire puppet face can be gently brought to rest
	relaxation = 0

	// head
	head = null

	//
	// @summary associate with a collection of geometry from a configuration
	//

	async load(config) {
		await super.load(config)
		this.node = config.node
		this.vrm = config.vrm
		this.camera = config.camera
		this.gazelimit = config.gazelimit
		this.gazeanim = config.gazeanim
		this.head = config.head
		this.left = this.bones["LeftEye"]
		this.right = this.bones["RightEye"]
		this._morphable_init(this.node,this.vrm)
	}

	//
	// @summary relax all effects immediately
	//

	stop() {
		super.stop()
		this.relaxation = 0
		this.sequence = []
		this.emote('neutral')
	}

	///
	/// @summary start a fresh facial performance overwriting the previous which should be done
	///

	face_start_performance(perf) {

		// an emotion can be specified explicitly
		if(perf.emotion) {
			this.emote(perf.emotion)
		}

		// try treat actions as facial emotions as well - not all actions are emotions however
		if(perf.actions) {
			perf.actions.forEach( (action) => {
				this.emote(action)
			})
		}
		// start audio visual performance
		if(perf.whisper) {
			const o = lipsyncConvert(perf.whisper,"en")
			this.sequence = o.anim || []

			// this is a test idea - i want to orchestrate face relaxation in a graceful way when done a performance
			// set a relaxation time in future based on estimation of when relaxation should start
			// @todo remove this fudge factor from the lipsync-converter or rewrite that converter completely
			const time = performance.now()
			for(const item of this.sequence) {
				item.ts[0] += time + 150
				item.ts[1] += time + 150
				item.ts[2] += time + 150
				this.relaxation = Math.max(this.relaxation,item.ts[1])
			}

			// may gaze at the player when starting an utterance
			console.log('*** npc puppet gaze begin',perf.segment)
			this.gaze(-1,-1,perf.segment < 2 ? 0 : 0.5 )

		}
	}

	///
	/// @summary update facial performance every frame
	///

	update(time,delta) {

		// @todo improve - for now use performance.now() because i am setting fiddly little timer based effects and conceptually i don't have access to outer scope time from this module
		time = performance.now()

		// update body
		super.update(time,delta)

		// blink
		this._blink_update(time,delta)

		// gaze
		this._gaze_update(time,delta)

		// an experimental approach for relaxation after effects - may revise
		if(this.relaxation < time ) {

			// perform small facial ticks while relaxing
			this._facial_ticks_update(time,delta)

			// slightly dampen effects to zero over time
			this._apply_to_face(time,delta,0.9)
		}

		// actively speaking
		else {

			// apply viseme performance over time
			this._visemes_update(time,delta)

			// apply performance to 3js avatar / puppet
			this._apply_to_face(time,delta)

		}

		// vrm has a special update helper - @todo this may not be needed for infinite reality
		if(this.vrm) {
			this.vrm.update(delta/1000)
		}

	}

	///
	/// @summary set a facial emotion right now
	/// @todo this could be a larger more complex performance system later on rather than a single frame
	///

	emote(emotion) {
		//console.log('puppet face - trying to do an emotion',emotion)
		if(!emotion || !emotion.length) return
		const fields = animMoods[emotion.toLowerCase()]
		if(!fields || !fields.baseline) return
		Object.entries(fields.baseline).forEach(([k,v]) => {
			this.targets[k] = v
		})
		// hold face for a while as a test @todo this feels a bit artificial
		this.relaxation = Math.max( this.relaxation, performance.now() + 3000 )
	}

	//
	// blink both eyes at a frequency and velocity - @todo this could be improved
	//

	_blink_update(time,delta) {
		const v = clamp(Math.sin(time/900)*800-800+1,0,1)
		this.targets.eyeBlinkLeft = v
		this.targets.eyeBlinkRight = v
	}

	//
	// small random facial ticks @todo could be improved to be more random
	//

	_facial_ticks_update(time,delta) {

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
			this.tick_current = 0
			return
		}

		// may pick a new tick
		if(!this.tick_current) {
			this.tick_current = ticks[ Math.floor( Math.random() * ticks.length ) ]
		}

		// animate tick
		this.targets[this.tick_current] = v / 2.0

	}

	tick_current = 0

	///
	/// @summary gaze control; typically gaze on utterances and on player in view - for a moment
	///
	/// delay to start may be supplied
	/// duration may be supplied
	/// a randomness may be supplied
	///

	gaze(delay=-1,duration=-1,randomness=0) {

		// may do nothing if there is randomness
		if(randomness && Math.random() > randomness ) return

		// capture the live head orientation to reduce snapping as gaze begins
		this.headCurrentQuaternion.copy(this.head.quaternion)

		// begin after some delay
		if(delay<0) delay = Math.random() * 1000

		// proceed for some duration
		if(duration<0) duration = Math.random() * 1000 + 4000

		this._gaze_begin = performance.now() + delay
		this._gaze_end = performance.now() + delay + duration
		console.log("**** npc puppet setting gaze start end",this._gaze_begin,this._gaze_end)
	}

	_gaze_begin = 0
	_gaze_end = 0
	_gaze_seen = false

	_gaze_update(time) {

		const camera = this.camera
		const body = this.node
		const head = this.head
		if(!head || !body || !camera) return

		//if(!head) {
		//	const m = new THREE.Matrix4().lookAt(camera.position, body.position, body.up)
		//	const q = new THREE.Quaternion().setFromRotationMatrix(m)
		//	body.quaternion.copy(q)
		//	return
		//}

		// determine if player is physically visible
		const cameraPosition = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld)
		cameraPosition.y -= 0.5
		const headPosition = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld)
		const headToCamera = new THREE.Vector3().subVectors(cameraPosition, headPosition ).normalize()
		const bodyForwardWorld = new THREE.Vector3(0,0,1).clone().applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion())).normalize()
		const angle = bodyForwardWorld.angleTo(headToCamera)
		const distance = cameraPosition.distanceTo(headPosition)
		const gazelimit = this.gazelimit || 1
		const seen = angle<gazelimit && distance < 10.00

		// determine if there is a state transition to becoming visible
		if(seen && !this._gaze_seen) {
			this.gaze()
		}
		this._gaze_seen = seen
		
		// active focusing has been requested for this duration?
		time = performance.now()
		const focus = this._gaze_begin < time && this._gaze_end > time

		// if visible and actively being focused on then focus on the player - doing so quickly
		if(seen && focus) {
			const m = new THREE.Matrix4().lookAt(cameraPosition, headPosition, head.up)
			this.headTargetQuaternion.setFromRotationMatrix(m)
			const bodyQuaternion = body.getWorldQuaternion(new THREE.Quaternion())
			this.headTargetQuaternion.premultiply(bodyQuaternion.invert())
			this.headCurrentQuaternion.slerp(this.headTargetQuaternion,0.07)
			head.quaternion.copy(this.headCurrentQuaternion)
			if(this.left && this.right) {
				this.left.lookAt(cameraPosition)
				this.right.lookAt(cameraPosition)
			}
		}

		// test: if actively doing something then don't relax to origin - just leave things be
		else if(seen && this.relaxation > time) {
			this.headCurrentQuaternion.slerp(this.headTargetQuaternion,0.1)
			head.quaternion.copy(this.headCurrentQuaternion)
			if(this.left && this.right) {
				this.left.lookAt(cameraPosition)
				this.right.lookAt(cameraPosition)
			}
		}

		// relax to origin if not seen and or not focus - and do so slowly
		else {
			this.headCurrentQuaternion.slerp(this.headDefaultQuaternion,0.03)
			head.quaternion.copy(this.headCurrentQuaternion)
			if(this.left && this.right) {
				this.left.quaternion.set(0,0,0,1)
				this.right.quaternion.set(0,0,0,1)
			}
		}
	}

	headDefaultQuaternion = new THREE.Quaternion()
	headCurrentQuaternion = new THREE.Quaternion()
	headTargetQuaternion = new THREE.Quaternion()

	//
	// given a large collection of targets, apply those that are in the right time window
	//
	// @todo we throw away the supplied time because the performance init doesn't have it
	// @note i go out of my way to set the unused visemes to zero
	// @note i have fiddled with the attack and release to get something that feels ok - it is a bit jittery
	//

	visemes = {
		'viseme_PP': 0,
		'viseme_FF': 0,
		'viseme_TH': 0,
		'viseme_DD': 0,
		'viseme_kk': 0,
		'viseme_CH': 0,
		'viseme_SS': 0,
		'viseme_nn': 0,
		'viseme_RR': 0,
		'viseme_aa': 0,
		'viseme_E': 0,
		'viseme_I': 0,
		'viseme_O': 0,
		'viseme_U': 0,
	}

	_visemes_update(time,delta) {

		const attack = 50
		const release = 60
		time = performance.now() // @todo revert to passed once stable

		const visemes = this.visemes

		// as a test generally speaking i am dampening the visemes after they are set
		// this is separate from the relaxation idea above
		// it's arguable if this looks good on the face @todo evaluate more? non-linear curves might make sense also

		Object.entries(visemes).forEach( ([k,v]) => {
			visemes[k] = v > 0.01 ? v * 0.85 : 0
		})

		// for the current moment in time - set morph targets
		// @note playing with different timings on visemes to reduce jitter and be more realistic

		for(const item of this.sequence) {
			const begins = item.ts[0]
			const ends = item.ts[1]
			if(begins > time || ends < time) continue
			Object.entries(item.vs).forEach( ([k,v]) => {
				v = v[1]
				if((time - begins) < attack) v *= Math.pow((time-begins)/attack,3)
				if((ends - time) < release) v *= Math.pow((release-(ends-time))/release,3)
				visemes[k] = v
			})
		}

		// copy visemes over to actual targeting system for rendering to the real puppet
		Object.entries(visemes).forEach( ([k,v]) => {
			this.targets[k] = v
		})
	}

	//
	// apply targets (names and floats) to the actual rig
	// dictionary always indicates a group of targets not just necessarily one
	//

	_apply_to_face(time,delta,amplify=1.0) {

		Object.entries(this.targets).forEach(([k,v])=>{

			// linear global fader - useful for returning to a neutral pose gracefully - @note this is just an idea being tried out may deprecate
			if(amplify != 1.0) {
				v = this.targets[k] = v*amplify
			}

			// touch only dirty targets
			if(v === this.dirty[k]) return

			// mark as clean
			this.dirty[k]=v

			// vrms are already correctly mapped and also use english rather than a dictionary lookoup; so set and return
			if(this.vrm) {
				this.vrm.expressionManager.setValue(k,v)
				return
			}

			// set numerical targets for rpm and others
			const group = this.dictionary[k]
			if(!group) return
			this.morphs.forEach(part=>{
				group.forEach(index => {
					part.morphTargetInfluences[index] = v
				})
			})
		})
	}

	//
	// morph target setup
	//
	// my choreography system uses rpm part names
	//
	// vrm does not use a dictionary - so there is very little to do here...
	// also please convert your vrms using blender-puppet-rpm-to-vrm.py
	//
	// reallusion facial morph targets are remapped on the fly for now
	// @note later may deprecate this feature and require users to pre-bake their reallusion rigs
	//

	_morphable_init(node,vrm) {

		// reset

		this.targets = {}
		this.dirty = {}
		this.sequence = []
		this.relaxation = 0

		// vrm doesn't need to do any work in part due to art asset pipeline improvements
		// please convert your vrms using blender-puppet-rpm-to-vrm.py
		if(vrm) {
			//console.log("puppet face - appears to be a vrm - no dictionary needed")
			this.morphs = null
			this.dictionary = null
			return
		}

		const morphs = this.morphs = []
		const dictionary = this.dictionary = {}

		// find bones participating in facial expressions

		node.traverse((part) => {

			// ignore bones that do not have morph targets
			if(!part.morphTargetDictionary || Object.entries(part.morphTargetDictionary).length < 1 ) {
				return
			}

			// also may as well detect if this is an oculus/arkit/rpm rig based on the naming - helpful to know
			if(part.morphTargetDictionary['viseme_sil'] !== undefined) {
				if(this.reallusion) {
					console.warn("puppet face - inconsistent bone naming",part.name)
				}
			}
			else if(part.morphTargetDictionary["EE"] !== undefined) {
				if(!this.reallusion) {
					console.warn("puppet face - reallusion visemes but not reallusion body?",part.name)
				}
			}

			// this bone has some morph targets - let's remember it
			morphs.push(part)
		})

		// visit every morph and build a dictionary of morph target names to index lookups; these are hopefully the same between bones
		// written as small groups or arrays so that support for reallusion array remaps is simpler

		morphs.forEach(part => {
			Object.entries(part.morphTargetDictionary).forEach( ([k,v]) => {
				//console.log("puppet face - rpm morph target",k,v)
				dictionary[k]=[v]
			})
		})

		// visit all targets again if reallusion, and inject a remapped dictionary of morph target lookups so we can drive reallusion rigs
		// we support a concept of a single morph target such as cheekPuff mapping to cheek Puff Left and cheek Puff Right

		if(this.reallusion) {
			Object.entries(RPMFace2Reallusion).forEach( ([k,v]) => {
				if(!Array.isArray(v)) {
					const t = dictionary[v]
					if(t) {
						dictionary[k] = [t]
						//console.log("puppet face - retargeting rpm,reallusion,index =",k,v,t)
					}
				}
				else {
					const v2 = []
					v.forEach(name=>{
						const target = dictionary[name]
						if(target) {
							v2.push(target)
						}
					})
					if(v2.length) {
						dictionary[k] = v2
						//console.log("puppet face - retargeting rpm,reallusion,indexes =",k,v,v2)
					}
				}
			})
		}
	}
}
