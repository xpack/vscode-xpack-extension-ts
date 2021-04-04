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

interface XpackTaskDefinition extends vscode.TaskDefinition {
  script: string
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
      this._xxx.push(await this.createTask('xpm', ['install'], xPackFolderPath))
    }
  }

  refresh (): void {
    console.log('Tasks.refresh()')
  }

  async createTask (
    xpmProgramName: string,
    commandArguments: string[],
    xPackFolderPath: XpackFolderPath
  ): Promise<TaskWithLocation> {
    const taskDefinition: XpackTaskDefinition = {
      type: 'xxx',
      script: 'sss'
    }
    const scope: vscode.WorkspaceFolder = {
      uri: vscode.Uri.file(xPackFolderPath.path),
      name: 'scopename',
      index: 0
    }
    const task = new vscode.Task(
      taskDefinition,
      scope,
      'nnn',
      'source',
      new vscode.ShellExecution(
        xpmProgramName, commandArguments, { cwd: xPackFolderPath.path })
    )
    return { task }
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
