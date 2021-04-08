# xPack C/C++ Managed Build (early evaluation!)

Manage and build C/C++ projects with CMake, meson, etc, using the xPack tools.

## Features

Manage typical multi-configuration projects (like debug/release), but also
complex,  multi-platform, multi-architecture, multi-toolchain projects,
with an emphasis on modern C/C++ and embedded applications.

This project is part of the [xPack Project](https://github.com/xpack).

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
each built in a separate folder, and each with its own set of
named **actions**, defined as array of strings holding commands.

To avoid redundant definitions between configurations,
the actions can use generic templates, with substitutions performed by the
[LiquidJS](https://liquidjs.com) template engine, based on
user defined string **properties**.

An typical example of a project with two build configurations,
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
      "buildFolderRelativePath": "build/{{ configuration.name | downcase }}",
      "commandCmakeGenerate": "cmake -S . -B {{ properties.buildFolderRelativePath }} -G Ninja -D CMAKE_BUILD_TYPE={{ properties.buildType }}",
      "commandCmakeBuild": "cmake --build {{ properties.buildFolderRelativePath }}",
      "commandCmakeClean": "cmake --build {{ properties.buildFolderRelativePath }} --target clean"
    },
    "actions": {
      "build-all": [
        "xpm run build --config Debug",
        "xpm run build --config Release"
      ],
      "clean-all": [
        "xpm run clean --config Debug",
        "xpm run clean --config Release"
      ]
    },
    "buildConfigurations": {
      "Debug": {
        "properties": {
          "buildType": "Debug"
        },
        "actions": {
          "build": [
            "{{ properties.commandCmakeGenerate }}",
            "{{ properties.commandCmakeBuild }}"
          ],
          "clean": "{{ properties.commandCmakeClean }}",
          "execute": "{{ properties.buildFolderRelativePath }}/hello-world"
        }
      },
      "Release": {
        "properties": {
          "buildType": "Release"
        },
        "actions": {
          "build": [
            "{{ properties.commandCmakeGenerate }}",
            "{{ properties.commandCmakeBuild }}"
          ],
          "clean": "{{ properties.commandCmakeClean }}",
          "execute": "{{ properties.buildFolderRelativePath }}/hello-world"
        }
      }
    }
  }
}
```

Using xpm, the build can be invoked with:

```console
$ cp <project>
$ xpm install
$ xpm run build-all
```

Note: this example assumes the presence of a toolchain, like GCC or clang.

## Known Issues

- none so far

## Release Notes

The list is kept in reverse chronological order, with the most recent
release on the top.

### 0.1.3

An early preview release, which adds the following:

- an **xPacks Actions** explorer, implemented as a tree view, which allows
  a convenient way to navigate between multiple build configurations and
  actions; to make it visible, open a `package.json`
  created via `xpm init` and add the `xpack` proeprty
  (for example from the above code)
- actions are integrated into the usual VS Code workflow by associating
  internal tasks with each action; separate tasks are added for common
  commands like `xpm install`
- a status bar entry used to select the active build configuration
  to be used by IntelliSense
  (integration with IntelliSence is not yet implemented)

### 0.0.1

Initial release with minimal content, intended to validate the workflow.

There is only one simple action defined, `xPack: Greeting`,
which prints a short message.
