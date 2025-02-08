
        import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

        let scene, camera, renderer, analyser;
        let particleSystems = [];
        let time = 0;
        let isAudioActive = false;

        function createNebulaCloud(count, radius, color, size) {
            const particles = new Float32Array(count * 25);
            const velocities = new Float32Array(count * 15);
            const originalPositions = new Float32Array(count * 25);

            // Create clusters of particles
            for (let i = 0; i < count; i++) {
                const clusterCenter = new THREE.Vector3(
                    (Math.random() - 0.5) * radius * .25,
                    (Math.random() - 0.5) * radius * 0.5,
                    (Math.random() - 0.5) * radius * 0.25
                );

                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * radius * .5,
                    (Math.random() - 0.5) * radius * .5,
                    (Math.random() - 0.5) * radius * .5
                );

                const position = clusterCenter.add(offset);

                const i3 = i * 3;
                particles[i3] = position.x;
                particles[i3 + 1] = position.y;
                particles[i3 + 2] = position.z;

                originalPositions[i3] = position.x;
                originalPositions[i3 + 1] = position.y;
                originalPositions[i3 + 2] = position.z;

                velocities[i3] = (Math.random() - 0.5) * 0.002;
                velocities[i3 + 3] = (Math.random() - 0.5) * 0.002;
                velocities[i3 + 6] = (Math.random() - 0.5) * 0.002;
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(particles, 3));

            const material = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    audioFreq: { value: 0 },
                    color: { value: new THREE.Color(color) },
                    pointSize: { value: size }
                },
                vertexShader: `
                    uniform float time;
                    uniform float audioFreq;
                    uniform float pointSize;

                    varying float vDistance;

                    void main() {
                        vec3 pos = position;
                        
                        // Organic movement
                        float noise = sin(pos.x * 1.0 + time * 2.0) * 
                                    cos(pos.y * 1.0 + time * 2.0) * 
                                    sin(pos.z * 1.0 + time * 2.0) * 0.1;

                        pos += pos * noise * (2.0 + audioFreq);
                        
                        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                        gl_Position = projectionMatrix * mvPosition;
                        
                        vDistance = length(pos) * 2.0;
                        
                        // Dynamic point size
                        float size = pointSize * (1.0 + audioFreq * 2.0);
                        gl_PointSize = size * (1.0 - vDistance * 0.1);
                    }
                `,
                fragmentShader: `
                    uniform vec3 color;
                    uniform float audioFreq;

                    varying float vDistance;

                    void main() {
                        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
                        float r = dot(cxy, cxy);
                        float alpha = exp(-r * 2.0) * (1.0 - vDistance * 0.6);
                        
                        // Intensify color based on audio
                        vec3 finalColor = color * (8.0 + audioFreq * 55.0);
                        
                        gl_FragColor = vec4(finalColor, alpha * 0.6);
                    }
                `,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

            const system = {
                mesh: new THREE.Points(geometry, material),
                velocities: velocities,
                originalPositions: originalPositions
            };

            scene.add(system.mesh);
            return system;
        }

        function init() {
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            
            renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                alpha: true
            });
            const parent = document.getElementById('volume001')
            renderer.setSize(parent.clientWidth, parent.clientHeight);
            parent.appendChild(renderer.domElement);

            // Create multiple particle systems for layered effect
            particleSystems.push(createNebulaCloud(3000, 1.0, '#00ff80', 4.0));  // Green particles
            particleSystems.push(createNebulaCloud(2000, 1.8, '#00ffff', 5.0));  // Cyan particles
            particleSystems.push(createNebulaCloud(2500, 1.6, '#ffffff', 4.0));   // Core particles

            camera.position.z = 1.5;
        }

        function updateParticleSystems(audioFreq) {
            const time = Date.now() * 0.003;

            particleSystems.forEach(system => {
                const positions = system.mesh.geometry.attributes.position.array;
                const velocities = system.velocities;
                const originalPositions = system.originalPositions;

                for (let i = 0; i < positions.length; i += 3) {
                    // Enhanced turbulent motion with more dynamic movement
                    positions[i] += (velocities[i] + Math.sin(time + positions[i]) * 0.002) * (1 + audioFreq * 0.05);
                    positions[i + 1] += (velocities[i + 1] + Math.cos(time + positions[i + 1]) * 0.002) * (1 + audioFreq * 0.05);
                    positions[i + 2] += (velocities[i + 2] + Math.sin(time * 2 + positions[i + 2]) * 0.002) * (1 + audioFreq * 0.5);

                    // Slightly update velocities for more organic movement
                    velocities[i] += (Math.random() - 0.5) * 0.0001;
                    velocities[i + 1] += (Math.random() - 0.5) * 0.0001;
                    velocities[i + 2] += (Math.random() - 0.5) * 0.0001;

                    // Return to original position
                    const dx = originalPositions[i] - positions[i];
                    const dy = originalPositions[i + 1] - positions[i + 1];
                    const dz = originalPositions[i + 2] - positions[i + 2];

                    positions[i] += dx * 0.03;
                    positions[i + 1] += dy * 0.03;
                    positions[i + 2] += dz * 0.03;

                    // Add slight damping to velocities
                    velocities[i] *= 0.98;
                    velocities[i + 1] *= 0.98;
                    velocities[i + 2] *= 0.98;
                }

                system.mesh.geometry.attributes.position.needsUpdate = true;
                system.mesh.material.uniforms.time.value = time;
                system.mesh.material.uniforms.audioFreq.value = audioFreq;
            }); 
        }

let audioContext = null
let analyzer = null
let dataArray = null

        async function setupAudio() {
            try { 
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                isAudioActive = true;
            } catch (err) {
                console.error('Error accessing microphone:', err);
            }
        }

        function updateAudio() {
            if (!isAudioActive || !analyser || !dataArray) return 0;
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            return Math.pow(average / 256, 1.5);
        }

        function animate() {
            requestAnimationFrame(animate);

            time += 0.01;
            
            const audioFreq = isAudioActive ? updateAudio() : Math.sin(time * 0.5) * 0.1 + 0.1;
            updateParticleSystems(audioFreq);

            renderer.render(scene, camera);
        }

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        init();
        animate();
 
//       setupAudio();

        document.addEventListener('click', () => {
            if (!isAudioActive) {
                setupAudio();
            }
        });

//////////////////////////////////////////////////////////////////////////////////////////////

const dealWithAudio = (audioBuffer) => {

    try {
        // Create a source node from the decoded audio
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;

        const bufferLength = analyser.frequencyBinCount; // This is fftSize/2
        dataArray = new Uint8Array(bufferLength);

        source.connect(analyser);
        analyser.connect(audioContext.destination);

        // Resume the audio context (if needed) and start playback
        audioContext.resume();
        source.start();

        analyser.getByteFrequencyData(dataArray);

console.log("computed the fft")
dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(dataArray);

        source.addEventListener('ended', () => {
            source.disconnect();
            analyser.disconnect();
        });

    } catch (err) {
        console.error(err);
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// anselms

function resolve(blob,sys) {

    // this is the audio from the internal text to speech engine from the llm talking

    if(!blob || blob.time || blob.tick) return
    if(!blob.perform || !blob.perform.audio || blob.perform.human) return

console.log("got some data to play in pams system")

    // audiobuffers are kinda dumb
    const dupe = blob.perform.audio.slice(0);

    // this a bridge to the animation system
    // we have to decode the audio and then we let it generate an fft thingie

    if(!audioContext) return
    audioContext.decodeAudioData(dupe,dealWithAudio)


}

export const audio_system = {
    uuid:"effect",
    resolve,
}
        


