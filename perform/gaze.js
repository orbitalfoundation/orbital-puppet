
import * as THREE from 'three'

function prep(volume) {

	volume.head = volume.bones["Head"]
	volume.left = volume.bones["LeftEye"]
	volume.right = volume.bones["RightEye"]

	volume.headDefaultQuaternion = new THREE.Quaternion()
	volume.headCurrentQuaternion = new THREE.Quaternion()
	volume.headTargetQuaternion = new THREE.Quaternion()
	volume._gaze_begin = 0
	volume._gaze_end = 0
	volume._gaze_seen = false
}

///
/// @summary gaze control; typically gaze on utterances and on player in view - for a moment
///
/// delay to start may be supplied
/// duration may be supplied
/// a randomness may be supplied
///

export function gaze(volume,delay=-1,duration=-1,randomness=0) {

	prep(volume)

	const head = volume.head
	if(!head) return

	// don't alays gaze
	if(randomness && Math.random() > randomness ) return

	// get starting head pose
	volume.headCurrentQuaternion.copy(head.quaternion)

	// randomize start of gaze
	if(delay<0) delay = Math.random() * 1000

	// proceed for some duration
	if(duration<0) duration = Math.random() * 1000 + 4000

	volume._gaze_begin = performance.now() + delay
	volume._gaze_end = performance.now() + delay + duration
}

export function gaze_update(volume,time) {

	// super hack @todo volume should inject the camera into the scene please!
	let camera = null
	if(volume.scene) camera = volume.scene.camera
	else if(volume.node && volume.node.parent) camera = volume.node.parent.children[0]
	if(!camera) return

	if(!volume.node || !volume.head) return
	const body = volume.node
	const head = volume.head

	//if(!head) {
	//	const m = new THREE.Matrix4().lookAt(camera.position, body.position, body.up)
	//	const q = new THREE.Quaternion().setFromRotationMatrix(m)
	//	body.quaternion.copy(q)
	//	return
	//}

	// determine if player is physically visible
	const cameraPosition = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld)
	const headPosition = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld)
	const headToCamera = new THREE.Vector3().subVectors(cameraPosition, headPosition ).normalize()
	const bodyForwardWorld = new THREE.Vector3(0,0,1).clone().applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion())).normalize()
	const angle = bodyForwardWorld.angleTo(headToCamera)
	const distance = cameraPosition.distanceTo(headPosition)
	const gazelimit = volume.gazelimit || 1
	const seen = angle<gazelimit && distance < 10.00

	// determine if there is a state transition to becoming visible - reset if so
	if(seen && !volume._gaze_seen) {
		gaze(volume)
	}
	volume._gaze_seen = seen
	
	// active focusing has been requested for duration?
	time = performance.now()
	const focus = volume._gaze_begin < time && volume._gaze_end > time

	// if visible and actively being focused on then focus on the player - doing so quickly
	if(seen && focus) {
		const m = new THREE.Matrix4().lookAt(cameraPosition, headPosition, head.up)
		volume.headTargetQuaternion.setFromRotationMatrix(m)
		const bodyQuaternion = body.getWorldQuaternion(new THREE.Quaternion())
		volume.headTargetQuaternion.premultiply(bodyQuaternion.invert())
		volume.headCurrentQuaternion.slerp(volume.headTargetQuaternion,0.07)
		head.quaternion.copy(volume.headCurrentQuaternion)
		if(volume.left && volume.right) {
			volume.left.lookAt(cameraPosition)
			volume.right.lookAt(cameraPosition)
		}
	}

	// test: if actively doing something then don't relax to origin - just leave things be
	else if(seen && volume.relaxation > time) {
		volume.headCurrentQuaternion.slerp(volume.headTargetQuaternion,0.1)
		head.quaternion.copy(volume.headCurrentQuaternion)
		if(volume.left && volume.right) {
			volume.left.lookAt(cameraPosition)
			volume.right.lookAt(cameraPosition)
		}
	}

	// relax to origin if not seen and or not focus - and do so slowly
	else {
		volume.headCurrentQuaternion.slerp(volume.headDefaultQuaternion,0.03)
		head.quaternion.copy(volume.headCurrentQuaternion)
		if(volume.left && volume.right) {
			volume.left.quaternion.set(0,0,0,1)
			volume.right.quaternion.set(0,0,0,1)
		}
	}
}
