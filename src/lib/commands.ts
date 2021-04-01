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

// import { Xpack } from './xpack'

// ----------------------------------------------------------------------------

export class Commands {
  private readonly _context: vscode.ExtensionContext

  constructor (private readonly context: vscode.ExtensionContext) {
    this._context = context
  }

  register (): void {
    const context = this._context

    context.subscriptions.push(vscode.commands.registerCommand(
      'xpack.runXpmInstall', this.runXpmInstall, this))
  }

  async runXpmInstall (args: any): Promise<void> {
    console.log(typeof args)

    // Display a message box to the user
    await vscode.window.showInformationMessage(
      'should run xpm install!')
  }
}

// ----------------------------------------------------------------------------
