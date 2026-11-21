# Verification

Implementation and browser validation began November 9, 2026 (America/New_York).

## Ten-minute video milestone — November 20, 2026

The checks below were performed locally before the v1.1.0 release. GitHub Actions tests, builds, and deploys the release commit to GitHub Pages.

- Raised application guardrails to 600 seconds, 256 MiB input, and 512 MiB output. Replaced the worker's growing contiguous output buffer with seekable 1 MiB chunks and paged Blob storage. Regular fast-start MP4, AAC passthrough, and pixel limits are preserved.
- All 83 unit tests, TypeScript, and the production build passed. Tests cover input limits with and without Content-Length, canceled stalled downloads and retry, duration boundaries, paged header rewrites, sparse writes, regular MP4 mux/parse, and actual Conversion failure at the output cap.
- The in-app Chromium 158 browser generated a 600-second 1280 × 720 H.264/AAC source (161,634,963 bytes), canceled export after 5% progress, then successfully exported the complete source to a 1440 × 1746 regular H.264/AAC MP4 (191,830,074 bytes). Source generation took 59.445 seconds and full export 138.740 seconds; the complete test took 206.765 seconds. Timings describe this fixture and computer, not general performance.
- All 28,125 encoded AAC packet payloads matched the source. An independent packet scan found all 18,000 video packets, from timestamp 0 through 599.9667 seconds. Audio synchronization was not instrumented.
- Visual review exposed a stale first-frame canvas texture after an HTMLVideo seek to the ending. The exported video was correct. The harness now extracts canonical stills through Mediabunny CanvasSink, validates decoded timestamps, and records browser seek diagnostics separately. Independent verification of the downloaded ten-minute MP4 decoded frames at 0.1, 300, and 599.8 seconds; clocks visibly read 00:00.10, 05:00.00, and 09:59.80. Browser seeks reached each requested time with readyState 4 and a seekable range of 0–600 seconds. Original source audio comparison belongs to the full export run, not this separate file-verification pass.
- The short smoke test also covers silent portrait input, repeated export, PNG, and JPEG. The actual emoji regression post exported through the main studio at 810 × 1606 pixels, confirming provider retrieval, source loading, static capture, worker composition, and download initiation remain functional.

Reports and images are retained under ignored .qa/: long-video-ten-minute-report.json, long-video-decoded-report.json, long-video-first.png, long-video-middle.png, and long-video-final.png. The full output was downloaded separately to long-video-output.mp4 because the dev artifact endpoint deliberately skips MP4 files above 128 MiB. The benchmark and artifact endpoint are absent from production builds.

Input and output still use browser-managed Blob storage. Total RAM was not instrumented; maximum-size inputs/outputs, high-motion 1080p, standalone browsers, and phones were not validated. See [the roadmap](LONGER_VIDEOS.md) for disk-backed input/output, cleanup, and quota handling before increasing the duration limit again.

## Emoji export regression — November 20, 2026

Reproduced `URI malformed` on the public site when exporting post `2123796985161322997`. Its ordinary-post display range `[0, 35]` counts Unicode code points. Treating that range as UTF-16 truncated the three trailing laughing emojis to one emoji and an unpaired surrogate, which failed during SVG URI encoding in `html-to-image`.

The provider adapter now converts ordinary-post display ranges and all X facet ranges to JavaScript offsets. Note posts retain FxTwitter's synthesized full UTF-16 display range. Regression coverage includes the reported text, visible-range start/end offsets, link and emphasis mapping after emoji, and media-link removal.

All 69 tests, TypeScript, and the production build passed using the installed Vitest, TypeScript, and Vite executables directly. The pnpm launcher attempted to register the existing project in an inaccessible sandbox store, so validation used those executables without installing or changing dependencies.

The in-app browser loaded the actual post against the fixed local app, displayed all three emojis, and completed its 720p framed MP4 export at 810 × 1606 pixels. The UI confirmed “Your framed video is ready. Download started.” Evidence is saved under ignored `.qa/uri-malformed-fixed.jpg`. This validates the local fix; it does not represent a deployment to GitHub Pages.

## Executed browser checks

