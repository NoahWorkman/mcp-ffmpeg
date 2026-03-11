import { describe, it, expect } from "vitest";
import {
  safeFloat,
  safeInt,
  parseFrameRate,
  toMediaInfo,
  checkRenderReady,
} from "../ffprobe.js";
import type { RawProbeOutput, MediaInfo } from "../types.js";

// --- safeFloat ---

describe("safeFloat", () => {
  it("parses valid float strings", () => {
    expect(safeFloat("3.14")).toBe(3.14);
    expect(safeFloat("48000")).toBe(48000);
    expect(safeFloat("0")).toBe(0);
    expect(safeFloat("0.001")).toBe(0.001);
  });

  it("returns undefined for missing/invalid values", () => {
    expect(safeFloat(undefined)).toBeUndefined();
    expect(safeFloat("")).toBeUndefined();
    expect(safeFloat("N/A")).toBeUndefined();
    expect(safeFloat("not-a-number")).toBeUndefined();
  });
});

// --- safeInt ---

describe("safeInt", () => {
  it("parses valid integer strings", () => {
    expect(safeInt("1920")).toBe(1920);
    expect(safeInt("0")).toBe(0);
    expect(safeInt("2")).toBe(2);
  });

  it("handles numeric input directly", () => {
    expect(safeInt(1080)).toBe(1080);
    expect(safeInt(0)).toBe(0);
  });

  it("returns undefined for missing/invalid values", () => {
    expect(safeInt(undefined)).toBeUndefined();
    expect(safeInt("")).toBeUndefined();
    expect(safeInt("N/A")).toBeUndefined();
  });
});

// --- parseFrameRate ---

describe("parseFrameRate", () => {
  it("parses fractional frame rates", () => {
    expect(parseFrameRate("30/1")).toBe(30);
    expect(parseFrameRate("24000/1001")).toBe(23.98);
    expect(parseFrameRate("60/1")).toBe(60);
    expect(parseFrameRate("25/1")).toBe(25);
  });

  it("parses simple numeric frame rates", () => {
    expect(parseFrameRate("29.97")).toBe(29.97);
    expect(parseFrameRate("30")).toBe(30);
  });

  it("returns undefined for invalid/missing values", () => {
    expect(parseFrameRate(undefined)).toBeUndefined();
    expect(parseFrameRate("0/0")).toBeUndefined();
    expect(parseFrameRate("N/A")).toBeUndefined();
    expect(parseFrameRate("")).toBeUndefined();
  });

  it("handles zero denominator", () => {
    expect(parseFrameRate("30/0")).toBeUndefined();
  });
});

// --- toMediaInfo ---

describe("toMediaInfo", () => {
  const sampleProbeOutput: RawProbeOutput = {
    format: {
      filename: "/test/video.mp4",
      format_name: "mov,mp4,m4a,3gp,3g2,mj2",
      format_long_name: "QuickTime / MOV",
      duration: "5.020333",
      size: "2549541",
      bit_rate: "4062744",
      nb_streams: 2,
      tags: {
        major_brand: "isom",
        encoder: "Lavf59.27.100",
        artist: "Test Artist",
      },
    },
    streams: [
      {
        index: 0,
        codec_name: "h264",
        codec_long_name: "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
        codec_type: "video",
        width: 1920,
        height: 1080,
        r_frame_rate: "30/1",
        duration: "5.005",
        bit_rate: "3935224",
        tags: { language: "und" },
      },
      {
        index: 1,
        codec_name: "aac",
        codec_long_name: "AAC (Advanced Audio Coding)",
        codec_type: "audio",
        duration: "5.013333",
        bit_rate: "133361",
        sample_rate: "48000",
        channels: 2,
        channel_layout: "stereo",
        tags: { language: "eng" },
      },
    ],
  };

  it("parses format info correctly", () => {
    const info = toMediaInfo(sampleProbeOutput);
    expect(info.format.filename).toBe("/test/video.mp4");
    expect(info.format.duration).toBe(5.020333);
    expect(info.format.size).toBe(2549541);
    expect(info.format.bitRate).toBe(4062744);
    expect(info.format.streamCount).toBe(2);
    expect(info.format.tags.artist).toBe("Test Artist");
    expect(info.format.tags.encoder).toBe("Lavf59.27.100");
  });

  it("identifies video and audio streams", () => {
    const info = toMediaInfo(sampleProbeOutput);
    expect(info.streams).toHaveLength(2);
    expect(info.videoStream).toBeDefined();
    expect(info.audioStream).toBeDefined();
    expect(info.videoStream!.type).toBe("video");
    expect(info.audioStream!.type).toBe("audio");
  });

  it("parses video stream details", () => {
    const info = toMediaInfo(sampleProbeOutput);
    const v = info.videoStream!;
    expect(v.codec).toBe("h264");
    expect(v.width).toBe(1920);
    expect(v.height).toBe(1080);
    expect(v.frameRate).toBe(30);
    expect(v.duration).toBe(5.005);
    expect(v.tags.language).toBe("und");
  });

  it("parses audio stream details", () => {
    const info = toMediaInfo(sampleProbeOutput);
    const a = info.audioStream!;
    expect(a.codec).toBe("aac");
    expect(a.sampleRate).toBe(48000);
    expect(a.channels).toBe(2);
    expect(a.channelLayout).toBe("stereo");
  });

  it("handles empty/missing probe output", () => {
    const info = toMediaInfo({});
    expect(info.streams).toHaveLength(0);
    expect(info.videoStream).toBeUndefined();
    expect(info.audioStream).toBeUndefined();
    expect(info.format.filename).toBe("unknown");
    expect(info.format.duration).toBe(0);
  });

  it("handles streams with missing fields", () => {
    const info = toMediaInfo({
      streams: [{ index: 0 }],
    });
    expect(info.streams[0]!.type).toBe("unknown");
    expect(info.streams[0]!.codec).toBe("unknown");
    expect(info.streams[0]!.width).toBeUndefined();
  });
});

