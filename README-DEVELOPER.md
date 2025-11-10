[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/ilg-vscode.xpack)](https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack)
[![license](https://img.shields.io/github/license/xpack/vscode-xpack-extension-ts.svg)](https://github.com/xpack/vscode-xpack-extension-ts/blob/xpack/LICENSE)
[![TS-Standard - Typescript Standard Style Guide](https://badgen.net/badge/code%20style/ts-standard/blue?icon=typescript)](https://github.com/standard/ts-standard)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/ilg-vscode.xpack)](https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/ilg-vscode.xpack)](https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack)
[![GitHub issues](https://img.shields.io/github/issues/xpack/vscode-xpack-extension-ts.svg)](https://github.com/xpack/vscode-xpack-extension-ts/issues/)
[![GitHub pulls](https://img.shields.io/github/issues-pr/xpack/vscode-xpack-extension-ts.svg)](https://github.com/xpack/vscode-xpack-extension-ts/pulls)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/984cdd1e0ee24ff58ab9f941427ae2e3)](https://www.codacy.com/gh/xpack/vscode-xpack-extension-ts/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=xpack/vscode-xpack-extension-ts&amp;utm_campaign=Badge_Grade)

# Developer Information

This page documents the prerequisites and procedures used during the
development of the VS Code **xPack C/C++ Managed Build** extension.

This project is written in TypeScript, as recommended for VS Code extensions.

## Prerequisites

The prerequisites are:

- npm
- A recent [xpm](https://xpack.github.io/xpm/), which is a portable
  [Node.js](https://nodejs.org/) command-line application
- An instance of Visual Studio Code with a specific set of extensions
- A marketplace publisher access token; `vsce login ilg-vscode`

### Install xpm

```sh
npm install --global xpm@latest
```

### Prepare a Separate Instance of VS Code

To avoid interference with other extensions in your regular VS Code
configuration, it is recommended to use a custom folder and a separate
set of extensions:

```sh
mkdir ${HOME}/Work/vscode-extensions/code-portable-data-develop
cd ${HOME}/Work/vscode-extensions

code \
--extensions-dir ${HOME}/Work/vscode-extensions/code-portable-data-develop \
--install-extension ms-vscode.cpptools  \
--install-extension ms-vscode.cmake-tools \
--install-extension twxs.cmake \
--install-extension mhutchie.git-graph \
--install-extension github.vscode-pull-request-github \
--install-extension DavidAnson.vscode-markdownlint \
--install-extension christian-kohler.npm-intellisense \
--install-extension ban.spellright \
--install-extension standard.vscode-standard \

code \
--extensions-dir ${HOME}/Work/vscode-extensions/code-portable-data-develop \
--list-extensions --show-versions
```

`ms-vscode.makefile-tools` may also be useful.

On Windows, use the Git console, which is similar to a regular shell.

### Clone the Project Repository

The project is hosted on GitHub:

- <https://github.com/xpack/vscode-xpack-extension-ts.git>

To clone the `master` branch:

```sh
mkdir ${HOME}/Work/vscode-extensions
cd ${HOME}/Work/vscode-extensions
git clone \
  https://github.com/xpack/vscode-xpack-extension-ts.git vscode-xpack-extension-ts.git
```

For development, to clone the `develop` branch:

```sh
git clone \
  --branch develop \
  https://github.com/xpack/vscode-xpack-extension-ts.git vscode-xpack-extension-ts.git
```

### Start VS Code

```sh
code \
  --extensions-dir ${HOME}/Work/vscode-extensions/code-portable-data-develop \
  ${HOME}/Work/vscode-extensions/vscode-xpack-extension-ts.git
```

### Update VS Code Settings

TBD

### Satisfy Dependencies

```sh
npm install
```

### Start the webpack-dev Background Task

The xPack extension uses webpack to make the distribution more compact.

To automate the workflow, webpack can be started as a background
task to convert the `out` folder into the `dist` folder:

```sh
npm run webpack-dev-watch
```

### Start Debug Sessions

Use the existing launch configurations.

Note: the `dist` folder content is processed by `webpack` and the
relationship to the original TypeScript files is lost. Temporarily adjust
`package.json` to point to the `out` folder if needed.

## Language Standard Compliance

The current version uses TypeScript 4:

- <https://www.typescriptlang.org>
- <https://www.typescriptlang.org/docs/handbook>

## VS Code Extension API

The API used to implement VS Code extensions:

- <https://code.visualstudio.com/api/>

### package.json Contributions

VS Code extensions require definitions stored in the
`contributes` property of `package.json`.

#### `contributes.commands`

All commands are listed here, but not all commands are equal.
Those that must be shown in the Command Palette should have the `category`
defined, while those that go in menus should have icons.

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

- `inline` groups are shown in the item line
- `navigation` groups are shown as right-click options

Note: the `when` expressions do not accept parentheses, so to enable
commands for multiple items, repeat the command with all different
`viewItem` values.

#### `contributes.configuration`

- <https://code.visualstudio.com/api/references/contribution-points#contributes.configuration>

Scope:

- `application` (all instances of VS Code and can only be configured
  in user settings)
- `machine` (user or remote settings, such as installation path which
  should not be shared across machines)
- `machine-overridable` (can be overridden by workspace or folder)
- **`window`** (user, workspace, or remote settings; default)
- `resource` (files and folders, and can be configured in all settings
  levels, even folder settings)
- `language-overridable`

### Documentation

- [Contribution points](https://code.visualstudio.com/api/references/contribution-points/)
- [Activation events](https://code.visualstudio.com/api/references/activation-events/)
- [Extension manifest](https://code.visualstudio.com/api/references/extension-manifest/)
- [Built-in commands](https://code.visualstudio.com/api/references/commands/)
- [When clause contexts](https://code.visualstudio.com/api/references/when-clause-contexts/)
- [Product icon references](https://code.visualstudio.com/api/references/icons-in-labels/)

### Read Configuration Values

```js
vscode.workspace.getConfiguration('xpack').get<number>('maxSearchDepthLevel', 3)
```

### Write Configuration Values

```js
const inspectedValue = npm.inspect('exclude')
const isGlobal = inspectedValue !== undefined &&
  inspectedValue.workspaceValue === undefined

await npm.update('exclude', newArray, isGlobal)
```

## Implementation Details

### Data Model

The extension recursively searches for `package.json` files, down to a given
depth and possibly excluding some folders, in order to prepare a data model
which is a tree of packages. For easier access, the configurations, commands,
and actions are also identified and listed in separate arrays.

TBD

## Prettier

The project uses [Prettier](https://prettier.io) to format the code.

## Style Checks

The project uses the TypeScript variant of
[eslint](https://typescript-eslint.io),
automatically checked at each commit via CI.

To fit two editor windows side by side on a screen,
all files should limit the line length to 80 characters.

There are no global exceptions; for specific exceptions, see the source code.

To manually fix compliance with the style guide (where possible):

```console
$ npm run fix

> xpack@0.0.1 fix
> eslint src
```

## TSDoc (TypeScript Documentation)

- <https://tsdoc.org>
- <https://jsdoc.app/index.html>

## Bundling Extensions

- <https://code.visualstudio.com/api/working-with-extensions/bundling-extension/>
