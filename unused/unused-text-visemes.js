///
/// Turn english prose into visemes over time - this is a selection of code from talking heads and is not used
///
/// Modified from:
///
/// @class English lip-sync processor
/// @author Mika Suominen
///

// Viseme durations in relative unit - not in milliseconds or seconds! (1=average)
// @todo these need to be examined for english (they are from the finnish talking heads example)
export const viseme_durations_rpm = {
	'sil': 1,
	'PP': 1,
	'FF': 1.1,
	'TH': 0.8,
	'DD': 0.9,
	'kk': 0.8,
	'CH': 0.8,
	'SS': 1.3,
	'nn': 0.9,
	'RR': 1,
	'aa': 1.3,
	'E': 1.1,
	'I': 0.9,
	'O': 1.1,
	'U': 0.9,
}

// Pauses in relative units (1=average)
export const otherDurations = { ' ': 1, ',': 3, '-':0.5 };

//
// English words to Oculus visemes, algorithmic rules adapted from:
//   NRL Report 7948, "Automatic Translation of English Text to Phonetics by Means of Letter-to-Sound Rules" (1976)
//   by HONEY SUE EL.OVITZ, RODNEY W. JOHNSON, ASTRID McHUGH, AND JOHN E. SHORE
//   Available at: https://apps.dtic.mil/sti/pdfs/ADA021929.pdf
//

