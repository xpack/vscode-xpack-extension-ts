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

// This extension uses the status bar to display the current build
// configuration, in use by IntelliSense.
// It also allows to select a different configuration.

// ----------------------------------------------------------------------------

import * as vscode from 'vscode'

import {
  ExtensionManager,
  TreeNodeBuildConfiguration
} from './manager'

// ----------------------------------------------------------------------------

export class StatusBar implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  // Factory method pattern.
  static async register (
    extensionManager: ExtensionManager
  ): Promise<StatusBar> {
    const _statusBar = new StatusBar(extensionManager)
    extensionManager.subscriptions.push(_statusBar)

    // Add possible async calls here.

    console.log('Status object created')
    return _statusBar
  }

  // --------------------------------------------------------------------------
  // Members.

  private readonly _extensionManager: ExtensionManager
  private readonly _statusBarItem: vscode.StatusBarItem

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (extensionManager: ExtensionManager) {
    this._extensionManager = extensionManager

    const context: vscode.ExtensionContext = extensionManager.vscodeContext
    const subscriptions = context.subscriptions

    extensionManager.addRefreshFunction(
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

    extensionManager.onSelectBuildConfiguration.event(
      (treeNode) => {
        console.log(treeNode, 'received')

        this.refresh(treeNode)
      }
    )
  }

  // --------------------------------------------------------------------------

  refresh (treeNode?: TreeNodeBuildConfiguration): void {
    console.log('StatusBar.refresh()')

    let buildConfiguration: TreeNodeBuildConfiguration | undefined = treeNode
    if (treeNode === undefined) {
      const extensionManager: ExtensionManager = this._extensionManager

      const buildConfigurations: TreeNodeBuildConfiguration[] =
        extensionManager.buildConfigurations
      if (buildConfigurations.length > 0) {
        buildConfiguration = buildConfigurations[0]
      }
    }

    const statusBarItem = this._statusBarItem
    statusBarItem.hide()

    if (buildConfiguration !== undefined) {
      const name: string = buildConfiguration.name
      statusBarItem.text = `$(tools) ${name}`
      let tooltip = ''
      const relativePath =
        buildConfiguration.parent.xpackFolderPath.relativePath
      if (relativePath !== '') {
        tooltip += `${relativePath} - `
      }
      tooltip += 'Select the build configuration for IntelliSense'
      statusBarItem.tooltip = tooltip
      statusBarItem.command = 'xpack.selectBuildConfiguration'
      statusBarItem.show()
    }
  }

  dispose (): void {
    console.log('StatusBar.dispose()')
    // Nothing to do
  }

  // --------------------------------------------------------------------------
}
// ----------------------------------------------------------------------------
