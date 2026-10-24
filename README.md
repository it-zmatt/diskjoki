# mp3-converter

A single-page React + Vite + TypeScript app that converts local audio and video files (WAV, FLAC, M4A, MP4, WebM, …) to MP3 entirely in the browser using [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm). No uploads: files never leave your device.

## Run it

```bash
cd mp3-converter
npm install
npm run dev
```

Then open http://localhost:5173. Other scripts:

- `npm run build` builds into `dist/`
- `npm run preview` serves the production build (with the same isolation headers)

`vite.config.ts` sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on both servers, as ffmpeg.wasm requires. If you deploy elsewhere, your host must send them too. The ffmpeg core (~30 MB) is fetched from unpkg on the first conversion and then reused.

## How it works

`src/lib/ffmpeg.ts` loads ffmpeg once, writes the dropped file into ffmpeg's virtual filesystem, runs

```
ffmpeg -i input.<ext> -vn -codec:a libmp3lame -b:a <bitrate> output.mp3
```

reads `output.mp3` back as an `audio/mpeg` Blob, and cleans up the virtual files. `-vn` drops any video stream, so video files work too. `src/hooks/useConverter.ts` tracks the `idle → loading → converting → done | error` states for the UI.

## Choosing a bitrate

MP3 is lossy: the encoder throws away sound it predicts you won't hear. Bitrate is how many bits per second of audio it's allowed to keep, so file size grows in a straight line with bitrate: roughly **bitrate × duration ÷ 8**.

| Bitrate | Size per minute | Quality |
|---|---|---|
| **128k** | ~0.96 MB | Fine for speech, podcasts and casual listening. Cymbals and reverb tails can sound swishy or smeared on good headphones. |
| **192k** | ~1.44 MB | A good default. Most people can't tell it from the source on everyday gear. |
| **320k** | ~2.4 MB | The highest MP3 allows. Hard to tell from the original, but 2.5× the size of 128k. |

A 4-minute song from a ~40 MB WAV comes out at about 3.8 MB at 128k, 5.8 MB at 192k and 9.6 MB at 320k. Try one file at all three and compare the sizes in the download card.

Encoding above the source quality gains nothing: converting a 128k file to 320k only makes it bigger.
