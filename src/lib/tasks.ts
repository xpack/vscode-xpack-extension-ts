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

import { ExtensionManager } from './manager'

// ----------------------------------------------------------------------------

export class TaskProvider implements vscode.TaskProvider, vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  // Factory method pattern.
  static async register (
    manager: ExtensionManager
  ): Promise<TaskProvider> {
    const _taskProvider = new TaskProvider(manager)
    manager.subscriptions.push(_taskProvider)

    const log = manager.log

    // Add possible async calls here.

    log.trace('TaskProvider object created')
    return _taskProvider
  }

  // --------------------------------------------------------------------------
  // Members.

  readonly log: Logger
  readonly manager: ExtensionManager

  private _tasks: vscode.Task[] | undefined

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (manager: ExtensionManager) {
    this.manager = manager
    this.log = manager.log

    const log = this.log

    manager.addCallbackRefresh(
      async () => {
        this.refresh()
      }
    )

    const context = this.manager.vscodeContext
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

    if (token.isCancellationRequested) {
      return tasks
    }

    // Currently there are no additional tasks to create here,
    // all tasks were created by the manager, copy them here.
    tasks.push(...this.manager.data.tasks)
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
