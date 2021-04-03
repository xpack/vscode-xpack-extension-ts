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
  XpackContext
} from './common'

// ----------------------------------------------------------------------------

// Better make it global, to register commands pointing to its functions.
let _commands: Commands

export function registerCommands (
  xpackContext: XpackContext
): void {
  const context: vscode.ExtensionContext = xpackContext.vscodeContext

  _commands = new Commands(xpackContext)

  context.subscriptions.push(vscode.commands.registerCommand(
    'xpack.treeViewRefresh', _commands.treeViewRefresh, _commands))
}

export class Commands {
  private readonly _xpackContext: XpackContext

  constructor (private readonly xpackContext: XpackContext) {
    this._xpackContext = xpackContext
  }

  async treeViewRefresh (): Promise<void> {
    console.log('treeViewRefresh()')
    await this._xpackContext.runRefreshFunctions()
  }
}

// ----------------------------------------------------------------------------
