import { mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export async function ensureFileParent(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
