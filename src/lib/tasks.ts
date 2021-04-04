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

interface TaskWithLocation {
  task: vscode.Task
  location?: vscode.Location
}

// This interface reflects the properties of the `xpack` task definition
// in `package.json`. 
// It must be filled in and passed as the first parameter
// when creating tasks.
// In adition to these members, an inherited `type` must be set
// to `xpack`. 
interface XpackTaskDefinition extends vscode.TaskDefinition {
  actionName: string
  buildConfigurationName?: string
  packageJsonPath?: string
}

// ----------------------------------------------------------------------------

export class Tasks {
  // --------------------------------------------------------------------------
  // Static members & methods.

  static _tasks: Tasks

  static async register (
    extensionManager: ExtensionManager
  ): Promise<void> {
    Tasks._tasks = new Tasks(extensionManager)

    await Tasks._tasks.addTasks()
  }

  // --------------------------------------------------------------------------
  // Members.

  private readonly _extensionManager: ExtensionManager

  _xxx: TaskWithLocation[] = []

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (extensionManager: ExtensionManager) {
    this._extensionManager = extensionManager

    extensionManager.addRefreshFunction(
      async () => {
        this.refresh()
      }
    )
  }

  // --------------------------------------------------------------------------
  // Methods.

  async addTasks (): Promise<void> {
    console.log('addTasks()')

    for (const xPackFolderPath of this._extensionManager.xpackFolderPaths) {
      // TODO: add location.
      this._xxx.push({
        task: await this.createTask('xpm', ['install'], xPackFolderPath)
      })
    }
  }

  refresh (): void {
    console.log('Tasks.refresh()')
  }

  async createTask (
    xpmProgramName: string,
    commandArguments: string[],
    xPackFolderPath: XpackFolderPath
  ): Promise<vscode.Task> {
    const taskDefinition: XpackTaskDefinition = {
      type: 'xpack',
      actionName: 'action name'
    }
    const scope: vscode.WorkspaceFolder = xPackFolderPath.workspaceFolder
    const execution: vscode.ShellExecution = new vscode.ShellExecution(
      xpmProgramName, 
      commandArguments, 
      { cwd: xPackFolderPath.path }
    ) 

    const problemMatchers = undefined
    const task = new vscode.Task(
      taskDefinition,
      scope,
      'task name',
      'task source',
      execution,
      problemMatchers
    )
    task.detail = 'A detailed description'
     return task
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
