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

import * as os from 'os'

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

export class ExtensionManager implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Members.

  vscodeContext: vscode.ExtensionContext
  log: Logger

  callbacksRefresh: AsyncVoidFunction[] = []

  data: DataModel
  dataCandidates: Set<DataModel> = new Set()

  watcherPackageJson: vscode.FileSystemWatcher | undefined

  selectedBuildConfiguration: DataNodeConfiguration | undefined

  subscriptions: vscode.Disposable[] = []

  onSelectBuildConfiguration: vscode.EventEmitter<DataNodeConfiguration> =
  new vscode.EventEmitter<DataNodeConfiguration>()

  maxSearchDepthLevel: number

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (context: vscode.ExtensionContext, log: Logger) {
    this.vscodeContext = context
    this.log = log

    log.debug(`node: ${process.version}`)
    log.debug(`home: '${os.homedir()}'`)

    this.maxSearchDepthLevel =
      vscode.workspace.getConfiguration('xpack')
        .get<number>('maxSearchDepthLevel', 3)
    this.data = new DataModel(this.log, this.maxSearchDepthLevel)
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

    log.trace('ExtensionManager.refresh()')

    // Mark all existing candidates as obsolete, such that
    // only the last one will survive.
    this.dataCandidates.forEach(
      (data) => {
        log.debug('ExtensionManager.refresh() cancel previous')
        data.cancellation.cancel()
      }
    )
    const data = new DataModel(this.log, this.maxSearchDepthLevel)
    this.dataCandidates.add(data)

    // Start the tree creation process; it might not be ready
    // before another request comes.
    await data.createTree()

    this.dataCandidates.delete(data)

    if (data.cancellation.token.isCancellationRequested) {
      log.debug('ExtensionManager.refresh() cancelled')
      return
    }

    // If no one requested this token cancellation, it is the winner.
    const oldData = this.data
    this.data = data
    oldData.dispose()

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

    log.trace('ExtensionManager.refresh() completed')
  }

  // --------------------------------------------------------------------------

  async updateConfigurationNpmExclude (): Promise<void> {
    const log = this.log

    if (!vscode.workspace.getConfiguration('xpack')
      .get<boolean>('autoUpdateNpmExclude', true)) {
      return
    }

    const npm: vscode.WorkspaceConfiguration =
     vscode.workspace.getConfiguration('npm')

    const inspectedValue = npm.inspect('exclude')
    log.trace(inspectedValue)
    const isGlobal = inspectedValue !== undefined &&
      inspectedValue.workspaceValue === undefined

    const oldValue: string | string[] | undefined = npm.get('exclude')
    log.trace(oldValue)

    const oldArray = oldValue === undefined || oldValue === '' ? []
      : (Array.isArray(oldValue) ? oldValue : [oldValue])

    const newValue = '**/xpacks/**'
    const alreadyIn = oldArray.some((value) => value === newValue)

    const newArray = [...oldArray, newValue]
    if (!alreadyIn) {
      await npm.update('exclude', newArray, isGlobal)
      log.info(`npm.exclude=${newArray.join()}`)
    }
  }

  // --------------------------------------------------------------------------

  // Currently not used.
  setBuildConfiguration (treeNode: DataNodeConfiguration): void {
    this.selectedBuildConfiguration = treeNode

    this.onSelectBuildConfiguration.fire(treeNode)
  }

  /**
   * Register listeners to refresh the explorer when packages change.
   */
  registerPackageJsonWatchers (): void {
    const log = this.log

    // Register only once.
    if (this.watcherPackageJson === undefined &&
      vscode.workspace.workspaceFolders !== undefined) {
      log.trace('registerPackageJsonWatchers()')
      const watcherPackageJson =
      vscode.workspace.createFileSystemWatcher('**/package.json')
      watcherPackageJson.onDidChange(
        async (e): Promise<void> => {
          log.trace(`onDidChange() ${e.fsPath}`)
          await this.refresh()
        }
      )
      watcherPackageJson.onDidDelete(
        async (e): Promise<void> => {
          log.trace(`onDidDelete() ${e.fsPath}`)
          await this.refresh()
        }
      )
      watcherPackageJson.onDidCreate(
        async (e): Promise<void> => {
          log.trace(`onDidCreate() ${e.fsPath}`)
          await this.refresh()
        }
      )
      this.vscodeContext.subscriptions.push(watcherPackageJson)

      this.watcherPackageJson = watcherPackageJson
    }
  }

  /**
   * Register a watcher to detect when the workspace folders change.
   */
  registerWorkspaceFoldersWatcher (): void {
    const log = this.log

    log.trace('registerWorkspaceFoldersWatcher()')
    const watcherWorkspaceFolders =
    vscode.workspace.onDidChangeWorkspaceFolders(
      async (e) => {
        log.trace('onDidChangeWorkspaceFolders() ' +
          `+${e.added.length} -${e.removed.length}`)

        this.registerPackageJsonWatchers()
        await this.refresh()
      }
    )
    this.vscodeContext.subscriptions.push(watcherWorkspaceFolders)
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
// Not yet used, the C/C++ configuration picker is used instead.

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
