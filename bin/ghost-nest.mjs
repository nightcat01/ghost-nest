#!/usr/bin/env node
import { constants } from "node:fs";
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const defaultAssetRoot = "public/assets/nanika";
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demoCharacters = ["rine"];
const copyableAssetExtensions = new Set([
  ".avif",
  ".gif",
  ".jpg",
  ".jpeg",
  ".png",
  ".svg",
  ".webp",
]);
const assetDirectories = [
  ".",
  "characters",
  "common",
  "common/parts",
  "common/scenes",
];

function printHelp() {
  console.log(`GhostNest CLI

Usage:
  ghost-nest init-assets [--root <path>] [--dry-run]
  ghost-nest export-demo-assets [--root <path>] [--character <id|all>] [--force] [--dry-run]
  ghost-nest help

Commands:
  init-assets   Create the recommended host asset directories.
  export-demo-assets
                Copy bundled demo character assets into the host asset root.

Options:
  --root        Host asset root. Defaults to ${defaultAssetRoot}
  --character   Demo character id to copy. Defaults to rine. Use all for every bundled demo asset.
  --force       Overwrite existing files when copying demo assets.
  --dry-run     Print directories without creating them.
  -h, --help    Show this help.
`);
}

function readOption(args, name) {
  const inlinePrefix = `${name}=`;
  const inlineValue = args.find((arg) => arg.startsWith(inlinePrefix));

  if (inlineValue) {
    return inlineValue.slice(inlinePrefix.length);
  }

  const index = args.indexOf(name);

  if (index >= 0) {
    return args[index + 1];
  }

  return undefined;
}

function hasOption(args, ...names) {
  return names.some((name) => args.includes(name));
}

function toPublicUrl(root) {
  const normalizedRoot = root.replaceAll("\\", "/").replace(/\/+$/, "");

  if (normalizedRoot === "public") {
    return "/";
  }

  if (normalizedRoot.startsWith("public/")) {
    return `/${normalizedRoot.slice("public/".length)}`;
  }

  return null;
}

function printRuntimeHint(root) {
  const publicUrl = toPublicUrl(root);

  if (!publicUrl) {
    console.log("");
    console.log("Runtime hint:");
    console.log("  Set assetBaseUrl to the browser URL that serves this folder.");
    return;
  }

  const baseUrl = publicUrl.replace(/\/+$/, "");

  console.log("");
  console.log("Runtime hint:");
  console.log("  assetBaseUrl: {");
  console.log(`    charactersRootUrl: "${baseUrl}/characters",`);
  console.log(`    commonAssetBaseUrl: "${baseUrl}/common"`);
  console.log("  }");
}

async function initAssets(args) {
  const requestedRoot = readOption(args, "--root") ?? defaultAssetRoot;
  const dryRun = hasOption(args, "--dry-run");
  const root = path.normalize(requestedRoot);
  const absoluteRoot = path.resolve(process.cwd(), root);
  const directories = assetDirectories.map((directory) => path.join(absoluteRoot, directory));

  console.log(`${dryRun ? "Would create" : "Creating"} GhostNest asset directories:`);
  directories.forEach((directory) => {
    console.log(`  ${path.relative(process.cwd(), directory) || "."}`);
  });

  if (!dryRun) {
    await Promise.all(directories.map((directory) => mkdir(directory, { recursive: true })));
  }

  printRuntimeHint(root);
}

function createExportTargets(root, characterId) {
  const source = path.join(packageRoot, "src", "characters", characterId, "assets");
  const destination = path.resolve(process.cwd(), root, "characters", characterId, "assets");

  return { source, destination };
}

async function copyDirectory(source, destination, options, copiedFiles = []) {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath, options, copiedFiles);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!copyableAssetExtensions.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    if (options.dryRun) {
      copiedFiles.push(destinationPath);
      continue;
    }

    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(
      sourcePath,
      destinationPath,
      options.force ? 0 : constants.COPYFILE_EXCL,
    );
    copiedFiles.push(destinationPath);
  }

  return copiedFiles;
}

function resolveDemoCharacterIds(value) {
  const requestedCharacter = value ?? "rine";

  if (requestedCharacter === "all") {
    return demoCharacters;
  }

  if (!demoCharacters.includes(requestedCharacter)) {
    throw new Error(`Unknown demo character: ${requestedCharacter}. Available: ${demoCharacters.join(", ")}`);
  }

  return [requestedCharacter];
}

async function exportDemoAssets(args) {
  const requestedRoot = readOption(args, "--root") ?? defaultAssetRoot;
  const root = path.normalize(requestedRoot);
  const dryRun = hasOption(args, "--dry-run");
  const force = hasOption(args, "--force");
  const characterIds = resolveDemoCharacterIds(readOption(args, "--character"));

  await initAssets([`--root=${root}`, ...(dryRun ? ["--dry-run"] : [])]);

  for (const characterId of characterIds) {
    const { source, destination } = createExportTargets(root, characterId);

    console.log("");
    console.log(`${dryRun ? "Would copy" : "Copying"} demo assets for ${characterId}:`);
    console.log(`  from ${path.relative(process.cwd(), source) || source}`);
    console.log(`  to   ${path.relative(process.cwd(), destination) || destination}`);

    try {
      const copiedFiles = await copyDirectory(source, destination, { dryRun, force });
      console.log(`  ${dryRun ? "files" : "copied"}: ${copiedFiles.length}`);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
        console.error("  failed: a file already exists. Re-run with --force to overwrite demo assets.");
        process.exitCode = 1;
        return;
      }

      throw error;
    }
  }
}

async function main() {
  const [, , command = "help", ...args] = process.argv;

  if (hasOption([command, ...args], "-h", "--help") || command === "help") {
    printHelp();
    return;
  }

  if (command === "init-assets") {
    await initAssets(args);
    return;
  }

  if (command === "export-demo-assets") {
    await exportDemoAssets(args);
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.error("Run ghost-nest help for available commands.");
  process.exitCode = 1;
}

await main();
