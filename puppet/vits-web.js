const l = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main", B = "https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/", h = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize", d = {
  "ar_JO-kareem-low": "ar/ar_JO/kareem/low/ar_JO-kareem-low.onnx",
  "ar_JO-kareem-medium": "ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx",
  "ca_ES-upc_ona-medium": "ca/ca_ES/upc_ona/medium/ca_ES-upc_ona-medium.onnx",
  "ca_ES-upc_ona-x_low": "ca/ca_ES/upc_ona/x_low/ca_ES-upc_ona-x_low.onnx",
  "ca_ES-upc_pau-x_low": "ca/ca_ES/upc_pau/x_low/ca_ES-upc_pau-x_low.onnx",
  "cs_CZ-jirka-low": "cs/cs_CZ/jirka/low/cs_CZ-jirka-low.onnx",
  "cs_CZ-jirka-medium": "cs/cs_CZ/jirka/medium/cs_CZ-jirka-medium.onnx",
  "da_DK-talesyntese-medium": "da/da_DK/talesyntese/medium/da_DK-talesyntese-medium.onnx",
  "de_DE-eva_k-x_low": "de/de_DE/eva_k/x_low/de_DE-eva_k-x_low.onnx",
  "de_DE-karlsson-low": "de/de_DE/karlsson/low/de_DE-karlsson-low.onnx",
  "de_DE-kerstin-low": "de/de_DE/kerstin/low/de_DE-kerstin-low.onnx",
  "de_DE-mls-medium": "de/de_DE/mls/medium/de_DE-mls-medium.onnx",
  "de_DE-pavoque-low": "de/de_DE/pavoque/low/de_DE-pavoque-low.onnx",
  "de_DE-ramona-low": "de/de_DE/ramona/low/de_DE-ramona-low.onnx",
  "de_DE-thorsten-high": "de/de_DE/thorsten/high/de_DE-thorsten-high.onnx",
  "de_DE-thorsten-low": "de/de_DE/thorsten/low/de_DE-thorsten-low.onnx",
  "de_DE-thorsten-medium": "de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx",
  "de_DE-thorsten_emotional-medium": "de/de_DE/thorsten_emotional/medium/de_DE-thorsten_emotional-medium.onnx",
  "el_GR-rapunzelina-low": "el/el_GR/rapunzelina/low/el_GR-rapunzelina-low.onnx",
  "en_GB-alan-low": "en/en_GB/alan/low/en_GB-alan-low.onnx",
  "en_GB-alan-medium": "en/en_GB/alan/medium/en_GB-alan-medium.onnx",
  "en_GB-alba-medium": "en/en_GB/alba/medium/en_GB-alba-medium.onnx",
  "en_GB-aru-medium": "en/en_GB/aru/medium/en_GB-aru-medium.onnx",
  "en_GB-cori-high": "en/en_GB/cori/high/en_GB-cori-high.onnx",
  "en_GB-cori-medium": "en/en_GB/cori/medium/en_GB-cori-medium.onnx",
  "en_GB-jenny_dioco-medium": "en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium.onnx",
  "en_GB-northern_english_male-medium": "en/en_GB/northern_english_male/medium/en_GB-northern_english_male-medium.onnx",
  "en_GB-semaine-medium": "en/en_GB/semaine/medium/en_GB-semaine-medium.onnx",
  "en_GB-southern_english_female-low": "en/en_GB/southern_english_female/low/en_GB-southern_english_female-low.onnx",
  "en_GB-vctk-medium": "en/en_GB/vctk/medium/en_GB-vctk-medium.onnx",
  "en_US-amy-low": "en/en_US/amy/low/en_US-amy-low.onnx",
  "en_US-amy-medium": "en/en_US/amy/medium/en_US-amy-medium.onnx",
  "en_US-arctic-medium": "en/en_US/arctic/medium/en_US-arctic-medium.onnx",
  "en_US-danny-low": "en/en_US/danny/low/en_US-danny-low.onnx",
  "en_US-hfc_female-medium": "en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx",
  "en_US-hfc_male-medium": "en/en_US/hfc_male/medium/en_US-hfc_male-medium.onnx",
  "en_US-joe-medium": "en/en_US/joe/medium/en_US-joe-medium.onnx",
  "en_US-kathleen-low": "en/en_US/kathleen/low/en_US-kathleen-low.onnx",
  "en_US-kristin-medium": "en/en_US/kristin/medium/en_US-kristin-medium.onnx",
  "en_US-kusal-medium": "en/en_US/kusal/medium/en_US-kusal-medium.onnx",
  "en_US-l2arctic-medium": "en/en_US/l2arctic/medium/en_US-l2arctic-medium.onnx",
  "en_US-lessac-high": "en/en_US/lessac/high/en_US-lessac-high.onnx",
  "en_US-lessac-low": "en/en_US/lessac/low/en_US-lessac-low.onnx",
  "en_US-lessac-medium": "en/en_US/lessac/medium/en_US-lessac-medium.onnx",
  "en_US-libritts-high": "en/en_US/libritts/high/en_US-libritts-high.onnx",
  "en_US-libritts_r-medium": "en/en_US/libritts_r/medium/en_US-libritts_r-medium.onnx",
  "en_US-ljspeech-high": "en/en_US/ljspeech/high/en_US-ljspeech-high.onnx",
  "en_US-ljspeech-medium": "en/en_US/ljspeech/medium/en_US-ljspeech-medium.onnx",
  "en_US-ryan-high": "en/en_US/ryan/high/en_US-ryan-high.onnx",
  "en_US-ryan-low": "en/en_US/ryan/low/en_US-ryan-low.onnx",
  "en_US-ryan-medium": "en/en_US/ryan/medium/en_US-ryan-medium.onnx",
  "es_ES-carlfm-x_low": "es/es_ES/carlfm/x_low/es_ES-carlfm-x_low.onnx",
  "es_ES-davefx-medium": "es/es_ES/davefx/medium/es_ES-davefx-medium.onnx",
  "es_ES-mls_10246-low": "es/es_ES/mls_10246/low/es_ES-mls_10246-low.onnx",
  "es_ES-mls_9972-low": "es/es_ES/mls_9972/low/es_ES-mls_9972-low.onnx",
  "es_ES-sharvard-medium": "es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx",
  "es_MX-ald-medium": "es/es_MX/ald/medium/es_MX-ald-medium.onnx",
  "es_MX-claude-high": "es/es_MX/claude/high/es_MX-claude-high.onnx",
  "fa_IR-amir-medium": "fa/fa_IR/amir/medium/fa_IR-amir-medium.onnx",
  "fa_IR-gyro-medium": "fa/fa_IR/gyro/medium/fa_IR-gyro-medium.onnx",
  "fi_FI-harri-low": "fi/fi_FI/harri/low/fi_FI-harri-low.onnx",
  "fi_FI-harri-medium": "fi/fi_FI/harri/medium/fi_FI-harri-medium.onnx",
  "fr_FR-gilles-low": "fr/fr_FR/gilles/low/fr_FR-gilles-low.onnx",
  "fr_FR-mls-medium": "fr/fr_FR/mls/medium/fr_FR-mls-medium.onnx",
  "fr_FR-mls_1840-low": "fr/fr_FR/mls_1840/low/fr_FR-mls_1840-low.onnx",
  "fr_FR-siwis-low": "fr/fr_FR/siwis/low/fr_FR-siwis-low.onnx",
  "fr_FR-siwis-medium": "fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx",
  "fr_FR-tom-medium": "fr/fr_FR/tom/medium/fr_FR-tom-medium.onnx",
  "fr_FR-upmc-medium": "fr/fr_FR/upmc/medium/fr_FR-upmc-medium.onnx",
  "hu_HU-anna-medium": "hu/hu_HU/anna/medium/hu_HU-anna-medium.onnx",
  "hu_HU-berta-medium": "hu/hu_HU/berta/medium/hu_HU-berta-medium.onnx",
  "hu_HU-imre-medium": "hu/hu_HU/imre/medium/hu_HU-imre-medium.onnx",
  "is_IS-bui-medium": "is/is_IS/bui/medium/is_IS-bui-medium.onnx",
  "is_IS-salka-medium": "is/is_IS/salka/medium/is_IS-salka-medium.onnx",
  "is_IS-steinn-medium": "is/is_IS/steinn/medium/is_IS-steinn-medium.onnx",
  "is_IS-ugla-medium": "is/is_IS/ugla/medium/is_IS-ugla-medium.onnx",
  "it_IT-riccardo-x_low": "it/it_IT/riccardo/x_low/it_IT-riccardo-x_low.onnx",
  "ka_GE-natia-medium": "ka/ka_GE/natia/medium/ka_GE-natia-medium.onnx",
  "kk_KZ-iseke-x_low": "kk/kk_KZ/iseke/x_low/kk_KZ-iseke-x_low.onnx",
  "kk_KZ-issai-high": "kk/kk_KZ/issai/high/kk_KZ-issai-high.onnx",
  "kk_KZ-raya-x_low": "kk/kk_KZ/raya/x_low/kk_KZ-raya-x_low.onnx",
  "lb_LU-marylux-medium": "lb/lb_LU/marylux/medium/lb_LU-marylux-medium.onnx",
  "ne_NP-google-medium": "ne/ne_NP/google/medium/ne_NP-google-medium.onnx",
  "ne_NP-google-x_low": "ne/ne_NP/google/x_low/ne_NP-google-x_low.onnx",
  "nl_BE-nathalie-medium": "nl/nl_BE/nathalie/medium/nl_BE-nathalie-medium.onnx",
  "nl_BE-nathalie-x_low": "nl/nl_BE/nathalie/x_low/nl_BE-nathalie-x_low.onnx",
  "nl_BE-rdh-medium": "nl/nl_BE/rdh/medium/nl_BE-rdh-medium.onnx",
  "nl_BE-rdh-x_low": "nl/nl_BE/rdh/x_low/nl_BE-rdh-x_low.onnx",
  "nl_NL-mls-medium": "nl/nl_NL/mls/medium/nl_NL-mls-medium.onnx",
  "nl_NL-mls_5809-low": "nl/nl_NL/mls_5809/low/nl_NL-mls_5809-low.onnx",
  "nl_NL-mls_7432-low": "nl/nl_NL/mls_7432/low/nl_NL-mls_7432-low.onnx",
  "no_NO-talesyntese-medium": "no/no_NO/talesyntese/medium/no_NO-talesyntese-medium.onnx",
  "pl_PL-darkman-medium": "pl/pl_PL/darkman/medium/pl_PL-darkman-medium.onnx",
  "pl_PL-gosia-medium": "pl/pl_PL/gosia/medium/pl_PL-gosia-medium.onnx",
  "pl_PL-mc_speech-medium": "pl/pl_PL/mc_speech/medium/pl_PL-mc_speech-medium.onnx",
  "pl_PL-mls_6892-low": "pl/pl_PL/mls_6892/low/pl_PL-mls_6892-low.onnx",
  "pt_BR-edresson-low": "pt/pt_BR/edresson/low/pt_BR-edresson-low.onnx",
  "pt_BR-faber-medium": "pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx",
  "pt_PT-tugão-medium": "pt/pt_PT/tugão/medium/pt_PT-tugão-medium.onnx",
  "ro_RO-mihai-medium": "ro/ro_RO/mihai/medium/ro_RO-mihai-medium.onnx",
  "ru_RU-denis-medium": "ru/ru_RU/denis/medium/ru_RU-denis-medium.onnx",
  "ru_RU-dmitri-medium": "ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium.onnx",
  "ru_RU-irina-medium": "ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx",
  "ru_RU-ruslan-medium": "ru/ru_RU/ruslan/medium/ru_RU-ruslan-medium.onnx",
  "sk_SK-lili-medium": "sk/sk_SK/lili/medium/sk_SK-lili-medium.onnx",
  "sl_SI-artur-medium": "sl/sl_SI/artur/medium/sl_SI-artur-medium.onnx",
  "sr_RS-serbski_institut-medium": "sr/sr_RS/serbski_institut/medium/sr_RS-serbski_institut-medium.onnx",
  "sv_SE-nst-medium": "sv/sv_SE/nst/medium/sv_SE-nst-medium.onnx",
  "sw_CD-lanfrica-medium": "sw/sw_CD/lanfrica/medium/sw_CD-lanfrica-medium.onnx",
  "tr_TR-dfki-medium": "tr/tr_TR/dfki/medium/tr_TR-dfki-medium.onnx",
  "tr_TR-fahrettin-medium": "tr/tr_TR/fahrettin/medium/tr_TR-fahrettin-medium.onnx",
  "tr_TR-fettah-medium": "tr/tr_TR/fettah/medium/tr_TR-fettah-medium.onnx",
  "uk_UA-lada-x_low": "uk/uk_UA/lada/x_low/uk_UA-lada-x_low.onnx",
  "uk_UA-ukrainian_tts-medium": "uk/uk_UA/ukrainian_tts/medium/uk_UA-ukrainian_tts-medium.onnx",
  "vi_VN-25hours_single-low": "vi/vi_VN/25hours_single/low/vi_VN-25hours_single-low.onnx",
  "vi_VN-vais1000-medium": "vi/vi_VN/vais1000/medium/vi_VN-vais1000-medium.onnx",
  "vi_VN-vivos-x_low": "vi/vi_VN/vivos/x_low/vi_VN-vivos-x_low.onnx",
  "zh_CN-huayan-medium": "zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx",
  "zh_CN-huayan-x_low": "zh/zh_CN/huayan/x_low/zh_CN-huayan-x_low.onnx"
};
async function x(e, m) {
  if (e.match("https://huggingface.co"))
    try {
      const i = await (await navigator.storage.getDirectory()).getDirectoryHandle("piper", {
        create: !0
      }), a = e.split("/").at(-1), _ = await (await i.getFileHandle(a, { create: !0 })).createWritable();
      await _.write(m), await _.close();
    } catch (n) {
      console.error(n);
    }
}
async function R(e) {
  try {
    const n = await (await navigator.storage.getDirectory()).getDirectoryHandle("piper"), i = e.split("/").at(-1);
    await (await n.getFileHandle(i)).remove();
  } catch (m) {
    console.error(m);
  }
}
async function D(e) {
  if (e.match("https://huggingface.co"))
    try {
      const n = await (await navigator.storage.getDirectory()).getDirectoryHandle("piper", {
        create: !0
      }), i = e.split("/").at(-1);
      return await (await n.getFileHandle(i)).getFile();
    } catch {
      return;
    }
}
async function f(e, m) {
  var t;
  const n = await fetch(e), i = (t = n.body) == null ? void 0 : t.getReader(), a = +(n.headers.get("Content-Length") ?? 0);
  let o = 0, _ = [];
  for (; i; ) {
    const { done: r, value: u } = await i.read();
    if (r)
      break;
    _.push(u), o += u.length, m == null || m({
      url: e,
      total: a,
      loaded: o
    });
  }
  return new Blob(_, { type: n.headers.get("Content-Type") ?? void 0 });
}
function b(e, m, n) {
  const i = e.length, a = 44, o = new DataView(new ArrayBuffer(i * m * 2 + a));
  o.setUint32(0, 1179011410, !0), o.setUint32(4, o.buffer.byteLength - 8, !0), o.setUint32(8, 1163280727, !0), o.setUint32(12, 544501094, !0), o.setUint32(16, 16, !0), o.setUint16(20, 1, !0), o.setUint16(22, m, !0), o.setUint32(24, n, !0), o.setUint32(28, m * 2 * n, !0), o.setUint16(32, m * 2, !0), o.setUint16(34, 16, !0), o.setUint32(36, 1635017060, !0), o.setUint32(40, 2 * i, !0);
  let _ = a;
  for (let t = 0; t < i; t++) {
    const r = e[t];
    r >= 1 ? o.setInt16(_, 32767, !0) : r <= -1 ? o.setInt16(_, -32768, !0) : o.setInt16(_, r * 32768 | 0, !0), _ += 2;
  }
  return o.buffer;
}
async function N(e, m) {
  const { createPiperPhonemize: n } = await import("./piper-CcyadOla.js"),
  	//i = await import("onnxruntime-web"),
  	i = await import('/node_modules/onnxruntime-web/dist/esm/ort.wasm.min.js'),
  	a = d[e.voiceId], o = JSON.stringify([{ text: e.text.trim() }]);
  i.env.allowLocalModels = !1, i.env.wasm.numThreads = navigator.hardwareConcurrency, i.env.wasm.wasmPaths = B;
  const _ = await w(`${l}/${a}.json`), t = JSON.parse(await _.text()), r = await new Promise(async (v) => {
    (await n({
      print: (s) => {
        v(JSON.parse(s).phoneme_ids);
      },
      printErr: (s) => {
        throw new Error(s);
      },
      locateFile: (s) => s.endsWith(".wasm") ? `${h}.wasm` : s.endsWith(".data") ? `${h}.data` : s
    })).callMain(["-l", t.espeak.voice, "--input", o, "--espeak_data", "/espeak-ng-data"]);
  }), u = 0, p = t.audio.sample_rate, S = t.inference.noise_scale, g = t.inference.length_scale, U = t.inference.noise_w, k = await w(`${l}/${a}`, m), y = await i.InferenceSession.create(await k.arrayBuffer()), c = {
    input: new i.Tensor("int64", r, [1, r.length]),
    input_lengths: new i.Tensor("int64", [r.length]),
    scales: new i.Tensor("float32", [S, g, U])
  };
  Object.keys(t.speaker_id_map).length && Object.assign(c, { sid: new i.Tensor("int64", [u]) });
  const { output: { data: E } } = await y.run(c);
  return new Blob([b(E, 1, p)], { type: "audio/x-wav" });
}
async function w(e, m) {
  let n = await D(e);
  return n || (n = await f(e, m), await x(e, n)), n;
}
async function I(e, m) {
  const n = d[e], i = [`${l}/${n}`, `${l}/${n}.json`];
  await Promise.all(i.map(async (a) => {
    x(a, await f(a, a.endsWith(".onnx") ? m : void 0));
  }));
}
async function F(e) {
  const m = d[e], n = [`${l}/${m}`, `${l}/${m}.json`];
  await Promise.all(n.map((i) => R(i)));
}
async function L() {
  const m = await (await navigator.storage.getDirectory()).getDirectoryHandle("piper", {
    create: !0
  }), n = [];
  for await (const i of m.keys()) {
    const a = i.split(".")[0];
    i.endsWith(".onnx") && a in d && n.push(a);
  }
  return n;
}
async function j() {
  try {
    await (await (await navigator.storage.getDirectory()).getDirectoryHandle("piper")).remove({ recursive: !0 });
  } catch (e) {
    console.error(e);
  }
}
async function P() {
  const e = await fetch(`${l}/voices.json`);
  if (!e.ok)
    throw new Error("Could not retrieve voices file from huggingface");
  return Object.values(await e.json());
}
export {
  l as HF_BASE,
  B as ONNX_BASE,
  d as PATH_MAP,
  h as WASM_BASE,
  I as download,
  j as flush,
  N as predict,
  F as remove,
  L as stored,
  P as voices
};
