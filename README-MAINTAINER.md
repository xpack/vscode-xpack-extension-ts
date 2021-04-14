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

## Prepare the release

Before making the release, perform some checks and tweaks.

### Update npm packages

- `npm update`

### Check Git

In this Git repo:

- in the `develop` branch
- push everything
- if needed, merge the `master` branch

### Determine the next version

Use the semantic versioning semantics.

### Fix possible open issues

Check GitHub issues and pull requests:

- https://github.com/xpack/vscode-xpack-extension-ts/issues/

### Update Release Notes in `README.md`

- add a new entry in the Release Notes section
- check the rest of the file and update if needed, to reflect the new features
- update version in README-MAINTAINER.md

## Update `CHANGELOG.md`

- check the latest commits `npm run git-log`
- open the `CHANGELOG.md` file
- check if all previous fixed issues are in
- commit with a message like _prepare v0.2.1_

## Prepare a new blog post with the pre-release

In the `xpack/web-jekyll` GitHub repo:

- select the `develop` branch
- add a new file to `_posts/releases/vscode-xpack`
- name the file like `2021-03-28-vscode-xpack-v0-2-0-released.md`
- name the post like: **xPack VSCode extension v0.2.1 pre-release**
- update the `date:` field with the current date
- update the **Changes** sections

If any, refer to closed
[issues](https://github.com/xpack/vscode-xpack-extension-ts.git/issues/)
as:

```
- [#1] ...
```

- commit with a message like **xPack VSCode extension v0.2.1 pre-release**
- push
- wait for CI job to complete

Check if the page shows at:

- https://xpack.github.io/web-preview/news/

## Publish to Marketplace

- select the `develop` branch
- commit everything
- `npm run fix`
- in the develop branch, commit all changes
- `npm run test`
- `npm run package`; check the list of packaged files, possibly
  update `.vscodeignore`
- `npm version patch` (bug fixes), `npm version minor` (compatible API
  additions), `npm version major` (incompatible API changes)
- push all changes to GitHub; this should trigger CI
- **wait for CI tests to complete**
- `npm run publish`
- after a few minutes, check https://marketplace.visualstudio.com/items?itemName=ilg-vscode.xpack

### Test

On a separate VSCode, install the extension and check if it works.

### Merge into `master`

In this Git repo:

- select the `master` branch
- merge `develop`
- push all branches

### Update the blog post to release

In the `xpack/web-jekyll` GitHub repo:

- in the `develop` branch
- change the name from _pre-release_ to _released_
- remove the _To install the pre-release version, use:_ section
- commit with a message like **xPack VSCode extension v0.2.1 release**
- select the `master` branch
- merge `develop`
- push both branches
- wait for CI job to complete

Check if the page shows at:

- https://xpack.github.io/news/

## Share on Twitter

- in a separate browser windows, open [TweetDeck](https://tweetdeck.twitter.com/)
- using the `@xpack_project` account
- paste the release name like **xPack VSCode extension v0.2.1 released**
- paste the link to the Web page
  [release](https://xpack.github.io/vscode-xpack/releases/)
- click the **Tweet** button

## Links

- [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
- [Packaging extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#packaging-extensions)
- [Marketplace publisher](https://marketplace.visualstudio.com/manage/publishers/ilg-vscode)
- [Marketplace: xPack C/C++ Managed Build Tools](https://marketplace.visualstudio.com/manage/publishers/ilg-vscode/extensions/xpack/hub?_a=acquisition)
- [Azure DevOps organization](https://dev.azure.com/xpack-org/)
