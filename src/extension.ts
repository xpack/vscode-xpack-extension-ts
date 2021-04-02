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

import {
  registerCommands
} from './lib/commands'

import {
  VoidFunction
} from './lib/xpack'

import {
  registerExplorer
} from './lib/explorer'

// ----------------------------------------------------------------------------

const invalidateCacheFunctions: VoidFunction[] = []

export async function activate (
  context: vscode.ExtensionContext
): Promise<void> {
  console.log('"ilg-vscode.xpack" activated')

  if (!canRunXpmInCurrentWorkspace()) {
    console.log('"ilg-vscode.xpack" requires local workspaces')
  }

  registerExplorer(context, invalidateCacheFunctions)

  registerCommands(context, invalidateCacheFunctions)

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

// ----------------------------------------------------------------------------
