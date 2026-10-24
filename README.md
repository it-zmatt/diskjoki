# diskjoki

A single-page React + Vite + TypeScript app that turns a link into an MP3. Paste a direct link to an audio or video file (WAV, FLAC, M4A, MP4, WebM, …) or a YouTube-style page, and the conversion runs in the browser using [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm).

For a direct file link (for example `https://example.com/track.wav`) the browser downloads it and converts it locally. If the host blocks cross-origin requests (no `Access-Control-Allow-Origin`), the app retries through a small proxy built into the Vite dev and preview servers (`server/fetchProxy.ts`, served at `/api/fetch?url=…`), which downloads the file on your machine and passes it back. The proxy refuses local and private network addresses and files over 500 MB.

Web page links (YouTube, SoundCloud and other sites [yt-dlp](https://github.com/yt-dlp/yt-dlp) supports) also work through the proxy: when a link returns a page instead of a file, the proxy runs `yt-dlp` to download just the audio track (playlists are ignored, so a `&list=` link gets the one video) and hands that to the converter. This needs `yt-dlp` on your PATH:

```bash
brew install yt-dlp
```

Only download content you have the rights to; YouTube's terms don't allow downloading outside its own apps.

## Run it

```bash
git clone https://github.com/it-zmatt/diskjoki.git
cd diskjoki
npm install
npm run dev
```

Then open http://localhost:5173. Other scripts:

- `npm run build` builds into `dist/`
- `npm run preview` serves the production build (with the same isolation headers)

`vite.config.ts` sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on both servers, as ffmpeg.wasm requires. If you deploy elsewhere, your host must send them too. The ffmpeg core (~30 MB) is fetched from unpkg on the first conversion and then reused.

## Running the full app on a server (YouTube included)

`server/index.ts` is a small Node server (no dependencies) that serves the built app plus the full `/api/fetch` proxy, including `yt-dlp` for page links. The `Dockerfile` packages it with `yt-dlp` and Deno (which yt-dlp needs for YouTube).

```bash
docker build -t diskjoki .
docker run -p 8080:8080 diskjoki
```

**Render:** New → Blueprint → pick this repo. `render.yaml` sets up a Docker web service. Its URL (e.g. `https://diskjoki.onrender.com`) is a complete copy of the app.

To keep using the Netlify site with this server, set `VITE_API_URL` to the server's URL in Netlify (Site configuration → Environment variables) and redeploy. The server only accepts browser requests from the origins in `ALLOWED_ORIGINS`.

Server settings (environment variables):

| Variable | Default | |
|---|---|---|
| `PORT` | `8080` | |
| `ALLOWED_ORIGINS` | none | Other sites allowed to call `/api/fetch`, comma-separated |
| `RATE_LIMIT_PER_HOUR` | `30` | `/api/fetch` requests per IP |
| `YT_DLP_MAX_JOBS` | `2` | yt-dlp downloads at once |
| `YT_DLP_COOKIES` | none | Path to a cookies file, if YouTube asks the server to sign in |

Caveats: YouTube often blocks cloud servers with "Sign in to confirm you're not a bot"; if that happens, a cookies file from a throwaway account usually gets past it. yt-dlp needs frequent updates, so redeploy (rebuild the image) when page links start failing. Render's free plan sleeps when idle, so the first download after a while can take up to a minute.

`npm start` runs the same server without Docker (after `npm run build`; needs Node 22.18+ and `yt-dlp` on PATH).

## Deploying to Netlify

`netlify.toml` builds the app, sends the cross-origin isolation headers ffmpeg.wasm needs, and deploys `netlify/functions/fetch.ts` at `/api/fetch`. On Netlify:

- Direct links to audio or video files work, including hosts that block cross-origin downloads, up to 20 MB (Netlify's limit for streamed function responses).
- Web page links such as YouTube don't, because Netlify functions can't run `yt-dlp`, unless `VITE_API_URL` points the site at the server above.

## How it works

`src/lib/source.ts` fetches a pasted link into a `File` (reusing it if you convert the same link again at another quality), and `src/lib/ffmpeg.ts` loads ffmpeg once, writes the file into ffmpeg's virtual filesystem, runs

```
ffmpeg -i input.<ext> -vn -codec:a libmp3lame -b:a <bitrate> output.mp3
```

reads `output.mp3` back as an `audio/mpeg` Blob, and cleans up the virtual files. `-vn` drops any video stream, so video files work too. `src/hooks/useConverter.ts` tracks the `idle → fetching → loading → converting → done | error` states for the UI, which is styled like a Mac OS X 10.2-era Aqua window with an iTunes-style status display.

## Choosing a bitrate

MP3 is lossy: the encoder throws away sound it predicts you won't hear. Bitrate is how many bits per second of audio it's allowed to keep, so file size grows in a straight line with bitrate: roughly **bitrate × duration ÷ 8**.

| Bitrate | Size per minute | Quality |
|---|---|---|
| **128k** | ~0.96 MB | Fine for speech, podcasts and casual listening. Cymbals and reverb tails can sound swishy or smeared on good headphones. |
| **192k** | ~1.44 MB | A good default. Most people can't tell it from the source on everyday gear. |
| **320k** | ~2.4 MB | The highest MP3 allows. Hard to tell from the original, but 2.5× the size of 128k. |

A 4-minute song from a ~40 MB WAV comes out at about 3.8 MB at 128k, 5.8 MB at 192k and 9.6 MB at 320k. Try one file at all three and compare the sizes in the download card.

Encoding above the source quality gains nothing: converting a 128k file to 320k only makes it bigger.
