import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { inferHeaderlessSchema, sampleLines } from "../src/schema-deriver";
import { preprocess } from "../src/preprocessor";
import { parseQualifier, readCachedFieldNames } from "../src/ai-compiler-assistant";

const PERSONNEL_TXT = path.join(__dirname, "../test-fixtures/personnel.txt");

// ---------------------------------------------------------------------------
// inferHeaderlessSchema — majority-vote field count + type inference
// ---------------------------------------------------------------------------

describe("inferHeaderlessSchema", () => {
  it("majority-votes field count from conforming rows", () => {
    const schema = inferHeaderlessSchema(PERSONNEL_TXT, "Personnel", ",");
    expect(schema.expectedFieldCount).toBe(4);
    expect(schema.fields).toHaveLength(4);
  });

  it("infers positional field names when no names provided", () => {
    const schema = inferHeaderlessSchema(PERSONNEL_TXT, "Personnel", ",");
    const names = schema.fields.map((f) => f.name);
    expect(names).toEqual(["field_0", "field_1", "field_2", "field_3"]);
  });

  it("uses provided AI field names when given", () => {
    const aiNames = ["name", "age", "profession", "nationality"];
    const schema = inferHeaderlessSchema(PERSONNEL_TXT, "Personnel", ",", aiNames);
    const names = schema.fields.map((f) => f.name);
    expect(names).toEqual(aiNames);
  });

  it("infers Int type for numeric column", () => {
    const schema = inferHeaderlessSchema(PERSONNEL_TXT, "Personnel", ",");
    const field1 = schema.fields.find((f) => f.name === "field_1");
    expect(field1?.type).toBe("Int");
  });

  it("infers String type for text columns", () => {
    const schema = inferHeaderlessSchema(PERSONNEL_TXT, "Personnel", ",");
    const field0 = schema.fields.find((f) => f.name === "field_0");
    expect(field0?.type).toBe("String");
  });

  it("uses struct name for schema name", () => {
    const schema = inferHeaderlessSchema(PERSONNEL_TXT, "MyStruct", ",");
    expect(schema.name).toBe("MyStruct");
  });
});

// ---------------------------------------------------------------------------
// sampleLines
// ---------------------------------------------------------------------------

describe("sampleLines", () => {
  it("returns up to limit non-empty trimmed lines", () => {
    const rows = sampleLines(PERSONNEL_TXT, 3);
    expect(rows).toHaveLength(3);
  });

  it("trims whitespace from lines", () => {
    const rows = sampleLines(PERSONNEL_TXT, 5);
    for (const row of rows) {
      expect(row).toBe(row.trim());
    }
  });
});

// ---------------------------------------------------------------------------
// parseQualifier
// ---------------------------------------------------------------------------