Microsoft Edge 157 on the owner's Windows computer, November 9, 2026 Eastern:

| Check | Result |
| --- | --- |
| Two-minute 1280×720, 30 fps H.264/AAC source | Generated offline in 7.7 seconds |
| Framed export, dark post plus quote, 1440×1746 | Completed in 34.9 seconds |
| Output | 120 seconds, H.264 + AAC, 15,888,946 bytes |
| Audio passthrough | All 5,625 AAC packet payloads identical to source |
| Playback frame extraction | First, middle, final seek succeeded; frame visually inspected |
| Three-second smoke test | Completed; silent portrait source retained no audio track |
| Cancellation and repeat export | AbortError returned; subsequent export succeeded |
| Static formats | Genuine PNG and JPEG MIME types |

The first smoke run exposed an incorrectly positioned root in the test harness's static capture. The harness was corrected to capture the same inner frame component as the application. The corrected full two-minute export visibly includes author/avatar, text, selected moving video, quote, and timestamp. The application renderer was not affected by that harness error.

These measured timings describe a synthetic fixture on this computer, not general performance guarantees. Browser memory was not instrumented. Edge is directly tested; standalone Chrome, mobile browsers, variable-frame-rate sources, and rotation metadata still require broader coverage. Local reports and videos are under ignored `.qa/`.

## Code checks

- TypeScript and production Vite build passed.
- All 53 unit tests passed after review refinements, including H.264 source preference and CDN referrer handling.
- Production dependency audit reported no known vulnerabilities.
- GitHub Actions run `42729702135` passed its install, test, and production build job on commit `216dd004099a4697311cf9930fc1b7a165d74d94`. Public deployment was intentionally skipped because the repository is private.
- The documentation checkpoint also passed CI (`42729880571`, commit `198e5a54456295a1c955505c385c2ece64088609`). Windows native file-watcher EBUSY crashes were observed when large QA artifacts and a workflow file were written; QA/docs/workflow directories are now ignored and Windows development uses polling. This affects the local dev server only.

## Real-post check

Loaded the reference downloader's example public post, `1903302115721629989`, through the actual UI. Author, text, avatar, and portrait video loaded. Source inspection resolved the selected 720×1280 MP4 and displayed the exact complete export size of 810×1566; the provider's original dimensions were larger. Cached-Blob video preview was observed playing.

This check found that X's CDN rejects a non-X Referer even while allowing our browser Origin. A direct comparison returned 206 without the referrer and 403 with the localhost referrer. The video fetch now explicitly uses `referrerPolicy: 'no-referrer'`; the same real post then downloaded into the browser's source cache successfully. A regression test covers that request policy.

## Stopping checkpoint

Stopped at the owner's request on November 9, 2026 Eastern. Core implementation, local build, 53 tests, the synthetic two-minute export, and private GitHub CI are complete. Repository remains private and Pages is not enabled.

Next: finish the real-post MP4 download through the main UI, check real text/photo exports and appearance controls, then enable public repository/Pages and smoke-test deployed worker paths and live retrieval. Standalone Chrome and phone testing remain unverified. Do not repeat GitHub authentication unless credentials have expired.

## Resumed release validation

On November 9, 2026 Eastern, the owner resumed work and requested the personal subtitle, bottom dedication, and Codex credit. All three are implemented; Codex is credited in the README, repository description, and private GitHub Projects entry.

- The actual xtoimage sample post, `1856142448721793197`, exported through the main UI as a 6,555,294-byte H.264 MP4 at 1194×1376 for its full 46.5 seconds. Its original selected source is silent (1062×720), and the output correctly remains silent.
- Don Pettit's photo post `1844748089560596542` exported as a light-theme PNG at 4×, 2400×4592. The long text and photo were visually inspected without clipping. This test exposed a stale FxEmbed media facet that pointed into full-note prose; the adapter now verifies the original URL span before suppressing a media link. Live normalization confirms all original note text is preserved, with a regression test added.
- The text-only post `20` exported as a Dim-theme JPEG with Sunset background, medium padding, 4:5 ratio, and 3× scale at 2112×2640.
- All 54 tests, TypeScript, and the production build pass. Private CI also passed the exact feature commit `44c908a` (run `42757674264`).
- The repository is now public and GitHub Pages uses the Actions workflow. Deployed URL: https://ichigoteguz.github.io/PostFrame/ . Deployment and live smoke-test results follow below.

