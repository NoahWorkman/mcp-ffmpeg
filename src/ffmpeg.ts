import { execute } from "./execute.js";
import { ENCODING, PROTOCOL_WHITELIST, TIMEOUTS } from "./constants.js";
import { runProbe, checkRenderReady } from "./ffprobe.js";
import type { TransformResult } from "./types.js";

async function runTransform(
  args: readonly string[],
  description: string,
  inputPath: string,
  outputPath: string,
): Promise<TransformResult> {
  const inputInfo = await runProbe(inputPath);

  await execute({
    command: "ffmpeg",
    args,
    description,
    timeoutMs: TIMEOUTS.transform,
  });

  const outputInfo = await runProbe(outputPath);
  const validation = checkRenderReady(outputInfo);

  return {
    success: true,
    validation,
    output: outputInfo,
    input: inputInfo,
  };
}

function metadataFlags(stripMetadata: boolean): string[] {
  return stripMetadata ? ["-map_metadata", "-1"] : ["-map_metadata", "0"];
}

export async function stripAudio(
  inputPath: string,
  outputPath: string,
  stripMeta: boolean = false,
): Promise<TransformResult> {
  return runTransform(
    [
      "-protocol_whitelist", PROTOCOL_WHITELIST,
      "-i", inputPath,
      "-c:v", "copy",
      "-an",
      ...metadataFlags(stripMeta),
      "-y",
      outputPath,
    ],
    `Strip audio: ${inputPath}`,
    inputPath,
    outputPath,
  );
}

export async function reencodeH264(
  inputPath: string,
  outputPath: string,
  crf: number = ENCODING.crf,
  stripMeta: boolean = false,
): Promise<TransformResult> {
  return runTransform(
    [
      "-protocol_whitelist", PROTOCOL_WHITELIST,
      "-i", inputPath,
      "-c:v", ENCODING.videoCodec,
      "-crf", String(crf),
      "-preset", ENCODING.preset,
      "-pix_fmt", ENCODING.pixelFormat,
      "-movflags", ENCODING.movFlags,
      "-c:a", "copy",
      ...metadataFlags(stripMeta),
      "-y",
      outputPath,
    ],
    `Re-encode to H.264: ${inputPath}`,
    inputPath,
    outputPath,
  );
}

export async function resampleAudio(
  inputPath: string,
  outputPath: string,
  sampleRate: number = ENCODING.audioSampleRate,
  stripMeta: boolean = false,
): Promise<TransformResult> {
  return runTransform(
    [
      "-protocol_whitelist", PROTOCOL_WHITELIST,
      "-i", inputPath,
      "-c:v", "copy",
      "-ar", String(sampleRate),
      ...metadataFlags(stripMeta),
      "-y",
      outputPath,
    ],
    `Resample audio to ${sampleRate}Hz: ${inputPath}`,
    inputPath,
    outputPath,
  );
}

export async function cropPortrait(
  inputPath: string,
  outputPath: string,
  xOffset: number,
  targetWidth: number = 1080,
  targetHeight: number = 1920,
  stripMeta: boolean = false,
): Promise<TransformResult> {
  // Calculate crop dimensions from source
  // For 1920x1080 source -> 607:1080 crop at xOffset, then scale to target
  const inputInfo = await runProbe(inputPath);
  const sourceHeight = inputInfo.videoStream?.height ?? 1080;
  const cropWidth = Math.round(sourceHeight * (targetWidth / targetHeight));

  return runTransform(
    [
      "-protocol_whitelist", PROTOCOL_WHITELIST,
      "-i", inputPath,
      "-vf", `crop=${cropWidth}:${sourceHeight}:${xOffset}:0,scale=${targetWidth}:${targetHeight}`,
      "-c:v", ENCODING.videoCodec,
      "-crf", String(ENCODING.crf),
      "-an",
      ...metadataFlags(stripMeta),
      "-y",
      outputPath,
    ],
    `Crop portrait (x=${xOffset}): ${inputPath}`,
    inputPath,
    outputPath,
  );
}

export async function extractAudio(
  inputPath: string,
  outputPath: string,
  format: "wav" | "mp3" = "wav",
  stripMeta: boolean = false,
): Promise<TransformResult> {
  const codecArgs =
    format === "wav"
      ? ["-c:a", "pcm_s16le"]
      : ["-c:a", "libmp3lame", "-b:a", ENCODING.audioBitrate];

  return runTransform(
    [
      "-protocol_whitelist", PROTOCOL_WHITELIST,
      "-i", inputPath,
      "-vn",
      ...codecArgs,
      "-ar", String(ENCODING.audioSampleRate),
      ...metadataFlags(stripMeta),
      "-y",
      outputPath,
    ],
    `Extract audio (${format}): ${inputPath}`,
    inputPath,
    outputPath,
  );
}
