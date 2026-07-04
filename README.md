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

## Releases

Images are published to GHCR via GitHub Actions on each `v*` tag push:

```
ghcr.io/vol1003-labs/hermes-sandbox:<tag>
```
