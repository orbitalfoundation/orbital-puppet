
import * as THREE from 'three';

import { AnimationClip, KeyframeTrack, Object3D, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three'

import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const hipsRegex = /hip|pelvis/i
export const recursiveHipsLookup = (model) => {
  let thing = null
  const name = model.name.toLowerCase()
  if (hipsRegex.test(name)) {
    return model
  }
  if (model.children.length > 0) {
    for (const child of model.children) {
      thing = recursiveHipsLookup(child)
      if(thing) break
    }
  }
  return thing
}

///
/// retarget an animation clip of a mixamo rig
///
/// supply an AnimationClip and a mixamoScene ( a root avatar )
///

const restRotationInverse = new Quaternion()
const parentRestWorldRotation = new Quaternion()
const _quatA = new Quaternion()

export const retargetAnimationClip = (mixamoScene,clipNumber) => {

  let clip = mixamoScene.animations[clipNumber]

  const hips = recursiveHipsLookup(mixamoScene)
  const hipsPositionScale = hips.scale.y

  for (let i = 0; i < clip.tracks.length; i++) {
    const track = clip.tracks[i]
    const trackSplitted = track.name.split('.')
    const rigNodeName = trackSplitted[0]
    const rigNode = mixamoScene.getObjectByName(rigNodeName)

    mixamoScene.updateWorldMatrix(true, true)

    // Store rotations of rest-pose
    rigNode.getWorldQuaternion(restRotationInverse).invert()
    rigNode.parent.getWorldQuaternion(parentRestWorldRotation)

    if (track instanceof QuaternionKeyframeTrack) {
      // Retarget rotation of mixamoRig to NormalizedBone
      for (let i = 0; i < track.values.length; i += 4) {
        const flatQuaternion = track.values.slice(i, i + 4)
        _quatA.fromArray(flatQuaternion)
        _quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse)
        _quatA.toArray(flatQuaternion)
        flatQuaternion.forEach((v, index) => {
          track.values[index + i] = v
        })
      }
    } else if (track instanceof VectorKeyframeTrack) {
      const value = track.values.map((v) => v * hipsPositionScale)
      value.forEach((v, index) => {
        track.values[index] = v
      })
    }
  }

  return clip
}

///
/// Given an animation clip, bind it to a vrm rig
///

export const bindAnimationClipFromMixamo = (clip, vrm, scene) => {
  const tracks = []
  for (let i = 0; i < clip.tracks.length; i++) {
    const trackClone = clip.tracks[i].clone()
    const trackSplitted = trackClone.name.split('.')
    const mixamoRigName = trackSplitted[0]
    const vrmBoneName = mixamoVRMRigMap[mixamoRigName]
    const vrmNode = vrm.humanoid.getNormalizedBoneNode(vrmBoneName)
    if (vrmNode && vrmNode.name && vrmNode.name.length) {
      const propertyName = trackSplitted[1]
      trackClone.name = `${vrmNode.name}.${propertyName}`
      tracks.push(trackClone)
    }
  }
  return new AnimationClip(clip.name, clip.duration, tracks)
}

export async function test_load(vrm, url, dur=10, ndx=0, scale=1) {

  let armature = vrm.humanoid.normalizedHumanBonesRoot
  if(!armature) alert("no armature")

  const loader = new FBXLoader();
  let fbx = await loader.loadAsync( url );
  if(!fbx || !fbx.animations || !fbx.animations[ndx]) return

  retargetAnimationClip(fbx,ndx)

  let clip = bindAnimationClipFromMixamo(fbx.animations[ndx], vrm, armature)

// test play

  let mixer = new THREE.AnimationMixer(armature)

  const action = mixer.clipAction(clip)

  //action.clampWhenFinished = true

  action.play()

  setInterval( ()=> {

    mixer.update(1)

    armature.children[0].position.x = 0
    armature.children[0].position.y = 1
    armature.children[0].position.z = 0

    vrm.update(1)

  },30)

}

