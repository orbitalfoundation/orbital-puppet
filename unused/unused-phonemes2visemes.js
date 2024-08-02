
export const visemes_realusion = {
	0: "None",
	1: "B_M_P",
	2: "F_V",
	3: "TH",
	4: "T_L_D_N",
	5: "K_G_H_NG",
	6: "Ch_J",
	7: "S_Z",
	8: "T_L_D_N",
	9: "R",
	10: "Ah",
	11: "EE",
	12: "IH",
	13: "Oh",
	14: "W_OO",
}

export const visemes_rpm = [
	"sil",
	"PP",
	"FF",
	"TH",
	"DD",
	"kk",
	"CH",
	"SS",
	"nn",
	"RR",
	"aa",
	"E",
	"I",
	"O",
	"U"
]

// A raw mapping of phonemes to visemes
export const phonemeToVisemeMap_RPM = {

	// Consonants
	b: 1,
	d: 4,
	d͡ʒ: 6,
	ð: 3,
	f: 2,
	ɡ: 5,
	h: 5, // ??? no mapping in pdf
	j: 12, // ??? recheck
	k: 5,
	l: 8,
	m: 1,
	n: 8,
	ŋ: 5, // ???
	p: 1,
	ɹ: 9,
	s: 7,
	ʃ: 6,
	t: 4,
	t͡ʃ: 6,
	θ: 3,
	v: 2,
	w: 14,
	z: 7,
	ʒ: 6,

	// Vowels
	ə: 11,
	ɚ: 11,
	æ: 10,
	aɪ: 10,
	aʊ: 10,
	ɑ: 10,
	eɪ: 11,
	ɝ: 11,
	ɛ: 11,
	i: 12,
	ɪ: 12,
	oʊ: 13,
	ɔ: 13,
	ɔɪ: 13,
	u: 14,
	ʊ: 14,
	ʌ: 11,

	// Additional Symbols
	ˈ: null,
	ˌ: null,
	'.': null,
}

// A raw mapping of phonemes to visemes except for reallusion
export const phonemeToVisemeMap_Reallusion = {

	// Consonants
	b: 1,
	d: 4,
	d͡ʒ: 6,
	ð: 3,
	f: 2,
	ɡ: 5,
	h: 5, // ??? no mapping in pdf
	j: 12, // ??? recheck
	k: 5,
	l: 8,
	m: 1,
	n: 8,
	ŋ: 5, // ???
	p: 1,
	ɹ: 9,
	s: 7,
	ʃ: 6,
	t: 4,
	t͡ʃ: 6,
	θ: 3,
	v: 2,
	w: 14,
	z: 7,
	ʒ: 6,

	// Vowels
	ə: 11,
	ɚ: 11,
	æ: 10,
	aɪ: 10,
	aʊ: 10,
	ɑ: 10,
	eɪ: 11,
	ɝ: 11,
	ɛ: 11,
	i: 12,
	ɪ: 12,
	oʊ: 13,
	ɔ: 13,
	ɔɪ: 13,
	u: 14,
	ʊ: 14,
	ʌ: 11,

	// Additional Symbols
	ˈ: null,
	ˌ: null,
	'.': null,
}

// The above have to be remapped between oculus and realusion
//
// According to:
// https://manual.reallusion.com/Character-Creator-4/Content/ENU/4.0/06-Facial-Profile-Editor/8_7_and_1_1.htm
// These differ from:
// https://developer.oculus.com/documentation/unity/audio-ovrlipsync-viseme-reference/
//
// "Each character for iClone presents 15 visemes (lip shapes) when it talks.
//		AE
//		Ah
//		B_M_P
//		Ch_J
//		EE
//		Er
//		F_V,
//		Ih
//		K_G_H_NG
//		Oh
//		R
//		S_Z
//		T_L_D_N
//		Th
//		W_OO
//
// Above they are shown alphabetically but they are indexed in a different order in memory.
// We remap these for convenience below:
//

const remap = [
-1, // "sil", "None"
11, // "PP" , "B_M_P"
 8, // "FF" , "F_V"
 9, // "TH" , "TH"
10, // "DD" , "T_L_D_N"
12, // "kk" , "K_G_H_NG"
 7, // "CH" , "Ch_J"
 6, // "SS" , "S_Z"
10, // "nn" , "T_L_D_N"
14, // "RR" , "R"
 3, // "aa" , "Ah"
 0, // "EE" , "EE" - or AE -> 13 is not used (AE) @todo
 2, // "I"  , "IH"
 4, // "O"  , "Oh"
 5, // "U"  , "W_OO"
]

Object.entries(phonemeToVisemeMap_Reallusion).forEach( ([k,v])=>{
	if(!v) return
	//console.log(k,v)
	phonemeToVisemeMap_Reallusion[k] = remap[v]
})

///
/// Given phonemes over a timeline and a given point in that timeline, calculate the visemes for that point in time
///
/// Accepts an array of phonemes where each phoneme is something like { phoneme:'a', offset: 123 }
/// Returns an exact placement for visemes at that time as an array of 15 ordered viseme amplitudes
///
/// Time is in milliseconds
///

export function phonemesToVisemesAtTime(phonemes,time,duration, useRPM = true ) {

	const map = useRPM ? phonemeToVisemeMap_RPM : phonemeToVisemeMap_Reallusion

	// in milliseconds how long is a viseme relevant?
	const RELEVANT = 200
	let visemeData = Array(visemes_rpm.length).fill(0)

	for(let i = 0; i < phonemes.length; i++) {

		const elem = phonemes[i]
		const start = elem.offset
		const duration = i < phonemes.length - 1 ? phonemes[i+1].offset - elem.offset : RELEVANT

		// current playback time is examining an area prior to this and following elements so get out now
		if(time + RELEVANT < start) {
			return visemeData
		}

		// current time is later than this element so keep looping
		if(time - RELEVANT > start + duration) {
			continue
		}

		// estimate degree of effect
		const phoneme = elem.text[0] || ' '
		const code = map[phoneme] || 0
		if(!code) continue // never bother setting viseme_SIL ever
		const viseme = visemes_rpm[code]
		let degree = viseme === 'PP' || viseme === 'FF' ? 0.9 : 0.6

		if(time >= start && time <= start+duration) {
			// use as is
		}
		else if(time > start+duration) {
			degree *= Math.pow((start+duration+RELEVANT-time) / RELEVANT,3)
		}
		else if(time < start) {
			degree *= Math.pow((RELEVANT-start+time) / RELEVANT,3)
		}
		
		visemeData[code] = degree
	}

	return visemeData
}