const rules = {
	'A': [
		"[A] =aa", " [ARE] =aa RR", " [AR]O=aa RR", "[AR]#=E RR",
		" ^[AS]#=E SS", "[A]WA=aa", "[AW]=aa", " :[ANY]=E nn I",
		"[A]^+#=E", "#:[ALLY]=aa nn I", " [AL]#=aa nn", "[AGAIN]=aa kk E nn",
		"#:[AG]E=I kk", "[A]^+:#=aa", ":[A]^+ =E", "[A]^%=E",
		" [ARR]=aa RR", "[ARR]=aa RR", " :[AR] =aa RR", "[AR] =E",
		"[AR]=aa RR", "[AIR]=E RR", "[AI]=E", "[AY]=E", "[AU]=aa",
		"#:[AL] =aa nn", "#:[ALS] =aa nn SS", "[ALK]=aa kk", "[AL]^=aa nn",
		" :[ABLE]=E PP aa nn", "[ABLE]=aa PP aa nn", "[ANG]+=E nn kk", "[A]=aa"
	],

	'B': [
		" [BE]^#=PP I", "[BEING]=PP I I nn", " [BOTH] =PP O TH",
		" [BUS]#=PP I SS", "[BUIL]=PP I nn", "[B]=PP"
	],

	'C': [
		" [CH]^=kk", "^E[CH]=kk", "[CH]=CH", " S[CI]#=SS aa",
		"[CI]A=SS", "[CI]O=SS", "[CI]EN=SS", "[C]+=SS",
		"[CK]=kk", "[COM]%=kk aa PP", "[C]=kk"
	],

	'D': [
		"#:[DED] =DD I DD", ".E[D] =DD", "#^:E[D] =DD", " [DE]^#=DD I",
		" [DO] =DD U", " [DOES]=DD aa SS", " [DOING]=DD U I nn",
		" [DOW]=DD aa", "[DU]A=kk U", "[D]=DD"
	],

	'E': [
		"#:[E] =", "'^:[E] =", " :[E] =I", "#[ED] =DD", "#:[E]D =",
		"[EV]ER=E FF", "[E]^%=I", "[ERI]#=I RR I", "[ERI]=E RR I",
		"#:[ER]#=E", "[ER]#=E RR", "[ER]=E", " [EVEN]=I FF E nn",
		"#:[E]W=", "@[EW]=U", "[EW]=I U", "[E]O=I", "#:&[ES] =I SS",
		"#:[E]S =", "#:[ELY] =nn I", "#:[EMENT]=PP E nn DD", "[EFUL]=FF U nn",
		"[EE]=I", "[EARN]=E nn", " [EAR]^=E", "[EAD]=E DD", "#:[EA] =I aa",
		"[EA]SU=E", "[EA]=I", "[EIGH]=E", "[EI]=I", " [EYE]=aa", "[EY]=I",
		"[EU]=I U", "[E]=E"
	],

	'F': [
		"[FUL]=FF U nn", "[F]=FF"
	],

	'G': [
		"[GIV]=kk I FF", " [G]I^=kk", "[GE]T=kk E", "SU[GGES]=kk kk E SS",
		"[GG]=kk", " B#[G]=kk", "[G]+=kk", "[GREAT]=kk RR E DD",
		"#[GH]=", "[G]=kk"
	],

	'H': [
		" [HAV]=I aa FF", " [HERE]=I I RR", " [HOUR]=aa EE", "[HOW]=I aa",
		"[H]#=I", "[H]="
	],

	'I': [
		" [IN]=I nn", " [I] =aa", "[IN]D=aa nn", "[IER]=I E",
		"#:R[IED] =I DD", "[IED] =aa DD", "[IEN]=I E nn", "[IE]T=aa E",
		" :[I]%=aa", "[I]%=I", "[IE]=I", "[I]^+:#=I", "[IR]#=aa RR",
		"[IZ]%=aa SS", "[IS]%=aa SS", "[I]D%=aa", "+^[I]^+=I",
		"[I]T%=aa", "#^:[I]^+=I", "[I]^+=aa", "[IR]=E", "[IGH]=aa",
		"[ILD]=aa nn DD", "[IGN] =aa nn", "[IGN]^=aa nn", "[IGN]%=aa nn",
		"[IQUE]=I kk", "[I]=I"
	],

	'J': [
		"[J]=kk"
	],

	'K': [
		" [K]N=", "[K]=kk"
	],

	'L': [
		"[LO]C#=nn O", "L[L]=", "#^:[L]%=aa nn", "[LEAD]=nn I DD", "[L]=nn"
	],

	'M': [
		"[MOV]=PP U FF", "[M]=PP"
	],

	'N': [
		"E[NG]+=nn kk", "[NG]R=nn kk", "[NG]#=nn kk", "[NGL]%=nn kk aa nn",
		"[NG]=nn", "[NK]=nn kk", " [NOW] =nn aa", "[N]=nn"
	],

	'O': [
		"[OF] =aa FF", "[OROUGH]=E O", "#:[OR] =E", "#:[ORS] =E SS",
		"[OR]=aa RR", " [ONE]=FF aa nn", "[OW]=O", " [OVER]=O FF E",
		"[OV]=aa FF", "[O]^%=O", "[O]^EN=O", "[O]^I#=O", "[OL]D=O nn",
		"[OUGHT]=aa DD", "[OUGH]=aa FF", " [OU]=aa", "H[OU]S#=aa",
		"[OUS]=aa SS", "[OUR]=aa RR", "[OULD]=U DD", "^[OU]^L=aa",
		"[OUP]=U OO", "[OU]=aa", "[OY]=O", "[OING]=O I nn", "[OI]=O",
		"[OOR]=aa RR", "[OOK]=U kk", "[OOD]=U DD", "[OO]=U", "[O]E=O",
		"[O] =O", "[OA]=O", " [ONLY]=O nn nn I", " [ONCE]=FF aa nn SS",
		"[ON'T]=O nn DD", "C[O]N=aa", "[O]NG=aa", " ^:[O]N=aa",
		"I[ON]=aa nn", "#:[ON] =aa nn", "#^[ON]=aa nn", "[O]ST =O",
		"[OF]^=aa FF", "[OTHER]=aa TH E", "[OSS] =aa SS", "#^:[OM]=aa PP",
		"[O]=aa"
	],

	'P': [
		"[PH]=FF", "[PEOP]=PP I PP", "[POW]=PP aa", "[PUT] =PP U DD",
		"[P]=PP"
	],

	'Q': [
		"[QUAR]=kk FF aa RR", "[QU]=kk FF", "[Q]=kk"
	],

	'R': [
		" [RE]^#=RR I", "[R]=RR"
	],

	'S': [
		"[SH]=SS", "#[SION]=SS aa nn", "[SOME]=SS aa PP", "#[SUR]#=SS E",
		"[SUR]#=SS E", "#[SU]#=SS U", "#[SSU]#=SS U", "#[SED] =SS DD",
		"#[S]#=SS", "[SAID]=SS E DD", "^[SION]=SS aa nn", "[S]S=",
		".[S] =SS", "#:.E[S] =SS", "#^:##[S] =SS", "#^:#[S] =SS",
		"U[S] =SS", " :#[S] =SS", " [SCH]=SS kk", "[S]C+=",
		"#[SM]=SS PP", "#[SN]'=SS aa nn", "[S]=SS"
	],

	'T': [
		" [THE] =TH aa", "[TO] =DD U", "[THAT] =TH aa DD", " [THIS] =TH I SS",
		" [THEY]=TH E", " [THERE]=TH E RR", "[THER]=TH E", "[THEIR]=TH E RR",
		" [THAN] =TH aa nn", " [THEM] =TH E PP", "[THESE] =TH I SS",
		" [THEN]=TH E nn", "[THROUGH]=TH RR U", "[THOSE]=TH O SS",
		"[THOUGH] =TH O", " [THUS]=TH aa SS", "[TH]=TH", "#:[TED] =DD I DD",
		"S[TI]#N=CH", "[TI]O=SS", "[TI]A=SS", "[TIEN]=SS aa nn",
		"[TUR]#=CH E", "[TU]A=CH U", " [TWO]=DD U", "[T]=DD"
	],

	'U': [
		" [UN]I=I U nn", " [UN]=aa nn", " [UPON]=aa PP aa nn",
		"@[UR]#=U RR", "[UR]#=I U RR", "[UR]=E", "[U]^ =aa",
		"[U]^^=aa", "[UY]=aa", " G[U]#=", "G[U]%=", "G[U]#=FF",
		"#N[U]=I U", "@[U]=I", "[U]=I U"
	],

	'V': [
		"[VIEW]=FF I U", "[V]=FF"
	],

	'W': [
		" [WERE]=FF E", "[WA]S=FF aa", "[WA]T=FF aa", "[WHERE]=FF E RR",
		"[WHAT]=FF aa DD", "[WHOL]=I O nn", "[WHO]=I U", "[WH]=FF",
		"[WAR]=FF aa RR", "[WOR]^=FF E", "[WR]=RR", "[W]=FF"
	],

	'X': [
		" [X]=SS", "[X]=kk SS"
	],

	'Y': [
		"[YOUNG]=I aa nn", " [YOU]=I U", " [YES]=I E SS", " [Y]=I",
		"#^:[Y] =I", "#^:[Y]I=I", " :[Y] =aa", " :[Y]#=aa",
		" :[Y]^+:#=I", " :[Y]^#=I", "[Y]=I"
	],

	'Z': [
		"[Z]=SS"
	]
}

