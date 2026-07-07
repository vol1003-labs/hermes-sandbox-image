# ---- clip-builder: build obsidian-clipper's `build:api` bundle (patched, headless) ----
# Pinned upstream obsidianmd/obsidian-clipper. web-clip/vendor-src.patch carries the two
# headless-node adaptations: (1) pass the full linkedom Document to Defuddle (api.ts), and
# (2) a node-platform build config so dist/api.mjs is self-contained bar linkedom.
# `npm install` (not `npm ci`): upstream's committed lockfile is out of sync with its
# package.json, which `npm ci` refuses.
FROM node:20-bookworm AS clip-builder
ARG OBSIDIAN_CLIPPER_REF=1.7.0
WORKDIR /build
RUN git clone --depth 1 --branch "${OBSIDIAN_CLIPPER_REF}" \
      https://github.com/obsidianmd/obsidian-clipper .
COPY web-clip/vendor-src.patch ./
RUN git apply vendor-src.patch \
 && npm install --no-audit --no-fund \
 && npm run build:api

# ---- runtime: hermes sandbox (non-root sshd) + baked web-clip wrapper ----
FROM nikolaik/python-nodejs:python3.11-nodejs20
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssh-server \
 && rm -rf /var/lib/apt/lists/*

# web-clip: headless Obsidian Web Clipper. clip() bundle (api.mjs) + thin wrapper +
# default template baked at /opt/web-clip; linkedom is the sole runtime dep. Exposed on
# PATH as `web-clip`.
COPY web-clip/web-clip.mjs web-clip/polyfill.mjs web-clip/template.default.json \
     web-clip/package.json web-clip/package-lock.json /opt/web-clip/
COPY --from=clip-builder /build/dist/api.mjs /opt/web-clip/api.mjs
RUN cd /opt/web-clip \
 && npm install --omit=dev --no-audit --no-fund \
 && chmod +x web-clip.mjs \
 && ln -s /opt/web-clip/web-clip.mjs /usr/local/bin/web-clip

USER pn
# ホスト鍵は PVC(/home/pn/ssh-host)に置き、Pod 再作成でも鍵警告を出さない。
# chmod 600: k8s fsGroup が volume 再マウント時に group 権限を付与(0660)し
# sshd が "UNPROTECTED PRIVATE KEY FILE" で起動拒否するため毎回締め直す。
CMD ["sh", "-c", "mkdir -p $HOME/ssh-host && [ -f $HOME/ssh-host/ssh_host_ed25519_key ] || ssh-keygen -t ed25519 -N '' -f $HOME/ssh-host/ssh_host_ed25519_key; chmod 600 $HOME/ssh-host/ssh_host_ed25519_key; exec /usr/sbin/sshd -D -e -f /etc/ssh-config/sshd_config"]
