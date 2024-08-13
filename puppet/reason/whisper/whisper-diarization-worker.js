
//import { pipeline, AutoProcessor, AutoModelForAudioFrameClassification } from '@xenova/transformers';
//import { pipeline, AutoProcessor, AutoModelForAudioFrameClassification } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2'
import { pipeline, AutoProcessor, AutoModelForAudioFrameClassification } from './transformers.min.js'

const PER_DEVICE_CONFIG = {
    webgpu: {
        dtype: {
            encoder_model: 'fp32',
            decoder_model_merged: 'q4',
        },
        device: 'webgpu',
    },
    wasm: {
        dtype: 'q8',
        device: 'wasm',
    },
};

/**
 * This class uses the Singleton pattern to ensure that only one instance of the model is loaded.
 */
class PipelineSingeton {
    static asr_model_id = 'onnx-community/whisper-small_timestamped';
    static asr_instance = null;

    static segmentation_model_id = 'onnx-community/pyannote-segmentation-3.0';
    static segmentation_instance = null;
    static segmentation_processor = null;

    static async getInstance(progress_callback = null, device = 'webgpu') {
        this.asr_instance ??= pipeline('automatic-speech-recognition', this.asr_model_id, {
            ...PER_DEVICE_CONFIG[device],
            progress_callback,
        });

        this.segmentation_processor ??= AutoProcessor.from_pretrained(this.segmentation_model_id, {
            progress_callback,
        });
        this.segmentation_instance ??= AutoModelForAudioFrameClassification.from_pretrained(this.segmentation_model_id, {
            // NOTE: WebGPU is not currently supported for this model
            // See https://github.com/microsoft/onnxruntime/issues/21386
            device: 'wasm',
            dtype: 'fp32',
            progress_callback,
        });

        return Promise.all([this.asr_instance, this.segmentation_processor, this.segmentation_instance]);
    }
}

async function load({ device }) {
    self.postMessage({
        status: 'loading',
        data: `Loading models (${device})...`
    });

    // Load the pipeline and save it for future use.
    const [transcriber, segmentation_processor, segmentation_model] = await PipelineSingeton.getInstance(x => {
        // We also add a progress callback to the pipeline so that we can
        // track model loading.
        self.postMessage(x);
    }, device);

    if (device === 'webgpu') {
        self.postMessage({
            status: 'loading',
            data: 'Compiling shaders and warming up model...'
        });

        await transcriber(new Float32Array(16_000), {
            language: 'en',
        });
    }

    self.postMessage({ status: 'loaded' });
}

async function segment(processor, model, audio) {
    const inputs = await processor(audio);
    const { logits } = await model(inputs);
    const segments = processor.post_process_speaker_diarization(logits, audio.length)[0];

    // Attach labels
    for (const segment of segments) {
        segment.label = model.config.id2label[segment.id];
    }

    return segments;
}

async function run({ audio, language }) {
    const [transcriber, segmentation_processor, segmentation_model] = await PipelineSingeton.getInstance();

    const start = performance.now();

    // Run transcription and segmentation in parallel
    const [transcript, segments] = await Promise.all([
        transcriber(audio, {
            language,
            return_timestamps: 'word',
            chunk_length_s: 30,
        }),
        segment(segmentation_processor, segmentation_model, audio)
    ]);
    console.table(segments, ['start', 'end', 'id', 'label', 'confidence']);

    const end = performance.now();

    self.postMessage({ status: 'complete', result: { transcript, segments }, time: end - start });
}

// Listen for messages from the main thread
self.addEventListener('message', async (e) => {
    const { type, data } = e.data;

    switch (type) {
        case 'load':
            load(data);
            break;

        case 'run':
            run(data);
            break;
    }
});
