import assert from "node:assert/strict";
import { test } from "node:test";
import { countsHere, platformOf } from "../src/lib/usage.ts";

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

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1",
  ipod: "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  chromeos: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  linux: "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
};

test("iPhone, iPad and iPod are ios, and so is an iPad that says it is a Mac", () => {
  assert.equal(platformOf(UA.iphone, 5), "ios");
  assert.equal(platformOf(UA.ipad, 5), "ios");
  assert.equal(platformOf(UA.ipod, 5), "ios");
  assert.equal(platformOf(UA.mac, 5), "ios");
});

test("Android is android, though it says Linux too", () => {
  assert.equal(platformOf(UA.android, 5), "android");
  assert.equal(platformOf(UA.android, 0), "android");
});

test("a Mac without touch, Windows, ChromeOS and Linux are pc", () => {
  assert.equal(platformOf(UA.mac, 0), "pc");
  assert.equal(platformOf(UA.mac, 1), "pc");
  assert.equal(platformOf(UA.windows, 0), "pc");
  assert.equal(platformOf(UA.windows, 10), "pc");
  assert.equal(platformOf(UA.chromeos, 0), "pc");
  assert.equal(platformOf(UA.linux, 0), "pc");
});

test("anything else, or bad input, is other", () => {
  assert.equal(platformOf("", 0), "other");
  assert.equal(platformOf("curl/8.4.0", 0), "other");
  assert.equal(platformOf(undefined, 0), "other");
  assert.equal(platformOf(null, 5), "other");
  assert.equal(platformOf(42, 5), "other");
  assert.equal(platformOf(UA.mac, Number.NaN), "pc");
  assert.equal(platformOf(UA.mac, undefined), "pc");
});
