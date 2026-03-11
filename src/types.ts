export type FfmpegTask = {
  readonly command: "ffmpeg" | "ffprobe";
  readonly args: readonly string[];
  readonly description: string;
  readonly timeoutMs?: number;
};

export type FfmpegResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

// Discriminated union for typed error handling
export type FfmpegError =
  | { readonly _tag: "SpawnError"; readonly message: string }
  | { readonly _tag: "TimeoutError"; readonly message: string; readonly timeoutMs: number }
  | {
      readonly _tag: "ProcessError";
      readonly message: string;
      readonly exitCode: number;
      readonly stderr: string;
      readonly errors: readonly string[];
    };

export const FfmpegError = {
  spawn: (message: string): FfmpegError => ({ _tag: "SpawnError", message }),
  timeout: (message: string, timeoutMs: number): FfmpegError => ({
    _tag: "TimeoutError",
    message,
    timeoutMs,
  }),
  process: (
    message: string,
    exitCode: number,
    stderr: string,
    errors: readonly string[],
  ): FfmpegError => ({
    _tag: "ProcessError",
    message,
    exitCode,
    stderr,
    errors,
  }),
};

// ffprobe JSON output types
export type RawProbeStream = {
  readonly index: number;
  readonly codec_name?: string;
  readonly codec_long_name?: string;
  readonly codec_type?: string;
  readonly width?: number;
  readonly height?: number;
  readonly r_frame_rate?: string;
  readonly avg_frame_rate?: string;
  readonly duration?: string;
  readonly bit_rate?: string;
  readonly sample_rate?: string;
  readonly channels?: number;
  readonly channel_layout?: string;
  readonly tags?: Record<string, string>;
};

export type RawProbeFormat = {
  readonly filename?: string;
  readonly format_name?: string;
  readonly format_long_name?: string;
  readonly duration?: string;
  readonly size?: string;
  readonly bit_rate?: string;
  readonly nb_streams?: number;
  readonly tags?: Record<string, string>;
};

export type RawProbeOutput = {
  readonly streams?: readonly RawProbeStream[];
  readonly format?: RawProbeFormat;
};

// Normalized probe output
export type StreamInfo = {
  readonly index: number;
  readonly type: string;
  readonly codec: string;
  readonly codecLong: string;
  readonly width?: number;
  readonly height?: number;
  readonly frameRate?: number;
  readonly duration?: number;
  readonly bitRate?: number;
  readonly sampleRate?: number;
  readonly channels?: number;
  readonly channelLayout?: string;
  readonly tags: Record<string, string>;
};

export type FormatInfo = {
  readonly filename: string;
  readonly formatName: string;
  readonly formatLong: string;
  readonly duration: number;
  readonly size: number;
  readonly bitRate: number;
  readonly streamCount: number;
  readonly tags: Record<string, string>;
};

export type MediaInfo = {
  readonly format: FormatInfo;
  readonly streams: readonly StreamInfo[];
  readonly videoStream?: StreamInfo;
  readonly audioStream?: StreamInfo;
};

export type ValidationResult = {
  readonly ready: boolean;
  readonly issues: readonly string[];
};

export type TransformResult = {
  readonly success: boolean;
  readonly validation: ValidationResult;
  readonly output: MediaInfo;
  readonly input: MediaInfo;
};
