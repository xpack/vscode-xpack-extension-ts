[![Codacy Badge](https://app.codacy.com/project/badge/Grade/984cdd1e0ee24ff58ab9f941427ae2e3)](https://www.codacy.com/gh/xpack/vscode-xpack-extension-ts/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=xpack/vscode-xpack-extension-ts&amp;utm_campaign=Badge_Grade)

# Developer info

This project is written in TypeScript, as recommended for VSCode extensions.

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
