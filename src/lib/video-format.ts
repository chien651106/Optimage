export type VideoOutputFormat = "mp4" | "webm" | "mov" | "gif";

export const VIDEO_FORMATS: { id: VideoOutputFormat; label: string }[] = [
  { id: "mp4", label: "MP4" },
  { id: "webm", label: "WebM" },
  { id: "mov", label: "MOV" },
  { id: "gif", label: "GIF" },
];

export const VIDEO_FORMAT_EXT: Record<VideoOutputFormat, string> = {
  mp4: "mp4",
  webm: "webm",
  mov: "mov",
  gif: "gif",
};

export const VIDEO_FORMAT_MIME: Record<VideoOutputFormat, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  gif: "image/gif",
};

export const MAX_VIDEOS = 10;
/** 500MB per video */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
