
import { PuppetQueue as Puppet } from './puppet/PuppetQueue.js'

export const observer_puppet_new_performance = {
	resolve: async (blob,sys) => {
		if(sys.isServer) return
		if(blob.tick) return
		if(!blob.performance) return

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

		// @todo if this is a new conversation then must abort previous conversation!
		// @todo generally also don't play older conversations
		// @todo probably also handle aborts in general

		// add to queue
		instance.perform(blob.performance)

		// print to local text window as a convenience for the participant
		if(blob.performance.text) {
			sys.resolve({
				conversation:{
					sponsorname: entities[0].name,
					text: blob.performance.text
				}
			})
		}
	}
}

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
