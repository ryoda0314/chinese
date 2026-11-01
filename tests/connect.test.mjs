import assert from "node:assert/strict";
import { test } from "node:test";
import { KEEP_MS, readReturn } from "../src/lib/connect.ts";

const pending = { state: "Ab3_-xY9Ab3_-xY9Ab3_-xY9Ab3_", next: "/app/me", at: 1_000_000 };

test("nothing came back without a token", () => {
  assert.equal(readReturn("", pending, pending.at), null);
  assert.equal(readReturn("#other=1", pending, pending.at), null);
});

test("the token is taken when it comes back to the つなぐ started here", () => {
  assert.deepEqual(readReturn(`#kotonoame=tok123&state=${pending.state}`, pending, pending.at + 60_000), { token: "tok123", next: "/app/me" });
});

test("a token for a つなぐ not started here, or too long ago, is refused", () => {
  assert.deepEqual(readReturn(`#kotonoame=tok123&state=${pending.state}`, null, pending.at), { error: "stale" });
  assert.deepEqual(readReturn("#kotonoame=tok123&state=someoneelse", pending, pending.at), { error: "stale" });
  assert.deepEqual(readReturn("#kotonoame=tok123", pending, pending.at), { error: "stale" });
  assert.deepEqual(readReturn(`#kotonoame=tok123&state=${pending.state}`, pending, pending.at + KEEP_MS + 1), { error: "stale" });
  assert.deepEqual(readReturn(`#kotonoame=tok123&state=${pending.state}`, { ...pending, at: Number.NaN }, pending.at), { error: "stale" });
});
