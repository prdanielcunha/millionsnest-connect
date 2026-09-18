import fs from "node:fs";
import assert from "node:assert/strict";

const firebase = JSON.parse(fs.readFileSync("firebase.json", "utf8"));
assert.equal(firebase?.hosting?.target, "connect");
assert.equal(firebase?.hosting?.public, "dist");
assert.deepEqual(firebase?.hosting?.rewrites, [
  {
    source: "/api/**",
    run: {
      serviceId: "connect-api",
      region: "us-central1",
    },
  },
  { source: "**", destination: "/index.html" },
]);

const rc = JSON.parse(fs.readFileSync(".firebaserc", "utf8"));
assert.deepEqual(
  rc?.targets?.millionsnest?.hosting?.connect,
  ["mn-connect-555464791734"],
  "Connect must deploy only to its dedicated Firebase Hosting site"
);

const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
assert.equal(vercel?.git?.deploymentEnabled, false, "Vercel rollback must remain manual-only");

console.log("Connect Firebase Hosting migration contract: OK");
