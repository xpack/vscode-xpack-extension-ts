# Refresh performance after editing `package.json`

Status: analysis only; no changes have been made yet.

Date of analysis: 2026-09-23 (extension version 1.2.4, `@xpack/xpm-lib` 5.0.0,
Node.js 20.20.0).

## Symptom

After a `package.json` in the workspace is edited and saved, VS Code
becomes unresponsive for several seconds.

The questions below are still open. The answers decide which of the
proposed changes are needed:

- Which `xpack.loggingLevel` is in use when the hang occurs (`trace` and
  `debug` are significantly more expensive than `info`)?
- Does the whole window freeze, including typing in the editor, or only
  extension-provided features (views, completions, hovers, saving)? The
  extension host is a separate process from the renderer, so blocking it
  cannot stop typing. If typing also freezes, the cause lies elsewhere and
  needs a separate investigation.

## Refresh sequence

1. `ExtensionManager.registerPackageJsonWatchers()`
   ([src/core/manager.ts](../src/core/manager.ts)) watches `**/package.json`
   and calls `manager.refresh()` on every change, deletion, or creation.
   There is no debouncing.
2. `refresh()` cancels any in-flight `DataModel` candidates, creates a new
   `DataModel`, and awaits `createTree()`.
3. `DataModel.createTree()` ([src/core/data-model.ts](../src/core/data-model.ts))
   rescans every workspace folder, rereads every `package.json`, and for each
   xpm package runs the full Liquid evaluation through `@xpack/xpm-lib`:
   `actions.initialise()`, `buildConfigurations.initialise()`, and
   `initialise()` for each build configuration and each action. It also
   creates one `vscode.Task` for each npm script, npm command, xpm action,
   and xpm command.
4. The refresh callbacks run in order: the task provider, the explorer
   (which rebuilds the whole view tree on the next `getChildren()`), and
   IntelliSense, which rewrites `.vscode/c_cpp_properties.json` for every
   workspace-root project.

## Measurements

