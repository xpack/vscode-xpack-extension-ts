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

export type LogLevelKey = 'trace' | 'debug' | 'info' | 'warning' | 'error'

export type AsyncVoidFunction = (() => Promise<void>)

export type JsonActionValue = string | string[]

export type JsonPropertyValue = string

export interface JsonProperties {
  [propertyName: string]: JsonPropertyValue
}

export interface JsonBuildConfigurationInherits {
  [buildConfigurationName: string]: string
}

export interface JsonActions {
  [actionName: string]: JsonActionValue
}

export interface JsonBuildConfiguration {
  inherit?: JsonBuildConfigurationInherits | string
  hidden?: boolean
  properties?: JsonProperties
  actions?: JsonActions
  dependencies?: any
  devDependencies?: any
}

export interface JsonBuildConfigurations {
  [buildConfigurationName: string]: JsonBuildConfiguration
}

export interface XpackPackageJson {
  name: string
  version: string
  dependencies?: any
  devDependencies?: any
  xpack: {
    properties?: JsonProperties
    actions?: JsonActions
    dependencies?: any
    devDependencies?: any
    buildConfigurations?: JsonBuildConfigurations
  }
}

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

export const packageJsonFileName: string = 'package.json'
export const buildFolderRelativePathPropertyName: string =
  'buildFolderRelativePath'

// ----------------------------------------------------------------------------
