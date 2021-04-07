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

import { Logger } from '@xpack/logger'

import {
  ExtensionManager,
  XpackTaskDefinition
} from './manager'

// ----------------------------------------------------------------------------

export class TaskProvider implements vscode.TaskProvider, vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  // Factory method pattern.
  static async register (
    extensionManager: ExtensionManager
  ): Promise<TaskProvider> {
    const _taskProvider = new TaskProvider(extensionManager)
    extensionManager.subscriptions.push(_taskProvider)

    const log = extensionManager.log

    // Add possible async calls here.

    log.trace('TaskProvider object created')
    return _taskProvider
  }

  // --------------------------------------------------------------------------
  // Members.

  readonly log: Logger
  readonly extensionManager: ExtensionManager

  private _tasks: vscode.Task[] | undefined

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (extensionManager: ExtensionManager) {
    this.extensionManager = extensionManager
    this.log = extensionManager.log

    const log = this.log

    extensionManager.addRefreshFunction(
      async () => {
        this.refresh()
      }
    )

    const context = this.extensionManager.vscodeContext
    const taskProvider = vscode.tasks.registerTaskProvider('xPack', this)
    context.subscriptions.push(taskProvider)

    log.trace('task provider registered')
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
    const log = this.log

    log.trace('Tasks.refresh()')

    this._tasks = undefined
  }

  // --------------------------------------------------------------------------

  async addTasks (
    token: vscode.CancellationToken
  ): Promise<vscode.Task[]> {
    const tasks: vscode.Task[] = []

    // Add install tasks.
    for (const xpackFolderPath of this.extensionManager.xpackFolderPaths) {
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

      let taskLabel = 'install dependencies'
      if (xpackFolderPath.relativePath !== '') {
        taskLabel += ` (${xpackFolderPath.relativePath})`
      }

      const task = await this.extensionManager.createTask(
        'xpm',
        ['install'],
        xpackFolderPath,
        taskLabel,
        taskDefinitionInstall
      )
      tasks.push(task)
    }

    // Add action tasks, created by the manager.
    tasks.push(...this.extensionManager.tasks)
    return tasks
  }

  dispose (): void {
    const log = this.log

    log.trace('TaskProvider.dispose()')
    // Nothing to do
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
