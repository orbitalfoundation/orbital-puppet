
/**

///
/// add powers to 3js rigged root avatar node
///
/// for now i am injecting new powers into basic nodes to try and hide different rigs (realusion, avaturn, rpm, vrm)
/// it expects a 3js scene node that is the root of a rigged avatar such as loaded by a gltf
/// it manages access to low level details such as morph targets
/// it may perform some blending over time to ease the burden of work for outside callers
/// @todo maybe this should be a full blown class that wraps 3js nodes?
///

https://discourse.threejs.org/t/merging-multiple-morph-targets-in-readyplayerme-avatars/25778
https://threejs.org/docs/#manual/en/introduction/Animation-system
https://github.com/mrdoob/three.js/issues/6881

*/

export function nodeAddVisemeHelpers(node) {

	const parts = node.parts = []

	// find sub nodes  that have specific morph targets
	node.traverse((part) => {
		if(!part.morphTargetDictionary) return
		if(part.morphTargetDictionary['viseme_sil'] !== undefined) {
			parts.push(part)
			console.log("npc puppet found rpm",part.name)
			console.log(part.morphTargetDictionary)
		} else if(part.morphTargetDictionary["EE"] !== undefined) {
			node.realusion = part.realusion = true
			parts.push(part)
			console.log("npc puppet found realusion",part.name)
		}
	})

	if(!parts.length) {
		console.error("npc puppet no parts found",node)
	} else {
		console.log("npc parts are",parts.length,parts,node)
	}

	// register a helper to return all child nodes with the morph target
	node.getAllMorphTargets = () => {
		const results = {}
		for(const part of parts) {
			Object.entries(part.morphTargetDictionary).forEach( ([k,v]) =>{
				const degree = part.morphTargetInfluences[v]
				if(degree !== undefined) results[k] = degree
			})
		}
		return results
	}

	// register a helper to get the current value of a morph target
	node.getMorphTarget = (target) => {
		for(const part of parts) {
			if(part.realusion) {
				target = retargeting[target]
				if(Array.isArray(target)) {
					for(const item of target) {
						const t = part.morphTargetDictionary[item]
						if(t === undefined) return undefined
						return part.morphTargetInfluences[t]
					}
				} else {
					const t = part.morphTargetDictionary[target]
					if(t === undefined) return undefined
					return part.morphTargetInfluences[t]
				}
			} else {
				let t = part.morphTargetDictionary[target]
				if(t === undefined) {
					console.log("npc cannot find am patching",target)
					switch(target) {
						case 'mouthSmile': t = part.morphTargetDictionary['mouthSmileLeft']; console.log("npc target patch",target,t,part.morphTargetInfluences[t]); break
						case 'eyesLookDown': t = part.morphTargetDictionary['eyeLookDownLeft']; console.log("npc target patch",target,t,part.morphTargetInfluences[t]); break
						default: break
					}					
				}
				if(t === undefined) return undefined
				return part.morphTargetInfluences[t]
			}
		}
		return undefined
	}

	//
	// a helper to set a morph target translating from rpm to other
	// @todo add rate support
	// @todo deal with vrm
	//

	node.setMorphTargets = (targets,degree,rate=1.0,translate=true)=>{
		targets = Array.isArray(targets) ? targets : [targets]
		parts.forEach(part=>{
			targets.forEach(target=>{
				if(part.realusion && translate) {
					target = retargeting[target]
					if(target === undefined) return
					if(Array.isArray(target)) {
						target.forEach(target=>{
							let t = part.morphTargetDictionary[target]
							if(t === undefined) return
							part.morphTargetInfluences[t] = degree
						})
					} else {
						let t = part.morphTargetDictionary[target]
						if(t === undefined) return
						part.morphTargetInfluences[t] = degree
					}
					return
				} else {
					let t2 = part.morphTargetDictionary[target]
					if(t2 === undefined) {

						switch(target) {
							case 'eyesLookDown':
								node.setMorphTargets('eyeLookDownLeft',degree)
								node.setMorphTargets('eyeLookDownRight',degree)
								return
							case 'mouthSmile':
								node.setMorphTargets('mouthSmileLeft',degree)
								node.setMorphTargets('mouthSmileRight',degree)
								return
						}

						console.log("not found",target)
						return
					}
					part.morphTargetInfluences[t2] = degree
				}
			})
		})
	}

	//
	// an update helper - not used yet
	// @todo deal with vrm
	//

	node.update = () => {

		//if(rate!=1.0) {
		//	lerp(part.morphTargetInfluences,target,degree,rate,delta)
		//}
		//if(target) part.morphTargetInfluences[target]=v
		//lerp(part.morphTargetInfluences,target,v,0.2,delta)

		/*

			if(vrm) {

				if(starttime + duration < time) {
					// @todo should have a relax strategy
					return false
				}

				for (let i = 0; i < data.length; i++) {
					vrm.expressionManager.setValue(visemes_realusion[i],data[i])
				}

				vrm.update(args.delta/1000.0)

				return true
			}

		}
		*/


	}

}

//
// retargeting rpm to realusion
//

const retargeting = {

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

	// eyesClosed: undefined,
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
	mouthSmile:'Mouth_Smile',
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

	// handFistLeft, handFistRight ...
}
