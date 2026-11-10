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
 * This file was inspired by vscode-cmake-tools.git/src/*.ts.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

// ----------------------------------------------------------------------------

import * as path from 'node:path'
import { minimatch } from 'minimatch'

import * as vscode from 'vscode'

import * as xpmLib from '@xpack/xpm-lib'

import { XpackTaskDefinition } from '../core/definitions.js'
import { Logger } from '@xpack/logger'

// ----------------------------------------------------------------------------

/**
 * Completely normalize/canonicalize a path.
 *
 * Using `path.normalize` isn't sufficient. We want to convert all paths to use
 * POSIX separators, remove redundant separators, and sometimes normalize the
 * case of the path.
 *
 * @param p - The input path
 * @returns The normalized path
 */
export function normalizePath(p: string): string {
  let norm = path.normalize(p)
  while (path.sep !== path.posix.sep && norm.includes(path.sep)) {
    norm = norm.replace(path.sep, path.posix.sep)
  }
  if (process.platform === 'win32' || process.platform === 'darwin') {
    norm = norm.toLocaleLowerCase()
  }
  if (process.platform === 'darwin') {
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
export function replaceAll(str: string, needle: string, what: string): string {
  const pattern = escapeStringForRegex(needle)
  const re = new RegExp(pattern, 'g')
  return str.replace(re, what)
}

/**
 * Escape a string so it can be used as a regular expression
 */
export function escapeStringForRegex(str: string): string {
  return str.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1')
}

// ----------------------------------------------------------------------------

export function createTask(
  programName: string,
  commandArguments: string[],
  scope:
    | vscode.WorkspaceFolder
    | vscode.TaskScope.Global
    | vscode.TaskScope.Workspace,
  folderPath: string,
  taskLabel: string,
  taskDefinition: XpackTaskDefinition,
  log: Logger
): vscode.Task {
  const execution: vscode.ShellExecution = new vscode.ShellExecution(
    programName,
    commandArguments,
    { cwd: folderPath }
  )

  const taskPrefix = programName

  const problemMatchers = undefined
  log.trace('taskDefinition:', taskDefinition)
  log.trace('taskLabel:', taskLabel)
  log.trace('taskPrefix:', taskPrefix)

  const task = new vscode.Task(
    taskDefinition,
    scope,
    taskLabel,
    taskPrefix,
    execution,
    problemMatchers
  )
  task.detail = [programName, ...commandArguments].join(' ')
  // Tasks are not disposable, no need to add them to any subscriptions.

  return task
}

// --------------------------------------------------------------------------

export function isPrimitive(value: unknown): boolean {
  return (
    (typeof value !== 'object' && typeof value !== 'function') || value === null
  )
}

export function isJsonObject(value: unknown): boolean {
  return value !== undefined && !isPrimitive(value) && !Array.isArray(value)
}

export function isNonEmptyJsonObject(value: unknown): boolean {
  return isJsonObject(value) && Object.keys(value as object).length > 0
}

export function hasDependencies(value: unknown): boolean {
  return (
    isNonEmptyJsonObject((value as xpmLib.JsonNpmPackage).dependencies) ||
    isNonEmptyJsonObject((value as xpmLib.JsonNpmPackage).devDependencies)
  )
}

export function isPromise(object: unknown): boolean {
  return (
    object !== undefined &&
    Object.prototype.toString.call(object) === '[object Promise]'
  )
}

export function isString(object: unknown): boolean {
  return Object.prototype.toString.call(object) === '[object String]'
}

export function isBoolean(object: unknown): boolean {
  return typeof object === 'boolean'
}

/**
 * Detect the indentation used by a JSON text.
 *
 * @remarks
 * The first line that starts with whitespace followed by a
 * non-whitespace character decides the result: a leading tab selects
 * tab indentation, otherwise the number of leading spaces is used.
 * The result can be passed directly as the `space` argument of
 * `JSON.stringify()`.
 *
 * @param content - The JSON text to analyse.
 * @param defaultIndentation - The value returned when the text is
 * undefined or has no indented lines.
 * @returns `'\t'` for tab indentation, or the number of spaces.
 */
export function detectJsonIndentation(
  content: string | undefined,
  defaultIndentation: string | number = 2
): string | number {
  if (content === undefined) {
    return defaultIndentation
  }

  const match = /^([ \t]+)\S/m.exec(content)
  if (match === null) {
    return defaultIndentation
  }

  const indentation: string = match[1]
  if (indentation.startsWith('\t')) {
    return '\t'
  }

  return indentation.length
}

export function testForExclusionPattern(
  path: string,
  pattern: string
): boolean {
  return minimatch(path, pattern, { dot: true })
}

// ----------------------------------------------------------------------------
