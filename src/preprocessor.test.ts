/**
 * Tests for preprocessor functionality
 */

import * as path from "path";
import { hasDirectives, preprocess } from "../src/preprocessor";

describe("Preprocessor", () => {
  const csvPath = path.resolve(__dirname, "../test-fixtures/sample.csv");

  describe("hasDirectives", () => {
    it("should detect #derive directives", () => {
      const source = `-- Test
#derive schema "data.csv" as Row

f:main => println("hi")`;

      expect(hasDirectives(source)).toBe(true);
    });

    it("should return false for source without directives", () => {
      const source = `-- Test
f:main => println("hi")`;

      expect(hasDirectives(source)).toBe(false);
    });

    it("should detect directives in middle of file", () => {
      const source = `f:test => 42

#derive schema "data.csv" as Row

f:main => println("hi")`;

      expect(hasDirectives(source)).toBe(true);
    });
  });

  describe("preprocess", () => {
    it("should expand #derive directive with valid CSV file", () => {
      const source = `-- Test
#derive schema "../test-fixtures/sample.csv" as Row

f:main => println("hi")`;

      const sourcePath = path.join(__dirname, "../examples/test.stm");
      const result = preprocess(source, sourcePath);

      // Should replace directive with comment and struct
      expect(result.source).toContain("-- Auto-generated from:");
      expect(result.source).toContain("s:Row {");
      expect(result.source).toContain("id: Int");
      expect(result.source).toContain("name: String");
      expect(result.source).toContain("}");

      // Should track the directive
      expect(result.directives).toHaveLength(1);
      expect(result.directives[0].type).toBe("derive");
      expect(result.directives[0].line).toBe(2);
      expect(result.directives[0].metadata.structName).toBe("Row");
    });

    it("should handle multiple directives", () => {
      const source = `#derive schema "../test-fixtures/sample.csv" as Row
#derive schema "../test-fixtures/sample.json" as User

f:main => println("hi")`;

      const sourcePath = path.join(__dirname, "../examples/test.stm");
      const result = preprocess(source, sourcePath);

      expect(result.directives).toHaveLength(2);
      expect(result.directives[0].metadata.structName).toBe("Row");
      expect(result.directives[1].metadata.structName).toBe("User");

      // Should contain both struct definitions
      expect(result.source).toContain("s:Row {");
      expect(result.source).toContain("s:User {");
    });

    it("should preserve non-directive lines", () => {
      const source = `-- Comment before
#derive schema "../test-fixtures/sample.csv" as Row
-- Comment after

f:main => println("hi")`;

      const sourcePath = path.join(__dirname, "../examples/test.stm");
      const result = preprocess(source, sourcePath);

      expect(result.source).toContain("-- Comment before");
      expect(result.source).toContain("-- Comment after");
      expect(result.source).toContain('f:main => println("hi")');
    });

    it("should handle directive with absolute path", () => {
      const source = `#derive schema "${csvPath}" as Row`;

      const result = preprocess(source);

      expect(result.directives).toHaveLength(1);
      expect(result.source).toContain("s:Row {");
    });

    it("should handle error for non-existent file gracefully", () => {
      const source = `#derive schema "nonexistent.csv" as Row`;

      const result = preprocess(source);

      // Should add error comment and preserve directive
      expect(result.source).toContain("-- ERROR:");
      expect(result.source).toContain("#derive");
      expect(result.directives).toHaveLength(0);
    });

    it("should not modify source without directives", () => {
      const source = `-- Test
f:main => println("hi")`;

      const result = preprocess(source);

      expect(result.source).toBe(source);
      expect(result.directives).toHaveLength(0);
    });
  });

  describe("#derive parser", () => {
    const structSource = `s:Student {\n  name: String\n  average: Float\n}`;

    it("expands basic parser with String and Float fields", () => {
      const source = `${structSource}\n#derive parser Student ","`;
      const result = preprocess(source);
      expect(result.source).toContain("f:parse_student __line:String -> Student =>");
      expect(result.source).toContain(':__fields split(__line, ",")');
      expect(result.source).toContain("name: head(__fields)");
      expect(result.source).toContain("average: to_float(head(drop(1, __fields)))");
    });

    it("uses custom function name when 'as' clause is provided", () => {
      const source = `${structSource}\n#derive parser Student "," as parseStudentRow`;
      const result = preprocess(source);
      expect(result.source).toContain("f:parseStudentRow __line:String -> Student =>");
      expect(result.source).not.toContain("f:parse_student");
    });

    it("uses custom function name with flags", () => {
      const source = `${structSource}\n#derive parser Student "," as parseTrimmed trim`;
      const result = preprocess(source);
      expect(result.source).toContain("f:parseTrimmed __line:String -> Student =>");
      expect(result.source).toContain(':__fields map(trim, split(__line, ","))');
    });

    it("expands with Int field cast", () => {
      const source = `s:Item {\n  label: String\n  count: Int\n}\n#derive parser Item ","`;
      const result = preprocess(source);
      expect(result.source).toContain("count: to_int(head(drop(1, __fields)))");
    });

    it("expands with trim option", () => {
      const source = `${structSource}\n#derive parser Student "," trim`;
      const result = preprocess(source);
      expect(result.source).toContain(':__fields map(trim, split(__line, ","))');
    });

    it("expands with nullable option", () => {
      const source = `${structSource}\n#derive parser Student "," nullable`;
      const result = preprocess(source);
      expect(result.source).toContain(":__f0 head(__fields)");
      expect(result.source).toContain(':__f1 head(drop(1, __fields))');
      expect(result.source).toContain('if eq(__f0, "") then null else __f0');
      expect(result.source).toContain('if eq(__f1, "") then null else to_float(__f1)');
    });

    it("expands with trim and nullable combined", () => {
      const source = `${structSource}\n#derive parser Student "," trim nullable`;
      const result = preprocess(source);
      expect(result.source).toContain(':__fields map(trim, split(__line, ","))');
      expect(result.source).toContain('if eq(__f0, "") then null else __f0');
    });

    it("errors when struct is not found", () => {
      const source = `#derive parser Unknown ","`;
      const result = preprocess(source);
      expect(result.source).toContain("-- ERROR:");
      expect(result.source).toContain("'Unknown' not found");
    });

    it("hasDirectives detects #derive parser", () => {
      expect(hasDirectives(`${structSource}\n#derive parser Student ","`)).toBe(true);
    });
  });
});
