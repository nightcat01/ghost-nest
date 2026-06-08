const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const port = Number(process.env.PORT ?? 4173);
const comfyUiUrl = process.env.COMFYUI_URL ?? "http://127.0.0.1:8188";
const root = __dirname;
const extensionConfigPath = path.join(root, "ghost-nest.extensions.json");
const rootWithSeparator = `${root}${path.sep}`;

function readExtensionConfig() {
  try {
    return JSON.parse(fs.readFileSync(extensionConfigPath, "utf8"));
  } catch (error) {
    return { extensions: {} };
  }
}

function writeExtensionConfig(config) {
  fs.writeFileSync(extensionConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function getExtensionConfig(extensionId) {
  return readExtensionConfig().extensions?.[extensionId] ?? { enabled: false };
}

function getCharacterSettingsConfig() {
  return getExtensionConfig("character-settings");
}

function resolveWorkspacePath(relativeOrAbsolutePath, fallbackPath) {
  const targetPath = String(relativeOrAbsolutePath || fallbackPath);

  return path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(root, targetPath);
}

function ensureInsideDirectory(targetPath, rootPath, errorCode = "invalid_workspace_path") {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);
  const rootWithSeparator = `${resolvedRoot}${path.sep}`;

  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(rootWithSeparator)) {
    throw new Error(errorCode);
  }

  return resolvedTarget;
}

function getCharacterWorkspaceConfig() {
  const workspace = getCharacterSettingsConfig().workspace ?? {};
  const sourceCharactersDirectory = resolveWorkspacePath(workspace.sourceCharacters, "src/characters");
  const buildCharactersDirectory = resolveWorkspacePath(workspace.buildCharacters, "dist/characters");
  const commonAssetsDirectory = resolveWorkspacePath(workspace.commonAssets, "src/assets/common");

  return {
    sourceCharactersDirectory,
    buildCharactersDirectory,
    commonAssetsDirectory,
    browserSourcePrefix: String(workspace.browserSourcePrefix ?? "./src/characters"),
    browserCommonPrefix: String(workspace.browserCommonPrefix ?? "./src/assets/common"),
  };
}

function getCharacterDevServerConfig() {
  const devServer = getCharacterSettingsConfig().devServer ?? {};
  const allowedIps = Array.isArray(devServer.allowedIps)
    ? devServer.allowedIps.map((ip) => String(ip).trim()).filter(Boolean)
    : [];

  return {
    allowLocalhost: devServer.allowLocalhost !== false,
    allowedIps,
    basePath: normalizeBasePath(devServer.basePath ?? process.env.GHOSTNEST_BASE_PATH ?? ""),
  };
}

function normalizeBasePath(basePath) {
  const normalizedPath = String(basePath ?? "").trim().replaceAll("\\", "/").replace(/\/+$/, "");

  if (!normalizedPath || normalizedPath === "/") {
    return "";
  }

  return normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
}

function stripConfiguredBasePath(pathname) {
  const basePath = getCharacterDevServerConfig().basePath;

  if (!basePath) {
    return pathname;
  }

  if (pathname === basePath) {
    return "/";
  }

  return pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length)
    : pathname;
}

function normalizeRemoteAddress(address) {
  return String(address ?? "")
    .replace(/^::ffff:/, "")
    .replace(/^::1$/, "127.0.0.1");
}

function isLocalhostAddress(address) {
  const normalizedAddress = normalizeRemoteAddress(address);

  return normalizedAddress === "127.0.0.1" || normalizedAddress === "localhost";
}

function getRequestIp(request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const firstForwardedIp = forwardedIp?.split(",")[0]?.trim();

  return normalizeRemoteAddress(firstForwardedIp || request.socket.remoteAddress);
}

function isCharacterDevtoolsRequestAllowed(request) {
  const devServer = getCharacterDevServerConfig();
  const requestIp = getRequestIp(request);

  if (devServer.allowLocalhost && isLocalhostAddress(requestIp)) {
    return true;
  }

  return devServer.allowedIps.includes(requestIp);
}

function sendDevtoolsForbidden(response, request) {
  sendJson(response, 403, {
    ok: false,
    error: "devtools_forbidden",
    message: "This IP is not allowed to access GhostNest devtools.",
    requestIp: getRequestIp(request),
  });
}

function isCharacterDevtoolsStaticPath(pathname) {
  const normalizedPathname = stripConfiguredBasePath(pathname);

  return [
    "/dev-character.html",
    "/dev-character-create.html",
    "/dev-character-expression.html",
    "/dev-character-dialogue.html",
    "/dev-character-set.html",
    "/dev-character-scene.html",
    "/dev-character-composition.html",
    "/dev-character-hitbox.html",
    "/dev-menu-settings.html",
    "/dev-nanika-mapping.html",
    "/dev-assets.html",
    "/dev-assets-comfy.html",
    "/dev-assets-layer.html",
    "/dev-assets-crop.html",
  ].includes(normalizedPathname) || normalizedPathname.startsWith("/dist/devtools/");
}

function getCharacterWorkspaceResponse() {
  const workspace = getCharacterSettingsConfig().workspace ?? {};
  const resolved = getCharacterWorkspaceConfig();
  const devServer = getCharacterDevServerConfig();

  return {
    sourceCharacters: String(workspace.sourceCharacters ?? "src/characters"),
    buildCharacters: String(workspace.buildCharacters ?? "dist/characters"),
    commonAssets: String(workspace.commonAssets ?? "src/assets/common"),
    browserSourcePrefix: String(workspace.browserSourcePrefix ?? "./src/characters"),
    browserCommonPrefix: String(workspace.browserCommonPrefix ?? "./src/assets/common"),
    resolved: {
      sourceCharacters: resolved.sourceCharactersDirectory,
      buildCharacters: resolved.buildCharactersDirectory,
      commonAssets: resolved.commonAssetsDirectory,
    },
    devServer: {
      ...devServer,
    },
  };
}

function updateCharacterWorkspaceConfig(body) {
  const nextWorkspace = {
    sourceCharacters: String(body.sourceCharacters ?? "").trim() || "src/characters",
    buildCharacters: String(body.buildCharacters ?? "").trim() || "dist/characters",
    commonAssets: String(body.commonAssets ?? "").trim() || "src/assets/common",
    browserSourcePrefix: String(body.browserSourcePrefix ?? "").trim() || "./src/characters",
    browserCommonPrefix: String(body.browserCommonPrefix ?? "").trim() || "./src/assets/common",
  };
  const nextDevServer = {
    allowLocalhost: body.allowLocalhost !== false,
    basePath: normalizeBasePath(body.basePath ?? getCharacterDevServerConfig().basePath),
    allowedIps: Array.isArray(body.allowedIps)
      ? body.allowedIps.map((ip) => String(ip).trim()).filter(Boolean)
      : String(body.allowedIps ?? "")
        .split(/\r?\n|,/)
        .map((ip) => ip.trim())
        .filter(Boolean),
  };
  const config = readExtensionConfig();

  config.extensions = config.extensions ?? {};
  config.extensions["character-settings"] = {
    ...(config.extensions["character-settings"] ?? {}),
    enabled: config.extensions["character-settings"]?.enabled ?? true,
    devServer: nextDevServer,
    workspace: nextWorkspace,
  };

  writeExtensionConfig(config);

  return getCharacterWorkspaceResponse();
}

function createBrowserAssetPath(prefix, relativePath) {
  const normalizedPrefix = String(prefix || ".").replaceAll("\\", "/").replace(/\/$/, "");
  const normalizedRelativePath = String(relativePath || "").replaceAll("\\", "/").replace(/^\//, "");

  return `${normalizedPrefix}/${normalizedRelativePath}`;
}

function getComfyAssetGeneratorConfig() {
  return getExtensionConfig("comfy-asset-generator");
}

function isCharacterSettingsEnabled() {
  return Boolean(getCharacterSettingsConfig().enabled);
}

function isComfyAssetGeneratorBridgeEnabled() {
  const config = getComfyAssetGeneratorConfig();

  return Boolean(config.enabled && config.devServer?.bridge);
}

function sendComfyAssetGeneratorBridgeDisabled(response) {
  sendJson(response, 403, {
    ok: false,
    error: "comfy_asset_generator_bridge_disabled",
    message: "Comfy Asset Generator devServer.bridge is disabled in ghost-nest.extensions.json. Turn it on to use ComfyUI bridge actions.",
  });
}

function getComfyUiUrl() {
  const config = getComfyAssetGeneratorConfig();

  return process.env.COMFYUI_URL
    ?? config.devServer?.comfyUiUrl
    ?? "http://127.0.0.1:8188";
}

function getConfiguredWorkflowPath() {
  const config = getComfyAssetGeneratorConfig();

  return process.env.COMFYUI_WORKFLOW_PATH ?? config.devServer?.workflowPath ?? "src/devtools/layer-part-workflow.api.json";
}

function getDefaultWorkflowPath() {
  return "src/devtools/layer-part-workflow.api.json";
}

function getBuiltWorkflowPath() {
  return "dist/devtools/layer-part-workflow.api.json";
}

function getWorkflowProfilePaths(modelProfile) {
  const profile = String(modelProfile ?? "sdxl-inpaint");
  const workflowProfiles = {
    "sdxl-inpaint": {
      source: "src/devtools/layer-part-workflow.sdxl-inpaint.api.json",
      built: "dist/devtools/layer-part-workflow.sdxl-inpaint.api.json",
    },
    "sdxl-general": {
      source: "src/devtools/layer-part-workflow.sdxl-general.api.json",
      built: "dist/devtools/layer-part-workflow.sdxl-general.api.json",
    },
    "sd15-inpaint": {
      source: "src/devtools/layer-part-workflow.sd15-inpaint.api.json",
      built: "dist/devtools/layer-part-workflow.sd15-inpaint.api.json",
    },
  };

  return workflowProfiles[profile] ?? workflowProfiles["sdxl-inpaint"];
}

function getWorkflowPathCandidates() {
  return Array.from(new Set([
    getConfiguredWorkflowPath(),
    getDefaultWorkflowPath(),
    getBuiltWorkflowPath(),
  ]));
}

function getWorkflowPathCandidatesForBody(body = {}) {
  const source = body.workflowSource ?? {};
  const profilePaths = getWorkflowProfilePaths(body.modelProfile ?? source.modelProfile);

  return Array.from(new Set([
    profilePaths.source,
    profilePaths.built,
    getConfiguredWorkflowPath(),
    getDefaultWorkflowPath(),
    getBuiltWorkflowPath(),
  ]));
}

function resolveWorkflowPath(workflowPath) {
  return path.resolve(root, workflowPath);
}

function getResolvedWorkflowPath() {
  return resolveWorkflowPath(getConfiguredWorkflowPath());
}

function findExistingWorkflowPath(body) {
  const candidates = body
    ? getWorkflowPathCandidatesForBody(body)
    : getWorkflowPathCandidates();

  return candidates
    .map((workflowPath) => ({
      workflowPath,
      resolvedWorkflowPath: resolveWorkflowPath(workflowPath),
    }))
    .find((candidate) => fs.existsSync(candidate.resolvedWorkflowPath)) ?? null;
}

function createWorkflowPathInfo(body) {
  const selectedWorkflowPath = findExistingWorkflowPath(body);
  const source = body?.workflowSource ?? {};
  const profilePaths = getWorkflowProfilePaths(body?.modelProfile ?? source.modelProfile);
  const workflowPathCandidates = body
    ? getWorkflowPathCandidatesForBody(body)
    : getWorkflowPathCandidates();

  return {
    workflowPath: getConfiguredWorkflowPath(),
    resolvedWorkflowPath: getResolvedWorkflowPath(),
    defaultWorkflowPath: getDefaultWorkflowPath(),
    resolvedDefaultWorkflowPath: resolveWorkflowPath(getDefaultWorkflowPath()),
    builtWorkflowPath: getBuiltWorkflowPath(),
    resolvedBuiltWorkflowPath: resolveWorkflowPath(getBuiltWorkflowPath()),
    modelProfile: body?.modelProfile ?? source.modelProfile ?? null,
    profileWorkflowPath: profilePaths.source,
    resolvedProfileWorkflowPath: resolveWorkflowPath(profilePaths.source),
    builtProfileWorkflowPath: profilePaths.built,
    resolvedBuiltProfileWorkflowPath: resolveWorkflowPath(profilePaths.built),
    selectedWorkflowPath: selectedWorkflowPath?.workflowPath ?? null,
    selectedResolvedWorkflowPath: selectedWorkflowPath?.resolvedWorkflowPath ?? null,
    workflowPathCandidates: workflowPathCandidates.map((workflowPath) => ({
      workflowPath,
      resolvedWorkflowPath: resolveWorkflowPath(workflowPath),
    })),
  };
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
};

function resolveRequestPath(url) {
  const pathname = new URL(url, `http://127.0.0.1:${port}`).pathname;
  const normalizedPathname = stripConfiguredBasePath(pathname);
  const requestedPath = normalizedPathname === "/" ? "/index.html" : normalizedPathname;
  const filePath = path.normalize(path.join(root, requestedPath));

  if (filePath !== root && !filePath.startsWith(rootWithSeparator)) {
    return null;
  }

  return filePath;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function getNanikaMappingsPath() {
  const generatedDirectory = path.resolve(root, "generated");

  return ensureInsideDirectory(
    path.join(generatedDirectory, "nanika-mappings.json"),
    generatedDirectory,
    "nanika_mapping_path_outside_project",
  );
}

function getNanikaFeatureSetsPath() {
  const generatedDirectory = path.resolve(root, "generated");

  return ensureInsideDirectory(
    path.join(generatedDirectory, "nanika-feature-sets.json"),
    generatedDirectory,
    "nanika_feature_set_path_outside_project",
  );
}

function getNanikaConditionsPath() {
  const generatedDirectory = path.resolve(root, "generated");

  return ensureInsideDirectory(
    path.join(generatedDirectory, "nanika-conditions.json"),
    generatedDirectory,
    "nanika_condition_path_outside_project",
  );
}

function getNanikaMenusPath() {
  const generatedDirectory = path.resolve(root, "generated");

  return ensureInsideDirectory(
    path.join(generatedDirectory, "nanika-menus.json"),
    generatedDirectory,
    "nanika_menu_path_outside_project",
  );
}

function assertSafeNanikaMappingId(id) {
  const safeId = String(id ?? "").trim();

  if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(safeId)) {
    throw new Error("invalid_nanika_mapping_id");
  }

  return safeId;
}

function assertSafeNanikaFeatureSetId(id) {
  const safeId = String(id ?? "").trim();

  if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(safeId)) {
    throw new Error("invalid_nanika_feature_set_id");
  }

  return safeId;
}

function assertSafeNanikaConditionId(id) {
  const safeId = String(id ?? "").trim();

  if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(safeId)) {
    throw new Error("invalid_nanika_condition_id");
  }

  return safeId;
}

function assertSafeNanikaMenuId(id) {
  const safeId = String(id ?? "").trim();

  if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(safeId)) {
    throw new Error("invalid_nanika_menu_id");
  }

  return safeId;
}

function assertSafeNanikaResourceId(id) {
  const safeId = String(id ?? "").trim();

  if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(safeId)) {
    throw new Error("invalid_nanika_resource_id");
  }

  return safeId;
}

