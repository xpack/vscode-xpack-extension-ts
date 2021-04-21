# xPack C/C++ Managed Build (early evaluation!)

Manage and build C/C++ projects with CMake, meson, etc, using the xPack tools.

## Features

Manage typical **multi-configuration projects** (like _Debug/Release_), but
also complex, **multi-platform**, **multi-architecture**, **multi-toolchain**
projects, with an emphasis on **modern C/C++** and **embedded** applications.

This sub-project is part of [The xPack Project](https://github.com/xpack).

It is intended as a replacement for the managed build system available
in [Eclipse Embedded CDT](https://projects.eclipse.org/projects/iot.embed-cdt/).

## Requirements

A recent [xpm](https://xpack.github.io/xpm/),
which is a portable [Node.js](https://nodejs.org/) command line application.

For details please follow the instructions in the
[install](https://xpack.github.io/install/) page.

## How it works

The xPack Managed Build is neutral to the build system, and basically
can invoke any tools, old and new, but favours modern tools
(like CMake and meson) which can
generate a `compile_commands.json` file, since this
greatly simplifies/automates the project IntelliSense configuration.

## Disclaimer

The xPack Project does not introduce a new package format, but
inherits the simplicity of **npm**; it adds a few more definitions
to `package.json`, but otherwise it uses exactly the same project
format as **npm**; xPacks are actually npm packages, and can be
stored in usual Git repositories, or even published on
[npmjs.com](https://www.npmjs.com/search?q=xpack)
or compatible servers.

## Concepts

Compared to typical CMake/meson projects, which in most cases use a
single build folder, an xPack Managed Build project is
by design defined as a collection of named **build configurations**,
each using a separate build folder, and each with its own set of
named **actions**, defined as sequences of commands (stored in
arrays of string).

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
    "properties": {
      "buildFolderRelativePath": "build{% if os.platform == 'win32' %}\\{% else %}/{% endif %}{{ configuration.name | downcase }}",
      "commandPrepare": "cmake -S . -B {{ properties.buildFolderRelativePath }} -G Ninja -D CMAKE_BUILD_TYPE={{ properties.buildType }} -D CMAKE_EXPORT_COMPILE_COMMANDS=ON",
      "commandBuild": "cmake --build {{ properties.buildFolderRelativePath }}",
      "commandClean": "cmake --build {{ properties.buildFolderRelativePath }} --target clean",
      "commandExecuteHello": "{{ properties.buildFolderRelativePath }}{% if os.platform == 'win32' %}\\{% else %}/{% endif %}hello-world"
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

Using xpm, the complete test of build/test can be invoked with:

```bash
cp <project>
xpm install
xpm run test
```

Note: this example assumes the presence of a toolchain, like GCC or clang.

## Known Issues

- too early to call

## Release Notes

The list is kept in reverse chronological order, with the most recent
release on the top.

### 0.4.0

A new development release which adds:

- support to create new projects from templates
- internal watchers to automate refresh on package.json changes

### 0.3.2

A new development release with functional IntelliSense which adds:

- commands to create configs & actions
- `xpm install` as a separate entry in the explorer, runnable

### 0.2.2

A new development release which adds the following:

- since the project grew, as recommended, webpack was used to pack all code
  into a single compact file;
- IntelliSense support was added via `c_cpp_properties.json` (making
  use of the `ms-vscode.cmake-tools` configuration provider); the new
  status bae entry is no longer needed and was disabled;
- generic template support was added by performing Liquid substitution,
  mainly to compute `buildFolderRelativePath` but also to show
  actions tooltips.

### 0.1.5

An early preview release, which adds the following:

- an **xPacks Actions** explorer, implemented as a tree view, which allows
  a convenient way to navigate between multiple build configurations and
  actions; to make it visible, open a `package.json`
  created via `xpm init` and add the `xpack` property
  (for example from the above code);
- actions are integrated into the usual VS Code workflow by associating
  internal tasks with each action; separate tasks are added for common
  commands like `xpm install`;
- ~~a status bar entry used to select the active build configuration
  to be used by IntelliSense
  (integration with IntelliSence is not yet implemented)~~.

### 0.0.1

Initial release with minimal content, intended to validate the workflow.

There is only one simple action defined, _xPack: Greeting_,
which prints a short message.
