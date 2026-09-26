/**
 * How big a picture is, read from its own header.
 *
 * The metadata block says "5472 × 3648" because that is one of the two things a person
 * checks before sending a file somewhere (the other is its size in bytes). Nothing here
 * decodes a picture: a PNG's `IHDR`, a JPEG's first SOF marker, a GIF's logical screen
 * descriptor and a WebP's `VP8X`/`VP8 `/`VP8L` chunks all carry the two numbers in the first
 * few hundred bytes, so this is a bounded read rather than an image library.
 *
 * A format this does not know answers `null`, and the surface says nothing rather than
 * guessing. Video is deliberately not attempted here: the container's dimensions need a
 * parser per format, and a wrong number is worse than no number.
 *
 * @module @muen/dsh-assets/lib/image-size
 */
import { open } from 'node:fs/promises'

/** Enough for every header below, and small enough to read per tile. */
const MAX_HEADER_BYTES = 64 * 1024

/** PNG: `\x89PNG\r\n\x1a\n`, then the IHDR chunk's width and height, big-endian. */
function pngSize(buffer) {
  if (buffer.length < 24) return null
  if (buffer.readUInt32BE(0) !== 0x89504e47 || buffer.readUInt32BE(4) !== 0x0d0a1a0a) return null
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

/** GIF: the logical screen descriptor, little-endian, right after the signature. */
function gifSize(buffer) {
  if (buffer.length < 10) return null
  const signature = buffer.toString('ascii', 0, 6)
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) }
}

/**
 * JPEG: walk the markers to the first SOFn and read its two dimensions.
 *
 * `SOF0..SOF15` except the four markers that are not frame headers (`C4`, `C8`, `CC`).
 */
function jpegSize(buffer) {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) return null
  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = buffer[offset + 1]
    // A standalone marker (padding, restart) carries no length.
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2
      continue
    }
    const length = buffer.readUInt16BE(offset + 2)
    if (length < 2) return null
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isFrame) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
    }
    offset += 2 + length
  }
  return null
}

/** WebP: `RIFF….WEBP`, then whichever chunk this file starts with. */
function webpSize(buffer) {
  if (buffer.length < 30) return null
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null
  const chunk = buffer.toString('ascii', 12, 16)
  if (chunk === 'VP8X') {
    // 24-bit little-endian, stored MINUS ONE.
    const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16))
    const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16))
    return { width, height }
  }
  if (chunk === 'VP8 ') {
    // Lossy: the frame header's 14-bit dimensions follow the 3-byte start code.
    const start = 26
    if (buffer.length < start + 4) return null
    return { width: buffer.readUInt16LE(start) & 0x3fff, height: buffer.readUInt16LE(start + 2) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    // Lossless: 14 bits each, packed, both MINUS ONE.
    const bits = buffer.readUInt32LE(21)
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) }
  }
  return null
}

/** The dimensions of a picture, from whichever header this is. `null` when unknown. */
export function sizeFromHeader(buffer) {
  return pngSize(buffer) || jpegSize(buffer) || gifSize(buffer) || webpSize(buffer)
}

/** The extensions this can read. Anything else is asked for a byte count and nothing more. */
const KNOWN = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp'])

/**
 * Read a file's dimensions by opening it and reading at most 64 KB.
 *
 * A file that vanishes, cannot be read, or is not a picture answers `null` — the metadata
 * block shows nothing rather than a made-up number.
 */
export async function imageSize(file, ext, { openFile = open, max = MAX_HEADER_BYTES } = {}) {
  if (!KNOWN.has(String(ext || '').toLowerCase())) return null
  let handle
  try {
    handle = await openFile(file, 'r')
  } catch {
    return null
  }
  try {
    const info = await handle.stat()
    const length = Math.min(Number(info.size) || 0, max)
    if (length < 10) return null
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, 0)
    const size = sizeFromHeader(buffer)
    if (!size || !size.width || !size.height) return null
    return { width: size.width, height: size.height }
  } catch {
    return null
  } finally {
    await handle.close().catch(() => {})
  }
}
