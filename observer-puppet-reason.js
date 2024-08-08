
import { puppet_reason } from './puppet-reason.js'

///
/// An orbital specific shim around the puppet converse logic - catch text chatter and pass to the puppet llm
///
/// If this is started on a server then the llm will be called from a server and audio is broadcast
/// If this is run on a client then the llm will be called from the client - risks exposing api keys
///

const resolve = async function (blob,sys) {

	// is there a message directed at a puppet?
	if(blob.tick) return
	if(!blob.conversation || !blob.conversation.npcuuid) return
	const uuid = blob.conversation.npcuuid
	const text = blob.conversation.text

	// does the puppet exist?
	const entities = sys.query({uuid})
	if(!entities.length || !entities[0].puppet) {
		console.warn("puppet observer - target not found",uuid)
		return
	}
	const entity = entities[0]

	// puppet chews on an prompt and spits out a bunch of performances
	puppet_reason(entity.puppet,text,(performance)=>{
		performance.targetuuid = uuid
		sys.resolve({performance})
	})
}

export const observer_converse = {
	resolve
}