const ops = {
	'#': '[AEIOUY]+', // One or more vowels AEIOUY
	// This one is not used: "'": '[BCDFGHJKLMNPQRSTVWXZ]+', // One or more consonants BCDFGHJKLMNPQRSTVWXZ
	'.': '[BDVGJLMNRWZ]', // One voiced consonant BDVGJLMNRWZ
	// This one is not used: '$': '[BDVGJLMNRWZ][EI]', // One consonant followed by E or I
	'%': '(?:ER|E|ES|ED|ING|ELY)', // One of ER, E, ES, ED, ING, ELY
	'&': '(?:[SCGZXJ]|CH|SH)', // One of S, C, G, Z, X, J, CH, SH
	'@': '(?:[TSRDLZNJ]|TH|CH|SH)', // One of T, S, R, D, L, Z, N, J, TH, CH, SH
	'^': '[BCDFGHJKLMNPQRSTVWXZ]', // One consonant BCDFGHJKLMNPQRSTVWXZ
	'+': '[EIY]', // One of E, I, Y
	':': '[BCDFGHJKLMNPQRSTVWXZ]*', // Zero or more consonants BCDFGHJKLMNPQRSTVWXZ
	' ': '\\b' // Start/end of the word
}

//
// pre-generate rules - run this immediately now once only
//

