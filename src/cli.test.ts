import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  resolveSchemaDeriverRuntimeFiles,
  type SchemaDeriverRuntimeFiles,
} from "./cli";

describe("CLI schema deriver runtime resolution", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stroum-cli-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  function setupCliDir(): string {
    const cliDir = path.join(tempRoot, "src");
    fs.mkdirSync(cliDir, { recursive: true });
    return cliDir;
  }

  function resolve(cliDir: string): SchemaDeriverRuntimeFiles {
    return resolveSchemaDeriverRuntimeFiles(cliDir);
  }

  it("prefers a local schema-deriver.js when present", () => {
    const cliDir = setupCliDir();
    const localJs = path.join(cliDir, "schema-deriver.js");
    fs.writeFileSync(localJs, "module.exports = {};\n");

    expect(resolve(cliDir)).toEqual({ jsSource: localJs, tsSource: null });
  });

  it("falls back to dist/schema-deriver.js when running from src", () => {
    const cliDir = setupCliDir();
    const distDir = path.join(tempRoot, "dist");
    fs.mkdirSync(distDir, { recursive: true });
    const distJs = path.join(distDir, "schema-deriver.js");
    fs.writeFileSync(distJs, "module.exports = {};\n");

    expect(resolve(cliDir)).toEqual({ jsSource: distJs, tsSource: null });
  });

  it("falls back to schema-deriver.ts when no js artifact exists", () => {
    const cliDir = setupCliDir();
    const sourceTs = path.join(cliDir, "schema-deriver.ts");
    fs.writeFileSync(sourceTs, "export {};\n");

    expect(resolve(cliDir)).toEqual({ jsSource: null, tsSource: sourceTs });
  });
});