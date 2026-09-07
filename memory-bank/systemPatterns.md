# System Patterns

- Shell + tabs: `src/components/app-shell.tsx`
- Image UI: `src/components/image-workspace.tsx` → `/`
- Video UI: `src/components/video-workspace.tsx` → `/video`
- Docs UI: `src/components/docs-workspace.tsx` → `/docs`
- Icons: `src/components/icons.tsx`
- Image: `src/lib/format.ts` + `src/lib/image.ts` + `POST /api/process`
- Video: `src/lib/video-format.ts` + `src/lib/video.ts` + `POST /api/process-video` (ffmpeg-static)
- Video path: stream `File` → temp in → ffmpeg → stream temp out (cleanup sau response)
- Docs: `src/lib/doc-format.ts` + `src/lib/doc.ts` + `POST /api/process-doc` (xlsx, pdfkit, mammoth, pdf-parse)