Object.keys(rules).forEach( key => {
	rules[key] = rules[key].map( rule => {
		const posL = rule.indexOf('[');
		const posR = rule.indexOf(']');
		const posE = rule.indexOf('=');
		const strLeft = rule.substring(0,posL);
		const strLetters = rule.substring(posL+1,posR);
		const strRight = rule.substring(posR+1,posE);
		const strVisemes = rule.substring(posE+1);

		const o = { regex: '', move: 0, visemes: [] }

		let exp = '';
		exp += [...strLeft].map( x => ops[x] || x ).join('');
		const ctxLetters = [...strLetters];
		ctxLetters[0] = ctxLetters[0].toLowerCase();
		exp += ctxLetters.join('');
		o.move = ctxLetters.length;
		exp += [...strRight].map( x => ops[x] || x ).join('');
		o.regex = new RegExp(exp);

		if ( strVisemes.length ) {
			strVisemes.split(' ').forEach( viseme => {
				o.visemes.push(viseme);
			});
		}

		return o;
	});
})


///
/// This is an approach from the talking heads demo - it accepts text and it returns a list of visemes with time stamps
///
/// Convert a piece of text (a word, sentence, phrase) go directly to Oculus LipSync Visemes start times and durations
/// This approach one of two approaches and is different from the approach after this 
///
/// Returns a sequence like so:
///
/// "oculus": {
///    "text": "HELLO",
///    "visemes": [ "I","E","nn","O" ],
///    "times": [ 0, 0.9, 2, 2.9 ],
///    "durations": [ 0.9, 1.1, 0.9, 1.1 ],
///    "i": 5
///  }
///
/// the durations are not in milliseconds but are where the duration of a viseme is 'around 1' and the entire sequence has to be stretched to fit the audio duration
///

const FUDGE_FACTOR = 0.7

function text2Visemes(text) {

	text = text.toUpperCase()

	let o = {
		text,
		visemes: [],
		times: [],
		durations: [],
		i:0
	}

	let t = 0;

	const chars = Array.from(text)
	while( o.i < chars.length ) {
		const c = chars[o.i];
		const ruleset = rules[c];
		if ( ruleset ) {
			for(let i=0; i<ruleset.length; i++) {
				const rule = ruleset[i];
				const test = text.substring(0, o.i) + c.toLowerCase() + text.substring(o.i+1);
				let matches = test.match(rule.regex);
				if ( matches ) {
					rule.visemes.forEach( viseme => {
						const duration = viseme_durations_rpm[viseme] || 1
						if ( o.visemes.length && o.visemes[ o.visemes.length - 1 ] === viseme ) {
							o.durations[ o.durations.length - 1 ] += (FUDGE_FACTOR * duration);
							t += (FUDGE_FACTOR * duration);
						} else {
							o.visemes.push( viseme );
							o.times.push(t);
							o.durations.push( viseme_durations_rpm[viseme] || 1 );
							t += duration;
						}
					})
					o.i += rule.move;
					break;
				}
			}
		} else {
			o.i++;
			t += otherDurations[c] || 0;
		}
	}

	return o;
}