function normalizeNanikaFeatureRequirement(requirement) {
  if (!requirement || typeof requirement !== "object" || Array.isArray(requirement)) {
    throw new Error("invalid_nanika_feature_requirement");
  }

  const kind = String(requirement.kind ?? "").trim();
  const allowedKinds = new Set(["expression", "surface", "scene", "layer", "dialogue", "hitArea"]);

  if (!allowedKinds.has(kind)) {
    throw new Error("invalid_nanika_feature_requirement_kind");
  }

  const id = assertSafeNanikaResourceId(requirement.id);
  const label = String(requirement.label ?? "").trim();

  return {
    kind,
    id,
    ...(label ? { label } : {}),
    ...(typeof requirement.required === "boolean" ? { required: requirement.required } : {}),
  };
}

function normalizeNanikaAction(action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new Error("invalid_nanika_mapping_action");
  }

  const normalizedAction = cloneJson(action);

  if (typeof normalizedAction.type !== "string" || !normalizedAction.type.trim()) {
    throw new Error("invalid_nanika_mapping_action");
  }

  normalizedAction.type = normalizedAction.type.trim();

  return normalizedAction;
}

function normalizeNanikaMapping(mapping) {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    throw new Error("invalid_nanika_mapping");
  }

  const id = assertSafeNanikaMappingId(mapping.id);
  const event = String(mapping.event ?? "").trim();

  if (!event) {
    throw new Error("invalid_nanika_mapping_event");
  }

  if (!Array.isArray(mapping.actions) || mapping.actions.length === 0) {
    throw new Error("invalid_nanika_mapping_actions");
  }

  const normalized = {
    id,
    event,
    actions: mapping.actions.map(normalizeNanikaAction),
  };
  const name = String(mapping.name ?? "").trim();
  const description = String(mapping.description ?? "").trim();

  if (name) {
    normalized.name = name;
  }

  if (description) {
    normalized.description = description;
  }

  if (mapping.target && typeof mapping.target === "object" && !Array.isArray(mapping.target)) {
    const targetScope = String(mapping.target.scope ?? "").trim();
    const targetId = String(mapping.target.id ?? "").trim();
    const targetLabel = String(mapping.target.label ?? "").trim();

    if (targetScope && targetId) {
      normalized.target = {
        scope: targetScope,
        id: targetId,
        ...(targetLabel ? { label: targetLabel } : {}),
      };
    }
  }

  if (mapping.when && typeof mapping.when === "object" && !Array.isArray(mapping.when)) {
    normalized.when = cloneJson(mapping.when);
  }

  if (Array.isArray(mapping.conditions)) {
    normalized.conditions = cloneJson(mapping.conditions);
  }

  return normalized;
}

function normalizeNanikaCondition(condition) {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    throw new Error("invalid_nanika_condition");
  }

  const id = assertSafeNanikaConditionId(condition.id);
  const scope = String(condition.scope ?? "").trim();
  const type = String(condition.type ?? "").trim();
  const operator = String(condition.operator ?? "").trim();
  const value = String(condition.value ?? "").trim();
  const name = String(condition.name ?? "").trim();
  const description = String(condition.description ?? "").trim();
  const allowedScopes = new Set(["runtime", "character"]);
  const allowedTypes = new Set(["url", "pageId"]);
  const allowedOperators = new Set(["contains", "startsWith", "equals", "pattern"]);

  if (!allowedScopes.has(scope)) {
    throw new Error("invalid_nanika_condition_scope");
  }

  if (!allowedTypes.has(type)) {
    throw new Error("invalid_nanika_condition_type");
  }

  if (!value) {
    throw new Error("invalid_nanika_condition_value");
  }

  const normalizedOperator = type === "url"
    ? allowedOperators.has(operator) ? operator : "contains"
    : "equals";

  return {
    id,
    scope,
    type,
    operator: normalizedOperator,
    value,
    ...(name ? { name } : {}),
    ...(description ? { description } : {}),
  };
}

function normalizeManagementMenuItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error("invalid_nanika_menu_item");
  }

  const id = String(item.id ?? "").trim();
  const label = String(item.label ?? "").trim();
  const description = String(item.description ?? "").trim();

  if (!id || !label) {
    throw new Error("invalid_nanika_menu_item");
  }

  const normalized = {
    id,
    label,
  };

  if (description) {
    normalized.description = description;
  }

  if (Array.isArray(item.actions) && item.actions.length > 0) {
    normalized.actions = item.actions.map(normalizeNanikaAction);
  }

  if (Array.isArray(item.children) && item.children.length > 0) {
    normalized.children = item.children.map(normalizeManagementMenuItem);
  }

  return normalized;
}

function normalizeNanikaMenu(menu) {
  if (!menu || typeof menu !== "object" || Array.isArray(menu)) {
    throw new Error("invalid_nanika_menu");
  }

  const id = assertSafeNanikaMenuId(menu.id);
  const name = String(menu.name ?? "").trim();
  const description = String(menu.description ?? "").trim();
  const audience = String(menu.audience ?? "").trim();
  const defaultDisplay = String(menu.defaultDisplay ?? "").trim();

  if (!Array.isArray(menu.items)) {
    throw new Error("invalid_nanika_menu_items");
  }

  const normalized = {
    id,
    items: menu.items.map(normalizeManagementMenuItem),
  };

  if (name) {
    normalized.name = name;
  }

  if (description) {
    normalized.description = description;
  }

  if (audience === "user" || audience === "developer" || audience === "custom") {
    normalized.audience = audience;
  }

  if (defaultDisplay) {
    normalized.defaultDisplay = defaultDisplay;
  }

  if (typeof menu.closeOnSelect === "boolean") {
    normalized.closeOnSelect = menu.closeOnSelect;
  }

  if (typeof menu.draggable === "boolean") {
    normalized.draggable = menu.draggable;
  }

  return normalized;
}

function normalizeNanikaFeatureSet(featureSet) {
  if (!featureSet || typeof featureSet !== "object" || Array.isArray(featureSet)) {
    throw new Error("invalid_nanika_feature_set");
  }

  const id = assertSafeNanikaFeatureSetId(featureSet.id);

  if (!Array.isArray(featureSet.mappingIds) || featureSet.mappingIds.length === 0) {
    throw new Error("invalid_nanika_feature_set_mappings");
  }

  const mappingIds = Array.from(new Set(featureSet.mappingIds.map(assertSafeNanikaMappingId)));
  const normalized = {
    id,
    mappingIds,
  };
  const name = String(featureSet.name ?? "").trim();
  const description = String(featureSet.description ?? "").trim();

  if (name) {
    normalized.name = name;
  }

  if (description) {
    normalized.description = description;
  }

  if (featureSet.mode === "character-specific" || featureSet.mode === "character-template") {
    normalized.mode = featureSet.mode;
  }

  const sourceCharacterId = String(featureSet.sourceCharacterId ?? "").trim();
  if (sourceCharacterId) {
    normalized.sourceCharacterId = safeFileName(sourceCharacterId);
  }

  if (Array.isArray(featureSet.requirements)) {
    normalized.requirements = featureSet.requirements.map(normalizeNanikaFeatureRequirement);
  }

  return normalized;
}

async function readNanikaMappings() {
  const mappingsPath = getNanikaMappingsPath();

  try {
    const source = await fs.promises.readFile(mappingsPath, "utf8");
    const parsed = JSON.parse(source);
    const mappings = Array.isArray(parsed) ? parsed : parsed.mappings;

    return Array.isArray(mappings) ? mappings.map(normalizeNanikaMapping) : [];
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw new Error("invalid_nanika_mappings_file");
  }
}

async function writeNanikaMappings(mappings) {
  const mappingsPath = getNanikaMappingsPath();

  await fs.promises.mkdir(path.dirname(mappingsPath), { recursive: true });
  await fs.promises.writeFile(
    mappingsPath,
    `${JSON.stringify({ mappings }, null, 2)}\n`,
    "utf8",
  );

  return path.relative(root, mappingsPath).replaceAll(path.sep, "/");
}

async function readNanikaConditions() {
  const conditionsPath = getNanikaConditionsPath();

  try {
    const source = await fs.promises.readFile(conditionsPath, "utf8");
    const parsed = JSON.parse(source);
    const conditions = Array.isArray(parsed) ? parsed : parsed.conditions;

    return Array.isArray(conditions) ? conditions.map(normalizeNanikaCondition) : [];
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw new Error("invalid_nanika_conditions_file");
  }
}

async function writeNanikaConditions(conditions) {
  const conditionsPath = getNanikaConditionsPath();

  await fs.promises.mkdir(path.dirname(conditionsPath), { recursive: true });
  await fs.promises.writeFile(
    conditionsPath,
    `${JSON.stringify({ conditions }, null, 2)}\n`,
    "utf8",
  );

  return path.relative(root, conditionsPath).replaceAll(path.sep, "/");
}

async function readNanikaMenus() {
  const menusPath = getNanikaMenusPath();

  try {
    const source = await fs.promises.readFile(menusPath, "utf8");
    const parsed = JSON.parse(source);
    const menus = Array.isArray(parsed) ? parsed : parsed.menus;

    return Array.isArray(menus) ? menus.map(normalizeNanikaMenu) : [];
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw new Error("invalid_nanika_menus_file");
  }
}

async function writeNanikaMenus(menus) {
  const menusPath = getNanikaMenusPath();

  await fs.promises.mkdir(path.dirname(menusPath), { recursive: true });
  await fs.promises.writeFile(
    menusPath,
    `${JSON.stringify({ menus }, null, 2)}\n`,
    "utf8",
  );

  return path.relative(root, menusPath).replaceAll(path.sep, "/");
}

async function readNanikaFeatureSets() {
  const featureSetsPath = getNanikaFeatureSetsPath();

  try {
    const source = await fs.promises.readFile(featureSetsPath, "utf8");
    const parsed = JSON.parse(source);
    const featureSets = Array.isArray(parsed) ? parsed : parsed.featureSets;

    return Array.isArray(featureSets) ? featureSets.map(normalizeNanikaFeatureSet) : [];
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw new Error("invalid_nanika_feature_sets_file");
  }
}

async function writeNanikaFeatureSets(featureSets) {
  const featureSetsPath = getNanikaFeatureSetsPath();

  await fs.promises.mkdir(path.dirname(featureSetsPath), { recursive: true });
  await fs.promises.writeFile(
    featureSetsPath,
    `${JSON.stringify({ featureSets }, null, 2)}\n`,
    "utf8",
  );

  return path.relative(root, featureSetsPath).replaceAll(path.sep, "/");
}

function getFileNanikaDataScope(scope) {
  const normalizedScope = String(scope ?? "").trim();

  if (normalizedScope === "mappings") {
    return {
      itemKey: "mapping",
      itemsKey: "mappings",
      invalidIdError: "invalid_nanika_mapping_id",
      normalize: normalizeNanikaMapping,
      read: readNanikaMappings,
      write: writeNanikaMappings,
      assertId: assertSafeNanikaMappingId,
    };
  }

  if (normalizedScope === "featureSets") {
    return {
      itemKey: "featureSet",
      itemsKey: "featureSets",
      invalidIdError: "invalid_nanika_feature_set_id",
      normalize: normalizeNanikaFeatureSet,
      read: readNanikaFeatureSets,
      write: writeNanikaFeatureSets,
      assertId: assertSafeNanikaFeatureSetId,
    };
  }

  if (normalizedScope === "conditions") {
    return {
      itemKey: "condition",
      itemsKey: "conditions",
      invalidIdError: "invalid_nanika_condition_id",
      normalize: normalizeNanikaCondition,
      read: readNanikaConditions,
      write: writeNanikaConditions,
      assertId: assertSafeNanikaConditionId,
    };
  }

  if (normalizedScope === "menus") {
    return {
      itemKey: "menu",
      itemsKey: "menus",
      invalidIdError: "invalid_nanika_menu_id",
      normalize: normalizeNanikaMenu,
      read: readNanikaMenus,
      write: writeNanikaMenus,
      assertId: assertSafeNanikaMenuId,
    };
  }

  throw new Error("unsupported_nanika_data_scope");
}

function createFileNanikaDataAdapter() {
  return {
    async list(scope) {
      const scopeConfig = getFileNanikaDataScope(scope);
      return scopeConfig.read();
    },
    async getItem(scope, id) {
      const scopeConfig = getFileNanikaDataScope(scope);
      const safeId = scopeConfig.assertId(id);
      const items = await scopeConfig.read();

      return items.find((item) => item.id === safeId) ?? null;
    },
    async saveItem(scope, id, value) {
      const scopeConfig = getFileNanikaDataScope(scope);
      const rawItem = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      const item = scopeConfig.normalize({ ...rawItem, id: id ?? rawItem.id });
      const items = await scopeConfig.read();
      const nextItems = [
        ...items.filter((candidate) => candidate.id !== item.id),
        item,
      ];

      await scopeConfig.write(nextItems);
    },
    async deleteItem(scope, id) {
      const scopeConfig = getFileNanikaDataScope(scope);
      const safeId = scopeConfig.assertId(id);
      const items = await scopeConfig.read();
      const nextItems = items.filter((item) => item.id !== safeId);

      await scopeConfig.write(nextItems);
    },
  };
}

function getNanikaDataScopePath(scope) {
  if (scope === "mappings") {
    return getNanikaMappingsPath();
  }

  if (scope === "featureSets") {
    return getNanikaFeatureSetsPath();
  }

  if (scope === "conditions") {
    return getNanikaConditionsPath();
  }

  if (scope === "menus") {
    return getNanikaMenusPath();
  }

  throw new Error("unsupported_nanika_data_scope");
}

function getNanikaDataResponsePath(scope) {
  try {
    return path.relative(root, getNanikaDataScopePath(scope)).replaceAll(path.sep, "/");
  } catch {
    return undefined;
  }
}

function resolveNanikaDataAdapter() {
  return createFileNanikaDataAdapter();
}

function readRequestJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

async function checkComfyUiStatus() {
  const response = await fetch(`${getComfyUiUrl()}/system_stats`, {
    method: "GET",
    signal: AbortSignal.timeout(3000),
  });

  return {
    ok: response.ok,
    status: response.status,
  };
}

async function fetchComfyObjectInfo() {
  const response = await fetch(`${getComfyUiUrl()}/object_info`, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`object_info_failed:${response.status}`);
  }

  return response.json();
}

function readComboValues(objectInfo, nodeName, inputName) {
  const input = objectInfo?.[nodeName]?.input?.required?.[inputName];
  const values = Array.isArray(input) ? input[0] : null;

  return Array.isArray(values) ? values.filter((value) => typeof value === "string") : [];
}

async function getComfyModels() {
  const objectInfo = await fetchComfyObjectInfo();

  return {
    checkpoints: readComboValues(objectInfo, "CheckpointLoaderSimple", "ckpt_name"),
    controlnet: readComboValues(objectInfo, "ControlNetLoader", "control_net_name"),
    clipVision: readComboValues(objectInfo, "CLIPVisionLoader", "clip_name"),
  };
}

