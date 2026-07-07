# hermes-sandbox-image

Sandbox container image for the Hermes agent terminal backend.

## Overview

Non-root sshd on port 2222, user `pn` (uid 1000), based on `nikolaik/python-nodejs:python3.11-nodejs20`.
Released to `ghcr.io/vol1003-labs/hermes-sandbox` by tag.

## Design

- **Base image**: `nikolaik/python-nodejs:python3.11-nodejs20` — ships Python 3.11 + Node.js 20 under user `pn` (uid 1000)
- **SSH daemon**: OpenSSH `sshd`, running as user `pn` (non-root)
- **sshd config**: NOT baked into the image. The runtime must mount a config file at `/etc/ssh-config/sshd_config` (in Kubernetes: a ConfigMap volume). Without it the container exits.
- **Host keys**: persisted under `/home/pn/ssh-host` (PVC mount in Kubernetes); generated automatically on first start
- **Authorized keys**: read from the path configured in the mounted `sshd_config` (typically `/etc/ssh-auth/authorized_keys`, mounted from a Kubernetes Secret; `StrictModes no` to allow root-owned mount)
- **Password auth**: disabled; ed25519 key auth only

## Usage in Kubernetes

The image is consumed by a StatefulSet that mounts:
- A ConfigMap at `/etc/ssh-config` containing `sshd_config`
- A PVC at `/home/pn/ssh-host` for host key persistence across Pod restarts
- A Secret at `/etc/ssh-auth` containing `authorized_keys`

## web-clip (headless Obsidian Web Clipper)

The image ships a `web-clip` CLI (`/opt/web-clip`, on `PATH`) that turns a public article
URL into Obsidian Web Clipper-quality Markdown headless (no browser):

```
web-clip <url> [-t template.json] [-o outdir] [--html file] [--print]
```

- **Engine**: obsidianmd/obsidian-clipper's programmatic `clip()` (`build:api` bundle),
  reused so the full template engine (variables + 50+ filters) needs no reimplementation.
  Pinned to tag `1.7.0` (`Dockerfile` `OBSIDIAN_CLIPPER_REF`), built in the `clip-builder`
  stage with `web-clip/vendor-src.patch` applied.
- **`web-clip/vendor-src.patch`** — the only source changes, two of them:
  1. `src/api.ts`: pass the full linkedom `Document` (not `doc.documentElement`, an
     Element) to Defuddle. Without this, headless extraction returns an empty body.
  2. `scripts/build-api.mjs`: `platform: 'node'` + bundle `defuddle`/`defuddle/full`/`dayjs`
     (only `linkedom` stays external) so `dist/api.mjs` runs under Node ESM.
- **Wrapper** (`web-clip/`): `web-clip.mjs` (fetch → linkedom documentParser → `clip()` →
  Markdown), `polyfill.mjs` (window/DOMParser/document/**navigator** shim, imported before
  `api.mjs`), `template.default.json` (default template), `linkedom` (sole runtime dep).
- **Limit**: plain `fetch()`, no JS rendering — SPA/paywall/bot-blocked pages yield empty
  bodies (the wrapper reports `empty: true`).

To bump the upstream clipper: change `OBSIDIAN_CLIPPER_REF`, re-derive `vendor-src.patch`
against the new tag, re-test on real URLs, then release a new image tag.

## Releases

Images are published to GHCR via GitHub Actions on each `v*` tag push:

```
ghcr.io/vol1003-labs/hermes-sandbox:<tag>
```
