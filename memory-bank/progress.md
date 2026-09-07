# Progress

## Done

- Batch upload / resize / convert images
- Max W + Max KB targeting (images)
- Output filename matches format
- ZIP download
- Single-screen layout
- Tabs Ảnh / Video (left of header)
- Video convert: MP4 · WebM · MOV · GIF (no WebP)
- Video default quality 100% + encode (preset medium / CRF)
- Per-page SEO (EN): `/` images, `/video` video + sitemap/robots
- Video API streams upload/output via temp files (no full-file ArrayBuffer)
- Temp input giữ đuôi file gốc; tab Ảnh/Video không khóa khi đang xử lý
- Tab **Docs** (`/docs`): convert PDF · Excel · CSV · HTML · DOCX · TXT · MD

## Later

- EXIF strip toggle
- Video max duration / max MB targeting
- Multipart parse thẳng ra disk (tránh formData giữ blob lớn trong RAM)
- Docs: PDF layout đẹp hơn (giữ bảng/format), Word xuất ngược