// --- checkRenderReady ---

describe("checkRenderReady", () => {
  function makeMediaInfo(overrides: {
    videoCodec?: string;
    audioSampleRate?: number;
    hasVideo?: boolean;
    hasAudio?: boolean;
  }): MediaInfo {
    const streams = [];
    const videoStream = overrides.hasVideo !== false
      ? {
          index: 0,
          type: "video" as const,
          codec: overrides.videoCodec ?? "h264",
          codecLong: "test",
          width: 1920,
          height: 1080,
          frameRate: 30,
          duration: 5,
          bitRate: 4000000,
          tags: {},
        }
      : undefined;

    const audioStream = overrides.hasAudio !== false
      ? {
          index: 1,
          type: "audio" as const,
          codec: "aac",
          codecLong: "test",
          sampleRate: overrides.audioSampleRate ?? 48000,
          channels: 2,
          channelLayout: "stereo",
          duration: 5,
          bitRate: 128000,
          tags: {},
        }
      : undefined;

    if (videoStream) streams.push(videoStream);
    if (audioStream) streams.push(audioStream);

    return {
      format: {
        filename: "test.mp4",
        formatName: "mp4",
        formatLong: "MPEG-4",
        duration: 5,
        size: 1000000,
        bitRate: 4000000,
        streamCount: streams.length,
        tags: {},
      },
      streams,
      videoStream,
      audioStream,
    };
  }

  it("passes for H.264 + 48kHz audio", () => {
    const result = checkRenderReady(makeMediaInfo({}));
    expect(result.ready).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("flags VP9 codec", () => {
    const result = checkRenderReady(makeMediaInfo({ videoCodec: "vp9" }));
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("vp9");
    expect(result.issues[0]).toContain("reencode_h264");
  });

  it("flags 44.1kHz audio", () => {
    const result = checkRenderReady(makeMediaInfo({ audioSampleRate: 44100 }));
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("44100");
    expect(result.issues[0]).toContain("resample_audio");
  });

  it("flags missing video stream", () => {
    const result = checkRenderReady(makeMediaInfo({ hasVideo: false }));
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("No video stream");
  });

  it("warns on missing audio (non-blocking)", () => {
    const result = checkRenderReady(makeMediaInfo({ hasAudio: false }));
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("No audio stream");
    expect(result.issues[0]).toContain("b-roll");
  });

  it("catches multiple issues at once", () => {
    const result = checkRenderReady(
      makeMediaInfo({ videoCodec: "vp9", audioSampleRate: 44100 }),
    );
    expect(result.ready).toBe(false);
    expect(result.issues).toHaveLength(2);
  });

  it("flags poor keyframe alignment", () => {
    const info = makeMediaInfo({});
    const keyframes = [
      { time: 0, position: 0 },
      { time: 2.0, position: 50000 },
      { time: 4.0, position: 100000 },
    ];
    const result = checkRenderReady(info, 1.0, keyframes);
    expect(result.ready).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain("frozen frames");
  });

  it("passes on good keyframe alignment", () => {
    const info = makeMediaInfo({});
    const keyframes = [
      { time: 0, position: 0 },
      { time: 1.0, position: 25000 },
      { time: 2.0, position: 50000 },
    ];
    const result = checkRenderReady(info, 1.0, keyframes);
    expect(result.ready).toBe(true);
  });
});
