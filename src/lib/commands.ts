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

import * as vscode from 'vscode'

import {
  ExtensionManager
} from './manager'

import {
  TreeItem,
  TreeItemAction
} from './explorer'

// ----------------------------------------------------------------------------

export class Commands implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  // Factory method pattern.
  static async register (
    extensionManager: ExtensionManager
  ): Promise<Commands> {
    const _commands = new Commands(extensionManager)
    extensionManager.subscriptions.push(_commands)

    // Add possible async calls here.

    console.log('Commands object created')
    return _commands
  }

  // --------------------------------------------------------------------------
  // Members.

  private readonly _extensionManager: ExtensionManager

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (extensionManager: ExtensionManager) {
    this._extensionManager = extensionManager

    const context: vscode.ExtensionContext = extensionManager.vscodeContext

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.treeViewRefresh',
        this.treeViewRefresh,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.runAction',
        this.runAction,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.selectBuildConfiguration',
        this.selectBuildConfiguration,
        this
      )
    )
  }

  // --------------------------------------------------------------------------
  // Methods.

  async treeViewRefresh (): Promise<void> {
    console.log('Command.treeViewRefresh()')
    await this._extensionManager.runRefreshFunctions()
  }

  // When invoked by the tree viewer it get the tree item where it occured.
  async runAction (treeItem: TreeItem): Promise<void> {
    console.log('Command.runAction()')
    if (treeItem instanceof TreeItemAction) {
      console.log(treeItem)
      await treeItem.runTask()
    } else {
      throw new Error('treeItem not yet implemented')
    }
  }

  async selectBuildConfiguration (): Promise<void> {
    console.log('Command.selectBuildConfiguration()')

    // TODO: create a picker to select the desired configuration
  }

  dispose (): void {
    console.log('Commands.dispose()')
    // Nothing to do
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
