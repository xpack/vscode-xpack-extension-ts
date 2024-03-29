[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/ilg-vscode.xpack)](https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack)
[![GitHub tag (latest by date)](https://img.shields.io/github/v/tag/xpack/vscode-xpack-extension-ts)](https://github.com/xpack/vscode-xpack-extension-ts)
[![license](https://img.shields.io/github/license/xpack/vscode-xpack-extension-ts.svg)](https://github.com/xpack/vscode-xpack-extension-ts/blob/xpack/LICENSE)
[![TS-Standard - Typescript Standard Style Guide](https://badgen.net/badge/code%20style/ts-standard/blue?icon=typescript)](https://github.com/standard/ts-standard)

# xPack C/C++ Managed Build (beta)

A VS Code extension to manage and build C/C++ projects with CMake, meson,
etc, using the xPack tools.

It is intended as a replacement for the managed build system available
in [Eclipse Embedded CDT](https://projects.eclipse.org/projects/iot.embed-cdt/).

## Features

Manage typical **multi-configuration projects** (like _Debug/Release_), but
also complex, **multi-platform**, **multi-architecture**, **multi-toolchain**
projects, with an emphasis on **modern C/C++** and **embedded** applications.

## Overview

The [xPack C/C++ Managed Build extension](https://xpack.github.io/vscode/)
is an open source project hosted on
[GitHub](https://github.com/xpack/vscode-xpack-extension-ts) and
is part of the [xPack Reproducible Build Framework](https://xpack.github.io/).

It can be installed from the VisualStudio Marketplace as
[ilg-vscode.xpack](https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack)
and it pulls its own dependencies (like the C/C++).

## Prerequisites (node/npm)

VS Code 1.54 or later and a recent [xpm](https://xpack.github.io/xpm/),
which is a portable [Node.js](https://nodejs.org/) command line application,
available from [npmjs.com](https://www.npmjs.com/package/xpm/).

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

The **xPack Reproducible Build Framework** is not necessarily specific
to VS Code, it is a set of portable CLI tools,
neutral to any build system,
which can basically
invoke any 3rd party tools, old and new, to perform the actual build;
it favours modern tools
(like CMake and meson) which can
generate a `compile_commands.json` file, since this
greatly simplifies integration with indexers (like VS Code IntelliSense),
but with some care can also be used with legacy tools
like autotools and make.

Future versions of the xPack Reproducible Build Framework are planned to
include an integrated build system generator, similar to that used in
Eclipse CDT.

## Disclaimer

The xPack project does not introduce a new package format, but
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
    "@xpack-dev-tools/gcc": "8.5.0-1.1",
    "@xpack-dev-tools/ninja-build": "1.10.2-2.1"
  },
  "xpack": {
    "minimumXpmRequired": "0.10.1",
    "properties": {
      "buildFolderRelativePath": "build{{ path.sep }}{{ configuration.name | downcase }}",
      "toolchainFileName": "toolchain-gcc.cmake",
      "commandPrepare": "cmake -S . -B {{ properties.buildFolderRelativePath }} -G Ninja -D CMAKE_BUILD_TYPE={{ properties.buildType }} -D CMAKE_EXPORT_COMPILE_COMMANDS=ON",
      "commandPrepareWithToolchain": "{{ properties.commandPrepare }} -D CMAKE_TOOLCHAIN_FILE={{ properties.toolchainFileName }}",
      "commandReconfigure": "{{ properties.commandPrepare }}",
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
      ]
    },
    "buildConfigurations": {
      "Debug": {
        "properties": {
          "buildType": "Debug"
        },
        "actions": {
          "prepare": "{{ properties.commandPrepareWithToolchain }}",
          "build": [
            "{{ properties.commandReconfigure }}",
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
          "prepare": "{{ properties.commandPrepareWithToolchain }}",
          "build": [
            "{{ properties.commandReconfigure }}",
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

Note: this example does not require the presence of a compiler
in the system, it includes a dependency to xPack GCC and a CMake
toolchain description file using it, to prevent CMake picking
any other unwanted compiler possibly present in the system.

## VS Code configurations

The VS Code C/C++ extension keeps track of multiple configurations
in the `.vscode/c_cpp_properties.json` file, and the xPack
extension automatically maps the `package.json` build configurations
to VS Code configurations.

IntelliSense correctly renders the content for the _active_
configurations, shown in the status bar.

![Active Configuration](assets/docs-images/switch-configs.png)

## IntelliSense enabled only for top folders

TL;DR: open separate projects/packages as separate workspace folders.

Due to the specifics of the VS Code C/C++ extension, IntelliSense is
available only if the package is in the root of the workspace folder.

In other words, when opening a workspace folder which includes multiple
packages, IntelliSense will not be enabled.

The correct solution is to open all packages as workspace folders, either
separately or via a `*.code-workspace` file.

## IntelliSense available only after the first build

In order to correctly parse the project, for managed projects,
IntelliSense needs a file called `compile_commands.json`.
One such file is expected in each build
folder, and the system build generator
(CMake/meson/etc) automatically creates these files when the
project is prepared, like during the first build.

## Ignore the kits selection question

Although not needed by the xPack extension, the CMake extension still
insists on selecting a _kit_:

![CMake kits](assets/docs-images/cmake-kits-unspecified.png)

Select _Unspecified_, since kits are not used by the xPack extension.

This issue is currently under consideration by the CMake Tools project
and it is expected to be fixed in a future release.

## Known Issues

- none so far

## Project templates

Creating new projects is automated by using project templates.

### Create a Hello World project

The **Quick Start a Hello World project** presented above creates
a C++ project built with CMake.

The full set of choices is available when executing the
**xPack: Create a Hello World project**, which is an interactive
applications requiring user input.

The result is similar, but using different build tools or
language (C vs C++).

When this command is invoked, VS Code instantiates the separate
project template available from:

- <https://github.com/xpack/hello-world-template-xpack/>

### Create a Hello World QEMU semihosted project

In addition to native projects running on the host system, it is possible
to create Arm Cortex-M, Arm Cortex-A (32/64-bit) and RISC-V (32/64-bit)
bare metal projects running on QEMU.

When this command is invoked, VS Code instantiates the separate
project template available from:

- <https://github.com/micro-os-plus/hello-world-qemu-template-xpack>

## Release Notes

The latest release is **v0.5.1**, which,
according to [semantic versioning](https://semver.org) rules,
means it is still _in initial development_ phase.

The xPack extension is functional and can be used for beta-testing,
but anything **MAY**
change at any time and the public API **SHOULD NOT** be considered stable.

More details about each release can be found in the
[releases](https://xpack.github.io/vscode/releases/) pages.

## License

The original content is released under the
[MIT License](https://opensource.org/licenses/MIT), with all rights
reserved to [Liviu Ionescu](https://github.com/ilg-ul/).