The xpm-lib evaluation was reproduced outside VS Code with the script in
the [appendix](#appendix-benchmark-script). The longest event-loop block
was measured with a 5 ms `setInterval` and recording the largest gap
between ticks. (`perf_hooks.monitorEventLoopDelay` reported 0 ms, because
its timer never ran while the loop was blocked; do not use it for this.)

| Project | Build configurations | Actions | Evaluation time | Longest block |
| --- | ---: | ---: | ---: | ---: |
| `tests/inherit-workspace` (this repository) | 20 | 118 | ~110 ms | ~11 ms |
| `micro-os-plus-iii.git/tests` | 44 | 303 | ~100 ms | (not measured) |
| `micro-os-plus-iv-suite.git/core/utils-lists-xpack/tests` | 216 | 1,447 | ~300 ms | (not measured) |
| `xPacks/utils-lists-xpack.git/tests` | 250 | 2,076 | ~560 ms | (not measured) |
| `xPacks/micro-test-plus-xpack.git/tests`, level `info` | 304 | 2,587 | ~650 ms | ~670 ms |
| `xPacks/micro-test-plus-xpack.git/tests`, level `trace` | 304 | 2,587 | ~1,130 ms | ~1,130 ms |

At level `trace`, a single evaluation of `micro-test-plus-xpack.git/tests`
produced 80,911 log lines.

The existing
`micro-test-plus-xpack.git/.vscode/c_cpp_properties.json` contains 304
configurations.

## Findings

### 1. Liquid evaluation blocks the extension host

The evaluation is `async` only in form. liquidjs `parseAndRender()` in
asynchronous mode performs no real I/O. It awaits only promises that are
already resolved, and those continue as microtasks. The event loop is
therefore never released, and the whole evaluation runs as one block.
Once the folder walk (which does real `readdir` I/O) reaches a package,
that package's evaluation blocks the extension host from beginning to end.

The extension host is shared by all extensions, so while it is blocked,
completions, hovers, views, and save participants (such as format-on-save)
do not respond.

Two further details in `@xpack/xpm-lib` add to the cost. They are noted
for later, not as changes to make now:

- `LiquidEngine` is created with `cache: false`, so every template is
  parsed again each time.
- `LiquidPropertiesDrop.liquidMethodMissing()` renders a property's value
  again each time it is referenced, with no memoisation. When properties
  are nested, the same values are evaluated repeatedly.

### 2. `c_cpp_properties.json` is rewritten on every refresh

`IntelliSense.updateWorkspaceProjectCCppProperties()`
([src/core/intellisense.ts](../src/core/intellisense.ts)) always writes
the file when at least one configuration exists, even if the content has
not changed. Each write makes the C/C++ extension reload the file and
recheck the `compile_commands.json` of every configuration (304 in
`micro-test-plus-xpack.git`). Part of that work also runs in the extension
host.

This is likely to be a large part of the observed delay, but it has not
been measured inside VS Code.

### 3. Existing `c_cpp_properties.json` settings are discarded (defect)

In the same method, `json.configurations = []` runs before
`updateCompileCommandsReferences()`. `prepareCCppPropertiesConfiguration()`
therefore always searches an empty array and never finds an existing
configuration. Any properties added by hand to a configuration are lost
on every refresh. The comment "If it does not exist, add an empty array"
does not describe what the code does.

### 4. Logging cost at `trace` level

At level `trace`, xpm-lib logs every substitution step. In VS Code the
output goes to an output channel, which is considerably more expensive
than a terminal. This roughly doubles the evaluation time even in plain
Node.js.

### 5. No debouncing of the `package.json` watcher

Several saves in quick succession, or `xpm install` touching many
`package.json` files under `xpacks/`, each start a new refresh. Earlier
candidates are cancelled, but cancellation is checked only between steps,
so work in progress still runs up to the next check.

### 6. Task creation (not measured)

About 2,600 `vscode.Task` objects are created on each refresh for the
largest project. This cannot be measured outside VS Code.

## Proposed changes

In order of value for effort:

1. **Write `c_cpp_properties.json` only when the content changes.**
   Compare the newly serialised text with the existing file content, and
   skip the write if they are identical. Fix the defect in finding 3 at
   the same time: keep the existing `configurations` array, update the
   entries in place, and remove only the entries that no longer
   correspond to a build configuration. Decide how to treat entries the
   user created by hand that do not match any build configuration.
2. **Yield to the event loop during the scan.** In `data-model.ts`, add
   `await setImmediate()` (from `node:timers/promises`) after each build
   configuration, each top-level action loop, and each package. The total
   time stays the same, but it is split into short slices, so the
   extension host remains responsive. Cancellation then also takes effect
   sooner.
3. **Debounce the `package.json` watcher** (for example 300 ms), so a burst
   of change events triggers a single refresh.
4. **Move the evaluation to a worker thread**, only if 1–3 are not
   sufficient. The worker would run the xpm-lib evaluation and return
   plain data (names, command arrays, `buildFolderRelativePath`). The
   `vscode.Task` objects would still be created on the main thread,
   because the `vscode` API is not available in workers. This requires a
   second esbuild entry point and a message protocol.
5. **Lazy evaluation** (for reference; discussed earlier and not
   recommended as the first step). Evaluating the actions of a build
   configuration only when its tree node is expanded would work, because
   configurations are created `Collapsed`. However, the task provider,
   the build configuration picker, and IntelliSense all need the full
   model (IntelliSense needs `buildFolderRelativePath` for every
   configuration of the workspace-root projects), so they would have to
   force a full evaluation. Packages are created `Expanded`, so making
   package-level evaluation lazy gains nothing unless that default is
   changed.

Possible changes in `@xpack/xpm-lib` (template caching, memoising
property values) would reduce the total time, but they belong to that
project.

## Verification plan

- Add `log.debug` timing around the phases of `ExtensionManager.refresh()`:
  folder walk and JSON parsing, Liquid evaluation, task creation, and each
  refresh callback. Then open `micro-test-plus-xpack.git` in an Extension
  Development Host and confirm where the time goes before and after each
  change.
- Check extension host responsiveness during a refresh, for example by
  triggering completions or hovers while saving `tests/package.json`.
- Confirm that `c_cpp_properties.json` is left untouched when a save does
  not change any build configuration.

## Appendix: benchmark script

Run it from the repository root, so that `@xpack/xpm-lib` and
`@xpack/logger` are resolved from `node_modules`. The folder argument
must be an absolute path. Set `LVL` to change the logging level.

```sh
node bench.mjs /absolute/path/to/package/folder
LVL=trace node bench.mjs /absolute/path/to/package/folder
```

```js
import { createRequire } from 'node:module'

const require = createRequire(process.cwd() + '/package.json')
const xpmLib = await import(require.resolve('@xpack/xpm-lib'))
const { Logger } = await import(require.resolve('@xpack/logger'))

const log = new Logger({ level: process.env.LVL ?? 'info' })
const folder = process.argv[2]

// Measure the longest event-loop block as the largest gap between ticks.
let last = performance.now()
let maxGap = 0
const iv = setInterval(() => {
  const now = performance.now()
  maxGap = Math.max(maxGap, now - last)
  last = now
}, 5)

const t0 = performance.now()
const pkg = new xpmLib.Package({ log, packageFolderPath: folder })
const json = await pkg.readPackageDotJson()
const dm = new xpmLib.DataModel({ log, jsonPackage: json })

let nConf = 0
let nAct = 0
await dm.actions.initialise()
for (const n of dm.actions.names) {
  await dm.actions.get(n).initialise()
  nAct++
}
const t1 = performance.now()

await dm.buildConfigurations.initialise()
for (const c of dm.buildConfigurations.names) {
  if (dm.buildConfigurations.isHidden(c) || !dm.buildConfigurations.hasJson(c)) {
    continue
  }
  const bc = dm.buildConfigurations.get(c)
  await bc.initialise()
  nConf++
  await bc.actions.initialise()
  for (const a of bc.actions.names) {
    await bc.actions.get(a).initialise()
    nAct++
  }
}
const t2 = performance.now()

await new Promise((resolve) => setTimeout(resolve, 20))
clearInterval(iv)

console.log(
  `${folder}: configs=${nConf} actions=${nAct} ` +
    `top=${(t1 - t0).toFixed(0)}ms configs=${(t2 - t1).toFixed(0)}ms ` +
    `maxLoopBlock=${maxGap.toFixed(0)}ms`
)
```
