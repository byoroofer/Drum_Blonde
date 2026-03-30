import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";

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
      await runBinary(ffmpegPath, ["-y", "-ss", "00:00:01", "-i", temp.tempPath, "-frames:v", "1", thumbPath]);
      thumbnailBuffer = await fs.readFile(thumbPath);
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

