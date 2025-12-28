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

// ----------------------------------------------------------------------------

/**
 * To locate commands use:
 * - `view == xPackActions` (set via createTreeView())
 * - `viewItem == action | command | configuration | package
 * (set via treeItem.contextValue)
 */

import * as path from 'node:path'

import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'

import { JsonNpmPackage, JsonXpmPackage } from '@xpack/xpm-lib'

import { ExtensionManager } from './manager.js'

import {
  DataNodeXpmAction,
  DataNodeNpmCommand,
  DataNodeConfiguration,
  DataNodePackage,
  DataNodeNpmScript,
  DataNodeWorkspaceFolder,
  DataNodeXpmCommand,
} from './data-model.js'

import { packageJsonFileName } from './definitions.js'

// ----------------------------------------------------------------------------

type ActionsTree =
  | TreeItemWorkspaceFolder[]
  | TreeItemPackage[]
  | TreeItemEmpty[]
type TreeItemRunnableParent = TreeItemPackage | TreeItemConfiguration
type TreeItemPackageChild =
  | TreeItemNpmScript
  | TreeItemNpmCommand
  | TreeItemXpmAction
  | TreeItemXpmCommand
  | TreeItemConfiguration
type TreeItemConfigurationChild = TreeItemXpmCommand | TreeItemXpmAction

// ----------------------------------------------------------------------------

export class Explorer implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  static register(manager: ExtensionManager): Explorer {
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

  private readonly _treeDataProvider: XpackTreeDataProvider
  private readonly _treeView: vscode.TreeView<vscode.TreeItem>

  // --------------------------------------------------------------------------
  // Constructor.

