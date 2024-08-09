
import { puppetReason } from './puppet/PuppetReason.js'

///
/// @summary An orbital observer - watches for puppet conversations and generates llm driven tts responses - runs on client or server
///
/// @param blob - raw blob from orbital system
/// @param sys - back pointer to sys itself
///

const resolve = async function (blob,sys) {

	// is there a message directed at a puppet?
	if(blob.tick) return
	if(!blob.conversation || !blob.conversation.npcuuid) return
	const uuid = blob.conversation.npcuuid
	const text = blob.conversation.text

	// any text?
	if(!text || !text.length) {
		console.error('puppet reason observer - nothing to reason about')
		return
	}

	// does the puppet exist?
	const entities = sys.query({uuid})
	if(!entities.length || !entities[0].puppet) {
		console.warn("puppet reason observer - target not found",uuid)
		return
	}
	const entity = entities[0]

	// puppet chews on an prompt and spits out a bunch of performances
	puppetReason(entity.puppet,text,(performance)=>{
		performance.targetuuid = uuid
		const blob = { performance }
		if(sys.isServer) blob.network = {} // @todo examine later concepts around local authority - for now only have servers multicast npcs
		sys.resolve(blob)
	})
}

export const observer_converse = {
	resolve
}
