---
name: consistency-check
description: 'Check the consistency of the xPack VS Code extension project: package.json contributions versus the TypeScript code, file and folder names, the sample workspaces, the build and lint configuration, and whether the READMEs, CLAUDE.md, and the instruction files are up to date. Report the problems found, each with a permanent number. Use when the user asks for a "consistency check", to "check the consistency", or to find stale names, stale READMEs, or mismatched contributions.'
argument-hint: 'Optional: folder to check; defaults to the whole project'
---

# Consistency Check — xPack VS Code Extension

## When to Use

- The user asks for a consistency check of the project, or of a part
  of it.
- After renaming or moving files, commands, settings, or views, to
  find the places left behind.
- Before a release, to find stale documentation.

This skill reports problems; it does not fix them unless the user asks
for that separately (for example "fix #4").

## Scope

If the user specifies a folder, check only that folder. Otherwise check
the whole project, excluding `node_modules/`, `dist/`, `xpacks/`,
`*.vsix` files, and `.git/`.

State the scope and the commit (`git rev-parse --short HEAD`) at the
top of the report.

## Generated and Special Files

- `config/eslint.config.js` is generated from `npm-packages-helper`
  templates; report problems in it, but name the template as the place
  to fix, never edit it by hand.
- `contributes.configuration.none` in `package.json` is an obsolete
  copy of earlier settings kept deliberately; do not report it as a
  problem and do not propose changes to it.
- `hover.ts`, `status-bar.ts`, and the cpptools provider registration
  are deliberately disabled (see `CLAUDE.md`); verify that
  `CLAUDE.md` still describes them correctly, but do not report them
  as stale code.

## Checks

Read the files; do not rely on names alone. For every claim in a
README or instruction file, verify it against the project (the file
exists, the command or script exists, the setting exists, the version
is still used).

### 1. Functional consistency

- **Commands:** every `xpack.*` command registered in `src/` has a
  `contributes.commands` entry in `package.json`, and vice versa; the
  titles use `%key%` placeholders that exist in `package.nls.json`;
  every key in `package.nls.json` is used.
- **Menus:** the `view/item/context`, `view/title`, and
  `commandPalette` entries refer to existing commands, and the `when`
  clauses use `contextValue` values that the `TreeItem*` classes in
  `src/core/explorer.ts` actually set.
- **Settings:** every `xpack.*` setting read in the code exists in
  `contributes.configuration`, with the same type and default; every
  contributed setting is read somewhere (except the deliberately kept
  `none` block).
- **Tasks:** `XpackTaskDefinition` in `src/core/definitions.ts` matches
  `contributes.taskDefinitions`.
- **Views and activation:** view identifiers, view containers, and
  activation events match the code.
- **Dependencies:** `extensionDependencies`, `engines.vscode`,
  `@types/vscode`, and `@types/node` are mutually compatible, and
  `esbuild.js` targets the Node version of the supported VS Code.
  Imports in `src/` correspond to declared dependencies.
- **Build and lint:** `npm run compile` and `npm run lint` pass; the
  scripts in `package.json` that are referred to by the documentation
  exist; `tsconfig*.json` and `config/` agree on the included folders.
- **Editor configuration:** `.vscode/launch.json` and
  `.vscode/tasks.json` refer to existing paths, tasks, and sample
  workspaces (some launch configurations are known to use absolute
  paths on the maintainer's machine; report them once as a single
  item).
- **Packaging:** `.vscodeignore` excludes the development files
  (sources, `tests/`, `maintenance/`, `CLAUDE.md`, `.claude/`,
  `config/`) and keeps what the extension needs; check with
  `npx vsce ls` where practical.
- **Sample workspaces** under `tests/`: each is referred to by a
  launch configuration or by the documentation; their `package.json`
  files are valid and still exercise the case their folder name
  states (inherited configurations, no actions, multi-root,
  sub-folder).

### 2. Documentation

Stale or incorrect content in:

- `README.md` (features, settings table, screenshots in `assets/`,
  release notes, version numbers);
- `CLAUDE.md`, `.github/copilot-instructions.md`, and the skills in
  `.github/skills/`;
- `maintenance/docs/` (`README-DEVELOPER.md`, `README-MAINTAINER.md`,
  and the analysis notes);
- `CHANGELOG.md` (releases and dates in order; hashes that exist);
- `package.json` metadata (`description`, `repository`, `bugs`,
  `homepage`, `keywords`, `categories`).

Look for: commands, settings, and scripts that do not exist; paths and
files that were moved (for example the READMEs, which moved from the
root to `maintenance/docs/`, while `CLAUDE.md`'s layout section and
`.vscodeignore` may still refer to the root); obsolete versions;
broken links; references to other projects (copy-paste leftovers, such
as C++ or µTest++ wording in skills); the British English rules from
the instructions; typos.

### 3. Names

- Source file names are lower-case words separated by dashes, and
  match their content; the file header comment matches the file.
- Class names match their file (`ExtensionManager` in `manager.ts`).
- Command identifiers, setting names, view identifiers, and
  context values follow one naming pattern (`xpack.camelCase`).
- Terminology is consistent in code, settings, and documentation
  (action, build configuration, package, project; "folder", not
  "directory").
- Stray, duplicated, or unused files (for example `.vsix` files in the
  root, copies in the wrong folder, unused exports).

### 4. Verified as consistent

Record the areas checked and found consistent, so that the next check
knows what was covered.

## Numbering

Every problem gets a permanent number, `#1`, `#2`, and so on, counting
through the whole report, in the order of the sections above.

- Each problem is a separate item; several occurrences of the same
  problem are one item.
- Numbers never change once assigned. If the report already exists,
  read it first: keep the numbers, mark fixed items `(fixed)` with a
  one-line note, keep open items, and number new problems after the
  highest existing number. Never reuse a number.
- A problem found to be wrong is marked `(withdrawn)` with the reason;
  it is not deleted.
- When the user refers to a number, act on that item and update its
  status in the report.

## Report

Write the report to `maintenance/docs/CONSISTENCY-CHECK.md`, in British
English and a formal tone, with lines shorter than 80 characters:

```markdown
# Consistency check

Date: <date>, on branch `<branch>`, commit `<hash>`.

Scope: <scope and exclusions>.

Summary: <n> problems (<open> open, <fixed> fixed, <withdrawn>
withdrawn): <counts per section>.

## 1. Functional consistency

- **#1 — <short title>.** <description, with file and line references,
  why it matters, and what is expected>

## 2. Documentation

- **#2 — <short title>.** <description>

## 3. Names

- **#3 — <short title>.** <description>

## 4. Verified as consistent

- <area checked and found consistent>

## 5. Proposed next steps

- <grouped, actionable steps, referring to the problem numbers>
```

Each item states the problem directly: the file, the line or setting,
what is wrong, and what is expected. When unsure whether something is
deliberate, say so in the item and ask in the summary rather than
guessing.

## Procedure

1. Determine the scope; read the existing report, if any.
2. List the files in scope; read `package.json`, `package.nls.json`,
   the READMEs, the instruction files, and the skills fully.
3. Go through the checks section by section, verifying each finding in
   the files.
4. Number the findings and write the report.
5. Give the user a short summary: the counts, the most serious
   problems by number, and the questions that need a decision.
6. Do not fix anything unless asked.
