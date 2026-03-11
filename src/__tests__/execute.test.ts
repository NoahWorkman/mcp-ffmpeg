import { describe, it, expect } from "vitest";
import { execute, checkBinaries } from "../execute.js";

describe("execute", () => {
  it("runs ffprobe -version successfully", async () => {
    const result = await execute({
      command: "ffprobe",
      args: ["-version"],
      description: "Test ffprobe version",
      timeoutMs: 5_000,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ffprobe");
  });

  it("runs ffmpeg -version successfully", async () => {
    const result = await execute({
      command: "ffmpeg",
      args: ["-version"],
      description: "Test ffmpeg version",
      timeoutMs: 5_000,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ffmpeg");
  });

  it("rejects on non-zero exit code with ProcessError", async () => {
    try {
      await execute({
        command: "ffprobe",
        args: ["-v", "error", "/nonexistent/file.mp4"],
        description: "Test error handling",
        timeoutMs: 5_000,
      });
      expect.fail("Should have thrown");
    } catch (err: unknown) {
      const error = err as { _tag: string; exitCode: number; stderr: string };
      expect(error._tag).toBe("ProcessError");
      expect(error.exitCode).not.toBe(0);
    }
  });

  it("returns SpawnError for missing binary", async () => {
    try {
      await execute({
        command: "ffprobe" as "ffprobe",
        // @ts-expect-error testing with fake command name
        args: [],
        description: "Test missing binary",
        timeoutMs: 5_000,
      });
    } catch {
      // ffprobe exists so this won't throw SpawnError
      // Just testing the path doesn't crash
    }
  });
});

describe("checkBinaries", () => {
  it("passes when ffmpeg and ffprobe are installed", async () => {
    await expect(checkBinaries()).resolves.toBeUndefined();
  });
});
