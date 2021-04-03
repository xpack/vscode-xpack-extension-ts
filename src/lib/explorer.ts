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

import {
  Xpack,
  XpackFolderPath,
  VoidFunction
} from './xpack'

// ----------------------------------------------------------------------------

const _packageJson: string = 'package.json'
// TODO: make the depth configurable.
const _maxSearchDepth: number = 3

type ActionsTree = TreeItemPackageJson[] | TreeItemEmpty[]
type TreeItemParent = TreeItemPackageJson | TreeItemBuildConfiguration
type TreeItemChild = TreeItemAction | TreeItemBuildConfiguration

type JsonActionValue = string | string[]

let _invalidateCacheFunctions: VoidFunction[]

/**
 * @summary Base class for all tree items.
 *
 * @description
 * Makes sure that all classes implement getParent() and getChildren(),
 * to simplify the data provider.
 */
class TreeItem extends vscode.TreeItem {
  getParent (): TreeItem | null {
    return null
  }

  getChildren (): TreeItem[] {
    return []
  }
}

class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  refresh (): void { }

  getTreeItem (element: TreeItem): TreeItem {
    return element
  }

  async getChildren (element?: TreeItem): Promise<TreeItem[]> {
    return []
  }
}

let treeDataProvider: XpackActionsTreeDataProvider | null = null
let treeView: vscode.TreeView<vscode.TreeItem>

// ----------------------------------------------------------------------------

// Might need to return the tree.
export function registerExplorer (
  context: vscode.ExtensionContext,
  invalidateCacheFunctions: VoidFunction[]
): XpackActionsTreeDataProvider | null {
  if (vscode.workspace.workspaceFolders == null) {
    return null
  }

  _invalidateCacheFunctions = invalidateCacheFunctions

  treeDataProvider =
    new XpackActionsTreeDataProvider(context)

  _invalidateCacheFunctions.push(
    () => {
      treeDataProvider?.refresh()
    }
  )

  treeView = vscode.window.createTreeView(
    'xpack',
    {
      treeDataProvider: treeDataProvider,
      showCollapseAll: true
    }
  )

  context.subscriptions.push(treeView)

  return treeDataProvider
}

// ----------------------------------------------------------------------------

class TreeItemPackageJson extends TreeItem {
  private readonly _xpackFolderPath: XpackFolderPath
  private readonly _actions: TreeItemAction[] = []
  private readonly _buildConfigurations: TreeItemBuildConfiguration[] = []

  constructor (xpackFolderPath: XpackFolderPath) {
    super(path.join(xpackFolderPath.relativePath, _packageJson),
      vscode.TreeItemCollapsibleState.Expanded)

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

    this._xpackFolderPath = xpackFolderPath
  }

  addAction (
    actionName: string,
    actionValue: JsonActionValue
  ): TreeItemAction {
    const treeItem = new TreeItemAction(actionName, actionValue, this)
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
}

// ----------------------------------------------------------------------------

class TreeItemAction extends TreeItem {
  private readonly _parent: TreeItemParent
  private readonly _actionName: string
  private readonly _actionValue: string[]

  constructor (
    actionName: string,
    actionValue: JsonActionValue,
    parent: TreeItemParent
  ) {
    super(actionName, vscode.TreeItemCollapsibleState.None)

    this._parent = parent
    this._actionName = actionName
    if (Array.isArray(actionValue)) {
      this._actionValue = actionValue
    } else {
      this._actionValue = [actionValue]
    }

    this.iconPath = new vscode.ThemeIcon('wrench')
    this.tooltip = this._actionValue.join('\n')
    this.contextValue = 'action'
  }

  getParent (): TreeItemParent {
    return this._parent
  }
}

// ----------------------------------------------------------------------------

class TreeItemBuildConfiguration extends TreeItem {
  private readonly _parent: TreeItemPackageJson
  private readonly _buildConfigurationName: string
  private readonly _actions: TreeItemAction[] = []

  constructor (
    buildConfigurationName: string,
    parent: TreeItemPackageJson
  ) {
    super(buildConfigurationName, vscode.TreeItemCollapsibleState.Expanded)

    this.iconPath = vscode.ThemeIcon.Folder
    this.tooltip = 'xPack build configuration'
    this.contextValue = 'folder'
    this.description = '(configuration)'

    this._buildConfigurationName = buildConfigurationName
    this._parent = parent
  }

