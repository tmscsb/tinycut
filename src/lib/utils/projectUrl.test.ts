import assert from "node:assert/strict";
import test from "node:test";
import { projectHash, readProjectIdFromHash } from "./projectUrl.ts";

test("layout ids round-trip through the address hash", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  assert.equal(readProjectIdFromHash(projectHash(id)), id);
  assert.equal(readProjectIdFromHash("#/p/short-id"), "short-id");
  assert.equal(readProjectIdFromHash("#/p/bad"), null);
  assert.equal(readProjectIdFromHash("#other"), null);
  assert.equal(readProjectIdFromHash(""), null);
});
