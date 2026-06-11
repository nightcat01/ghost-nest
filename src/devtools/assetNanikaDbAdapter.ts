import { createDevtoolsApiPath, readApiJson, type DevApiResponse } from "./assetApi.js";
import { requireElement } from "./assetShared.js";

type DbAdapterScopeResult = {
  scope: string;
  view: string;
  ok: boolean;
  count: number;
  sample?: unknown;
  error?: string;
};

type DbAdapterTestResponse = DevApiResponse & {
  provider?: string;
  results?: DbAdapterScopeResult[];
};

type DbConnectionTestResponse = DevApiResponse & {
  provider?: string;
  endpoint?: string;
  status?: number;
  message?: string;
};

type DbConnectionForm = {
  provider: string;
  url: string;
  apiKey: string;
  schema: string;
};

const providerSelect = requireElement(document.querySelector<HTMLSelectElement>("#dbProviderSelect"), "#dbProviderSelect");
const urlInput = requireElement(document.querySelector<HTMLInputElement>("#dbUrlInput"), "#dbUrlInput");
const keyInput = requireElement(document.querySelector<HTMLInputElement>("#dbKeyInput"), "#dbKeyInput");
const schemaInput = requireElement(document.querySelector<HTMLInputElement>("#dbSchemaInput"), "#dbSchemaInput");
const connectionTestButton = requireElement(document.querySelector<HTMLButtonElement>("#testDbConnectionButton"), "#testDbConnectionButton");
const testButton = requireElement(document.querySelector<HTMLButtonElement>("#testDbAdapterButton"), "#testDbAdapterButton");
const clearButton = requireElement(document.querySelector<HTMLButtonElement>("#clearDbAdapterButton"), "#clearDbAdapterButton");
const status = requireElement(document.querySelector<HTMLElement>("#dbAdapterStatus"), "#dbAdapterStatus");
const results = requireElement(document.querySelector<HTMLElement>("#dbAdapterResults"), "#dbAdapterResults");

function renderEmptyState(message: string) {
  const empty = document.createElement("p");
  empty.className = "asset-lab-help";
  empty.textContent = message;
  results.replaceChildren(empty);
}

function createResultCard(result: DbAdapterScopeResult) {
  const card = document.createElement("article");
  card.className = `nanika-db-adapter-result ${result.ok ? "is-ok" : "is-error"}`;

  const header = document.createElement("div");
  header.className = "nanika-db-adapter-result-header";

  const title = document.createElement("strong");
  title.textContent = result.scope;

  const badge = document.createElement("span");
  badge.textContent = result.ok ? "통과" : "확인 필요";

  header.append(title, badge);

  const view = document.createElement("p");
  view.textContent = `${result.view} · ${result.count}개`;

  const detail = document.createElement("pre");
  detail.className = "asset-lab-code nanika-db-adapter-result-detail";
  detail.textContent = result.ok
    ? JSON.stringify(result.sample ?? null, null, 2)
    : result.error ?? "unknown_error";

  card.append(header, view, detail);

  return card;
}

function renderResults(nextResults: DbAdapterScopeResult[]) {
  if (nextResults.length === 0) {
    renderEmptyState("아직 테스트 결과가 없어요.");
    return;
  }

  results.replaceChildren(...nextResults.map(createResultCard));
}

function readDbConnectionForm(): DbConnectionForm | null {
  const provider = providerSelect.value;
  const url = urlInput.value.trim();
  const apiKey = keyInput.value.trim();
  const schema = schemaInput.value.trim() || "public";

  if (!url || !apiKey) {
    status.textContent = "Supabase URL과 API Key를 입력하세요.";
    renderEmptyState("통신 테스트 또는 SQL/View 테스트를 실행하려면 연결 정보를 먼저 입력하세요.");
    return null;
  }

  return { provider, url, apiKey, schema };
}

function setTestButtonsDisabled(disabled: boolean) {
  connectionTestButton.disabled = disabled;
  testButton.disabled = disabled;
}

async function testDbConnection() {
  const form = readDbConnectionForm();

  if (!form) {
    return;
  }

  setTestButtonsDisabled(true);
  status.textContent = "Supabase REST 통신을 확인하는 중이에요.";

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/test-nanika-db-connection"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await readApiJson<DbConnectionTestResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.error ?? result.message ?? "db_connection_test_failed");
    }

    renderResults([{
      scope: "통신",
      view: result.endpoint ?? "Supabase REST",
      ok: true,
      count: 1,
      sample: {
        provider: result.provider ?? form.provider,
        status: result.status,
        message: result.message ?? "REST endpoint reachable",
      },
    }]);
    status.textContent = "Supabase REST 통신이 가능해요. 다음으로 SQL/View 테스트를 실행하세요.";
  } catch (error) {
    renderResults([{
      scope: "통신",
      view: "Supabase REST",
      ok: false,
      count: 0,
      error: error instanceof Error ? error.message : "DB 통신 테스트에 실패했어요.",
    }]);
    status.textContent = error instanceof Error ? error.message : "DB 통신 테스트에 실패했어요.";
  } finally {
    setTestButtonsDisabled(false);
  }
}

async function testDbAdapter() {
  const form = readDbConnectionForm();

  if (!form) {
    return;
  }

  setTestButtonsDisabled(true);
  status.textContent = "나니카 SQL/View 접근을 확인하는 중이에요.";

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/test-nanika-db-adapter"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await readApiJson<DbAdapterTestResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.error ?? result.message ?? "db_adapter_test_failed");
    }

    const nextResults = result.results ?? [];
    const failedCount = nextResults.filter((item) => !item.ok).length;
    renderResults(nextResults);
    status.textContent = failedCount === 0
      ? "모든 나니카 DB view에 접근했어요."
      : `${failedCount}개 scope에서 확인이 필요해요.`;
  } catch (error) {
    renderEmptyState("테스트에 실패했어요. 연결 정보와 서버 로그를 확인하세요.");
    status.textContent = error instanceof Error ? error.message : "DB 테스트에 실패했어요.";
  } finally {
    setTestButtonsDisabled(false);
  }
}

clearButton.addEventListener("click", () => {
  urlInput.value = "";
  keyInput.value = "";
  schemaInput.value = "public";
  status.textContent = "입력값을 초기화했어요.";
  renderEmptyState("연결 정보를 입력하고 테스트를 실행하세요.");
});

connectionTestButton.addEventListener("click", () => {
  void testDbConnection();
});

testButton.addEventListener("click", () => {
  void testDbAdapter();
});

renderEmptyState("연결 정보를 입력하고 테스트를 실행하세요.");