async function readCharacterAssets(characterId) {
  const safeCharacterId = safeFileName(characterId || "rine");
  const { buildCharactersDirectory } = getCharacterWorkspaceConfig();
  const characterModulePath = path.join(buildCharactersDirectory, safeCharacterId, "index.js");

  if (!fs.existsSync(characterModulePath)) {
    throw new Error("character_dist_not_found");
  }

  const assetDirectory = path.join(buildCharactersDirectory, safeCharacterId, "assets");
  const assetPaths = {
    meta: path.join(assetDirectory, "meta.js"),
    expressions: path.join(assetDirectory, "expressions.js"),
    surfaces: path.join(assetDirectory, "surfaces.js"),
    scenes: path.join(assetDirectory, "scenes.js"),
  };
  const linesPath = path.join(buildCharactersDirectory, safeCharacterId, "lines.js");

  if (Object.values(assetPaths).every((assetPath) => fs.existsSync(assetPath))) {
    const names = createCharacterAssetExportNames(safeCharacterId);
    const exportName = toExportName(safeCharacterId);
    const cacheKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const [metaModule, expressionsModule, surfacesModule, scenesModule, linesModule] = await Promise.all([
      import(`${pathToFileURL(assetPaths.meta).href}?t=${cacheKey}`),
      import(`${pathToFileURL(assetPaths.expressions).href}?t=${cacheKey}`),
      import(`${pathToFileURL(assetPaths.surfaces).href}?t=${cacheKey}`),
      import(`${pathToFileURL(assetPaths.scenes).href}?t=${cacheKey}`),
      fs.existsSync(linesPath)
        ? import(`${pathToFileURL(linesPath).href}?t=${cacheKey}`)
        : Promise.resolve({}),
    ]);
    const defaultScene = scenesModule[names.defaultScene];
    const lines = linesModule[`${exportName}Lines`] ?? {};
    const assets = {
      ...(metaModule[names.assetMeta] ?? {}),
      expressions: expressionsModule[names.expressions] ?? {},
      surfaces: surfacesModule[names.surfaces] ?? {},
      defaultScene: defaultScene ?? "",
      scenes: scenesModule[names.scenes] ?? {},
    };

    return {
      characterId: safeCharacterId,
      assets: normalizeCharacterAssets(safeCharacterId, assets),
      lines: cloneJson(lines),
    };
  }

  const moduleUrl = `${pathToFileURL(characterModulePath).href}?t=${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const characterModule = await import(moduleUrl);
  const character = characterModule[safeCharacterId] ?? characterModule.default;

  return {
    characterId: safeCharacterId,
    assets: normalizeCharacterAssets(safeCharacterId, character?.assets ?? {}),
    lines: cloneJson(character?.lines ?? {}),
  };
}

async function readCharacterList() {
  const { sourceCharactersDirectory, buildCharactersDirectory } = getCharacterWorkspaceConfig();
  const characterIds = new Set();

  if (fs.existsSync(sourceCharactersDirectory)) {
    const sourceEntries = await fs.promises.readdir(sourceCharactersDirectory, { withFileTypes: true });

    sourceEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((characterId) => fs.existsSync(path.join(sourceCharactersDirectory, characterId, "index.ts")))
      .forEach((characterId) => characterIds.add(characterId));
  }

  if (fs.existsSync(buildCharactersDirectory)) {
    const buildEntries = await fs.promises.readdir(buildCharactersDirectory, { withFileTypes: true });

    buildEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((characterId) => fs.existsSync(path.join(buildCharactersDirectory, characterId, "index.js")))
      .forEach((characterId) => characterIds.add(characterId));
  }

  return Array.from(characterIds)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
}

function resolveCharacterSourcePath(characterId) {
  const safeCharacterId = safeFileName(characterId || "rine");
  const { sourceCharactersDirectory } = getCharacterWorkspaceConfig();
  const characterSourcePath = ensureInsideDirectory(
    path.resolve(sourceCharactersDirectory, safeCharacterId, "index.ts"),
    sourceCharactersDirectory,
    "invalid_character_id",
  );

  if (!fs.existsSync(characterSourcePath)) {
    throw new Error("character_source_not_found");
  }

  return {
    safeCharacterId,
    characterSourcePath,
  };
}

/**
 * Resolves the built character module path when it exists for live dev-tool refreshes.
 */
function resolveCharacterBuildPath(safeCharacterId) {
  const { buildCharactersDirectory } = getCharacterWorkspaceConfig();
  const characterBuildPath = ensureInsideDirectory(
    path.resolve(buildCharactersDirectory, safeCharacterId, "index.js"),
    buildCharactersDirectory,
    "invalid_character_id",
  );

  return fs.existsSync(characterBuildPath) ? characterBuildPath : null;
}

function findMatchingBrace(source, openBraceIndex) {
  let depth = 0;
  let quote = null;
  let isEscaped = false;

  for (let index = openBraceIndex; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === "\\") {
        isEscaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "\"" || character === "'" || character === "`") {
      quote = character;
      continue;
    }

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  throw new Error("object_block_not_found");
}

function findPropertyBlock(source, containerStart, containerEnd, propertyName) {
  const patterns = [
    new RegExp(`(^|[\\s,])${propertyName}\\s*:\\s*{`, "m"),
    new RegExp(`(^|[\\s,])["']${propertyName}["']\\s*:\\s*{`, "m"),
  ];
  const container = source.slice(containerStart, containerEnd);

  for (const pattern of patterns) {
    const match = pattern.exec(container);

    if (!match?.index && match?.index !== 0) {
      continue;
    }

    const openBraceIndex = containerStart + match.index + match[0].lastIndexOf("{");

    return {
      start: openBraceIndex,
      end: findMatchingBrace(source, openBraceIndex),
    };
  }

  return null;
}

function findObjectPropertyBlock(source, containerStart, containerEnd, propertyName) {
  const escapedName = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`(^|[\\s,])${escapedName}\\s*:\\s*{`, "m"),
    new RegExp(`(^|[\\s,])["']${escapedName}["']\\s*:\\s*{`, "m"),
  ];
  const container = source.slice(containerStart, containerEnd);

  for (const pattern of patterns) {
    const match = pattern.exec(container);

    if (!match?.index && match?.index !== 0) {
      continue;
    }

    const propertyStart = containerStart + match.index + (match[1]?.length ?? 0);
    const openBraceIndex = containerStart + match.index + match[0].lastIndexOf("{");

    return {
      propertyStart,
      start: openBraceIndex,
      end: findMatchingBrace(source, openBraceIndex),
    };
  }

  return null;
}

function findPropertyValueRange(source, containerStart, containerEnd, propertyName) {
  const escapedName = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`(^|[\\s,])${escapedName}\\s*:`, "m"),
    new RegExp(`(^|[\\s,])["']${escapedName}["']\\s*:`, "m"),
  ];
  const container = source.slice(containerStart, containerEnd);

  for (const pattern of patterns) {
    const match = pattern.exec(container);

    if (!match?.index && match?.index !== 0) {
      continue;
    }

    const propertyStart = containerStart + match.index + (match[1]?.length ?? 0);
    let valueStart = containerStart + match.index + match[0].length;

    while (source[valueStart] === " " || source[valueStart] === "\t") {
      valueStart += 1;
    }

    let valueEnd = valueStart;
    const quote = source[valueStart] === "\"" || source[valueStart] === "'" || source[valueStart] === "`"
      ? source[valueStart]
      : null;

    if (quote) {
      valueEnd += 1;

      while (valueEnd < containerEnd) {
        if (source[valueEnd] === "\\" && valueEnd + 1 < containerEnd) {
          valueEnd += 2;
          continue;
        }

        if (source[valueEnd] === quote) {
          valueEnd += 1;
          break;
        }

        valueEnd += 1;
      }
    } else {
      while (valueEnd < containerEnd && ![",", "\n", "\r", "}"].includes(source[valueEnd])) {
        valueEnd += 1;
      }
    }

    return {
      propertyStart,
      valueStart,
      valueEnd,
    };
  }

  return null;
}

function formatObjectLiteral(value, indent = 12) {
  const indentation = " ".repeat(indent);
  const rawJson = JSON.stringify(value, null, 2);

  return rawJson
    .split("\n")
    .map((line, index) => (index === 0 ? line : `${indentation}${line}`))
    .join("\n");
}

function formatAssetsLiteral(assets) {
  return formatObjectLiteral(assets, 6);
}

/**
 * Creates stable export names for split character asset modules.
 */
function createCharacterAssetExportNames(characterId) {
  const exportName = toExportName(characterId);

  return {
    assetMeta: `${exportName}AssetMeta`,
    expressions: `${exportName}Expressions`,
    surfaces: `${exportName}Surfaces`,
    defaultScene: `${exportName}DefaultScene`,
    scenes: `${exportName}Scenes`,
  };
}

/**
 * Creates the source text for split TypeScript asset modules.
 */
function createCharacterSourceAssetFiles(characterId, assets) {
  const names = createCharacterAssetExportNames(characterId);

  return {
    meta: `import type { CharacterAssets } from "../../../core/types.js";\n\nexport const ${names.assetMeta} = ${JSON.stringify({
      alt: assets.alt,
      ...(assets.hitAreas ? { hitAreas: assets.hitAreas } : {}),
    }, null, 2)} satisfies Pick<CharacterAssets, "alt" | "hitAreas">;\n`,
    expressions: `import type { CharacterAssets } from "../../../core/types.js";\n\nexport const ${names.expressions} = ${JSON.stringify(assets.expressions ?? {}, null, 2)} satisfies CharacterAssets["expressions"];\n`,
    surfaces: `import type { CharacterAssets } from "../../../core/types.js";\n\nexport const ${names.surfaces} = ${JSON.stringify(assets.surfaces ?? {}, null, 2)} satisfies NonNullable<CharacterAssets["surfaces"]>;\n`,
    scenes: `import type { CharacterAssets } from "../../../core/types.js";\n\nexport const ${names.defaultScene} = ${JSON.stringify(assets.defaultScene ?? "")};\n\nexport const ${names.scenes} = ${JSON.stringify(assets.scenes ?? {}, null, 2)} satisfies NonNullable<CharacterAssets["scenes"]>;\n`,
  };
}

/**
 * Creates the source text for split built JavaScript asset modules.
 */
function createCharacterBuildAssetFiles(characterId, assets) {
  const names = createCharacterAssetExportNames(characterId);

  return {
    meta: `export const ${names.assetMeta} = ${JSON.stringify({
      alt: assets.alt,
      ...(assets.hitAreas ? { hitAreas: assets.hitAreas } : {}),
    }, null, 2)};\n`,
    expressions: `export const ${names.expressions} = ${JSON.stringify(assets.expressions ?? {}, null, 2)};\n`,
    surfaces: `export const ${names.surfaces} = ${JSON.stringify(assets.surfaces ?? {}, null, 2)};\n`,
    scenes: `export const ${names.defaultScene} = ${JSON.stringify(assets.defaultScene ?? "")};\n\nexport const ${names.scenes} = ${JSON.stringify(assets.scenes ?? {}, null, 2)};\n`,
  };
}

function createCharacterSourceLinesFile(characterId, lines) {
  const exportName = toExportName(characterId);

  return `import type { DialogueLineSet } from "../../core/types.js";\n\nexport const ${exportName}Lines: DialogueLineSet = ${JSON.stringify(lines, null, 2)};\n`;
}

function createCharacterBuildLinesFile(characterId, lines) {
  const exportName = toExportName(characterId);

  return `export const ${exportName}Lines = ${JSON.stringify(lines, null, 2)};\n`;
}

/**
 * Creates the character index module that only composes split asset modules.
 */
function createCharacterIndexFile(characterId, options = {}) {
  const exportName = toExportName(characterId);
  const names = createCharacterAssetExportNames(characterId);
  const includeTypeImport = options.includeTypeImport ?? true;

  return `import { ${exportName}Lines } from "./lines.js";\nimport { ${exportName}Profile } from "./profile.js";\nimport { ${names.expressions} } from "./assets/expressions.js";\nimport { ${names.assetMeta} } from "./assets/meta.js";\nimport { ${names.defaultScene}, ${names.scenes} } from "./assets/scenes.js";\nimport { ${names.surfaces} } from "./assets/surfaces.js";\n${includeTypeImport ? 'import type { CharacterDefinition } from "../../core/types.js";\n' : ""}\nexport const ${exportName}${includeTypeImport ? ": CharacterDefinition" : ""} = {\n  profile: ${exportName}Profile,\n  lines: ${exportName}Lines,\n  assets: {\n    ...${names.assetMeta},\n    expressions: ${names.expressions},\n    surfaces: ${names.surfaces},\n    defaultScene: ${names.defaultScene},\n    scenes: ${names.scenes},\n  },\n};\n\nexport default ${exportName};\n`;
}

function insertPropertyBeforeClose(source, blockEnd, text) {
  const prefix = source.slice(0, blockEnd).replace(/\s*$/, "");
  const suffix = source.slice(blockEnd);
  const needsComma = !prefix.endsWith("{") && !prefix.endsWith(",");

  return `${prefix}${needsComma ? "," : ""}\n${text}\n${suffix}`;
}

/**
 * Removes an object property block while keeping surrounding source formatting readable.
 */
function removeObjectProperty(source, propertyStart, propertyEnd) {
  const lineStart = source.lastIndexOf("\n", propertyStart) + 1;
  let removeEnd = propertyEnd + 1;

  while (source[removeEnd] === " " || source[removeEnd] === "\t") {
    removeEnd += 1;
  }

  if (source[removeEnd] === ",") {
    removeEnd += 1;
  }

  while (source[removeEnd] === " " || source[removeEnd] === "\t") {
    removeEnd += 1;
  }

  if (source.slice(removeEnd, removeEnd + 2) === "\r\n") {
    removeEnd += 2;
  } else if (source[removeEnd] === "\n") {
    removeEnd += 1;
  }

  return `${source.slice(0, lineStart)}${source.slice(removeEnd)}`;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeCharacterAssetPath(characterId, assetPath) {
  if (typeof assetPath !== "string") {
    return assetPath;
  }

  const { browserSourcePrefix } = getCharacterWorkspaceConfig();
  const normalizedBrowserSourcePrefix = browserSourcePrefix.replaceAll("\\", "/").replace(/\/$/, "");
  const characterPrefix = `${normalizedBrowserSourcePrefix}/${characterId}/`;
  const normalizedPath = assetPath.replaceAll("\\", "/");

  if (!normalizedPath.startsWith(characterPrefix) || normalizedPath.startsWith(`${characterPrefix}assets/`)) {
    return assetPath;
  }

  const fileName = path.posix.basename(normalizedPath);
  const baseAssetPath = `${normalizedBrowserSourcePrefix}/${characterId}/assets/base/${fileName}`;
  const partAssetPath = `${normalizedBrowserSourcePrefix}/${characterId}/assets/parts/${fileName}`;
  const { sourceCharactersDirectory } = getCharacterWorkspaceConfig();

  if (fs.existsSync(path.resolve(sourceCharactersDirectory, characterId, "assets", "base", fileName))) {
    return baseAssetPath;
  }

  if (fs.existsSync(path.resolve(sourceCharactersDirectory, characterId, "assets", "parts", fileName))) {
    return partAssetPath;
  }

  return assetPath;
}

function normalizeCharacterAssetValue(characterId, value) {
  if (typeof value === "string") {
    return normalizeCharacterAssetPath(characterId, value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeCharacterAssetValue(characterId, item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeCharacterAssetValue(characterId, item)]),
    );
  }

  return value;
}

