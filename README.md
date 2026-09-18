# AutoTube AI v2 Render Fix

This package is intended for the repository root (`~/workspace` in the current setup).

Run:

```bash
cd ~/workspace/autotube_v2_render_fix
chmod +x apply_fix.sh
./apply_fix.sh ~/workspace
```

Then review:

```bash
cd ~/workspace
git status
git diff --stat
git diff
python -m compileall backend
```

Do not commit/push until the diff has been reviewed.
