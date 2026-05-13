import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { sampleLines } from "./schema-deriver";

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

interface AnthropicProviderConfig {
  type: "anthropic";
  model: string;
  key: string;
}

interface OpenAICompatibleProviderConfig {
  type: "openai-compatible";
  endpoint: string;
  model: string;
  key?: string;
}

type ProviderConfig = AnthropicProviderConfig | OpenAICompatibleProviderConfig;

interface StroumConfig {
  aiProviders?: Record<string, ProviderConfig>;
  defaultAiProvider?: string;
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

function loadConfig(fromFile: string): StroumConfig {
  const projectRoot = findProjectRoot(fromFile);

  const projectConfigPath = path.join(projectRoot, "stroum.config.json");
  const globalConfigPath = path.join(os.homedir(), ".stroum", "config.json");

  let global: StroumConfig = {};
  let project: StroumConfig = {};

  if (fs.existsSync(globalConfigPath)) {
    try {
      global = JSON.parse(fs.readFileSync(globalConfigPath, "utf-8"));
    } catch {
      // ignore malformed global config
    }
  }

  if (fs.existsSync(projectConfigPath)) {
    try {
      project = JSON.parse(fs.readFileSync(projectConfigPath, "utf-8"));
    } catch {
      // ignore malformed project config
    }
  }

  return {
    aiProviders: { ...global.aiProviders, ...project.aiProviders },
    defaultAiProvider: project.defaultAiProvider ?? global.defaultAiProvider,
  };
}

function findProjectRoot(fromFile: string): string {
  let dir = path.dirname(fromFile);
  const root = path.parse(dir).root;

  while (dir !== root) {
    if (
      fs.existsSync(path.join(dir, "stroum.config.json")) ||
      fs.existsSync(path.join(dir, "package.json"))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  return path.dirname(fromFile);
}

// ---------------------------------------------------------------------------
// Qualifier parsing
// ---------------------------------------------------------------------------

export interface ParsedQualifier {
  kind: "si" | "ai";
  providerName?: string;
  modelOverride?: string;
}

export function parseQualifier(qualifier: string): ParsedQualifier {
  if (qualifier === "si") return { kind: "si" };
  if (qualifier === "ai") return { kind: "ai" };

  // ai:name or ai:name/model
  const match = qualifier.match(/^ai:(\w+)(?:\/([\w.-]+))?$/);
  if (!match) throw new Error(`[stroum] Invalid inference qualifier: "${qualifier}"`);

  return {
    kind: "ai",
    providerName: match[1],
    modelOverride: match[2],
  };
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

function cacheDir(fromFile: string): string {
  const root = findProjectRoot(fromFile);
  const dir = path.join(root, ".stroum-cache");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cacheKey(providerName: string, model: string, task: string, input: string): string {
  return crypto
    .createHash("sha256")
    .update(`${providerName}|${model}|${task}|${input}`)
    .digest("hex");
}

function readCache(dir: string, key: string): string[] | null {
  const p = path.join(dir, `ai-${key}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function writeCache(dir: string, key: string, value: string[]): void {
  const p = path.join(dir, `ai-${key}.json`);
  fs.writeFileSync(p, JSON.stringify(value), "utf-8");
}

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

function resolveProvider(
  parsed: ParsedQualifier,
  config: StroumConfig,
): { name: string; cfg: ProviderConfig; model: string } {
  const providers = config.aiProviders ?? {};
  const names = Object.keys(providers);

  if (names.length === 0) {
    throw new Error(
      "[stroum] No AI providers configured. Add aiProviders to stroum.config.json.",
    );
  }

  let name: string;

  if (parsed.providerName) {
    name = parsed.providerName;
  } else if (config.defaultAiProvider) {
    name = config.defaultAiProvider;
  } else if (names.length === 1) {
    name = names[0];
  } else {
    throw new Error(
      `[stroum] Multiple AI providers configured (${names.join(", ")}). ` +
        `Specify with 'ai:<provider>' or set "defaultAiProvider" in stroum.config.json.`,
    );
  }

  const cfg = providers[name];
  if (!cfg) {
    throw new Error(
      `[stroum] Unknown AI provider "${name}". Configured: ${names.join(", ")}`,
    );
  }

  const model = parsed.modelOverride ?? cfg.model;
  return { name, cfg, model };
}

// ---------------------------------------------------------------------------
// Expand env vars in key strings like "${ANTHROPIC_API_KEY}"
// ---------------------------------------------------------------------------

function expandEnvKey(raw: string): string {
  return raw.replace(/\$\{([^}]+)\}/g, (_, varName) => process.env[varName] ?? "");
}

// ---------------------------------------------------------------------------
// Backend: Anthropic Messages API (native fetch)
// ---------------------------------------------------------------------------

async function callAnthropic(
  cfg: AnthropicProviderConfig,
  model: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string | null> {
  const apiKey = expandEnvKey(cfg.key);
  if (!apiKey) {
    console.warn("[stroum] ANTHROPIC_API_KEY not set — falling back to positional field names.");
    return null;
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.warn(`[stroum] Anthropic API error ${resp.status}: ${body.slice(0, 200)} — falling back.`);
      return null;
    }

    const data = (await resp.json()) as { content: Array<{ type: string; text: string }> };
    return data.content.find((c) => c.type === "text")?.text ?? null;
  } catch (err) {
    console.warn(`[stroum] Anthropic request failed: ${(err as Error).message} — falling back.`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Backend: OpenAI-compatible (Ollama, LM Studio, OpenAI, etc.)
// ---------------------------------------------------------------------------

async function callOpenAICompatible(
  cfg: OpenAICompatibleProviderConfig,
  model: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string | null> {
  const endpoint = cfg.endpoint.replace(/\/$/, "") + "/chat/completions";
  const apiKey = cfg.key ? expandEnvKey(cfg.key) : "none";

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.warn(`[stroum] OpenAI-compatible API error ${resp.status}: ${body.slice(0, 200)} — falling back.`);
      return null;
    }

    const data = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content ?? null;
  } catch (err) {
    console.warn(`[stroum] OpenAI-compatible request failed: ${(err as Error).message} — falling back.`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Task prompts
// ---------------------------------------------------------------------------

function buildNameFieldsPrompt(rows: string[], separator: string): { system: string; user: string } {
  const system =
    "You are a data schema assistant. Given sample rows from a delimited file, " +
    "infer short, lowercase, snake_case field names for each column. " +
    "Reply with ONLY a JSON array of strings, e.g. [\"name\",\"age\",\"city\"]. No explanation.";

  const user =
    `Separator: "${separator}"\nSample rows:\n` +
    rows.map((r) => `  ${r}`).join("\n");

  return { system, user };
}

function buildValidateRulesPrompt(
  structName: string,
  fields: Array<{ name: string; type: string }>,
  sampleRows: string[],
): { system: string; user: string } {
  const system =
    "You are a data validation assistant. Given a struct and sample rows, " +
    "produce TypeScript boolean expressions to validate a parsed row object. " +
    "Reply with ONLY a JSON array of strings, each a valid TS boolean expression. No explanation.";

  const fieldList = fields.map((f) => `${f.name}: ${f.type}`).join(", ");
  const user =
    `Struct: ${structName} { ${fieldList} }\nSample rows:\n` +
    sampleRows.map((r) => `  ${r}`).join("\n");

  return { system, user };
}

// ---------------------------------------------------------------------------
// Parse LLM response into a string array
// ---------------------------------------------------------------------------

function parseStringArray(raw: string | null): string[] | null {
  if (!raw) return null;
  const match = raw.match(/\[[\s\S]*?\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed as string[];
    }
  } catch {
    // fall through
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type CompilerTask = "name-fields" | "validate-rules";

export interface NameFieldsContext {
  rows: string[];
  separator: string;
}

export interface ValidateRulesContext {
  structName: string;
  fields: Array<{ name: string; type: string }>;
  sampleRows: string[];
}

/**
 * Ask the AI compiler assistant to perform a compile-time inference task.
 *
 * Returns an array of strings (field names or validation expressions), or null
 * when the qualifier is "si" or the provider is unreachable (graceful degradation).
 *
 * @param task - which inference task to perform
 * @param context - task-specific input data
 * @param qualifier - raw qualifier string from the directive (e.g. "si", "ai", "ai:anthropic")
 * @param fromFile - absolute path to the .stm source file (used to locate config + cache)
 */
export async function askCompiler(
  task: CompilerTask,
  context: NameFieldsContext | ValidateRulesContext,
  qualifier: string,
  fromFile: string,
): Promise<string[] | null> {
  const parsed = parseQualifier(qualifier);
  if (parsed.kind === "si") return null;

  const config = loadConfig(fromFile);
  const { name, cfg, model } = resolveProvider(parsed, config);

  let system: string;
  let user: string;

  if (task === "name-fields") {
    const ctx = context as NameFieldsContext;
    ({ system, user } = buildNameFieldsPrompt(ctx.rows, ctx.separator));
  } else {
    const ctx = context as ValidateRulesContext;
    ({ system, user } = buildValidateRulesPrompt(ctx.structName, ctx.fields, ctx.sampleRows));
  }

  const dir = cacheDir(fromFile);
  const key = cacheKey(name, model, task, user);

  const cached = readCache(dir, key);
  if (cached !== null) return cached;

  let rawResponse: string | null;

  if (cfg.type === "anthropic") {
    rawResponse = await callAnthropic(cfg, model, system, user);
  } else {
    rawResponse = await callOpenAICompatible(cfg, model, system, user);
  }

  const result = parseStringArray(rawResponse);

  if (result !== null) {
    writeCache(dir, key, result);
  }

  return result;
}

/**
 * Synchronously read AI-generated field names from cache (no network call).
 *
 * Returns the cached names if available, or null on cache miss or si qualifier.
 * Use prefetchIngestAINames() in the CLI before module loading to warm the cache.
 */
export function readCachedFieldNames(
  rows: string[],
  separator: string,
  qualifier: string,
  fromFile: string,
): string[] | null {
  const parsed = parseQualifier(qualifier);
  if (parsed.kind === "si") return null;

  let config: StroumConfig;
  try {
    config = loadConfig(fromFile);
  } catch {
    return null;
  }

  let resolved: ReturnType<typeof resolveProvider>;
  try {
    resolved = resolveProvider(parsed, config);
  } catch {
    return null;
  }

  const { name, model } = resolved;
  const { user } = buildNameFieldsPrompt(rows, separator);
  const key = cacheKey(name, model, "name-fields", user);
  const dir = cacheDir(fromFile);
  return readCache(dir, key);
}

// Regex matching #ingest lines with an ai qualifier
const AI_INGEST_RE =
  /^#ingest\s+"([^"]+)"\s+as\s+\w+\s+separator\s+"([^"]*)"\s+(ai(?::\w+(?:\/[\w.-]+)?)?)\s+/gm;

// Regex matching #derive schema lines with an ai qualifier (separator inferred as comma)
const AI_DERIVE_RE =
  /^#derive\s+schema\s+"([^"]+)"\s+as\s+\w+\s+(ai(?::\w+(?:\/[\w.-]+)?)?)\s*$/gm;

/**
 * Scan a .stm source file for ai-qualified directives and make AI calls to
 * populate the cache. Call this (with await) before module loading so the
 * synchronous preprocessor finds the cache warm.
 */
export async function prefetchIngestAINames(stmFilePath: string): Promise<void> {
  let source: string;
  try {
    source = fs.readFileSync(stmFilePath, "utf-8");
  } catch {
    return;
  }

  const dir = path.dirname(stmFilePath);

  for (const m of [...source.matchAll(AI_INGEST_RE)]) {
    const [, relPath, separator, qualifier] = m;
    const absolutePath = path.isAbsolute(relPath) ? relPath : path.resolve(dir, relPath);
    let rows: string[];
    try {
      rows = sampleLines(absolutePath, 5);
    } catch {
      continue;
    }
    await askCompiler("name-fields", { rows, separator }, qualifier, stmFilePath);
  }

  for (const m of [...source.matchAll(AI_DERIVE_RE)]) {
    const [, relPath, qualifier] = m;
    const absolutePath = path.isAbsolute(relPath) ? relPath : path.resolve(dir, relPath);
    let rows: string[];
    try {
      rows = sampleLines(absolutePath, 5);
    } catch {
      continue;
    }
    await askCompiler("name-fields", { rows, separator: "," }, qualifier, stmFilePath);
  }
}
