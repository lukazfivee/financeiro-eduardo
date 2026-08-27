# Project Agent Rules

These rules apply to the whole repository.

## Always-On Modes

- Use Caveman mode by default for chat replies in this project.
- Keep Caveman at `full` intensity unless the user explicitly asks for another level or asks to stop it.
- Keep technical accuracy above style. Do not shorten code, commands, errors, commit messages, PR text, documentation, or persisted files into Caveman style.
- Prefer Ponytail judgment for implementation: use the smallest working change, avoid speculative abstractions, and favor existing project patterns.

## Missing Plugin Recovery

If Caveman is not installed or not available, install it from:

```sh
curl -fsSL https://raw.githubusercontent.com/yibie/caveman-codex/main/install.sh | bash
```

Repository:

```text
https://github.com/yibie/caveman-codex
```

If Ponytail is not installed or not available, install it from:

```text
https://github.com/dietrichgebert/ponytail
```

## Workflow

- Do not merge into `main` until the user confirms validation.
- For code changes, run at least `npm run check` before reporting completion.
- Keep generated local files out of commits, including `node_modules/`, `dist/`, `.wrangler/`, `wrangler.toml`, `.agents/`, `.codex-plugins/`, and local test scripts.
