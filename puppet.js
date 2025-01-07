
//
// For now the puppet chat system relies on these external services to be loaded
//

function loadScript(src) {
	var script = document.createElement('script');
	script.src = src;
	script.type = 'text/javascript';
	document.head.appendChild(script);
}
  
loadScript("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.js")
loadScript("https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.19/dist/bundle.min.js")

//
// puppet service as a whole watches for audio packets and animates associated puppet
//

const uuid = 'puppet-system'

const isServer = (typeof window === 'undefined') ? true : false

async function resolve(blob) {

	// client side only
	if(isServer) return

	// update puppets
	if(blob.tick) {
		Object.values(this._puppets).forEach(puppet => puppet.update() )
		return
	}

	// stop all puppets on barge in - @todo later only stop puppet near player in space
	if(blob.human && blob.human.bargein) {
		Object.values(this._puppets).forEach(puppet => puppet.stop() )
	}

	// bind new puppets - @todo for now i require that blobs have a uuid - revisit
	if(blob.puppet && blob.volume && blob.uuid) {
		const uuid = blob.uuid
		let puppet = this._puppets[uuid]
		if(blob.obliterate) {
			if(puppet) {
				puppet.obliterate()
				delete this._puppets[uuid]
			}
		} else {
			if(!this._PuppetClass) {
				const modules = await import('./puppet-class.js')
				this._PuppetClass = modules.PuppetClass
			}
			if(!puppet && this._PuppetClass) {
				puppet = this._puppets[uuid] = new this._PuppetClass()
				// for now only apply once @todo handle changes
				puppet.configure(blob.volume)
			}
		}
	}

	// observe puppet directed performances - use first puppet for now
	if(blob.audio && blob.audio.whisper) {
		const puppets = Object.values(this._puppets)
		const puppet = puppets.length ? puppets[0] : null
		if(puppet) {
			puppet.perform({
				whisper:blob.audio.whisper,
				audio:blob.audio.data,
				final:blob.audio.final
			})
		}
	}

}

///
/// this is a system that gets run every tick and watches events, it tracks puppets and helps choregraph their behavior
///

export const puppet_system = {
	uuid,
	resolve,
	_puppets:{},
}
