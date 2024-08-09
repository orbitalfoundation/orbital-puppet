
import { PuppetQueue as Puppet } from './puppet/PuppetQueue.js'

///
/// @summary orbital observer - watches for new performances and plays them on a 3d puppet in the scene
/// @param blob - a raw message
/// @param sys - back pointer to orbital system
///

export const observer_puppet_new_performance = {
	resolve: async (blob,sys) => {
		if(sys.isServer) return
		if(blob.tick) return
		if(!blob.performance) return

		// register abort listener - hack
		detect_abort(sys)

		// find database instance of entity that will do performance
		const entities = sys.query({uuid:blob.performance.targetuuid})
		if(!entities || entities.length < 1) {
			console.warn("puppet performance - entity not found yet",blob,entities)
			return
		}

		// get puppet
		const entity = entities[0]
		const instance = await _puppet_bind(entity)
		if(!instance) {
			return
		}

		// stop?
		if(blob.performance.stop) {
			console.log('puppet ordered to stop',blob)
			instance.stop()
			return
		}

		// callback when performing
		blob.performance.callback = () => {
			sys.resolve({
				conversation:{
					sponsorname: entities[0].name,
					text: blob.performance.text
				}
			})
		}

		// add to queue
		const added = instance.perform(blob.performance)
	}
}

let detect_abort_latched = false

//
// @summary a helper to allow aborting of conversations - not super elegant
//

function detect_abort(sys) {
	if(detect_abort_latched) return
	detect_abort_latched = true
	document.addEventListener("keyup", async (e) => {
		if(e.key !== "Escape") return
		const entities = sys.query({puppet:true,volume:true})
		for(const entity of entities) {
			sys.resolve({
				uuid:entity.uuid,
				puppet:{performance:{stop:performance.now()}},
				network:{}
			})
		}
	})
}



///
/// @summary orbital observer - tick based system to update all 3d puppets every frame - also flags if puppet is busy or not
/// @param blob - a raw message
/// @param sys - back pointer to orbital system
///

export const observer_puppet_tick = {
	resolve: async (blob,sys) => {
		if(sys.isServer) return
		if(!blob.tick) return
		const entities = sys.query({puppet:true,volume:true})
		for(const entity of entities) {
			const instance = await _puppet_bind(entity)
			if(!instance) return
			// there can be small delays that i want to prevent collisions over here
			await instance.update(blob.time,blob.delta)
			// a slight hack - signal if occupied at a higher level - voice detection on/off peeks at this
			entity.puppet.busy = instance.busy
		}
	}
}

//
// @summary helper to bind to 3d puppet body animation support
// @param pointer to orbital datagram for an entity as a whole with a puppet and a volume component
//

async function _puppet_bind(entity) {

	if(!entity || !entity.puppet || !entity.volume || !entity.volume._node) {
		//console.warn("puppet performance - invalid target entity",entity)
		return null
	}
	const puppet = entity.puppet
	const volume = entity.volume

	if(puppet._instance) {
		return puppet._instance
	}

	const config = {
		node : volume._node,
		vrm: volume._vrm || null,
		built_in_animations: volume._built_in_animations,
		animations: volume.animations,
		animation: volume.animation,
		headname: volume.headname || null,
		camera : volume._camera || null,
		emotion: 'happy',
		gazelimit: volume.gazelimit,
		gazeanim: volume.gazeanim,
	}

	puppet._instance = new Puppet()
	await puppet._instance.load(config)
	return puppet._instance
}
