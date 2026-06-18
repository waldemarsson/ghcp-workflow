# .devcontainer/Dockerfile
# .NET 10 on Ubuntu 24.04 Noble — GA as of December 2025.
# DinD, Node.js, and Copilot CLI are installed via devcontainer features.
FROM mcr.microsoft.com/devcontainers/dotnet:10.0-noble

# ── OS dependencies ──────────────────────────────────────────────────────────
# libsecret-1-0 : MSAL token cache persistence for Azure credential provider
# systemd       : provides `systemd-inhibit`, used by the Copilot CLI keep-alive
#                 feature to stop the host from idling/sleeping during long sessions
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libsecret-1-0 \
        systemd \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ── Agent tooling ────────────────────────────────────────────────────────────
# Fast CLI utilities used by AI coding agents and dev workflows.
#   ripgrep : fast recursive search (rg)
#   fd-find : fast file finder (exposed as `fd`)
#   bat     : syntax-highlighting cat (exposed as `bat`)
#   jq      : structured-data (JSON) query
#   tree    : directory tree view
# Note: on Debian/Ubuntu apt installs fd as `fdfind` and bat as `batcat` —
# the symlinks below expose them under their canonical names.
# ast-grep (npm) is installed in postCreate.sh, after the Node feature is on PATH.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ripgrep \
        fd-find \
        bat \
        jq \
        tree \
    && ln -s "$(which fdfind)" /usr/local/bin/fd \
    && ln -s "$(which batcat)" /usr/local/bin/bat \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ── micro editor (external prompt editing via Ctrl+G) ────────────────────────
# apt version is stale; install latest from GitHub releases instead.
RUN curl -fsSL https://getmic.ro | bash \
    && mv micro /usr/local/bin/micro
