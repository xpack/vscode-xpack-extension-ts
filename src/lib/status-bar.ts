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

// NOT YET USED! (the C/C++ status item is used for now)

// This extension uses the status bar to display the current build
// configuration, in use by IntelliSense.
// It also allows to select a different configuration.

// ----------------------------------------------------------------------------

import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'

import { ExtensionManager } from './manager'
import { DataNodeConfiguration } from './data-model'

// ----------------------------------------------------------------------------

export class StatusBar implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  // Factory method pattern.
  static async register (
    manager: ExtensionManager
  ): Promise<StatusBar> {
    const _statusBar = new StatusBar(manager)
    manager.subscriptions.push(_statusBar)

    const log = manager.log

    // Add possible async calls here.

    log.trace('StatusBar object created')
    return _statusBar
  }

  // --------------------------------------------------------------------------
  // Members.

  log: Logger
  readonly manager: ExtensionManager

  private readonly _statusBarItem: vscode.StatusBarItem

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (manager: ExtensionManager) {
    this.manager = manager
    this.log = manager.log

    const log = this.log

    const context: vscode.ExtensionContext = manager.vscodeContext
    const subscriptions = context.subscriptions

    manager.addCallbackRefresh(
      async () => {
        this.refresh()
      }
    )

    // https://code.visualstudio.com/api/references/vscode-api#StatusBarItem
    const statusBarItem =
      vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
    statusBarItem.hide()

    subscriptions.push(statusBarItem)

    this._statusBarItem = statusBarItem

    manager.onSelectBuildConfiguration.event(
      (dataNode) => {
        log.trace(dataNode, 'received')

        this.refresh(dataNode)
      }
    )
  }

  // --------------------------------------------------------------------------
  // Methods.

  refresh (dataNode?: DataNodeConfiguration): void {
    const log = this.log

    log.trace('StatusBar.refresh()')

    let configuration: DataNodeConfiguration | undefined = dataNode
    if (dataNode === undefined) {
      const extensionManager: ExtensionManager = this.manager

      const buildConfigurations: DataNodeConfiguration[] =
        extensionManager.data.configurations
      if (buildConfigurations.length > 0) {
        configuration = buildConfigurations[0]
      }
    }

    const statusBarItem = this._statusBarItem
    statusBarItem.hide()

    if (configuration !== undefined) {
      const name: string = configuration.name
      statusBarItem.text = `$(tools) ${name}`
      let tooltip = ''
      const relativePath = configuration.package.folderRelativePath
      if (relativePath !== '') {
        tooltip += `${relativePath} - `
      }
      tooltip += 'Select the build configuration for IntelliSense'
      tooltip += ' (not yet functional)'
      statusBarItem.tooltip = tooltip
      statusBarItem.command = 'xpack.selectBuildConfiguration'
      statusBarItem.show()
    }
  }

  dispose (): void {
    const log = this.log

    log.trace('StatusBar.dispose()')
    // Nothing to do
  }

  // --------------------------------------------------------------------------
}
// ----------------------------------------------------------------------------