/*

function _unused() {

  // rename avatar parts to rpm
  Object.entries(RPMToReallusion).forEach( ([k,v]) => {
    let o = avatar.getObjectByName(v)
    o.name = k
    console.log("renamed rig part from",v,"to",k)
  })


  // strip the term mixamo from animations
  anim.tracks.forEach( t => {
    t.name = t.name.replaceAll('mixamorig','');
    console.log("anim track body part found with name",t.name)
  })

  // find hips
  const hips = mixamoScene.getObjectByName('Hips') // or pelvis
  if(!hips) alert("no hips")

  // set scale
  // const hipsPositionScale = 1 // hips.parent.scale.y

}

*/

const mixamoVRMRigMap = {
  mixamorigHips: 'hips',
  mixamorigSpine: 'spine',
  mixamorigSpine1: 'chest',
  mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck',
  mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder',
  mixamorigLeftArm: 'leftUpperArm',
  mixamorigLeftForeArm: 'leftLowerArm',
  mixamorigLeftHand: 'leftHand',
  mixamorigLeftHandThumb1: 'leftThumbMetacarpal',
  mixamorigLeftHandThumb2: 'leftThumbProximal',
  mixamorigLeftHandThumb3: 'leftThumbDistal',
  mixamorigLeftHandIndex1: 'leftIndexProximal',
  mixamorigLeftHandIndex2: 'leftIndexIntermediate',
  mixamorigLeftHandIndex3: 'leftIndexDistal',
  mixamorigLeftHandMiddle1: 'leftMiddleProximal',
  mixamorigLeftHandMiddle2: 'leftMiddleIntermediate',
  mixamorigLeftHandMiddle3: 'leftMiddleDistal',
  mixamorigLeftHandRing1: 'leftRingProximal',
  mixamorigLeftHandRing2: 'leftRingIntermediate',
  mixamorigLeftHandRing3: 'leftRingDistal',
  mixamorigLeftHandPinky1: 'leftLittleProximal',
  mixamorigLeftHandPinky2: 'leftLittleIntermediate',
  mixamorigLeftHandPinky3: 'leftLittleDistal',
  mixamorigRightShoulder: 'rightShoulder',
  mixamorigRightArm: 'rightUpperArm',
  mixamorigRightForeArm: 'rightLowerArm',
  mixamorigRightHand: 'rightHand',
  mixamorigRightHandPinky1: 'rightLittleProximal',
  mixamorigRightHandPinky2: 'rightLittleIntermediate',
  mixamorigRightHandPinky3: 'rightLittleDistal',
  mixamorigRightHandRing1: 'rightRingProximal',
  mixamorigRightHandRing2: 'rightRingIntermediate',
  mixamorigRightHandRing3: 'rightRingDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal',
  mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
  mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandIndex1: 'rightIndexProximal',
  mixamorigRightHandIndex2: 'rightIndexIntermediate',
  mixamorigRightHandIndex3: 'rightIndexDistal',
  mixamorigRightHandThumb1: 'rightThumbMetacarpal',
  mixamorigRightHandThumb2: 'rightThumbProximal',
  mixamorigRightHandThumb3: 'rightThumbDistal',
  mixamorigLeftUpLeg: 'leftUpperLeg',
  mixamorigLeftLeg: 'leftLowerLeg',
  mixamorigLeftFoot: 'leftFoot',
  mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg',
  mixamorigRightLeg: 'rightLowerLeg',
  mixamorigRightFoot: 'rightFoot',
  mixamorigRightToeBase: 'rightToes'
}

///
/// RPM to Reallusion parts
///