## Public deployment smoke test

GitHub Actions deployment `42757919752` succeeded, followed by successful build/deploy run `42758132776` for the release documentation commit. The HTTPS page, generated JavaScript, CSS, and video worker all returned HTTP 200 at their `/PostFrame/` paths.

The live site was opened in Edge. The exact requested subtitle and bottom dedication were verified. Loading the Ozgur Ozer reference post from the deployed origin succeeded, and the deployed worker exported/downloaded the complete 46.5-second MP4 (6,559,030 bytes). The output is H.264 at 1194×1376 and correctly silent, matching the source's lack of an audio track. This verifies the production worker, post-provider CORS, direct media retrieval, frame capture, and download path together.

Release scope is complete. Remaining compatibility limits are the documented desktop-first video support, two-minute/100 MiB input guardrails, and unverified standalone Chrome/mobile coverage. The app continues to depend on FxTwitter and X CDN availability. The private project board records the public app, repository, Codex attribution, and validation results.

## Stable v1.0.0 release — November 10, 2026

The owner approved the XFrame Downloader logo, rebrand, and site themes. The rebrand commit `7da44dd` passed 64 tests, TypeScript, and the production build; GitHub Actions build and deploy run [42911635431](https://github.com/ichigoteguz/PostFrame/actions/runs/42911635431) succeeded. Live checks verified the XFrame Downloader title, light/dark logo assets, and site-theme selector. Local desktop/mobile checks verified both interface themes, persisted Dark after reload, and a successful sample PNG export. Site and export themes remain independent.

Version 1.0.0 is the first stable release, with the supported scope and compatibility limits recorded in [release notes](RELEASE_NOTES.md). The page dedication remains; it is absent from the README. The repository and deployed path remain PostFrame.

## Precision Studio / Night Signal — November 11, 2026

The owner selected RFAB concept A for the light site theme and B for the dark site theme. The local implementation uses dedicated text-free generated frame artwork, an open ivory light composition, and an inset dark console with separate matte panels, technical framing, and cyan actions. The SVG logo, complete export controls, dedication, and exact Codex credit are retained.

- All 64 existing tests pass. TypeScript and the production build pass. The two new production artwork files are included under the existing `/PostFrame/art/` base path; no service credential is needed by the app.
- Browser checks in the in-app browser verified both treatments, explicit Light and Dark persistence after reload, and independent Dark export styling. A local iframe fixture checked 375 px mobile and nominal 1280 px desktop layouts (1265 px client area after scrollbar), with no horizontal overflow in either theme. The mobile layout puts the preview before the controls. Both artwork files loaded successfully.
- A sample PNG exported under Light and another under Dark have the identical SHA-256 `0CAE0AE968A405C9728A3610867CAE6A3C1D8AE9FE87F2DFFB79A9A317DBC2C2`. This verifies that site styling did not change this export. The self-contained export CSS block is preserved byte-for-byte from HEAD.
- The existing three-second browser smoke test passed: 1440 × 1746 H.264 MP4 at 3 seconds with audio; all 141 source AAC packets preserved exactly; silent portrait retained no audio; cancellation and repeat export succeeded; PNG and JPEG MIME checks passed. The longer acceptance test was not repeated for this site-only visual change.
- System-theme resolution is covered by the existing unit tests; the existing live media-query listener is retained. A live OS theme change was not simulated during this review.
- Two additional RFAB artwork jobs completed at 3,360 tokens each, totaling 6,720 tokens. Account and job responses remain under ignored `.qa/rfab/`; public asset provenance is in the theme art manifest.

Review screenshots are retained locally in `.qa/precision-studio-desktop.jpg` and `.qa/night-signal-desktop.jpg`. The owner approved the implementation after local review and requested stopping the preview and publishing the changes to GitHub. The verification above was completed locally before publishing; the Pages workflow validates and deploys pushes to `main`.
