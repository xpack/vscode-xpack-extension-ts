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

import { Logger } from '@xpack/logger'

import {
  ExtensionManager,
  BuildConfigurationPick
} from './manager'

import {
  TreeItem,
  TreeItemAction
} from './explorer'

// ----------------------------------------------------------------------------

/**
 * A class to manage commands.
 */
export class Commands implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  // Factory method pattern.
  static async register (
    extensionManager: ExtensionManager
  ): Promise<Commands> {
    const _commands = new Commands(extensionManager)
    extensionManager.subscriptions.push(_commands)

    const log = extensionManager.log

    // Add possible async calls here.

    log.trace('Commands object created')
    return _commands
  }

  // --------------------------------------------------------------------------
  // Members.

  readonly log: Logger

  readonly manager: ExtensionManager
  private _buildConfigurationPicks: BuildConfigurationPick[] | undefined

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (manager: ExtensionManager) {
    this.manager = manager
    this.log = manager.log

    manager.addCallbackRefresh(
      async () => {
        this.refresh()
      }
    )

    const context: vscode.ExtensionContext = manager.vscodeContext

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.treeViewRefresh',
        this.refreshTreeView,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.runAction',
        this.runAction,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.selectBuildConfiguration',
        this.selectBuildConfiguration,
        this
      )
    )
  }

  // --------------------------------------------------------------------------
  // Methods.

  /**
   * Refresh the explorer tree view.
   */
  async refreshTreeView (): Promise<void> {
    const log = this.log

    log.trace('Command.refreshTreeView()')
    await this.manager.refresh()
  }

  /**
   * Run an action.
   *
   * @param treeItem - When invoked by the tree viewer it gets the
   * TreeItem where the invocation occured.
   */
  async runAction (treeItem: TreeItem): Promise<void> {
    const log = this.log

    log.trace('Command.runAction()')
    if (treeItem instanceof TreeItemAction) {
      log.trace(treeItem)
      await treeItem.runTask()
    } else {
      throw new Error('treeItem not yet implemented')
    }
  }

  /**
   * Select the build configuration.
   */
  async selectBuildConfiguration (): Promise<void> {
    const log = this.log

    log.trace('Command.selectBuildConfiguration()')

    if (this._buildConfigurationPicks === undefined) {
      this._buildConfigurationPicks =
        this.manager.data.configurations.map(
          (dataNode) => {
            return new BuildConfigurationPick(dataNode)
          }
        )
    }
    const pick = await vscode.window.showQuickPick<BuildConfigurationPick>(
      this._buildConfigurationPicks,
      {
        placeHolder: 'Select the build configuration for IntelliSense ' +
          '(not yet functional)'
      }
    )

    log.trace(pick)
    if (pick !== undefined) {
      this.manager.setBuildConfiguration(pick.dataNode)
    }
  }

  // --------------------------------------------------------------------------

  refresh (): void {
    const log = this.log

    log.trace('Commands.refresh()')

    this._buildConfigurationPicks = undefined
  }

  // --------------------------------------------------------------------------

  dispose (): void {
    const log = this.log

    log.trace('Commands.dispose()')
    // Nothing to do
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
