
import * as THREE from 'three'

function prep(target) {
	if(!target.headDefaultQuaternion) return
	target.headDefaultQuaternion = new THREE.Quaternion()
	target.headCurrentQuaternion = new THREE.Quaternion()
	target.headTargetQuaternion = new THREE.Quaternion()
	target._gaze_begin = 0
	target._gaze_end = 0
	target._gaze_seen = false
}

///
/// @summary gaze control; typically gaze on utterances and on player in view - for a moment
///
/// delay to start may be supplied
/// duration may be supplied
/// a randomness may be supplied
///

export function gaze(delay=-1,duration=-1,randomness=0) {

	const head = this.head
	if(!head) return

	prep(this)

	// may do nothing if there is randomness
	if(randomness && Math.random() > randomness ) return

	// capture the live head orientation to reduce snapping as gaze begins
	this.headCurrentQuaternion.copy(head.quaternion)

	// begin after some delay
	if(delay<0) delay = Math.random() * 1000

	// proceed for some duration
	if(duration<0) duration = Math.random() * 1000 + 4000

	this._gaze_begin = performance.now() + delay
	this._gaze_end = performance.now() + delay + duration
	console.log("**** npc puppet setting gaze start end",this._gaze_begin,this._gaze_end)
}

export function gaze_update(time) {

	const camera = this.camera
	const body = this.node
	const head = this.head
	if(!head || !body || !camera) return

	prep(this)

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