  constructor(readonly manager: ExtensionManager) {
    this.log = manager.log

    const log = this.log

    this._treeDataProvider = new XpackTreeDataProvider(manager)

    const context: vscode.ExtensionContext = manager.vscodeContext

    // eslint-disable-next-line @typescript-eslint/require-await
    manager.addCallbackRefresh(async () => {
      this._treeDataProvider.refresh()
    })

    this._treeView = vscode.window.createTreeView('xPackActions', {
      treeDataProvider: this._treeDataProvider,
      showCollapseAll: true,
    })
    context.subscriptions.push(this._treeView)
    log.trace('tree view xPackActions registered')
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose(): void {
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

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    name: string
  ) {
    super(label, collapsibleState)

    this.name = name
  }

  // --------------------------------------------------------------------------
  // Getters & Setters.

  get children(): TreeItem[] {
    return []
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose(): void {
    this.name = undefined as unknown as string
    this.parent = undefined as unknown as TreeItem
  }
}

// ----------------------------------------------------------------------------

export class TreeItemWorkspaceFolder extends TreeItem {
  // --------------------------------------------------------------------------
  // Members.
  packages: TreeItemPackage[] = []

  constructor(dataNode: DataNodeWorkspaceFolder) {
    super(
      dataNode.folderName,
      vscode.TreeItemCollapsibleState.Expanded,
      dataNode.folderName
    )
  }

  get children(): TreeItem[] {
    return this.packages
  }

  addPackage(treeItemPackage: TreeItemPackage) {
    this.packages.push(treeItemPackage)
  }
}

// ----------------------------------------------------------------------------

export class TreeItemPackage extends TreeItem {
  // --------------------------------------------------------------------------
  // Members.

  // Inherit the null parent and name.
  packageJsonPath: string

  npmScripts: TreeItemNpmScript[] = []
  npmCommands: TreeItemNpmCommand[] = []

  xpmActions: TreeItemXpmAction[] = []
  xpmCommands: TreeItemXpmCommand[] = []

  xpmConfigurations: TreeItemConfiguration[] = []

  dataNode: DataNodePackage

  // --------------------------------------------------------------------------
  // Constructor.

  constructor(dataNode: DataNodePackage) {
    super(
      path.join(dataNode.folderRelativePath, packageJsonFileName),
      vscode.TreeItemCollapsibleState.Expanded,
      dataNode.name
    )

    this.packageJsonPath = path.join(dataNode.folderPath, packageJsonFileName)
    this.dataNode = dataNode

    const packageJson: JsonNpmPackage = dataNode.jsonPackage
    const packageName: string = packageJson.name ?? 'name?'
    const packageVersion: string = packageJson.version ?? 'version?'

    // https://code.visualstudio.com/api/references/icons-in-labels#icon-listing
    // Tree item properties.
    this.iconPath = new vscode.ThemeIcon('json')
    this.resourceUri = vscode.Uri.file(this.packageJsonPath)
    this.tooltip =
      `The '${packageName}@${packageVersion}' package at ` +
      `'${this.packageJsonPath}'`
    this.contextValue = 'package'
    this.description = `(${packageName})`
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  get children(): TreeItemPackageChild[] {
    return [
      ...this.npmScripts,
      ...this.npmCommands,
      ...this.xpmActions,
      ...this.xpmCommands,
      ...this.xpmConfigurations,
    ]
  }

  get package(): this {
    return this
  }

  // --------------------------------------------------------------------------
  // Methods.

  addNpmScript(
    scriptName: string,
    scriptValue: string,
    task: vscode.Task
  ): TreeItemNpmScript {
    const treeItem = new TreeItemNpmScript(scriptName, scriptValue, task, this)
    this.npmScripts.push(treeItem)
    return treeItem
  }

  addNpmCommand(commandName: string, task: vscode.Task): TreeItemNpmCommand {
    const treeItem = new TreeItemNpmCommand(commandName, task, this)
    this.npmCommands.push(treeItem)
    return treeItem
  }

  addXpmAction(
    actionName: string,
    actionValue: string[],
    task: vscode.Task
  ): TreeItemXpmAction {
    const treeItem = new TreeItemXpmAction(actionName, actionValue, task, this)
    this.xpmActions.push(treeItem)
    return treeItem
  }

  addXpmCommand(commandName: string, task: vscode.Task): TreeItemXpmCommand {
    const treeItem = new TreeItemXpmCommand(commandName, task, this)
    this.xpmCommands.push(treeItem)
    return treeItem
  }

  addConfiguration(dataNode: DataNodeConfiguration): TreeItemConfiguration {
    const treeItem = new TreeItemConfiguration(dataNode, this)
    this.xpmConfigurations.push(treeItem)
    return treeItem
  }

  dispose(): void {
    this.npmScripts.forEach((node) => {
      node.dispose()
    })
    this.npmScripts = undefined as unknown as TreeItemNpmScript[]

    this.npmCommands.forEach((node) => {
      node.dispose()
    })
    this.npmCommands = undefined as unknown as TreeItemNpmCommand[]

    this.xpmActions.forEach((node) => {
      node.dispose()
    })
    this.xpmActions = undefined as unknown as TreeItemXpmAction[]

    this.xpmCommands.forEach((node) => {
      node.dispose()
    })
    this.xpmCommands = undefined as unknown as TreeItemXpmCommand[]

    this.xpmConfigurations.forEach((node) => {
      node.dispose()
    })
    this.xpmConfigurations = undefined as unknown as TreeItemConfiguration[]

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

  constructor(name: string, task: vscode.Task, parent: TreeItemRunnableParent) {
    super(name, vscode.TreeItemCollapsibleState.None, name)

    this.parent = parent
    this.task = task

    let packageJsonPath = ''
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
        vscode.Uri.file(packageJsonPath),
        // TODO: add location (range of lines).
      ],
    }
  }

  // --------------------------------------------------------------------------
  // Methods.

  async runTask(): Promise<vscode.TaskExecution> {
    return await vscode.tasks.executeTask(this.task)
  }

  dispose(): void {
    this.parent = undefined as unknown as TreeItemRunnableParent
    this.task = undefined as unknown as vscode.Task

    super.dispose()
  }
}

// ----------------------------------------------------------------------------

export class TreeItemNpmScript extends TreeItemRunnable {
  // --------------------------------------------------------------------------
  // Members.

  scriptValue: string

  // --------------------------------------------------------------------------
  // Constructor.

  constructor(
    actionName: string,
    actionValue: string,
    task: vscode.Task,
    parent: TreeItemRunnableParent
  ) {
    super(actionName, task, parent)

    this.scriptValue = actionValue

    // https://code.visualstudio.com/api/references/icons-in-labels#icon-listing
    this.iconPath = new vscode.ThemeIcon('wrench')
    this.tooltip = this.scriptValue
    this.contextValue = 'npmScript'
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose(): void {
    this.scriptValue = undefined as unknown as string

    super.dispose()
  }
}

// ----------------------------------------------------------------------------

export class TreeItemNpmCommand extends TreeItemRunnable {
  // --------------------------------------------------------------------------
  // Members.

  // --------------------------------------------------------------------------
  // Constructor.

  constructor(
    commandName: string,
    task: vscode.Task,
    parent: TreeItemRunnableParent
  ) {
    super(commandName, task, parent)

    // https://code.visualstudio.com/api/references/icons-in-labels#icon-listing
    this.iconPath = new vscode.ThemeIcon('wrench-subaction')
    this.tooltip = 'npm ' + commandName
    this.contextValue = 'npmCommand'
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose(): void {
    super.dispose()
  }
}

// ----------------------------------------------------------------------------

export class TreeItemXpmAction extends TreeItemRunnable {
  // --------------------------------------------------------------------------
  // Members.

  actionValue: string[]

  // --------------------------------------------------------------------------
  // Constructor.

  constructor(
    actionName: string,
    actionValue: string[],
    task: vscode.Task,
    parent: TreeItemRunnableParent
  ) {
    super(actionName, task, parent)

    this.actionValue = actionValue

    // https://code.visualstudio.com/api/references/icons-in-labels#icon-listing
    // xpm actions have a slightly more complicated icon.
    this.iconPath = new vscode.ThemeIcon('tools')
    this.tooltip = this.actionValue.join('\n')
    this.contextValue = 'xpmAction'
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose(): void {
    this.actionValue = undefined as unknown as string[]

    super.dispose()
  }
}

// ----------------------------------------------------------------------------

export class TreeItemXpmCommand extends TreeItemRunnable {
  // --------------------------------------------------------------------------
  // Members.

  // --------------------------------------------------------------------------
  // Constructor.

  constructor(
    commandName: string,
    task: vscode.Task,
    parent: TreeItemRunnableParent
  ) {
    super(commandName, task, parent)

    // https://code.visualstudio.com/api/references/icons-in-labels#icon-listing
    this.iconPath = new vscode.ThemeIcon('tools')
    this.tooltip = 'xpm ' + commandName
    this.contextValue = 'xpmCommand'
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose(): void {
    super.dispose()
  }
}

// ----------------------------------------------------------------------------

export class TreeItemConfiguration extends TreeItem {
  // --------------------------------------------------------------------------
  // Members.

  parent: TreeItemPackage
  xpmActions: TreeItemXpmAction[] = []
  xpmCommands: TreeItemXpmCommand[] = []

  dataNode: DataNodeConfiguration

  // --------------------------------------------------------------------------
  // Constructor.

  constructor(dataNode: DataNodeConfiguration, parent: TreeItemPackage) {
    super(
      dataNode.name,
      vscode.TreeItemCollapsibleState.Collapsed,
      dataNode.name
    )

    this.dataNode = dataNode
    this.parent = parent

    const packageJson: JsonXpmPackage = parent.dataNode
      .jsonPackage as JsonXpmPackage
    const packageName: string = packageJson.name ?? 'name?'
    const packageVersion: string = packageJson.version ?? 'version?'

    // https://code.visualstudio.com/api/references/icons-in-labels#icon-listing
    // Tree item properties.
    this.iconPath = vscode.ThemeIcon.Folder
    this.tooltip =
      `The ${this.name} build configuration ` +
      `of the '${packageName}@${packageVersion}' xpm package`
    this.contextValue = 'configuration'
    this.description = `(${packageName})`
  }

  // --------------------------------------------------------------------------
  // Getters & Setters.

  get children(): TreeItemConfigurationChild[] {
    return [...this.xpmActions, ...this.xpmCommands]
  }

  get package(): TreeItemPackage {
    return this.parent
  }

  // --------------------------------------------------------------------------
  // Methods.

  addXpmAction(
    actionName: string,
    actionValue: string[],
    task: vscode.Task
  ): TreeItemXpmAction {
    const treeItem = new TreeItemXpmAction(actionName, actionValue, task, this)
    this.xpmActions.push(treeItem)
    return treeItem
  }

  addXpmCommand(commandName: string, task: vscode.Task): TreeItemXpmCommand {
    const treeItem = new TreeItemXpmCommand(commandName, task, this)
    this.xpmCommands.push(treeItem)
    return treeItem
  }

  dispose(): void {
    this.parent = undefined as unknown as TreeItemPackage

    this.xpmActions.forEach((node) => {
      node.dispose()
    })
    this.xpmActions = undefined as unknown as TreeItemXpmAction[]

    this.xpmCommands.forEach((node) => {
      node.dispose()
    })
    this.xpmCommands = undefined as unknown as TreeItemXpmCommand[]

    super.dispose()
  }
}

// ----------------------------------------------------------------------------

// An empty tree when there are no xPacks.
class TreeItemEmpty extends TreeItem {
  // --------------------------------------------------------------------------
  // Constructor.

  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None, '')

    this.contextValue = 'empty'
    this.tooltip = 'xpm packages need the xpack property in package.json.'
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose(): void {
    super.dispose()
  }
}

// ----------------------------------------------------------------------------

/**
 * The data provider for the xpm Actions & npm Scripts tree view.
 */
// eslint-disable-next-line max-len
export class XpackTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  // --------------------------------------------------------------------------
  // Members.

  readonly log: Logger
  readonly manager: ExtensionManager

  // Lazy creation at first use and after Refresh.
  private _tree: ActionsTree | null = null

  // eslint-disable-next-line max-len
  private readonly _onDidChangeTreeDataEmitter: vscode.EventEmitter<TreeItem | null> =
    new vscode.EventEmitter<TreeItem | null>()

  readonly onDidChangeTreeData: vscode.Event<TreeItem | null> =
    this._onDidChangeTreeDataEmitter.event

  // --------------------------------------------------------------------------
  // Constructor.

  constructor(manager: ExtensionManager) {
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
  private _createTree(): ActionsTree {
    const log = this.log

    log.trace('XpackTreeDataProvider._createTree()')

    // Basically replicate the data model tree created by the manager.

    if (this.manager.data.packages.length === 0) {
      log.trace('empty tree')
      return [new TreeItemEmpty('No xpm packges identified.')]
    }

    if (this.manager.data.workspaceFolders.length > 1) {
      // If multiple workspace folders, the tree has aditional levels.
      const tree: TreeItemWorkspaceFolder[] = []
      this.manager.data.workspaceFolders.forEach((dataNodeWorkspaceFolder) => {
        const treeItemWorkspaceFolder = new TreeItemWorkspaceFolder(
          dataNodeWorkspaceFolder
        )
        tree.push(treeItemWorkspaceFolder)
        this._addPackages(
          dataNodeWorkspaceFolder.packages,
          treeItemWorkspaceFolder
        )
      })
      log.trace('items tree created with', tree.length, 'folders')
      return tree
    } else {
      // If a single workspace folder, the tree lists only packages.
      const tree: TreeItemPackage[] = []
      this.manager.data.packages.forEach((dataNodePackage) => {
        const treeItemPackage = new TreeItemPackage(dataNodePackage)
        tree.push(treeItemPackage)

        this._addNpmScripts(dataNodePackage.npmScripts, treeItemPackage)
        this._addNpmCommands(dataNodePackage.npmCommands, treeItemPackage)

        this._addXpmActions(dataNodePackage.xpmActions, treeItemPackage)
        this._addXpmCommands(dataNodePackage.xpmCommands, treeItemPackage)

        this._addConfigurations(
          dataNodePackage.xpmConfigurations,
          treeItemPackage
        )
      })

      log.trace('items tree created with', tree.length, 'pacakges')
      return tree
    }
  }

  private _addPackages(
    dataNodePackages: DataNodePackage[],
    parentTreeItem: TreeItemWorkspaceFolder
  ): void {
    dataNodePackages.forEach((dataNodePackage) => {
      const treeItemPackage = new TreeItemPackage(dataNodePackage)
      parentTreeItem.addPackage(treeItemPackage)

      this._addNpmScripts(dataNodePackage.npmScripts, treeItemPackage)
      this._addNpmCommands(dataNodePackage.npmCommands, treeItemPackage)

      this._addXpmActions(dataNodePackage.xpmActions, treeItemPackage)
      this._addXpmCommands(dataNodePackage.xpmCommands, treeItemPackage)

      this._addConfigurations(
        dataNodePackage.xpmConfigurations,
        treeItemPackage
      )
    })
  }

  private _addNpmScripts(
    dataNodeScripts: DataNodeNpmScript[],
    parentTreeItem: TreeItemPackage
  ): void {
    dataNodeScripts.forEach((dataNodeNpmScript) => {
      parentTreeItem.addNpmScript(
        dataNodeNpmScript.name,
        dataNodeNpmScript.value,
        dataNodeNpmScript.task
      )
    })
  }

  private _addNpmCommands(
    dataNodeNpmCommands: DataNodeNpmCommand[],
    parentTreeItem: TreeItemPackage
  ): void {
    dataNodeNpmCommands.forEach((dataNodeNpmCommand) => {
      parentTreeItem.addNpmCommand(
        dataNodeNpmCommand.name,
        dataNodeNpmCommand.task
      )
    })
  }

  private _addXpmActions(
    dataNodeActions: DataNodeXpmAction[],
    parentTreeItem: TreeItemPackage | TreeItemConfiguration
  ): void {
    dataNodeActions.forEach((dataNodeXpmAction) => {
      parentTreeItem.addXpmAction(
        dataNodeXpmAction.name,
        dataNodeXpmAction.value,
        dataNodeXpmAction.task
      )
    })
  }

  private _addXpmCommands(
    dataNodeXpmCommands: DataNodeXpmCommand[],
    parentTreeItem: TreeItemPackage | TreeItemConfiguration
  ): void {
    dataNodeXpmCommands.forEach((dataNodeXpmCommand) => {
      parentTreeItem.addXpmCommand(
        dataNodeXpmCommand.name,
        dataNodeXpmCommand.task
      )
    })
  }

  private _addConfigurations(
    dataNodeConfigurations: DataNodeConfiguration[],
    parentTreeItem: TreeItemPackage
  ): void {
    dataNodeConfigurations.forEach((dataNodeConfiguration) => {
      if (!dataNodeConfiguration.hidden) {
        const treeItemConfiguration = parentTreeItem.addConfiguration(
          dataNodeConfiguration
        )

        this._addXpmActions(
          dataNodeConfiguration.xpmActions,
          treeItemConfiguration
        )

        this._addXpmCommands(
          dataNodeConfiguration.xpmCommands,
          treeItemConfiguration
        )
      }
    })
  }

  // --------------------------------------------------------------------------

  refresh(): void {
    const log = this.log

    log.trace('XpackTreeDataProvider.refresh()')

    this._tree?.forEach((node: TreeItem) => {
      node.dispose()
    })

    this._tree = null
    // Inform the tree that a repaint is necessary.
    this._onDidChangeTreeDataEmitter.fire(null)
  }

  getTreeItem(element: TreeItem): TreeItem {
    // const log = this.log
    // log.trace('getTreeItem', element)
    return element
  }

  getChildren(element?: TreeItem): TreeItem[] {
    // const log = this.log
    // log.trace('getChildren', element)

    // Lazy creation, delay to first use or after 'Refresh'.
    this._tree ??= this._createTree()

    if (element === undefined) {
      return this._tree
    }

    if (element instanceof TreeItem) {
      return element.children
    } else {
      return []
    }
  }

  getParent(element: TreeItem): TreeItem | null {
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
