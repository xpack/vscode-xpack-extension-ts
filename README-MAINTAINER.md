[![Visual Studio Marketplace Version](https://vsmarketplacebadges.dev/version/ilg-vscode.xpack.svg)](https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack)
[![license](https://img.shields.io/github/license/xpack/vscode-xpack-extension-ts.svg)](https://github.com/xpack/vscode-xpack-extension-ts/blob/xpack/LICENSE)
[![Code Style: typescript-eslint](https://badgen.net/badge/code%20style/typescript-eslint/blue?icon=typescript)](https://typescript-eslint.io)
[![Visual Studio Marketplace Installs](https://vsmarketplacebadges.dev/installs/ilg-vscode.xpack.svg)](https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack)
[![Visual Studio Marketplace Downloads](https://vsmarketplacebadges.dev/downloads/ilg-vscode.xpack.svg)](https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack)
[![GitHub issues](https://img.shields.io/github/issues/xpack/vscode-xpack-extension-ts.svg)](https://github.com/xpack/vscode-xpack-extension-ts/issues/)
[![GitHub pulls](https://img.shields.io/github/issues-pr/xpack/vscode-xpack-extension-ts.svg)](https://github.com/xpack/vscode-xpack-extension-ts/pulls)

# Maintainer Information

This page complements the developer documentation and outlines the
maintenance procedures for releasing the
VS Code **xPack C/C++ Managed Build** extension.

## Preparing a Release

Before making a release, perform the following checks and updates.

### Update npm Packages

- Run `npm outdated` to check for outdated packages.
- Keep [`@types/node`](https://www.npmjs.com/package/@types/node) pinned to the
  [latest Node.js LTS](https://nodejs.org/en/download/).
- Edit `package.json` as required and run `npm install`.
- Repeat until all dependencies are up to date.
- keep the `engine.vscode` one version behind the current one

### Check Git Status

Within this Git repository:

- Ensure you are on the `development` branch.
- Push all local changes.
- If necessary, merge the `master` branch into `development`.

### Determine the Next Version

Follow semantic versioning conventions to select the next version.

### Resolve Open Issues

Review GitHub issues and pull requests:

- <https://github.com/xpack/vscode-xpack-extension-ts/issues/>

### Update Release Notes in `README.md`

- Add a new entry in the _Release Notes_ section.
- Review and update the remainder of the file as necessary to reflect new features.
- Update the version in `README-MAINTAINER.md`.

## Update `CHANGELOG.md`

- Review recent commits using `npm run git-log`.
- Open the `CHANGELOG.md` file.
- Ensure all previously fixed issues are documented.
- add an entry _* v1.2.2 prepared_.
- Commit with a message such as _prepare v1.2.2_.

## Prepare a New Blog Post for the Release

In the `xpack/web-archive-jekyll.git` GitHub repository:

- Switch to the `development` branch.
- Add a new file to `_posts/releases/vscode-xpack`.
- Name the file in the format `YYYY-MM-DD-vscode-xpack-vX-Y-Z-released.md`.
- Title the post: **VS Code xPack extension v1.2.2 released**
- Update the `date:` field with the current date.
- Update the **Changes** section.

Reference any closed
[issues](https://github.com/xpack/vscode-xpack-extension-ts/issues/)
as follows:

```markdown
- [#1] ...
```

- Commit with a message such as **VS Code xPack extension v1.2.2 released**.
- Push the changes.
- Wait for the CI job to complete (<https://github.com/xpack/web-jekyll/actions>).

Check that the page appears at:

- <https://xpack.github.io/web-archive-jekyll/vscode/releases/>

## Publish to the Marketplace

- Terminate **all** running tasks (**Terminal** → **Terminate Task...**).
- Ensure you are on the `development` branch.
- Commit all changes.
- Run `npm run fix`.
- Commit all changes in the `development` branch.
- Run `npm run test` (to be implemented).
- Run `npm run vsce-package`; review the list of packaged files and update `.vscodeignore` if necessary (`node_modules` must be included).
- Run `npm version 1.2.2`.
- The post-version script should push all changes to GitHub and trigger CI (to be implemented).
- Run `npm run vsce-package` again to ensure `.vsix` is up to date.
- **Wait for CI tests to complete** (to be implemented).
- Run `npm run publish`.
- After receiving the confirmation email, verify the extension at:
  - <https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack>
  - <https://marketplace.visualstudio.com/manage/publishers/ilg-vscode/extensions/xpack/hub/>

### Testing

On a separate VS Code installation, install the extension and verify its functionality.

### Merge into `master`

Within this Git repository:

- Switch to the `master` branch.
- Merge the `development` branch.
- Push all branches.

## Share on X/Twitter

- In a separate browser window, open [X/Twitter](https://x.com/).
- Using the `@xpack_project` account:
  - Post the release name, e.g., **VS Code xPack extension v1.2.2 released**.
  - Include a link to the [release web page](https://xpack.github.io/web-archive-jekyll/vscode/releases/).
  - Click the **Post** button.

## Useful Links

- [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest/)
- [Packaging Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#packaging-extensions)
- [Marketplace Publisher](https://marketplace.visualstudio.com/manage/publishers/ilg-vscode/)
- [Marketplace: xPack C/C++ Managed Build Tools](https://marketplace.visualstudio.com/manage/publishers/ilg-vscode/extensions/xpack/hub?_a=acquisition)
- [Azure DevOps Organisation](https://dev.azure.com/xpack-org/)
