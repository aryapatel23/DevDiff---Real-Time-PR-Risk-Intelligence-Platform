# DevDiff CLI

Pre-commit guard that catches bugs before they reach the PR.

## Install

```bash
npm link
```

Run from the `cli` folder.

## Usage

```bash
# Install pre-commit hook
devdiff init

# Manually scan staged changes
devdiff check

# JSON output
devdiff check --json

# Help
devdiff help

# Include tests in scan (off by default)
devdiff check --json --include-tests

# Include seed/demo fixtures in scan (off by default)
devdiff check --json --include-seed
```

## Notes

- `devdiff init` appends DevDiff to an existing pre-commit hook (does not clobber existing hook logic).
- `devdiff check` exits with code `1` if critical findings are present, otherwise `0`.
- Default pre-commit scope ignores `tests/**` and `backend/db/seed.js` to reduce fixture/test false positives.