export const RPMtoReallusion = {

  "Armature" : "Armature",
  "Hips" : "CC_Base_Pelvis",
  "Spine" : "CC_Base_Spine01",
  "Spine1" : "CC_Base_Spine02",
  "Spine2" : "CC_Base_NeckTwist01",
  "Neck" : "CC_Base_NeckTwist02",
  "Head" : "CC_Base_Head",

  "LeftShoulder" : "CC_Base_L_Clavicle",
  "LeftArm" : "CC_Base_L_Upperarm",
  "LeftForeArm" : "CC_Base_L_Forearm",
  "LeftHand" : "CC_Base_L_Hand",
  "LeftHandThumb1" : "CC_Base_L_Thumb1",
  "LeftHandThumb2" : "CC_Base_L_Thumb2",
  "LeftHandThumb3" : "CC_Base_L_Thumb3",
  "LeftHandIndex1" : "CC_Base_L_Index1",
  "LeftHandIndex2" : "CC_Base_L_Index2",
  "LeftHandIndex3" : "CC_Base_L_Index3",
  "LeftHandMiddle1" : "CC_Base_L_Mid1",
  "LeftHandMiddle2" : "CC_Base_L_Mid2",
  "LeftHandMiddle3" : "CC_Base_L_Mid3",
  "LeftHandRing1" : "CC_Base_L_Ring1",
  "LeftHandRing2" : "CC_Base_L_Ring2",
  "LeftHandRing3" : "CC_Base_L_Ring3",
  "LeftHandPinky1" : "CC_Base_L_Pinky1",
  "LeftHandPinky2" : "CC_Base_L_Pinky2",
  "LeftHandPinky3" : "CC_Base_L_Pinky3",

  "RightShoulder" : "CC_Base_R_Clavicle",
  "RightArm" : "CC_Base_R_Upperarm",
  "RightForeArm" : "CC_Base_R_Forearm",
  "RightHand" : "CC_Base_R_Hand",
  "RightHandThumb1" : "CC_Base_R_Thumb1",
  "RightHandThumb2" : "CC_Base_R_Thumb2",
  "RightHandThumb3" : "CC_Base_R_Thumb3",
  "RightHandIndex1" : "CC_Base_R_Index1",
  "RightHandIndex2" : "CC_Base_R_Index2",
  "RightHandIndex3" : "CC_Base_R_Index3",
  "RightHandMiddle1" : "CC_Base_R_Mid1",
  "RightHandMiddle2" : "CC_Base_R_Mid2",
  "RightHandMiddle3" : "CC_Base_R_Mid3",
  "RightHandRing1" : "CC_Base_R_Ring1",
  "RightHandRing2" : "CC_Base_R_Ring2",
  "RightHandRing3" : "CC_Base_R_Ring3",
  "RightHandPinky1" : "CC_Base_R_Pinky1",
  "RightHandPinky2" : "CC_Base_R_Pinky2",
  "RightHandPinky3" : "CC_Base_R_Pinky3",

  "LeftUpLeg" : "CC_Base_L_Thigh",
  "LeftLeg" : "CC_Base_L_Calf",
  "LeftFoot" : "CC_Base_L_Foot",
  "LeftToeBase" : "CC_Base_L_ToeBase",

  "RightUpLeg" : "CC_Base_R_Thigh",
  "RightLeg" : "CC_Base_R_Calf",
  "RightFoot" : "CC_Base_R_Foot",
  "RightToeBase" : "CC_Base_R_ToeBase",

  "LeftEye": "CC_Base_L_Eye",
  "RightEye": "CC_Base_R_Eye",
  // CC_Base_JawRoot, CC_Base_UpperJaw, CC_Base_Teeth01, CC_Base_Tongue01
}


///
/// https://www.aicgworld.com/qinweining/cc_blender_tools/-/blob/c0d8d25e972bd3006feb763b9557072402ac5391/rigify_mapping_data.py
///

