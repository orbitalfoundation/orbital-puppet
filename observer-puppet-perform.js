
import { Puppet } from './puppet.js'

///
/// this is an orbital specific wrapper for puppet that watches for important events and sends them to puppet - making a puppet if need be
///
/// @todo detect entity deletion and dispose Puppet after this is done - there's currently no de-registration machinery?
///

export const observer_puppet_new_performance = {
	resolve: (blob,sys) => {
		if(sys.isServer) return
		if(blob.tick) return
		if(!blob.performance) return
		const entities = sys.query({uuid:blob.performance.targetuuid})
		if(!entities || entities.length < 1) {
			console.warn("puppet performance - entity not found yet",blob,entities)
			return
		}
		const entity = entities[0]
		const puppet = _puppet_bind(entity)
		if(puppet) {

			// stuff a callback into the performance that can be used to start an action in sync with the performance actually starting
			blob.performance._performance_started_callback = (performance) => {
				//console.log("puppet performance - starting performance")
				if(blob.performance.actions && blob.performance.actions.length) {
					const animation = blob.performance.actions[0]
					console.log("puppet performance - saw an action will try perform it ",animation)
					sys.resolve({
						uuid:entity.uuid,
						volume: {
							animation
						}
					})
				}
			}

			// stuff the performance onto the list of performances to do - a callback is registered so i know when it starts
			puppet.performance_append(blob.performance)

			// print to local text window as a convenience for the participant
			if(blob.performance.audio && blob.performance.text) {
				sys.resolve({
					conversation:{
						sponsorname: entities[0].name,
						text: blob.performance.text
					}
				})
			}

		}
	}
}

export const observer_puppet_tick = {
	resolve: (blob,sys) => {
		if(sys.isServer) return
		if(!blob.tick) return
		const entities = sys.query({puppet:true,volume:true})
		entities.forEach( (entity) => {
			const puppet = _puppet_bind(entity)
			if(!puppet) return
			puppet.performance_update(entity.volume.animation,blob.time,blob.delta)
		})
	}
}

const _puppet_bind = (entity) => {
	if(!entity.puppet || !entity.volume || !entity.volume._node) {
		//console.warn("puppet performance - invalid target entity",entity)
		return null
	}
	if(!entity.puppet._puppet) {
		const node = entity.volume._node
		const parts = {
			node,
			vrm: node._vrm,
			camera : entity.volume._camera,
			head: node.getObjectByName("Head") || node.getObjectByName("Head-Gaze"),
			leftEye: node.getObjectByName("LeftEye"),
			rightEye: node.getObjectByName("RightEye"),
			head: node.getObjectByName("Head"),
			emotion: 'happy',
		}

		entity.puppet._puppet = new Puppet(parts)
	}
	return entity.puppet._puppet
}
