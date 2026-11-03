# Syncing to https://github.com/LuxologyGG/benchmate

The cloud agent can use **GitHub MCP** (REST file commits) but does **not** have `git push` / `gh` credentials for github.com.

- Cursor `origin` remote already has the complete `main` branch (samples + demo video).
- Public GitHub currently has a partial bootstrap via MCP.

### One-command full sync (recommended)

```bash
export GITHUB_TOKEN=ghp_xxx   # repo scope; never commit this
./scripts/push-to-github.sh
```

Or with SSH configured for LuxologyGG:

```bash
git remote add github git@github.com:LuxologyGG/benchmate.git
git push -u github main --force
```