export const VRMHumanBoneList = {
//    'RL_BoneRoot' : 'Armature',
  'hips' : 'Hips',
  'spine' : 'Spine',
  'chest' : 'Spine1',
  'upperChest' : 'Spine2',
  'neck' : 'Neck',
  'head' : 'Head',
  'leftEye' : 'LeftEye',
  'rightEye' : 'RightEye',
//    'jaw' : null,
  'leftUpperLeg' : 'LeftUpLeg',
  'leftLowerLeg' : 'LeftLeg',
  'leftFoot' : 'LeftFoot',
  'leftToes' : 'LeftToeBase',
  'rightUpperLeg' : 'RightUpLeg',
  'rightLowerLeg' : 'RightLeg',
  'rightFoot' : 'RightFoot',
  'rightToes' : 'RightToeBase',
  'leftShoulder' : 'LeftShoulder',
  'leftUpperArm' : 'LeftArm',
  'leftLowerArm' : 'LeftForeArm',
  'leftHand' : 'LeftHand',
  'rightShoulder' : 'RightShoulder',
  'rightUpperArm' : 'RightArm',
  'rightLowerArm' : 'RightForeArm',
  'rightHand' : 'RightHand',
  'leftThumbMetacarpal' : 'LeftHandThumb1',
  'leftThumbProximal' : 'LeftHandThumb2',
  'leftThumbDistal' : 'LeftHandThumb3',
  'leftIndexProximal' : 'LeftHandIndex1',
  'leftIndexIntermediate' : 'LeftHandIndex2',
  'leftIndexDistal' : 'LeftHandIndex3',
  'leftMiddleProximal' : 'LeftHandMiddle1',
  'leftMiddleIntermediate' : 'LeftHandMiddle2',
  'leftMiddleDistal' : 'LeftHandMiddle3',
  'leftRingProximal' : 'LeftHandRing1',
  'leftRingIntermediate' : 'LeftHandRing2' ,
  'leftRingDistal' : 'LeftHandRing3',
  'leftLittleProximal' : 'LeftHandPinky1',
  'leftLittleIntermediate' : 'LeftHandPinky2',
  'leftLittleDistal' : 'LeftHandPinky3',
  'rightThumbMetacarpal' : 'RightHandThumb1',
  'rightThumbProximal' : 'RightHandThumb2',
  'rightThumbDistal' : 'RightHandThumb3',
  'rightIndexProximal' : 'RightHandIndex1',
  'rightIndexIntermediate' : 'RightHandIndex2',
  'rightIndexDistal' : 'RightHandIndex3',
  'rightMiddleProximal' : 'RightHandMiddle1',
  'rightMiddleIntermediate' : 'RightHandMiddle2',
  'rightMiddleDistal' : 'RightHandMiddle3',
  'rightRingProximal' : 'RightHandRing1',
  'rightRingIntermediate' : 'RightHandRing2' ,
  'rightRingDistal' : 'RightHandRing3',
  'rightLittleProximal' : 'RightHandPinky1',
  'rightLittleIntermediate' : 'RightHandPinky2',
  'rightLittleDistal' : 'RightHandPinky3',
}

export const MorphTargetDictionaryMixamo = {
  "viseme_sil": 0,
  "viseme_PP": 1,
  "viseme_FF": 2,
  "viseme_TH": 3,
  "viseme_DD": 4,
  "viseme_kk": 5,
  "viseme_CH": 6,
  "viseme_SS": 7,
  "viseme_nn": 8,
  "viseme_RR": 9,
  "viseme_aa": 10,
  "viseme_E": 11,
  "viseme_I": 12,
  "viseme_O": 13,
  "viseme_U": 14,
  "browDownLeft": 15,
  "browDownRight": 16,
  "browInnerUp": 17,
  "browOuterUpLeft": 18,
  "browOuterUpRight": 19,
  "eyeSquintLeft": 20,
  "eyeSquintRight": 21,
  "eyeWideLeft": 22,
  "eyeWideRight": 23,
  "jawForward": 24,
  "jawLeft": 25,
  "jawRight": 26,
  "mouthFrownLeft": 27,
  "mouthFrownRight": 28,
  "mouthPucker": 29,
  "mouthShrugLower": 30,
  "mouthShrugUpper": 31,
  "noseSneerLeft": 32,
  "noseSneerRight": 33,
  "mouthLowerDownLeft": 34,
  "mouthLowerDownRight": 35,
  "mouthLeft": 36,
  "mouthRight": 37,
  "eyeLookDownLeft": 38,
  "eyeLookDownRight": 39,
  "eyeLookUpLeft": 40,
  "eyeLookUpRight": 41,
  "eyeLookInLeft": 42,
  "eyeLookInRight": 43,
  "eyeLookOutLeft": 44,
  "eyeLookOutRight": 45,
  "cheekPuff": 46,
  "cheekSquintLeft": 47,
  "cheekSquintRight": 48,
  "jawOpen": 49,
  "mouthClose": 50,
  "mouthFunnel": 51,
  "mouthDimpleLeft": 52,
  "mouthDimpleRight": 53,
  "mouthStretchLeft": 54,
  "mouthStretchRight": 55,
  "mouthRollLower": 56,
  "mouthRollUpper": 57,
  "mouthPressLeft": 58,
  "mouthPressRight": 59,
  "mouthUpperUpLeft": 60,
  "mouthUpperUpRight": 61,
  "mouthSmileLeft": 62,
  "mouthSmileRight": 63,
  "tongueOut": 64,
  "eyeBlinkLeft": 65,
  "eyeBlinkRight": 66
}

