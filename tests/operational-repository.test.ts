import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SqliteOperationalRepository } from "../src/repositories/operational-repository.ts";

interface TestEntity {
  id: string;
  createdAt: string;
  status: string;
  value: string;
}

test("SQLite repository imports legacy JSON without overwriting newer state", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "content-maker-data-test-"));
  process.env.CONTENT_MAKER_DATA_DIR = dataDir;
  const legacyDir = path.join(dataDir, "content-briefs");
  await mkdir(legacyDir, { recursive: true });
  const legacy: TestEntity = {
    id: "legacy-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "pending_review",
    value: "legacy",
  };
  await writeFile(path.join(legacyDir, "legacy-1.json"), JSON.stringify(legacy));

  const repository = new SqliteOperationalRepository<TestEntity>(
    "content_brief",
    "content-briefs"
  );
  assert.equal((await repository.get("legacy-1")).value, "legacy");

  await repository.save({ ...legacy, status: "approved", value: "sqlite" });
  assert.equal((await repository.get("legacy-1")).value, "sqlite");
  assert.equal((await repository.list())[0]?.status, "approved");
});

test("SQLite repository rejects unsafe IDs", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "content-maker-data-test-"));
  process.env.CONTENT_MAKER_DATA_DIR = dataDir;
  const repository = new SqliteOperationalRepository<TestEntity>(
    "content_brief",
    "content-briefs"
  );
  await assert.rejects(() => repository.get("../../outside"), /Invalid operational entity ID/);
});
