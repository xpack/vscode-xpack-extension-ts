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

// The module 'vscode' contains the VS Code extensibility API.
import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'

// These local modules contain the actual implementation.
// They create and register the objects to VS Code.
import { ExtensionManager } from './lib/manager'
import { Commands } from './lib/commands'
import { TaskProvider } from './lib/tasks'
import { Explorer } from './lib/explorer'
import { StatusBar } from './lib/status'

// ----------------------------------------------------------------------------

// The extension manager is the glue that keeps things together
// and refreshes everything when needed.
let _extensionManager: ExtensionManager

// VS Code calls this function.
export async function activate (
  context: vscode.ExtensionContext
): Promise<void> {
  const log = new Logger({
    level: 'trace' // 'info'
  })

  log.debug('"ilg-vscode.xpack" activated')

  _extensionManager = new ExtensionManager(context, log)

  if (!_extensionManager.hasLocalWorkspace()) {
    log.debug('"ilg-vscode.xpack" requires local workspaces')
  }

  // await _extensionManager.findXpackFolderPaths()

  await TaskProvider.register(_extensionManager)
  await Explorer.register(_extensionManager)
  await StatusBar.register(_extensionManager)
  await Commands.register(_extensionManager)

  // Refresh everything again, when all objects are created.
  await _extensionManager.runRefreshFunctions()

  log.debug('"ilg-vscode.xpack" activation completed')
}

// VS Code calls this function.
export function deactivate (): void {
  _extensionManager.dispose()

  const log = _extensionManager.log

  log.debug('"ilg-vscode.xpack" deactivated')
}

// ----------------------------------------------------------------------------
