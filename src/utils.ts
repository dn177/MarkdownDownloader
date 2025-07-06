import * as fs from "fs-extra";
import * as path from "path";
import { showToast, Toast } from "@raycast/api";

export function sanitizeFilename(filename: string): string {
  // Remove or replace invalid characters
  return filename
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function generateFilenameFromTitle(title: string): string {
  const sanitized = sanitizeFilename(title);
  const timestamp = new Date().toISOString().split("T")[0];
  return `${timestamp}-${sanitized}.md`;
}

export async function ensureUniqueFilename(filepath: string): Promise<string> {
  let finalPath = filepath;
  let counter = 1;
  
  while (await fs.pathExists(finalPath)) {
    const dir = path.dirname(filepath);
    const ext = path.extname(filepath);
    const base = path.basename(filepath, ext);
    finalPath = path.join(dir, `${base}-${counter}${ext}`);
    counter++;
  }
  
  return finalPath;
}

export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return "unknown";
  }
}

export async function handleError(error: unknown, context: string) {
  console.error(`Error in ${context}:`, error);
  
  const message = error instanceof Error ? error.message : "Unknown error occurred";
  
  await showToast({
    style: Toast.Style.Failure,
    title: `Error: ${context}`,
    message: message,
  });
}