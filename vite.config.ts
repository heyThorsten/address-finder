import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const keyPath = process.env.DEV_HTTPS_KEY;
const certificatePath = process.env.DEV_HTTPS_CERT;

if (Boolean(keyPath) !== Boolean(certificatePath)) {
  throw new Error("Set both DEV_HTTPS_KEY and DEV_HTTPS_CERT to enable local HTTPS.");
}

const https = keyPath && certificatePath
  ? {
      key: readFileSync(keyPath),
      cert: readFileSync(certificatePath),
    }
  : undefined;

const [githubOwner, githubRepository] = process.env.GITHUB_REPOSITORY?.split("/") ?? [];
const base = process.env.GITHUB_PAGES === "true"
  ? githubRepository === `${githubOwner}.github.io`
    ? "/"
    : `/${githubRepository || "address-finder"}/`
  : "/";

export default defineConfig({
  base,
  server: { https },
});
