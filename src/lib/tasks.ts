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
  XpackContext
} from './common'

// ----------------------------------------------------------------------------

let _cachedTasks: TaskWithLocation[] | undefined

// ----------------------------------------------------------------------------

export interface TaskWithLocation {
  task: vscode.Task
  location?: vscode.Location
}

// ----------------------------------------------------------------------------

export function registerTasks (
  xpackContext: XpackContext
): void {
  xpackContext.addRefreshFunction(
    async () => {
      _cachedTasks = undefined
    }
  )
}

// ----------------------------------------------------------------------------
