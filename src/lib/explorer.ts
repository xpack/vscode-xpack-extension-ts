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

/**
 * To locate commands use:
 * - `view == xPackActions` (set via createTreeView())
 * - `viewItem == action | command | configuration | package
 * (set via treeItem.contextValue)
 */

import * as path from 'path'

import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'

import { ExtensionManager } from './manager'

import {
  DataNodeAction,
  DataNodeCommand,
  DataNodeConfiguration,
  DataNodePackage
} from './data-model'

import {
  XpackPackageJson,
  packageJsonFileName
} from './definitions'

// ----------------------------------------------------------------------------

type ActionsTree = TreeItemPackage[] | TreeItemEmpty[]
type TreeItemRunnableParent = TreeItemPackage | TreeItemConfiguration
type TreeItemPackageChild = TreeItemCommand | TreeItemAction |
TreeItemConfiguration
type TreeItemConfigurationChild = TreeItemCommand | TreeItemAction

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
  // Constructor.

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

    this._treeView.dispose()
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
export class TreeItem extends vscode.TreeItem implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Members.

  name: string
  parent: TreeItem | null = null

  // --------------------------------------------------------------------------
  // Constructor.

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

  // --------------------------------------------------------------------------
  // Methods.

  dispose (): void {
    this.name = undefined as unknown as string
    this.parent = undefined as unknown as TreeItem
  }
}

// ----------------------------------------------------------------------------

export class TreeItemPackage extends TreeItem {
  // --------------------------------------------------------------------------
  // Members.

  // Inherit the null parent and name.
  packageJsonPath: string

  commands: TreeItemCommand[] = []
  actions: TreeItemAction[] = []
  configurations: TreeItemConfiguration[] = []

  dataNode: DataNodePackage

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (dataNode: DataNodePackage) {
    super(path.join(dataNode.folderRelativePath, packageJsonFileName),
      vscode.TreeItemCollapsibleState.Expanded,
      dataNode.name)

    this.packageJsonPath = path.join(dataNode.folderPath, packageJsonFileName)
    this.dataNode = dataNode

    const packageJson: XpackPackageJson = dataNode.packageJson
    const packageName: string = packageJson.name
    const packageVersion: string = packageJson.version

    // Tree item properties.
    this.iconPath = new vscode.ThemeIcon('symbol-package')
    this.resourceUri = vscode.Uri.file(this.packageJsonPath)
    this.tooltip = `The '${packageName}@${packageVersion}' xPack at ` +
      `'${this.packageJsonPath}'`
    this.contextValue = 'package'
    this.description = `(${packageName})`
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  get children (): TreeItemPackageChild[] {
    return [...this.commands, ...this.actions, ...this.configurations]
  }

  get package (): TreeItemPackage {
    return this
  }

  // --------------------------------------------------------------------------
  // Methods.

  addCommand (
    commandName: string,
    task: vscode.Task
  ): TreeItemCommand {
    const treeItem = new TreeItemCommand(commandName, task, this)
    this.commands.push(treeItem)
    return treeItem
  }

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
    dataNode: DataNodeConfiguration
  ): TreeItemConfiguration {
    const treeItem = new TreeItemConfiguration(dataNode, this)
    this.configurations.push(treeItem)
    return treeItem
  }

  dispose (): void {
    this.commands.forEach(
      (node) => node.dispose())
    this.commands = undefined as unknown as TreeItemCommand[]

    this.actions.forEach(
      (node) => node.dispose())
    this.actions = undefined as unknown as TreeItemAction[]

    this.configurations.forEach(
      (node) => node.dispose())
    this.configurations = undefined as unknown as TreeItemConfiguration[]

    super.dispose()
  }
}

// ----------------------------------------------------------------------------

// Internal, not exported.
class TreeItemRunnable extends TreeItem {
  // --------------------------------------------------------------------------
  // Members.

  task: vscode.Task
  parent: TreeItemRunnableParent

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (
    name: string,
    task: vscode.Task,
    parent: TreeItemRunnableParent
  ) {
    super(name, vscode.TreeItemCollapsibleState.None, name)

    this.parent = parent
    this.task = task

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

    // The command to run when clicking the command item in the tree.
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

  dispose (): void {
    this.parent = undefined as unknown as TreeItemRunnableParent
    this.task = undefined as unknown as vscode.Task

    super.dispose()
  }
}

// ----------------------------------------------------------------------------

export class TreeItemCommand extends TreeItemRunnable {
  // --------------------------------------------------------------------------
  // Members.

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (
    commandName: string,
    task: vscode.Task,
    parent: TreeItemRunnableParent
  ) {
    super(commandName, task, parent)

    this.iconPath = new vscode.ThemeIcon('wrench-subaction')
    this.tooltip = `xpm ${commandName}`
    this.contextValue = 'command'
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose (): void {
    super.dispose()
  }
}

// ----------------------------------------------------------------------------

export class TreeItemAction extends TreeItemRunnable {
  // --------------------------------------------------------------------------
  // Members.

  actionValue: string[]

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (
    actionName: string,
    actionValue: string[],
    task: vscode.Task,
    parent: TreeItemRunnableParent
  ) {
    super(actionName, task, parent)

    this.actionValue = actionValue

    this.iconPath = new vscode.ThemeIcon('wrench')
    this.tooltip = this.actionValue.join('\n')
    this.contextValue = 'action'
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose (): void {
    this.actionValue = undefined as unknown as string[]

    super.dispose()
  }
}

// ----------------------------------------------------------------------------

export class TreeItemConfiguration extends TreeItem {
  // --------------------------------------------------------------------------
  // Members.

