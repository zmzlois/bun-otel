# 🔄 Workflow Architecture

This document explains how the three GitHub Actions workflows work together.

## 📊 Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DEVELOPMENT WORKFLOW                         │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  Developer       │
│  Makes Commits   │
│  (conventional)  │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│  Push to branch / Create PR                │
└────────┬───────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│          CI WORKFLOW (ci.yml)              │
│  ─────────────────────────────────────     │
│  Triggers: Push to main, Pull Requests    │
│                                            │
│  Steps:                                    │
│  ✓ Lint & format check                    │
│  ✓ Type checking                           │
│  ✓ Build package                           │
│  ✓ Run tests                               │
│  ✓ Upload artifacts                        │
└────────┬───────────────────────────────────┘
         │
         │ [PR Approved & Merged to main]
         ▼
┌────────────────────────────────────────────┐
│     Code is on main, ready for release    │
└────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                         RELEASE WORKFLOW                             │
└─────────────────────────────────────────────────────────────────────┘

         [Manual Trigger by Maintainer]
         │
         ▼
┌────────────────────────────────────────────┐
│   AUTOMATED RELEASE (release.yml)          │
│   ─────────────────────────────────────    │
│   Triggers: Manual workflow_dispatch       │
│                                            │
│   Inputs:                                  │
│   • Release type (auto/patch/minor/major)  │
│   • Dry run (preview only)                 │
│                                            │
│   Steps:                                   │
│   1. Analyze commits (conventional)        │
│   2. Determine version bump                │
│   3. Update package.json version           │
│   4. Generate/update CHANGELOG.md          │
│   5. Create git commit                     │
│   6. Create git tag (v0.0.2)              │
│   7. Push tag to GitHub                    │
└────────┬───────────────────────────────────┘
         │
         │ [Tag pushed to main]
         ▼
┌────────────────────────────────────────────┐
│   PUBLISH TO NPM (publish.yml)             │
│   ─────────────────────────────────────    │
│   Triggers: Tag push (v*.*.*)              │
│                                            │
│   Security Check:                          │
│   ✓ Verify tag is from main branch        │
│                                            │
│   Steps:                                   │
│   1. Build package                         │
│   2. Publish to npm (with provenance)      │
│   3. Generate release notes                │
│   4. Create GitHub release                 │
└────────────────────────────────────────────┘
```

## 🔍 Detailed Flow

### 1️⃣ CI Workflow (`ci.yml`)

**Purpose:** Continuous quality checks

```
Trigger: Push or Pull Request
         ↓
    Checkout Code
         ↓
    Setup Environment
         ↓
    ┌────────────────┐
    │ Lint & Format  │ ← Parallel
    └────────────────┘
         ↓
    ┌────────────────┐
    │ Type Check     │
    └────────────────┘
         ↓
    ┌────────────────┐
    │ Build Package  │ ← Verifies build works
    └────────────────┘
         ↓
    ┌────────────────┐
    │ Run Tests      │ ← Parallel with build
    └────────────────┘
         ↓
    ✅ All checks pass
```

**Key Features:**
- Runs on every push/PR
- Fast feedback (parallel jobs)
- Catches issues before merge
- No publishing or releasing

---

### 2️⃣ Release Workflow (`release.yml`)

**Purpose:** Version management and tagging

```
Manual Trigger (GitHub UI)
         ↓
    Choose: auto / patch / minor / major
         ↓
    Optional: Dry run mode
         ↓
    ┌──────────────────────────┐
    │ Analyze Commits          │
    │ (conventional commits)   │
    └──────────────────────────┘
         ↓
    ┌──────────────────────────┐
    │ Determine Version Bump   │
    │ feat: → minor            │
    │ fix:  → patch            │
    │ feat! → major            │
    └──────────────────────────┘
         ↓
    ┌──────────────────────────┐
    │ Update package.json      │
    │ version: "0.0.1" → "0.0.2"│
    └──────────────────────────┘
         ↓
    ┌──────────────────────────┐
    │ Generate CHANGELOG.md    │
    │ (using changelogen)      │
    └──────────────────────────┘
         ↓
    ┌──────────────────────────┐
    │ Git Commit & Tag         │
    │ git tag v0.0.2           │
    └──────────────────────────┘
         ↓
    ┌──────────────────────────┐
    │ Push to GitHub           │
    │ (triggers publish.yml)   │
    └──────────────────────────┘
