import assert from "node:assert/strict";
import { test } from "node:test";
import { countsHere } from "../src/lib/usage.ts";

const site = "https://kotonoame-ch.vercel.app";

test("counted at the public address in a build", () => {
  assert.equal(countsHere(site, site, true), true);
  assert.equal(countsHere(site, `${site}/`, true), true);
  assert.equal(countsHere(site, `${site}/app?x=1`, true), true);
});

test("not while developing, nor at another address", () => {
  assert.equal(countsHere(site, site, false), false);
  assert.equal(countsHere("http://localhost:3000", site, true), false);
  assert.equal(countsHere("https://kotonoame-ch-git-main-someone.vercel.app", site, true), false);
  assert.equal(countsHere("http://kotonoame-ch.vercel.app", site, true), false);
});

test("nothing is counted on bad input", () => {
  assert.equal(countsHere(site, "", true), false);
  assert.equal(countsHere(site, "kotonoame-ch.vercel.app", true), false);
  assert.equal(countsHere("null", "file:///index.html", true), false);
  assert.equal(countsHere(undefined, site, true), false);
  assert.equal(countsHere(site, undefined, true), false);
  assert.equal(countsHere(site, site, "true"), false);
});
