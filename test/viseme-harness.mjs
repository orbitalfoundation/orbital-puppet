// Headless viseme smoothness harness.
//
// visemes_sequence + visemes_update are pure logic on a plain `volume` object (no three.js / DOM),
// so we can run the lip-sync performance in Node, step time frame-by-frame, and MEASURE how smooth
// (or jittery) the mouth motion is — and print an ASCII plot. This lets us tune without a browser.
//
//   node test/viseme-harness.mjs

import { visemes_sequence, visemes_update } from '../perform/visemes.js'

// --- a realistic HeadTTS-style lip-sync stream (Oculus viseme ids, ms) -----------------------------
// ~"hello there how are you" — dense phonemes, ~60-90ms each, the kind of stream that jitters.
const VISEMES   = ['kk','E','nn','O','sil','TH','E','RR','sil','kk','O','U','sil','aa','RR','sil','I','U']
const durs      = [ 70, 90, 60, 95,  40,  60, 85, 80,  40,  70, 90, 75,  40, 95, 80,  40, 85, 90]
let acc = 120 // small lead-in
const vtimes = [], vdurations = []
for (let i = 0; i < VISEMES.length; i++) { vtimes.push(acc); vdurations.push(durs[i]); acc += durs[i] }
const lipsync = { visemes: VISEMES, vtimes, vdurations }

// --- run the performance frame-by-frame ------------------------------------------------------------
const FPS = 60, DT = 1000 / FPS
const ANCHOR = 0
const END = vtimes[vtimes.length - 1] + vdurations[vdurations.length - 1] + 150

const volume = { targets: {}, sequence: [], visemes: null }
volume.sequence = visemes_sequence(volume, lipsync, ANCHOR)

const samples = []
for (let t = ANCHOR; t <= ANCHOR + END; t += DT) {
	visemes_update(volume, t)
	let open = 0
	for (const k in volume.targets) open += volume.targets[k]   // total mouth activation
	samples.push({ t: t - ANCHOR, open })
}

// --- metrics ---------------------------------------------------------------------------------------
let totalVariation = 0, reversals = 0, prevDir = 0, peak = 0
for (let i = 1; i < samples.length; i++) {
	const d = samples[i].open - samples[i - 1].open
	totalVariation += Math.abs(d)
	peak = Math.max(peak, samples[i].open)
	const dir = Math.sign(d)
	if (dir !== 0 && prevDir !== 0 && dir !== prevDir) reversals++
	if (dir !== 0) prevDir = dir
}
// jitter = how much the curve wiggles relative to its peak; reversals = open/close flip-flops
const jitter = (totalVariation / Math.max(0.001, peak)).toFixed(1)

// --- ascii plot (downsampled) ----------------------------------------------------------------------
console.log(`\n  mouth openness over time (each row ~${(DT*3)|0}ms; bar = total viseme activation)\n`)
const W = 40
for (let i = 0; i < samples.length; i += 3) {
	const s = samples[i]
	const n = Math.round((s.open / Math.max(0.001, peak)) * W)
	console.log(`  ${String(s.t|0).padStart(4)}ms |${'#'.repeat(n)}${' '.repeat(W-n)}| ${s.open.toFixed(2)}`)
}

console.log(`\n  peak=${peak.toFixed(2)}  totalVariation=${totalVariation.toFixed(2)}  reversals=${reversals}  JITTER=${jitter}`)
console.log(`  (lower JITTER + fewer reversals = smoother. ${VISEMES.length} visemes over ${(END/1000).toFixed(1)}s)\n`)
