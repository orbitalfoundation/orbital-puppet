/**
 * @class lipsync
 * @author Mika Suominen
 *
 * lipsync support from Mika's talking heads demo https://github.com/met4citizen
 */

import { animEmojis } from "./anim-emojis.js";

import { LipsyncEn } from "./lipsync-en.js";

const lipsync = { en: new LipsyncEn() };

export function lipsyncPreProcessText(s, lang) {
	const o = lipsync[lang] || Object.values(lipsync)[0];
	return o.preProcessText(s);
}

export function lipsyncWordsToVisemes(w, lang) {
	const o = lipsync[lang] || Object.values(lipsync)[0];
	return o.wordsToVisemes(w);
}

export function lipsyncQueue(
	text,
	lipsyncLang = "en",
	onsubtitles = null,
	excludes = null
) {
	let queue = new Array();

	// Classifiers
	const dividersSentence = /[!,\.\?\n\p{Extended_Pictographic}]/gu;
	const dividersWord = /[ ]/gu;
	const speakables = /[\p{L}\p{N},\[\]\.'!€\$\+\-%&\?]/gu;
	const emojis = /[\p{Extended_Pictographic}]/gu;

	let markdownWord = ""; // markdown word
	let textWord = ""; // text-to-speech word
	let markId = 0; // SSML mark id
	let ttsSentence = []; // Text-to-speech sentence
	let lipsyncAnim = []; // Lip-sync animation sequence
	const letters = [...text];
	for (let i = 0; i < letters.length; i++) {
		const isLast = i === letters.length - 1;
		const isSpeakable = letters[i].match(speakables);
		const isEndOfSentence = letters[i].match(dividersSentence);
		const isEndOfWord = letters[i].match(dividersWord);

		// Add letter to subtitles
		if (onsubtitles) {
			markdownWord += letters[i];
		}

		// Add letter to spoken word
		if (isSpeakable) {
			if (!excludes || excludes.every((x) => i < x[0] || i > x[1])) {
				textWord += letters[i];
			}
		}

		// Add words to sentence and animations
		if (isEndOfWord || isEndOfSentence || isLast) {
			// Add to text-to-speech sentence
			if (textWord.length) {
				textWord = lipsyncPreProcessText(textWord, lipsyncLang);
				if (textWord.length) {
					ttsSentence.push({
						mark: markId,
						word: textWord,
					});
				}
			}

			// Push subtitles to animation queue
			if (markdownWord.length) {
				lipsyncAnim.push({
					mark: markId,
					template: { name: "subtitles" },
					ts: [0],
					vs: {
						subtitles: markdownWord,
					},
				});
				markdownWord = "";
			}

			// Push visemes to animation queue
			if (textWord.length) {
				const v = lipsyncWordsToVisemes(textWord, lipsyncLang);
				if (v && v.visemes && v.visemes.length) {
					const d =
						v.times[v.visemes.length - 1] + v.durations[v.visemes.length - 1];
					for (let j = 0; j < v.visemes.length; j++) {
						const o = lipsyncAnim.push({
							mark: markId,
							template: { name: "viseme" },
							ts: [
								(v.times[j] - 0.6) / d,
								(v.times[j] + 0.5) / d,
								(v.times[j] + v.durations[j] + 0.5) / d,
							],
							vs: {
								["viseme_" + v.visemes[j]]: [
									null,
									v.visemes[j] === "PP" || v.visemes[j] === "FF" ? 0.9 : 0.6,
									0,
								],
							},
						});
					}
				}
				textWord = "";
				markId++;
			}
		}

		// Process sentences
		if (isEndOfSentence || isLast) {
			// Send sentence to Text-to-speech queue
			if (ttsSentence.length || (isLast && lipsyncAnim.length)) {
				const o = {
					anim: lipsyncAnim,
				};
				if (onsubtitles) o.onSubtitles = onsubtitles;
				if (ttsSentence.length) {
					o.text = ttsSentence;
				}
				queue.push(o);

				// Reset sentence and animation sequence
				ttsSentence = [];
				textWord = "";
				markId = 0;
				lipsyncAnim = [];
			}

			// Send emoji, if the divider was a known emoji
			if (letters[i].match(emojis)) {
				let emoji = animEmojis[letters[i]];
				if (emoji && emoji.link) emoji = animEmojis[emoji.link];
				if (emoji) {
					queue.push({ emoji: emoji });
				}
			}

			queue.push({ break: 100 });
		}
	}

	queue.push({ break: 1000 });

	return queue;
}

function convertRange(value, r1, r2) {
	return ((value - r1[0]) * (r2[1] - r2[0])) / (r1[1] - r1[0]) + r2[0];
}

export function lipsyncConvert(whisper, lipsyncLang = "en", onsubtitles = null) {
	const o = {};

	// lightly process raw data returned from whisper - there are a few different format variations
	const r = {
		words: [],
		wtimes: [],
		wdurations: [],
		markers: [],
		mtimes: []
	}
	whisper.forEach( x => {
		if(x.text) {
			r.words.push( x.text )
			r.wtimes.push( 1000 * x.timestamp[0] - 150 )
			r.wdurations.push( 1000 * (x.timestamp[1] - x.timestamp[0]) )
		}
		if(x.word) {
			r.words.push( x.word )
			r.wtimes.push( 1000 * x.start - 150 )
			r.wdurations.push( 1000 * (x.end - x.start) )
		}
	})

	/*
	// If raw visemes were provided use them - whisper doesn't give this to us so we don't typically have them - coqui does provide them
	if (r.visemes) {
		for (let i = 0; i < r.visemes.length; i++) {
			const viseme = r.visemes[i];
			const time = r.vtimes[i];
			const duration = r.vdurations[i];
			lipsyncAnim.push({
				template: { name: "viseme" },
				ts: [
					time - (2 * duration) / 3,
					time + duration / 2,
					time + duration + duration / 2,
				],
				vs: {
					["viseme_" + viseme]: [
						null,
						viseme === "PP" || viseme === "FF" ? 0.9 : 0.6,
						0,
					],
				},
				// for debugging
				viseme,
				time,
				duration,
			});
		}
	}
	*/

	// If visemes were not specified, generate based on the word timing data from whisper
	if (r.words) {
		let lipsyncAnim = [];
		for (let i = 0; i < r.words.length; i++) {
			const word = r.words[i];
			const time = r.wtimes[i];
			let duration = r.wdurations[i];
			if(!word || !word.length) continue
			const w = lipsyncPreProcessText(word, lipsyncLang);
			const v = lipsyncWordsToVisemes(w, lipsyncLang);
			if (v && v.visemes && v.visemes.length) {
				const dTotal = v.times[v.visemes.length - 1] + v.durations[v.visemes.length - 1];
				const overdrive = Math.min(duration,Math.max(0, duration - v.visemes.length * 150));
				let level = 0.6 + convertRange(overdrive, [0, duration], [0, 0.4]);
				duration = Math.min(duration, v.visemes.length * 200);
				if (dTotal > 0) {
					for (let j = 0; j < v.visemes.length; j++) {
						const t = time + (v.times[j] / dTotal) * duration;
						const d = (v.durations[j] / dTotal) * duration;
						const viseme = v.visemes[j];
						lipsyncAnim.push({
							template: { name: "viseme" },
							ts: [
								t - Math.min(60, (2 * d) / 3),
								t + Math.min(25, d / 2),
								t + d + Math.min(60, d / 2),
							],
							vs: {
								["viseme_" + viseme]: [
									null,
									viseme === "PP" || viseme === "FF" ? 0.9 : level,
									0,
								],
							},
							// for debugging
							viseme,
							time,
							duration,
						});
					}
				}
			}
		}

		if (lipsyncAnim.length) {
			o.anim = lipsyncAnim;
		}
	}

	return o;
}