const MorphTargetDictionaryReallusion_unused = {
  "EE": 0,
  "Er": 1,
  "IH": 2,
  "Ah": 3,
  "Oh": 4,
  "W_OO": 5,
  "S_Z": 6,
  "Ch_J": 7,
  "F_V": 8,
  "TH": 9,
  "T_L_D_N": 10,
  "B_M_P": 11,
  "K_G_H_NG": 12,
  "AE": 13,
  "R": 14,
  "Brow_Raise_Inner_Left": 15,
  "Brow_Raise_Inner_Right": 16,
  "Brow_Raise_Outer_Left": 17,
  "Brow_Raise_Outer_Right": 18,
  "Brow_Drop_Left": 19,
  "Brow_Drop_Right": 20,
  "Brow_Raise_Left": 21,
  "Brow_Raise_Right": 22,
  "Eyes_Blink": 23,
  "Eye_Blink_L": 24,
  "Eye_Blink_R": 25,
  "Eye_Wide_L": 26,
  "Eye_Wide_R": 27,
  "Eye_Squint_L": 28,
  "Eye_Squint_R": 29,
  "Nose_Scrunch": 30,
  "Nose_Flanks_Raise": 31,
  "Nose_Flank_Raise_L": 32,
  "Nose_Flank_Raise_R": 33,
  "Nose_Nostrils_Flare": 34,
  "Cheek_Raise_L": 35,
  "Cheek_Raise_R": 36,
  "Cheeks_Suck": 37,
  "Cheek_Blow_L": 38,
  "Cheek_Blow_R": 39,
  "Mouth_Smile": 40,
  "Mouth_Smile_L": 41,
  "Mouth_Smile_R": 42,
  "Mouth_Frown": 43,
  "Mouth_Frown_L": 44,
  "Mouth_Frown_R": 45,
  "Mouth_Blow": 46,
  "Mouth_Pucker": 47,
  "Mouth_Pucker_Open": 48,
  "Mouth_Widen": 49,
  "Mouth_Widen_Sides": 50,
  "Mouth_Dimple_L": 51,
  "Mouth_Dimple_R": 52,
  "Mouth_Plosive": 53,
  "Mouth_Lips_Tight": 54,
  "Mouth_Lips_Tuck": 55,
  "Mouth_Lips_Open": 56,
  "Mouth_Lips_Part": 57,
  "Mouth_Bottom_Lip_Down": 58,
  "Mouth_Top_Lip_Up": 59,
  "Mouth_Top_Lip_Under": 60,
  "Mouth_Bottom_Lip_Under": 61,
  "Mouth_Snarl_Upper_L": 62,
  "Mouth_Snarl_Upper_R": 63,
  "Mouth_Snarl_Lower_L": 64,
  "Mouth_Snarl_Lower_R": 65,
  "Mouth_Bottom_Lip_Bite": 66,
  "Mouth_Down": 67,
  "Mouth_Up": 68,
  "Mouth_L": 69,
  "Mouth_R": 70,
  "Mouth_Lips_Jaw_Adjust": 71,
  "Mouth_Bottom_Lip_Trans": 72,
  "Mouth_Skewer": 73,
  "Mouth_Open": 74
}

//
// retargeting rpm to reallusion - unused
//

