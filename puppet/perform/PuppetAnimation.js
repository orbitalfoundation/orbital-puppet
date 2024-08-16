
const uuid = 'puppet animation'

const cache = {}

let collision = 0

//
// load all animations returning a hash of { key: array of clips }
//

async function _load(animations,built_in=null) {

	// check for multiple simultaneous loads
	if(collision) {
		console.error("puppet animation cannot run twice simultaneously")
	}
	collision++

	// result set
	const clumps = {}

	// add built in animations if we wish
	if(built_in && built_in.length) {
		for(let clip of built_in) {
			clumps[clip.name] = [clip]
		}
	}

	// load animation files from { clipname: {path:filename, start:, end: } }
	if(animations && typeof animations === 'object' && !Array.isArray(animations)) {

		// visit each file
		for(const [key,value] of Object.entries(animations)) {

			// it is legal to have empty keys
			if(!value) {
				console.warn(uuid,"empty key",key,value)
				clumps[key] = null
				continue
			}

			if(Array.isArray(value)) {
				console.error(uuid,"unsupported type")
				continue
			}

			// vanilla clip?
			let filename
			let subclip = null
			if(typeof value === 'string' || value instanceof String) {
				filename = value
			}

			// subclip?
			else if(typeof value === 'object') {
				subclip = value
				filename = value.path
				if(!filename) {
					console.error(uuid,"bad subclip",filename,key,value)
					continue
				}
			}

			// find named collection in global cache?
			let clump = cache[filename]

			// load?
			if (!clump) {

				cache[filename] = clump = []

				try {
					if(filename.endsWith(".json")) {
						const response = await fetch(filename)
						const json = await response.json()
						json.forEach((jsonclip) => {
							let clip = THREE.AnimationClip.parse(jsonclip)
							clip._scene = null
							clump.push(clip)
						})
					} else if(filename.endsWith(".glb") || filename.endsWith(".gltf")) {
						let blob = await globalThis.gltfloader.loadAsync(filename)
						blob.animations.forEach(clip => {
							clip._scene = blob.scene
							clump.push(clip)
						})
					} else if(filename.endsWith(".fbx")) {
						let blob = await globalThis.fbxloader.loadAsync(filename)
						for(let clip of blob.animations) {
							clip._scene = blob.scene
							clump.push(clip)
						}
					}
				} catch(err) {
					console.error(uuid,"cannot load animation file",filename,err)
				}
			}

			// valid?
			if(!clump || !clump.length) {
				console.error(uuid,'loaded clips are too short',filename,clump)
				continue
			}
			//console.log(uuid,'loaded clips',filename)

			// for now throw away all except first
			let clip = clump[0]

			// snip out a piece?
			if(subclip && subclip.hasOwnProperty('start') && subclip.hasOwnProperty('end')) {
				clip = THREE.AnimationUtils.subclip(clip,key+"clipped",0,20)
			}

			// stash just one for now @todo improve
			clumps[key.toLowerCase()] = [ clip ]
		}
	}

	// get collection
	const values = Object.values(clumps)

	// set a default if exists at all - however do not overwrite default:null
	if(values && values.length && !clumps.hasOwnProperty('default')) {
		clumps['default'] = values[0]
	}

	collision--

	return clumps
}


//
// may change animations
//

function animationStart(requested='default') {

	// sanity checks
	if(!this.mixer || !this.clumps) return
	if(typeof requested !== 'string') {
		console.error('puppet animation - bad request',requested)
		return
	}

	// no change?
	if(requested == this.latched) {
		return
	}
	this.latched = requested
	//console.log("pupppet animation - changed to",requested,this.latched)

	// fade old?
	if(this.action) {
		this.action.fadeOut(0.5)
		this.action = null
	}

	// no work to do?
	if(!requested) {
		return
	}

	// cannot find clip?
	const clump = this.clumps[requested.toLowerCase()]
	if(!clump || !clump.length) {
		console.warn('volume - animation clip not found!',requested)
		return
	}

	// fade in clip
	const clip = clump[0]
	const action = this.action = this.mixer.clipAction(clip)
	action.reset()
	action.fadeIn(0.5)
	action.loop = (requested === 'default') ? THREE.LoopRepeat : THREE.LoopOnce
	action.clampWhenFinished = true
	action.play()
	action.onLoop = (e) => {
		console.log('volume - animation has reached the end possibly',requested)
		if(event.type === 'loop' && event.willLoop === false) {
			// could cross fade to something else? @todo should crossfades be manual or?
			// action.crossFadeTo(newAction, duration, false)
		}
	}
}

///
/// animation blending services
///

export class PuppetAnimation {

	clumps = {}
	mixer = null
	animationStart = animationStart.bind(this)

	async load(config) {
		// @todo doesn't deal with append
		const clumps = this.clumps = await _load(config.animations)
		if(clumps && Object.entries(clumps).length && !this.mixer) {
			this.mixer = new THREE.AnimationMixer(config.node)
			this.mixer.addEventListener( 'finished', () => { this.animationStart() } )
		}
	}

	update(time,delta) {
		if(!this.mixer || !this.clumps) return
		this.mixer.update(delta/1000)
	}

	stop() {
		this.animationStart('default')
	}

}
