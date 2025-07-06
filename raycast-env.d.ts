/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Default Output Path - Default directory for saving markdown files */
  "defaultOutputPath": string,
  /** Default Image Subfolder - Subfolder name for downloaded images (relative to output path) */
  "defaultImagePath": string,
  /** Remove Scripts - Remove script tags from content */
  "removeScripts": boolean,
  /** Remove Styles - Remove style tags from content */
  "removeStyles": boolean,
  /** Auto Open File - Automatically open the markdown file after conversion */
  "autoOpenFile": boolean,
  /** Preferred Output Folders - Comma-separated list of frequently used folders (e.g., ~/Documents/Articles, ~/Notes) */
  "preferredOutputFolder"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `convert` command */
  export type Convert = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `convert` command */
  export type Convert = {}
}

