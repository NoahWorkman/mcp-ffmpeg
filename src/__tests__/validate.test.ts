import { describe, it, expect } from "vitest";
import { validateOutputPath, ValidationError } from "../validate.js";

describe("validateOutputPath", () => {
  it("accepts valid output paths", () => {
    expect(() => validateOutputPath("/tmp/output.mp4")).not.toThrow();
    expect(() => validateOutputPath("/home/user/video.mkv")).not.toThrow();
    expect(() => validateOutputPath("/tmp/audio.wav")).not.toThrow();
    expect(() => validateOutputPath("/tmp/audio.mp3")).not.toThrow();
  });

  it("rejects empty paths", () => {
    expect(() => validateOutputPath("")).toThrow(ValidationError);
    expect(() => validateOutputPath("   ")).toThrow(ValidationError);
  });

  it("rejects shell metacharacters", () => {
    const dangerous = [
      "/tmp/file;rm -rf.mp4",
      "/tmp/file&&echo.mp4",
      "/tmp/file|cat.mp4",
      "/tmp/file`id`.mp4",
      "/tmp/file$(cmd).mp4",
      "/tmp/file{a,b}.mp4",
      "/tmp/file!.mp4",
      "/tmp/file<in.mp4",
      "/tmp/file>out.mp4",
    ];
    for (const p of dangerous) {
      expect(() => validateOutputPath(p), `Should reject: ${p}`).toThrow(
        ValidationError,
      );
    }
  });

  it("rejects unsupported extensions", () => {
    expect(() => validateOutputPath("/tmp/file.txt")).toThrow(ValidationError);
    expect(() => validateOutputPath("/tmp/file.exe")).toThrow(ValidationError);
    expect(() => validateOutputPath("/tmp/file.py")).toThrow(ValidationError);
    expect(() => validateOutputPath("/tmp/file")).toThrow(ValidationError);
  });

  it("accepts all supported extensions", () => {
    const supported = [
      ".mp4", ".mkv", ".webm", ".mov", ".avi",
      ".wav", ".mp3", ".aac", ".flac", ".m4a",
      ".ts", ".mts", ".m2ts", ".ogg", ".opus",
    ];
    for (const ext of supported) {
      expect(
        () => validateOutputPath(`/tmp/file${ext}`),
        `Should accept: ${ext}`,
      ).not.toThrow();
    }
  });

  it("is case-insensitive for extensions", () => {
    expect(() => validateOutputPath("/tmp/file.MP4")).not.toThrow();
    expect(() => validateOutputPath("/tmp/file.Wav")).not.toThrow();
  });
});
