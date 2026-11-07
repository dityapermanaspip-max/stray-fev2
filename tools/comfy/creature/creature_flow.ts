import type { Workflow } from '../client.ts';

// The creature workflow in ComfyUI API format: DreamShaper 8 + the creature LoRA, no ControlNet. Without a `from`
// picture it starts from an empty latent (the anchor idle); with one it is img2img from that picture at `denoise`
// (the other frames, so every frame stays the same animal). Inspyrenet cuts the creature out of the grey.
// Two images come out: node 'rgb' (on grey) and node 'mask' (white = creature).

export type CreatureJob = { prompt: string; negative: string; seed: number; lora: string; strength: number; size: number; from?: string; denoise?: number };

export function creatureFlow(j: CreatureJob): Workflow {
  return {
    ckpt: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'DreamShaper_8_pruned.safetensors' } },
    lora: { class_type: 'LoraLoader', inputs: { model: ['ckpt', 0], clip: ['ckpt', 1], lora_name: j.lora, strength_model: j.strength, strength_clip: j.strength } },
    pos: { class_type: 'CLIPTextEncode', inputs: { clip: ['lora', 1], text: j.prompt } },
    neg: { class_type: 'CLIPTextEncode', inputs: { clip: ['lora', 1], text: j.negative } },
    ...(j.from
      ? { start: { class_type: 'LoadImage', inputs: { image: j.from } }, latent: { class_type: 'VAEEncode', inputs: { pixels: ['start', 0], vae: ['ckpt', 2] } } }
      : { latent: { class_type: 'EmptyLatentImage', inputs: { width: j.size, height: j.size, batch_size: 1 } } }),
    sample: {
      class_type: 'KSampler',
      inputs: { model: ['lora', 0], positive: ['pos', 0], negative: ['neg', 0], latent_image: ['latent', 0], seed: j.seed, steps: 28, cfg: 7, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: j.from ? (j.denoise ?? 0.55) : 1 },
    },
    decode: { class_type: 'VAEDecode', inputs: { samples: ['sample', 0], vae: ['ckpt', 2] } },
    cut: { class_type: 'InspyrenetRembg', inputs: { image: ['decode', 0], torchscript_jit: 'default' } },
    mask_img: { class_type: 'MaskToImage', inputs: { mask: ['cut', 1] } },
    rgb: { class_type: 'SaveImage', inputs: { images: ['decode', 0], filename_prefix: 'creature_rgb' } },
    mask: { class_type: 'SaveImage', inputs: { images: ['mask_img', 0], filename_prefix: 'creature_mask' } },
  };
}
