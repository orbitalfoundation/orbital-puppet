
import { animMoods } from './talkinghead/modules/anim-moods.mjs'
import { lipsyncConvert } from './talkinghead/modules/lipsync-queue.mjs'

const clamp = (num, a, b) => Math.max(Math.min(num, Math.max(a, b)), Math.min(a, b));

export class Face {

	// a list of bones that have morph targets
	parts = []

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

	// vrm hint
	// see blender-puppet-rpm-to-vrm.py which injects rpm target names into vrm rigs
	vrm = null

	constructor(parts) {
		this.node = parts.node
		this.head = parts.head
		this.camera = parts.camera
		this.vrm = parts.vrm
		this.left = parts.leftEye
		this.right = parts.rightEye
		this._rewrite_bones_and_morph_targets(this.node)
		if(parts.emotion) {
			this._emote(parts.emotion)
		}
	}

	///
	/// set current performance
	/// if there is another performance active this may overwrite it (effectively halting it)
	/// audio will already have been started in sync with this performance
	///

	perform(perf) {
		// an emotion can be specified
		if(perf.emotion) {
			this._emote(perf.emotion)
		}
		// actions replace emotions as a concept there can be multiple - they may not hook up to anything
		if(perf.actions) {
			perf.actions.forEach( (action) => {
				this._emote(action)
			})
		}
		// start audio visual performance
		if(perf.whisper) {
			const o = lipsyncConvert(perf.whisper,"en")
			this.sequence = o.anim || []

			// add a fudge factor @todo remove in lipsyncConvert
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
	///

	update(animation,time,delta) {

		// fow now use built in time
		time = performance.now()

		// always blink
		this._blink(time,delta)

		// gaze during the default context - @todo later improve context to be more general
		if(animation === 'default') {
			this._gaze(time,delta)
		}

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
		console.log('puppet face - trying to do an emotion',emotion)
		if(!emotion || !emotion.length) return
		const fields = animMoods[emotion.toLowerCase()]
		if(!fields || !fields.baseline) return
		Object.entries(fields.baseline).forEach(([k,v]) => {
			this.targets[k] = v
		})
		// hold face for a while as a test
		this.relaxation = Math.max( this.relaxation, performance.now() + 3000 )
	}

	//
	// gaze at player - this could be a bit less intense - like only triggered at the start of a sentence
	//

	_gaze(time) {

		const camera = this.camera
		const body = this.node
		const head = this.head
		if(!head || !camera || !body) return

		const left = this.left
		const right = this.right

		const headToCamera = new THREE.Vector3().subVectors(camera.position, head.getWorldPosition(new THREE.Vector3())).normalize()
		const bodyForwardWorld = new THREE.Vector3(0,0,1).clone().applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion())).normalize()
		const angle = bodyForwardWorld.angleTo(headToCamera)

		const targetQuaternion = new THREE.Quaternion()

		if(angle<1) {
			const targetPosition = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld)
			const headPosition = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld)
			const m = new THREE.Matrix4().lookAt(targetPosition, headPosition, head.up)
			targetQuaternion.setFromRotationMatrix(m)
			const parentQuaternion = new THREE.Quaternion().copy(body.getWorldQuaternion(new THREE.Quaternion()))
			targetQuaternion.premultiply(parentQuaternion.invert())
			if(left && right) {
				left.lookAt(targetPosition)
				right.lookAt(targetPosition)
			}
	    } else {
			if(left && right) {
				left.quaternion.set(0,0,0,1)
				right.quaternion.set(0,0,0,1)
			}
	    }
		head.quaternion.slerp(targetQuaternion, 0.07)

		// for rpm rigs i 'steal' the head - @todo should only do this if in a default animation mode
		this.head.name = "head-taken"

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
			this.parts.forEach(part=>{
				group.forEach(index => {
					part.morphTargetInfluences[index] = v
				})
			})
		})
	}

	//
	// setup node parts and targets
	//
	// look for rpm or reallusion rig parts that have morph targets
	// remember all those parts because we will want to write to their morph targets
	// also scavenge all of the individual english -> numeric bindings into our own dictionary
	//
	// this choreography system uses rpm part names, but may have to write to reallusion targets in some cases
	// in this case rewrite all of the rpm targets to the dictionary but use reallusion target values
	//
	// @todo later deprecate the reallusion rewriting in favor of a blender script that will do it there
	//

	_rewrite_bones_and_morph_targets(node) {

		// reset

		const parts = this.parts = []
		this.targets = {}
		this.dirty = {}
		const dictionary = this.dictionary = {}
		this.sequence = []
		this.relaxation = 0

		// vrm doesn't need to do any work in part due to art asset pipeline rewriting - see blender-puppet-rpm-to-vrm.py
		if(node._vrm) {
			//console.log("puppet face - appears to be a vrm - no dictionary needed")
			this.dictionary = null
			return
		}

		// rpm and reallusion rigs do some work to have indexed lookups to reduce lookup costs later
		// visit every bone in the body looking for bones that have morph targets and remember them
		let reallusion = false

		node.traverse((part) => {

			// ignore bones that do not have morph targets
			if(!part.morphTargetDictionary || Object.entries(part.morphTargetDictionary).length < 1 ) {
				return
			}

			// this bone has some morph targets - let's remember it
			parts.push(part)

			// also may as well detect if this is an oculus/arkit/rpm rig based on the naming - helpful to know
			if(part.morphTargetDictionary['viseme_sil'] !== undefined) {
				//console.log("puppet face - found is rpm",part.name)
			}
			else if(part.morphTargetDictionary["EE"] !== undefined) {
				//console.log("puppet face - found is reallusion",part.name)
				reallusion = true
			}

		})

		// visit every bone and build a dictionary of morph target names to index lookups; these are hopefully the same between bones
		// written as small groups or arrays so that support for reallusion array remaps is simpler

		parts.forEach(part => {
			Object.entries(part.morphTargetDictionary).forEach( ([k,v]) => {
				//console.log("puppet face - rpm morph target",k,v)
				dictionary[k]=[v]
			})
		})

		// reallusion rigs need to be remapped for now - later art pipeline can add rpm style named morph targets
		// visit all bones again if reallusion, and inject a remapped dictionary of morph target lookups so we can drive reallusion rigs
		// we support a concept of a single morph target such as cheekPuff mapping to cheek Puff Left and cheek Puff Right

		if(reallusion) {
			Object.entries(retargeting).forEach( ([k,v]) => {
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

//
// retargeting rpm to reallusion support
// for vrm rigs support is added in the art pipeline so that this is not needed
// @todo add support to reallusion pipeline as well so that this support is not needed here and then delete this
//

const retargeting = {

	//viseme_sil: undefined
	viseme_PP: 'B_M_P',
	viseme_FF: 'F_V',
	viseme_TH: 'TH',
	viseme_DD: 'T_L_D_N',
	viseme_kk: 'K_G_H_NG',
	viseme_CH: 'Ch_J',
	viseme_SS: 'S_Z',
	viseme_nn: 'T_L_D_N',
	viseme_RR: 'R',
	viseme_aa: 'Ah',
	viseme_E: 'EE',
	viseme_I: 'IH',
	viseme_O: 'Oh',
	viseme_U: 'W_OO',

	// undefined:AE
	// undefined:Er

	browDownLeft:'Brow_Drop_Left',
	browDownRight:'Brow_Drop_Right',
	browInnerUp: [ 'Brow_Raise_Inner_Left', 'Brow_Raise_Inner_Right' ],
	browOuterUpLeft:'Brow_Raise_Outer_Left',
	browOuterUpRight:'Brow_Raise_Outer_Right',

	// : 'Brow_Raise_Left',
	// : 'Brow_Raise_Right',

	cheekPuff: [ 'Cheek_Blow_L', 'Cheek_Blow_R' ],
	cheekSquintLeft:'Cheek_Raise_L',
	cheekSquintRight:'Cheek_Raise_R',

	// : Cheeks_Suck,

	eyeBlinkLeft:'Eye_Blink_L',
	eyeBlinkRight:'Eye_Blink_R',
	eyeSquintLeft:'Eye_Squint_L',
	eyeSquintRight:'Eye_Squint_R',
	eyeWideLeft:'Eye_Wide_L',
	eyeWideRight:'Eye_Wide_R',

	//eyeLookDownLeft: undefined,
	//eyeLookDownRight: undefined,
	//eyeLookInLeft: undefined,
	//eyeLookInRight: undefined,
	//eyeLookOutLeft: undefined,
	//eyeLookOutRight: undefined,
	//eyeLookUpLeft: undefined,
	//eyeLookUpRight: undefined,

	// : 'Eyes_Blink',

	eyesClosed:[ 'Eye_Blink_L', 'Eye_Blink_R' ],

	// eyesLookUp: undefined,
	// eyesLookDown: undefined,

	//jawForward:undefined,
	//jawLeft:undefined,
	//jawOpen:undefined,
	//jawRight:undefined,

	// mouthClose: undefined,

	// : Mouth_Blow
	// : Mouth_Bottom_Lip_Bite
	// : Mouth_Bottom_Lip_Down
	// : Mouth_Bottom_Lip_Trans
	mouthRollLower:'Mouth_Bottom_Lip_Under',
	mouthDimpleLeft:'Mouth_Dimple_L',
	mouthDimpleRight:'Mouth_Dimple_R',
	// : Mouth_Down
	mouthFrownLeft:'Mouth_Frown_L',
	mouthFrownRight:'Mouth_Frown_R',
	mouthLeft: 'Mouth_L',
	// : Mouth_Lips_Jaw_Adjust
	// : Mouth_Lips_Open
	// : Mouth_Lips_Part
	// : Mouth_Lips_Tight
	// : Mouth_Lips_Tuck
	mouthOpen:'Mouth_Open',
	//Mouth_Plosive
	mouthPucker:'Mouth_Pucker',
	mouthFunnel:'Mouth_Pucker_Open',
	mouthRight: 'Mouth_R',
	// : Mouth_Skewer

	// mouthSmile:'Mouth_Smile',
	mouthSmile: [ 'Mouth_Smile_L', 'Mouth_Smile_R' ], // works for both rpm and reallusion

	mouthSmileLeft:'Mouth_Smile_L',
	mouthSmileRight:'Mouth_Smile_R',
	// : Mouth_Snarl_Lower_L
	// : Mouth_Snarl_Lower_R
	// : Mouth_Snarl_Upper_L
	// : Mouth_Snarl_Upper_R
	mouthRollUpper:'Mouth_Top_Lip_Under',
	// : 'Mouth_Top_Lip_Up'
	//Mouth_Up
	//Mouth_Widen
	mouthStretchLeft: 'Mouth_Widen_Sides',
	mouthStretchRight: 'Mouth_Widen_Sides',

	// mouthShrugLower :
	// mouthShrugUpper :
	// mouthPressLeft :
	// mouthPressRight :
	// mouthLowerDownLeft :
	// mouthLowerDownRight :
	// mouthUpperUpLeft :
	// mouthUpperUpRight :


	noseSneerLeft: 'Nose_Flank_Raise_L',
	noseSneerRight: 'Nose_Flank_Raise_R',
	// undefined:'Nose_Flanks_Raise',
	// undefined:'Nose_Nostrils_Flare',
	// undefined:'Nose_Scrunch',

	// tongueOut: undefined,

}





