/*
 * This file is part of the xPack project (http://xpack.github.io).
 * Copyright (c) 2021-2026 Liviu Ionescu. All rights reserved.
 *
 * Permission to use, copy, modify, and/or distribute this software
 * for any purpose is hereby granted, under the terms of the MIT license.
 *
 * If a copy of the license was not distributed with this file, it can
 * be obtained from https://opensource.org/license/mit.
 *
 * This file was inspired by vscode.git/extensions/npm/src/*.ts.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

// ----------------------------------------------------------------------------

// The module 'vscode' contains the VS Code extensibility API.
import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'

// These local modules contain the actual implementation.
// They create and register the objects to VS Code.
import { ExtensionManager } from './core/manager.js'
import { Commands } from './core/commands.js'
import { TaskProvider } from './core/tasks.js'
import { Explorer } from './core/explorer.js'
// import { Hover } from './lib/hover.js'
// import { StatusBar } from './lib/status-bar.js'
import { IntelliSense } from './core/intellisense.js'
import { LogLevelKey } from './core/definitions.js'

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
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const loglevel = vscode.workspace
    .getConfiguration('xpack')
    .get<LogLevelKey>('loggingLevel', 'info')

  // A dedicated Output panel channel, disposed by VS Code after
  // deactivate() returns, so the final log lines still reach it.
  const outputChannel = vscode.window.createOutputChannel(
    'xPack C/C++ Managed Build Tools'
  )
  context.subscriptions.push(outputChannel)

  const isDevelopment =
    context.extensionMode === vscode.ExtensionMode.Development

  const log = new Logger({
    // The setting uses 'warning', but the logger only accepts 'warn'.
    level: loglevel === 'warning' ? 'warn' : loglevel,
    console: createOutputChannelConsole(outputChannel, isDevelopment),
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

  TaskProvider.register(_manager)
  Explorer.register(_manager)
  Commands.register(_manager)

  // Not yet implemented.
  // await Hover.register(_manager)

  // For now use the C/C++ status bar to select the configuration.
  // await StatusBar.register(_extensionManager)
  const intelliSense = IntelliSense.register(_manager)

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
export async function deactivate(): Promise<void> {
  await _manager.dispose()

  const log = _manager.log

  log.debug('"ilg-vscode.xpack" deactivated')
}

/**
 * Create a console-like object that writes to an Output panel channel.
 *
 * @description
 * The `@xpack/logger` `Logger` accepts a custom console and uses only
 * its `log()` and `error()` functions, each called with a single,
 * already formatted string (the level prefixes, such as `debug: `, are
 * added by the logger). The same `Logger` instance is passed to
 * `@xpack/xpm-lib`, so the library output also reaches the channel.
 *
 * When the extension runs in an Extension Development Host, the
 * messages are also forwarded to the global console, so they remain
 * visible in the debugger console.
 *
 * @param outputChannel - The channel that receives the messages.
 * @param alsoToConsole - Whether to also write to the global console.
 * @returns An object with `log()` and `error()` functions.
 */
function createOutputChannelConsole(
  outputChannel: vscode.OutputChannel,
  alsoToConsole: boolean
): {
  log: (message: string) => void
  error: (message: string) => void
} {
  return {
    log: (message: string): void => {
      outputChannel.appendLine(message)
      if (alsoToConsole) {
        console.log(message)
      }
    },
    error: (message: string): void => {
      outputChannel.appendLine(message)
      if (alsoToConsole) {
        console.error(message)
      }
    },
  }
}

// ----------------------------------------------------------------------------