describe("parseQualifier", () => {
  it("parses si", () => {
    expect(parseQualifier("si")).toEqual({ kind: "si" });
  });

  it("parses bare ai", () => {
    expect(parseQualifier("ai")).toEqual({ kind: "ai" });
  });

  it("parses ai:provider", () => {
    expect(parseQualifier("ai:anthropic")).toEqual({
      kind: "ai",
      providerName: "anthropic",
    });
  });

  it("parses ai:provider/model", () => {
    expect(parseQualifier("ai:local/llama3.2")).toEqual({
      kind: "ai",
      providerName: "local",
      modelOverride: "llama3.2",
    });
  });

  it("throws on invalid qualifier", () => {
    expect(() => parseQualifier("unknown")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// readCachedFieldNames — cache miss returns null for ai qualifiers
// ---------------------------------------------------------------------------

describe("readCachedFieldNames", () => {
  let tmpDir: string;
  let tmpFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stroum-test-"));
    tmpFile = path.join(tmpDir, "test.stm");
    fs.writeFileSync(tmpFile, "");
    // Write a dummy stroum.config.json so provider resolution works
    fs.writeFileSync(
      path.join(tmpDir, "stroum.config.json"),
      JSON.stringify({
        aiProviders: {
          testprovider: {
            type: "openai-compatible",
            endpoint: "http://localhost:9999/v1",
            model: "test-model",
          },
        },
      }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null for si qualifier", () => {
    const rows = ["Joe, 51, Developer", "Bob, 23, Intern"];
    const result = readCachedFieldNames(rows, ",", "si", tmpFile);
    expect(result).toBeNull();
  });

  it("returns null on cache miss for ai qualifier", () => {
    const rows = ["Joe, 51, Developer", "Bob, 23, Intern"];
    const result = readCachedFieldNames(rows, ",", "ai:testprovider", tmpFile);
    expect(result).toBeNull();
  });

  it("returns cached names after manual cache write", () => {
    const rows = ["Joe, 51, Developer", "Bob, 23, Intern"];
    const cacheDir = path.join(tmpDir, ".stroum-cache");
    fs.mkdirSync(cacheDir, { recursive: true });

    // Compute the cache key manually by writing a known entry
    // (We write a file and verify readCachedFieldNames can find it)
    // This test verifies the round-trip via the cache mechanism.
    const crypto = require("node:crypto");
    const user = `Separator: ","\nSample rows:\n  Joe, 51, Developer\n  Bob, 23, Intern`;
    const key = crypto
      .createHash("sha256")
      .update("testprovider|test-model|name-fields|" + user)
      .digest("hex");

    const names = ["name", "age", "profession"];
    fs.writeFileSync(path.join(cacheDir, `ai-${key}.json`), JSON.stringify(names));

    const result = readCachedFieldNames(rows, ",", "ai:testprovider", tmpFile);
    expect(result).toEqual(names);
  });
});

// ---------------------------------------------------------------------------
// preprocess — #ingest directive
// ---------------------------------------------------------------------------

describe("preprocess #ingest", () => {
  it("emits struct definition for si qualifier", () => {
    const source = `#ingest "../test-fixtures/personnel.txt" as Personnel separator "," si success @"personnel" fail @"fails"`;
    const result = preprocess(source, path.join(__dirname, "dummy.stm"));
    expect(result.source).toContain("s:Personnel");
    expect(result.source).toContain("field_0");
    expect(result.source).toContain("field_1");
  });

  it("records ingest directive with correct metadata", () => {
    const source = `#ingest "../test-fixtures/personnel.txt" as Personnel separator "," si success @"personnel" fail @"fails"`;
    const result = preprocess(source, path.join(__dirname, "dummy.stm"));
    const dir = result.directives.find((d) => d.type === "ingest");
    expect(dir).toBeDefined();
    if (dir?.type === "ingest") {
      expect(dir.data.structName).toBe("Personnel");
      expect(dir.data.separator).toBe(",");
      expect(dir.data.successStream).toBe("personnel");
      expect(dir.data.failStream).toBe("fails");
      expect(dir.data.expectedFieldCount).toBe(4);
      expect(dir.data.qualifier).toBe("si");
    }
  });

  it("does not record validate rules when no #validate follows", () => {
    const source = `#ingest "../test-fixtures/personnel.txt" as Personnel separator "," si success @"personnel" fail @"fails"`;
    const result = preprocess(source, path.join(__dirname, "dummy.stm"));
    const dir = result.directives.find((d) => d.type === "ingest");
    if (dir?.type === "ingest") {
      expect(dir.data.validateRules).toBeUndefined();
    }
  });

  it("attaches validate rules from #validate si", () => {
    const source = [
      `#ingest "../test-fixtures/personnel.txt" as Personnel separator "," si success @"personnel" fail @"fails"`,
      `#validate Personnel si rules "field_1 > 0" fail @"invalid"`,
    ].join("\n");
    const result = preprocess(source, path.join(__dirname, "dummy.stm"));
    const dir = result.directives.find((d) => d.type === "ingest");
    if (dir?.type === "ingest") {
      expect(dir.data.validateRules).toBe("field_1 > 0");
      expect(dir.data.validateFailStream).toBe("invalid");
    }
  });
});

// ---------------------------------------------------------------------------
// preprocess — #derive schema with si qualifier (headerless)
// ---------------------------------------------------------------------------

describe("preprocess #derive schema with si qualifier", () => {
  it("emits struct with positional field names for headerless file", () => {
    const source = `#derive schema "../test-fixtures/personnel.txt" as Personnel si`;
    const result = preprocess(source, path.join(__dirname, "dummy.stm"));
    expect(result.source).toContain("s:Personnel");
    expect(result.source).toContain("field_0");
  });
});
