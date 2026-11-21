import { StreamTarget } from 'mediabunny';
import { LIMITS } from './types';

export const VIDEO_OUTPUT_CHUNK_BYTES = 1024 * 1024;

/** Seekable, paged Blob storage for regular MP4 metadata rewrites. */
export class VideoBlobStore {
  private readonly pages = new Map<number, Blob>();
  private readonly zeroPage: Blob;
  private length = 0;

  constructor(private readonly maxBytes: number, private readonly pageBytes = VIDEO_OUTPUT_CHUNK_BYTES) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(pageBytes) || pageBytes < 1 || pageBytes > VIDEO_OUTPUT_CHUNK_BYTES) throw new Error('Invalid video output storage limits.');
    this.zeroPage = new Blob([new Uint8Array(pageBytes)]);
  }

  get size(): number { return this.length; }

  write(data: Uint8Array<ArrayBuffer>, position: number): void {
    const end = position + data.byteLength;
    if (!Number.isSafeInteger(position) || position < 0 || !Number.isSafeInteger(end)) throw new Error('Invalid video output position.');
    // Check before constructing a Blob or retaining any of the new output bytes.
    if (end > this.maxBytes) throw new Error(`This video exceeds the ${Math.floor(this.maxBytes / 1024 / 1024)} MiB export limit. Choose 720p or a smaller frame.`);
    if (!data.byteLength) return;
    for (let offset = 0; offset < data.byteLength;) {
      const absolute = position + offset;
      const index = Math.floor(absolute / this.pageBytes);
      const within = absolute % this.pageBytes;
      const count = Math.min(this.pageBytes - within, data.byteLength - offset);
      const previous = this.pages.get(index) || new Blob();
      const parts: BlobPart[] = [previous.slice(0, within)];
      if (previous.size < within) parts.push(this.zeroPage.slice(0, within - previous.size));
      parts.push(data.subarray(offset, offset + count), previous.slice(within + count));
      this.pages.set(index, new Blob(parts));
      offset += count;
    }
    this.length = Math.max(this.length, end);
  }

  toBlob(): Blob {
    const parts: Blob[] = [];
    for (let position = 0; position < this.length; position += this.pageBytes) {
      const size = Math.min(this.pageBytes, this.length - position);
      const page = this.pages.get(position / this.pageBytes) || this.zeroPage;
      parts.push(page.slice(0, size));
      if (page.size < size) parts.push(this.zeroPage.slice(0, size - page.size));
    }
    return new Blob(parts, { type: 'video/mp4' });
  }
}

/** Keeps encoded output out of one growing, contiguous JavaScript ArrayBuffer. */
export function createVideoTarget(maxBytes = LIMITS.outputBytes) {
  const store = new VideoBlobStore(maxBytes);
  const target = new StreamTarget(new WritableStream({
    write: ({ data, position }) => store.write(data, position),
  }), { chunked: true, chunkSize: VIDEO_OUTPUT_CHUNK_BYTES });
  return { target, getBlob: () => store.toBlob() };
}
