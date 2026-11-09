---
name: code-review
description: 'Perform a thorough, uncompromising code review of the TypeScript sources and documentation of the xPack C/C++ Managed Build Tools VS Code extension. Use when the user asks for a "code review", to "review the code", to "review changes", or to check a file, folder, or diff for style, naming, documentation, and correctness issues.'
argument-hint: 'Optional: path or folder to review; defaults to src/'
---

# Code Review — xPack VS Code Extension

## When to Use

- The user asks for a code review of a file, folder, diff, or the whole
  extension.
- The user asks to check adherence to the project's coding standards
  before a commit or release.

## Review Scope

If the user specifies a path, review only that path. Otherwise review
`src/`, together with the parts of `package.json` and
`package.nls.json` that must stay consistent with it (see
"Contributions"). `tests/` holds sample workspaces for manual testing,
not test code; review only the `package.json` files there if they are
the subject of the change. Do not review `dist/`, `node_modules/`, or
`xpacks/`.

## Checklist

Review every item below. Do not soften findings; state flaws directly
and specifically, with file and line references.

### Naming and style

- Formatting matches `config/.prettierrc.json` (80 columns, no
  semicolons, single quotes, ES5 trailing commas); no line exceeds 80
  characters, including comments, except for URLs.
- Classes are `PascalCase`, functions, methods, and variables are
  `camelCase`; private members follow the convention already used in
  the file (leading underscore).
- File names are lower-case words separated by dashes
  (`data-model.ts`).
- Relative imports use the `.js` extension (ESM resolution).
- The `DataNode*` and `TreeItem*` classes mirror each other; flag a
  node type that exists in one hierarchy but not in the other without
  reason.

### Documentation (TSDoc)

- Every class, method, property, parameter, and return value has a
  TSDoc comment, including `private` and `protected` members.
- Comments use British English spelling ("behaviour", "colour",
  "initialise"), formal wording, no contractions, and the Oxford comma.
- If the code already has documentation, review it and improve it
  where it is vague, repeats the signature, or is out of date.
- The file header carries the xPack MIT licence block, with a
  plausible copyright year range, and an attribution when the file was
  inspired by Microsoft code (as in `commands.ts`).

### Architecture and conventions

- Feature classes implement `vscode.Disposable`, are created through a
  static `register(manager)` factory, and push themselves onto
  `manager.subscriptions`; flag resources (watchers, event
  subscriptions, status items) that are not disposed.
- Features subscribe to model changes via
  `manager.addCallbackRefresh()`; they do not rebuild the model.
- The `DataModel` remains independent of the tree view and of
  commands.
- Commands are registered with `this` as `thisArg`, with the
  `@typescript-eslint/unbound-method` suppression inline at the
  registration, and not wider.
- Logging goes through `manager.log`, at a level that suits the
  message; no `console.log`.
- Stateless helpers belong in `src/functions/utils.ts`.
- Dead code: `hover.ts`, `status-bar.ts`, and the cpptools provider
  registration are deliberately disabled (see `CLAUDE.md`); do not
  report their being unregistered as a defect, but do report new
  dead code.

### Contributions (`package.json`)

- Every command registered in the code has a `contributes.commands`
  entry, with the title as a `%key%` defined in `package.nls.json`, and
  vice versa.
- The `contextValue` of each `TreeItem*` matches the `when` clauses in
  `contributes.menus` (`view/item/context`).
- `commandPalette` visibility is deliberate for each command.
- `XpackTaskDefinition` in `src/core/definitions.ts` matches
  `contributes.taskDefinitions`.
- Settings read in the code (`xpack.*`) exist in
  `contributes.configuration`, with matching types and defaults. Do not
  review, and do not propose changes to, the obsolete
  `contributes.configuration.none` block.
- `engines.vscode` and the `@types/vscode` version are compatible, and
  the activation events are sufficient.

### Correctness and robustness

- Asynchronous code: missing `await`, floating promises, unhandled
  rejections, and callbacks that run after the extension was
  deactivated or after the model was replaced.
- Cancellation: long operations in `DataModel` honour the
  `CancellationToken`; a stale refresh must not overwrite a newer one.
- Behaviour on a workspace with no folders, several folders, nested
  packages, no `xpack` property, no actions, a malformed
  `package.json`, or an excluded path (`xpack.exclude`,
  `xpack.maxSearchDepthLevel`).
- Paths: Windows and POSIX separators, spaces in paths, and the
  normalisation done in `utils.ts`; no string concatenation of paths.
- Editing `package.json` (adding, duplicating, removing actions and
  configurations): the formatting, the key order, and the other
  properties of the file are preserved; the file is not overwritten
  with stale content.
- Writing `.vscode/c_cpp_properties.json`: existing user settings are
  preserved, and the file is not rewritten when the content does not
  change.
- File watchers: debouncing, and duplicate events.
- Type guards on parsed JSON instead of casts; no `any`, no
  non-null assertions without justification.
- Shell command construction for tasks and `xpm init`: quoting and
  injection through folder or action names.

### Tooling verification

Where feasible, verify by running rather than by reading only:

```sh
npm run compile
npm run lint
```

Report every error and warning. The ESLint configuration is
`strictTypeChecked` plus `stylisticTypeChecked`, so type-level issues
appear as lint errors. Do not edit `config/eslint.config.js`; it is
generated. Do not add inline `eslint-disable` comments to silence a
finding without a stated reason.

### Release hygiene

- If a change affects behaviour, check whether the `README.md` release
  notes and `CHANGELOG.md` need an entry (see
  `maintenance/docs/README-MAINTAINER.md`).
- There is no automated test suite. For a behavioural change, name the
  sample workspace under `tests/` and the launch configuration that
  should be used to verify it manually.

## Procedure

1. Identify the review scope.
2. Read the relevant files fully; do not review from partial context.
3. Go through the checklist section by section, collecting concrete
   findings (file, line, description, why it matters).
4. Run `npm run compile` and `npm run lint`, and include the results.
5. Explicitly note anything left out because you were not certain
   enough to include it.
6. Write the results to `maintenance/docs/CODE-REVIEW.md`, with a
   summary and specific, actionable recommendations grouped by
   checklist section.
7. Number the findings (`#1`, `#2`, ...) so that they can be referred
   to when asking for fixes.
8. Do not fix the issues unless the user asks for that separately.
