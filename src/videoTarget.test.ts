import { describe, expect, it } from 'vitest';
import { ALL_FORMATS, BlobSource, Conversion, EncodedPacket, EncodedPacketSink, EncodedVideoPacketSource, Input, Mp4OutputFormat, Output } from 'mediabunny';
import { createVideoTarget, VideoBlobStore, VIDEO_OUTPUT_CHUNK_BYTES } from './videoTarget';

const bytes = async (blob: Blob) => [...new Uint8Array(await blob.arrayBuffer())];

describe('paged video output', () => {
  it('appends across pages and rewrites a reserved header without changing media bytes', async () => {
    const store = new VideoBlobStore(32, 4);
    store.write(new Uint8Array([0, 0, 0, 0, 5, 6, 7, 8, 9]), 0);
    store.write(new Uint8Array([1, 2, 3, 4]), 0);
    store.write(new Uint8Array([10, 11]), 9);
    expect(store.size).toBe(11);
    expect(await bytes(store.toBlob())).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(store.toBlob().type).toBe('video/mp4');
  });

  it('preserves both sides of partial overwrites spanning page boundaries', async () => {
    const store = new VideoBlobStore(32, 4);
    store.write(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), 0);
    store.write(new Uint8Array([20, 21, 22, 23, 24]), 2);
    expect(await bytes(store.toBlob())).toEqual([1, 2, 20, 21, 22, 23, 24, 8, 9]);
  });

  it('zero-fills sparse gaps and snapshots the bytes before the producer reuses them', async () => {
    const store = new VideoBlobStore(32, 4);
    const chunk = new Uint8Array([7, 8]);
    store.write(chunk, 9);
    chunk.fill(0);
    store.write(new Uint8Array([3]), 2);
    expect(await bytes(store.toBlob())).toEqual([0, 0, 3, 0, 0, 0, 0, 0, 0, 7, 8]);
  });

  it('rejects an excessive extent before changing the accepted output', async () => {
    const store = new VideoBlobStore(8, 4);
    store.write(new Uint8Array([1, 2]), 0);
    expect(() => store.write(new Uint8Array([9, 9]), 7)).toThrow('export limit');
    expect(store.size).toBe(2);
    expect(await bytes(store.toBlob())).toEqual([1, 2]);
    store.write(new Uint8Array([8]), 7);
    expect(store.toBlob().size).toBe(8);
    expect(() => store.write(new Uint8Array([1]), -1)).toThrow('position');
  });

  it('round-trips a regular fast-start MP4 through chunk flushing and final metadata rewrites', async () => {
    const { target, getBlob } = createVideoTarget(3 * VIDEO_OUTPUT_CHUNK_BYTES);
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'reserve' }), target });
    const source = new EncodedVideoPacketSource('avc');
    output.addVideoTrack(source, { frameRate: 1, maximumPacketCount: 3 });
    await output.start();
    // Container/packet fixture only: the payload is deliberately not a decodable picture.
    const packet = new Uint8Array(VIDEO_OUTPUT_CHUNK_BYTES + 17);
    packet.set([0, 0, 0, 2, 0x65, 0x88]);
    const config = { codec: 'avc1.42001e', codedWidth: 16, codedHeight: 16, description: new Uint8Array([1, 0x42, 0, 0x1e, 0xff, 0xe1, 0, 9, 0x67, 0x42, 0, 0x1e, 0x95, 0xa8, 0x28, 0x0f, 0, 1, 0, 4, 0x68, 0xce, 0x3c, 0x80]) };
    await source.add(new EncodedPacket(packet, 'key', 0, 1), { decoderConfig: config });
    await source.add(new EncodedPacket(new Uint8Array([0, 0, 0, 2, 0x65, 0x99]), 'key', 1, 1));
    source.close();
    await output.finalize();
    const blob = getBlob();
    const file = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(file.buffer);
    const boxes: string[] = [];
    for (let position = 0; position < file.length;) {
      boxes.push(String.fromCharCode(...file.subarray(position + 4, position + 8)));
      const size = view.getUint32(position);
      position += size === 1 ? Number(view.getBigUint64(position + 8)) : size;
      if (size === 0) break;
    }
    expect(boxes).toContain('moov');
    expect(boxes.indexOf('moov')).toBeLessThan(boxes.indexOf('mdat'));
    expect(boxes).not.toContain('moof');
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    try {
      const track = await input.getPrimaryVideoTrack();
      expect(track).not.toBeNull();
      expect(await track!.computeDuration()).toBeCloseTo(2);
      const sink = new EncodedPacketSink(track!);
      const actual: EncodedPacket[] = [];
      for await (const value of sink.packets()) actual.push(value);
      expect(actual).toHaveLength(2);
      expect(actual[0].data).toEqual(packet);
      expect(actual[1].timestamp).toBe(1);

      // Exercise the same Conversion.execute failure path as the export worker.
      // Remux the fixture without decoding its synthetic picture payload.
      const limited = createVideoTarget(VIDEO_OUTPUT_CHUNK_BYTES);
      const limitedOutput = new Output({ format: new Mp4OutputFormat({ fastStart: 'reserve' }), target: limited.target });
      try {
        const conversion = await Conversion.init({ input, output: limitedOutput, tracks: 'primary', showWarnings: false });
        expect(conversion.isValid).toBe(true);
        await expect(conversion.execute()).rejects.toThrow('export limit');
        expect(limited.getBlob().size).toBeLessThanOrEqual(VIDEO_OUTPUT_CHUNK_BYTES);
      } finally { await limitedOutput.cancel().catch(() => undefined); }
    } finally { input.dispose(); }
  });
});
