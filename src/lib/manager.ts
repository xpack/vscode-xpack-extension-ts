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

import * as assert from 'assert'
import { promises as fsPromises } from 'fs'
import * as path from 'path'

import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'

import { Xpack } from './xpack'

// ----------------------------------------------------------------------------

// TODO: make the depth configurable.
const _maxSearchDepth: number = 3

export type AyncVoidFunction = (() => Promise<void>)

export interface XpackFolderPath {
  path: string
  relativePath: string
  workspaceFolder: vscode.WorkspaceFolder
  packageJson: any
}

// This type reflects the properties of the `xpack` task definition
// in `package.json`.
// It must be filled in and passed as the first parameter
// when creating tasks.
// In adition to these members, an inherited `type` must be set
// to `xPack`.
export interface XpackTaskDefinition extends vscode.TaskDefinition {
  actionName?: string
  buildConfigurationName?: string
  packageFolderRelativePath?: string
}

export type JsonActionValue = string | string[]

// ----------------------------------------------------------------------------

export class ExtensionManager implements vscode.Disposable {
  vscodeContext: vscode.ExtensionContext
  log: Logger

  refreshFunctions: AyncVoidFunction[] = []
  xpackFolderPaths: XpackFolderPath[] = []

  tasksTree: TreeNodePackage[] = []
  buildConfigurations: TreeNodeBuildConfiguration[] = []
  tasks: vscode.Task[] = []
  selectedBuildConfiguration: TreeNodeBuildConfiguration | undefined

  subscriptions: vscode.Disposable[] = []

  onSelectBuildConfiguration =
  new vscode.EventEmitter<TreeNodeBuildConfiguration>()

  constructor (context: vscode.ExtensionContext, log: Logger) {
    this.vscodeContext = context
    this.log = log
  }

  hasLocalWorkspace (): boolean {
    if (vscode.workspace.workspaceFolders != null) {
      return vscode.workspace.workspaceFolders.some(
        (folder) => {
          return (folder.uri.scheme === 'file')
        }
      )
    }
    return false
  }

  addRefreshFunction (func: AyncVoidFunction): void {
    this.refreshFunctions.push(func)
  }

  async runRefreshFunctions (): Promise<void> {
    await this.findXpackFolderPaths()
    await this.buildTasksTree()

    // No async forEach, use loop.
    for (const func of this.refreshFunctions) {
      await func()
    }
  }

  async _findPackageJsonFilesRecursive (
    folderPath: string,
    workspaceFolder: vscode.WorkspaceFolder,
    depth: number,
    xpackFolderPaths: XpackFolderPath[]
  ): Promise<void> {
    assert(folderPath)
    const log = this.log

    // May be null.
    log.trace(`check folder ${folderPath} `)
    const xpack = new Xpack(folderPath)
    const packageJson = await xpack.checkIfFolderHasPackageJson()
    if (xpack.isPackage()) {
      if (xpack.isXpack()) {
        xpackFolderPaths.push({
          path: folderPath,
          relativePath: path.relative(workspaceFolder.uri.path, folderPath),
          workspaceFolder,
          packageJson
        })
      }
      return
    }

    if (depth <= 0) {
      return
    }

    // Recurse on children folders.
    const files = await fsPromises.readdir(folderPath, { withFileTypes: true })
    const promises = []
    for (const file of files) {
      if (file.isDirectory() && !file.name.startsWith('.')) {
        promises.push(this._findPackageJsonFilesRecursive(
          path.join(folderPath, file.name),
          workspaceFolder,
          depth - 1,
          xpackFolderPaths))
      }
    }
    await Promise.all(promises)
  }

  async findXpackFolderPaths (
    maxDepth: number = _maxSearchDepth
  ): Promise<void> {
    const xpackFolderPaths: XpackFolderPath[] = []

    if (vscode.workspace.workspaceFolders != null) {
      const promises: Array<Promise<void>> = []
      vscode.workspace.workspaceFolders.forEach(
        (workspaceFolder) => {
          if (workspaceFolder.uri.scheme === 'file') {
            const promise = this._findPackageJsonFilesRecursive(
              workspaceFolder.uri.path,
              workspaceFolder,
              maxDepth,
              xpackFolderPaths)
            promises.push(promise)
          }
        }
      )
      await Promise.all(promises)
    }

    this.xpackFolderPaths =
      xpackFolderPaths.sort((a, b) => a.path.localeCompare(b.path))

    // Make the explorer visible if there are any xPacks.
    await vscode.commands.executeCommand(
      'setContext',
      'xpack:showScriptExplorer',
      this.xpackFolderPaths.length >= 0)
  }

  // --------------------------------------------------------------------------

  async buildTasksTree (): Promise<void> {
    this.tasksTree = []
    this.buildConfigurations = []
    this.tasks = []

    for (const xpackFolderPath of this.xpackFolderPaths) {
      const treeNodePackage: TreeNodePackage =
        new TreeNodePackage(xpackFolderPath)

      this.tasksTree.push(treeNodePackage)

      const packageJson = xpackFolderPath.packageJson

      await this.addActions(packageJson.xpack.actions, treeNodePackage)

      await this.addBuildConfigurations(
        packageJson.xpack.buildConfigurations,
        treeNodePackage)
    }
  }

  async addActions (
    fromJson: any,
    parent: TreeNodeBuildConfiguration | TreeNodePackage
  ): Promise<void> {
    if (fromJson !== undefined) {
      // Do not use Promise.all() to preserve JSON order.
      for (const actionName of Object.keys(fromJson)) {
        const actionValue: JsonActionValue = fromJson[actionName]
        const nodeAction = await parent.addAction(actionName, actionValue, this)
        // Also collect an array of tasks
        this.tasks.push(nodeAction.task)
      }
    }
  }

