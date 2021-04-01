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
import * as path from 'path'
import { promises as fsPromises } from 'fs'

// ----------------------------------------------------------------------------

// Helper class for processing xPacks.

export class Xpack {
  folderPath: string
  json: any

  constructor (folderPath: string) {
    assert(folderPath, 'mandatory folderPath')
    this.folderPath = folderPath
  }

  async checkIfFolderHasPackageJson (folderPath: string | undefined):
  Promise<any | null> {
    let tmpPath
    if (folderPath !== undefined) {
      tmpPath = folderPath
    } else {
      tmpPath = this.folderPath
    }
    const jsonPath = path.join(tmpPath, 'package.json')

    try {
      const fileContent = await fsPromises.readFile(jsonPath)
      assert(fileContent !== null)
      const json = JSON.parse(fileContent.toString())

      // If not called with explicit path, remember the resulted json.
      if (folderPath === undefined) {
        this.json = json
      }
      return json
    } catch (err) {
      return null
    }
  }

  isPackage (json: any = this.json): boolean {
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

  isXpack (json: any = this.json): boolean {
    if (!this.isPackage(json)) {
      return false
    }
    if (json.xpack === undefined) {
      return false
    }
    return true
  }
}

// ----------------------------------------------------------------------------
