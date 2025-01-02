
// @todo for some reason /+esm does something very strange with import maps - they stop working!
import sys from 'https://cdn.jsdelivr.net/npm/orbital-sys@latest/src/sys.js'

//
// fetch volume itself - providing 3d services - and then some volume rendered 3d elements
//

const volume_system = {
	load:'https://cdn.jsdelivr.net/npm/orbital-volume@latest/volume.js'
}

const scene001 = {
	volume: {
		geometry: 'scene',
		div: 'volume001',
		background: 0x202020,
		near: 0.1,
		far: 100,
		alpha: false,
		axes: true,
		controls: false,
	}
}

const camera001 = {
	volume: {
		geometry: 'camera',
		cameraMin: 1,
		cameraMax: 100,
		pose:{
			position:[0,1.5,4],
			love:[0,1.5,0]
		}
	}
}

const light001 = {
	volume: {
		geometry:'light',
		light:'directional',
		intensity: 1,
		color: 0xffeae0,
		pose:{
			position:[1,1,1]
		},
	}
}

const light002 = {
	volume: {
		geometry:'light',
		light:'ambient',
		color: 0xffeae0,
		intensity: 1
	}
}

// do not export
const animations = {
	default: import.meta.url + "/../assets/animations/unarmed-idle.glb",
}

const cube001 = {
	volume: {
		geometry: 'cube',
		material: { color: 'red' },
		pose: {
			position:[-1,2,0],
			scale:[0.1,0.1,0.1],
		}
	}
}

const sphere001 = {
	volume: {
		geometry: 'sphere',
		material: { color: 'green' },
		pose: {
			position:[0,2,0],
			scale:[0.1,0.1,0.1],
		}
	}
}

const cylinder001 = {
	volume: {
		geometry: 'cylinder',

		// https://threejs.org/docs/#api/en/geometries/CylinderGeometry
		// radiusTop, radiusBottom, height, radialSegments, heightSegments
		props: [0.1,1,1,5,5],

		material: { color: 'blue' },
		pose: {
			position:[1,2,0],
			rotation:{x:0,y:0,z:0},
			scale:[0.1,0.1,0.1],
		}
	},
	resolve: function(blob,sys,self) {
		// an example of a 'system' observing a global tick message at 60fps (runs on client or server)
		if(!blob.tick) return
		// typically one has to publish a message to have a reaction but I'm trying an idea of directly binding state for some special cases
		// here volume pose properties are magically bound to 3js, so they can be altered directly without publishing a message
		// this may or may not be a durable pattern and still needs evaluation
		// the risk is that this declaration may not be authoritative; it needs to be marked as such ideally
		// also modifying state directly here implies that that state is leaky across observer process isolation
		self.volume.pose.rotation.x += 0.01
	}
}

const person001 = {
	volume: {
		geometry: 'file',
		url: 'https://models.readyplayer.me/664956c743dbd726eefeb99b.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
		animations,
	},
	puppet: {}
}


// volume will observe these events and react to them
sys(volume_system,scene001,camera001,light001,light002,cube001,sphere001,cylinder001,person001)
