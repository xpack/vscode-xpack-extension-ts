# xPack C/C++ Managed Build

Manage and build C/C++ projects with CMake, meson, etc using the xPacks tools.

## Features

Manage tipical multi-configuration projects (like debug/release), but also
complex,  multi-platform, multi-architecture, multi-toolchain projects,
with an emphasis on modern C/C++ and embedded applications.

This project is part of the [xPack Project](https://github.com/xpack).

It is intended as a replacement of the managed build system available
in [Eclipse Embedded CDT](https://projects.eclipse.org/projects/iot.embed-cdt/).

## Requirements

A recent [xpm](https://xpack.github.io/xpm/),
which is a portable [Node.js](https://nodejs.org/) command line application.

For details please follow the instructions in the
[install](https://xpack.github.io/install/) page.

## How it works

The xPack Project does not introduce a new package format, but uses
exactly the same format as **npm**; xPacks are npm packages that
can be stored in usual Git repositories, public or private, and
even published on
[npmjs.com](https://www.npmjs.com/search?q=xpack)
or compatible servers.

The xPack Managed Build is neutral to the build system, and basically
can invoke any tools, old and new, but favours modern tools which can
generate a `compile_commands.json` file (like CMake and meson) since this
greatly simplifies/automates the project IntelliSense configuration.

## Concepts

The xPack Managed Build uses a simple logical structure, the project is
composed of a collection of named **build configurations**, each with
its own set of named **actions** defined as array of strings.

The actions can be composed from substitutions, performed via the
[LiquidJS](https://liquidjs.com) template engine, based on
user defined string **properties**.

An typical example of a project with two build configurations
using CMake can be:

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
      "buildFolderRelativePath": "build/{{ configuration.name }}",
      "commandCmakeGenerate": "cmake -S . -B {{ properties.buildFolderRelativePath }} -G Ninja -D CMAKE_BUILD_TYPE={{ properties.buildType }}",
      "commandCmakeBuild": "cmake --build {{ properties.buildFolderRelativePath }}",
      "commandCmakeClean": "cmake --build {{ properties.buildFolderRelativePath }} --target clean"
    },
    "actions": {
      "build": [
        "xpm run build --config debug",
        "xpm run build --config release"
      ],
      "clean": [
        "xpm run clean --config debug",
        "xpm run clean --config release"
      ]
    },
    "buildConfigurations": {
      "debug": {
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
      "release": {
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
$ xpm install
$ xpm run build
```

Note: this example assumes the presence of a toolchain, like GCC or clang.

## Known Issues

- none so far

## Release Notes

The list is kept in reverse chronological order, with the most recent
release on the top.

### 0.0.1

Initial release with minimal content, intended to validate the workflow.

There is only one simple action defined, `xPack: Greeting`,
which prints a short message.
