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

import * as vscode from 'vscode'

import { XpackTaskDefinition } from './definitions'

// ----------------------------------------------------------------------------

/**
 * Completely normalize/canonicalize a path.
 * Using `path.normalize` isn't sufficient. We want to convert all paths to use
 * POSIX separators, remove redundant separators, and sometimes normalize the
 * case of the path.
 *
 * @param p - The input path
 * @returns The normalized path
 */
export function normalizePath (p: string): string {
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
 * @param str - The input string
 * @param needle - The search string
 * @param what - The value to insert in place of `needle`
 * @returns The modified string
 */
export function replaceAll (str: string, needle: string, what: string): string {
  const pattern = escapeStringForRegex(needle)
  const re = new RegExp(pattern, 'g')
  return str.replace(re, what)
}

/**
 * Escape a string so it can be used as a regular expression
 */
export function escapeStringForRegex (str: string): string {
  return str.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1')
}

// ----------------------------------------------------------------------------

export async function createTask (
  xpmProgramName: string,
  commandArguments: string[],
  workspaceFolder: vscode.WorkspaceFolder,
  folderPath: string,
  taskLabel: string,
  taskDefinition: XpackTaskDefinition
): Promise<vscode.Task> {
  const scope: vscode.WorkspaceFolder = workspaceFolder
  const execution: vscode.ShellExecution = new vscode.ShellExecution(
    xpmProgramName,
    commandArguments,
    { cwd: folderPath }
  )

  const taskPrefix = 'xPack'

  const problemMatchers = undefined
  const task = new vscode.Task(
    taskDefinition,
    scope,
    taskLabel,
    taskPrefix,
    execution,
    problemMatchers
  )
  task.detail = [xpmProgramName, ...commandArguments].join(' ')
  // Tasks are not disposable, no need to add them to any subscriptions.

  return task
}

// --------------------------------------------------------------------------

export function isPrimitive (value: any): boolean {
  return (typeof value !== 'object' && typeof value !== 'function') ||
    value === null
}

export function isJsonObject (value: any): boolean {
  return value !== undefined && !isPrimitive(value) && !Array.isArray(value)
}

// ----------------------------------------------------------------------------
