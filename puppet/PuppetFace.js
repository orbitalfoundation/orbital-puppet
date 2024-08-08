
const BREAK_DURATION = 100

import { animMoods } from '../talkinghead/modules/anim-moods.mjs'
import { lipsyncConvert } from '../talkinghead/modules/lipsync-queue.mjs'

const clamp = (num, a, b) => Math.max(Math.min(num, Math.max(a, b)), Math.min(a, b));

import { PuppetBody } from './PuppetBody.js'

//////////////////////////////////////////////////////////////////////////////////////////////////////
//
// puppet face focused rigging support
//
//////////////////////////////////////////////////////////////////////////////////////////////////////

export class PuppetFace extends PuppetBody {

	// a list of bones that have morph targets - these should be on the face/head
	morphable = []

	// an optional helper table of english names to an array of indexes for bone morph targets such as "mouthSmile" : [ 23,32 ] or Mouth_Smile_L and Mouth_Smile_R
	dictionary = {}

	// english named targets to floats ... reflecting the degree of the named morph target we want to apply... in rpm rig notation
	targets = {}

	// mark if targets are 'dirty' or not and need updating; to reduce pressure on the engine
	dirty = {}

	// the current animation sequence that is being played; consists of a series of internal time slice effects
	sequence = []

	// an idea (being explored) of overall relaxation so that when sequences are done the entire puppet face can be gently brought to rest
	relaxation = 0

	// reallusion rig?
	reallusion = false

	// vrm hint
	// see blender-puppet-rpm-to-vrm.py which injects rpm target names into vrm rigs
	vrm = null

	async load(config) {

		await super.load(config)

		this.node = config.node
		this.vrm = config.vrm
		this.camera = config.camera
		this.gazelimit = config.gazelimit
		this.gazeanim = config.gazeanim

		this._morphable_init(this.node,this.vrm)

		// @todo cannot animate reallusion bodies yet because body bones are not remapped

		// pull out head and eyes by hand
		this.head = this.bones[config.headname || "Head"]
		this.left = this.bones["LeftEye"]
		this.right = this.bones["RightEye"]

		// estimate eye height
		this.eyey = this.left ? this.left.position.y : 1.7

		// perform an animation right now if any
		if(config.emotion) {
			this._emote(config.emotion)
		}

	}

	///
	/// set current performance
	/// if there is another performance active this may overwrite it (effectively halting it)
	/// audio will already have been started in sync with this performance
	///

	face_start_performance(perf) {

		// an emotion can be specified
		if(perf.emotion) {
			this._emote(perf.emotion)
		}

		// try treat actions as facial emotions
		if(perf.actions) {
			perf.actions.forEach( (action) => {
				this._emote(action)
			})
		}
		// start audio visual performance
		if(perf.whisper) {
			const o = lipsyncConvert(perf.whisper,"en")
			this.sequence = o.anim || []

			// add a fudge factor
			// @todo remove in lipsyncConvert
			// set relaxation time in future
			const time = performance.now()
			for(const item of this.sequence) {
				item.ts[0] += time + 150
				item.ts[1] += time + 150
				item.ts[2] += time + 150
				this.relaxation = Math.max(this.relaxation,item.ts[1])
			}
		}
	}

	///
	/// update face over time
	/// @todo passing the animation is a bit sloppy - this level of engine should have direct access
	///

	face_update(animation,time,delta) {

		// fow now use built in time
		time = performance.now()

		// always blink
		this._blink(time,delta)

		// gaze during the default context - @todo later improve context to be more general
//		if(!this.gazeanim || this.gazeanim === animation) {
			this._gaze(time,delta)
//		}

		// if relaxing then relax - this is experimental - may change approach
		if(this.relaxation < time ) {

			// perform small facial ticks while relaxing
			this._facial_ticks(time,delta)

			// slightly dampen effects to zero over time
			this._apply_to_face(time,delta,0.9)
		}

		// actively speaking
		else {

			// apply viseme performance over time
			this._animate_visemes(time,delta)

			// apply performance to 3js avatar / puppet
			this._apply_to_face(time,delta)

		}

		// vrm has a special update helper
		if(this.vrm) {
			this.vrm.update(delta/1000)
		}

	}

	//
	// blink both eyes at a frequency and velocity
	//

	_blink(time,delta) {
		const v = clamp(Math.sin(time/900)*800-800+1,0,1)
		this.targets.eyeBlinkLeft = v
		this.targets.eyeBlinkRight = v
	}

	//
	// small random facial ticks @todo could be improved to be more random
	//

	tick_current = 0

	_facial_ticks(time,delta) {

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

	//
	// emotion
	// @todo right now this just sets the baseline emotion - it could be nice to play the sequence
	//

	_emote(emotion) {
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
	// gaze at player - this could be a bit less intense - like only triggered at the start of a sentence
	//

	_gaze(time) {

		const camera = this.camera
		const body = this.node
		const head = this.head
		if(!body || !camera) return

		if(body && !head) {
			//const m = new THREE.Matrix4().lookAt(camera.position, body.position, body.up)
			//const q = new THREE.Quaternion().setFromRotationMatrix(m)
			//body.quaternion.slerp(q, 0.07)
			return
		}

		const left = this.left
		const right = this.right

		const headToCamera = new THREE.Vector3().subVectors(camera.position, head.getWorldPosition(new THREE.Vector3())).normalize()
		const bodyForwardWorld = new THREE.Vector3(0,0,1).clone().applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion())).normalize()
		const angle = bodyForwardWorld.angleTo(headToCamera)

		const targetQuaternion = new THREE.Quaternion()
		const gazelimit = this.gazelimit || 1
		if(angle<gazelimit) {
			const targetPosition = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld)
			const headPosition = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld)
			const m = new THREE.Matrix4().lookAt(targetPosition, headPosition, head.up)
			targetQuaternion.setFromRotationMatrix(m)
			const bodyQuaternion = new THREE.Quaternion().copy(body.getWorldQuaternion(new THREE.Quaternion()))
			targetQuaternion.premultiply(bodyQuaternion.invert())
			head.quaternion.slerp(targetQuaternion, 0.07)
			if(left && right) {
				left.lookAt(targetPosition)
				right.lookAt(targetPosition)
			}
	    } else {
			head.quaternion.slerp(targetQuaternion, 0.07)
			// @todo there seems to be some kind of relative motion for the body parts
			if(left && right) {
				left.quaternion.set(0,0,0,1)
				right.quaternion.set(0,0,0,1)
			}
	    }
	}


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

	_animate_visemes(time,delta) {

		const attack = 50
		const release = 60
		time = performance.now()

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
			Object.entries(RetargetOculusARKitToReallusion).forEach( ([k,v]) => {
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
