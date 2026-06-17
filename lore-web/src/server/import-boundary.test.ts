import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

const forbiddenImportPattern =
  /from\s+["'](?:@grpc\/grpc-js|@grpc\/proto-loader|.*\.proto)["']|import\s+["'](?:@grpc\/grpc-js|@grpc\/proto-loader|.*\.proto)["']/;

describe("server-only import boundary", () => {
  it("keeps gRPC packages and proto imports out of client-capable source", () => {
    const sourceFiles = globSync("src/**/*.{ts,tsx}", {
      cwd: process.cwd(),
      exclude: ["src/server/**"],
    });
    const offenders = sourceFiles.filter((file) =>
      forbiddenImportPattern.test(readFileSync(file, "utf8")),
    );

    expect(offenders.map((file) => relative(process.cwd(), file))).toEqual([]);
  });
});
