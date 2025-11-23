# Git Hooks with Husky

This directory contains Git hooks managed by Husky.

## Pre-commit Hook

The pre-commit hook runs automatically before every commit and performs:

1. **Lint-staged** - Formats and lints only staged files
   - Prettier formatting for `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.md`, `.yml`
   - ESLint for code files

2. **Typecheck** - Runs TypeScript compiler to check for type errors
   - Checks entire codebase
   - Ensures type safety

3. **Tests** - Runs unit tests
   - Tests in `package/bun-otel`
   - Ensures no broken functionality

## Bypassing Hooks (Not Recommended)

If you absolutely need to bypass the pre-commit hook:

```bash
git commit --no-verify -m "your message"
```

⚠️ **Warning**: This should only be used in emergencies. CI will still run all checks.

## Setup

Hooks are automatically installed when you run:

```bash
bun install
```

This triggers the `prepare` script which runs `husky`.

## Manual Setup

If hooks aren't working:

```bash
# Reinstall hooks
bunx husky install

# Make hooks executable
chmod +x .husky/pre-commit
```

## What Gets Checked

### Formatting (via Prettier)

- Code style consistency
- Indentation, quotes, semicolons
- Line breaks and spacing

### Linting (via ESLint)

- Code quality issues
- Best practices
- Potential bugs

### Type Checking (via TypeScript)

- Type safety
- Interface compliance
- Type errors

### Tests (via Bun Test)

- Unit tests pass
- No regressions
- Core functionality works

## Benefits

✅ Catch issues before pushing  
✅ Maintain code quality  
✅ Prevent CI failures  
✅ Faster feedback loop  
✅ Consistent code style

## Troubleshooting

### "Permission denied" error

```bash
chmod +x .husky/pre-commit
```

### Hooks not running

```bash
# Reinstall
bunx husky install

# Check git config
git config core.hooksPath
# Should output: .husky
```

### Hook takes too long

The pre-commit hook only checks staged files for linting/formatting,
but runs full typecheck and tests. This is intentional to catch issues early.

If it's too slow, you can modify `.husky/pre-commit` to skip tests locally
(but remember CI will still run them).
