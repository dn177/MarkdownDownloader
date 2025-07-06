import { exec } from "child_process";
import { promisify } from "util";
import { LocalStorage, showToast, Toast } from "@raycast/api";

const execAsync = promisify(exec);

export async function selectFolder(): Promise<string | null> {
  try {
    // Use AppleScript to show a folder selection dialog
    const script = `
      set chosenFolder to choose folder with prompt "Select output folder for markdown files"
      return POSIX path of chosenFolder
    `;
    
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    return stdout.trim();
  } catch (error) {
    // Check if it's a cancellation (exit code 1) or a real error
    if (error && typeof error === 'object' && 'code' in error && error.code === 1) {
      // User cancelled - this is normal
      return null;
    }
    
    // Real error - show toast
    await showToast({
      style: Toast.Style.Failure,
      title: "Folder Selection Failed",
      message: error instanceof Error ? error.message : "Unknown error occurred",
    });
    return null;
  }
}

export async function getRecentFolders(): Promise<string[]> {
  try {
    const stored = await LocalStorage.getItem<string>("recentFolders");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error getting recent folders:", error);
  }
  return [];
}

export async function addRecentFolder(folderPath: string): Promise<void> {
  try {
    const recent = await getRecentFolders();
    
    // Remove if already exists to avoid duplicates
    const filtered = recent.filter(f => f !== folderPath);
    
    // Add to beginning and limit to 5 recent folders
    const updated = [folderPath, ...filtered].slice(0, 5);
    
    await LocalStorage.setItem("recentFolders", JSON.stringify(updated));
  } catch (error) {
    console.error("Error saving recent folder:", error);
  }
}