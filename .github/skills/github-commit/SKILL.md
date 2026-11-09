---
name: github-commit
description: 'Prepare and create a git commit in the xPack VS Code extension repository (xpack/vscode-xpack-extension-ts), following the project''s commit message conventions, and add the closing comment to the GitHub issue it fixes. Use when the user asks to "commit", "make a commit", "commit the fix", or to write a commit message for the current changes.'
argument-hint: 'Optional: the GitHub issue number (#N), and whether the commit completes the issue'
---

# Commit — xPack VS Code Extension

## When to Use

- The user asks to commit the current changes, or a subset of them.
- The user asks for a commit message for the staged or unstaged
  changes.

Never commit without explicit user approval of the file list and the
message.

## Procedure

1. **Inspect the working tree.** Run `git status` and `git diff` (and
   `git diff --cached` if anything is staged). Identify which changes
   belong to this commit; the working tree often has unrelated changes
   and untracked files (for example `.claude/`, `maintenance/`,
   `CLAUDE.md`), which must not be included unless the user says so.
2. **Identify the issue**, if any. Fixes of reported problems refer to
   a GitHub issue (`#55: ...`); maintenance commits (dependency bumps,
   re-formatting, release preparation) have none. If the user did not
   give a number and it cannot be determined with certainty from the
   conversation, ask; do not guess. If a fix has no issue, offer to
   create one with the `create-github-issue` skill.
3. **Verify the build.** Run `npm run compile` and `npm run lint`; both
   must pass. There is no automated test suite; if the change is
   behavioural, ask whether it was checked in an Extension Development
   Host (see `maintenance/docs/README-DEVELOPER.md`). Report failures;
   do not commit over them without explicit approval.
4. **Check consistency.** If a command, setting, menu, or task
   definition changed, `package.json` and `package.nls.json` must be
   updated in the same commit. Do not stage `dist/` or `.vsix` files
   (they are ignored).
5. **Draft the message** (see "Message Format") and write it to a file
   in the scratchpad folder.
6. **Show the user** the list of files and the full message, and wait
   for approval.
7. **Stage and commit** only the approved files, by name (no
   `git add -A` or `git add .`):

   ```sh
   git add <file> ...
   git commit -F <scratchpad>/commit-message.txt
   ```

   Do not amend, rebase, or skip hooks (`--no-verify`) unless asked.
   If a hook fails, fix the cause and create a new commit. Do not push
   unless asked.
8. **Report** the hash and subject, with
   `git log -1 --format='%h %s'`.
9. **Update the issue**, if the commit has `Fixes #N` (see "Issue
   Comment").

Do not start the next fix while this one is uncommitted.

## Message Format

### Subject

- With an issue: `#N: ` followed by a summary in the imperative mood,
  for example `#55: make activation more robust`; without an issue,
  the summary alone (`re-format`, `min vscode 1.125.0`).
- Follow the existing history: the summary starts in lower case, has
  no full stop, and is at most 50 characters including the `#N: `
  prefix.
- Describe the change, not the problem.
- Do not add type prefixes (`fix:`, `feat:`); this repository does not
  use Conventional Commits.

### Body

Optional for trivial changes; recommended for any fix. Separated from
the subject by a blank line, wrapped at 72 characters, in British
English, formal, with no contractions and with the Oxford comma.
Identifiers, files, and settings are written plainly. Explain what and
why, not how: the previous behaviour and why it was a problem, then the
change, then how it was verified (the sample workspace used).

### Trailers

After the body, separated by a blank line:

- `Fixes #N` — only on the commit that completes the issue.
- The attribution trailer required by the agent's environment, if any
  (for example `Co-Authored-By: ...`), copied exactly as given, as the
  last line.

### Release commits

Release commits are mechanical and follow
`maintenance/docs/README-MAINTAINER.md`:

- `prepare vX.Y.Z` — the `CHANGELOG.md` and `README.md` release notes
  update.
- `X.Y.Z` — the version bump made by `npm version`.

Do not create these unless the user is performing a release.

### Example

```text
#55: make activation more robust

The activation threw when a workspace folder had a package.json that
could not be parsed, which left the extension with no tree view and
no commands.

Catch the parsing errors in the data model, log them at the warning
level, and continue with the remaining packages.

Verified with the sample workspaces in tests/single-workspace and
tests/multi-workspace.

Fixes #55
```

## Issue Comment

After a commit with `Fixes #N`, add a comment to the issue, after the
commit is pushed (GitHub links a hash only then, and an amend changes
it):

```sh
gh issue comment <N> --repo xpack/vscode-xpack-extension-ts \
  --body-file <scratchpad>/issue-comment.md
```

- Start with `Fixed in <short hash>`, followed by a brief explanation
  of what was changed, what was deliberately not changed and why, and
  how it was verified.
- Write the hashes bare, without backticks, so that GitHub links them.
- If the proposal in the issue was not followed, say so and why.
- One line per paragraph, in Markdown, with backticks for identifiers.
- End with a separate line `Fixed on YYYY-MM-DD.`, from
  `git log -1 --format=%cs`.
- Do not close the issue; it is closed when the commit reaches the
  default branch.

Show the comment to the user before posting it, unless already
approved.

## CHANGELOG

`CHANGELOG.md` lists commits (`hash message`) by release date; it is
updated during release preparation (see
`maintenance/docs/README-MAINTAINER.md`), not in each commit. Do not
edit it as part of an ordinary commit.

## Branches

Work is committed on `development`. `master` receives merges at
release time only; never commit directly to it.
