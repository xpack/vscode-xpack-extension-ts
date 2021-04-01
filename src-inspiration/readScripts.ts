/*
 * This file is part of the xPack project (http://xpack.github.io).
 * Copyright (c) 2021 Liviu Ionescu. All rights reserved.
 *
 * Licensed under the terms of the MIT License.
 * See LICENSE in the project root for license information.
 *
 * This file is inspired by vscode.git/extensions/npm/src/readScripts.ts.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/* eslint max-len: [ "error", 80, { "ignoreUrls": true } ] */

// ----------------------------------------------------------------------------

// https://www.npmjs.com/package/jsonc-parser
import { JSONVisitor, visit } from 'jsonc-parser'

import {
  Location,
  Position,
  Range,
  TextDocument
} from 'vscode'

// ----------------------------------------------------------------------------

export interface INpmScriptReference {
  name: string
  value: string
  nameRange: Range
  valueRange: Range
}

export interface INpmScriptInfo {
  location: Location
  scripts: INpmScriptReference[]
}

export const readScripts = (document: TextDocument,
  buffer = document.getText()): INpmScriptInfo | undefined => {
  let start: Position | undefined
  let end: Position | undefined
  let inScripts = false
  let buildingScript: { name: string, nameRange: Range } | undefined
  let level = 0

  const scripts: INpmScriptReference[] = []
  const visitor: JSONVisitor = {
    onError () {
      // no-op
    },
    onObjectBegin () {
      level++
    },
    onObjectEnd (offset) {
      if (inScripts) {
        end = document.positionAt(offset)
        inScripts = false
      }
      level--
    },
    onLiteralValue (value: unknown, offset: number, length: number) {
      if ((buildingScript != null) && typeof value === 'string') {
        scripts.push({
          ...buildingScript,
          value,
          valueRange: new Range(document.positionAt(offset),
            document.positionAt(offset + length))
        })
        buildingScript = undefined
      }
    },
    onObjectProperty (property: string, offset: number, length: number) {
      if (level === 1 && property === 'scripts') {
        inScripts = true
        start = document.positionAt(offset)
      } else if (inScripts) {
        buildingScript = {
          name: property,
          nameRange: new Range(document.positionAt(offset),
            document.positionAt(offset + length))
        }
      }
    }
  }

  visit(buffer, visitor)

  if (start === undefined) {
    return undefined
  }

  return {
    location: new Location(document.uri,
      new Range(start, end ?? start)),
    scripts
  }
}

// ----------------------------------------------------------------------------
