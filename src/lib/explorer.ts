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

import * as path from 'path'

import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'

import { ExtensionManager } from './manager'

import {
  DataNodeAction,
  DataNodeConfiguration,
  DataNodePackage
} from './data-model'

import {
  PackageJson,
  packageJsonFileName
} from './definitions'

// ----------------------------------------------------------------------------

type ActionsTree = TreeItemPackage[] | TreeItemEmpty[]
type TreeItemActionParent = TreeItemPackage | TreeItemConfiguration
type TreeItemPackageChild = TreeItemAction | TreeItemConfiguration

// ----------------------------------------------------------------------------

export class Explorer implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  static async register (
    manager: ExtensionManager
  ): Promise<Explorer> {
    const _explorer = new Explorer(manager)
    manager.subscriptions.push(_explorer)

    const log = manager.log

    // Add possible async calls here.

    log.trace('Explorer object created')
    return _explorer
  }

  // --------------------------------------------------------------------------
  // Members.

  readonly log: Logger

  private readonly _treeDataProvider: XpackActionsTreeDataProvider
  private readonly _treeView: vscode.TreeView<vscode.TreeItem>

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (readonly manager: ExtensionManager) {
    this.log = manager.log

    const log = this.log

    this._treeDataProvider =
      new XpackActionsTreeDataProvider(manager)

    const context: vscode.ExtensionContext = manager.vscodeContext

    manager.addCallbackRefresh(
      async () => {
        this._treeDataProvider.refresh()
      }
    )

    this._treeView = vscode.window.createTreeView(
      'xPackActions',
      {
        treeDataProvider: this._treeDataProvider,
        showCollapseAll: true
      }
    )
    context.subscriptions.push(this._treeView)
    log.trace('tree view xPackActions registered')
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose (): void {
    const log = this.log

    log.trace('Explorer.dispose()')
    // Nothing to do
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------

/**
 * Base class for all tree items.
 *
 * @description
 * Makes sure that all classes have a parent and implement get children(),
 * to simplify the data provider.
 */
export class TreeItem extends vscode.TreeItem {
  // --------------------------------------------------------------------------
  // Members.

  name: string
  parent: TreeItem | null = null

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    name: string
  ) {
    super(label, collapsibleState)

    this.name = name
  }

  // --------------------------------------------------------------------------
  // Getters & Setters.

  get children (): TreeItem[] {
    return []
  }
}

// ----------------------------------------------------------------------------

class TreeItemPackage extends TreeItem {
  // --------------------------------------------------------------------------
  // Members.

  // Inherit the null parent and name.
  readonly packageJsonPath: string

  readonly actions: TreeItemAction[] = []
  readonly configurations: TreeItemConfiguration[] = []

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (dataNode: DataNodePackage) {
    super(path.join(dataNode.folderRelativePath, packageJsonFileName),
      vscode.TreeItemCollapsibleState.Expanded,
      dataNode.name)

    this.packageJsonPath = path.join(dataNode.folderPath, packageJsonFileName)

    this.iconPath = new vscode.ThemeIcon('symbol-package')
    // this.description = 'Package actions'
    this.resourceUri =
      vscode.Uri.file(path.join(dataNode.folderPath, packageJsonFileName))
    this.tooltip = 'xPack'
    this.contextValue = 'packageJson'

    const packageJson: PackageJson = dataNode.packageJson
    const packageName: string = packageJson.name
    const packageVersion: string = packageJson.version
    this.description = `(${packageName}@${packageVersion})`
  }

  // --------------------------------------------------------------------------
  // Methods.

  addAction (
    actionName: string,
    actionValue: string[],
    task: vscode.Task
  ): TreeItemAction {
    const treeItem = new TreeItemAction(actionName, actionValue, task, this)
    this.actions.push(treeItem)
    return treeItem
  }

  addConfiguration (
    configurationName: string
  ): TreeItemConfiguration {
    const treeItem = new TreeItemConfiguration(configurationName, this)
    this.configurations.push(treeItem)
    return treeItem
  }

  get children (): TreeItemPackageChild[] {
    return [...this.actions, ...this.configurations]
  }
}

// ----------------------------------------------------------------------------

export class TreeItemAction extends TreeItem {
  // --------------------------------------------------------------------------
  // Members.

  readonly parent: TreeItemActionParent
  readonly actionValue: string[]
  readonly task: vscode.Task

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (
    actionName: string,
    actionValue: string[],
    task: vscode.Task,
    parent: TreeItemActionParent
  ) {
    super(actionName, vscode.TreeItemCollapsibleState.None, actionName)

    this.parent = parent
    this.task = task

    this.actionValue = actionValue

    this.iconPath = new vscode.ThemeIcon('wrench')
    this.tooltip = this.actionValue.join('\n')
    this.contextValue = 'action'
    let packageJsonPath: string = ''
    if (parent.name !== '') {
      if (parent instanceof TreeItemConfiguration) {
        const relativePath = parent.parent.name
        if (relativePath !== '') {
          this.description = `(${parent.name} - ${relativePath})`
        } else {
          this.description = `(${parent.name})`
        }
        packageJsonPath = parent.parent.packageJsonPath
      } else if (parent instanceof TreeItemPackage) {
        this.description = `(${parent.name})`
        packageJsonPath = parent.packageJsonPath
      }
    } else {
      if (parent instanceof TreeItemConfiguration) {
        const relativePath = parent.parent.name
        if (relativePath !== '') {
          this.description = `(${relativePath})`
        }
        packageJsonPath = parent.parent.packageJsonPath
      } else if (parent instanceof TreeItemPackage) {
        packageJsonPath = parent.packageJsonPath
      }
    }

    // The command to run when clicking the action item in the tree.
    this.command = {
      title: 'Edit Script',
      command: 'vscode.open',
      arguments: [
        vscode.Uri.file(packageJsonPath)
        // TODO: add location (range of lines).
      ]
    }
  }

  // --------------------------------------------------------------------------
  // Methods.

  async runTask (): Promise<vscode.TaskExecution> {
    return await vscode.tasks.executeTask(this.task)
  }
}

// ----------------------------------------------------------------------------

class TreeItemConfiguration extends TreeItem {
  // --------------------------------------------------------------------------
  // Members.

  readonly parent: TreeItemPackage
  readonly actions: TreeItemAction[] = []

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (
    configurationName: string,
    parent: TreeItemPackage
  ) {
    super(
      configurationName,
      vscode.TreeItemCollapsibleState.Collapsed,
      configurationName
    )

    this.parent = parent

    this.iconPath = vscode.ThemeIcon.Folder
    this.tooltip = 'xPack build configuration'
    this.contextValue = 'folder'
    this.description = '(configuration)'
  }

  // --------------------------------------------------------------------------
  // Methods.

  addAction (
    actionName: string,
    actionValue: string[],
    task: vscode.Task
  ): TreeItemAction {
    const treeItem = new TreeItemAction(actionName, actionValue, task, this)
    this.actions.push(treeItem)
    return treeItem
  }

  get children (): TreeItemAction[] {
    return this.actions
  }
}

// ----------------------------------------------------------------------------

// An empty tree when there are no xPacks.
class TreeItemEmpty extends TreeItem {
  // --------------------------------------------------------------------------
  // Constructors.

  constructor (message: string) {
    super(message, vscode.TreeItemCollapsibleState.None, '')

    this.contextValue = 'empty'
    this.tooltip = 'xPacks need the xpack property in package.json.'
  }
}

// ----------------------------------------------------------------------------

/**
 * The data provider for the xPack Actions tree view.
 */
export class XpackActionsTreeDataProvider implements
  vscode.TreeDataProvider<TreeItem> {
  // --------------------------------------------------------------------------
  // Members.

  readonly log: Logger
  readonly manager: ExtensionManager

  // Lazy creation at first use and after Refresh.
  private _tree: ActionsTree | null = null

  private readonly _onDidChangeTreeData: vscode.EventEmitter<TreeItem | null> =
  new vscode.EventEmitter<TreeItem | null>()

  readonly onDidChangeTreeData: vscode.Event<TreeItem | null> =
  this._onDidChangeTreeData.event

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (
    manager: ExtensionManager
  ) {
    this.manager = manager
    this.log = manager.log
  }

  // --------------------------------------------------------------------------
  // Methods.

  private async _createTree (): Promise<ActionsTree> {
    const log = this.log

    const tree: TreeItemPackage[] = []

    // Basically replicate the data model tree created by the manager.

    if (this.manager.data.packages.length === 0) {
      return [new TreeItemEmpty('No xPacks identified.')]
    }

    this.manager.data.packages.forEach(
      (dataNodePackage) => {
        const treeItemPackage = new TreeItemPackage(dataNodePackage)
        tree.push(treeItemPackage)

        this._addActions(dataNodePackage.actions, treeItemPackage)
        this._addConfigurations(dataNodePackage.configurations, treeItemPackage)
      }
    )

    log.trace('items tree created')
    return tree
  }

  private _addActions (
    dataNodeActions: DataNodeAction[],
    parentTreeItem: TreeItemPackage | TreeItemConfiguration
  ): void {
    dataNodeActions.forEach(
      (dataNodeAction) => {
        parentTreeItem.addAction(
          dataNodeAction.name, dataNodeAction.value, dataNodeAction.task)
      }
    )
  }

  private _addConfigurations (
    dataNodeConfigurations: DataNodeConfiguration[],
    parentTreeItem: TreeItemPackage
  ): void {
    dataNodeConfigurations.forEach(
      (dataNodeConfiguration) => {
        const treeItemConfiguration =
          parentTreeItem.addConfiguration(dataNodeConfiguration.name)

        this._addActions(dataNodeConfiguration.actions, treeItemConfiguration)
      }
    )
  }

  // --------------------------------------------------------------------------

  refresh (): void {
    const log = this.log

    log.trace('XpackActionsTreeDataProvider.refresh()')

    this._tree = null
    this._onDidChangeTreeData.fire(null)
  }

  getTreeItem (element: TreeItem): TreeItem {
    return element
  }

  async getChildren (
    element?: TreeItem
  ): Promise<TreeItem[]> {
    // log.trace('getChildren', element)

    // Lazy creation, delay to first use or after 'Refresh'.
    if (this._tree === null) {
      this._tree = await this._createTree()
    }

    if (element === undefined) {
      return this._tree
    }

    if (element instanceof TreeItem) {
      return element.children
    } else {
      return []
    }
  }

  getParent (
    element: TreeItem
  ): TreeItem | null {
    // log.trace('getParent', element)

    if (element instanceof TreeItem) {
      return element.parent
    } else {
      return null
    }
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