function normalizeCharacterAssets(characterId, assets) {
  return normalizeCharacterAssetValue(characterId, assets);
}

function replaceCharacterAssetsSource(source, assets) {
  const rootObjectStart = source.indexOf("assets:");

  if (rootObjectStart === -1) {
    throw new Error("character_assets_not_found");
  }

  const assetsBlock = findPropertyBlock(source, rootObjectStart, source.length, "assets");

  if (!assetsBlock) {
    throw new Error("character_assets_not_found");
  }

  const propertyStart = source.lastIndexOf("assets", assetsBlock.start);
  const replacement = `assets: ${formatAssetsLiteral(assets)}`;

  return `${source.slice(0, propertyStart)}${replacement}${source.slice(assetsBlock.end + 1)}`;
}

async function readEditableCharacterAssets(characterId) {
  const { assets } = await readCharacterAssets(characterId);

  return cloneJson(assets);
}

function upsertSurfaceInAssets(assets, surfaceId, surface) {
  const surfaces = assets.surfaces ?? {};
  const existingSurface = surfaces[surfaceId] ?? {};

  return {
    ...assets,
    surfaces: {
      ...surfaces,
      [surfaceId]: {
        ...existingSurface,
        id: surfaceId,
        ...surface,
      },
    },
  };
}

function upsertLayerInAssets(assets, surfaceId, layerId, layer) {
  const surfaces = assets.surfaces ?? {};
  const existingSurface = surfaces[surfaceId] ?? { id: surfaceId };
  const layers = existingSurface.layers ?? {};

  return {
    ...assets,
    surfaces: {
      ...surfaces,
      [surfaceId]: {
        ...existingSurface,
        id: surfaceId,
        layers: {
          ...layers,
          [layerId]: layer,
        },
      },
    },
  };
}

function deleteLayerInAssets(assets, surfaceId, layerId) {
  const surfaces = assets.surfaces ?? {};
  const existingSurface = surfaces[surfaceId];

  if (!existingSurface) {
    throw new Error("character_surface_not_found");
  }

  const layers = existingSurface.layers ?? {};

  if (!layers[layerId]) {
    throw new Error("character_layer_not_found");
  }

  const nextLayers = { ...layers };
  delete nextLayers[layerId];

  return {
    ...assets,
    surfaces: {
      ...surfaces,
      [surfaceId]: {
        ...existingSurface,
        layers: nextLayers,
      },
    },
  };
}

function upsertExpressionInAssets(assets, expression, asset) {
  const expressions = assets.expressions ?? {};

  return {
    ...assets,
    expressions: {
      ...expressions,
      [expression]: asset,
    },
  };
}

function upsertSceneInAssets(assets, sceneId, scene, shouldSetDefaultScene) {
  const scenes = assets.scenes ?? {};
  const nextAssets = {
    ...assets,
    scenes: {
      ...scenes,
      [sceneId]: {
        ...scene,
        id: sceneId,
      },
    },
  };

  if (shouldSetDefaultScene) {
    nextAssets.defaultScene = sceneId;
  } else if (nextAssets.defaultScene === sceneId) {
    delete nextAssets.defaultScene;
  }

  return nextAssets;
}

function deleteSurfaceInAssets(assets, surfaceId) {
  const surfaces = assets.surfaces ?? {};

  if (!surfaces[surfaceId]) {
    throw new Error("character_surface_not_found");
  }

  const nextSurfaces = { ...surfaces };
  delete nextSurfaces[surfaceId];

  return {
    ...assets,
    surfaces: nextSurfaces,
  };
}

function deleteExpressionInAssets(assets, expression) {
  const expressions = assets.expressions ?? {};

  if (!expressions[expression]) {
    throw new Error("character_expression_not_found");
  }

  const nextExpressions = { ...expressions };
  delete nextExpressions[expression];

  return {
    ...assets,
    expressions: nextExpressions,
  };
}

function deleteSceneInAssets(assets, sceneId) {
  const scenes = assets.scenes ?? {};

  if (!scenes[sceneId]) {
    throw new Error("character_scene_not_found");
  }

  const nextScenes = { ...scenes };
  delete nextScenes[sceneId];

  const nextAssets = {
    ...assets,
    scenes: nextScenes,
  };

  if (nextAssets.defaultScene === sceneId) {
    delete nextAssets.defaultScene;
  }

  return nextAssets;
}

function normalizeHitAreaValue(area) {
  if (!area || typeof area !== "object" || Array.isArray(area)) {
    throw new Error("invalid_character_hit_area");
  }

  const minX = Number(area.minX);
  const maxX = Number(area.maxX);
  const minY = Number(area.minY);
  const maxY = Number(area.maxY);

  if (![minX, maxX, minY, maxY].every(Number.isFinite)) {
    throw new Error("invalid_character_hit_area");
  }

  const normalizedMinX = Math.max(0, Math.min(1, minX));
  const normalizedMaxX = Math.max(0, Math.min(1, maxX));
  const normalizedMinY = Math.max(0, Math.min(1, minY));
  const normalizedMaxY = Math.max(0, Math.min(1, maxY));

  if (normalizedMinX >= normalizedMaxX || normalizedMinY >= normalizedMaxY) {
    throw new Error("invalid_character_hit_area");
  }

  return {
    minX: normalizedMinX,
    maxX: normalizedMaxX,
    minY: normalizedMinY,
    maxY: normalizedMaxY,
  };
}

function normalizeHitAreas(hitAreas) {
  if (!hitAreas || typeof hitAreas !== "object" || Array.isArray(hitAreas)) {
    throw new Error("invalid_character_hit_areas");
  }

  return Object.fromEntries(
    Object.entries(hitAreas)
      .map(([part, area]) => [String(part).trim(), normalizeHitAreaValue(area)])
      .filter(([part]) => part.length > 0),
  );
}

function upsertHitAreasInAssets(assets, hitAreas) {
  const nextAssets = { ...assets };

  if (Object.keys(hitAreas).length > 0) {
    nextAssets.hitAreas = hitAreas;
  } else {
    delete nextAssets.hitAreas;
  }

  return nextAssets;
}

async function saveCharacterAssets(body, mergeAssets) {
  const { safeCharacterId, characterSourcePath } = resolveCharacterSourcePath(body.characterId);
  const characterBuildPath = resolveCharacterBuildPath(safeCharacterId);
  const currentAssets = normalizeCharacterAssets(safeCharacterId, await readEditableCharacterAssets(safeCharacterId));
  const nextAssets = normalizeCharacterAssets(safeCharacterId, mergeAssets(currentAssets));
  const sourceDirectory = path.dirname(characterSourcePath);
  const sourceAssetFiles = createCharacterSourceAssetFiles(safeCharacterId, nextAssets);

  await fs.promises.mkdir(path.join(sourceDirectory, "assets"), { recursive: true });
  await fs.promises.writeFile(path.join(sourceDirectory, "assets", "meta.ts"), sourceAssetFiles.meta, "utf8");
  await fs.promises.writeFile(path.join(sourceDirectory, "assets", "expressions.ts"), sourceAssetFiles.expressions, "utf8");
  await fs.promises.writeFile(path.join(sourceDirectory, "assets", "surfaces.ts"), sourceAssetFiles.surfaces, "utf8");
  await fs.promises.writeFile(path.join(sourceDirectory, "assets", "scenes.ts"), sourceAssetFiles.scenes, "utf8");
  await fs.promises.writeFile(characterSourcePath, createCharacterIndexFile(safeCharacterId, { includeTypeImport: true }), "utf8");

  if (characterBuildPath) {
    const buildDirectory = path.dirname(characterBuildPath);
    const buildAssetFiles = createCharacterBuildAssetFiles(safeCharacterId, nextAssets);

    await fs.promises.mkdir(path.join(buildDirectory, "assets"), { recursive: true });
    await fs.promises.writeFile(path.join(buildDirectory, "assets", "meta.js"), buildAssetFiles.meta, "utf8");
    await fs.promises.writeFile(path.join(buildDirectory, "assets", "expressions.js"), buildAssetFiles.expressions, "utf8");
    await fs.promises.writeFile(path.join(buildDirectory, "assets", "surfaces.js"), buildAssetFiles.surfaces, "utf8");
    await fs.promises.writeFile(path.join(buildDirectory, "assets", "scenes.js"), buildAssetFiles.scenes, "utf8");
    await fs.promises.writeFile(characterBuildPath, createCharacterIndexFile(safeCharacterId, { includeTypeImport: false }), "utf8");
  }

  return {
    characterId: safeCharacterId,
    path: path.relative(root, characterSourcePath).replaceAll(path.sep, "/"),
    buildPath: characterBuildPath ? path.relative(root, characterBuildPath).replaceAll(path.sep, "/") : null,
  };
}

function upsertCharacterSurfaceProperty(source, surfaceBlock, propertyName, value) {
  const existingProperty = findPropertyValueRange(source, surfaceBlock.start, surfaceBlock.end, propertyName);
  const propertyText = `${propertyName}: ${JSON.stringify(value)}`;

  if (existingProperty) {
    return `${source.slice(0, existingProperty.propertyStart)}${propertyText}${source.slice(existingProperty.valueEnd)}`;
  }

  return insertPropertyBeforeClose(source, surfaceBlock.end, `        ${propertyText},`);
}

function upsertCharacterSurfaceSource(source, { surfaceId, surface }) {
  const rootObjectStart = source.indexOf("assets:");

  if (rootObjectStart === -1) {
    throw new Error("character_assets_not_found");
  }

  const assetsBlock = findPropertyBlock(source, rootObjectStart, source.length, "assets");

  if (!assetsBlock) {
    throw new Error("character_assets_not_found");
  }

  const surfacesBlock = findPropertyBlock(source, assetsBlock.start, assetsBlock.end, "surfaces");

  if (!surfacesBlock) {
    throw new Error("character_surfaces_not_found");
  }

  const surfacePayload = {
    id: surfaceId,
    ...(surface.image ? { image: surface.image } : {}),
    ...(surface.expression ? { expression: surface.expression } : {}),
    ...(surface.alt ? { alt: surface.alt } : {}),
  };
  const surfaceBlock = findObjectPropertyBlock(source, surfacesBlock.start, surfacesBlock.end, surfaceId);

  if (!surfaceBlock) {
    const surfaceLiteral = formatObjectLiteral(surfacePayload, 6);
    const surfaceProperty = `      ${JSON.stringify(surfaceId)}: ${surfaceLiteral},`;

    return insertPropertyBeforeClose(source, surfacesBlock.end, surfaceProperty);
  }

  return Object.entries(surfacePayload).reduce(
    (updatedSource, [propertyName, value]) => {
      const updatedAssetsBlock = findPropertyBlock(updatedSource, rootObjectStart, updatedSource.length, "assets");
      const updatedSurfacesBlock = updatedAssetsBlock
        ? findPropertyBlock(updatedSource, updatedAssetsBlock.start, updatedAssetsBlock.end, "surfaces")
        : null;
      const updatedSurfaceBlock = updatedSurfacesBlock
        ? findObjectPropertyBlock(updatedSource, updatedSurfacesBlock.start, updatedSurfacesBlock.end, surfaceId)
        : null;

      if (!updatedSurfaceBlock) {
        throw new Error("character_surface_not_found");
      }

      return upsertCharacterSurfaceProperty(updatedSource, updatedSurfaceBlock, propertyName, value);
    },
    source,
  );
}

function upsertCharacterLayerSource(source, { surfaceId, layerId, layer }) {
  const rootObjectStart = source.indexOf("assets:");

  if (rootObjectStart === -1) {
    throw new Error("character_assets_not_found");
  }

  const assetsBlock = findPropertyBlock(source, rootObjectStart, source.length, "assets");

  if (!assetsBlock) {
    throw new Error("character_assets_not_found");
  }

  const surfacesBlock = findPropertyBlock(source, assetsBlock.start, assetsBlock.end, "surfaces");

  if (!surfacesBlock) {
    throw new Error("character_surfaces_not_found");
  }

  const surfaceBlock = findObjectPropertyBlock(source, surfacesBlock.start, surfacesBlock.end, surfaceId);
  const layerLiteral = formatObjectLiteral(layer, 12);
  const layerProperty = `            ${JSON.stringify(layerId)}: ${layerLiteral},`;

  if (!surfaceBlock) {
    const surfaceLiteral = formatObjectLiteral({
      id: surfaceId,
      layers: {
        [layerId]: layer,
      },
    }, 6);
    const surfaceProperty = `      ${JSON.stringify(surfaceId)}: ${surfaceLiteral},`;

    return insertPropertyBeforeClose(source, surfacesBlock.end, surfaceProperty);
  }

  const layersBlock = findPropertyBlock(source, surfaceBlock.start, surfaceBlock.end, "layers");

  if (!layersBlock) {
    const layersProperty = `          layers: {\n${layerProperty}\n          },`;

    return insertPropertyBeforeClose(source, surfaceBlock.end, layersProperty);
  }

  const existingLayerBlock = findObjectPropertyBlock(source, layersBlock.start, layersBlock.end, layerId);

  if (!existingLayerBlock) {
    return insertPropertyBeforeClose(source, layersBlock.end, layerProperty);
  }

  const replacement = `${JSON.stringify(layerId)}: ${layerLiteral}`;

  return `${source.slice(0, existingLayerBlock.propertyStart)}${replacement}${source.slice(existingLayerBlock.end + 1)}`;
}

/**
 * Removes one layer definition from a character asset source string.
 */
function deleteCharacterLayerSource(source, { surfaceId, layerId }) {
  const rootObjectStart = source.indexOf("assets:");

  if (rootObjectStart === -1) {
    throw new Error("character_assets_not_found");
  }

  const assetsBlock = findPropertyBlock(source, rootObjectStart, source.length, "assets");

  if (!assetsBlock) {
    throw new Error("character_assets_not_found");
  }

  const surfacesBlock = findPropertyBlock(source, assetsBlock.start, assetsBlock.end, "surfaces");

  if (!surfacesBlock) {
    throw new Error("character_surfaces_not_found");
  }

  const surfaceBlock = findObjectPropertyBlock(source, surfacesBlock.start, surfacesBlock.end, surfaceId);

  if (!surfaceBlock) {
    throw new Error("character_surface_not_found");
  }

  const layersBlock = findPropertyBlock(source, surfaceBlock.start, surfaceBlock.end, "layers");

  if (!layersBlock) {
    throw new Error("character_layers_not_found");
  }

  const existingLayerBlock = findObjectPropertyBlock(source, layersBlock.start, layersBlock.end, layerId);

  if (!existingLayerBlock) {
    throw new Error("character_layer_not_found");
  }

  return removeObjectProperty(source, existingLayerBlock.propertyStart, existingLayerBlock.end);
}

async function saveCharacterLayer(body) {
  const layerSnippet = body.layer && typeof body.layer === "object" ? body.layer : {};
  const surfaceId = String(layerSnippet.surfaceId ?? body.surfaceId ?? "").trim();
  const layerId = String(layerSnippet.layerId ?? body.layerId ?? "").trim();
  const layer = layerSnippet.layer ?? body.layerConfig;

  if (!surfaceId || !layerId || !layer || typeof layer !== "object") {
    throw new Error("invalid_character_layer");
  }

  const saved = await saveCharacterAssets(body, (assets) => upsertLayerInAssets(assets, surfaceId, layerId, layer));

  return {
    ...saved,
    surfaceId,
    layerId,
  };
}