  async addBuildConfigurations (
    fromJson: any,
    parent: TreeNodePackage
  ): Promise<void> {
    if (fromJson !== undefined) {
      // Do not use Promise.all() to preserve JSON order.
      for (const buildConfigurationName of Object.keys(fromJson)) {
        const nodeBuildConfiguration =
          await parent.addBuildConfiguration(buildConfigurationName)

        const buildConfiguration: any = fromJson[buildConfigurationName]

        await this.addActions(
          buildConfiguration.actions,
          nodeBuildConfiguration
        )

        // Keep a separate array of all build configurations.
        this.buildConfigurations.push(nodeBuildConfiguration)
      }
    }
  }

  // --------------------------------------------------------------------------

  async createTaskAction (
    actionName: string,
    buildConfigurationName: string, // If empty, it is a package action.
    xpackFolderPath: XpackFolderPath
  ): Promise<vscode.Task> {
    const taskDefinition: XpackTaskDefinition = {
      type: 'xPack',
      actionName
    }

    if (buildConfigurationName !== '') {
      taskDefinition.buildConfigurationName = buildConfigurationName
    }
    if (xpackFolderPath.relativePath !== '') {
      taskDefinition.packageFolderRelativePath =
        xpackFolderPath.relativePath
    }

    const commandArguments = ['run', actionName]
    let taskLabel = actionName
    if (buildConfigurationName !== '') {
      taskLabel += ` ${buildConfigurationName}`
      commandArguments.push('--config', buildConfigurationName)
    }
    if (xpackFolderPath.relativePath !== '') {
      taskLabel += ` (${xpackFolderPath.relativePath})`
    }

    const task = await this.createTask(
      'xpm',
      commandArguments,
      xpackFolderPath,
      taskLabel,
      taskDefinition
    )

    return task
  }

  async createTask (
    xpmProgramName: string,
    commandArguments: string[],
    xPackFolderPath: XpackFolderPath,
    taskLabel: string,
    taskDefinition: XpackTaskDefinition
  ): Promise<vscode.Task> {
    const scope: vscode.WorkspaceFolder = xPackFolderPath.workspaceFolder
    const execution: vscode.ShellExecution = new vscode.ShellExecution(
      xpmProgramName,
      commandArguments,
      { cwd: xPackFolderPath.path }
    )

    const taskPrefix = 'xPack'

    const problemMatchers = undefined
    const task = new vscode.Task(
      taskDefinition,
      scope,
      taskLabel,
      taskPrefix,
      execution,
      problemMatchers
    )
    task.detail = [xpmProgramName, ...commandArguments].join(' ')
    // Tasks are not disposable, no need to add them to subscriptions.

    return task
  }

  // --------------------------------------------------------------------------

  setBuildConfiguration (treeNode: TreeNodeBuildConfiguration): void {
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

export class TreeNodePackage {
  xpackFolderPath: XpackFolderPath
  actions: TreeNodeAction[]
  buildConfigurations: TreeNodeBuildConfiguration[]

  constructor (xpackFolderPath: XpackFolderPath) {
    this.xpackFolderPath = xpackFolderPath
    this.actions = []
    this.buildConfigurations = []
  }

  async addAction (
    actionName: string,
    actionValue: JsonActionValue,
    extensionManager: ExtensionManager
  ): Promise<TreeNodeAction> {
    const task = await extensionManager.createTaskAction(
      actionName,
      '',
      this.xpackFolderPath
    )
    const nodeAction = new TreeNodeAction(actionName, actionValue, task, this)
    this.actions.push(nodeAction)

    return nodeAction
  }

  addBuildConfiguration (
    name: string
  ): TreeNodeBuildConfiguration {
    const nodeBuildConfiguration = new TreeNodeBuildConfiguration(
      name,
      this
    )
    this.buildConfigurations.push(nodeBuildConfiguration)

    return nodeBuildConfiguration
  }
}

export class TreeNodeBuildConfiguration {
  name: string
  actions: TreeNodeAction[]
  parent: TreeNodePackage

  constructor (name: string, parent: TreeNodePackage) {
    this.name = name
    this.actions = []
    this.parent = parent
  }

  async addAction (
    name: string,
    value: JsonActionValue,
    extensionManager: ExtensionManager
  ): Promise<TreeNodeAction> {
    const task = await extensionManager.createTaskAction(
      name,
      this.name,
      this.parent.xpackFolderPath
    )
    const nodeAction = new TreeNodeAction(name, value, task, this)
    this.actions.push(nodeAction)

    return nodeAction
  }
}

export class TreeNodeAction {
  name: string
  value: JsonActionValue
  task: vscode.Task
  parent: TreeNodeBuildConfiguration | TreeNodePackage

  constructor (
    name: string,
    value: JsonActionValue,
    task: vscode.Task,
    parent: TreeNodeBuildConfiguration | TreeNodePackage
  ) {
    this.name = name
    this.value = value
    this.task = task
    this.parent = parent
  }
}

// ----------------------------------------------------------------------------

export class BuildConfigurationPick implements vscode.QuickPickItem {
  label: string
  description?: string
  treeNode: TreeNodeBuildConfiguration

  constructor (
    treeNode: TreeNodeBuildConfiguration
  ) {
    this.label = treeNode.name
    const relativePath = treeNode.parent.xpackFolderPath.relativePath
    if (relativePath !== '') {
      this.description = `(${relativePath})`
    }
    this.treeNode = treeNode
  }
}

// ----------------------------------------------------------------------------