///
/// sentences to visemes - a fancy approach with attack, decay, release
///
///		input is an an array of sentences, where each sentence is an array of words, and each word is a string
///
/// 	output a 'sequence' or collection of visemes per word - an element in a sequence looks like this:
///
///			[
///				{
///					oculus: {
///						text: "hello",
///						visemes: [ 'A', 'O', 'U' ],
///						times: [ 0, 0.3, 1.2 ],
///						durations: [ 0.3, 0.8, 0.5 ],
///						i:0
///					},
///					rpm: [
///						{ ts:[ -0.5, 0.5, 1.3 ], vs:{ "viseme_FF", 0.9 } }
///						{ ts:[  0.8, 0.5, 1.8 ], vs:{ "viseme_A", 0.6 } }
///						...
///					]
///				}
///			]
///
/// each word turns into a collection of oculus viseme objects; basically just the visemes related to that word
///
/// the durations are not in milliseconds but are where the duration of a viseme is 'around 1' and the entire sequence has to be stretched to fit the audio duration
///
/// right now the output of this is not used - was from talking heads demo
///

function sentencesToVisemesFancy(sentences) {
	const VISEME_ATTACK_TIME = -0.5
	const VISEME_RELEASE_TIME = 0.5
	const VISEME_DECAY_TIME = 0.5
	const VISEME_DEGREE_LARGE = 0.9 // @todo can slightly randomize later
	const VISEME_DEGREE_MEDIUM = 0.6
	const visemes = []
	let time = 0
	const chunks2visemes = (word) => {
		const oculus = text2Visemes(word)
		if(!oculus || !oculus.visemes || !oculus.visemes.length) return
		const rpm = []
		for( let j=0; j<oculus.visemes.length; j++ ) {
			const attack = time + oculus.times[j] + VISEME_ATTACK_TIME
			const sustain = 0
			const release = time + oculus.times[j] + VISEME_RELEASE_TIME // @todo is this right?
			const decay = time + oculus.times[j] + oculus.durations[j] + VISEME_DECAY_TIME
			const ts = [ attack, release, decay ]
			const viseme = oculus.visemes[j]
			const visemeDegree = [null,(viseme === 'PP' || viseme === 'FF') ? VISEME_DEGREE_LARGE : VISEME_DEGREE_MEDIUM, 0]
			const vs = { ['viseme_'+viseme]: visemeDegree }
			rpm.push({ts,vs})
		}
		time += oculus.times[ oculus.visemes.length-1 ] + oculus.durations[ oculus.visemes.length-1 ] + VISEME_DECAY_TIME
		visemes.push({oculus,rpm})
	}
	sentences.forEach(sentence=>{
		sentence.forEach(word=>{
			chunks2visemes(word)
		})
	})
	return visemes
}


///
/// sentences to visemes - simple
///
/// this is a lighter variation of the above
/// this throws away the rpm attack/decay/release timing above and just returns a simpler list of visemes over time
/// it shifts the labor to visemesToMorphsAtTime()
///
/// given arrays of sentences and words, generate a list of visemes over time
/// 
/// we end up with an array of hashes like so:
///
///		[{
///			viseme: "I",
///			degree: 0.6,
///			start: 0,
///			end: 0.9
///		}]
///
/// the durations are not in milliseconds but are where the duration of a viseme is 'around 1' and the entire sequence has to be stretched to fit the audio duration
///

function sentencesToVisemesSimple(sentences) {

	let start = 0
	const stack = []
	const word2visemes = (word) => {
		const oculus = text2Visemes(word)
		if(!oculus || !oculus.visemes || !oculus.visemes.length) return
		for(let i = 0; i < oculus.visemes.length;i++) {
			const viseme = oculus.visemes[i]
			const duration = oculus.durations[i]
			const end = start+duration
			const degree = viseme === 'PP' || viseme === 'FF' ? 0.9 : 0.6
			const item = {
				viseme,
				degree,
				start,
				end
			}
			start = end
			stack.push(item)
		}
	}

	sentences.forEach(sentence=>{
		sentence.forEach(word=>{
			word2visemes(word)
		})
	})

	return stack
}


