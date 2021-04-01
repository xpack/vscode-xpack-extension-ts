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

type JsonActionValue = string | string[]

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

class TreeItemPackageJson extends vscode.TreeItem {
  xpackFolderPath: XpackFolderPath
  actions: TreeItemAction[] = []
  buildConfigurations: TreeItemBuildConfiguration[] = []

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

    this.xpackFolderPath = xpackFolderPath
  }

  addAction (
    actionName: string,
    actionValue: JsonActionValue
  ): TreeItemAction {
    const treeItem = new TreeItemAction(actionName, actionValue, this)
    this.actions.push(treeItem)
    return treeItem
  }

  addBuildConfiguration (
    buildConfigurationName: string
  ): TreeItemBuildConfiguration {
    const treeItem =
      new TreeItemBuildConfiguration(buildConfigurationName, this)
    this.buildConfigurations.push(treeItem)
    return treeItem
  }
}

class TreeItemAction extends vscode.TreeItem {
  parent: TreeItemParent
  actionName: string
  actionValue: string[]

  constructor (
    actionName: string,
    actionValue: JsonActionValue,
    parent: TreeItemParent
  ) {
    super(actionName, vscode.TreeItemCollapsibleState.None)

    this.parent = parent
    this.actionName = actionName
    if (Array.isArray(actionValue)) {
      this.actionValue = actionValue
    } else {
      this.actionValue = [actionValue]
    }

    this.iconPath = new vscode.ThemeIcon('wrench')
    this.tooltip = this.actionValue.join('\n')
    this.contextValue = 'action'
  }
}

class TreeItemBuildConfiguration extends vscode.TreeItem {
  parent: TreeItemPackageJson
  buildConfigurationName: string
  actions: TreeItemAction[] = []

  constructor (
    buildConfigurationName: string,
    parent: TreeItemPackageJson
  ) {
    super(buildConfigurationName, vscode.TreeItemCollapsibleState.Expanded)

    this.iconPath = vscode.ThemeIcon.Folder
    this.tooltip = 'xPack build configuration'
    this.contextValue = 'folder'
    this.description = '(configuration)'

    this.buildConfigurationName = buildConfigurationName
    this.parent = parent
  }

  addAction (actionName: string, actionValue: JsonActionValue): TreeItemAction {
    const treeItem = new TreeItemAction(actionName, actionValue, this)
    this.actions.push(treeItem)
    return treeItem
  }
}

// An empty tree when there are no xPacks/action.
class TreeItemEmpty extends vscode.TreeItem {
  constructor (message: string) {
    super(message, vscode.TreeItemCollapsibleState.None)
    this.contextValue = 'empty'
  }
}

export class XpackActionsTreeDataProvider implements
  vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly extensionContext: vscode.ExtensionContext

  // Lazy creation at first use.
  private tree: ActionsTree | null = null

  xpackFolderPaths: XpackFolderPath[]

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
    this.extensionContext = context
    this.xpackFolderPaths = xpackFolderPaths
  }

  createTree (xpackFolderPaths: XpackFolderPath[]): ActionsTree {
    if (xpackFolderPaths.length === 0) {
      return [new TreeItemEmpty('No xPack actions found.')]
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
      if (this.tree === null) {
        this.tree = this.createTree(this.xpackFolderPaths)
      }

      return this.tree
    }

    if (element instanceof TreeItemPackageJson) {
      return [...element.actions, ...element.buildConfigurations]
    } else if (element instanceof TreeItemBuildConfiguration) {
      return element.actions
    } else if (element instanceof TreeItemAction) {
      return []
    } else if (element instanceof TreeItemEmpty) {
      return []
    } else {
      return []
    }
  }

  getParent (element: vscode.TreeItem): vscode.TreeItem | null {
    if (element instanceof TreeItemPackageJson) {
      return null
    }
    if (element instanceof TreeItemAction) {
      return element.parent
    }
    if (element instanceof TreeItemBuildConfiguration) {
      return element.parent
    }
    if (element instanceof TreeItemEmpty) {
      return null
    }
    return null
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
