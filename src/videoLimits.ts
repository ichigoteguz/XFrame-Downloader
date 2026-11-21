import { LIMITS } from './types';

export const VIDEO_DURATION_LIMIT = `${LIMITS.videoSeconds / 60} minutes`;

export function assertSourceSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) throw new Error('The video file is empty. Try loading the post again.');
  if (size > LIMITS.sourceBytes) throw new Error(`This video exceeds the ${LIMITS.sourceBytes / 1024 / 1024} MiB input limit. Choose 720p or another attachment.`);
}

export function assertOutputSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) throw new Error('The encoder produced an empty file. Please try again.');
  if (size > LIMITS.outputBytes) throw new Error(`This framed video exceeds the ${LIMITS.outputBytes / 1024 / 1024} MiB output limit. Choose 720p or a smaller background.`);
}

export function assertVideoDuration(duration: number): void {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('The video duration could not be read.');
  // Container timescales can round a final sample slightly past the nominal ending.
  if (duration > LIMITS.videoSeconds + 0.1) throw new Error(`Video export supports clips up to ${VIDEO_DURATION_LIMIT}. Choose another attachment or export a still image.`);
}
