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

// ----------------------------------------------------------------------------

export class Commands {
  // --------------------------------------------------------------------------
  // Static members & methods.

  static _commands: Commands

  static async register (
    extensionManager: ExtensionManager
  ): Promise<void> {
    Commands._commands = new Commands(extensionManager)

    // Add possible async calls here.
  }

  // --------------------------------------------------------------------------
  // Members.

  private readonly _extensionManager: ExtensionManager

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (private readonly extensionManager: ExtensionManager) {
    this._extensionManager = extensionManager

    const context: vscode.ExtensionContext = extensionManager.vscodeContext

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.treeViewRefresh',
        this.treeViewRefresh,
        this
      )
    )
  }

  // --------------------------------------------------------------------------
  // Methods.

  async treeViewRefresh (): Promise<void> {
    console.log('treeViewRefresh()')
    await this._extensionManager.runRefreshFunctions()
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
