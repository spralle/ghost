import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const idx = argv.indexOf("--name");
  if (idx === -1 || idx === argv.length - 1) {
    throw new Error("Missing required --name argument (example: --name my-plugin)");
  }
  return argv[idx + 1];
}

function parseOptionalArg(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx === argv.length - 1) return undefined;
  return argv[idx + 1];
}

function sanitizePluginName(rawName) {
  const normalized = rawName.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new Error("Plugin name must contain lowercase letters, numbers, and dashes only.");
  }
  return normalized;
}

function toTitleCase(name) {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function toPascalCase(name) {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

async function findNextPort(pluginsDir) {
  const ports = [];
  let entries;
  try {
    entries = await readdir(pluginsDir, { withFileTypes: true });
  } catch {
    return 4200;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const viteConfig = await readFile(path.join(pluginsDir, entry.name, "vite.config.ts"), "utf8");
      const match = viteConfig.match(/port:\s*(\d+)/);
      if (match) ports.push(Number(match[1]));
    } catch {
      // no vite config in this plugin
    }
  }
  return ports.length > 0 ? Math.max(...ports) + 1 : 4200;
}

function buildSharedConfig(tier) {
  const contracts = `        "@ghost-shell/contracts": {\n          singleton: true,\n          requiredVersion: "^0.0.0",\n        },\n        "@ghost-shell/react": {\n          singleton: true,\n          requiredVersion: "^0.0.0",\n        },`;
  if (tier === "minimal") return contracts;

  const importFlag = tier === "provider" ? "eager: true" : "import: false";
  const extra = `        "@ghost-shell/ui": {
          singleton: true,
          ${importFlag},
          requiredVersion: "^0.0.0",
        },
        react: {
          singleton: true,
          ${importFlag},
          requiredVersion: "^18.3.1",
        },
        "react-dom": {
          singleton: true,
          ${importFlag},
          requiredVersion: "^18.3.1",
        },`;
  return `${contracts}\n${extra}`;
}

function buildDependencies(tier) {
  const base = `    "@ghost-shell/contracts": "file:../../packages/plugin-contracts",\n    "@ghost-shell/react": "file:../../packages/react"`;
  if (tier === "minimal") return base;
  return `${base},\n    "@ghost-shell/ui": "file:../../packages/ui"`;
}

async function main() {
  const argv = process.argv.slice(2);
  const pluginName = sanitizePluginName(parseArgs(argv));
  const tier = parseOptionalArg(argv, "--tier") || "minimal";
  const federationName = parseOptionalArg(argv, "--federation-name") || `ghost.${pluginName}`;
  const root = process.cwd();
  const pluginsDir = path.join(root, "plugins");

  if (!["minimal", "ui", "provider"].includes(tier)) {
    throw new Error(`Invalid tier "${tier}". Must be minimal, ui, or provider.`);
  }

  let port = parseOptionalArg(argv, "--port");
  if (port !== undefined) {
    port = Number(port);
    const nextPort = await findNextPort(pluginsDir);
    if (port < nextPort && port >= 4200) {
      console.warn(`⚠ Port ${port} may collide with an existing plugin.`);
    }
  } else {
    port = await findNextPort(pluginsDir);
  }

  const templateRoot = path.join(root, "templates", "plugin-app");
  const targetRoot = path.join(pluginsDir, pluginName);

  await mkdir(path.join(targetRoot, "src", "components"), { recursive: true });

  const replacements = {
    __PLUGIN_NAME__: pluginName,
    __PLUGIN_TITLE__: toTitleCase(pluginName),
    __PLUGIN_COMPONENT__: `${toPascalCase(pluginName)}View`,
    __PLUGIN_PASCAL__: toPascalCase(pluginName),
    __FEDERATION_NAME__: federationName,
    __PORT__: String(port),
    __SHARED_CONFIG__: buildSharedConfig(tier),
    __PLUGIN_DEPS__: buildDependencies(tier),
    __PART_ID__: `${pluginName}.part`,
  };

  const files = [
    ["package.json.template", "package.json"],
    ["tsconfig.json.template", "tsconfig.json"],
    ["README.md.template", "README.md"],
    ["vite.config.ts.template", "vite.config.ts"],
    ["src/index.ts.template", "src/index.ts"],
    ["src/plugin-contract-expose.ts.template", "src/plugin-contract-expose.ts"],
    ["src/plugin-parts-expose.ts.template", "src/plugin-parts-expose.ts"],
    ["src/plugin-services-expose.ts.template", "src/plugin-services-expose.ts"],
    ["src/components/MainPanel.tsx.template", "src/components/MainPanel.tsx"],
  ];

  for (const [templateRelative, targetRelative] of files) {
    const templatePath = path.join(templateRoot, templateRelative);
    const targetPath = path.join(targetRoot, targetRelative);
    let content = await readFile(templatePath, "utf8");
    for (const [key, value] of Object.entries(replacements)) {
      content = content.replaceAll(key, value);
    }
    await writeFile(targetPath, content, "utf8");
  }

  console.log(`✓ Scaffolded plugin at plugins/${pluginName}`);
  console.log(`  Federation name: ${federationName}`);
  console.log(`  Dev port: ${port}`);
  console.log(`  Shared tier: ${tier}`);
  console.log();
  console.log("  Next steps:");
  console.log(`    cd plugins/${pluginName}`);
  console.log("    bun install");
  console.log("    bun run dev");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
