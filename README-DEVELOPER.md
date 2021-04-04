# Developer info

This project is written in TypeScript, as recommended for VSCode extensions.

## Language standard compliance

The current version is TypeScript 4:

- https://www.typescriptlang.org
- https://www.typescriptlang.org/docs/handbook

## VSCode extension API

The API used to implement VSCode extensions:

- https://code.visualstudio.com/api

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

## package.json contributions

The VSCode extensions require some definitions stored in the
`contributes` property of `package.json`.

- https://code.visualstudio.com/api/references/contribution-points
