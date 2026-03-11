import fs from "node:fs/promises";
import path from "node:path";
import {
  DANGEROUS_PATH_CHARS,
  ALLOWED_EXTENSIONS,
  MIN_FILE_SIZE,
} from "./constants.js";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export async function validateInputPath(filePath: string): Promise<void> {
  if (!filePath || filePath.trim().length === 0) {
    throw new ValidationError("File path is empty");
  }

  if (DANGEROUS_PATH_CHARS.test(filePath)) {
    throw new ValidationError(
      `Path contains dangerous characters: ${filePath}`,
    );
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError(
      `Unsupported file extension "${ext}". Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
    );
  }

  try {
    await fs.access(filePath, fs.constants.R_OK);
  } catch {
    throw new ValidationError(`File not found or not readable: ${filePath}`);
  }

  const stats = await fs.stat(filePath);
  if (stats.size < MIN_FILE_SIZE) {
    throw new ValidationError(
      `File too small (${stats.size} bytes). Minimum: ${MIN_FILE_SIZE} bytes`,
    );
  }
}

export function validateOutputPath(filePath: string): void {
  if (!filePath || filePath.trim().length === 0) {
    throw new ValidationError("Output path is empty");
  }

  if (DANGEROUS_PATH_CHARS.test(filePath)) {
    throw new ValidationError(
      `Output path contains dangerous characters: ${filePath}`,
    );
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError(
      `Unsupported output extension "${ext}". Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
    );
  }
}
