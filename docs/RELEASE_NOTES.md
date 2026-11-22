# v1.1.2 — Translated post links

Published November 22, 2026.

- Accept X and Twitter post links with a two-letter translation suffix, such as `/en`.
- Show the translated text first in previews and exports, label the source language when available, and place the original text below. If no translation is available, show the original post.

All 88 tests, TypeScript, and the production build passed. The [reported post](https://x.com/kenzoma1995/status/2124310644971208818/en) loaded in the browser with the English translation above the original Chinese text.

[Open XFrame Downloader](https://ichigoteguz.github.io/XFrame-Downloader/).

Developed with OpenAI Codex.

---

# v1.1.1 — Post text rendering fix

Published November 21, 2026.

- Fixed ampersands appearing as `&amp;` in post previews and exports. The app decodes X's text escapes while preserving link and formatting positions.

All 86 tests, TypeScript, and the production build passed. The [reported post](https://x.com/YaseenK7212/status/2124099643797836028) rendered with the correct ampersand in the shared post card.

[Open XFrame Downloader](https://ichigoteguz.github.io/XFrame-Downloader/).

Developed with OpenAI Codex.

---

# v1.1.0 — Ten-minute videos

Published November 20, 2026.

- Extend video exports to ten minutes, with 256 MiB input and 512 MiB output limits.
- Assemble regular fast-start MP4 output from bounded chunks while retaining original compatible AAC audio.
- Show source-download progress and allow cancellation and retry before export.
- Add a configurable long-video acceptance test with active export cancellation, retry, audio packet comparison, and first/middle/final playback checks.

Start with 720p for longer videos and keep the tab open until the download starts. Desktop Chrome and Edge with H.264/WebCodecs support remain the video target; maximum sizes and device compatibility still apply.

Verification: all 83 tests, TypeScript, and the production build passed. A full ten-minute H.264/AAC test exported successfully at 1440 × 1746, preserved all 28,125 AAC packet payloads, and passed beginning/middle/ending frame checks, cancellation, and retry. See [verification](VERIFICATION.md) for details and [the roadmap](LONGER_VIDEOS.md) for the next step toward practical disk-space limits.

[Open XFrame Downloader](https://ichigoteguz.github.io/XFrame-Downloader/).

Developed with OpenAI Codex.

---

# v1.0.1 — Emoji export fix

Published November 20, 2026.

- Fixed “URI malformed” when downloading posts containing emoji, including post `2123796985161322997`. Text ranges now preserve complete Unicode characters, and links and formatting after emoji map to the correct text.
- Updated the GitHub repository links and GitHub Pages asset path for the rename to `XFrame-Downloader`.
- Includes the distinct Precision Studio light theme and Night Signal dark theme introduced since v1.0.0.

Verification: all 69 tests, TypeScript, and the production build passed. The reported post successfully exported as a 720p framed MP4 in the in-app browser against the fixed local app.

[Open XFrame Downloader](https://ichigoteguz.github.io/XFrame-Downloader/).

Developed with OpenAI Codex.

---

# v1.0.0 — XFrame Downloader

First stable release, published November 10, 2026.

## What's included

- XFrame Downloader branding with the approved framed-X and gold download-arrow SVG logo, light/dark marks, and favicon.
- Logo-inspired ink, teal, and gold interface.
- System, Light, and Dark site themes with saved preferences and live system-theme updates, independent of exported post styling.
- Public X/Twitter posts exported as PNG/JPG images or framed MP4 video with audio.
- Quoted posts, attachment selection, post themes, backgrounds, padding, aspect ratios, and resolution controls.
- Rebranded download filenames and automatic migration of existing export preferences.
- Page dedication retained; README dedication removed.

Developed utilizing Codex.

## Verification

64 tests pass; TypeScript and the production build pass. GitHub Actions validated and deployed the rebrand. Live checks confirmed both site themes and logo assets; desktop/mobile interface checks, saved theme preference after reload, and a sample PNG export passed. Earlier release validation covered desktop Edge MP4 exports, audio preservation, cancellation, and two-minute synthetic video export (see [verification notes](VERIFICATION.md)).

## Supported scope and limits

Video export targets desktop Chromium with H.264 WebCodecs support. Desktop Edge video export was directly verified; mobile video export is not guaranteed. Video input is limited to two minutes and 100 MiB. Only public posts are supported; retrieval depends on FxTwitter and X CDN availability. Full threads, batch export, trimming, WebM, and GIF output remain outside this release.

[Open XFrame Downloader](https://ichigoteguz.github.io/PostFrame/). The existing repository and Pages path remain PostFrame so existing links continue to work.