  addAction (
    actionName: string,
    actionValue: JsonActionValue
  ): TreeItemAction {
    const treeItem = new TreeItemAction(actionName, actionValue, this)
    this._actions.push(treeItem)
    return treeItem
  }

  getChildren (): TreeItemAction[] {
    return this._actions
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
  private readonly _extensionContext: vscode.ExtensionContext

  // Lazy creation at first use and after Refresh.
  private _tree: ActionsTree | null = null

  private readonly _onDidChangeTreeData: vscode.EventEmitter<TreeItem | null> =
  new vscode.EventEmitter<TreeItem | null>()

  readonly onDidChangeTreeData: vscode.Event<TreeItem | null> =
  this._onDidChangeTreeData.event

  // --------------------------------------------------------------------------

  constructor (
    private readonly context: vscode.ExtensionContext
  ) {
    super()

    this._extensionContext = context
  }

  // --------------------------------------------------------------------------

  private async _createTree (): Promise<ActionsTree> {
    const tree: TreeItemPackageJson[] = []

    // Scan the workspace folders for xPacks.
    const xpackFolderPaths: XpackFolderPath[] =
      await this._findXpackFolderPaths(_maxSearchDepth)

    if (xpackFolderPaths.length === 0) {
      return [new TreeItemEmpty('No xPack actions identified.')]
    }

    xpackFolderPaths.forEach(
      (xpackFolderPath) => {
        const packageJson = xpackFolderPath.packageJson

        const treeItemPackage = new TreeItemPackageJson(xpackFolderPath)
        tree.push(treeItemPackage)

        this._addActions(packageJson.xpack.actions, treeItemPackage)

        this._addBuildConfigurations(
          packageJson.xpack.buildConfigurations,
          treeItemPackage
        )
      }
    )

    console.log('tree created')
    return tree
  }

  private _addActions (
    fromJson: any,
    toTreeItem: TreeItemPackageJson | TreeItemBuildConfiguration
  ): void {
    if (fromJson !== undefined) {
      Object.keys(fromJson).forEach(
        (actionName) => {
          const actionValue: JsonActionValue = fromJson[actionName]
          toTreeItem.addAction(actionName, actionValue)
        }
      )
    }
  }

  private _addBuildConfigurations (
    fromJson: any,
    toTreeItem: TreeItemPackageJson
  ): void {
    if (fromJson !== undefined) {
      Object.keys(fromJson).forEach(
        (buildConfigurationName) => {
          const treeItemConfiguration =
            toTreeItem.addBuildConfiguration(buildConfigurationName)

          const buildConfiguration: any = fromJson[buildConfigurationName]
          this._addActions(buildConfiguration.actions, treeItemConfiguration)
        }
      )
    }
  }

  private async _findXpackFolderPaths (
    maxDepth: number
  ): Promise<XpackFolderPath[]> {
    const xpackFolderPaths: XpackFolderPath[] = []
    const xpack = new Xpack()

    if (vscode.workspace.workspaceFolders != null) {
      const promises: Array<Promise<void>> = []
      vscode.workspace.workspaceFolders.forEach(
        (folder) => {
          if (folder.uri.scheme === 'file') {
            const promise = xpack.findPackageJsonFilesRecursive(
              folder.uri.path,
              folder.uri.path,
              maxDepth,
              xpackFolderPaths)
            promises.push(promise)
          }
        }
      )
      await Promise.all(promises)
    }

    return xpackFolderPaths.sort((a, b) => a.path.localeCompare(b.path))
  }

  // --------------------------------------------------------------------------

  refresh (): void {
    console.log('XpackActionsTreeDataProvider.refresh()')

    this._tree = null
    this._onDidChangeTreeData.fire(null)
  }

  getTreeItem (element: TreeItem): TreeItem {
    return element
  }

  async getChildren (
    element?: TreeItem
  ): Promise<TreeItem[]> {
    // console.log('getChildren', element)

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
    // console.log('getParent', element)

    if (element instanceof TreeItem) {
      return element.getParent()
    } else {
      return null
    }
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
