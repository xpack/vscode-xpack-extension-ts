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

import { XpackFolderPath } from './xpack'

// ----------------------------------------------------------------------------

const _packageJson = 'package.json'

type ActionsTree = TreeItemPackageJson[] | TreeItemEmpty[]
type TreeItemParent = TreeItemPackageJson | TreeItemBuildConfiguration
type TreeItemChild = TreeItemAction | TreeItemBuildConfiguration

type JsonActionValue = string | string[]

/**
 * @summary Base class for all tree items.
 * 
 * @description
 * Makes sure that all classes implement getParent() and getChildren(),
 * to simplify the data provider.
 */
class TreeItem extends vscode.TreeItem {
  getParent (): vscode.TreeItem | null { 
    return null 
  }

  getChildren (): vscode.TreeItem[] { 
    return [] 
  }
}

let treeDataProvider: XpackActionsTreeDataProvider
let treeView: vscode.TreeView<vscode.TreeItem>

// ----------------------------------------------------------------------------

// Might need to return the tree.
export function registerTreeViewActions (
  context: vscode.ExtensionContext,
  xpackFolderPaths: XpackFolderPath[]
): void {
  if (vscode.workspace.workspaceFolders != null) {
    treeDataProvider =
      new XpackActionsTreeDataProvider(context, xpackFolderPaths)

    treeView = vscode.window.createTreeView('xpack',
      { treeDataProvider: treeDataProvider, showCollapseAll: true })

    context.subscriptions.push(treeView)
  }
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

  addAction (actionName: string, actionValue: JsonActionValue): TreeItemAction {
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

// An empty tree when there are no xPacks/action.
class TreeItemEmpty extends vscode.TreeItem {
  constructor (message: string) {
    super(message, vscode.TreeItemCollapsibleState.None)
    this.contextValue = 'empty'
    this.tooltip =
      'xPack actions can be defined as xpack.actions.* in package.json.'
  }
}

/**
 * @summary The data provider for the xPack Actions tree view.
 */
export class XpackActionsTreeDataProvider implements
  vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _extensionContext: vscode.ExtensionContext

  // Lazy creation at first use.
  private _tree: ActionsTree | null = null

  private readonly _xpackFolderPaths: XpackFolderPath[]

  // private readonly _onDidChangeTreeData:
  // vscode.EventEmitter<vscode.TreeItem | null> =
  // new vscode.EventEmitter<vscode.TreeItem | null>()
  //
  // readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | null> =
  // this._onDidChangeTreeData.event

  // --------------------------------------------------------------------------

  constructor (
    private readonly context: vscode.ExtensionContext,
    xpackFolderPaths: XpackFolderPath[]
  ) {
    // const subscriptions = context.subscriptions
    this._extensionContext = context
    this._xpackFolderPaths = xpackFolderPaths
  }

  private _createTree (xpackFolderPaths: XpackFolderPath[]): ActionsTree {
    if (xpackFolderPaths.length === 0) {
      return [new TreeItemEmpty('No xPack actions defined.')]
    }

    const tree: TreeItemPackageJson[] = []

    xpackFolderPaths.forEach((xpackFolderPath) => {
      const packageJson = xpackFolderPath.packageJson

      const treeItemPackage = new TreeItemPackageJson(xpackFolderPath)
      tree.push(treeItemPackage)

      if (packageJson.xpack.actions !== undefined) {
        for (const actionName of Object.keys(packageJson.xpack.actions)) {
          const actionValue: JsonActionValue =
          packageJson.xpack.actions[actionName]
          treeItemPackage.addAction(actionName, actionValue)
        }
      }
      if (packageJson.xpack.buildConfigurations !== undefined) {
        for (const buildConfigurationName of
          Object.keys(packageJson.xpack.buildConfigurations)) {
          const treeItemConfiguration =
            treeItemPackage.addBuildConfiguration(buildConfigurationName)

          const buildConfiguration: any =
            packageJson.xpack.buildConfigurations[buildConfigurationName]
          if (buildConfiguration.actions !== undefined) {
            for (const actionName of Object.keys(buildConfiguration.actions)) {
              const actionValue: JsonActionValue =
              buildConfiguration.actions[actionName]
              treeItemConfiguration.addAction(actionName, actionValue)
            }
          }
        }
      }
    })

    console.log('tree created')
    return tree
  }
  // --------------------------------------------------------------------------

  getTreeItem (element: vscode.TreeItem): vscode.TreeItem {
    return element
  }

  async getChildren (element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element === undefined) {
      // Lazy creation, at first use.
      if (this._tree === null) {
        this._tree = this._createTree(this._xpackFolderPaths)
      }

      return this._tree
    }

    if (element instanceof TreeItem) {
      return element.getChildren()
    } else {
      return []
    }
  }

  getParent (element: vscode.TreeItem): vscode.TreeItem | null {
    if (element instanceof TreeItem) {
      return element.getParent()
    } else {
      return null
    }
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
