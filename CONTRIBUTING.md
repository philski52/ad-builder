# Contributing to Ad Builder

## Branch Strategy

We use **GitHub Flow** - a simple branching model for collaboration.

```
main (protected)
  └── feature/your-feature-name
```

## Workflow

### 1. Start New Work

```bash
# Make sure you're on main and up to date
git checkout main
git pull origin main

# Create a feature branch
git checkout -b feature/your-feature-name
```

**Branch naming conventions:**
- `feature/description` - New features (e.g., `feature/clicktags`, `feature/video-export`)
- `fix/description` - Bug fixes (e.g., `fix/isi-scroll-position`)
- `refactor/description` - Code refactoring

### 2. Work on Your Branch

```bash
# Make changes, then commit
git add .
git commit -m "Description of changes"

# Push to GitHub
git push origin feature/your-feature-name
```

Commit often. Small, focused commits are easier to review.

### 3. Create a Pull Request

When your feature is ready:

1. Push your latest changes
2. Go to GitHub or run: `gh pr create`
3. Fill in the PR description
4. Request a review (optional for small changes)

### 4. Merge

After review (if required):

1. Merge the PR on GitHub (use "Squash and merge" for cleaner history)
2. Delete the feature branch
3. Pull latest main locally:

```bash
git checkout main
git pull origin main
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `git checkout -b feature/name` | Create new branch |
| `git push -u origin feature/name` | Push branch to GitHub |
| `gh pr create` | Create pull request |
| `gh pr list` | List open PRs |
| `gh pr checkout 123` | Check out PR #123 locally |

## Current Branches

- `main` - Production-ready code (protected)
- `feature/clicktags` - Click zone and link type functionality (Philip)
- `feature/interstitials` - Interstitial ad functionality

## Questions?

Ask in the PR comments or reach out to the team.
