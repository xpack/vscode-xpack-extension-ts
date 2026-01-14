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

import { JsonNpmPackage } from '@xpack/xpm-lib'

import { XpackTaskDefinition } from '../core/definitions.js'

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
  taskDefinition: XpackTaskDefinition
): vscode.Task {
  const execution: vscode.ShellExecution = new vscode.ShellExecution(
    programName,
    commandArguments,
    { cwd: folderPath }
  )

  const taskPrefix = programName

  const problemMatchers = undefined
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
    isNonEmptyJsonObject((value as JsonNpmPackage).dependencies) ||
    isNonEmptyJsonObject((value as JsonNpmPackage).devDependencies)
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

export function testForExclusionPattern(
  path: string,
  pattern: string
): boolean {
  return minimatch(path, pattern, { dot: true })
}

// ----------------------------------------------------------------------------
