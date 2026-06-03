import { LabImage, readImageFile } from "./assetShared.js";
import { createDevtoolsApiPath, fetchCharacterWorkspace } from "./assetApi.js";

export type CharacterAssetSaveKind = "base" | "parts" | "scenes";

export type SavedAssetFile = {
  fileName: string;
  path: string;
};

type SaveAssetFilesResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  saved?: SavedAssetFile[];
};

let workspacePromise: ReturnType<typeof fetchCharacterWorkspace> | null = null;

/**
 * Reuses the character workspace config while a devtools page is open.
 */
async function getCachedCharacterWorkspace() {
  workspacePromise ??= fetchCharacterWorkspace();

  return workspacePromise;
}

/**
 * Builds the virtual save directory mapped by the dev server to the configured character workspace.
 */
export function createCharacterAssetSaveDirectory(characterId: string, assetKind: CharacterAssetSaveKind) {
  return `src/characters/${characterId || "rine"}/assets/${assetKind}`;
}

/**
 * Builds a browser-facing asset path prefix for one character asset bucket.
 */
export async function createCharacterAssetBrowserBasePath(characterId: string, assetKind: CharacterAssetSaveKind) {
  const workspace = await getCachedCharacterWorkspace();
  const sourcePrefix = workspace.browserSourcePrefix.replaceAll("\\", "/").replace(/\/$/, "");

  return `${sourcePrefix}/${characterId || "rine"}/assets/${assetKind}/`;
}

/**
 * Builds a browser-facing asset path prefix for shared common assets.
 */
export async function createCommonAssetBrowserBasePath(assetKind?: CharacterAssetSaveKind) {
  const workspace = await getCachedCharacterWorkspace();
  const commonPrefix = workspace.browserCommonPrefix.replaceAll("\\", "/").replace(/\/$/, "");

  return assetKind ? `${commonPrefix}/${assetKind}/` : `${commonPrefix}/`;
}

/**
 * Returns whether an image came from a browser upload and can be written to disk.
 */
export function isUploadImage(image: LabImage | null | undefined): image is LabImage {
  return Boolean(image?.dataUrl.startsWith("data:"));
}

/**
 * Reads all image files from a browser file input.
 */
export function readImageFiles(files: File[]) {
  return Promise.all(files.map(readImageFile));
}

/**
 * Converts server project paths into browser-facing asset paths used by character configs.
 */
export function createSavedAssetPaths(savedFiles: SavedAssetFile[]) {
  return savedFiles.map((savedFile) => {
    const path = savedFile.path.replaceAll("\\", "/");

    return path.startsWith(".") || path.startsWith("/") || /^https?:\/\//.test(path)
      ? path
      : `./${path}`;
  });
}

/**
 * Saves uploaded browser images into one character asset folder.
 */
export async function saveUploadedAssetFiles(directory: string, images: LabImage[]) {
  const response = await fetch(createDevtoolsApiPath("/api/devtools/save-asset-files"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directory,
      images: images.map((image) => ({
        fileName: image.fileName,
        dataUrl: image.dataUrl,
      })),
    }),
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) as SaveAssetFilesResponse : {};

  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? `이미지 저장 실패: ${result.error ?? response.status}`);
  }

  return result.saved ?? [];
}
