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

import * as assert from 'assert'
import { promises as fsPromises } from 'fs'
import * as path from 'path'

import * as vscode from 'vscode'

import { Xpack } from './xpack'

// ----------------------------------------------------------------------------

// TODO: make the depth configurable.
const _maxSearchDepth: number = 3

export type AyncVoidFunction = (() => Promise<void>)

export interface XpackFolderPath {
  path: string
  relativePath: string
  workspaceFolder: vscode.WorkspaceFolder
  packageJson: any
}

// ----------------------------------------------------------------------------

export class ExtensionManager {
  vscodeContext: vscode.ExtensionContext
  refreshFunctions: AyncVoidFunction[] = []
  xpackFolderPaths: XpackFolderPath[] = []

  constructor (context: vscode.ExtensionContext) {
    this.vscodeContext = context
  }

  hasLocalWorkspace (): boolean {
    if (vscode.workspace.workspaceFolders != null) {
      return vscode.workspace.workspaceFolders.some(
        (folder) => {
          return (folder.uri.scheme === 'file')
        }
      )
    }
    return false
  }

  addRefreshFunction (func: AyncVoidFunction): void {
    this.refreshFunctions.push(func)
  }

  async runRefreshFunctions (): Promise<void> {
    await this.findXpackFolderPaths()
    // No async forEach, use loop.
    for (const func of this.refreshFunctions) {
      await func()
    }
  }

  async _findPackageJsonFilesRecursive (
    folderPath: string,
    workspaceFolder: vscode.WorkspaceFolder,
    depth: number,
    xpackFolderPaths: XpackFolderPath[]
  ): Promise<void> {
    assert(folderPath)

    // May be null.
    console.log(`check folder ${folderPath} `)
    const xpack = new Xpack(folderPath)
    const packageJson = await xpack.checkIfFolderHasPackageJson()
    if (xpack.isPackage()) {
      if (xpack.isXpack()) {
        xpackFolderPaths.push({
          path: folderPath,
          relativePath: path.relative(workspaceFolder.uri.path, folderPath),
          workspaceFolder,
          packageJson
        })
      }
      return
    }

    if (depth <= 0) {
      return
    }

    // Recurse on children folders.
    const files = await fsPromises.readdir(folderPath, { withFileTypes: true })
    const promises = []
    for (const file of files) {
      if (file.isDirectory() && !file.name.startsWith('.')) {
        promises.push(this._findPackageJsonFilesRecursive(
          path.join(folderPath, file.name),
          workspaceFolder,
          depth - 1,
          xpackFolderPaths))
      }
    }
    await Promise.all(promises)
  }

  async findXpackFolderPaths (
    maxDepth: number = _maxSearchDepth
  ): Promise<void> {
    const xpackFolderPaths: XpackFolderPath[] = []

    if (vscode.workspace.workspaceFolders != null) {
      const promises: Array<Promise<void>> = []
      vscode.workspace.workspaceFolders.forEach(
        (workspaceFolder) => {
          if (workspaceFolder.uri.scheme === 'file') {
            const promise = this._findPackageJsonFilesRecursive(
              workspaceFolder.uri.path,
              workspaceFolder,
              maxDepth,
              xpackFolderPaths)
            promises.push(promise)
          }
        }
      )
      await Promise.all(promises)
    }

    this.xpackFolderPaths =
      xpackFolderPaths.sort((a, b) => a.path.localeCompare(b.path))

    // Make the exprlorer visible if there are any xPacks.
    await vscode.commands.executeCommand(
      'setContext',
      'xpack:showScriptExplorer',
      this.xpackFolderPaths.length >= 0)
  }
}

// ----------------------------------------------------------------------------
