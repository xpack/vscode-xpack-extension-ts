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
// Types.

export type AsyncVoidFunction = (() => Promise<void>)

export type JsonActionValue = string | string[]

export interface JsonProperties {
  [actionName: string]: string
}

export interface JsonActions {
  [actionName: string]: JsonActionValue
}

export interface JsonBuildConfiguration {
  properties?: JsonProperties
  actions?: JsonActions
}

export interface JsonBuildConfigurations {
  [buildConfigurationName: string]: JsonBuildConfiguration
}

export interface XpackPackageJson {
  name: string
  version: string
  xpack: {
    properties?: JsonProperties
    actions?: JsonActions
    buildConfigurations?: JsonBuildConfigurations
  }
}

/**
 * This type reflects the properties of the `xpack` task definition
 * in `package.json`.
 * It must be filled in and passed as the first parameter
 * when creating tasks.
 * In adition to these members, an inherited property named `type` must
 * be set to `xPack`.
 */
export interface XpackTaskDefinition extends vscode.TaskDefinition {
  actionName?: string
  buildConfigurationName?: string
  packageFolderRelativePath?: string
  xpmCommand?: string
}

// ----------------------------------------------------------------------------
// Constants.

export const packageJsonFileName: string = 'package.json'

// ----------------------------------------------------------------------------
