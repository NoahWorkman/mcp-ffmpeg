# mcp-server-ffmpeg

An MCP server that wraps FFmpeg and FFprobe, giving AI assistants structured access to media inspection and transformation tools.

Instead of parsing raw terminal output from ffmpeg commands, this server returns typed JSON with metadata, validation results, and actionable diagnostics.

## What it does

**Inspection tools** (read-only, fast):

- **`probe`** -- Returns structured metadata for any media file: format info (duration, size, bitrate), stream details (codec, resolution, frame rate, sample rate, channels), and all embedded tags (title, artist, creation date, encoder).

- **`find_keyframes`** -- Lists keyframe (I-frame) timestamps in a video file, optionally filtered to a time range. Essential for setting trim points without causing frozen frames.

- **`check_render_ready`** -- Validates a media file against production requirements: H.264 video codec, 48kHz audio sample rate, audio stream present, and keyframe alignment at a given trim point. Returns pass/fail with specific fix suggestions.

**Transformation tools** (creates new files, never overwrites input):

- **`strip_audio`** -- Removes the audio track from a video. Video stream is copied without re-encoding. Use for b-roll clips where separate narration plays over the footage.

- **`reencode_h264`** -- Re-encodes video to H.264 with configurable CRF quality. Fixes VP9/WebM files that cause render failures. Includes faststart flag for web playback. Audio is copied as-is.

- **`resample_audio`** -- Resamples audio to a target sample rate (default 48kHz). Video stream is copied without re-encoding. Fixes the silent audio drift that occurs with 44.1kHz sources.

- **`crop_portrait`** -- Crops landscape (16:9) video to portrait (9:16) format using a specified horizontal offset. Calculates crop dimensions from source resolution. Audio is stripped (b-roll pattern).

- **`extract_audio`** -- Extracts the audio track from a video file as WAV (PCM 16-bit) or MP3. Always resamples to 48kHz.

## Key features

**Post-transform validation gate.** Every transformation tool automatically validates its own output before returning. The response includes a validation report (`ready: true/false` with specific issues) alongside input and output metadata. Problems like wrong sample rates or codec mismatches are never silent.

**Metadata preservation.** All transforms copy source metadata (title, artist, creation date, etc.) to the output file via `-map_metadata 0` by default. Pass `stripMetadata: true` to output a clean file.

**Structured errors.** Errors are typed as `SpawnError` (binary not found), `TimeoutError` (operation exceeded limit), or `ProcessError` (ffmpeg failed, with parsed actionable error lines extracted from stderr).

**Concurrency control.** A semaphore caps concurrent ffmpeg processes at your CPU count, preventing resource starvation when multiple tools are called in parallel.

**Security.**
- All commands use `child_process.spawn` with argument arrays (no shell injection)
- Input paths are checked for shell metacharacters and validated against a file extension allowlist
- FFmpeg protocol whitelist is set to `file,pipe` only (prevents SSRF via network URLs)
- Minimum file size check rejects empty/corrupt inputs fast

## Install

Requires [FFmpeg](https://ffmpeg.org/download.html) installed and on your PATH.

### Claude Code (local development)

```bash
git clone https://github.com/NoahWorkman/mcp-ffmpeg.git
cd mcp-ffmpeg
npm install && npm run build
claude mcp add --transport stdio --scope user ffmpeg -- node /path/to/mcp-ffmpeg/dist/index.js
```

### Claude Code (npm, after publish)

```bash
claude mcp add --transport stdio --scope user ffmpeg -- npx -y @noahworkman/mcp-server-ffmpeg
```

### Manual config

Add to `~/.claude.json` under `mcpServers`:

```json
{
  "ffmpeg": {
    "type": "stdio",
    "command": "node",
    "args": ["/path/to/mcp-ffmpeg/dist/index.js"]
  }
}
```

## Tool reference

### probe

```
Input:  { path: string }
Output: { format: FormatInfo, streams: StreamInfo[], videoStream?: StreamInfo, audioStream?: StreamInfo }
```

Returns codec, resolution, frame rate, duration, bitrate, sample rate, channels, and all metadata tags from both format and stream levels.

### find_keyframes

```
Input:  { path: string, startTime?: number, endTime?: number }
Output: { count: number, keyframes: Array<{ time: number, position: number }> }
```

### check_render_ready

```
Input:  { path: string, trimStartSeconds?: number }
Output: { ready: boolean, issues: string[], metadata: { codec, resolution, frameRate, audioSampleRate, ... } }
```

Checks: video is H.264, audio is 48kHz, audio stream exists. If `trimStartSeconds` is set, warns when the nearest keyframe is more than 0.5 seconds away.

### strip_audio / reencode_h264 / resample_audio / crop_portrait / extract_audio

All transforms return:

```
{
  success: boolean,
  validation: { ready: boolean, issues: string[] },
  output: { codec, resolution, audioSampleRate, duration, size, tags },
  input:  { codec, resolution, audioSampleRate, duration, size, tags }
}
```

| Tool | Key params | What it does |
|------|-----------|--------------|
| `strip_audio` | `inputPath`, `outputPath` | Removes audio, copies video |
| `reencode_h264` | `inputPath`, `outputPath`, `crf?` (0-51, default 23) | Re-encodes to H.264 |
| `resample_audio` | `inputPath`, `outputPath`, `sampleRate?` (default 48000) | Resamples audio |
| `crop_portrait` | `inputPath`, `outputPath`, `xOffset` | Crops 16:9 to 9:16 |
| `extract_audio` | `inputPath`, `outputPath`, `format?` (wav/mp3) | Extracts audio track |

All transforms accept an optional `stripMetadata: boolean` (default false).

## Architecture

```
src/
  index.ts       -- Server setup, tool registration, MCP protocol
  execute.ts     -- Single execute() function, concurrency semaphore, kill escalation
  ffprobe.ts     -- Probe, keyframe search, render-ready validation
  ffmpeg.ts      -- Transform operations (args builders + validation gate)
  constants.ts   -- Encoding defaults, timeouts, allowlists
  types.ts       -- FfmpegTask, FfmpegError union, MediaInfo types
  validate.ts    -- Path validation, file checks, metachar rejection
```

All FFmpeg/FFprobe operations route through a single `execute()` function that handles:
- Concurrency limiting (semaphore capped at CPU count)
- Timeouts (30s for probes, 5min for transforms)
- Kill escalation (SIGTERM, then SIGKILL after 5s)
- Settled guard (prevents double-resolve from concurrent close/error events)
- Stderr parsing (extracts actionable error lines from FFmpeg's verbose output)

## License

MIT