export const MorphTargetsToReallusion = {

  //viseme_sil: undefined
  viseme_PP: 'B_M_P',
  viseme_FF: 'F_V',
  viseme_TH: 'TH',
  viseme_DD: 'T_L_D_N',
  viseme_kk: 'K_G_H_NG',
  viseme_CH: 'Ch_J',
  viseme_SS: 'S_Z',
  viseme_nn: 'T_L_D_N',
  viseme_RR: 'R',
  viseme_aa: 'Ah',
  viseme_E: 'EE',
  viseme_I: 'IH',
  viseme_O: 'Oh',
  viseme_U: 'W_OO',

  // undefined:AE
  // undefined:Er

  browDownLeft:'Brow_Drop_Left',
  browDownRight:'Brow_Drop_Right',

//    browInnerUp: [ 'Brow_Raise_Inner_Left', 'Brow_Raise_Inner_Right' ],

  browOuterUpLeft:'Brow_Raise_Outer_Left',
  browOuterUpRight:'Brow_Raise_Outer_Right',

  // : 'Brow_Raise_Left',
  // : 'Brow_Raise_Right',

//    cheekPuff: [ 'Cheek_Blow_L', 'Cheek_Blow_R' ],
  cheekSquintLeft:'Cheek_Raise_L',
  cheekSquintRight:'Cheek_Raise_R',

  // : Cheeks_Suck,

  eyeBlinkLeft:'Eye_Blink_L',
  eyeBlinkRight:'Eye_Blink_R',
  eyeSquintLeft:'Eye_Squint_L',
  eyeSquintRight:'Eye_Squint_R',
  eyeWideLeft:'Eye_Wide_L',
  eyeWideRight:'Eye_Wide_R',

  //eyeLookDownLeft: undefined,
  //eyeLookDownRight: undefined,
  //eyeLookInLeft: undefined,
  //eyeLookInRight: undefined,
  //eyeLookOutLeft: undefined,
  //eyeLookOutRight: undefined,
  //eyeLookUpLeft: undefined,
  //eyeLookUpRight: undefined,

  // : 'Eyes_Blink',

  // eyesClosed: undefined,
  // eyesLookUp: undefined,
  // eyesLookDown: undefined,

//    eyesLookDown: [ 'eyeLookDownLeft', 'eyeLookDownRight' ] // convenience concept
//    eyesLookUp: [ 'eyeLookUpLeft', 'eyeLookUpRight' ] // convenience concept

  //jawForward:undefined,
  //jawLeft:undefined,
  //jawOpen:undefined,
  //jawRight:undefined,

  // mouthClose: undefined,

  // : Mouth_Blow
  // : Mouth_Bottom_Lip_Bite
  // : Mouth_Bottom_Lip_Down
  // : Mouth_Bottom_Lip_Trans
  mouthRollLower:'Mouth_Bottom_Lip_Under',
  mouthDimpleLeft:'Mouth_Dimple_L',
  mouthDimpleRight:'Mouth_Dimple_R',
  // : Mouth_Down
  mouthFrownLeft:'Mouth_Frown_L',
  mouthFrownRight:'Mouth_Frown_R',
  mouthLeft: 'Mouth_L',
  // : Mouth_Lips_Jaw_Adjust
  // : Mouth_Lips_Open
  // : Mouth_Lips_Part
  // : Mouth_Lips_Tight
  // : Mouth_Lips_Tuck
  mouthOpen:'Mouth_Open',
  //Mouth_Plosive
  mouthPucker:'Mouth_Pucker',
  mouthFunnel:'Mouth_Pucker_Open',
  mouthRight: 'Mouth_R',
  // : Mouth_Skewer

  // mouthSmile:'Mouth_Smile',
  mouthSmile: 'Mouth_Smile', //[ 'mouthSmileLeft', 'mouthSmileRight' ],

  mouthSmileLeft:'Mouth_Smile_L',
  mouthSmileRight:'Mouth_Smile_R',
  // : Mouth_Snarl_Lower_L
  // : Mouth_Snarl_Lower_R
  // : Mouth_Snarl_Upper_L
  // : Mouth_Snarl_Upper_R
  mouthRollUpper:'Mouth_Top_Lip_Under',
  // : 'Mouth_Top_Lip_Up'
  //Mouth_Up
  //Mouth_Widen
  mouthStretchLeft: 'Mouth_Widen_Sides',
  mouthStretchRight: 'Mouth_Widen_Sides',

  // mouthShrugLower :
  // mouthShrugUpper :
  // mouthPressLeft :
  // mouthPressRight :
  // mouthLowerDownLeft :
  // mouthLowerDownRight :
  // mouthUpperUpLeft :
  // mouthUpperUpRight :


  noseSneerLeft: 'Nose_Flank_Raise_L',
  noseSneerRight: 'Nose_Flank_Raise_R',
  // undefined:'Nose_Flanks_Raise',
  // undefined:'Nose_Nostrils_Flare',
  // undefined:'Nose_Scrunch',

  // tongueOut: undefined,

  // handFistLeft, handFistRight ...
}


