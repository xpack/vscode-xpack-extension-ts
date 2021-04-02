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

// ----------------------------------------------------------------------------

// Helper class for processing xPacks.

export type VoidFunction = (() => void)

export interface XpackFolderPath {
  path: string
  relativePath: string
  packageJson: any
}

export class Xpack {
  folderPath?: string
  packageJson?: any

  constructor (folderPath: string | undefined = undefined) {
    this.folderPath = folderPath
  }

  async checkIfFolderHasPackageJson (
    folderPath: string | undefined
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
        this.packageJson = packageJson
      }
      return packageJson
    } catch (err) {
      return null
    }
  }

  isPackage (json: any = this.packageJson): boolean {
    if (json === null || json.name === undefined ||
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
    return false
  }

  async findPackageJsonFilesRecursive (
    folderPath: string,
    workspaceFolderPath: string,
    depth: number,
    xpackFolderPaths: XpackFolderPath[]
  ): Promise<void> {
    assert(folderPath)

    // May be null.
    console.log(`check folder ${folderPath} `)
    const packageJson = await this.checkIfFolderHasPackageJson(folderPath)
    if (this.isPackage(packageJson)) {
      if (this.hasXpackActions(packageJson)) {
        xpackFolderPaths.push({
          path: folderPath,
          relativePath: path.relative(workspaceFolderPath, folderPath),
          packageJson
        })
      }
      return
    }

    if (depth <= 0) {
      return
    }

    // Recurse on children folders.
    const files = await fsPromises.readdir(folderPath, { withFileTypes: true })
    const promises = []
    for (const file of files) {
      if (file.isDirectory()) {
        promises.push(this.findPackageJsonFilesRecursive(
          path.join(folderPath, file.name),
          workspaceFolderPath,
          depth - 1,
          xpackFolderPaths))
      }
    }
    await Promise.all(promises)
  }
}

// ----------------------------------------------------------------------------
