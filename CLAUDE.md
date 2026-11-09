# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@.github/copilot-instructions.md

## Project Overview

The **xPack C/C++ Managed Build Tools** Visual Studio Code extension
(`ilg-vscode.xpack` on the Marketplace), written in TypeScript. It
discovers xPack/npm packages (`package.json` files) in the workspace,
presents their npm scripts and xpm actions/build configurations in an
Explorer tree view, runs them as VS Code tasks, and keeps the C/C++
extension's IntelliSense configuration in sync with the
`compile_commands.json` files produced by each build configuration.

The extension is published as an ES module (`"type": "module"`), bundled
by esbuild into a single `dist/extension.js` file. It depends on
`ms-vscode.cpptools` (declared in `extensionDependencies`).

## Commands

```sh
npm install              # install dependencies
npm run compile          # type-check (tsc --noEmit) and bundle with esbuild
npm run compile-watch    # esbuild in watch mode (the default VS Code build task)
npm run check-types      # type-check only
npm run lint             # ESLint (config/eslint.config.js) on src
npm run fix              # ESLint with --fix
npm run prettier         # format src with config/.prettierrc.json
npm run fix-compile      # prettier + fix + compile
npm run package          # production (minified, no source map) bundle
npm run vsce-package     # build the .vsix locally
```

There are no automated tests; `npm test` is a placeholder that only
prints a message. Verification is done by launching an Extension
Development Host from `.vscode/launch.json` (for example
"Run Extension Single Folder" or "Run Extension Multi Folders"), which
opens one of the sample projects under `tests/`. Several launch
configurations reference absolute paths on the maintainer's machine and
will not work elsewhere.

Always run `npm run compile` and `npm run lint` after changes; the lint
configuration is `strictTypeChecked` plus `stylisticTypeChecked`, so
type-level issues are reported as lint errors.

## Architecture

Entry point: [src/extension.ts](src/extension.ts). `activate()` creates
an `ExtensionManager`, registers the file-system watchers, then calls the
static `register(manager)` factory of each feature class, and finally
triggers `manager.refresh()`.

- [src/core/manager.ts](src/core/manager.ts) — `ExtensionManager`, the
  central object shared by all features. It owns the current `DataModel`,
  the logger, the `vscode.ExtensionContext`, and the list of refresh
  callbacks. Feature classes subscribe via `manager.addCallbackRefresh()`;
  `refresh()` builds a new `DataModel`, cancels any previous in-flight
  candidates (via `CancellationTokenSource`), and when complete swaps it
  in and invokes all callbacks. It also watches `package.json` files and
  workspace-folder changes, and optionally appends `**/xpacks/**` to the
  `npm.exclude` setting.
- [src/core/data-model.ts](src/core/data-model.ts) — `DataModel` and the
  `DataNode*` hierarchy (workspace folder → package → configuration →
  runnable: xpm action, xpm command, npm script, npm command). It
  recursively searches for `package.json` files (bounded by
  `xpack.maxSearchDepthLevel` and `xpack.exclude`), parses them through
  `@xpack/xpm-lib`, and creates the corresponding `vscode.Task` objects.
  The model is independent of the tree view.
- [src/core/explorer.ts](src/core/explorer.ts) — the `xPackActions`
  tree view. `TreeItem*` classes mirror the `DataNode*` classes; the
  `contextValue` of each item (`package`, `configuration`, `npmScript`,
  `xpmAction`, and so on) drives the `view/item/context` menus in
  `package.json`.
- [src/core/commands.ts](src/core/commands.ts) — implementation of all
  `xpack.*` commands: running/copying scripts and actions, adding,
  duplicating, and removing configurations and actions (by editing
  `package.json`), and the project creation commands (which invoke
  `xpm init` with templates).
- [src/core/tasks.ts](src/core/tasks.ts) — the `xPack` task provider;
  the task definition shape is `XpackTaskDefinition` in
  [src/core/definitions.ts](src/core/definitions.ts) and must match
  `contributes.taskDefinitions` in `package.json`.
- [src/core/intellisense.ts](src/core/intellisense.ts) — writes
  `.vscode/c_cpp_properties.json` for each workspace project, with one
  configuration per xpm build configuration pointing at its
  `compile_commands.json`, and watches those files. The
  `XpackCppConfigurationProvider` (custom configuration provider via
  `vscode-cpptools`) exists but its registration (`_register()`) is
  currently disabled.
- [src/core/hover.ts](src/core/hover.ts) and
  [src/core/status-bar.ts](src/core/status-bar.ts) — present but not
  registered (commented out in `extension.ts`).
- [src/functions/utils.ts](src/functions/utils.ts) — stateless helpers
  (path normalisation, task creation, JSON type guards, exclusion
  pattern matching).
- [src/index.d.ts](src/index.d.ts) — ambient type declarations for
  `@xpack/logger`, which ships without TypeScript types.

### Conventions

- Feature classes implement `vscode.Disposable`, are created through a
  static `register(manager)` factory, and push themselves onto
  `manager.subscriptions`.
- Commands are registered with `this` as the `thisArg`; the
  `@typescript-eslint/unbound-method` rule is suppressed inline at each
  registration.
- Relative imports use the `.js` extension (ESM resolution).
- Logging goes through the shared `Logger` (`manager.log`); the level is
  taken from the `xpack.loggingLevel` setting at activation.
- User-visible strings for contributions live in `package.nls.json` and
  are referenced as `%key%` from `package.json`.
- `contributes` in `package.json` (commands, menus, settings, task
  definitions) must be kept consistent with the TypeScript code. The
  active settings are in `contributes.configuration`. The
  `contributes.configuration.none` block is not a recognised
  contribution point: it is an obsolete copy of earlier settings, none
  of which are read by the code, kept temporarily for historical
  reference. Do not edit, extend, or remove it unless explicitly asked.

### Build Notes

- esbuild ([esbuild.js](esbuild.js)) bundles to ESM for Node 20 and
  marks `vscode` as external. A banner injects a `require` created with
  `createRequire`, because bundled CommonJS dependencies call
  `require()` for Node built-ins; do not remove it.
- `tsc` is used only for type checking (`--noEmit`); it does not produce
  the shipped output.

## Repository Layout

- `src/` — TypeScript sources of the extension.
- `tests/` — sample workspaces (single folder, multi-root, sub-folder,
  inherited configurations, no actions) used for manual testing through
  the launch configurations; they are not automated tests.
- `config/` — shared ESLint, Prettier, and TypeScript configuration
  (`eslint.config.js` is generated from `npm-packages-helper`
  templates; do not edit it by hand).
- `assets/` — Marketplace icon and README images.
- `maintenance/docs/` — `README-DEVELOPER.md`, `README-MAINTAINER.md`
  (development and release procedures), and analysis notes.
- `.github/skills/` — project skills: `code-review`,
  `consistency-check`, `create-github-issue`, `github-commit`.

## Branches

Development takes place on `development`; releases are merged into
`master` and published with `vsce` (`--githubBranch master`).
