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

// This class is a direct dependency for all worker classes.

// ----------------------------------------------------------------------------

import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'

import {
  DataModel,
  DataNodeConfiguration
} from './data-model'

import {
  AsyncVoidFunction
} from './definitions'

// ----------------------------------------------------------------------------

// TODO: make the depth configurable.
const _maxSearchDepth: number = 3

// ----------------------------------------------------------------------------

export class ExtensionManager implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Members.

  vscodeContext: vscode.ExtensionContext
  log: Logger

  callbacksRefresh: AsyncVoidFunction[] = []

  data: DataModel
  tasks: vscode.Task[] = []

  selectedBuildConfiguration: DataNodeConfiguration | undefined

  subscriptions: vscode.Disposable[] = []

  onSelectBuildConfiguration: vscode.EventEmitter<DataNodeConfiguration> =
  new vscode.EventEmitter<DataNodeConfiguration>()

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (context: vscode.ExtensionContext, log: Logger) {
    this.vscodeContext = context
    this.log = log

    this.data = new DataModel(this.log, _maxSearchDepth)
  }

  // --------------------------------------------------------------------------
  // Methods.

  hasLocalWorkspace (): boolean {
    if (vscode.workspace.workspaceFolders != null) {
      return vscode.workspace.workspaceFolders.some(
        (workspaceFolder) => {
          return (workspaceFolder.uri.scheme === 'file')
        }
      )
    }
    return false
  }

  addCallbackRefresh (func: AsyncVoidFunction): void {
    this.callbacksRefresh.push(func)
  }

  async refresh (): Promise<void> {
    const log = this.log

    // Always run the data model refresh first.
    await this.data.refresh()

    // Enable the explorer only if there were xPacks identified.
    await vscode.commands.executeCommand(
      'setContext',
      'xpack:showScriptExplorer',
      (this.data.packages.length > 0)
    )
    log.debug('Explorer ' + (
      this.data.packages.length > 0
        ? 'shown'
        : 'hidden')
    )

    // Use loop, not async Promise.all(), to preserve the order.
    for (const func of this.callbacksRefresh) {
      await func()
    }
  }

  // --------------------------------------------------------------------------

  setBuildConfiguration (treeNode: DataNodeConfiguration): void {
    this.selectedBuildConfiguration = treeNode

    this.onSelectBuildConfiguration.fire(treeNode)
  }

  // --------------------------------------------------------------------------

  dispose (): void {
    this.subscriptions.forEach(
      (element) => {
        element.dispose()
      }
    )
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------

export class BuildConfigurationPick implements vscode.QuickPickItem {
  // --------------------------------------------------------------------------
  // Members.

  label: string
  description?: string
  dataNode: DataNodeConfiguration

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (
    dataNode: DataNodeConfiguration
  ) {
    this.label = dataNode.name
    const relativePath = (dataNode.parent).name
    if (relativePath !== '') {
      this.description = `(${relativePath})`
    }
    this.dataNode = dataNode
  }
}

// ----------------------------------------------------------------------------
