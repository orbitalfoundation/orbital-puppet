# Orbital Puppet

## About

This code is primarily focused on 3d puppet performances synced with speech.

Intended to be driven within an orbital-sys based system ( see https://github.com/orbitalfoundation ) but can probably be made to work standalone as well. You will need to load your own model if you don't leverage the orbital tooling - see https://github.com/orbitalfoundation/orbital-volume for the model loader used here.

Animates eyes, mouth visemes, facial expressions, head rotation.

Expects open whisper data that already includes word timestamps. It leverages Mika's viseme generator here: https://github.com/met4citizen/TalkingHead although may eventually switch to a trained neural network for audio to visemes.

## Why have embodied puppets?

* Embodied interfaces may be satisfying to people who are not adapted to 2d interfaces or who were not part of the first wave of technology adoption. For example less than 20% of people can touch type fluently, and there are still billions of people who have never used a computer.

* As humans we have wetware that processes human faces and gestures. It can be a more powerful learning mechanism or communication mechanism - there may be some papers on this.

* Syncing mouth movement provides a sense of presence and aliveness - the avatar is more engaging.

* Presence as a whole is conveyed by accurate emotions, breath pauses and breathing, body guestures matching conversation, body language in general, blinking, facial ticks, and gaze as well.

* Uncanny Valley. Avatars do not need to look real. RPM models are actually pretty much perfect.

## Other web based engines and references for face performances

https://github.com/met4citizen/TalkingHead <- used extensively in this project
https://github.com/bornfree/talking_avatar
https://discourse.threejs.org/t/add-lip-sync-to-existing-3d-model-of-head/49943
https://threejs.org/examples/webgl_morphtargets_face
https://github.com/exokitxr/avatars/blob/master/README.md

https://threejs.org/examples/webgl_morphtargets_face.html
https://hiukim.github.io/mind-ar-js-doc/more-examples/threejs-face-blendshapes/
https://docs.aws.amazon.com/polly/latest/dg/ph-table-english-us.html
http://www.visagetechnologies.com/uploads/2012/08/MPEG-4FBAOverview.pdf
https://www.youtube.com/watch?v=4JGxN8q0BIw ... a demonstration of the unsupported obsolete non-source code but not terrible oculus to viseme tool
https://crazyminnowstudio.com/posts/salsa-lipsync-in-webgl-with-amplitude/ 
https://x.com/trydaily/status/1815530613434417241 ... very nice circa summer 2024 responsive text chat with interruption detection
