import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";

function appendSeekCandidate(candidates: number[], value: number, maxSeconds: number | null) {
  if (!Number.isFinite(value)) {
    return;
  }

  const boundedMax = Number.isFinite(maxSeconds) ? Math.max(0.12, maxSeconds as number) : null;
  const clamped = boundedMax == null ? value : Math.min(Math.max(0.12, value), boundedMax);
  if (candidates.some((entry) => Math.abs(entry - clamped) < 0.08)) {
    return;
  }

  candidates.push(Number(clamped.toFixed(2)));
}

function buildThumbnailSeekCandidates(durationSeconds: number | null) {
  const duration = Number(durationSeconds);
  const safeEnd = Number.isFinite(duration) && duration > 0 ? Math.max(0.12, duration - 0.12) : null;
  const candidates: number[] = [];

  if (safeEnd != null) {
    appendSeekCandidate(candidates, Math.min(Math.max(duration * 0.18, 0.45), 3.2), safeEnd);
    appendSeekCandidate(candidates, Math.min(Math.max(duration * 0.12, 0.3), 2.2), safeEnd);
    appendSeekCandidate(candidates, 1.6, safeEnd);
    appendSeekCandidate(candidates, 0.8, safeEnd);
    appendSeekCandidate(candidates, 2.6, safeEnd);
    appendSeekCandidate(candidates, 0.15, safeEnd);
  } else {
    appendSeekCandidate(candidates, 1.6, null);
    appendSeekCandidate(candidates, 0.8, null);
    appendSeekCandidate(candidates, 2.6, null);
    appendSeekCandidate(candidates, 0.15, null);
  }

  return candidates.length ? candidates : [0.15];
}

function isLowInformationFrame(buffer: Buffer) {
  const stride = 32;
  const sample = buffer.length > 4096 ? buffer.subarray(0, 4096) : buffer;
  let sum = 0;
  let sumSquares = 0;
  let samples = 0;

  for (let index = 0; index < sample.length; index += stride) {
    const value = sample[index] || 0;
    sum += value;
    sumSquares += value * value;
    samples += 1;
  }

  if (samples === 0) {
    return false;
  }

  const average = sum / samples;
  const variance = Math.max(0, sumSquares / samples - average * average);
  return average < 18 && Math.sqrt(variance) < 12;
}

async function extractVideoFrame(tempPath: string, outputPath: string, seekSeconds: number) {
  await runBinary(ffmpegPath as string, [
    "-y",
    "-ss",
    String(seekSeconds),
    "-i",
    tempPath,
    "-frames:v",
    "1",
    "-update",
    "1",
    outputPath
  ]);
  return fs.readFile(outputPath);
}

async function runBinary(binary: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const child = spawn(binary, args);

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString("utf8") || `Process exited with ${code}`));
        return;
      }
      resolve(Buffer.concat(stdout).toString("utf8"));
    });
  });
}

async function withTempFile(buffer: Buffer, originalFilename: string) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "brooke-media-"));
  const tempPath = path.join(tempDir, originalFilename.replace(/[^\w.-]+/g, "-") || `${crypto.randomUUID()}.bin`);
  await fs.writeFile(tempPath, buffer);
  return {
    tempDir,
    tempPath,
    async cleanup() {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  };
}

export async function inspectUploadedVideo(buffer: Buffer, originalFilename: string) {
  const temp = await withTempFile(buffer, originalFilename);

  try {
    if (!ffprobe?.path) {
      return { durationSeconds: null, width: null, height: null, thumbnailBuffer: null as Buffer | null };
    }

    const raw = await runBinary(ffprobe.path, [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      temp.tempPath
    ]);
    const parsed = JSON.parse(raw) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    };

    const videoStream = parsed.streams?.find((entry) => entry.codec_type === "video");
    const durationSeconds = parsed.format?.duration ? Number(parsed.format.duration) : null;
    let thumbnailBuffer: Buffer | null = null;

    if (ffmpegPath) {
      const thumbPath = path.join(temp.tempDir, "thumb.jpg");
      const candidates = buildThumbnailSeekCandidates(Number.isFinite(durationSeconds) ? durationSeconds : null);

      for (const seekSeconds of candidates) {
        const frameBuffer = await extractVideoFrame(temp.tempPath, thumbPath, seekSeconds);
        if (!isLowInformationFrame(frameBuffer)) {
          thumbnailBuffer = frameBuffer;
          break;
        }
      }

      if (!thumbnailBuffer) {
        thumbnailBuffer = await extractVideoFrame(temp.tempPath, thumbPath, candidates[0] || 0.15);
      }

      await fs.unlink(thumbPath).catch(() => {});
    }

    return {
      durationSeconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds as number) : null,
      width: videoStream?.width ?? null,
      height: videoStream?.height ?? null,
      thumbnailBuffer
    };
  } finally {
    await temp.cleanup();
  }
}