const tpose_unrolled_test_unused = {
'Hips.quaternion':[0.09792859107255936,0.001306271879002452,0.0001284585741814226,0.9951925873756409],
'Spine.quaternion':[-0.12806788086891174,-0.0016982615925371647,-0.00023400648206006736,0.9917639493942261],
'Spine1.quaternion':[-0.044332507997751236,-0.000623944157268852,0.000022844345949124545,0.9990167021751404],
'Spine2.quaternion':[0.07903598248958588,0.003536477219313383,-0.011312729679048061,0.9968013167381287],
'Neck.quaternion':[0.00017596194811630994,0.0002615417179185897,-0.00013205579307395965,0.9999999403953552],
'Head.quaternion':[-0.023198887705802917,-0.0021093562245368958,0.017612233757972717,0.9995734691619873],
'LeftShoulder.quaternion':[-0.015538172796368599,0.14907076954841614,-0.697613000869751,0.7006229758262634],
'LeftArm.quaternion':[0.11552339047193527,-0.000046731762267882004,0.009483744390308857,0.9932594895362854],
'LeftForeArm.quaternion':[0.0005795539473183453,0.00003538788587320596,-0.00041657971451058984,0.9999997615814209],
'LeftHand.quaternion':[-0.01996447890996933,-0.0001293131208512932,0.007032217923551798,0.9997759461402893],
'LeftHandThumb1.quaternion':[0.4054112434387207,-0.12043875455856323,-0.06455682963132858,0.9038631916046143],
'LeftHandThumb2.quaternion':[-0.16522924602031708,-0.0012049793731421232,0.049675583839416504,0.9850026369094849],
'LeftHandThumb3.quaternion':[-0.012071959674358368,0.0009731743484735489,0.013225692324340343,0.999839186668396],
'LeftHandIndex1.quaternion':[0.02244596555829048,-0.003465381683781743,-0.01645444519817829,0.9996066689491272],
'LeftHandIndex2.quaternion':[0.0021464203018695116,0.005251145455986261,0.0002842821413651109,0.9999838471412659],
'LeftHandIndex3.quaternion':[0.0011441672686487436,-0.000030784663977101445,-0.0019936251919716597,0.9999973773956299],
'LeftHandMiddle1.quaternion':[0.021468637511134148,-0.0028365449979901314,-0.01627201773226261,0.9996330738067627],
'LeftHandMiddle2.quaternion':[-0.0019502801587805152,0.0034783969167619944,-0.0005337352631613612,0.9999918937683105],
'LeftHandMiddle3.quaternion':[0.0007875862065702677,0.00011852262105094269,-0.00042835131171159446,0.9999995827674866],
'LeftHandRing1.quaternion':[0.012555304914712906,0.0005830476875416934,-0.014943023212254047,0.9998093843460083],
'LeftHandRing2.quaternion':[-0.0043052202090620995,-0.00013033300638198853,-0.0003933236876036972,0.9999906420707703],
'LeftHandRing3.quaternion':[0.001509505440481007,-0.00017994926020037383,-0.002950466237962246,0.9999945163726807],
'LeftHandPinky1.quaternion':[0.016440432518720627,0.0003730723401531577,-0.015607529319822788,0.9997429251670837],
'LeftHandPinky2.quaternion':[-0.009020800702273846,-0.0014238611329346895,-0.0005174959660507739,0.9999581575393677],
'LeftHandPinky3.quaternion':[0.0018869680352509022,0.00011883323168149218,-0.02701982855796814,0.9996331334114075],
'RightShoulder.quaternion':[-0.015535208396613598,-0.14906661212444305,0.6976112127304077,0.7006257176399231],
'RightArm.quaternion':[0.11561179161071777,0.00006332265184028074,-0.009478137828409672,0.9932492971420288],
'RightForeArm.quaternion':[0.0004296037368476391,-0.00006041684537194669,0.00042241415940225124,0.9999998211860657],
'RightHand.quaternion':[-0.019903019070625305,0.00013601267710328102,-0.007031635381281376,0.9997771978378296],
'RightHandThumb1.quaternion':[0.40541785955429077,0.12042885273694992,0.06456274539232254,0.9038611054420471],
'RightHandThumb2.quaternion':[-0.16523577272891998,0.0012099127052351832,-0.04968990013003349,0.9850008487701416],
'RightHandThumb3.quaternion':[-0.012070002034306526,-0.0009753474732860923,-0.013229675590991974,0.999839186668396],
'RightHandIndex1.quaternion':[0.022436344996094704,0.0034683048725128174,0.016331486403942108,0.9996088743209839],
'RightHandIndex2.quaternion':[0.002166497055441141,-0.005251413211226463,-0.000057750123232835904,0.9999838471412659],
'RightHandIndex3.quaternion':[0.0011348003754392266,0.00002918365498771891,0.0018833481008186936,0.999997615814209],
'RightHandMiddle1.quaternion':[0.021479057148098946,0.002833541249856353,0.01642601564526558,0.999630331993103],
'RightHandMiddle2.quaternion':[-0.0019859320018440485,-0.0034979400224983692,0.00011893710325239226,0.9999918937683105],
'RightHandMiddle3.quaternion':[0.000803005532361567,-0.00009753597259987146,0.0006409742054529488,0.999999463558197],
'RightHandRing1.quaternion':[0.012549595907330513,-0.0005808522691950202,0.014927737414836884,0.9998096823692322],
'RightHandRing2.quaternion':[-0.004273679573088884,0.00013019111065659672,0.00039895239751785994,0.9999907612800598],
'RightHandRing3.quaternion':[0.0014827807899564505,0.0001988090225495398,0.002969068009406328,0.9999945163726807],
'RightHandPinky1.quaternion':[0.016410551965236664,-0.0003745660069398582,0.015485775656998158,0.9997453689575195],
'RightHandPinky2.quaternion':[-0.008990637958049774,0.0014234984992071986,0.0006354368524625897,0.9999583959579468],
'RightHandPinky3.quaternion':[0.0018750489689409733,-0.0001197460587718524,0.026924053207039833,0.9996357560157776],
'LeftUpLeg.quaternion':[-0.006291483994573355,0.11026627570390701,0.9936746954917908,0.0203053280711174],
'LeftLeg.quaternion':[-0.05479045584797859,0.0011512936325743794,0.02950183115899563,0.9980612993240356],
'LeftFoot.quaternion':[0.515064537525177,-0.026295017451047897,-0.018650734797120094,0.8565449714660645],
'LeftToeBase.quaternion':[0.18135808408260345,0.02667681686580181,-0.02909471094608307,0.9826245903968811],
'RightUpLeg.quaternion':[0.0011171801015734673,-0.08609417825937271,-0.9961332678794861,0.01746796816587448],
'RightLeg.quaternion':[-0.005953759886324406,0.00029527960577979684,0.014726288616657257,0.9998738169670105],
'RightFoot.quaternion':[0.49610623717308044,0.04109374061226845,-0.029359668493270874,0.8667917847633362],
'RightToeBase.quaternion':[0.17133839428424835,-0.025751864537596703,0.03280844911932945,0.9843290448188782],

}


