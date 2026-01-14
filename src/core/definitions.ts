/*
 * This file is part of the xPack project (http://xpack.github.io).
 * Copyright (c) 2021-2026 Liviu Ionescu. All rights reserved.
 *
 * Permission to use, copy, modify, and/or distribute this software
 * for any purpose is hereby granted, under the terms of the MIT license.
 *
 * If a copy of the license was not distributed with this file, it can
 * be obtained from https://opensource.org/license/mit.
 *
 * This file was inspired by vscode.git/extensions/npm/src/*.ts.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

// ----------------------------------------------------------------------------

import * as vscode from 'vscode'

// ----------------------------------------------------------------------------
// Types.

export type LogLevelKey = 'trace' | 'debug' | 'info' | 'warning' | 'error'

export type AsyncVoidFunction = () => Promise<void>

/**
 * This type reflects the properties of the `xpack` task definition
 * in `package.json`.
 * It must be filled in and passed as the first parameter
 * when creating tasks.
 * In addition to these members, an inherited property named `type` must
 * be set to `xPack`.
 */
export interface XpackTaskDefinition extends vscode.TaskDefinition {
  actionName?: string
  xpmCommand?: string
  buildConfigurationName?: string
  packageFolderRelativePath?: string
}

export interface MessageItemConfirmation extends vscode.MessageItem {
  isConfirmed: boolean
}

// ----------------------------------------------------------------------------
// Constants.

export const packageJsonFileName = 'package.json'
export const buildFolderRelativePathPropertyName = 'buildFolderRelativePath'

// ----------------------------------------------------------------------------
