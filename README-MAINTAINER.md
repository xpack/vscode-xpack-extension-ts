[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/ilg-vscode.xpack)](https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack)
[![license](https://img.shields.io/github/license/xpack/vscode-xpack-extension-ts.svg)](https://github.com/xpack/vscode-xpack-extension-ts/blob/xpack/LICENSE)
[![TS-Standard - Typescript Standard Style Guide](https://badgen.net/badge/code%20style/ts-standard/blue?icon=typescript)](https://github.com/standard/ts-standard)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/ilg-vscode.xpack)](https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/ilg-vscode.xpack)](https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack)
[![GitHub issues](https://img.shields.io/github/issues/xpack/vscode-xpack-extension-ts.svg)](https://github.com/xpack/vscode-xpack-extension-ts/issues/)
[![GitHub pulls](https://img.shields.io/github/issues-pr/xpack/vscode-xpack-extension-ts.svg)](https://github.com/xpack/vscode-xpack-extension-ts/pulls)

# Maintainer info

This page complements the developer page and documents the
maintenance procedures related to making release for the
VS Code **xPack C/C++ Managed Build** extension.

## Prepare the release

Before making the release, perform some checks and tweaks.

### Update npm packages

- `npm outdated`
- for a while keep `@types/vscode` locked to `1.54.0`
- edit `package.json`  and `npm install`
- repeat until everything is up to date

### Check Git

In this Git repo:

- in the `develop` branch
- push everything
- if needed, merge the `master` branch

### Determine the next version

Use the semantic versioning semantics.

### Fix possible open issues

Check GitHub issues and pull requests:

- <https://github.com/xpack/vscode-xpack-extension-ts/issues/>

### Update Release Notes in `README.md`

- add a new entry in the Release Notes section
- check the rest of the file and update if needed, to reflect the new features
- update version in `README-MAINTAINER.md`

## Update `CHANGELOG.md`

- check the latest commits `npm run git-log`
- open the `CHANGELOG.md` file
- check if all previous fixed issues are in
- commit with a message like _prepare v0.4.14_

## Prepare a new blog post with the release

In the `xpack/web-jekyll` GitHub repo:

- select the `develop` branch
- add a new file to `_posts/releases/vscode-xpack`
- name the file like `2021-03-28-vscode-xpack-v0-4-11-released.md`
- name the post like: **VS Code xPack extension v0.4.14 released**
- update the `date:` field with the current date
- update the **Changes** sections

If any, refer to closed
[issues](https://github.com/xpack/vscode-xpack-extension-ts.git/issues/)
as:

```markdown
- [#1] ...
```

- commit with a message like **VS Code xPack extension v0.4.14 released**
- push
- wait for CI job to complete

Check if the page shows at:

- <https://xpack.github.io/web-preview/news/>

## Publish to Marketplace

- terminate all running tasks (**Terminal** → **Terminate Task...**)
- select the `develop` branch
- commit everything
- `npm run fix`
- in the develop branch, commit all changes
- `npm run test`
- `npm run package`; check the list of packaged files, possibly
  update `.vscodeignore`
- `npm version patch` (bug fixes), `npm version minor` (compatible API
  additions), `npm version major` (incompatible API changes)
- `npm run package`; again, to have an up-to-date .vsix
- push all changes to GitHub; this should trigger CI
- **wait for CI tests to complete**
- `npm run publish`
- after a few minutes, check

- <https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack>
- <https://marketplace.visualstudio.com/manage/publishers/ilg-vscode/extensions/xpack/hub/>

### Test

On a separate VS Code, install the extension and check if it works.

### Merge into `master`

In this Git repo:

- select the `master` branch
- merge `develop`
- push all branches

### Update the blog post to release

In the `xpack/web-jekyll` GitHub repo:

- select the `master` branch
- merge `develop`
- push both branches
- wait for CI job to complete

Check if the page shows at:

- <https://xpack.github.io/news/>

## Share on Twitter

- in a separate browser windows, open [TweetDeck](https://tweetdeck.twitter.com/)
- using the `@xpack_project` account
- paste the release name like **VS Code xPack extension v0.4.14 released**
- paste the link to the Web page
  [release](https://xpack.github.io/vscode-xpack/releases/)
- click the **Tweet** button

## Links

- [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest/)
- [Packaging extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#packaging-extensions)
- [Marketplace publisher](https://marketplace.visualstudio.com/manage/publishers/ilg-vscode/)
- [Marketplace: xPack C/C++ Managed Build Tools](https://marketplace.visualstudio.com/manage/publishers/ilg-vscode/extensions/xpack/hub?_a=acquisition)
- [Azure DevOps organization](https://dev.azure.com/xpack-org/)
