import type { CharacterExpressionAsset, RuntimeScene } from "../core/types.js";

/**
 * Builds a devtools API URL relative to the currently opened devtools page.
 */
export function createDevtoolsApiPath(path: string) {
  return `./${path.replace(/^\//, "")}`;
}

export type DevApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export type CharacterListResponse = DevApiResponse & {
  characters?: string[];
};

export type DeleteCharacterResponse = DevApiResponse & {
  deleted?: {
    characterId: string;
    path: string;
    buildPath: string;
  };
};

export type CharacterWorkspace = {
  sourceCharacters: string;
  buildCharacters: string;
  commonAssets: string;
  browserSourcePrefix: string;
  browserCommonPrefix: string;
  allowLocalhost?: boolean;
  allowedIps?: string[];
  basePath?: string;
  resolved?: {
    sourceCharacters: string;
    buildCharacters: string;
    commonAssets: string;
  };
  devServer?: {
    allowLocalhost: boolean;
    allowedIps: string[];
    basePath?: string;
  };
};

export type CharacterWorkspaceResponse = DevApiResponse & {
  workspace?: CharacterWorkspace;
};

export type AssetFile = {
  fileName: string;
  kind: "base" | "part" | "scene" | "asset";
  path: string;
  scope?: "character" | "common";
  size?: number;
  updatedAt?: string;
};

export type AssetFilesResponse = DevApiResponse & {
  files?: AssetFile[];
};

export type CharacterSurfaceAsset = {
  id?: string;
  visual?: {
    type: "image";
    src: string;
  } | {
    type: "scene";
    sceneId: string;
  };
  image?: string;
  expression?: string;
  alt?: string;
  layers?: Record<string, {
    image?: string;
    frames?: string[];
    depth?: number;
    intervalMs?: number;
    idleIntervalMs?: number;
    coversBase?: boolean;
    placement?: {
      x: number;
      y: number;
      width: number;
      height: number;
      unit?: "percent";
    };
  } | unknown>;
};

export type CharacterAssetsPayload = {
  alt?: string;
  hitAreas?: Record<string, unknown>;
  expressions?: Record<string, CharacterExpressionAsset>;
  surfaces?: Record<string, CharacterSurfaceAsset>;
  defaultScene?: string;
  scenes?: Record<string, RuntimeScene>;
};

export type CharacterAssetsResponse = DevApiResponse & {
  characterId?: string;
  assets?: CharacterAssetsPayload;
  lines?: Record<string, string[]>;
};

/**
 * Reads a dev API response while preserving useful server error text.
 */
export async function readApiJson<T extends DevApiResponse>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      ok: false,
      error: `http_${response.status}`,
      message: "API가 JSON이 아닌 응답을 보냈어요. 서버가 다시 시작되었는지 확인하세요.",
    } as T;
  }
}

/**
 * Loads character ids exposed by the dev server.
 */
export async function fetchCharacterList() {
  const response = await fetch(createDevtoolsApiPath("/api/devtools/characters"));
  const result = await readApiJson<CharacterListResponse>(response);

  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? result.error ?? "캐릭터 목록을 불러오지 못했어요.");
  }

  return result.characters ?? [];
}

/**
 * Deletes one character directory from the dev workspace.
 */
export async function deleteCharacter(characterId: string) {
  const response = await fetch(createDevtoolsApiPath("/api/devtools/delete-character"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId }),
  });
  const result = await readApiJson<DeleteCharacterResponse>(response);

  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? result.error ?? "캐릭터를 삭제하지 못했어요.");
  }

  return result.deleted;
}

/**
 * Loads the editable character workspace path settings.
 */
export async function fetchCharacterWorkspace() {
  const response = await fetch(createDevtoolsApiPath("/api/devtools/character-workspace"));
  const result = await readApiJson<CharacterWorkspaceResponse>(response);

  if (!response.ok || !result.ok || !result.workspace) {
    throw new Error(result.message ?? result.error ?? "캐릭터 작업 경로를 불러오지 못했어요.");
  }

  return result.workspace;
}

/**
 * Saves character workspace path settings.
 */
export async function saveCharacterWorkspace(workspace: CharacterWorkspace) {
  const response = await fetch(createDevtoolsApiPath("/api/devtools/character-workspace"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workspace),
  });
  const result = await readApiJson<CharacterWorkspaceResponse>(response);

  if (!response.ok || !result.ok || !result.workspace) {
    throw new Error(result.message ?? result.error ?? "캐릭터 작업 경로를 저장하지 못했어요.");
  }

  return result.workspace;
}

/**
 * Loads editable character assets for one character id.
 */
export async function fetchCharacterAssets(characterId: string) {
  const response = await fetch(createDevtoolsApiPath(`/api/devtools/character-assets?characterId=${encodeURIComponent(characterId)}`));
  const result = await readApiJson<CharacterAssetsResponse>(response);

  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? result.error ?? "캐릭터 설정을 불러오지 못했어요.");
  }

  return result;
}

/**
 * Loads character and common image assets available to devtools.
 */
export async function fetchAssetFiles(characterId: string) {
  const response = await fetch(createDevtoolsApiPath(`/api/devtools/asset-files?characterId=${encodeURIComponent(characterId)}`));
  const result = await readApiJson<AssetFilesResponse>(response);

  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? result.error ?? "저장된 에셋 목록을 불러오지 못했어요.");
  }

  return result.files ?? [];
}