async function saveCharacterSurface(body) {
  const surfaceSnippet = body.surface && typeof body.surface === "object" ? body.surface : {};
  const surfaceId = String(surfaceSnippet.surfaceId ?? body.surfaceId ?? "").trim();
  const surface = surfaceSnippet.surface && typeof surfaceSnippet.surface === "object"
    ? surfaceSnippet.surface
    : body.surfaceConfig;

  if (!surfaceId || !surface || typeof surface !== "object") {
    throw new Error("invalid_character_surface");
  }

  const saved = await saveCharacterAssets(body, (assets) => upsertSurfaceInAssets(assets, surfaceId, surface));

  return {
    ...saved,
    surfaceId,
  };
}

async function saveCharacterExpression(body) {
  const expression = String(body.expression ?? body.expressionId ?? "").trim();
  const assets = Array.isArray(body.assets)
    ? body.assets
      .map((asset) => {
        if (typeof asset === "string") {
          return asset.trim();
        }

        if (asset && typeof asset === "object" && asset.type === "scene") {
          const sceneId = String(asset.sceneId ?? "").trim();

          return sceneId ? { type: "scene", sceneId } : null;
        }

        if (asset && typeof asset === "object" && asset.type === "image") {
          const src = String(asset.src ?? "").trim();

          return src ? { type: "image", src } : null;
        }

        return null;
      })
      .filter(Boolean)
    : [];

  if (!expression || assets.length === 0) {
    throw new Error("invalid_character_expression");
  }

  const expressionAsset = assets.length === 1 ? assets[0] : assets;
  const saved = await saveCharacterAssets(body, (currentAssets) =>
    upsertExpressionInAssets(currentAssets, expression, expressionAsset),
  );

  return {
    ...saved,
    expression,
  };
}

async function saveCharacterScene(body) {
  const sceneSnippet = body.scene && typeof body.scene === "object" ? body.scene : {};
  const sceneId = String(sceneSnippet.sceneId ?? body.sceneId ?? "").trim();
  const scene = sceneSnippet.scene && typeof sceneSnippet.scene === "object"
    ? sceneSnippet.scene
    : body.sceneConfig;
  const shouldSetDefaultScene = Boolean(sceneSnippet.defaultScene ?? body.defaultScene);

  if (!sceneId || !scene || typeof scene !== "object" || !Array.isArray(scene.layers)) {
    throw new Error("invalid_character_scene");
  }

  const saved = await saveCharacterAssets(body, (assets) =>
    upsertSceneInAssets(assets, sceneId, scene, shouldSetDefaultScene),
  );

  return {
    ...saved,
    sceneId,
  };
}

async function deleteCharacterSurface(body) {
  const surfaceId = String(body.surfaceId ?? body.surface?.surfaceId ?? "").trim();

  if (!surfaceId) {
    throw new Error("invalid_character_surface");
  }

  const saved = await saveCharacterAssets(body, (assets) => deleteSurfaceInAssets(assets, surfaceId));

  return {
    ...saved,
    surfaceId,
  };
}

async function deleteCharacterExpression(body) {
  const expression = String(body.expression ?? body.expressionId ?? "").trim();

  if (!expression) {
    throw new Error("invalid_character_expression");
  }

  const saved = await saveCharacterAssets(body, (assets) => deleteExpressionInAssets(assets, expression));

  return {
    ...saved,
    expression,
  };
}

async function deleteCharacterScene(body) {
  const sceneId = String(body.sceneId ?? body.scene?.sceneId ?? "").trim();

  if (!sceneId) {
    throw new Error("invalid_character_scene");
  }

  const saved = await saveCharacterAssets(body, (assets) => deleteSceneInAssets(assets, sceneId));

  return {
    ...saved,
    sceneId,
  };
}

function toExportName(characterId) {
  return safeFileName(characterId)
    .replace(/^[^a-zA-Z_]+/, "")
    .replace(/[^a-zA-Z0-9_]/g, "_") || "character";
}

/**
 * Creates starter dialogue categories for newly generated characters.
 */
function createDefaultCharacterLines(displayName) {
  return {
    onMount: [`${displayName} 캐릭터 제작을 시작했어요.`],
    onClick: [`${displayName} 설정을 이어서 채워주세요.`],
    onTouchHead: ["머리 터치 반응 대사를 채워주세요."],
    onTouchFace: ["얼굴 터치 반응 대사를 채워주세요."],
    onTouchBody: ["몸 터치 반응 대사를 채워주세요."],
    onHoverRuntimeTitle: ["타이틀 영역에 마우스를 올렸을 때의 안내 대사입니다."],
    onHoverEventLog: ["이벤트 로그를 설명하는 대사입니다."],
    onHoverCommandMenu: ["명령 메뉴를 설명하는 대사입니다."],
    onHoverFortuneCommand: ["확장 명령을 설명하는 대사입니다."],
    onHoverLineCommand: ["대사 버튼을 설명하는 대사입니다."],
    onHoverHideCommand: ["숨기기 버튼을 설명하는 대사입니다."],
    onRandomPrompt: ["잠깐 말을 걸어오는 랜덤 대사를 채워주세요."],
    onIdle: ["조용히 기다리고 있어요."],
    onLine: ["아직 대사가 많지 않아요. lines.ts에서 대사를 확장하세요."],
    onHide: ["잠시 숨어 있을게요."],
    onShow: ["다시 돌아왔어요."],
  };
}

function normalizeCharacterLines(lines) {
  if (!lines || typeof lines !== "object" || Array.isArray(lines)) {
    throw new Error("invalid_character_lines");
  }

  return Object.fromEntries(Object.entries(lines)
    .map(([category, values]) => {
      const safeCategory = String(category ?? "").trim();
      const lineValues = Array.isArray(values)
        ? values.map((line) => String(line ?? "").trim()).filter(Boolean)
        : [];

      return [safeCategory, lineValues];
    })
    .filter(([category, values]) => category && values.length > 0));
}

async function saveCharacterLines(body) {
  const { safeCharacterId, characterSourcePath } = resolveCharacterSourcePath(body.characterId);
  const characterBuildPath = resolveCharacterBuildPath(safeCharacterId);
  const lines = normalizeCharacterLines(body.lines);
  const sourceDirectory = path.dirname(characterSourcePath);

  await fs.promises.writeFile(
    path.join(sourceDirectory, "lines.ts"),
    createCharacterSourceLinesFile(safeCharacterId, lines),
    "utf8",
  );
  await fs.promises.writeFile(characterSourcePath, createCharacterIndexFile(safeCharacterId, { includeTypeImport: true }), "utf8");

  if (characterBuildPath) {
    const buildDirectory = path.dirname(characterBuildPath);

    await fs.promises.writeFile(
      path.join(buildDirectory, "lines.js"),
      createCharacterBuildLinesFile(safeCharacterId, lines),
      "utf8",
    );
    await fs.promises.writeFile(characterBuildPath, createCharacterIndexFile(safeCharacterId, { includeTypeImport: false }), "utf8");
  }

  return {
    characterId: safeCharacterId,
    path: path.relative(root, path.join(sourceDirectory, "lines.ts")).replaceAll(path.sep, "/"),
    buildPath: characterBuildPath ? path.relative(root, path.join(path.dirname(characterBuildPath), "lines.js")).replaceAll(path.sep, "/") : null,
    categories: Object.keys(lines),
  };
}

function createCharacterSourceFiles(characterId, profile) {
  const exportName = toExportName(characterId);
  const displayName = String(profile.name ?? characterId).trim() || characterId;
  const description = String(profile.description ?? "").trim() || `${displayName} character`;
  const tone = String(profile.tone ?? "").trim() || "차분하고 친근한 말투";
  const lines = createDefaultCharacterLines(displayName);
  const assets = {
    alt: displayName,
    expressions: {},
    surfaces: {},
    hitAreas: {
      head: { minX: 0.2, maxX: 0.8, minY: 0, maxY: 0.35 },
      face: { minX: 0.22, maxX: 0.78, minY: 0.35, maxY: 0.58 },
      body: { minX: 0.1, maxX: 0.9, minY: 0.58, maxY: 1 },
    },
  };

  return {
    profile: `import type { CharacterProfile } from "../../core/types.js";\n\nexport const ${exportName}Profile: CharacterProfile = ${JSON.stringify({
      id: characterId,
      name: displayName,
      description,
      tone,
      defaultExpression: "neutral",
    }, null, 2)};\n`,
    lines: createCharacterSourceLinesFile(characterId, lines),
    index: createCharacterIndexFile(characterId, { includeTypeImport: true }),
    assets: createCharacterSourceAssetFiles(characterId, assets),
  };
}

function createCharacterBuildFiles(characterId, profile) {
  const exportName = toExportName(characterId);
  const displayName = String(profile.name ?? characterId).trim() || characterId;
  const description = String(profile.description ?? "").trim() || `${displayName} character`;
  const tone = String(profile.tone ?? "").trim() || "차분하고 친근한 말투";
  const lines = createDefaultCharacterLines(displayName);
  const assets = {
    alt: displayName,
    expressions: {},
    surfaces: {},
    hitAreas: {
      head: { minX: 0.2, maxX: 0.8, minY: 0, maxY: 0.35 },
      face: { minX: 0.22, maxX: 0.78, minY: 0.35, maxY: 0.58 },
      body: { minX: 0.1, maxX: 0.9, minY: 0.58, maxY: 1 },
    },
  };

  return {
    profile: `export const ${exportName}Profile = ${JSON.stringify({
      id: characterId,
      name: displayName,
      description,
      tone,
      defaultExpression: "neutral",
    }, null, 2)};\n`,
    lines: createCharacterBuildLinesFile(characterId, lines),
    index: createCharacterIndexFile(characterId, { includeTypeImport: false }),
    assets: createCharacterBuildAssetFiles(characterId, assets),
  };
}

async function createCharacter(body) {
  const characterId = safeFileName(String(body.characterId ?? "").trim());

  if (!characterId || characterId === "ghostnest-input.png") {
    throw new Error("invalid_character_id");
  }

  const { sourceCharactersDirectory, buildCharactersDirectory } = getCharacterWorkspaceConfig();
  const sourceDirectory = ensureInsideDirectory(
    path.resolve(sourceCharactersDirectory, characterId),
    sourceCharactersDirectory,
    "invalid_character_id",
  );
  const buildDirectory = ensureInsideDirectory(
    path.resolve(buildCharactersDirectory, characterId),
    buildCharactersDirectory,
    "invalid_character_id",
  );

  if (fs.existsSync(path.join(sourceDirectory, "index.ts"))) {
    throw new Error("character_already_exists");
  }

  const profile = {
    name: body.name,
    description: body.description,
    tone: body.tone,
  };
  const sourceFiles = createCharacterSourceFiles(characterId, profile);
  const buildFiles = createCharacterBuildFiles(characterId, profile);

  await fs.promises.mkdir(path.join(sourceDirectory, "assets", "base"), { recursive: true });
  await fs.promises.mkdir(path.join(sourceDirectory, "assets", "parts"), { recursive: true });
  await fs.promises.mkdir(path.join(sourceDirectory, "assets", "scenes"), { recursive: true });
  await fs.promises.writeFile(path.join(sourceDirectory, "profile.ts"), sourceFiles.profile, "utf8");
  await fs.promises.writeFile(path.join(sourceDirectory, "lines.ts"), sourceFiles.lines, "utf8");
  await fs.promises.writeFile(path.join(sourceDirectory, "assets", "meta.ts"), sourceFiles.assets.meta, "utf8");
  await fs.promises.writeFile(path.join(sourceDirectory, "assets", "expressions.ts"), sourceFiles.assets.expressions, "utf8");
  await fs.promises.writeFile(path.join(sourceDirectory, "assets", "surfaces.ts"), sourceFiles.assets.surfaces, "utf8");
  await fs.promises.writeFile(path.join(sourceDirectory, "assets", "scenes.ts"), sourceFiles.assets.scenes, "utf8");
  await fs.promises.writeFile(path.join(sourceDirectory, "index.ts"), sourceFiles.index, "utf8");

  await fs.promises.mkdir(buildDirectory, { recursive: true });
  await fs.promises.mkdir(path.join(buildDirectory, "assets"), { recursive: true });
  await fs.promises.writeFile(path.join(buildDirectory, "profile.js"), buildFiles.profile, "utf8");
  await fs.promises.writeFile(path.join(buildDirectory, "lines.js"), buildFiles.lines, "utf8");
  await fs.promises.writeFile(path.join(buildDirectory, "assets", "meta.js"), buildFiles.assets.meta, "utf8");
  await fs.promises.writeFile(path.join(buildDirectory, "assets", "expressions.js"), buildFiles.assets.expressions, "utf8");
  await fs.promises.writeFile(path.join(buildDirectory, "assets", "surfaces.js"), buildFiles.assets.surfaces, "utf8");
  await fs.promises.writeFile(path.join(buildDirectory, "assets", "scenes.js"), buildFiles.assets.scenes, "utf8");
  await fs.promises.writeFile(path.join(buildDirectory, "index.js"), buildFiles.index, "utf8");

  return {
    characterId,
    path: path.relative(root, path.join(sourceDirectory, "index.ts")).replaceAll(path.sep, "/"),
    buildPath: path.relative(root, path.join(buildDirectory, "index.js")).replaceAll(path.sep, "/"),
  };
}

/**
 * Deletes a generated character directory from source and build output.
 */
async function deleteCharacter(body) {
  const characterId = safeFileName(String(body.characterId ?? "").trim());

  if (!characterId || characterId === "ghostnest-input.png") {
    throw new Error("invalid_character_id");
  }

  const { sourceCharactersDirectory, buildCharactersDirectory } = getCharacterWorkspaceConfig();
  const sourceDirectory = ensureInsideDirectory(
    path.resolve(sourceCharactersDirectory, characterId),
    sourceCharactersDirectory,
    "invalid_character_id",
  );
  const buildDirectory = ensureInsideDirectory(
    path.resolve(buildCharactersDirectory, characterId),
    buildCharactersDirectory,
    "invalid_character_id",
  );

  if (!fs.existsSync(path.join(sourceDirectory, "index.ts"))) {
    throw new Error("character_not_found");
  }

  await fs.promises.rm(sourceDirectory, { recursive: true, force: true });
  await fs.promises.rm(buildDirectory, { recursive: true, force: true });

  return {
    characterId,
    path: path.relative(root, sourceDirectory).replaceAll(path.sep, "/"),
    buildPath: path.relative(root, buildDirectory).replaceAll(path.sep, "/"),
  };
}

/**
 * Deletes one layer definition from the selected character source file.
 */
async function deleteCharacterLayer(body) {
  const surfaceId = String(body.surfaceId ?? body.layer?.surfaceId ?? "").trim();
  const layerId = String(body.layerId ?? body.layer?.layerId ?? "").trim();

  if (!surfaceId || !layerId) {
    throw new Error("invalid_character_layer");
  }

  const saved = await saveCharacterAssets(body, (assets) => deleteLayerInAssets(assets, surfaceId, layerId));

  return {
    ...saved,
    surfaceId,
    layerId,
  };
}

