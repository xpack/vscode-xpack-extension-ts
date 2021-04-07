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

import {
  ExtensionManager,
  XpackFolderPath,
  TreeNodeAction,
  TreeNodeBuildConfiguration,
  // TreeNodePackage,
  JsonActionValue
} from './manager'

// ----------------------------------------------------------------------------

const _packageJson: string = 'package.json'

type ActionsTree = TreeItemPackageJson[] | TreeItemEmpty[]
type TreeItemParent = TreeItemPackageJson | TreeItemBuildConfiguration
type TreeItemChild = TreeItemAction | TreeItemBuildConfiguration

// ----------------------------------------------------------------------------

export class Explorer implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  static async register (
    extensionManager: ExtensionManager
  ): Promise<Explorer> {
    const _explorer = new Explorer(extensionManager)
    extensionManager.subscriptions.push(_explorer)

    const log = extensionManager.log

    // Add possible async calls here.

    log.trace('Explorer object created')
    return _explorer
  }

  readonly log: Logger

  private readonly _treeDataProvider: XpackActionsTreeDataProvider
  private readonly _treeView: vscode.TreeView<vscode.TreeItem>

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (readonly extensionManager: ExtensionManager) {
    this.log = extensionManager.log

    const log = this.log

    this._treeDataProvider =
      new XpackActionsTreeDataProvider(extensionManager)

    const context: vscode.ExtensionContext = extensionManager.vscodeContext

    extensionManager.addRefreshFunction(
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
 * @summary Base class for all tree items.
 *
 * @description
 * Makes sure that all classes implement getParent() and getChildren(),
 * to simplify the data provider.
 */
export class TreeItem extends vscode.TreeItem {
  getParent (): TreeItem | null {
    return null
  }

  getChildren (): TreeItem[] {
    return []
  }
}

// ----------------------------------------------------------------------------

class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  refresh (): void { }

  getTreeItem (element: TreeItem): TreeItem {
    return element
  }

  async getChildren (_element?: TreeItem): Promise<TreeItem[]> {
    return []
  }
}

// ----------------------------------------------------------------------------

class TreeItemPackageJson extends TreeItem {
  private readonly _actions: TreeItemAction[] = []
  private readonly _buildConfigurations: TreeItemBuildConfiguration[] = []
  private readonly _name: string
  private readonly _path: string

  constructor (xpackFolderPath: XpackFolderPath) {
    super(path.join(xpackFolderPath.relativePath, _packageJson),
      vscode.TreeItemCollapsibleState.Expanded)

    this._name = xpackFolderPath.relativePath
    this._path = path.join(xpackFolderPath.path, _packageJson)
    this.iconPath = new vscode.ThemeIcon('symbol-package')
    // this.description = 'Package actions'
    this.resourceUri =
      vscode.Uri.file(path.join(xpackFolderPath.path, _packageJson))
    this.tooltip = 'xPack'
    this.contextValue = 'packageJson'

    const packageJson: any = xpackFolderPath.packageJson
    const packageName: string = packageJson.name
    const packageVersion: string = packageJson.version
    this.description = `(${packageName}@${packageVersion})`
  }

  addAction (
    actionName: string,
    actionValue: JsonActionValue,
    task: vscode.Task
  ): TreeItemAction {
    const treeItem = new TreeItemAction(actionName, actionValue, task, this)
    this._actions.push(treeItem)
    return treeItem
  }

  addBuildConfiguration (
    buildConfigurationName: string
  ): TreeItemBuildConfiguration {
    const treeItem =
      new TreeItemBuildConfiguration(buildConfigurationName, this)
    this._buildConfigurations.push(treeItem)
    return treeItem
  }

  getChildren (): TreeItemChild[] {
    return [...this._actions, ...this._buildConfigurations]
  }

  getName (): string {
    return this._name
  }

  getPath (): string {
    return this._path
  }
}

// ----------------------------------------------------------------------------

export class TreeItemAction extends TreeItem {
  private readonly _parent: TreeItemParent
  private readonly _actionValue: string[]
  private readonly _task: vscode.Task
  private readonly _name: string

  constructor (
    actionName: string,
    actionValue: JsonActionValue,
    task: vscode.Task,
    parent: TreeItemParent
  ) {
    super(actionName, vscode.TreeItemCollapsibleState.None)

    this._name = actionName
    this._task = task
    this._parent = parent
    if (Array.isArray(actionValue)) {
      this._actionValue = actionValue
    } else {
      this._actionValue = [actionValue]
    }

    this.iconPath = new vscode.ThemeIcon('wrench')
    this.tooltip = this._actionValue.join('\n')
    this.contextValue = 'action'
    let packageJsonPath: string = ''
    if (parent instanceof TreeItemBuildConfiguration) {
      this.description =
        `(${parent.getName()} - ${parent.getParent().getName()})`
      packageJsonPath = parent.getParent().getPath()
    } else if (parent instanceof TreeItemPackageJson) {
      this.description = `(${parent.getName()})`
      packageJsonPath = parent.getPath()
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

  getParent (): TreeItemParent {
    return this._parent
  }

  async runTask (): Promise<vscode.TaskExecution> {
    return await vscode.tasks.executeTask(this._task)
  }

  getName (): string {
    return this._name
  }
}

// ----------------------------------------------------------------------------

class TreeItemBuildConfiguration extends TreeItem {
  private readonly _parent: TreeItemPackageJson
  private readonly _actions: TreeItemAction[] = []
  private readonly _name: string

  constructor (
    buildConfigurationName: string,
    parent: TreeItemPackageJson
  ) {
    super(buildConfigurationName, vscode.TreeItemCollapsibleState.Expanded)

    this._name = buildConfigurationName
    this.iconPath = vscode.ThemeIcon.Folder
    this.tooltip = 'xPack build configuration'
    this.contextValue = 'folder'
    this.description = '(configuration)'

    this._parent = parent
  }

  addAction (
    actionName: string,
    actionValue: JsonActionValue,
    task: vscode.Task
  ): TreeItemAction {
    const treeItem = new TreeItemAction(actionName, actionValue, task, this)
    this._actions.push(treeItem)
    return treeItem
  }

  getChildren (): TreeItemAction[] {
    return this._actions
  }

  getName (): string {
    return this._name
  }

  getParent (): TreeItemPackageJson {
    return this._parent
  }
}

// ----------------------------------------------------------------------------

// An empty tree when there are no xPacks/action.
class TreeItemEmpty extends TreeItem {
  constructor (message: string) {
    super(message, vscode.TreeItemCollapsibleState.None)
    this.contextValue = 'empty'
    this.tooltip =
      'xPack actions can be defined as xpack.actions.* in package.json.'
  }
}

// ----------------------------------------------------------------------------

/**
 * @summary The data provider for the xPack Actions tree view.
 */
export class XpackActionsTreeDataProvider extends TreeDataProvider {
  readonly log: Logger
  readonly extensionManager: ExtensionManager

  // Lazy creation at first use and after Refresh.
  private _tree: ActionsTree | null = null

  private readonly _onDidChangeTreeData: vscode.EventEmitter<TreeItem | null> =
  new vscode.EventEmitter<TreeItem | null>()

  readonly onDidChangeTreeData: vscode.Event<TreeItem | null> =
  this._onDidChangeTreeData.event

  // --------------------------------------------------------------------------

  constructor (
    extensionManager: ExtensionManager
  ) {
    super()

    this.extensionManager = extensionManager
    this.log = extensionManager.log
  }

  // --------------------------------------------------------------------------

  private async _createTree (): Promise<ActionsTree> {
    const log = this.log

    const tree: TreeItemPackageJson[] = []

    // Basically replicate the tree built by the manager.

    if (this.extensionManager.tasksTree.length === 0) {
      return [new TreeItemEmpty('No xPack actions identified.')]
    }

    this.extensionManager.tasksTree.forEach(
      (treeNodePackage) => {
        const xpackFolderPath = treeNodePackage.xpackFolderPath

        const treeItemPackage = new TreeItemPackageJson(xpackFolderPath)
        tree.push(treeItemPackage)

        this._addActions(treeNodePackage.actions, treeItemPackage)

        this._addBuildConfigurations(
          treeNodePackage.buildConfigurations,
          treeItemPackage
        )
      }
    )

    log.trace('tree created')
    return tree
  }

  private _addActions (
    nodeActions: TreeNodeAction[],
    toTreeItem: TreeItemPackageJson | TreeItemBuildConfiguration
  ): void {
    nodeActions.forEach(
      (node) => {
        toTreeItem.addAction(node.name, node.value, node.task)
      }
    )
  }

  private _addBuildConfigurations (
    nodeBuildConfiguration: TreeNodeBuildConfiguration[],
    toTreeItem: TreeItemPackageJson
  ): void {
    nodeBuildConfiguration.forEach(
      (node) => {
        const treeItemConfiguration =
            toTreeItem.addBuildConfiguration(node.name)

        this._addActions(node.actions, treeItemConfiguration)
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
      return element.getChildren()
    } else {
      return []
    }
  }

  getParent (
    element: vscode.TreeItem
  ): vscode.TreeItem | null {
    // log.trace('getParent', element)

    if (element instanceof TreeItem) {
      return element.getParent()
    } else {
      return null
    }
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
