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

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'

import { Commands } from './lib/commands'

// ----------------------------------------------------------------------------

let commands: Commands

export async function activate (
  context: vscode.ExtensionContext): Promise<void> {
  console.log('"ilg-vscode.xpack" activated')

  commands = new Commands(context)
  commands.register()

  console.log('"ilg-vscode.xpack" activation completed')
}

export function deactivate (): void {
  console.log('"ilg-vscode.xpack" deactivated')
}

// ----------------------------------------------------------------------------
