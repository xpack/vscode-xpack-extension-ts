# Maintainer info

## Project repository

The project is hosted on GitHub:

- https://github.com/xpack/vscode-xpack-extension-ts.git

To clone it:

```sh
git clone https://github.com/xpack/vscode-xpack-extension-ts.git vscode-xpack-extension-ts.git
```

## Prerequisites

- a recent [xpm](https://xpack.github.io/xpm/), which is a portable
[Node.js](https://nodejs.org/) command line application.
- a marketplace publisher access token; `vsce login ilg-vscode`


## Publish to Marketplace

- `npm run fix`
- in the develop branch, commit all changes
- `npm run test`
- check the latest commits `npm run git-log`
- update `CHANGELOG.md`; commit with a message like _CHANGELOG: prepare v0.0.1_
- check the current version and decide semver level
- `npm version patch` (bug fixes), `npm version minor` (compatible API
  additions), `npm version major` (incompatible API changes)
- `npm run package`; check the list of packaged files, possibly update `.vscodeignore`


## Links

- [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
- [Packaging extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#packaging-extensions)
- [Marketplace publisher](https://marketplace.visualstudio.com/manage/publishers/ilg-vscode)
- [Azure DevOps organization](https://dev.azure.com/xpack-org/)
