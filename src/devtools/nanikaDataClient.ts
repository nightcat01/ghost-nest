import type { NanikaDataScope, NanikaListOptions } from "../core/types.js";
import { createDevtoolsApiPath, readApiJson, type DevApiResponse } from "./assetApi.js";

type LegacyNanikaDataResponse<T> = DevApiResponse & {
  conditions?: T[];
  featureSets?: T[];
  mappings?: T[];
  item?: T | null;
  items?: T[];
  path?: string;
};

export type NanikaDataClientResult<T> = {
  items: T[];
  path?: string;
};

const legacyListEndpoints = {
  conditions: "/api/devtools/nanika-conditions",
  featureSets: "/api/devtools/nanika-feature-sets",
  mappings: "/api/devtools/nanika-mappings",
} satisfies Partial<Record<NanikaDataScope, string>>;

const legacySaveEndpoints = {
  conditions: "/api/devtools/save-nanika-condition",
  featureSets: "/api/devtools/save-nanika-feature-set",
  mappings: "/api/devtools/save-nanika-mapping",
} satisfies Partial<Record<NanikaDataScope, string>>;

const legacyDeleteEndpoints = {
  conditions: "/api/devtools/delete-nanika-condition",
  featureSets: "/api/devtools/delete-nanika-feature-set",
  mappings: "/api/devtools/delete-nanika-mapping",
} satisfies Partial<Record<NanikaDataScope, string>>;

const legacyPayloadKeys: Partial<Record<NanikaDataScope, string>> = {
  conditions: "condition",
  featureSets: "featureSet",
  mappings: "mapping",
};

const legacyListKeys: Partial<Record<NanikaDataScope, keyof LegacyNanikaDataResponse<unknown>>> = {
  conditions: "conditions",
  featureSets: "featureSets",
  mappings: "mappings",
};

function createNanikaDataApiPath(scope: NanikaDataScope, id?: string) {
  const encodedScope = encodeURIComponent(scope);
  const encodedId = id ? `/${encodeURIComponent(id)}` : "";

  return createDevtoolsApiPath(`/api/nanika/data/${encodedScope}${encodedId}`);
}

function getRequiredEndpoint(
  endpoints: Partial<Record<NanikaDataScope, string>>,
  scope: NanikaDataScope,
) {
  const endpoint = endpoints[scope];

  if (!endpoint) {
    throw new Error(`${scope} 데이터 scope는 아직 devtools data client에 연결되지 않았어요.`);
  }

  return endpoint;
}

function getLegacyListItems<T>(scope: NanikaDataScope, result: LegacyNanikaDataResponse<T>) {
  const listKey = legacyListKeys[scope];
  const items = listKey ? result[listKey] as unknown : undefined;

  return Array.isArray(items) ? items as T[] : [];
}

function createQueryString(options: NanikaListOptions | undefined) {
  if (!options) {
    return "";
  }

  const searchParams = new URLSearchParams();

  Object.entries(options).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

export async function listNanikaData<T>(
  scope: NanikaDataScope,
  options?: NanikaListOptions,
): Promise<NanikaDataClientResult<T>> {
  const dataApiResponse = await fetch(`${createNanikaDataApiPath(scope)}${createQueryString(options)}`);
  const dataApiResult = await readApiJson<LegacyNanikaDataResponse<T>>(dataApiResponse);

  if (dataApiResponse.ok && dataApiResult.ok) {
    return {
      items: Array.isArray(dataApiResult.items) ? dataApiResult.items : [],
      ...(dataApiResult.path ? { path: dataApiResult.path } : {}),
    };
  }

  if (dataApiResponse.status !== 404) {
    throw new Error(dataApiResult.message ?? dataApiResult.error ?? `${scope} 데이터를 불러오지 못했습니다.`);
  }

  const endpoint = getRequiredEndpoint(legacyListEndpoints, scope);
  const response = await fetch(createDevtoolsApiPath(`${endpoint}${createQueryString(options)}`));
  const result = await readApiJson<LegacyNanikaDataResponse<T>>(response);

  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? result.error ?? `${scope} 데이터를 불러오지 못했습니다.`);
  }

  return {
    items: getLegacyListItems(scope, result),
    ...(result.path ? { path: result.path } : {}),
  };
}

export async function saveNanikaDataItem<T>(
  scope: NanikaDataScope,
  id: string,
  value: T,
): Promise<NanikaDataClientResult<T>> {
  const dataApiResponse = await fetch(createNanikaDataApiPath(scope, id), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  const dataApiResult = await readApiJson<LegacyNanikaDataResponse<T>>(dataApiResponse);

  if (dataApiResponse.ok && dataApiResult.ok) {
    return {
      items: Array.isArray(dataApiResult.items) ? dataApiResult.items : [],
      ...(dataApiResult.path ? { path: dataApiResult.path } : {}),
    };
  }

  if (dataApiResponse.status !== 404) {
    throw new Error(dataApiResult.message ?? dataApiResult.error ?? `${scope} 데이터를 저장하지 못했습니다.`);
  }

  const endpoint = getRequiredEndpoint(legacySaveEndpoints, scope);
  const payloadKey = legacyPayloadKeys[scope] ?? "value";
  const response = await fetch(createDevtoolsApiPath(endpoint), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      [payloadKey]: value,
    }),
  });
  const result = await readApiJson<LegacyNanikaDataResponse<T>>(response);

  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? result.error ?? `${scope} 데이터를 저장하지 못했습니다.`);
  }

  return {
    items: getLegacyListItems(scope, result),
    ...(result.path ? { path: result.path } : {}),
  };
}

export async function deleteNanikaDataItem<T>(
  scope: NanikaDataScope,
  id: string,
): Promise<NanikaDataClientResult<T>> {
  const dataApiResponse = await fetch(createNanikaDataApiPath(scope, id), {
    method: "DELETE",
  });
  const dataApiResult = await readApiJson<LegacyNanikaDataResponse<T>>(dataApiResponse);

  if (dataApiResponse.ok && dataApiResult.ok) {
    return {
      items: Array.isArray(dataApiResult.items) ? dataApiResult.items : [],
      ...(dataApiResult.path ? { path: dataApiResult.path } : {}),
    };
  }

  if (dataApiResponse.status !== 404) {
    throw new Error(dataApiResult.message ?? dataApiResult.error ?? `${scope} 데이터를 삭제하지 못했습니다.`);
  }

  const endpoint = getRequiredEndpoint(legacyDeleteEndpoints, scope);
  const response = await fetch(createDevtoolsApiPath(endpoint), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const result = await readApiJson<LegacyNanikaDataResponse<T>>(response);

  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? result.error ?? `${scope} 데이터를 삭제하지 못했습니다.`);
  }

  return {
    items: getLegacyListItems(scope, result),
    ...(result.path ? { path: result.path } : {}),
  };
}
