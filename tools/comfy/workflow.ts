import type { Workflow } from './client.ts';

// The tile workflow in ComfyUI API format: DreamShaper 8 + a tile LoRA, a canny ControlNet fed the flat tile outline
// (keeps every tile on the same diamond footprint), then Inspyrenet background removal. Two images come out:
// node 'rgb' (the tile on its grey background) and node 'mask' (the cut-out as a grey image, white = tile).

export type TileJob = { prompt: string; negative: string; seed: number; lora: string; control: string; size: number; strength: number; guide?: string; denoise?: number }; // guide: a layout picture to start from (img2img)

export function tileFlow(j: TileJob): Workflow {
  return {
    ckpt: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'DreamShaper_8_pruned.safetensors' } },
    lora: { class_type: 'LoraLoader', inputs: { model: ['ckpt', 0], clip: ['ckpt', 1], lora_name: j.lora, strength_model: 1, strength_clip: 1 } },
    pos: { class_type: 'CLIPTextEncode', inputs: { clip: ['lora', 1], text: j.prompt } },
    neg: { class_type: 'CLIPTextEncode', inputs: { clip: ['lora', 1], text: j.negative } },
    ctl_img: { class_type: 'LoadImage', inputs: { image: j.control } },
    ctl_net: { class_type: 'ControlNetLoader', inputs: { control_net_name: 'control_v11p_sd15_canny_fp16.safetensors' } },
    ctl: { class_type: 'ControlNetApplyAdvanced', inputs: { positive: ['pos', 0], negative: ['neg', 0], control_net: ['ctl_net', 0], image: ['ctl_img', 0], strength: j.strength, start_percent: 0, end_percent: 0.8 } },
    ...(j.guide
      ? { guide: { class_type: 'LoadImage', inputs: { image: j.guide } }, latent: { class_type: 'VAEEncode', inputs: { pixels: ['guide', 0], vae: ['ckpt', 2] } } }
      : { latent: { class_type: 'EmptyLatentImage', inputs: { width: j.size, height: j.size, batch_size: 1 } } }),
    sample: {
      class_type: 'KSampler',
      inputs: { model: ['lora', 0], positive: ['ctl', 0], negative: ['ctl', 1], latent_image: ['latent', 0], seed: j.seed, steps: 28, cfg: 7, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: j.guide ? (j.denoise ?? 0.7) : 1 },
    },
    decode: { class_type: 'VAEDecode', inputs: { samples: ['sample', 0], vae: ['ckpt', 2] } },
    cut: { class_type: 'InspyrenetRembg', inputs: { image: ['decode', 0], torchscript_jit: 'default' } },
    mask_img: { class_type: 'MaskToImage', inputs: { mask: ['cut', 1] } },
    rgb: { class_type: 'SaveImage', inputs: { images: ['decode', 0], filename_prefix: 'tile_rgb' } },
    mask: { class_type: 'SaveImage', inputs: { images: ['mask_img', 0], filename_prefix: 'tile_mask' } },
  };
}
