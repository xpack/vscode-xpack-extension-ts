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
// import { Hover } from './lib/hover'
// import { StatusBar } from './lib/status-bar'
import { IntelliSense } from './lib/intellisense'
import { LogLevelKey } from './lib/definitions'

// ----------------------------------------------------------------------------

// The extension manager is the glue that keeps things together
// and refreshes everything when needed.
let _manager: ExtensionManager

/**
 * Activate the extension.
 *
 * @description
 * VS Code calls this function according to the `activationEvents`
 * property in `package.json`.
 */
export async function activate (
  context: vscode.ExtensionContext
): Promise<void> {
  const loglevel = vscode.workspace.getConfiguration('xpack')
    .get<LogLevelKey>('loggingLevel', 'info')

  const log = new Logger({
    level: loglevel
  })

  log.debug('"ilg-vscode.xpack" activated')

  _manager = new ExtensionManager(context, log)

  if (_manager.hasLocalWorkspace()) {
    await _manager.updateConfigurationNpmExclude()
  } else {
    log.info('"ilg-vscode.xpack" requires local workspaces')
  }

  // Register listeners to refresh the explorer when packages change.
  _manager.registerPackageJsonWatchers()

  _manager.registerWorkspaceFoldersWatcher()

  // await _extensionManager.findXpackFolderPaths()

  await TaskProvider.register(_manager)
  await Explorer.register(_manager)
  await Commands.register(_manager)

  // Not yet implemented.
  // await Hover.register(_manager)

  // For now use the C/C++ status bar to select the configuration.
  // await StatusBar.register(_extensionManager)
  const intelliSense = await IntelliSense.register(_manager)

  intelliSense.registerCompileCommandsJsonWatchers()

  // Refresh everything again, when all objects are created.
  await _manager.refresh()

  log.debug('"ilg-vscode.xpack" activation completed')
}

/**
 * Deactivate the extension.
 *
 * @description
 * VS Code calls this function, usually when shutting down, but also
 * when the extension in disabled or uninstalled.
 */
export async function deactivate (): Promise<void> {
  await _manager.dispose()

  const log = _manager.log

  log.debug('"ilg-vscode.xpack" deactivated')
}

// ----------------------------------------------------------------------------
