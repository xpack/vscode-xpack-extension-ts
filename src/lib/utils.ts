/*
 * This file is part of the xPack project (http://xpack.github.io).
 * Copyright (c) 2021 Liviu Ionescu. All rights reserved.
 *
 * Licensed under the terms of the MIT License.
 * See LICENSE in the project root for license information.
 *
 * This file was inspired by vscode-cmake-tools.git/src/*.ts.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/* eslint max-len: [ "error", 80, { "ignoreUrls": true } ] */

// ----------------------------------------------------------------------------

import * as path from 'path'

// ----------------------------------------------------------------------------

/**
 * Completely normalize/canonicalize a path.
 * Using `path.normalize` isn't sufficient. We want to convert all paths to use
 * POSIX separators, remove redundant separators, and sometimes normalize the
 * case of the path.
 *
 * @param p The input path
 * @returns The normalized path
 */
function normalizePath (p: string): string {
  let norm = path.normalize(p)
  while (path.sep !== path.posix.sep && norm.includes(path.sep)) {
    norm = norm.replace(path.sep, path.posix.sep)
  }
  if (process.platform === 'win32' || process.platform === 'darwin') {
    norm = norm.toLocaleLowerCase()
  } if (process.platform === 'darwin') {
    norm = norm.normalize()
  }
  // Remove trailing slashes
  norm = norm.replace(/\/$/g, '')
  // Remove duplicate slashes
  while (norm.includes('//')) {
    norm = replaceAll(norm, '//', '/')
  }
  return norm
}

/**
 * Replace all occurrences of `needle` in `str` with `what`
 * @param str The input string
 * @param needle The search string
 * @param what The value to insert in place of `needle`
 * @returns The modified string
 */
function replaceAll (str: string, needle: string, what: string): string {
  const pattern = escapeStringForRegex(needle)
  const re = new RegExp(pattern, 'g')
  return str.replace(re, what)
}

/**
 * Escape a string so it can be used as a regular expression
 */
function escapeStringForRegex (str: string): string {
  return str.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1')
}

export const utils = {
  normalizePath,
  replaceAll
}

// ----------------------------------------------------------------------------
