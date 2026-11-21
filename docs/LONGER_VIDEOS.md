# Longer video exports

Developed with OpenAI Codex.

The v1.1.0 milestone raises the duration limit from two to ten minutes, the input limit from 100 to 256 MiB, and adds a separate 512 MiB output limit. The pixel and frame-rate limits remain the same.

The worker now uses Mediabunny's seekable StreamTarget and 1 MiB chunks, assembled as paged Blobs. This preserves ordinary fast-start MP4, including final header rewrites, without growing and copying one contiguous JavaScript ArrayBuffer. Actual output extent is checked before retaining new bytes. Source downloads check both declared and received sizes and can be canceled and retried.

This is a bounded intermediate step. Browser-managed Blob storage can still consume significant resources; it does not guarantee disk-backed storage or constant total memory. A long high-bitrate source may hit the input limit, and a large or detailed frame may hit the output limit before ten minutes. Choosing 720p usually reduces both costs. The benchmark is a reproducible fixture, not a performance guarantee for real videos or all devices.

## Toward as long as practical

The next milestone should use disk-backed input and seekable disk output, with quotas and cleanup designed before increasing the duration cap again:

1. Stream source bytes into temporary local storage, or use a bounded range-based input reader when X CDN range and CORS behavior allows it. Avoid retaining the complete source in JavaScript buffers.
2. Write the worker's existing StreamTarget directly to a chosen file or origin-private temporary file. Preserve ordinary MP4 seeking and final metadata rewrites. Treat browser file APIs as capabilities, with the bounded Blob path as a fallback.
3. Handle disk quota and low-space failures, canceled and failed writes, stale temporary files after tab closure, and download lifetime. A worker terminated during export must not leave persistent partial files indefinitely.
4. Validate longer real sources, high motion, variable frame rates, audio synchronization, cancellation late in a run, and repeated exports. Measure memory and disk use before replacing the ten-minute guard with practical resource limits.

The chunked worker target is a reusable boundary for this work. Disk-backed output alone is insufficient while the entire source is still downloaded and cached. A backend is not required for this direction; media composition can remain local to the user's browser.