function safeFileName(fileName) {
  return String(fileName || "ghostnest-input.png").replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Checks whether a project file can be used as a browser image asset.
 */
function isImageAssetPath(filePath) {
  return [".gif", ".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(filePath).toLowerCase());
}

/**
 * Returns the asset kind implied by the first folder under assets.
 */
function getCharacterAssetKind(assetRelativePath) {
  const normalizedPath = assetRelativePath.replaceAll("\\", "/");
  const [kind] = normalizedPath.split("/");

  if (kind === "base") {
    return "base";
  }

  if (kind === "parts") {
    return "part";
  }

  if (kind === "scenes") {
    return "scene";
  }

  return "asset";
}

/**
 * Resolves the selected character asset directory without allowing traversal outside src/characters.
 */
function resolveCharacterAssetRoot(characterId) {
  const safeCharacterId = safeFileName(characterId || "rine");
  const { sourceCharactersDirectory } = getCharacterWorkspaceConfig();
  const characterAssetRoot = ensureInsideDirectory(
    path.resolve(sourceCharactersDirectory, safeCharacterId, "assets"),
    sourceCharactersDirectory,
    "invalid_character_id",
  );

  return {
    safeCharacterId,
    characterAssetRoot,
  };
}

/**
 * Resolves shared assets used across characters and scenes.
 */
function resolveCommonAssetRoot() {
  return getCharacterWorkspaceConfig().commonAssetsDirectory;
}

/**
 * Recursively collects image assets from a character asset directory.
 */
async function walkImageAssets(directory, options = {}) {
  const assetRootDirectory = options.assetRootDirectory ?? directory;
  const scope = options.scope ?? "character";
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const childFiles = await walkImageAssets(entryPath, { assetRootDirectory, scope });

      files.push(...childFiles);
      continue;
    }

    if (!entry.isFile() || !isImageAssetPath(entryPath)) {
      continue;
    }

    const stats = await fs.promises.stat(entryPath);
    const assetRelativePath = path.relative(assetRootDirectory, entryPath).replaceAll(path.sep, "/");
    const { browserSourcePrefix, browserCommonPrefix } = getCharacterWorkspaceConfig();
    const browserPath = scope === "common"
      ? createBrowserAssetPath(browserCommonPrefix, assetRelativePath)
      : createBrowserAssetPath(browserSourcePrefix, `${path.basename(path.dirname(assetRootDirectory))}/assets/${assetRelativePath}`);

    files.push({
      fileName: entry.name,
      path: browserPath,
      kind: getCharacterAssetKind(assetRelativePath),
      scope,
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
    });
  }

  return files;
}

/**
 * Reads all saved image assets that the layer editor can reuse for one character.
 */
async function readCharacterAssetFiles(characterId) {
  const { safeCharacterId, characterAssetRoot } = resolveCharacterAssetRoot(characterId);
  const commonAssetRoot = resolveCommonAssetRoot();
  const characterFiles = fs.existsSync(characterAssetRoot)
    ? await walkImageAssets(characterAssetRoot, { assetRootDirectory: characterAssetRoot, scope: "character" })
    : [];
  const commonFiles = fs.existsSync(commonAssetRoot)
    ? await walkImageAssets(commonAssetRoot, { assetRootDirectory: commonAssetRoot, scope: "common" })
    : [];
  const files = [...characterFiles, ...commonFiles];

  return {
    characterId: safeCharacterId,
    files: files.sort((left, right) => left.path.localeCompare(right.path, undefined, {
      numeric: true,
      sensitivity: "base",
    })),
  };
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(String(dataUrl ?? ""));

  if (!match) {
    throw new Error("invalid_data_url");
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function resolveProjectRelativePath(relativePath) {
  const normalizedRelativePath = String(relativePath ?? "").trim();

  if (!normalizedRelativePath || path.isAbsolute(normalizedRelativePath)) {
    throw new Error("invalid_save_directory");
  }

  const normalizedPath = normalizedRelativePath.replaceAll("\\", "/").replace(/^\.?\//, "");
  const {
    sourceCharactersDirectory,
    commonAssetsDirectory,
  } = getCharacterWorkspaceConfig();

  if (normalizedPath === "src/characters" || normalizedPath.startsWith("src/characters/")) {
    const childPath = normalizedPath.replace(/^src\/characters\/?/, "");

    return ensureInsideDirectory(
      path.resolve(sourceCharactersDirectory, childPath),
      sourceCharactersDirectory,
      "save_directory_outside_project",
    );
  }

  if (normalizedPath === "src/assets/common" || normalizedPath.startsWith("src/assets/common/")) {
    const childPath = normalizedPath.replace(/^src\/assets\/common\/?/, "");

    return ensureInsideDirectory(
      path.resolve(commonAssetsDirectory, childPath),
      commonAssetsDirectory,
      "save_directory_outside_project",
    );
  }

  const resolvedPath = path.resolve(root, normalizedRelativePath);

  if (resolvedPath !== root && !resolvedPath.startsWith(rootWithSeparator)) {
    throw new Error("save_directory_outside_project");
  }

  return resolvedPath;
}

function createSavedFileResponsePath(filePath) {
  const {
    sourceCharactersDirectory,
    commonAssetsDirectory,
    browserSourcePrefix,
    browserCommonPrefix,
  } = getCharacterWorkspaceConfig();
  const resolvedFilePath = path.resolve(filePath);
  const sourceRoot = path.resolve(sourceCharactersDirectory);
  const commonRoot = path.resolve(commonAssetsDirectory);

  if (resolvedFilePath.startsWith(`${sourceRoot}${path.sep}`)) {
    const relativePath = path.relative(sourceRoot, resolvedFilePath).replaceAll(path.sep, "/");

    return createBrowserAssetPath(browserSourcePrefix, relativePath).replace(/^\.\//, "");
  }

  if (resolvedFilePath.startsWith(`${commonRoot}${path.sep}`)) {
    const relativePath = path.relative(commonRoot, resolvedFilePath).replaceAll(path.sep, "/");

    return createBrowserAssetPath(browserCommonPrefix, relativePath).replace(/^\.\//, "");
  }

  return path.relative(root, resolvedFilePath).replaceAll(path.sep, "/");
}

function parseImageDataUrl(dataUrl) {
  const { buffer } = parseDataUrl(dataUrl);

  return buffer;
}

async function saveGeneratedAssets(body) {
  const targetDirectory = resolveProjectRelativePath(body.directory);
  const images = Array.isArray(body.images) ? body.images : [];

  if (images.length === 0 && !body.snippet) {
    throw new Error("no_images_to_save");
  }

  await fs.promises.mkdir(targetDirectory, { recursive: true });

  const saved = [];

  for (const image of images) {
    const fileName = safeFileName(image.fileName);
    const filePath = path.join(targetDirectory, fileName);
    await fs.promises.writeFile(filePath, parseImageDataUrl(image.dataUrl));
    saved.push({
      fileName,
      path: createSavedFileResponsePath(filePath),
    });
  }

  if (body.snippet) {
    const snippetFileName = safeFileName(body.snippetFileName || "asset-generator-layer-snippet.json");
    const snippetPath = path.join(targetDirectory, snippetFileName);
    await fs.promises.writeFile(snippetPath, `${JSON.stringify(body.snippet, null, 2)}\n`, "utf8");
    saved.push({
      fileName: snippetFileName,
      path: createSavedFileResponsePath(snippetPath),
    });
  }

  return saved;
}

async function readComfyWorkflow(body) {
  const selectedWorkflowPath = findExistingWorkflowPath(body);

  if (!selectedWorkflowPath) {
    throw new Error("workflow_not_configured");
  }

  const rawWorkflow = await fs.promises.readFile(selectedWorkflowPath.resolvedWorkflowPath, "utf8");
  const workflow = JSON.parse(rawWorkflow);

  if (workflow?._ghostNestTemplate) {
    throw new Error("workflow_template_not_configured");
  }

  return workflow;
}

async function fetchWorkflowFromUrl(workflowUrl) {
  const response = await fetch(workflowUrl, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`workflow_url_failed:${response.status}`);
  }

  return response.json();
}

async function resolveComfyWorkflow(body) {
  const source = body.workflowSource ?? { mode: "serverFile" };

  if (source.mode === "upload") {
    if (!source.workflow || typeof source.workflow !== "object") {
      throw new Error("workflow_upload_required");
    }

    return source.workflow;
  }

  if (source.mode === "url") {
    if (!source.url) {
      throw new Error("workflow_url_required");
    }

    return fetchWorkflowFromUrl(source.url);
  }

  return readComfyWorkflow(body);
}

function isServerFileWorkflowMode(body) {
  return (body.workflowSource?.mode ?? "serverFile") === "serverFile";
}

function replaceWorkflowPlaceholders(value, replacements) {
  if (typeof value === "string") {
    return Object.entries(replacements).reduce(
      (currentValue, [key, replacement]) => currentValue.replaceAll(`{{${key}}}`, replacement),
      value,
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceWorkflowPlaceholders(item, replacements));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceWorkflowPlaceholders(item, replacements)]),
    );
  }

  return value;
}

function applyCommonWorkflowInputs(workflow, replacements) {
  const generationSettings = replacements.generation_settings
    && typeof replacements.generation_settings === "object"
    ? replacements.generation_settings
    : {};

  Object.values(workflow).forEach((node) => {
    if (!node || typeof node !== "object" || !node.inputs) {
      return;
    }

    if (node.class_type === "LoadImage" && !node.inputs.image) {
      node.inputs.image = replacements.input_image;
    }

    if (node.class_type === "SaveImage" && typeof node.inputs.filename_prefix === "string") {
      node.inputs.filename_prefix = replacements.filename_prefix;
    }

    if (node.class_type === "CheckpointLoaderSimple" && replacements.checkpoint_name) {
      node.inputs.ckpt_name = replacements.checkpoint_name;
    }

    if (node.class_type === "KSampler") {
      if (typeof node.inputs.seed === "number") {
        node.inputs.seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
      }

      if (Number.isFinite(Number(generationSettings.denoise))) {
        node.inputs.denoise = Number(generationSettings.denoise);
      }

      if (Number.isFinite(Number(generationSettings.cfg))) {
        node.inputs.cfg = Number(generationSettings.cfg);
      }

      if (Number.isFinite(Number(generationSettings.steps))) {
        node.inputs.steps = Math.round(Number(generationSettings.steps));
      }
    }
  });

  return workflow;
}

/**
 * Creates a fresh workflow copy for each output slot.
 */
function cloneWorkflow(workflow) {
  return JSON.parse(JSON.stringify(workflow));
}

/**
 * Adds the target output name to the shared recipe prompt.
 */
function buildOutputPrompt(body, outputName) {
  const basePrompt = String(body.prompt ?? "").trim();
  const outputPrompts = body.outputPrompts && typeof body.outputPrompts === "object"
    ? body.outputPrompts
    : {};
  const outputPrompt = String(outputPrompts[outputName] ?? outputName ?? "").replaceAll("_", " ");

  return [basePrompt, outputPrompt].filter(Boolean).join(", ");
}

/**
 * Applies GhostNest placeholders and common ComfyUI inputs.
 */
function buildComfyPrompt(workflow, replacements) {
  return applyCommonWorkflowInputs(
    replaceWorkflowPlaceholders(cloneWorkflow(workflow), replacements),
    replacements,
  );
}

/**
 * Normalizes the optional target region used by crop and part-layer workflows.
 */
function getTargetRegion(body) {
  const region = body.targetRegion && typeof body.targetRegion === "object"
    ? body.targetRegion
    : {};

  return {
    x: Number(region.x ?? 0),
    y: Number(region.y ?? 0),
    width: Number(region.width ?? 100),
    height: Number(region.height ?? 100),
    unit: region.unit === "percent" ? "percent" : "percent",
  };
}

async function uploadImageToComfyUi(body) {
  if (!body.croppedBaseImageDataUrl) {
    throw new Error("cropped_base_image_required");
  }

  const sourceFileName = body.croppedBaseImageDataUrl
    ? `${path.parse(safeFileName(body.baseImageFileName || body.characterId || "character")).name}_crop.png`
    : body.baseImageFileName || `${body.characterId || "character"}_base.png`;

  return uploadDataUrlImageToComfyUi(
    body.croppedBaseImageDataUrl || body.baseImageDataUrl,
    sourceFileName,
  );
}

/**
 * Uploads the optional reference image to ComfyUI when one is provided.
 */
async function uploadReferenceImageToComfyUi(body) {
  if (!body.referenceImageDataUrl) {
    return null;
  }

  return uploadDataUrlImageToComfyUi(
    body.referenceImageDataUrl,
    body.referenceImageFileName || `${body.characterId || "character"}_reference.png`,
  );
}

/**
 * Uploads the optional inpaint mask image to ComfyUI when one is provided.
 */
async function uploadMaskImageToComfyUi(body) {
  if (!body.maskImageDataUrl) {
    return null;
  }

  const maskFileName = `${path.parse(safeFileName(body.baseImageFileName || body.characterId || "character")).name}_mask.png`;

  return uploadDataUrlImageToComfyUi(
    body.maskImageDataUrl,
    maskFileName,
  );
}

/**
 * Uploads a data URL image to the ComfyUI input directory.
 */
async function uploadDataUrlImageToComfyUi(dataUrl, sourceFileName) {
  const { mimeType, buffer } = parseDataUrl(dataUrl);
  const fileName = safeFileName(sourceFileName);
  const formData = new FormData();

  formData.append("image", new Blob([buffer], { type: mimeType }), fileName);
  formData.append("type", "input");
  formData.append("overwrite", "true");

  const response = await fetch(`${getComfyUiUrl()}/upload/image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`upload_failed:${response.status}`);
  }

  return response.json();
}

async function queueComfyWorkflow(prompt) {
  const response = await fetch(`${getComfyUiUrl()}/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: `ghost-nest-${Date.now()}`,
      prompt,
    }),
  });
  const result = await response.json();

  if (!response.ok) {
    const detail = result?.error?.message ?? result?.error ?? `prompt_failed:${response.status}`;
    throw new Error(String(detail));
  }

  return result;
}

async function getComfyHistory(promptId) {
  const response = await fetch(`${getComfyUiUrl()}/history/${encodeURIComponent(promptId)}`);

  if (!response.ok) {
    throw new Error(`history_failed:${response.status}`);
  }

  return response.json();
}

