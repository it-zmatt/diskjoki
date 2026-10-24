# Builds the app and runs server/index.ts, which serves it together with
# the /api/fetch proxy. yt-dlp (plus Deno, which it uses for YouTube) is
# installed so web page links work.

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl unzip \
  && rm -rf /var/lib/apt/lists/*

# yt-dlp changes often to keep up with YouTube, so take the latest release.
# Rebuild the image when downloads start failing.
RUN set -eux; \
  case "$(uname -m)" in \
    x86_64) ytdlp=yt-dlp_linux; deno=deno-x86_64-unknown-linux-gnu.zip ;; \
    aarch64) ytdlp=yt-dlp_linux_aarch64; deno=deno-aarch64-unknown-linux-gnu.zip ;; \
    *) echo "unsupported arch $(uname -m)"; exit 1 ;; \
  esac; \
  curl -fsSL -o /usr/local/bin/yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$ytdlp"; \
  chmod +x /usr/local/bin/yt-dlp; \
  curl -fsSL -o /tmp/deno.zip "https://github.com/denoland/deno/releases/latest/download/$deno"; \
  unzip -q /tmp/deno.zip -d /usr/local/bin; \
  rm /tmp/deno.zip; \
  yt-dlp --version; deno --version

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY server ./server

ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server/index.ts"]
