[![Codacy Badge](https://app.codacy.com/project/badge/Grade/984cdd1e0ee24ff58ab9f941427ae2e3)](https://www.codacy.com/gh/xpack/vscode-xpack-extension-ts/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=xpack/vscode-xpack-extension-ts&amp;utm_campaign=Badge_Grade)

# Developer info

This page documents the prerequisites and procedures used during the
development of the **xPack C/C++ Managed Build** VSCode extension.

This project is written in TypeScript, as recommended for VSCode extensions.

## Prerequisites

Briefly, the prerequisites are:

- npm
- a recent [xpm](https://xpack.github.io/xpm/), which is a portable
[Node.js](https://nodejs.org/) command line application
- an instance of Visual Studio Code with a specific set of extensions
- a marketplace publisher access token; `vsce login ilg-vscode`

### Install xpm

```sh
npm install --global xpm@latest
```

### Prepare a separate instance of VSCode

To avoid interferences with other extensions in the regular VSCode
configuration, it is recommended to use a custom folder and a separate
set of extensions:

```sh
mkdir ${HOME}/Work/vscode-extensions/code-portable-data-develop
cd ${HOME}/Work/vscode-extensions

code --extensions-dir ${HOME}/Work/vscode-extensions/code-portable-data-develop \
--install-extension ms-vscode.cpptools  \
--install-extension ms-vscode.cmake-tools \
--install-extension twxs.cmake \
--install-extension mhutchie.git-graph \
--install-extension github.vscode-pull-request-github \
--install-extension DavidAnson.vscode-markdownlint \
--install-extension christian-kohler.npm-intellisense \
--install-extension ban.spellright \
--install-extension standard.vscode-standard \

code --extensions-dir ${HOME}/Work/vscode-extensions/code-portable-data-develop \
--list-extensions --show-versions
```

On Windows, use the Git console, which is more or less a regular shell.

### Clone the project repository

The project is hosted on GitHub:

- <https://github.com/xpack/vscode-xpack-extension-ts.git>

To clone the `master` branch, use:

```sh
mkdir ${HOME}/Work/vscode-extensions
cd ${HOME}/Work/vscode-extensions
git clone \
https://github.com/xpack/vscode-xpack-extension-ts.git vscode-xpack-extension-ts.git
```

For development, to clone the `develop` branch, use:

```sh
git clone --branch develop \
https://github.com/xpack/vscode-xpack-extension-ts.git vscode-xpack-extension-ts.git
```

### Start VSCode

```sh
code --extensions-dir ${HOME}/Work/vscode-extensions/code-portable-data-develop \
${HOME}/Work/vscode-extensions/vscode-xpack-extension-ts.git
```

### Update VSCode settings

TBD

### Satisfy dependencies

```sh
npm install
```

### Start the webpack-dev background task

The extension uses webpack to make the distribution more compact.

To automate the workflow, webpack can be started as a background
task to convert the `out` folder into the `dist` folder:

```sh
npm run webpack-dev
```

### Start debug sessions

Use the existing launchers.

## Language standard compliance

The current version is TypeScript 4:

- <https://www.typescriptlang.org>
- <https://www.typescriptlang.org/docs/handbook>

## VSCode extension API

The API used to implement VSCode extensions:

- <https://code.visualstudio.com/api>

### package.json contributions

The VSCode extensions require some definitions stored in the
`contributes` property of `package.json`.

#### `contributes.commands`

All commands are listed here, but not all commands are equal,
those that must be shown in Command Palette better have the `category`
defined, while those that go in menus probably better have the icons.

- <https://code.visualstudio.com/api/references/contribution-points#contributes.commands>

#### `contributes.menus.commandPalette`

The Command Palette is the way extensions contribute commands that can
be invoked manually.

The picker prefixes commands with their category, allowing for easy grouping.

#### `contributes.menus.view/title`

These are the commands associated with the view title.

The `navigation` group is special as it will always be sorted to the
top/beginning of a menu.

#### `contributes.menus.view/item/context`

These are the commands associated with the items in the view tree.

Node: the `when` expressions do not accept parenthesis, so to enable
commands for multiple items, repeat the command with all different
`viewItem`.

The `inline` groups is inspired from other projects, no documentation found.

#### Documentation

- [contribution points](https://code.visualstudio.com/api/references/contribution-points)
- [activation events](https://code.visualstudio.com/api/references/activation-events)
- [extension manifest](https://code.visualstudio.com/api/references/extension-manifest)
- [built-in commands](https://code.visualstudio.com/api/references/commands)
- [when clause contexts](https://code.visualstudio.com/api/references/when-clause-contexts)
- [product icon references](https://code.visualstudio.com/api/references/icons-in-labels)

## Standard style

As style, the project uses the TypeScript variant of
[Standard Style](https://standardjs.com/#typescript),
automatically checked at each commit via CI.

Generally, to fit two editor windows side by side in a screen,
all files should limit the line length to 80.

```js
/* eslint max-len: [ "error", 80, { "ignoreUrls": true } ] */
```

Known and accepted exceptions:

- none

To manually fix compliance with the style guide (where possible):

```console
$ npm run fix

> xpack@0.0.1 fix
> ts-standard --fix src
```

## TSDoc (TypeScript documentation)

- <https://tsdoc.org>
- <https://typedoc.org/guides/doccomments/>
- <https://jsdoc.app/index.html>

## Bundling extensions

- <https://code.visualstudio.com/api/working-with-extensions/bundling-extension>
