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

  readonly extensionManager: ExtensionManager
  private _buildConfigurationPicks: BuildConfigurationPick[] | undefined

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (extensionManager: ExtensionManager) {
    this.extensionManager = extensionManager
    this.log = extensionManager.log

    extensionManager.addRefreshFunction(
      async () => {
        this.refresh()
      }
    )

    const context: vscode.ExtensionContext = extensionManager.vscodeContext

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.treeViewRefresh',
        this.treeViewRefresh,
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

  async treeViewRefresh (): Promise<void> {
    const log = this.log

    log.trace('Command.treeViewRefresh()')
    await this.extensionManager.runRefreshFunctions()
  }

  // When invoked by the tree viewer it get the tree item where it occured.
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

  async selectBuildConfiguration (): Promise<void> {
    const log = this.log

    log.trace('Command.selectBuildConfiguration()')

    if (this._buildConfigurationPicks === undefined) {
      this._buildConfigurationPicks =
        this.extensionManager.buildConfigurations.map(
          (treeNode) => {
            return new BuildConfigurationPick(treeNode)
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
      this.extensionManager.setBuildConfiguration(pick.treeNode)
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
