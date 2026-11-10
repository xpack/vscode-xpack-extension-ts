# Refresh performance after editing `package.json`

Status: cause identified; partly fixed (#58, #59); further changes
proposed below.

Analysis started on 2026-09-23 (extension version 1.2.4) and completed
on 2026-11-10 (VS Code 1.145.2, macOS, development version after 1.2.4,
`@xpack/xpm-lib` 5.0.0, Node.js 20.20.0 for the measurements outside
VS Code). The test project is `micro-test-plus-xpack.git/tests`, opened
as the workspace folder: one xpm package with 304 build configurations
(300 visible) and 2,587 actions.

## Symptom

After a `package.json` in the workspace is edited and saved, VS Code
appears unresponsive for several seconds.

In VS Code's Process Explorer, with the installed 1.2.4 extension, each
save keeps the `window` and `extension-host` processes above 100% CPU
for 18–20 s. The editor and the menus remain usable during that time,
so the window itself is not blocked; what stops responding are the
features served by the extension host (views, hovers, completions, and
save participants), which is shared by all extensions.

With the extension disabled, a save causes no load in `window` or
`extension-host`.

## Cause

The main cause is the `trace` logging level. At `trace`, one refresh of
the test project produced about 110,000 log lines, almost all from the
Liquid substitutions in `@xpack/xpm-lib`. Since #56, each line is sent
from the extension host to the Output channel in the window (and, in an
Extension Development Host, also to the debug console). Version 1.2.4
writes the lines with `console.log`; that these also reach the window
is inferred from the load seen on the `window` process, not verified.

In an Extension Development Host, one refresh took 65.7 s at `trace`
and about 2.4 s at `info`. The installed 1.2.4 extension used the same
user settings, so it presumably also ran at `trace`; its level was not
checked separately.

## Refresh sequence

1. `ExtensionManager.registerPackageJsonWatchers()`
   ([src/core/manager.ts](../../src/core/manager.ts)) watches
   `**/package.json` and calls `manager.refresh()` on every change,
   deletion, or creation. There is no debouncing.
2. `refresh()` cancels any in-flight `DataModel` candidates, creates a new
   `DataModel`, and awaits `createTree()`.
3. `DataModel.createTree()`
   ([src/core/data-model.ts](../../src/core/data-model.ts)) rescans every
   workspace folder up to `xpack.maxSearchDepthLevel` (2,283 folders for
   the test project, most of them under `build/`), rereads every
   `package.json`, and for each xpm package runs the full Liquid
   evaluation through `@xpack/xpm-lib`. It also creates one `vscode.Task`
   for each npm script, npm command, xpm action, and xpm command.
4. The refresh callbacks run in order: the task provider, the explorer,
   the commands, and IntelliSense, which updates
   `.vscode/c_cpp_properties.json` for every workspace-root project.
5. `setContext` shows or hides the explorer view; this is a round trip
   to the window.

## Measurements

### Inside VS Code

Measured in an Extension Development Host with temporary timing log
lines, one save of `package.json` at a time. Each save produced exactly
one watcher event and one refresh, with no overlapping refreshes.

| Phase | `trace` | `info` (6 saves) |
| --- | ---: | ---: |
| Evaluation of the package | 53,854 ms | 1,928–2,337 ms |
| `createTree()` (folder walk and evaluation) | 60,258 ms | 2,184–2,611 ms |
| Task provider, explorer, and commands callbacks | 1 ms each | 0–2 ms each |
| IntelliSense callback | 716 ms | 65–113 ms |
| `setContext` and the end of the refresh | about 4,700 ms | about 2 ms |
| **Total** | **65,711 ms** | **2,296–2,681 ms** |

At `trace`, `setContext` took about 4.7 s, presumably because the window
was still busy receiving log lines.

The `info` ranges exclude one outlier (evaluation 4,683 ms, IntelliSense
280 ms, total 5,851 ms), which was not investigated; competition for the
processor from `cpptools` is a possible explanation.

### Outside VS Code

The folder walk and the evaluation were reproduced in plain Node.js with
the script in the [appendix](#appendix-benchmark-script), at `info`:

| Project | Folders visited | Evaluation | Total | Longest block |
| --- | ---: | ---: | ---: | ---: |
| `micro-test-plus-xpack.git/tests` | 2,283 | 1,500–1,693 ms | 1,765–1,806 ms | 1,507–1,700 ms |

The longest block was measured with a 5 ms `setInterval`, recording the
largest gap between ticks. (`perf_hooks.monitorEventLoopDelay` reports
0 ms, because its timer never runs while the loop is blocked; do not use
it for this.) The folder walk itself costs about 0.1–0.3 s and does
real I/O, so it does not block.

In September, the evaluation of the same project was measured at about
650 ms at `info` and 1,130 ms at `trace` (with output to a terminal).
The difference has not been explained; the project or the conditions
may have changed in the meantime.

## Findings

### 1. Logging at `trace` level dominates (main cause)

See [Cause](#cause). At `trace`, xpm-lib logs every substitution step;
in VS Code each line becomes a message between processes. Even with
cheaper output, 110,000 lines per refresh is too many for a level that
users may enable to diagnose a problem.

The volume also reveals redundant work in xpm-lib: the trace log, which
covered one complete refresh and part of the next, recorded 3,933
`_LiquidPropertiesDrop` constructions and 1,772 evaluations of
`buildFolderRelativePathPosix`.

### 2. The evaluation blocks the extension host for about 2 s

The evaluation is `async` only in form. liquidjs `parseAndRender()` in
asynchronous mode performs no real I/O; it awaits only promises that
are already resolved, and those continue as microtasks. The event loop
is therefore never released, and the evaluation of a package runs as
one block of about 2 s at `info`.

Two details in `@xpack/xpm-lib` add to the cost:

- `LiquidEngine` is created with `cache: false`, so every template is
  parsed again each time.
- `LiquidPropertiesDrop.liquidMethodMissing()` renders a property's value
  again each time it is referenced, with no memoisation. When properties
  are nested, the same values are evaluated repeatedly.

### 3. `c_cpp_properties.json` was rewritten on every refresh (fixed)

The file was written on every refresh, even when its content did not
change, and each write made the C/C++ extension reload it (300
configurations). In addition, the `configurations` array was emptied
before the existing entries were searched, so properties added by hand
were lost. Fixed in #58: the file is written only when its content
changes, and existing entries are reused.

### 4. No debouncing of the `package.json` watcher (not significant here)

A single save produces a single refresh, so debouncing would not help in
the measured case. It may still matter when `xpm install` or another
tool touches many `package.json` files at once; this was not measured.

### 5. The C/C++ extension

`cpptools` (a separate native process) was seen at about 40% CPU for
about 30 s after a save with the extension disabled, and for several
minutes after an Extension Development Host started. Its load does not
block the window or the extension host. Whether it reacted to the save
or was still indexing after a restart of the extensions was not
established.

## Changes made

- #58 (`694e119`): write `c_cpp_properties.json` only when its content
  changes; keep the properties added by hand to matching entries; leave
  a file that cannot be parsed untouched.
- #59 (`839f0d0`): log at the `debug` level the total duration of each
  refresh and the evaluation time of each xpm package.

## Proposed changes

In order of value for effort:

1. **Yield to the event loop during the evaluation.** In `data-model.ts`,
   add `await setImmediate()` (from `node:timers/promises`) after each
   build configuration and each package. The total time stays the
   same, but the 2 s block is split into short slices, so the extension
   host remains responsive. Cancellation then also takes effect sooner.
2. **Make `trace` affordable.** Batch the Output channel writes (collect
   the lines and flush them on a timer), then measure again. If it is
   still too slow, either reduce the substitution tracing in xpm-lib or
   move it to a separate, more detailed level, or document that `trace`
   is expensive on large projects.
3. **Template caching and memoisation in `@xpack/xpm-lib`.** These reduce
   the total evaluation time, but belong to that project; open an issue
   there.
4. **Debounce the `package.json` watcher** (for example 300 ms), if a
   burst of change events is observed.
5. **Move the evaluation to a worker thread**, only if 1–3 are not
   sufficient. The worker would run the xpm-lib evaluation and return
   plain data (names, command arrays, `buildFolderRelativePath`). The
   `vscode.Task` objects would still be created on the main thread,
   because the `vscode` API is not available in workers. This requires a
   second esbuild entry point and a message protocol.
6. **Lazy evaluation** (for reference; not recommended). Evaluating the
   actions of a build configuration only when its tree node is expanded
   would work, because configurations are created `Collapsed`. However,
   the task provider, the build configuration picker, and IntelliSense
   all need the full model (IntelliSense needs `buildFolderRelativePath`
   for every configuration of the workspace-root projects), so they
   would have to force a full evaluation.

## How to measure

- Set `xpack.loggingLevel` to `debug`, restart the extension host, and
  save a `package.json`. The Output channel "xPack C/C++ Managed Build
  Tools" shows `Refresh completed in N ms` and, for each xpm package,
  `evaluated in N ms`.
- Use Help → Open Process Explorer to see which process is busy during
  a refresh.
- In VS Code 1.145.2 on macOS, the Running Extensions editor did not
  offer the extension host profiling button; use **Debug: Take
  Performance Profile** in a debug session instead.

## Appendix: benchmark script

The script walks the folders as `DataModel` does and evaluates each xpm
package. Run it from the repository root, so that `@xpack/xpm-lib` and
`@xpack/logger` are resolved from `node_modules`. The folder argument
must be an absolute path. Set `LVL` to change the logging level.

```sh
node walk.mjs /absolute/path/to/workspace/folder
LVL=trace node walk.mjs /absolute/path/to/workspace/folder
```

```js
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'

const require = createRequire(process.cwd() + '/package.json')
const xpmLib = await import(require.resolve('@xpack/xpm-lib'))
const { Logger } = await import(require.resolve('@xpack/logger'))

const log = new Logger({ level: process.env.LVL ?? 'info' })

// Measure the longest event-loop block as the largest gap between ticks.
let last = performance.now()
let maxGap = 0
const iv = setInterval(() => {
  const now = performance.now()
  maxGap = Math.max(maxGap, now - last)
  last = now
}, 5)

let nFolders = 0
let tEval = 0

async function walk(folderPath, depth) {
  nFolders++
  const pkg = new xpmLib.Package({ log, packageFolderPath: folderPath })
  const json = await pkg.readPackageDotJson()
  if (pkg.isNpmPackage() && pkg.isXpmPackage()) {
    const t = performance.now()
    const dm = new xpmLib.DataModel({ log, jsonPackage: json })
    await dm.actions.initialise()
    for (const n of dm.actions.names) {
      await dm.actions.get(n).initialise()
    }
    await dm.buildConfigurations.initialise()
    for (const c of dm.buildConfigurations.names) {
      if (
        dm.buildConfigurations.isHidden(c) ||
        !dm.buildConfigurations.hasJson(c)
      ) {
        continue
      }
      const bc = dm.buildConfigurations.get(c)
      await bc.initialise()
      await bc.actions.initialise()
      for (const a of bc.actions.names) {
        await bc.actions.get(a).initialise()
      }
    }
    tEval += performance.now() - t
  }
  if (depth <= 0) {
    return
  }
  const entries = await fs.readdir(folderPath, { withFileTypes: true })
  await Promise.all(
    entries
      .filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith('.') &&
          e.name !== 'node_modules' &&
          e.name !== 'xpacks'
      )
      .map((e) => walk(path.join(folderPath, e.name), depth - 1))
  )
}

const t0 = performance.now()
await walk(process.argv[2], 3)
const t1 = performance.now()

await new Promise((resolve) => setTimeout(resolve, 20))
clearInterval(iv)

console.log(
  `folders=${nFolders} total=${(t1 - t0).toFixed(0)}ms ` +
    `eval=${tEval.toFixed(0)}ms maxLoopBlock=${maxGap.toFixed(0)}ms`
)
```