async function waitForComfyHistory(promptId) {
  const startedAt = Date.now();
  const timeoutMs = 120000;

  while (Date.now() - startedAt < timeoutMs) {
    const history = await getComfyHistory(promptId);

    if (history?.[promptId]) {
      return history;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error("generation_timeout");
}

function extractHistoryImages(history, promptId) {
  const outputs = history?.[promptId]?.outputs ?? {};

  return Object.values(outputs).flatMap((output) => output?.images ?? []);
}

async function fetchComfyImage(image, preferredFileName) {
  const params = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder ?? "",
    type: image.type ?? "output",
  });
  const response = await fetch(`${getComfyUiUrl()}/view?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`view_failed:${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "image/png";
  const bytes = Buffer.from(await response.arrayBuffer());

  return {
    fileName: preferredFileName ?? image.filename,
    dataUrl: `data:${contentType};base64,${bytes.toString("base64")}`,
    source: image,
  };
}

async function generateWithComfyUi(body) {
  if (!body.baseImageDataUrl) {
    throw new Error("base_image_required");
  }

  const uploadedImage = await uploadImageToComfyUi(body);
  const uploadedReferenceImage = await uploadReferenceImageToComfyUi(body);
  const uploadedMaskImage = await uploadMaskImageToComfyUi(body);
  const workflow = await resolveComfyWorkflow(body);
  const targetRegion = getTargetRegion(body);
  const croppedBaseImage = body.croppedBaseImage && typeof body.croppedBaseImage === "object"
    ? body.croppedBaseImage
    : null;
  const outputNames = Array.isArray(body.outputNames) && body.outputNames.length > 0
    ? body.outputNames
    : ["generated"];
  const generated = [];
  const promptIds = [];

  for (const outputName of outputNames) {
    const safeOutputName = safeFileName(outputName);
    const expectedFileName = `${body.outputPrefix || body.characterId || "ghostnest"}_${safeOutputName}.png`;
    const filenamePrefix = safeFileName(`${body.outputPrefix || body.characterId || "ghostnest"}_${safeOutputName}`);
    const replacements = {
      input_image: uploadedImage.name ?? uploadedImage.filename ?? safeFileName(body.baseImageFileName),
      reference_image: uploadedReferenceImage?.name
        ?? uploadedReferenceImage?.filename
        ?? uploadedImage.name
        ?? uploadedImage.filename
        ?? safeFileName(body.baseImageFileName),
      reference_prompt: uploadedReferenceImage
        ? "use the reference image as guidance for the requested expression, mouth shape, eye shape, or pose"
        : "use text prompt only; no reference image was provided",
      mask_image: uploadedMaskImage?.name
        ?? uploadedMaskImage?.filename
        ?? "",
      mask_prompt: uploadedMaskImage
        ? "only redraw the white area of the provided mask image; preserve black masked surroundings"
        : "no mask image was provided",
      target_region: JSON.stringify(targetRegion),
      target_region_x: String(targetRegion.x),
      target_region_y: String(targetRegion.y),
      target_region_width: String(targetRegion.width),
      target_region_height: String(targetRegion.height),
      output_name: String(outputName ?? ""),
      prompt: buildOutputPrompt(body, outputName),
      negative_prompt: String(body.negativePrompt ?? ""),
      filename_prefix: filenamePrefix,
      recipe_id: String(body.recipeId ?? ""),
      character_id: String(body.characterId ?? ""),
      checkpoint_name: String(body.checkpointName ?? "animagine-xl-4.0-opt.safetensors"),
      edit_scope: String(body.editScope ?? ""),
      model_profile: String(body.modelProfile ?? ""),
      generation_settings: body.generationSettings ?? {},
    };
    const prompt = buildComfyPrompt(workflow, replacements);
    const queued = await queueComfyWorkflow(prompt);
    const history = await waitForComfyHistory(queued.prompt_id);
    const historyImages = extractHistoryImages(history, queued.prompt_id);
    const images = await Promise.all(
      historyImages.map((image, index) => fetchComfyImage(
        image,
        index === 0 ? expectedFileName : `${filenamePrefix}_${index + 1}.png`,
      )),
    );

    promptIds.push(queued.prompt_id);
    generated.push(...images);
  }

  return {
    promptId: promptIds[0],
    promptIds,
    images: generated,
    uploadedImage,
    uploadedReferenceImage,
    uploadedMaskImage,
    targetRegion,
    croppedBaseImage,
  };
}

async function handleGenerateLayerPart(request, response) {
  if (!isComfyAssetGeneratorBridgeEnabled()) {
    sendComfyAssetGeneratorBridgeDisabled(response);
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  let body;

  try {
    body = await readRequestJson(request);
  } catch (error) {
    sendJson(response, 400, { ok: false, error: "invalid_json" });
    return true;
  }

  try {
    const comfyStatus = await checkComfyUiStatus();
    const workflowPathInfo = createWorkflowPathInfo(body);
    const comfyUiUrl = getComfyUiUrl();

    if (isServerFileWorkflowMode(body) && !workflowPathInfo.selectedResolvedWorkflowPath) {
      sendJson(response, 501, {
        ok: false,
        error: "workflow_not_configured",
        message: "ComfyUI is reachable, but no API workflow JSON was found from workflowPath or the default fallback path.",
        bridge: {
          comfyUiUrl,
          comfyStatus,
          ...workflowPathInfo,
        },
        request: {
          recipeId: body.recipeId,
          characterId: body.characterId,
          outputNames: body.outputNames,
          hasBaseImage: Boolean(body.baseImageDataUrl),
        },
      });
      return true;
    }

    const generation = await generateWithComfyUi(body);

    sendJson(response, 200, {
      ok: true,
      message: "Generation completed.",
      bridge: {
        comfyUiUrl,
        comfyStatus,
        ...workflowPathInfo,
      },
      generation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "generation_failed";
    const statusCode = [
      "base_image_required",
      "cropped_base_image_required",
      "invalid_data_url",
    ].includes(message) ? 400 : 503;
    const isComfyUnavailable = message === "fetch failed";
    const isWorkflowTemplate = message === "workflow_template_not_configured";
    const workflowPathInfo = createWorkflowPathInfo(body);
    const comfyUiUrl = getComfyUiUrl();

    sendJson(response, isWorkflowTemplate ? 501 : statusCode, {
      ok: false,
      error: isComfyUnavailable ? "comfyui_unavailable" : message,
      message: message === "base_image_required"
        ? "Select a base image before generating."
        : message === "cropped_base_image_required"
          ? "Layer part generation requires a cropped part image. Rebuild and refresh the asset generator page."
          : isComfyUnavailable
            ? "ComfyUI is not reachable from the GhostNest dev server."
            : isWorkflowTemplate
              ? "A placeholder workflow file was found. Replace it with a ComfyUI API workflow JSON."
              : "ComfyUI generation failed from the GhostNest dev server.",
      bridge: {
        comfyUiUrl,
        ...workflowPathInfo,
      },
    });
  }

  return true;
}

async function handleComfyModels(request, response) {
  if (!isComfyAssetGeneratorBridgeEnabled()) {
    sendComfyAssetGeneratorBridgeDisabled(response);
    return true;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    sendJson(response, 200, {
      ok: true,
      models: await getComfyModels(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "models_failed";

    sendJson(response, 503, {
      ok: false,
      error: message === "fetch failed" ? "comfyui_unavailable" : message,
      message: message === "fetch failed"
        ? "ComfyUI is not reachable from the GhostNest dev server."
        : "ComfyUI model list could not be loaded.",
    });
  }

  return true;
}

async function handleCharacterAssets(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const requestUrl = new URL(request.url, `http://127.0.0.1:${port}`);
    const characterId = requestUrl.searchParams.get("characterId") || "rine";

    sendJson(response, 200, {
      ok: true,
      ...await readCharacterAssets(characterId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "character_assets_failed";

    sendJson(response, 404, {
      ok: false,
      error: message,
      message: message === "character_dist_not_found"
        ? "Character build output was not found. Run npm run build before loading existing layer settings."
        : "Character layer settings could not be loaded.",
    });
  }

  return true;
}

async function handleCharacters(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    sendJson(response, 200, {
      ok: true,
      characters: await readCharacterList(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "characters_failed";

    sendJson(response, 404, {
      ok: false,
      error: message,
      message: message === "character_dist_not_found"
        ? "Character build output was not found. Run npm run build before loading character list."
        : "Character list could not be loaded.",
    });
  }

  return true;
}

/**
 * Handles saved asset list requests for the layer editor.
 */
async function handleAssetFiles(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const requestUrl = new URL(request.url, `http://127.0.0.1:${port}`);
    const characterId = requestUrl.searchParams.get("characterId") || "rine";

    sendJson(response, 200, {
      ok: true,
      ...await readCharacterAssetFiles(characterId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "asset_files_failed";

    sendJson(response, 404, {
      ok: false,
      error: message,
      message: message === "character_asset_root_not_found"
        ? "Character asset directory was not found."
        : "Saved asset files could not be loaded.",
    });
  }

  return true;
}

async function handleSaveCharacterLayer(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const saved = await saveCharacterLayer(body);

    sendJson(response, 200, {
      ok: true,
      message: "Character layer saved.",
      saved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "save_character_layer_failed";
    const statusCode = [
      "invalid_json",
      "invalid_character_id",
      "character_source_not_found",
      "invalid_character_layer",
      "character_assets_not_found",
      "character_surfaces_not_found",
      "object_block_not_found",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Character layer could not be saved.",
    });
  }

  return true;
}

async function handleSaveCharacterSurface(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const saved = await saveCharacterSurface(body);

    sendJson(response, 200, {
      ok: true,
      message: "Character surface saved.",
      saved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "save_character_surface_failed";
    const statusCode = [
      "invalid_json",
      "invalid_character_id",
      "character_source_not_found",
      "invalid_character_surface",
      "character_assets_not_found",
      "character_surfaces_not_found",
      "object_block_not_found",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Character surface could not be saved.",
    });
  }

  return true;
}

async function handleSaveCharacterExpression(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const saved = await saveCharacterExpression(body);

    sendJson(response, 200, {
      ok: true,
      message: "Character expression saved.",
      saved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "save_character_expression_failed";
    const statusCode = [
      "invalid_json",
      "invalid_character_id",
      "character_source_not_found",
      "invalid_character_expression",
      "character_assets_not_found",
      "object_block_not_found",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Character expression could not be saved.",
    });
  }

  return true;
}

async function handleCharacterWorkspace(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  try {
    if (request.method === "GET") {
      sendJson(response, 200, {
        ok: true,
        workspace: getCharacterWorkspaceResponse(),
      });
      return true;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return true;
    }

    const body = await readRequestJson(request);

    sendJson(response, 200, {
      ok: true,
      message: "Character workspace saved.",
      workspace: updateCharacterWorkspaceConfig(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "character_workspace_failed";
    const statusCode = message === "invalid_json" ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Character workspace could not be saved.",
    });
  }

  return true;
}

async function handleCreateCharacter(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const created = await createCharacter(body);

    sendJson(response, 200, {
      ok: true,
      message: "Character created.",
      created,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "create_failed";
    const statusCode = [
      "invalid_json",
      "invalid_character_id",
      "character_already_exists",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Character could not be created.",
    });
  }

  return true;
}

async function handleDeleteCharacter(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const deleted = await deleteCharacter(body);

    sendJson(response, 200, {
      ok: true,
      message: "Character deleted.",
      deleted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "delete_character_failed";
    const statusCode = [
      "invalid_json",
      "invalid_character_id",
      "character_not_found",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Character could not be deleted.",
    });
  }

  return true;
}

async function handleDeleteCharacterSurface(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const deleted = await deleteCharacterSurface(body);

    sendJson(response, 200, { ok: true, message: "Character surface deleted.", deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "delete_character_surface_failed";
    const statusCode = [
      "invalid_json",
      "invalid_character_id",
      "character_source_not_found",
      "invalid_character_surface",
      "character_surface_not_found",
      "character_assets_not_found",
      "object_block_not_found",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Character surface could not be deleted.",
    });
  }

  return true;
}

async function handleDeleteCharacterExpression(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const deleted = await deleteCharacterExpression(body);

    sendJson(response, 200, { ok: true, message: "Character expression deleted.", deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "delete_character_expression_failed";
    const statusCode = [
      "invalid_json",
      "invalid_character_id",
      "character_source_not_found",
      "invalid_character_expression",
      "character_expression_not_found",
      "character_assets_not_found",
      "object_block_not_found",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Character expression could not be deleted.",
    });
  }

  return true;
}

async function handleDeleteCharacterScene(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const deleted = await deleteCharacterScene(body);

    sendJson(response, 200, { ok: true, message: "Character scene deleted.", deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "delete_character_scene_failed";
    const statusCode = [
      "invalid_json",
      "invalid_character_id",
      "character_source_not_found",
      "invalid_character_scene",
      "character_scene_not_found",
      "character_assets_not_found",
      "object_block_not_found",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Character scene could not be deleted.",
    });
  }

  return true;
}

async function handleSaveCharacterScene(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const saved = await saveCharacterScene(body);

    sendJson(response, 200, {
      ok: true,
      message: "Character scene saved.",
      saved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "save_character_scene_failed";
    const statusCode = [
      "invalid_json",
      "invalid_character_id",
      "character_source_not_found",
      "invalid_character_scene",
      "character_assets_not_found",
      "object_block_not_found",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Character scene could not be saved.",
    });
  }

  return true;
}

async function handleSaveCharacterLines(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const saved = await saveCharacterLines(body);

    sendJson(response, 200, {
      ok: true,
      message: "Character lines saved.",
      saved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "save_character_lines_failed";
    const statusCode = [
      "invalid_json",
      "invalid_character_id",
      "character_source_not_found",
      "invalid_character_lines",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Character lines could not be saved.",
    });
  }

  return true;
}

async function handleSaveCharacterHitAreas(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const hitAreas = normalizeHitAreas(body.hitAreas);
    const saved = await saveCharacterAssets(body, (assets) => upsertHitAreasInAssets(assets, hitAreas));

    sendJson(response, 200, {
      ok: true,
      message: "Character hit areas saved.",
      saved: {
        ...saved,
        parts: Object.keys(hitAreas),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "save_character_hit_areas_failed";
    const statusCode = [
      "invalid_json",
      "invalid_character_id",
      "character_source_not_found",
      "invalid_character_hit_areas",
      "invalid_character_hit_area",
      "character_assets_not_found",
      "object_block_not_found",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Character hit areas could not be saved.",
    });
  }

  return true;
}

/**
 * Handles character layer delete requests for the dev asset tool.
 */
async function handleDeleteCharacterLayer(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const deleted = await deleteCharacterLayer(body);

    sendJson(response, 200, {
      ok: true,
      message: "Character layer deleted.",
      deleted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "delete_character_layer_failed";
    const statusCode = [
      "invalid_json",
      "invalid_character_id",
      "character_source_not_found",
      "invalid_character_layer",
      "character_assets_not_found",
      "character_surfaces_not_found",
      "character_surface_not_found",
      "character_layers_not_found",
      "character_layer_not_found",
      "object_block_not_found",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Character layer could not be deleted.",
    });
  }

  return true;
}

async function handleSaveGeneratedAssets(request, response) {
  if (!isComfyAssetGeneratorBridgeEnabled()) {
    sendComfyAssetGeneratorBridgeDisabled(response);
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const saved = await saveGeneratedAssets(body);

    sendJson(response, 200, {
      ok: true,
      message: "Generated assets saved.",
      saved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "save_failed";
    const statusCode = [
      "invalid_json",
      "invalid_save_directory",
      "save_directory_outside_project",
      "no_images_to_save",
      "invalid_data_url",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Generated assets could not be saved.",
    });
  }

  return true;
}

async function handleSaveAssetFiles(request, response) {
  if (!isCharacterSettingsEnabled()) {
    sendJson(response, 404, {
      ok: false,
      error: "extension_not_enabled",
      message: "Character Settings extension is not enabled in ghost-nest.extensions.json.",
    });
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const saved = await saveGeneratedAssets(body);

    sendJson(response, 200, {
      ok: true,
      message: "Asset files saved.",
      saved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "save_failed";
    const statusCode = [
      "invalid_json",
      "invalid_save_directory",
      "save_directory_outside_project",
      "no_images_to_save",
      "invalid_data_url",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Asset files could not be saved.",
    });
  }

  return true;
}

async function handleNanikaMappings(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const mappings = await readNanikaMappings();

    sendJson(response, 200, {
      ok: true,
      mappings,
      path: path.relative(root, getNanikaMappingsPath()).replaceAll(path.sep, "/"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "nanika_mappings_failed";

    sendJson(response, 500, {
      ok: false,
      error: message,
      message: "Nanika mappings could not be loaded.",
    });
  }

  return true;
}

async function handleSaveNanikaMapping(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const mapping = normalizeNanikaMapping(body.mapping);
    const mappings = await readNanikaMappings();
    const nextMappings = [
      ...mappings.filter((item) => item.id !== mapping.id),
      mapping,
    ];
    const savedPath = await writeNanikaMappings(nextMappings);

    sendJson(response, 200, {
      ok: true,
      message: "Nanika mapping saved.",
      mapping,
      mappings: nextMappings,
      path: savedPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "save_nanika_mapping_failed";
    const statusCode = [
      "invalid_json",
      "invalid_nanika_mapping",
      "invalid_nanika_mapping_id",
      "invalid_nanika_mapping_event",
      "invalid_nanika_mapping_action",
      "invalid_nanika_mapping_actions",
      "invalid_nanika_mappings_file",
      "nanika_mapping_path_outside_project",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Nanika mapping could not be saved.",
    });
  }

  return true;
}

async function handleDeleteNanikaMapping(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const mappingId = assertSafeNanikaMappingId(body.id);
    const mappings = await readNanikaMappings();
    const nextMappings = mappings.filter((mapping) => mapping.id !== mappingId);
    const savedPath = await writeNanikaMappings(nextMappings);

    sendJson(response, 200, {
      ok: true,
      message: "Nanika mapping deleted.",
      deletedId: mappingId,
      mappings: nextMappings,
      path: savedPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "delete_nanika_mapping_failed";
    const statusCode = [
      "invalid_json",
      "invalid_nanika_mapping_id",
      "invalid_nanika_mappings_file",
      "nanika_mapping_path_outside_project",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Nanika mapping could not be deleted.",
    });
  }

  return true;
}

async function handleNanikaConditions(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const conditions = await readNanikaConditions();

    sendJson(response, 200, {
      ok: true,
      conditions,
      path: path.relative(root, getNanikaConditionsPath()).replaceAll(path.sep, "/"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "nanika_conditions_failed";

    sendJson(response, 500, {
      ok: false,
      error: message,
      message: "Nanika conditions could not be loaded.",
    });
  }

  return true;
}

async function handleSaveNanikaCondition(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const condition = normalizeNanikaCondition(body.condition);
    const conditions = await readNanikaConditions();
    const nextConditions = [
      ...conditions.filter((item) => item.id !== condition.id),
      condition,
    ];
    const savedPath = await writeNanikaConditions(nextConditions);

    sendJson(response, 200, {
      ok: true,
      message: "Nanika condition saved.",
      condition,
      conditions: nextConditions,
      path: savedPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "save_nanika_condition_failed";
    const statusCode = [
      "invalid_json",
      "invalid_nanika_condition",
      "invalid_nanika_condition_id",
      "invalid_nanika_condition_scope",
      "invalid_nanika_condition_type",
      "invalid_nanika_condition_value",
      "invalid_nanika_conditions_file",
      "nanika_condition_path_outside_project",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Nanika condition could not be saved.",
    });
  }

  return true;
}

async function handleDeleteNanikaCondition(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const conditionId = assertSafeNanikaConditionId(body.id);
    const conditions = await readNanikaConditions();
    const nextConditions = conditions.filter((condition) => condition.id !== conditionId);
    const savedPath = await writeNanikaConditions(nextConditions);

    sendJson(response, 200, {
      ok: true,
      message: "Nanika condition deleted.",
      deletedId: conditionId,
      conditions: nextConditions,
      path: savedPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "delete_nanika_condition_failed";
    const statusCode = [
      "invalid_json",
      "invalid_nanika_condition_id",
      "invalid_nanika_conditions_file",
      "nanika_condition_path_outside_project",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Nanika condition could not be deleted.",
    });
  }

  return true;
}

async function handleNanikaFeatureSets(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const featureSets = await readNanikaFeatureSets();

    sendJson(response, 200, {
      ok: true,
      featureSets,
      path: path.relative(root, getNanikaFeatureSetsPath()).replaceAll(path.sep, "/"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "nanika_feature_sets_failed";

    sendJson(response, 500, {
      ok: false,
      error: message,
      message: "Nanika feature sets could not be loaded.",
    });
  }

  return true;
}

async function handleSaveNanikaFeatureSet(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const featureSet = normalizeNanikaFeatureSet(body.featureSet);
    const featureSets = await readNanikaFeatureSets();
    const nextFeatureSets = [
      ...featureSets.filter((item) => item.id !== featureSet.id),
      featureSet,
    ];
    const savedPath = await writeNanikaFeatureSets(nextFeatureSets);

    sendJson(response, 200, {
      ok: true,
      message: "Nanika feature set saved.",
      featureSet,
      featureSets: nextFeatureSets,
      path: savedPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "save_nanika_feature_set_failed";
    const statusCode = [
      "invalid_json",
      "invalid_nanika_feature_set",
      "invalid_nanika_feature_set_id",
      "invalid_nanika_feature_set_mappings",
      "invalid_nanika_mapping_id",
      "invalid_nanika_feature_sets_file",
      "nanika_feature_set_path_outside_project",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Nanika feature set could not be saved.",
    });
  }

  return true;
}

async function handleDeleteNanikaFeatureSet(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return true;
  }

  try {
    const body = await readRequestJson(request);
    const featureSetId = assertSafeNanikaFeatureSetId(body.id);
    const featureSets = await readNanikaFeatureSets();
    const nextFeatureSets = featureSets.filter((featureSet) => featureSet.id !== featureSetId);
    const savedPath = await writeNanikaFeatureSets(nextFeatureSets);

    sendJson(response, 200, {
      ok: true,
      message: "Nanika feature set deleted.",
      deletedId: featureSetId,
      featureSets: nextFeatureSets,
      path: savedPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "delete_nanika_feature_set_failed";
    const statusCode = [
      "invalid_json",
      "invalid_nanika_feature_set_id",
      "invalid_nanika_feature_sets_file",
      "nanika_feature_set_path_outside_project",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Nanika feature set could not be deleted.",
    });
  }

  return true;
}

function parseNanikaDataPath(pathname) {
  const match = pathname.match(/^\/api\/nanika\/data\/([^/]+)(?:\/([^/]+))?$/);

  if (!match) {
    return null;
  }

  return {
    scope: decodeURIComponent(match[1]),
    id: match[2] ? decodeURIComponent(match[2]) : undefined,
  };
}

async function handleNanikaData(request, response, pathname) {
  const parsedPath = parseNanikaDataPath(pathname);

  if (!parsedPath) {
    return false;
  }

  try {
    const adapter = resolveNanikaDataAdapter();

    if (request.method === "GET" && parsedPath.id) {
      const item = await adapter.getItem(parsedPath.scope, parsedPath.id);

      sendJson(response, 200, {
        ok: true,
        scope: parsedPath.scope,
        item,
        path: getNanikaDataResponsePath(parsedPath.scope),
      });
      return true;
    }

    if (request.method === "GET") {
      const items = await adapter.list(parsedPath.scope);

      sendJson(response, 200, {
        ok: true,
        scope: parsedPath.scope,
        items,
        path: getNanikaDataResponsePath(parsedPath.scope),
      });
      return true;
    }

    if (request.method === "PUT" && parsedPath.id) {
      const body = await readRequestJson(request);
      const value = Object.prototype.hasOwnProperty.call(body, "value") ? body.value : body;
      await adapter.saveItem(parsedPath.scope, parsedPath.id, value);
      const item = await adapter.getItem(parsedPath.scope, parsedPath.id);
      const items = await adapter.list(parsedPath.scope);

      sendJson(response, 200, {
        ok: true,
        message: "Nanika data item saved.",
        scope: parsedPath.scope,
        item,
        items,
        path: getNanikaDataResponsePath(parsedPath.scope),
      });
      return true;
    }

    if (request.method === "DELETE" && parsedPath.id) {
      await adapter.deleteItem(parsedPath.scope, parsedPath.id);
      const items = await adapter.list(parsedPath.scope);

      sendJson(response, 200, {
        ok: true,
        message: "Nanika data item deleted.",
        scope: parsedPath.scope,
        deletedId: parsedPath.id,
        items,
        path: getNanikaDataResponsePath(parsedPath.scope),
      });
      return true;
    }

    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "nanika_data_failed";
    const statusCode = [
      "invalid_json",
      "unsupported_nanika_data_scope",
      "invalid_nanika_mapping",
      "invalid_nanika_mapping_id",
      "invalid_nanika_mapping_event",
      "invalid_nanika_mapping_action",
      "invalid_nanika_mapping_actions",
      "invalid_nanika_condition",
      "invalid_nanika_condition_id",
      "invalid_nanika_condition_scope",
      "invalid_nanika_condition_type",
      "invalid_nanika_condition_value",
      "invalid_nanika_menu",
      "invalid_nanika_menu_id",
      "invalid_nanika_menu_item",
      "invalid_nanika_menu_items",
      "invalid_nanika_feature_set",
      "invalid_nanika_feature_set_id",
      "invalid_nanika_feature_set_mappings",
      "invalid_nanika_mappings_file",
      "invalid_nanika_conditions_file",
      "invalid_nanika_menus_file",
      "invalid_nanika_feature_sets_file",
      "nanika_mapping_path_outside_project",
      "nanika_condition_path_outside_project",
      "nanika_menu_path_outside_project",
      "nanika_feature_set_path_outside_project",
    ].includes(message) ? 400 : 500;

    sendJson(response, statusCode, {
      ok: false,
      error: message,
      message: "Nanika data request failed.",
    });
  }

  return true;
}

async function handleApiRequest(request, response) {
  const pathname = stripConfiguredBasePath(new URL(request.url, `http://127.0.0.1:${port}`).pathname);

  if ((pathname.startsWith("/api/devtools/") || pathname.startsWith("/api/nanika/data/")) && !isCharacterDevtoolsRequestAllowed(request)) {
    sendDevtoolsForbidden(response, request);
    return true;
  }

  if (pathname.startsWith("/api/nanika/data/")) {
    return handleNanikaData(request, response, pathname);
  }

  if (pathname === "/api/devtools/generate-layer-part") {
    return handleGenerateLayerPart(request, response);
  }

  if (pathname === "/api/devtools/comfy-models") {
    return handleComfyModels(request, response);
  }

  if (pathname === "/api/devtools/character-assets") {
    return handleCharacterAssets(request, response);
  }

  if (pathname === "/api/devtools/characters") {
    return handleCharacters(request, response);
  }

  if (pathname === "/api/devtools/character-workspace") {
    return handleCharacterWorkspace(request, response);
  }

  if (pathname === "/api/devtools/create-character") {
    return handleCreateCharacter(request, response);
  }

  if (pathname === "/api/devtools/delete-character") {
    return handleDeleteCharacter(request, response);
  }

  if (pathname === "/api/devtools/asset-files") {
    return handleAssetFiles(request, response);
  }

  if (pathname === "/api/devtools/save-character-layer") {
    return handleSaveCharacterLayer(request, response);
  }

  if (pathname === "/api/devtools/save-character-surface") {
    return handleSaveCharacterSurface(request, response);
  }

  if (pathname === "/api/devtools/save-character-expression") {
    return handleSaveCharacterExpression(request, response);
  }

  if (pathname === "/api/devtools/save-character-scene") {
    return handleSaveCharacterScene(request, response);
  }

  if (pathname === "/api/devtools/save-character-lines") {
    return handleSaveCharacterLines(request, response);
  }

  if (pathname === "/api/devtools/save-character-hit-areas") {
    return handleSaveCharacterHitAreas(request, response);
  }

  if (pathname === "/api/devtools/delete-character-surface") {
    return handleDeleteCharacterSurface(request, response);
  }

  if (pathname === "/api/devtools/delete-character-expression") {
    return handleDeleteCharacterExpression(request, response);
  }

  if (pathname === "/api/devtools/delete-character-scene") {
    return handleDeleteCharacterScene(request, response);
  }

  if (pathname === "/api/devtools/delete-character-layer") {
    return handleDeleteCharacterLayer(request, response);
  }

  if (pathname === "/api/devtools/save-generated-assets") {
    return handleSaveGeneratedAssets(request, response);
  }

  if (pathname === "/api/devtools/save-asset-files") {
    return handleSaveAssetFiles(request, response);
  }

  if (pathname === "/api/devtools/nanika-mappings") {
    return handleNanikaMappings(request, response);
  }

  if (pathname === "/api/devtools/save-nanika-mapping") {
    return handleSaveNanikaMapping(request, response);
  }

  if (pathname === "/api/devtools/delete-nanika-mapping") {
    return handleDeleteNanikaMapping(request, response);
  }

  if (pathname === "/api/devtools/nanika-conditions") {
    return handleNanikaConditions(request, response);
  }

  if (pathname === "/api/devtools/save-nanika-condition") {
    return handleSaveNanikaCondition(request, response);
  }

  if (pathname === "/api/devtools/delete-nanika-condition") {
    return handleDeleteNanikaCondition(request, response);
  }

  if (pathname === "/api/devtools/nanika-feature-sets") {
    return handleNanikaFeatureSets(request, response);
  }

  if (pathname === "/api/devtools/save-nanika-feature-set") {
    return handleSaveNanikaFeatureSet(request, response);
  }

  if (pathname === "/api/devtools/delete-nanika-feature-set") {
    return handleDeleteNanikaFeatureSet(request, response);
  }

  return false;
}

const server = http.createServer(async (request, response) => {
  if (await handleApiRequest(request, response)) {
    return;
  }

  const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname;

  if (isCharacterDevtoolsStaticPath(pathname) && !isCharacterDevtoolsRequestAllowed(request)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`GhostNest devtools access is not allowed for ${getRequestIp(request)}.`);
    return;
  }

  const filePath = resolveRequestPath(request.url);

  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const contentType = mimeTypes[path.extname(filePath)] ?? "text/plain; charset=utf-8";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`GhostNest runtime is running at http://127.0.0.1:${port}`);
  console.log(`GhostNest Character Settings enabled: ${isCharacterSettingsEnabled()}`);
  console.log(`GhostNest Comfy Asset Generator bridge enabled: ${isComfyAssetGeneratorBridgeEnabled()}`);
  console.log(`GhostNest ComfyUI bridge target: ${getComfyUiUrl()}`);
  console.log(`GhostNest ComfyUI workflow path: ${getConfiguredWorkflowPath()}`);
  console.log(`GhostNest ComfyUI resolved workflow path: ${getResolvedWorkflowPath()}`);
  console.log(`GhostNest ComfyUI selected workflow path: ${findExistingWorkflowPath()?.resolvedWorkflowPath ?? "not found"}`);
});
