# Change & release log

Releases in reverse chronological order.

Please check
[GitHub](https://github.com/xpack/vscode-xpack-extension-ts/issues/)
and close existing issues and pull requests.

## 2023-02-16

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
