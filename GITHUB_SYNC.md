# Syncing the full BenchMate tree to GitHub

The Cursor cloud agent authenticated to **GitHub MCP** (file API) but **not** to `git push` / `gh` for `github.com`.

Origin (Cursor) already has the complete `main` branch including sample PNGs and the ~3 min demo video under `artifacts/`.

To force-push that full tree here:

```bash
# from a machine with the Cursor remote or a clone of this worktree:
git remote add github https://github.com/LuxologyGG/benchmate.git
git push -u github main --force
```

Or create a PAT with `repo` scope and:

```bash
git push https://<TOKEN>@github.com/LuxologyGG/benchmate.git main --force
```

Do **not** commit `uploads/`, `.env.local`, or any `meta_api_key*` file.
