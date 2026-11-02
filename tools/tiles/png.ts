import { crc32, deflateSync, inflateSync } from 'node:zlib';

// Minimal PNG reader and writer for tile sheets: 8-bit RGBA (color type 6), not interlaced. Anything else stops with an error.
// Node only (node:zlib), no libraries.

export type Rgba = { width: number; height: number; data: Uint8Array }; // data: 4 bytes per pixel, row-major

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const BYTES_PER_PIXEL = 4;

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function readPng(file: Uint8Array): Rgba {
  if (!SIGNATURE.every((b, i) => file[i] === b)) throw new Error('not a PNG file');
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  let width = 0, height = 0;
  const idat: Uint8Array[] = [];
  for (let at = 8; at < file.length;) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...file.subarray(at + 4, at + 8));
    const body = file.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      const [depth, color, , , interlace] = body.subarray(8, 13);
      if (depth !== 8 || color !== 6 || interlace !== 0) {
        throw new Error(`need 8-bit RGBA without interlace (got depth ${depth}, color type ${color}, interlace ${interlace})`);
      }
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * BYTES_PER_PIXEL;
  const data = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= BYTES_PER_PIXEL ? data[row + i - BYTES_PER_PIXEL] : 0;
      const b = y > 0 ? data[row - stride + i] : 0;
      const c = i >= BYTES_PER_PIXEL && y > 0 ? data[row - stride + i - BYTES_PER_PIXEL] : 0;
      const pred = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : filter === 4 ? paeth(a, b, c) : NaN;
      if (Number.isNaN(pred)) throw new Error(`bad PNG filter ${filter} on row ${y}`);
      data[row + i] = (src[i] + pred) & 0xff;
    }
  }
  return { width, height, data };
}

export const alphaAt = (img: Rgba, x: number, y: number) => img.data[(y * img.width + x) * BYTES_PER_PIXEL + 3];

// Writer: 8-bit RGBA, filter 0 on every row, one IDAT.
export function writePng(img: Rgba): Uint8Array {
  const stride = img.width * BYTES_PER_PIXEL;
  const raw = new Uint8Array((stride + 1) * img.height);
  for (let y = 0; y < img.height; y++) raw.set(img.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const chunk = (type: string, body: Uint8Array) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, 'latin1');
    out.set(body, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(img.width, 0);
  head.writeUInt32BE(img.height, 4);
  head.set([8, 6, 0, 0, 0], 8);
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([Buffer.from(SIGNATURE), chunk('IHDR', head), chunk('IDAT', idat), chunk('IEND', new Uint8Array())]);
}
