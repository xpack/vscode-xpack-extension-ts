/*
 * This file is part of the xPack project (http://xpack.github.io).
 * Copyright (c) 2021 Liviu Ionescu. All rights reserved.
 *
 * Licensed under the terms of the MIT License.
 * See LICENSE in the project root for license information.
 *
 * This file was inspired by vscode.git/extensions/npm/src/*.ts.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/* eslint max-len: [ "error", 80, { "ignoreUrls": true } ] */

// ----------------------------------------------------------------------------

import * as util from 'util'

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'

import { Commands } from './lib/commands'
import { Xpack, XpackFolderPath } from './lib/xpack'
import { registerTreeViewActions } from './lib/tree-view-actions'

// ----------------------------------------------------------------------------

let commands: Commands
let xpackFolderPaths: XpackFolderPath[]

export async function activate (
  context: vscode.ExtensionContext
): Promise<void> {
  console.log('"ilg-vscode.xpack" activated')

  if (!canRunXpmInCurrentWorkspace()) {
    console.log('"ilg-vscode.xpack" cannot start xpm in current workspace')
  }

  // TODO: make the depth configurable.
  xpackFolderPaths = await findXpackFolderPaths(2)
  console.log(util.inspect(xpackFolderPaths))

  registerTreeViewActions(context, xpackFolderPaths)

  commands = new Commands(context)
  commands.register()

  console.log('"ilg-vscode.xpack" activation completed')
}

export function deactivate (): void {
  console.log('"ilg-vscode.xpack" deactivated')
}

// ----------------------------------------------------------------------------

function canRunXpmInCurrentWorkspace (): boolean {
  if (vscode.workspace.workspaceFolders != null) {
    return vscode.workspace.workspaceFolders.some(
      (folder) => {
        return (folder.uri.scheme === 'file')
      }
    )
  }
  return false
}

async function findXpackFolderPaths (
  maxDepth: number
): Promise<XpackFolderPath[]> {
  const xpackFolderPaths: XpackFolderPath[] = []
  const xpack = new Xpack()

  if (vscode.workspace.workspaceFolders != null) {
    const promises: Array<Promise<void>> = []
    vscode.workspace.workspaceFolders.forEach(
      (folder) => {
        if (folder.uri.scheme === 'file') {
          promises.push(xpack.findPackageJsonFilesRecursive(
            folder.uri.path,
            folder.uri.path,
            maxDepth,
            xpackFolderPaths))
        }
      })
    await Promise.all(promises)
  }

  return xpackFolderPaths
}

// ----------------------------------------------------------------------------
