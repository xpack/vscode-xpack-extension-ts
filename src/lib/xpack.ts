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

import { Logger } from '@xpack/logger'

import * as utils from './utils'

import {
  JsonBuildConfigurations,
  XpackPackageJson
} from './definitions'

// ----------------------------------------------------------------------------

interface PendingConfigurations {
  [buildConfigurationName: string]: boolean
}

// Helper class for processing xPacks.

export class Xpack {
  // --------------------------------------------------------------------------
  // Members.

  folderPath?: string
  packageJson?: any
  packageJsonOriginal?: any

  readonly log: Logger

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (log: Logger, folderPath: string | undefined = undefined) {
    this.log = log
    this.folderPath = folderPath
  }

  // --------------------------------------------------------------------------
  // Methods.

  async checkIfFolderHasPackageJson (
    folderPath?: string
  ): Promise<any | null> {
    let tmpPath: string | undefined
    if (folderPath !== undefined) {
      tmpPath = folderPath
    } else {
      tmpPath = this.folderPath
    }
    if (tmpPath === undefined) {
      return null
    }

    const jsonPath = path.join(tmpPath, 'package.json')

    try {
      const fileContent = await fsPromises.readFile(jsonPath)
      assert(fileContent !== null)
      const packageJson = JSON.parse(fileContent.toString())

      // If not called with explicit path, remember the resulted json.
      if (folderPath === undefined) {
        this.packageJsonOriginal = packageJson
        this.packageJson = this.processInheritance(packageJson)
        return this.packageJson
      }
      return packageJson
    } catch (err) {
      if (folderPath === undefined) {
        this.packageJsonOriginal = null
        this.packageJson = null
      }
      return null
    }
  }

  isPackage (json: any = this.packageJson): boolean {
    if (json === undefined || json === null || json.name === undefined ||
      json.version === undefined) {
      return false
    }
    const name = json.name.trim()
    if (name.length === 0) {
      return false
    }
    const version = json.version.trim()
    if (version.length === 0) {
      return false
    }
    return true
  }

  isXpack (json: any = this.packageJson): boolean {
    if (!this.isPackage(json)) {
      return false
    }
    if (json.xpack === undefined) {
      return false
    }
    return true
  }

  hasXpackActions (json: any = this.packageJson): boolean {
    if (!this.isXpack(json)) {
      return false
    }
    try {
      if (json.xpack.actions !== undefined) {
        return true
      }
      if (json.xpack.buildConfigurations !== undefined) {
        // Don't use a lambda, to return directly from the loop.
        for (const name of Object.keys(json.xpack.buildConfigurations)) {
          const buildConfiguration: any = json.xpack.buildConfigurations[name]
          if (buildConfiguration.actions !== undefined) {
            return true
          }
        }
      }
    } catch (err) {
      // In case xpack is not an option to get its properties.
    }

    return false
  }

  /**
   * @brief Process inheritance for build configurations.
   * @param packageJson
   * @returns The updated packageJson.
   */
  processInheritance (packageJson: XpackPackageJson): XpackPackageJson {
    // Start with a shallow copy of the original.
    const newPackageJson: XpackPackageJson = {
      ...packageJson
    }

    if (!Object.prototype.hasOwnProperty.call(newPackageJson, 'xpack')) {
      return newPackageJson
    }

    // Add a shallow copy of the xpack property.
    newPackageJson.xpack = {
      ...packageJson.xpack
    }

    // There are no build configurations, done.
    if (packageJson.xpack.buildConfigurations == null) {
      return newPackageJson
    }

    // Clear the destination build configurations.
    newPackageJson.xpack.buildConfigurations = {}

    const pendingConfigurations: PendingConfigurations = {}

    for (const buildConfigurationName of
      Object.keys(packageJson.xpack.buildConfigurations)) {
      this.processBuildConfigurationInheritanceRecursive(
        buildConfigurationName,
        packageJson.xpack.buildConfigurations,
        newPackageJson.xpack.buildConfigurations,
        pendingConfigurations
      )
    }

    return newPackageJson
  }

  private processBuildConfigurationInheritanceRecursive (
    buildConfigurationName: string,
    sourceBuildConfigurations: JsonBuildConfigurations,
    destinationBuildConfigurations: JsonBuildConfigurations,
    pendingConfigurations: PendingConfigurations
  ): void {
    const log = this.log

    // Already processed.
    if (Object.prototype.hasOwnProperty.call(
      destinationBuildConfigurations, buildConfigurationName)) {
      return
    }

    const source = sourceBuildConfigurations[buildConfigurationName]

    const parentNames: string[] = []
    if (Object.prototype.hasOwnProperty.call(source, 'inherit')) {
      if (source.inherit !== undefined && utils.isString(source.inherit)) {
        parentNames.push(source.inherit as string)
      } else if (Array.isArray(source.inherit)) {
        for (const value of source.inherit) {
          if (utils.isString(value)) {
            parentNames.push(value)
          } else {
            log.error('Build configuration inherit can be only' +
            ` string or string array (${buildConfigurationName})`)
          }
        }
      } else {
        log.error('Build configuration inherit can be only string or' +
        ` string array (${buildConfigurationName})`)
      }
    }

    if (parentNames.length === 0) {
      // Has no parents, copy as is.
      destinationBuildConfigurations[buildConfigurationName] = {
        ...source
      }
      return
    }

    if (pendingConfigurations[buildConfigurationName]) {
      log.error(`Circular inheritance in ${buildConfigurationName}`)

      destinationBuildConfigurations[buildConfigurationName] = {
        ...source
      }

      pendingConfigurations[buildConfigurationName] = false
      return
    }

    // Mark the configuration as pending, to catch circular references.
    pendingConfigurations[buildConfigurationName] = true

    const parents = []
    for (const parentName of parentNames) {
      if (!utils.isJsonObject(sourceBuildConfigurations[parentName])) {
        log.error(
          `'${parentName}' not a valid build configuration name` +
          ` (${buildConfigurationName})`)

        // Not stored as parent.
        continue
      }

      this.processBuildConfigurationInheritanceRecursive(
        parentName,
        sourceBuildConfigurations,
        destinationBuildConfigurations,
        pendingConfigurations
      )

      // Remember as a parent.
      parents.push(destinationBuildConfigurations[parentName])
    }

    // Add the source configuration at the end of the list.
    parents.push(sourceBuildConfigurations[buildConfigurationName])

    // Copy everything else except the inheritable properties.
    const destination = {
      ...source,
      properties: {},
      actions: {},
      dependencies: {},
      devDependencies: {}
    }

    for (const parent of parents) {
      if (Object.prototype.hasOwnProperty.call(parent, 'properties')) {
        destination.properties = {
          ...destination.properties,
          ...parent.properties
        }
      }

      if (Object.prototype.hasOwnProperty.call(parent, 'actions')) {
        destination.actions = {
          ...destination.actions,
          ...parent.actions
        }
      }

      if (Object.prototype.hasOwnProperty.call(parent, 'dependencies')) {
        destination.dependencies = {
          ...destination.dependencies,
          ...parent.dependencies
        }
      }

      if (Object.prototype.hasOwnProperty.call(parent, 'devDependencies')) {
        destination.devDependencies = {
          ...destination.devDependencies,
          ...parent.devDependencies
        }
      }
    }

    // Set the final value.
    destinationBuildConfigurations[buildConfigurationName] = destination
    pendingConfigurations[buildConfigurationName] = false
  }
}

// ----------------------------------------------------------------------------
