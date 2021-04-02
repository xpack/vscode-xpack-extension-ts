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

import { VoidFunction } from './xpack'

// ----------------------------------------------------------------------------

let commands: Commands
let _invalidateCacheFunctions: VoidFunction[]

export function registerCommands (
  context: vscode.ExtensionContext,
  invalidateCacheFunctions: VoidFunction[]
): void {
  _invalidateCacheFunctions = invalidateCacheFunctions

  commands = new Commands(context)

  context.subscriptions.push(vscode.commands.registerCommand(
    'xpack.treeViewRefresh', commands.treeViewRefresh, commands))
}

export class Commands {
  private readonly _context: vscode.ExtensionContext

  constructor (private readonly context: vscode.ExtensionContext) {
    this._context = context
  }

  async treeViewRefresh (): Promise<void> {
    console.log('treeViewRefresh()', _invalidateCacheFunctions.length)
    _invalidateCacheFunctions.forEach((func) => {
      func()
    })
  }
}

// ----------------------------------------------------------------------------
