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

// This extension contribute tasks using a
// [Task Provider](https://code.visualstudio.com/api/extension-guides/task-provider).

// For details about using the tasks:
// https://code.visualstudio.com/docs/editor/tasks

// ----------------------------------------------------------------------------

import * as vscode from 'vscode'

import {
  ExtensionManager,
  XpackFolderPath
} from './manager'

// ----------------------------------------------------------------------------

// let _cachedTasks: TaskWithLocation[] | undefined

// ----------------------------------------------------------------------------

// interface TaskWithLocation {
//   task: vscode.Task
//   location?: vscode.Location
// }

// This interface reflects the properties of the `xpack` task definition
// in `package.json`.
// It must be filled in and passed as the first parameter
// when creating tasks.
// In adition to these members, an inherited `type` must be set
// to `xpack`.
interface XpackTaskDefinition extends vscode.TaskDefinition {
  actionName?: string
  buildConfigurationName?: string
  packageFolderRelativePath?: string
}

// ----------------------------------------------------------------------------

export class TaskProvider implements vscode.TaskProvider {
  // --------------------------------------------------------------------------
  // Static members & methods.

  static _taskProvider: TaskProvider

  static async register (
    extensionManager: ExtensionManager
  ): Promise<void> {
    TaskProvider._taskProvider = new TaskProvider(extensionManager)
  }

  // --------------------------------------------------------------------------
  // Members.

  private readonly _extensionManager: ExtensionManager
  private _tasks: vscode.Task[] | undefined

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (extensionManager: ExtensionManager) {
    this._extensionManager = extensionManager

    extensionManager.addRefreshFunction(
      async () => {
        this.refresh()
      }
    )

    const taskProvider = vscode.tasks.registerTaskProvider('xPack', this)

    const context = this._extensionManager.vscodeContext
    context.subscriptions.push(taskProvider)
  }

  // --------------------------------------------------------------------------
  // Methods.

  async provideTasks (
    token: vscode.CancellationToken
  ): Promise<vscode.Task[]> {
    if (this._tasks === undefined) {
      this._tasks = await this.addTasks(token)
    }

    return this._tasks
  }

  async resolveTask (
    task: vscode.Task,
    token: vscode.CancellationToken
  ): Promise<vscode.Task | undefined> {
    if (token.isCancellationRequested) {
      return undefined
    }
    if (task === undefined) {
      return undefined
    } else {
      throw new Error('Method not yet implemented.')
    }
  }

  // --------------------------------------------------------------------------

  refresh (): void {
    console.log('Tasks.refresh()')

    this._tasks = undefined
  }

  // --------------------------------------------------------------------------

  async addTasks (
    token: vscode.CancellationToken
  ): Promise<vscode.Task[]> {
    const tasks: vscode.Task[] = []

    for (const xpackFolderPath of this._extensionManager.xpackFolderPaths) {
      if (token.isCancellationRequested) {
        break
      }

      const taskDefinitionInstall: XpackTaskDefinition = {
        type: 'xPack',
        xpmCommand: 'install'
      }
      if (xpackFolderPath.relativePath !== '') {
        taskDefinitionInstall.packageFolderRelativePath =
          xpackFolderPath.relativePath
      }

      const packageJson = xpackFolderPath.packageJson

      let taskLabel = 'install dependencies'
      if (xpackFolderPath.relativePath !== '') {
        taskLabel += ` (${xpackFolderPath.relativePath})`
      }

      const task = await this.createTask(
        'xpm',
        ['install'],
        xpackFolderPath,
        taskLabel,
        taskDefinitionInstall
      )
      tasks.push(task)

      const actionTasks = await this.addActions(
        packageJson.xpack.actions,
        '', // Package actions have no configuration name.
        xpackFolderPath,
        token
      )
      tasks.push(...actionTasks)

      const configurationTasks = await this.addBuildConfigurationsActions(
        packageJson.xpack.buildConfigurations,
        xpackFolderPath,
        token
      )
      tasks.push(...configurationTasks)
    }

    return tasks
  }

  async addActions (
    fromJson: any,
    buildConfigurationName: string,
    xpackFolderPath: XpackFolderPath,
    token: vscode.CancellationToken
  ): Promise<vscode.Task[]> {
    const tasks: vscode.Task[] = []

    if (fromJson !== undefined) {
      for (const actionName of Object.keys(fromJson)) {
        if (token.isCancellationRequested) {
          break
        }

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
        tasks.push(task)
      }
    }

    return tasks
  }

  async addBuildConfigurationsActions (
    fromJson: any,
    xpackFolderPath: XpackFolderPath,
    token: vscode.CancellationToken
  ): Promise<vscode.Task[]> {
    const tasks: vscode.Task[] = []

    if (fromJson !== undefined) {
      for (const buildConfigurationName of Object.keys(fromJson)) {
        const buildConfiguration: any = fromJson[buildConfigurationName]

        const actionTasks = await this.addActions(
          buildConfiguration.actions,
          buildConfigurationName,
          xpackFolderPath, token
        )
        tasks.push(...actionTasks)
      }
    }

    return tasks
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
    return task
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
