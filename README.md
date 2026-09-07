# Pixora

Resize, compress, and convert images & videos (JPEG / PNG / WebP / AVIF · MP4 / WebM / MOV / GIF).

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Features

- Batch image & video upload
- Max width + max size targeting
- Format convert with matching file extensions
- Per-file download or ZIP

## Docker

```bash
DOCKER_BUILD=1 docker build -t pixora .
docker run -p 3000:3000 pixora
```

Dockerfile needs `ENV DOCKER_BUILD=1` before `npm run build`.
