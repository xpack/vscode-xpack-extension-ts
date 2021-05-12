[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/ilg-vscode.xpack)](https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack)
[![license](https://img.shields.io/github/license/xpack/vscode-xpack-extension-ts.svg)](https://github.com/xpack/vscode-xpack-extension-ts/blob/xpack/LICENSE)
[![TS-Standard - Typescript Standard Style Guide](https://badgen.net/badge/code%20style/ts-standard/blue?icon=typescript)](https://github.com/standard/ts-standard)

# xPack C/C++ Managed Build (beta)

A VS Code extension to manage and build C/C++ projects with CMake, meson, etc, using the xPack tools.

It is intended as a replacement for the managed build system available
in [Eclipse Embedded CDT](https://projects.eclipse.org/projects/iot.embed-cdt/).

## Features

Manage typical **multi-configuration projects** (like _Debug/Release_), but
also complex, **multi-platform**, **multi-architecture**, **multi-toolchain**
projects, with an emphasis on **modern C/C++** and **embedded** applications.

The [xPack C/C++ Managed Build](https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack)
extension is part of the [xPack Project](https://github.com/xpack).

## Requirements

A recent [xpm](https://xpack.github.io/xpm/),
which is a portable [Node.js](https://nodejs.org/) command line application,
available from [npmjs.com](https://www.npmjs.com/package/xpm).

```sh
npm install --global xpm@latest
```

For details please follow the instructions in the
[install](https://xpack.github.io/install/) page.

## Quick Start

TL;DR: **View** → **Command Palette...** →
**xPack: Quick Start a Hello World project (C++, CMake)**
(but better read the
[Quick Start](https://xpack.github.io/vscode/quick-start/) page).

The simplest way to start with the VS Code **xPack C/C++ Managed Build**
extension is to create a simple _Hello World_ project.

Open the
[Quick Start](https://xpack.github.io/vscode/quick-start/)
page in a browser and follow the steps. In addition to being
a fully functional project, the result can also be a good
starting point for more complex projects.

## How it works

The **xPack Build framework** is not necessarily specific to VS Code,
it is a set of portable CLI tools,
neutral to any build system,
which can basically
invoke any 3rd party tools, old and new, to perform the actual build;
it favours modern tools
(like CMake and meson) which can
generate a `compile_commands.json` file, since this
greatly simplifies integration with indexers (like VS Code IntelliSense),
but with some care can also be used with legacy tools
like autotools and make.

## Disclaimer

The xPack Project does not introduce a new package format, but
inherits from the simplicity of **npm**; it adds a few more definitions
to `package.json`, but otherwise it uses exactly the same project
format as **npm**; **xPacks are actually npm packages**, and can be
stored in usual Git repositories, or even published on
[npmjs.com](https://www.npmjs.com/search?q=xpack)
or compatible servers.

## Concepts (configurations & actions)

Compared to typical CMake/meson projects, which in most cases use a
single build folder, an xPack Managed Build project is
by design defined as

> a collection of named **build configurations**

each using a separate build folder, and

> each with its own set of named **actions**

defined as sequences of commands (stored in JSON as
arrays of string).

![xPack Actions](assets/docs-images/xpack-actions.png)

To avoid redundant definitions between configurations,
the actions can use generic templates, with substitutions performed by the
[LiquidJS](https://liquidjs.com) template engine, based on
user defined string **properties**.

A typical example of a project with two build configurations,
using CMake, may look like:

```json
{
  "name": "hello-world",
  "version": "0.1.0",
  "description": "A Hello World project",
  "main": "",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [
    "xpack"
  ],
  "license": "MIT",
  "config": {},
  "dependencies": {},
  "devDependencies": {
    "@xpack-dev-tools/cmake": "3.19.2-2.1",
    "@xpack-dev-tools/ninja-build": "1.10.2-2.1"
  },
  "xpack": {
    "minimumXpmRequired": "0.10.1",
    "properties": {
      "buildFolderRelativePath": "build{{ path.sep }}{{ configuration.name | downcase }}",
      "commandPrepare": "cmake -S . -B {{ properties.buildFolderRelativePath }} -G Ninja -D CMAKE_BUILD_TYPE={{ properties.buildType }} -D CMAKE_EXPORT_COMPILE_COMMANDS=ON",
      "commandBuild": "cmake --build {{ properties.buildFolderRelativePath }}",
      "commandClean": "cmake --build {{ properties.buildFolderRelativePath }} --target clean",
      "commandExecuteHello": "{{ properties.buildFolderRelativePath }}{{ path.sep }}hello-world"
    },
    "actions": {
      "prepare-all": [
        "xpm run prepare --config Debug",
        "xpm run prepare --config Release"
      ],
      "build-all": [
        "xpm run build --config Debug",
        "xpm run build --config Release"
      ],
      "clean-all": [
        "xpm run clean --config Debug",
        "xpm run clean --config Release"
      ],
      "execute-all": [
        "xpm run execute --config Debug",
        "xpm run execute --config Release"
      ],
      "test": [
        "xpm run build-all",
        "xpm run execute-all"
      ]    },
    "buildConfigurations": {
      "Debug": {
        "properties": {
          "buildType": "Debug"
        },
        "actions": {
          "prepare": "{{ properties.commandPrepare }}",
          "build": [
            "{{ properties.commandPrepare }}",
            "{{ properties.commandBuild }}"
          ],
          "clean": "{{ properties.commandClean }}",
          "execute": "{{ properties.commandExecuteHello }}"
        }
      },
      "Release": {
        "properties": {
          "buildType": "Release"
        },
        "actions": {
          "prepare": "{{ properties.commandPrepare }}",
          "build": [
            "{{ properties.commandPrepare }}",
            "{{ properties.commandBuild }}"
          ],
          "clean": "{{ properties.commandClean }}",
          "execute": "{{ properties.commandExecuteHello }}"
        }
      }
    }
  }
}
```

With a bit of `xpm` magic, the complete cycle of prepare/build/execute
can be reduced to:

```sh
cd <project>

xpm install
xpm run test
```

Note: this example assumes the presence of a toolchain, like GCC or clang.

## IntelliSense enabled only for top folders

TL;DR: open separate projects/packages as separate workspace folders.

Due to the specifics of the VS Code C/C++ extension, IntelliSense is
available only if the package is in the root of the workspace folder.

In other words, when opening a workspace folder which includes multiple
packages, IntelliSense will not be enabled.

The correct solution is to open all packages as workspace folders, either
separately or via a `*.code-workspace` file.

## Known Issues

- none so far

## Release Notes

The latest release is **v0.4.13**, which,
according to [semantic versioning](https://semver.org) rules,
means it is still _in initial development_ phase.

The xPack extension is functional and can be used for beta-testing,
but anything MAY
change at any time and the public API SHOULD NOT be considered stable.

More details about each release can be found in the
[releases](https://xpack.github.io/vscode/releases/) pages.
