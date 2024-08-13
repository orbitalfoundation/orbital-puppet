//
// convenience helper for retargeting visemes so that rpm animations can be played on reallusion rigs
//
// @note this may be deprecated and users would then have to do this work in blender with a python script
//

export const RPMFace2Reallusion = {

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
	browInnerUp: [ 'Brow_Raise_Inner_Left', 'Brow_Raise_Inner_Right' ],
	browOuterUpLeft:'Brow_Raise_Outer_Left',
	browOuterUpRight:'Brow_Raise_Outer_Right',

	// : 'Brow_Raise_Left',
	// : 'Brow_Raise_Right',

	cheekPuff: [ 'Cheek_Blow_L', 'Cheek_Blow_R' ],
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

	eyesClosed:[ 'Eye_Blink_L', 'Eye_Blink_R' ],

	// eyesLookUp: undefined,
	// eyesLookDown: undefined,

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
	mouthSmile: [ 'Mouth_Smile_L', 'Mouth_Smile_R' ], // works for both rpm and reallusion

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

}
