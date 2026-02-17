# Change & release log

Releases in reverse chronological order.

Please check
[GitHub](https://github.com/xpack/vscode-xpack-extension-ts/issues/)
and close existing issues and pull requests.

## 2026-02-17

* v1.2.0 prepared
* c109622 package*.json: bump deps
* c643421 pass logger to task creation
* 76d96dd Revert "data-model.ts: specific taskDefinition type"
* 4669987 package.nls.json update scriptName
* 0ddc747 launch.json update
* 87953d0 data-model.ts: specific taskDefinition type
* bc9e71f package.json: add scriptName to taskDefinitions
* 9491d18 update for xpm-lib

## 2026-01-19qqq

* 3267b02 launch.json update

## 2026-01-14

* efc7366 data-model.ts update for buildFolderRelativePath
* 6e8830c prepare 1.2.0
* 6ea1de6 copyright notices updates
* 35bbe0d rename src/core src/functions
* 54cef4d launch.json updates
* 16bd8a3 package.json cosmetics; move prettierrc outside
* 773d29e update for new lib

## 2025-12-29

* 1a2342c update for separate commands, xpm-lib

## 2025-12-18

* f37b9b3 use external XpmPackage
* fce7deb late actions.initialise()
* e482e0c rework constructors trace
* 3980944 data-models.ts with explicit initialise()

## 2025-12-17

* 2ae801c data-model.ts update for async inits
* 39af299 xpack.exclude tests

## 2025-12-09

* 8176281 data-model.ts: fix getBuildFolderRelativePath
* 791b50e eslint fixes
* bc095fa rework with object params, no XpmLiquid

## 2025-12-08

* 87af447 package.nls.json update
* 9167570 pacakge.json add npm-link-deps
* a95e267 package*.json bump deps

## 2025-12-05

* 523cf02 data-model.ts update for liquid actions

## 2025-12-02

* 49f6454 move definitions to xpm-liquid

## 2025-11-12

* 1682506 README update


## 2025-11-11

## 2025-11-11

* a1793a2 1.1.0
* 28afb6e 1.0.2
* e590c50 package*.json update
* 5ff0fdb READMEs update
* 18d5549 prepare v1.1.0
* 2e49df9 intellisense.ts silence eslint
* 128d891 re-work commands
* 1936850 launch.json add xpack-dev-tools workspace
* 0ba70ad #50: show npm scripts in the xpack tree

## 2025-11-10

* 1f4f432 package*.json bump deps
* e4d2a97 tests add empty settings.json
* 3906a36 cosmetics
* 6a32a94 change xpm actions icon to tools
* d51a0c1 #49: show folders in xpm actions tree
* 8cbbdb5 update READMEs for development
* 1cb8444 Revert "add development branch"
* f59879f add development branch

## 2025-08-12

## 2025-08-12

* a806e6a 1.0.1
* e8bcbd0 prepare 1.0.1
* d72cb7c 1.0.0
* 8e20046 prepare 1.0.0
* 29bd5e1 package.json remove files

## 2025-08-11

* 5c9784c eslint fixes
* a79cf8c update for node modules, no webpack
* 2fe68fa README rephrase
* fb782a3 package.nls.json rename xpm actions

## 2024-10-04

* 63f8deb update makeDirectory from make-dir
* 95f8fa1 bump deps for 1.94

## 2023-06-20

* 12d8245 0.5.2
* 5d97378 package.json: engine 1.86.0
* 26e85e1 prepare v0.5.2
* 7399852 #41: use LF including on Windows
* 61e4507 package.json: bump deps
* cce8ff7 0.5.1
* e134d0e prepare 0.5.1
* d764b64 README-DEVELOPER update
* 9de2ab5 .vscode/launch.json: add sourceMaps
* 25575be #45: update cpp_properties for sub-packages

## 2023-06-16

* 77da505 0.5.0 actually
* ad1c130 0.5.0
* c11c2c9 package.json: engines.vscode 1.79.1
* fff0706 prepare v0.5.1
* 3b7948d silence standard warning
* e63a01a bump deps
* 9557229 launch.json: add sourceMaps
* 394560e #45: descend into xpacks

## 2023-02-16

* bc0c2fa README update
* fb5b770 0.4.22
* a24c5ed prepare v0.4.22
* a73cd0f tsconfig.json: revert to module: commonjs
* 032f302 #38: accept comments in c_cpp_properties.json
* 916365c package.json: add comment-json

## 2023-02-15

* c379e70 .vscode/settings.json: ignoreWords
* 4e8335a fix typos
* 8cad29f package.json: reorder scripts

## 2023-02-14

* 16810f8 0.4.21
* c715492 prepare v0.4.21
* 055f638 package.json: reorder deps
* 20515cb tests/single: install2
* aaf123b #40: filter out configs without devDependencies
* ddf9343 #39: add Copy to right click
* eed9c50 tests/single: use hidden configurations
* f26ed23 #37: skip hidden build configurations
* d583eb8 tsconfig.json: use es6 modules & resolution
* 6216c82 README updates
* e207a6d package.json: cleanups in activationEvents
* c89f65e package.json: update scripts
* 1994615 engines: vscode 1.75.0
* f2ba67a package.json: bump deps
* fabec90 #40: make the install button visible
* 1dee595 definitions.ts: add *dependencies

## 2022-10-21

* a4f5df9 webpack.config.js: suppress warning
* prepare v0.4.20

## 2022-07-29

* prepare v0.4.19
* 6d304bd #35: add the Hello World QEMU template
* d705cdd bump deps

## 2022-05-21

* prepare v0.4.18
* d49e057 #34: implement `hidden` property

## 2022-04-17

* v0.4.17 published
* [#31] - update for buildConfiguration inheritance

## 2021-08-10

* v0.4.16 published
* [#22] - fix Explorer tree refresh after package.json edit

## 2021-07-15

* v0.4.15 published
* [#21] - fix race condition in showing explorer

## 2021-06-20

* v0.4.14 published
* no longer use `"configurationProvider": "ms-vscode.cmake-tools"` in `c_cpp_properties.json`
* dependency on `ms-vscode.cmake-tools` removed

## 2021-05-12

* v0.4.13 published
* update to use `@xpack/xpm-liquid`

## 2021-05-05

* v0.4.12 published
* remove Known Issues from README.md
* v0.4.11 published
* [#12] - do not register the configuration provider, use CMake for now
* v0.4.10 published

## 2021-05-04

* [#16] - add commands to remove actions
* [#15] - add right-click commands
* [#6] - add code to duplicate existing configurations
* [#5] - add xpack.exclude to configuration

## 2021-05-03

* [#2] add updateConfigurationNpmExclude

## 2021-05-01

* [#4] - Add configuration variable for maxDepthLevel
* [#14] - add configuration variable for the log level

## 2021-04-28

* v0.4.9 published
* fix README link
* v0.4.8 published
* [#13] - write `c_cpp_properties.json` only in workspace folders

## 2021-04-24

* v0.4.7 published
* simplify README and refer to new web site

## 2021-04-23

* [#10] - add watcher to update `c_cpp_properties.json`
* [#9] - fix `package.json` watcher concurrency
* some refactoring for workspaceFolders

## 2021-04-22

* v0.4.4 published
* package.json: add dependencies to cpptools & cmake
* data-model: fix uri.fsPath

## 2021-04-21

* v0.4.3 published
* v0.4.2 published
* add Quick Start with images to README
* v0.4.0 published
* support to create new projects from templates
* internal watchers to automate refresh on `package.json` changes
* explorer: rework descriptions & tooltips

## 2021-04-19

* v0.3.2 published
* fix run `xpm install` from explorer

## 2021-04-18

* v0.3.0 published

## 2021-04-16

* #1 - add commands to create configs & actions
* IntelliSense: write `c_cpp_properties.json` back only if not empty

## 2021-04-14

* v0.2.2 published
* migrate to webpack
* perform Liquid substitution to compute `buildFolderRelativePath`
* perform Liquid substitution to show actions tooltips

## 2021-04-09

* add IntelliSense, via `c_cpp_properties.json`
* explorer: configurations start as collapsed

## 2021-04-08

* v0.1.5 published
* add status bar and picker for the IntelliSense configuration
* add tasks for `xpm install`
* add tasks for action
* add xPacks Actions explorer

## 2021-03-28

* v0.0.1 published

## 2021-03-27

* create initial version with `yo code`
