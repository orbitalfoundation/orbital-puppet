
import { Mixamo2VRM } from './Mixamo2VRM.js'

//
// retarget a clip for vrm - returns a new clip
//

function _retarget(clip,vrm) {

	const scene = clip._scene

	if(!scene || !vrm) {
		console.error('puppet body - cannot patch clip',clip,vrm)
		return null
	}

	const hips = scene.getObjectByName('Hips') || scene.getObjectByName('CC_Base_Hip') || scene.getObjectByName('mixamorigHips')
	if(!hips) {
		console.error('volume body retarget hips missing',clip)
		return null
	}

	const hipsPositionScale = hips.scale.y

	const restRotationInverse = new THREE.Quaternion()
	const parentRestWorldRotation = new THREE.Quaternion()
	const _quatA = new THREE.Quaternion()
	const tracks = []

	for (let i = 0; i < clip.tracks.length; i++) {
		let track = clip.tracks[i]
		const trackSplitted = track.name.split('.')
		const rigNodeName = trackSplitted[0]

		// the bone should exist in the clip scene
		const rigNode = scene.getObjectByName(rigNodeName)
		if(!rigNode) {
			console.warn('volume body retarget missing',rigNodeName)
			continue
		}

		// make track refer to vrm equivalent if any - cloning the track
	    const vrmBoneName = Mixamo2VRM[rigNodeName]
	    let vrmNode = vrm.humanoid.getNormalizedBoneNode(vrmBoneName)
	    if(!vrmNode && vrmBoneName === 'Armature') vrmNode = vrm.humanoid.normalizedHumanBonesRoot
	    if (vrmNode && vrmNode.name && vrmNode.name.length) {
	      const propertyName = trackSplitted[1]
	      track = track.clone()
	      track.name = `${vrmNode.name}.${propertyName}`
	      tracks.push(track)
	    } else {
	    	//console.warn('puppet animation vrm bone not found',rigNodeName,vrmBoneName)
	    	continue
	    }

		// rewrite track to vrm
		scene.updateWorldMatrix(true, true)
		rigNode.getWorldQuaternion(restRotationInverse).invert()
		rigNode.parent.getWorldQuaternion(parentRestWorldRotation)
		if (track instanceof THREE.QuaternionKeyframeTrack) {
			for (let i = 0; i < track.values.length; i += 4) {
				const flatQuaternion = track.values.slice(i, i + 4)
				_quatA.fromArray(flatQuaternion)
				_quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse)
				_quatA.toArray(flatQuaternion)
				flatQuaternion.forEach((v, index) => {
					track.values[index + i] = v
				})
			}
		} else if (track instanceof THREE.VectorKeyframeTrack) {
			const value = track.values.map((v) => v * hipsPositionScale)
			value.forEach((v, index) => {
				track.values[index] = v
			})
		}

	}

	return new THREE.AnimationClip(clip.name, clip.duration, tracks)
}

//
// miscellaneous cleanup
//

function _cleanup(key,clip) {

	// console.log("puppet body cleaning ", key)

	if(!key || !clip || !clip.tracks || !clip._scene) {
		console.error("bad clip",scene,key,clip)
		return
	}

	// remove mixamo prefix?
	clip.tracks.forEach((track) => {
		if(track.name.startsWith('mixamo')) {

			// patch scene itself
			const trackSplitted = track.name.split('.')
			const rigNodeName = trackSplitted[0]
			const node = clip._scene ? clip._scene.getObjectByName(rigNodeName) : null
			if(node) {
				node.name = rigNodeName
			}

			//console.log("puppet body - removing mixamo from",key,track.name)
			track.name = track.name.slice(9)

		}
	})

	// remove tips
	// remove the head from default only because it fights gaze() - @todo may not need to do this depending on timing
	// the last is a test for the stone glb @todo remove
	const rewrite = []
	clip.tracks.forEach(track => {
		if(key == "default" && track.name == 'Head.quaternion') return
		if(track.name.endsWith("_end.scale")) return
		if(track.name.endsWith("_end.position")) return
		if(track.name.endsWith("_end.quaternion")) return
		if(track.name.includes("_rootJoint.quaternion")) return
		if(track.name.includes("root_joint_00.quaternion")) return
		rewrite.push(track)
	})

	clip.tracks = rewrite
}

//
// Get a copy of the body bones
//

import { RPMBody2Reallusion } from './RPMBody2Reallusion.js'
import { VRM2Mixamo } from './VRM2Mixamo.js'

function _copy_bones(node,vrm) {

	const bones = {}

	// collect all bones
	node.traverse((child) => {
		if(!child || !child.name || child.type !== 'Bone') return
		bones[child.name] = child
	})

	// also map reallusion bones to rpm namespace
	const reallusion = node.getObjectByName("CC_Base_Head") ? true : false
	if(reallusion) {
		Object.entries(RPMBody2Reallusion).forEach( ([k,v]) => {
			const o = node.getObjectByName(reallusion?v:k)
			if(!o) {
				console.error("puppet - copy bones - cannot find part in rig",v,node)
			} else {
				// @todo the bones could be renamed for the animation engine to support reallusion rigs as is
				// o.name = k
				bones[k] = o
			}
		})
	}

	// overlay vrm normalized bones in rpm name space
	if(vrm) {
		bones.armature = vrm.humanoid.normalizedHumanBonesRoot
		Object.entries(VRM2Mixamo).forEach( ([k,v]) => {
			bones[k] = v
			bones[v] = vrm.humanoid.getNormalizedBoneNode(k) || {
				position: new THREE.Vector3(),
				quaternion: new THREE.Quaternion(),
				scale: new THREE.Vector3(),
				updateWorldMatrix: ()=>{},
				getWorldPosition: ()=> { return new THREE.Vector3() }
			}
		})
	}

	return bones
}

const vrm_retargeted_cache = {}

///
///
/// puppet body - vrm support and cleanup in general
///
///

import { PuppetAnimation } from './PuppetAnimation.js'

export class PuppetBody extends PuppetAnimation {

	bones = {}
	reallusion = false

	async load(config) {
		await super.load(config)

		// check if vrm
		this.reallusion = config.node.getObjectByName("CC_Base_Head") ? true : false

		// copy the bones
		this.bones = _copy_bones(config.node,config.vrm)

		// tidy up
		Object.entries(this.clumps).forEach(([key,clump]) => {

			// clean up clip
			clump.forEach(clip => { _cleanup(key,clip) } )

			// migrate to vrm
			if(config.vrm) {
				const retargeted_clump = vrm_retargeted_cache[key] || []
				if(!retargeted_clump.length) {
					clump.forEach(clip=>{
						clip = _retarget(clip,config.vrm)
						if(!clip) {
							console.error('puppet body vrm patch fail',clump)
							return
						}
						retargeted_clump.push(clip)
					})
				}
				this.clumps[key] = vrm_retargeted_cache[key] = retargeted_clump
			}
		})

	}

	stop() {
		super.stop()
	}
}


/*

		// standalone test code - run the first vrm animation
		if(false && config.vrm) {
			let mixer = new THREE.AnimationMixer(vrm.humanoid.normalizedHumanBonesRoot)
			const action = mixer.clipAction(vrm_retargeted_cache['default'][0])
			action.play()
			setInterval( ()=> {
				mixer.update(1/60)
				vrm.update(1/60)
			},30)
		}

*/
