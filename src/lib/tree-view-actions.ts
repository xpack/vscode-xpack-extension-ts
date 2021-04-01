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

// ----------------------------------------------------------------------------

// const packageName = 'package.json'

type TaskTree = NoActions[]

// ----------------------------------------------------------------------------

// An empty tree when there are no xPacks.
class NoActions extends vscode.TreeItem {
  constructor (message: string) {
    super(message, vscode.TreeItemCollapsibleState.None)
    this.contextValue = 'no actions'
  }
}

export class XpackActionsTreeDataProvider implements
  vscode.TreeDataProvider<vscode.TreeItem> {
  private taskTree: TaskTree | null = null
  private readonly extensionContext: vscode.ExtensionContext
  private readonly _onDidChangeTreeData:
  vscode.EventEmitter<vscode.TreeItem | null> =
  new vscode.EventEmitter<vscode.TreeItem | null>()

  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | null> =
  this._onDidChangeTreeData.event

  constructor (private readonly context: vscode.ExtensionContext) {
    // const subscriptions = context.subscriptions
    this.extensionContext = context
  }

  getTreeItem (element: vscode.TreeItem): vscode.TreeItem {
    return element
  }

  async getChildren (element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (this.taskTree == null) {
      // TODO: construct the tree
      this.taskTree = [new NoActions('No actions found.')]
    }
    if (element instanceof NoActions) {
      return []
    }
    if (element == null) {
      if (this.taskTree != null) {
        return this.taskTree
      }
    }
    return []
  }
}

// ----------------------------------------------------------------------------
