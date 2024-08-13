
import { puppetReason } from './puppet/PuppetReason.js'

///
/// @summary An orbital observer - watches for puppet conversations and generates llm driven tts responses - runs on client or server
///
/// @param blob - raw blob from orbital system
/// @param sys - back pointer to sys itself
///

const resolve = async function (blob,sys) {

	// is there a reason message directed at a puppet?
	if(blob.tick) return
	if(!blob.reason || !blob.reason.npcuuid) return
	if(!blob.reason.prompt || !blob.reason.prompt.length) return

	const uuid = blob.reason.npcuuid
	const prompt = blob.reason.prompt

	// does a target exist?
	const entities = sys.query({uuid})
	if(!entities.length || !entities[0].puppet) {
		console.warn("puppet reason observer - target not found",uuid)
		return
	}
	const entity = entities[0]

	// callback invoked on completed performances - which may then be broadcast to network or locally
	const callback = (performance)=>{
		// don't set uuid on the blob since this is heavy transient state not intended for db storage; instead stuff target into performance itself
		// @todo maybe it might make sense to explicitly mark blobs as durable or not?
		performance.targetuuid = uuid
		const blob = { performance }
		// @todo for now only have server broadcast - later example ideas around locally authoritative publishing
		if(sys.isServer) blob.network = {}
		// publish to all listeners - which may be local only if this reasoning engine is running locally - for now
		sys.resolve(blob)
	}

	// send prompts to puppet and get back performances
	puppetReason(entity.puppet,callback,prompt)
}

export const observer_converse = {
	resolve
}
