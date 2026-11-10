---
name: create-github-issue
description: 'Draft and open GitHub issues for bugs and enhancements in the xPack VS Code extension repository (xpack/vscode-xpack-extension-ts), following the project''s title, body, and label conventions. Use when the user asks to "add an issue", "open an issue", "file a bug", "create an enhancement", or to turn code-review findings into issues.'
argument-hint: 'Short description of the problem or improvement, or a list of findings; optionally the kind (bug or enhancement)'
---

# Create Issue — xPack VS Code Extension

## When to Use

- The user asks to add, open, create, or file a GitHub issue for a bug
  or an enhancement.
- The user asks to turn the findings of a review (for example
  `maintenance/docs/CODE-REVIEW.md`) into issues, one per finding.

Issues are opened in `xpack/vscode-xpack-extension-ts` with the `gh`
CLI, run from the repository root.

## Procedure

1. **Establish the facts.** Read the code the issue refers to, at the
   current `HEAD`, and record the files and the class, method, or
   setting names; line numbers are only a secondary pointer. Do not
   cite lines from memory. If the cited files have uncommitted changes,
   cite the committed version or say so.
2. **Reproduce, if it is a bug.** When practical, confirm the
   behaviour in an Extension Development Host with the relevant sample
   workspace under `tests/`, or with the log output (set
   `xpack.loggingLevel`), and keep the evidence to show the user. State
   what was observed and what was inferred. Record the VS Code version,
   the extension version, the operating system, and the xpm version
   when they matter.
3. **Check for duplicates:**

   ```sh
   gh issue list --repo xpack/vscode-xpack-extension-ts \
     --state all --limit 30 --search "<keywords>"
   ```

   If an issue already covers the problem, report it instead of
   creating a new one, and offer to comment on it.
4. **Choose the labels** (see "Labels").
5. **Draft the title and the body** (see "Title" and "Body"), and write
   the body to a file in the scratchpad folder.
6. **Show the draft** — title, labels, and full body — and wait for
   explicit approval. Opening an issue is a public action. For several
   issues, present all drafts together.
7. **Create the issue:**

   ```sh
   gh issue create --repo xpack/vscode-xpack-extension-ts \
     --title "<title>" \
     --label <label> [--label <label>] \
     --assignee @me \
     --milestone <version> \
     --body-file <scratchpad>/issue-body.md
   ```

   Milestones are named after the release version (for example
   `1.3.0`). List the open ones with
   `gh api repos/xpack/vscode-xpack-extension-ts/milestones` and
   propose the version milestone of the upcoming release in the draft.
   If none is open, ask which version to create; do not create it
   without approval. Do not use the generic `Next Release` milestone,
   which is kept empty as a placeholder; `Time Permitting` is assigned
   only by the maintainer.
8. **Report** the number and URL; for several issues, a table (number,
   title, labels).

## Labels

Use only the existing repository labels:

- `bug` — the extension behaves incorrectly: wrong or missing tree
  items, tasks that fail or run the wrong command, a broken
  `package.json` edit, an incorrect `c_cpp_properties.json`, crashes,
  activation failures, or behaviour that contradicts the README.
- `enhancement` — the extension works, but can be improved: new
  features, new settings, performance, refactoring, and documentation
  wording.
- `documentation` — only for a purely documentation issue (README,
  maintainer, or developer pages).
- Other labels (`question`, `help wanted`, `good first issue`,
  `duplicate`, `invalid`, `wontfix`) are applied by the maintainer; do
  not add them.

If the kind is uncertain, say so and ask.

## Title

- State the current problem, not the fix, in the present tense, as a
  full sentence: `The tree view does not refresh after a package.json
  edit in a sub-folder`.
- Capitalise the first word (unless it is an identifier in backticks);
  no full stop; under 70 characters.
- Do not prefix the kind (`Bug:`) or a number; the labels carry the
  kind.

## Body

Plain Markdown prose, short, in British English, formal, with no
contractions, with the Oxford comma, and lines wrapped at 72
characters. Use backticks for files, identifiers, settings, commands,
and commit hashes. Do not use headings or templates; give connected
sentences, in this order, only the parts the issue needs:

1. **Location.** The file and the class or method, for example
   `` `src/core/data-model.ts`, `DataModel.refresh()`: ``.
2. **Observation.** What happens, precisely: the sample workspace or
   the steps, the observed result, the expected result, the
   environment when relevant, and the cause if known. Mark estimates.
3. **Scope.** Only if it changes the decision: other platforms,
   workspace layouts, or VS Code versions affected.
4. **Proposed change.** In the imperative; when several solutions are
   possible, list them with the trade-offs.
5. **References**, if any: `Found while fixing #55.`

### Length

At most two paragraphs plus a reference line, normally no more than 12
lines. State the evidence in a clause; give full logs only when needed.
A simple finding is a single paragraph of two to four lines. Do not
describe work already done on the fix.

## Issues from Review Findings

- One issue per numbered finding; each issue is self-contained and does
  not cite the finding number (it would be confused with a GitHub
  number).
- Check the location, evidence, and proposal against the current
  `HEAD`, because the review may be older than the code.
- Check for duplicates for each finding.
- After creation, ask the user before recording the issue number in the
  review document.

## Example

Title: `The task for an npm script ignores the --prefix of a sub-folder`

Labels: `bug`

```markdown
`src/functions/utils.ts`, `createTask()`: for a package in a
sub-folder of the workspace, the generated command runs `npm run`
without `--prefix`, so it executes in the workspace root and fails with
"missing script" (sample workspace `tests/sub-folder-workspace`).
Pass the package folder as `--prefix`, quoted, as the xpm actions do.

Found while fixing #54.
```

(The example is hypothetical; it illustrates the format only.)

## After the Issue Is Fixed

The fix is committed with the `github-commit` skill, which also adds
the closing comment to the issue; the issue is not closed by hand.
