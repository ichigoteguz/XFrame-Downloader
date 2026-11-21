import { afterEach, expect, it, vi } from 'vitest';
import { fetchVideo } from './video';
import type { PostMedia } from './types';

vi.mock('./types', async importOriginal => {
  const actual = await importOriginal<typeof import('./types')>();
  return { ...actual, LIMITS: { ...actual.LIMITS, sourceBytes: 16 } };
});

const media: PostMedia = { id: 'long', type: 'video', url: 'https://video.twimg.com/video.mp4', thumbnail: '', width: 1280, height: 720, duration: 600, formats: [] };
afterEach(() => vi.unstubAllGlobals());
function prepare(response: Response) {
  vi.stubGlobal('location', { href: 'https://ichigoteguz.github.io/XFrame-Downloader/' });
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

it('downloads a ten-minute source and reports byte progress with a known total', async () => {
  prepare(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-length': '3' } }));
  const progress = vi.fn();
  expect((await fetchVideo(media, 720, undefined, progress)).size).toBe(3);
  expect(progress.mock.calls.map(([value]) => value)).toEqual([{ loaded: 0, total: 3 }, { loaded: 3, total: 3 }]);
});

it('checks the real file when provider duration is unknown or zero', async () => {
  const fetchMock = prepare(new Response(new Uint8Array([1])));
  await fetchVideo({ ...media, duration: 0 }, 720);
  expect(fetchMock).toHaveBeenCalledOnce();
});

it('rejects overlong metadata before a network request', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  await expect(fetchVideo({ ...media, duration: 601 }, 720)).rejects.toThrow('10 minutes');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('cancels an oversized response from its headers without retaining the body', async () => {
  const cancel = vi.fn();
  prepare(new Response(new ReadableStream({ cancel }), { headers: { 'content-length': '17' } }));
  await expect(fetchVideo(media, 720)).rejects.toThrow('input limit');
  expect(cancel).toHaveBeenCalledOnce();
});

it('enforces the input cap when the server does not provide a content length', async () => {
  const cancel = vi.fn();
  prepare(new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(10)); controller.enqueue(new Uint8Array(10)); }, cancel })));
  await expect(fetchVideo(media, 720)).rejects.toThrow('input limit');
  expect(cancel).toHaveBeenCalledOnce();
});

it('reports bytes without an invented percent when content length is unavailable', async () => {
  prepare(new Response(new Uint8Array([1, 2])));
  const progress = vi.fn();
  await fetchVideo(media, 720, undefined, progress);
  expect(progress).toHaveBeenLastCalledWith({ loaded: 2, total: undefined });
});

it('aborts a stalled download, closes its reader, and permits a fresh retry', async () => {
  const cancel = vi.fn();
  const controller = new AbortController();
  prepare(new Response(new ReadableStream({ cancel })));
  let loading!: () => void;
  const started = new Promise<void>(resolve => { loading = resolve; });
  const result = fetchVideo(media, 720, controller.signal, loading);
  const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  await started;
  controller.abort();
  await rejected;
  expect(cancel).toHaveBeenCalledOnce();
  prepare(new Response(new Uint8Array([1, 2, 3])));
  expect((await fetchVideo(media, 720)).size).toBe(3);
});