```

**Key Features:**
- Manual control over releases
- Dry-run mode for preview
- Automatic version detection
- No npm publishing (yet!)
- Creates git tags

---

### 3️⃣ Publish Workflow (`publish.yml`)

**Purpose:** Package distribution

```
Triggered by: Tag push (v*.*.*)
         ↓
    ┌──────────────────────────┐
    │ Security: Verify tag     │
    │ is from main branch      │
    └──────────────────────────┘
         ↓
    ┌──────────────────────────┐
    │ Build Package            │
    │ (production build)       │
    └──────────────────────────┘
         ↓
    ┌──────────────────────────┐
    │ Publish to npm           │
    │ • With provenance        │
    │ • No token needed!       │
    └──────────────────────────┘
         ↓
    ┌──────────────────────────┐
    │ Generate Release Notes   │
    │ (using changelogen)      │
    └──────────────────────────┘
         ↓
    ┌──────────────────────────┐
    │ Create GitHub Release    │
    │ • Attach release notes   │
    │ • Link to npm package    │
    └──────────────────────────┘
         ↓
    ✅ Package Published!
    📦 npm.com/package/bun-otel
    🏷️ GitHub Release created
```

**Key Features:**
- Automatic (triggered by tags)
- npm provenance (secure)
- Only from main branch
- Creates GitHub releases
- No manual intervention

---

## 🔐 Security Features

### Branch Protection
```
┌─────────────────────────────────────┐
│  publish.yml                        │
│  ─────────────────────────────────  │
│  Step: Verify tag is on main       │
│                                     │
│  if ! git merge-base --is-ancestor; │
│    then EXIT 1                      │
│  fi                                 │
└─────────────────────────────────────┘
```

**Why?** Prevents accidental publishing from feature branches.

### npm Provenance
```
npm publish --provenance
```

**What it does:**
- Cryptographic proof of source
- Links package to GitHub repo
- Shows build environment
- Transparent supply chain

---

## 🎯 Use Cases

### Scenario 1: Regular Development

```
Developer → PR → CI runs → Merge → (no release yet)
```

**Workflow used:** `ci.yml` only

---

### Scenario 2: Creating a Release

```
Maintainer → Actions → Run "Automated Release"
         ↓
Choose "auto" + Run
         ↓
release.yml runs → Creates tag
         ↓
publish.yml auto-triggers → Publishes to npm
```

**Workflows used:** `release.yml` → `publish.yml`

---

### Scenario 3: Preview Release (Dry Run)

```
Maintainer → Actions → Run "Automated Release"
         ↓
Choose "auto" + Check "Dry run"
         ↓
release.yml runs → Shows preview → No changes made
```

**Workflow used:** `release.yml` (preview only)

---

## ⚙️ Workflow Comparison

| Feature | CI | Release | Publish |
|---------|----|---------| --------|
| **Trigger** | Auto (push/PR) | Manual | Auto (tag) |
| **Purpose** | Quality checks | Versioning | Distribution |
| **Builds** | ✅ | ✅ | ✅ |
| **Tests** | ✅ | ✅ | ❌ |
| **Version Bump** | ❌ | ✅ | ❌ |
| **Creates Tag** | ❌ | ✅ | ❌ |
| **Publishes npm** | ❌ | ❌ | ✅ |
| **GitHub Release** | ❌ | ❌ | ✅ |
| **Runs on** | Any branch | Main | Tag from main |

---

## 🚀 Quick Commands

```bash
# Trigger CI (automatic)
git push origin feature-branch

# Trigger Release (manual)
# Go to: Actions → Automated Release → Run workflow

# Trigger Publish (automatic)
git push origin v0.0.2  # After release.yml creates tag
```

---

## 🤔 Why Three Workflows?

### Single Workflow (❌ Not Recommended)
```
One workflow: Check → Version → Tag → Publish
Problem: No flexibility, no preview, all-or-nothing
```

### Two Workflows (✅ Our Approach)
```
CI:      Check quality (runs often)
Release: Prepare version (runs when needed)
Publish: Distribute package (runs after release)
```

**Benefits:**
✅ **Separation of concerns** - Each workflow has one job
✅ **Flexibility** - Can version without publishing
✅ **Safety** - Preview releases before publishing
✅ **Clarity** - Easy to understand what each does
✅ **Reliability** - Failures don't cascade

---

## 📚 Related Documentation

- [CHANGELOG_SETUP.md](CHANGELOG_SETUP.md) - Quick setup guide
- [.github/WORKFLOWS.md](.github/WORKFLOWS.md) - Detailed workflow docs
- [.github/CHANGELOG_QUICKREF.md](.github/CHANGELOG_QUICKREF.md) - Quick reference

---

**Questions?** Check the workflow files in `.github/workflows/`
