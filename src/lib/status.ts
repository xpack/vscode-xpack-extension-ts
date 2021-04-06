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

export class StatusBar {
  // --------------------------------------------------------------------------
  // Static members & methods.

  static _statusBar: StatusBar

  static async register (
    extensionManager: ExtensionManager
  ): Promise<void> {
    StatusBar._statusBar = new StatusBar(extensionManager)
  }

  // --------------------------------------------------------------------------
  // Members.

  private readonly _extensionManager: ExtensionManager
  private readonly _statusBarItem: vscode.StatusBarItem

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (extensionManager: ExtensionManager) {
    this._extensionManager = extensionManager

    extensionManager.addRefreshFunction(
      async () => {
        this.refresh()
      }
    )

    const statusBarItem =
      vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
    statusBarItem.hide()

    this._statusBarItem = statusBarItem
  }

  // --------------------------------------------------------------------------

  refresh (): void {
    console.log('StatusBar.refresh()')

    const extensionManager: ExtensionManager = this._extensionManager

    const statusBarItem = this._statusBarItem
    statusBarItem.hide()

    const buildConfigurations: TreeNodeBuildConfiguration[] =
     extensionManager.buildConfigurations
    if (buildConfigurations.length > 0) {
      const buildConfiguration = buildConfigurations[0]
      const name: string = buildConfiguration.name
      statusBarItem.text = `$(tools) ${name}`
      let tooltip = `Using build configuration ${name}`
      const relativePath =
        buildConfiguration.parent.xpackFolderPath.relativePath
      if (relativePath !== '') {
        tooltip += ` of ${relativePath}`
      }
      statusBarItem.tooltip = tooltip
      statusBarItem.command = 'xpack.selectBuildConfiguration'
      statusBarItem.show()
    }
  }

  // --------------------------------------------------------------------------
}
// ----------------------------------------------------------------------------
