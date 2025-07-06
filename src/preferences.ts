import { getPreferenceValues } from "@raycast/api";

export interface Preferences {
  defaultOutputPath: string;
  defaultImagePath: string;
  removeScripts: boolean;
  removeStyles: boolean;
  removeComments: boolean;
  autoOpenFile: boolean;
  preferredOutputFolder: string;
}

export function getPreferences(): Preferences {
  return getPreferenceValues<Preferences>();
}