  parent: TreeItemPackage
  commands: TreeItemCommand[] = []
  actions: TreeItemAction[] = []

  dataNode: DataNodeConfiguration

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (
    dataNode: DataNodeConfiguration,
    parent: TreeItemPackage
  ) {
    super(
      dataNode.name,
      vscode.TreeItemCollapsibleState.Collapsed,
      dataNode.name
    )

    this.dataNode = dataNode
    this.parent = parent

    const packageJson: XpackPackageJson = parent.dataNode.packageJson
    const packageName: string = packageJson.name
    const packageVersion: string = packageJson.version

    // Tree item properties.
    this.iconPath = vscode.ThemeIcon.Folder
    this.tooltip = `The ${this.name} build configuration ` +
      `of the '${packageName}@${packageVersion}' xPack`
    this.contextValue = 'configuration'
    this.description = `(${packageName})`
  }

  // --------------------------------------------------------------------------
  // Getters & Setters.

  get children (): TreeItemConfigurationChild[] {
    return [...this.commands, ...this.actions]
  }

  get package (): TreeItemPackage {
    return this.parent
  }

  // --------------------------------------------------------------------------
  // Methods.

  addCommand (
    commandName: string,
    task: vscode.Task
  ): TreeItemCommand {
    const treeItem = new TreeItemCommand(commandName, task, this)
    this.commands.push(treeItem)
    return treeItem
  }

  addAction (
    actionName: string,
    actionValue: string[],
    task: vscode.Task
  ): TreeItemAction {
    const treeItem = new TreeItemAction(actionName, actionValue, task, this)
    this.actions.push(treeItem)
    return treeItem
  }

  dispose (): void {
    this.parent = undefined as unknown as TreeItemPackage

    this.commands.forEach(
      (node) => node.dispose())
    this.commands = undefined as unknown as TreeItemCommand[]

    this.actions.forEach(
      (node) => node.dispose())
    this.actions = undefined as unknown as TreeItemAction[]

    super.dispose()
  }
}

// ----------------------------------------------------------------------------

// An empty tree when there are no xPacks.
class TreeItemEmpty extends TreeItem {
  // --------------------------------------------------------------------------
  // Constructor.

  constructor (message: string) {
    super(message, vscode.TreeItemCollapsibleState.None, '')

    this.contextValue = 'empty'
    this.tooltip = 'xPacks need the xpack property in package.json.'
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose (): void {
    super.dispose()
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

  private readonly _onDidChangeTreeDataEmitter:
  vscode.EventEmitter<TreeItem | null> =
      new vscode.EventEmitter<TreeItem | null>()

  readonly onDidChangeTreeData: vscode.Event<TreeItem | null> =
    this._onDidChangeTreeDataEmitter.event

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (
    manager: ExtensionManager
  ) {
    this.manager = manager
    this.log = manager.log
  }

  // --------------------------------------------------------------------------
  // Methods.

  /**
   * Create the view tree, based on the data tree.
   *
   * @returns An array of top nodes.
   */
  private _createTree (): ActionsTree {
    const log = this.log

    log.trace('XpackActionsTreeDataProvider._createTree()')

    const tree: TreeItemPackage[] = []

    // Basically replicate the data model tree created by the manager.

    if (this.manager.data.packages.length === 0) {
      log.trace('empty tree')
      return [new TreeItemEmpty('No xPacks identified.')]
    }

    this.manager.data.packages.forEach(
      (dataNodePackage) => {
        const treeItemPackage = new TreeItemPackage(dataNodePackage)
        tree.push(treeItemPackage)

        this._addCommands(dataNodePackage.commands, treeItemPackage)
        this._addActions(dataNodePackage.actions, treeItemPackage)
        this._addConfigurations(dataNodePackage.configurations, treeItemPackage)
      }
    )

    log.trace('items tree created')
    return tree
  }

  private _addCommands (
    dataNodeCommands: DataNodeCommand[],
    parentTreeItem: TreeItemPackage | TreeItemConfiguration
  ): void {
    dataNodeCommands.forEach(
      (dataNodeCommand) => {
        parentTreeItem.addCommand(
          dataNodeCommand.name, dataNodeCommand.task)
      }
    )
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
        if (!dataNodeConfiguration.hidden) {
          const treeItemConfiguration =
            parentTreeItem.addConfiguration(dataNodeConfiguration)

          this._addCommands(dataNodeConfiguration.commands,
            treeItemConfiguration)
          this._addActions(dataNodeConfiguration.actions, treeItemConfiguration)
        }
      }
    )
  }

  // --------------------------------------------------------------------------

  refresh (): void {
    const log = this.log

    log.trace('XpackActionsTreeDataProvider.refresh()')

    this._tree?.forEach(
      (node: TreeItem) => {
        node.dispose()
      })

    this._tree = null
    // Inform the tree that a repaint is necessary.
    this._onDidChangeTreeDataEmitter.fire(null)
  }

  getTreeItem (element: TreeItem): TreeItem {
    // const log = this.log
    // log.trace('getTreeItem', element)
    return element
  }

  getChildren (
    element?: TreeItem
  ): TreeItem[] {
    // const log = this.log
    // log.trace('getChildren', element)

    // Lazy creation, delay to first use or after 'Refresh'.
    if (this._tree === null) {
      this._tree = this._createTree()
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
    // const log = this.log
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
