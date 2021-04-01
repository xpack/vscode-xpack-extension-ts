/*
 * This file is part of the xPack project (http://xpack.github.io).
 * Copyright (c) 2021 Liviu Ionescu. All rights reserved.
 *
 * Licensed under the terms of the MIT License.
 * See LICENSE in the project root for license information.
 *
 * This file is inspired by vscode.git/extensions/npm/src/tasks.ts.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/* eslint max-len: [ "error", 80, { "ignoreUrls": true } ] */

// ----------------------------------------------------------------------------

import * as path from 'path'
import * as fs from 'fs'

// https://www.npmjs.com/package/vscode-nls
import * as nls from 'vscode-nls'

// https://www.npmjs.com/package/minimatch
import * as minimatch from 'minimatch'

import {
  ExtensionContext,
  TaskProvider,
  Task,
  Location,
  TaskDefinition,
  TaskScope,
  Uri,
  ShellExecution,
  ShellQuoting,
  ShellQuotedString,
  workspace,
  WorkspaceFolder,
  RelativePattern,
  Position,
  QuickPickItem,
  TaskGroup,
  CancellationTokenSource,
  TextDocument,
  tasks,
  commands
} from 'vscode'

import {
  INpmScriptInfo,
  readScripts
} from './readScripts'

// ----------------------------------------------------------------------------

const localize = nls.loadMessageBundle()

export interface XpackTaskDefinition extends TaskDefinition {
  actionName: string
  buildConfigurationName?: string
  path?: string
}

export interface FolderTaskItem extends QuickPickItem {
  label: string
  task: Task
}

type AutoDetect = 'on' | 'off'

let cachedTasks: TaskWithLocation[] | undefined

const INSTALL_COMMAND = 'install'

export interface TaskLocation {
  document: Uri
  line: Position
}

export interface TaskWithLocation {
  task: Task
  location?: Location
}

export class NpmTaskProvider implements TaskProvider {
  constructor (private readonly context: ExtensionContext) {
  }

  get tasksWithLocation (): Promise<TaskWithLocation[]> {
    return provideNpmScripts(this.context, false)
  }

  public async provideTasks (): Promise<Task[]> {
    const tasks = await provideNpmScripts(this.context, true)
    return tasks.map(task => task.task)
  }

  public async resolveTask (_task: Task): Promise<Task | undefined> {
    const npmTask = (_task.definition as any).script
    if (npmTask !== undefined) {
      const kind: XpackTaskDefinition = (_task.definition as any)
      let packageJsonUri: Uri
      if (_task.scope === undefined || _task.scope === TaskScope.Global ||
        _task.scope === TaskScope.Workspace) {
        // scope is required to be a WorkspaceFolder for resolveTask
        return undefined
      }
      if (kind !== undefined && kind.path !== '') {
        packageJsonUri = _task.scope.uri.with({
          path: `_task.scope.uri.path/${kind.path as string}package.json`
        })
      } else {
        packageJsonUri = _task.scope.uri.with({
          path: _task.scope.uri.path +
          '/package.json'
        })
      }
      const cmd = [kind.actionName]
      if (kind.actionName !== INSTALL_COMMAND) {
        cmd.unshift('run')
      }
      return await createTask(await getPackageManagerName(this.context,
        _task.scope.uri), kind, cmd, _task.scope, packageJsonUri)
    }
    return undefined
  }
}

export function invalidateTasksCache (): void {
  cachedTasks = undefined
}

const buildNames: string[] = ['build', 'compile', 'watch']
function isBuildTask (name: string): boolean {
  for (const buildName of buildNames) {
    if (name.includes(buildName)) {
      return true
    }
  }
  return false
}

const testNames: string[] = ['test']
function isTestTask (name: string): boolean {
  for (const testName of testNames) {
    if (name === testName) {
      return true
    }
  }
  return false
}

function getPrePostScripts (scripts: any): Set<string> {
  const prePostScripts: Set<string> = new Set([
    'preuninstall', 'postuninstall', 'prepack', 'postpack', 'preinstall',
    'postinstall',
    'prepack', 'postpack', 'prepublish', 'postpublish', 'preversion',
    'postversion',
    'prestop', 'poststop', 'prerestart', 'postrestart', 'preshrinkwrap',
    'postshrinkwrap',
    'pretest', 'postest', 'prepublishOnly'
  ])
  const keys = Object.keys(scripts)
  for (const script of keys) {
    const prepost = ['pre' + script, 'post' + script]
    prepost.forEach(each => {
      if (scripts[each] !== undefined) {
        prePostScripts.add(each)
      }
    })
  }
  return prePostScripts
}

export function isWorkspaceFolder (value: any): value is WorkspaceFolder {
  return value !== undefined && typeof value !== 'number'
}

export async function getPackageManagerName (extensionContext: ExtensionContext,
  folder: Uri, showWarning: boolean = true): Promise<string> {
  const packageManagerName = workspace.getConfiguration('xpack',
    folder).get<string>('xpack.xpm.bin', 'xpm')

  return packageManagerName
}

export async function hasNpmScripts (): Promise<boolean> {
  const folders = workspace.workspaceFolders
  if (folders == null) {
    return false
  }
  try {
    for (const folder of folders) {
      if (isAutoDetectionEnabled(folder)) {
        const relativePattern = new RelativePattern(folder,
          '**/package.json')
        const paths = await workspace.findFiles(relativePattern,
          '**/node_modules/**')
        if (paths.length > 0) {
          return true
        }
      }
    }
    return false
  } catch (error) {
    return await Promise.reject(error)
  }
}

async function detectNpmScripts (context: ExtensionContext,
  showWarning: boolean): Promise<TaskWithLocation[]> {
  const emptyTasks: TaskWithLocation[] = []
  const allTasks: TaskWithLocation[] = []
  const visitedPackageJsonFiles: Set<string> = new Set()

  const folders = workspace.workspaceFolders
  if (folders == null) {
    return emptyTasks
  }
  try {
    for (const folder of folders) {
      if (isAutoDetectionEnabled(folder)) {
        const relativePattern = new RelativePattern(folder,
          '**/package.json')
        const paths = await workspace.findFiles(relativePattern,
          '**/{node_modules,.vscode-test}/**')
        for (const path of paths) {
          if (!isExcluded(folder, path) &&
          !visitedPackageJsonFiles.has(path.fsPath)) {
            const tasks =
            await provideNpmScriptsForFolder(context, path, showWarning)
            visitedPackageJsonFiles.add(path.fsPath)
            allTasks.push(...tasks)
          }
        }
      }
    }
    return allTasks
  } catch (error) {
    return await Promise.reject(error)
  }
}

export async function detectNpmScriptsForFolder (context: ExtensionContext,
  folder: Uri): Promise<FolderTaskItem[]> {
  const folderTasks: FolderTaskItem[] = []

  try {
    const relativePattern = new RelativePattern(folder.fsPath,
      '**/package.json')
    const paths = await workspace.findFiles(relativePattern,
      '**/node_modules/**')

    const visitedPackageJsonFiles: Set<string> = new Set()
    for (const path of paths) {
      if (!visitedPackageJsonFiles.has(path.fsPath)) {
        const tasks = await provideNpmScriptsForFolder(context, path, true)
        visitedPackageJsonFiles.add(path.fsPath)
        folderTasks.push(...tasks.map(t => ({
          label: t.task.name,
          task: t.task
        })))
      }
    }
    return folderTasks
  } catch (error) {
    return Promise.reject(error)
  }
}

export async function provideNpmScripts (context: ExtensionContext,
  showWarning: boolean): Promise<TaskWithLocation[]> {
  if (cachedTasks == null) {
    cachedTasks = await detectNpmScripts(context, showWarning)
  }
  return cachedTasks
}

export function isAutoDetectionEnabled (folder?: WorkspaceFolder): boolean {
  return workspace.getConfiguration('npm', folder?.uri)
    .get<AutoDetect>('autoDetect') === 'on'
}

function isExcluded (folder: WorkspaceFolder, packageJsonUri: Uri): boolean {
  function testForExclusionPattern (path: string, pattern: string): boolean {
    return minimatch(path, pattern, { dot: true })
  }

  const exclude = workspace.getConfiguration('npm', folder.uri)
    .get<string | string[]>('exclude')
  const packageJsonFolder = path.dirname(packageJsonUri.fsPath)

  if (exclude !== undefined) {
    if (Array.isArray(exclude)) {
      for (const pattern of exclude) {
        if (testForExclusionPattern(packageJsonFolder, pattern)) {
          return true
        }
      }
    } else if (testForExclusionPattern(packageJsonFolder, exclude)) {
      return true
    }
  }
  return false
}

function isDebugScript (script: string): boolean {
  /* eslint-disable max-len, no-useless-escape */
  const match = script.match(/--(inspect|debug)(-brk)?(=((\[[0-9a-fA-F:]*\]|[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|[a-zA-Z0-9\.]*):)?(\d+))?/)
  return match !== null
}

async function provideNpmScriptsForFolder (context: ExtensionContext,
  packageJsonUri: Uri, showWarning: boolean): Promise<TaskWithLocation[]> {
  const emptyTasks: TaskWithLocation[] = []

  const folder = workspace.getWorkspaceFolder(packageJsonUri)
  if (folder == null) {
    return emptyTasks
  }
  const scripts = await getScripts(packageJsonUri)
  if (scripts == null) {
    return emptyTasks
  }

  const result: TaskWithLocation[] = []

  const prePostScripts = getPrePostScripts(scripts)
  const packageManager = await getPackageManagerName(context, folder.uri,
    showWarning)

  for (const { name, value, nameRange } of scripts.scripts) {
    const task = await createTask(packageManager, name, ['run', name],
      folder, packageJsonUri, value)
    const lowerCaseTaskName = name.toLowerCase()
    if (isBuildTask(lowerCaseTaskName)) {
      task.group = TaskGroup.Build
    } else if (isTestTask(lowerCaseTaskName)) {
      task.group = TaskGroup.Test
    }
    if (prePostScripts.has(name)) {
      // hack: use Clean group to tag pre/post scripts
      task.group = TaskGroup.Clean
    }

    // todo@connor4312: all scripts are now debuggable,
    // what is a 'debug script'?
    if (isDebugScript(value)) {
      // hack: use Rebuild group to tag debug scripts
      task.group = TaskGroup.Rebuild
    }

    result.push({ task, location: new Location(packageJsonUri, nameRange) })
  }

  // always add npm install (without a problem matcher)
  result.push({
    task: await createTask(packageManager, INSTALL_COMMAND,
      [INSTALL_COMMAND], folder, packageJsonUri,
      'install dependencies from package', [])
  })
  return result
}

export function getTaskName (script: string,
  relativePath: string | undefined): string {
  if (relativePath !== undefined && relativePath.length !== 0) {
    return `${script} - ${relativePath.substring(0, relativePath.length - 1)}`
  }
  return script
}

export async function createTask (packageManager: string,
  actionName: XpackTaskDefinition | string, cmd: string[],
  folder: WorkspaceFolder, packageJsonUri: Uri, detail?: string,
  matcher?: any):
  Promise<Task> {
  let kind: XpackTaskDefinition
  if (typeof actionName === 'string') {
    kind = { type: 'xpm', actionName }
  } else {
    kind = actionName
  }

  function getCommandLine (cmd: string[]): Array<string | ShellQuotedString> {
    const result: Array<string | ShellQuotedString> = new Array(cmd.length)
    for (let i = 0; i < cmd.length; i++) {
      if (/\s/.test(cmd[i])) {
        result[i] = {
          value: cmd[i],
          quoting: cmd[i].includes('--')
            ? ShellQuoting.Weak
            : ShellQuoting.Strong
        }
      } else {
        result[i] = cmd[i]
      }
    }

    const runSilent = workspace.getConfiguration('npm', folder.uri)
      .get<boolean>('runSilent')

    if (runSilent !== undefined && runSilent) {
      result.unshift('--silent')
    }
    return result
  }

  function getRelativePath (packageJsonUri: Uri): string {
    const rootUri = folder.uri
    const absolutePath = packageJsonUri.path.substring(0,
      packageJsonUri.path.length - 'package.json'.length)
    return absolutePath.substring(rootUri.path.length + 1)
  }

  const relativePackageJson = getRelativePath(packageJsonUri)
  if (relativePackageJson.length !== 0) {
    kind.path = relativePackageJson
  }
  const taskName = getTaskName(kind.actionName, relativePackageJson)
  const cwd = path.dirname(packageJsonUri.fsPath)
  const task = new Task(kind, folder, taskName, 'npm',
    new ShellExecution(packageManager, getCommandLine(cmd), { cwd: cwd }),
    matcher)
  task.detail = detail
  return task
}

export function getPackageJsonUriFromTask (task: Task): Uri | null {
  if (isWorkspaceFolder(task.scope)) {
    /* eslint-disable @typescript-eslint/strict-boolean-expressions */
    if (task.definition.path) {
      return Uri.file(path.join(task.scope.uri.fsPath,
        task.definition.path, 'package.json'))
    } else {
      return Uri.file(path.join(task.scope.uri.fsPath, 'package.json'))
    }
  }
  return null
}

export async function hasPackageJson (): Promise<boolean> {
  const token = new CancellationTokenSource()
  // Search for files for max 1 second.
  const timeout = setTimeout(() => token.cancel(), 1000)
  const files = await workspace.findFiles('**/package.json', undefined,
    1, token.token)
  clearTimeout(timeout)
  return files.length > 0
}

async function exists (file: string): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    /* eslint-disable node/no-deprecated-api */
    fs.exists(file, (value) => {
      resolve(value)
    })
  })
}

export async function runScript (context: ExtensionContext,
  script: string, document: TextDocument): Promise<void> {
  const uri = document.uri
  const folder = workspace.getWorkspaceFolder(uri)
  if (folder != null) {
    const task = await createTask(await getPackageManagerName(context,
      folder.uri), script, ['run', script], folder, uri)
    await tasks.executeTask(task)
  }
}

export async function runInstall (context: ExtensionContext,
  document: TextDocument): Promise<void> {
  const uri = document.uri
  const folder = workspace.getWorkspaceFolder(uri)
  if (folder != null) {
    const task = await createTask(await getPackageManagerName(context,
      folder.uri), 'install', ['install'], folder, uri)
    await tasks.executeTask(task)
  }
}

export async function startDebugging (context: ExtensionContext,
  scriptName: string, cwd: string, folder: WorkspaceFolder): Promise<void> {
  await commands.executeCommand(
    'extension.js-debug.createDebuggerTerminal',
    `${await getPackageManagerName(context, folder.uri)} run ${scriptName}`,
    folder,
    { cwd }
  )
}

export interface StringMap { [s: string]: string }

export function findScriptAtPosition (document: TextDocument,
  buffer: string, position: Position): string | undefined {
  const read = readScripts(document, buffer)
  if (read == null) {
    return undefined
  }

  for (const script of read.scripts) {
    if (script.nameRange.start.isBeforeOrEqual(position) &&
    script.valueRange.end.isAfterOrEqual(position)) {
      return script.name
    }
  }

  return undefined
}

export async function getScripts (packageJsonUri: Uri):
Promise<INpmScriptInfo | undefined> {
  if (packageJsonUri.scheme !== 'file') {
    return undefined
  }

  const packageJson = packageJsonUri.fsPath
  if (!await exists(packageJson)) {
    return undefined
  }

  try {
    const document: TextDocument =
    await workspace.openTextDocument(packageJsonUri)
    return readScripts(document)
  } catch (e) {
    const localizedParseError = localize('npm.parseError',
      'Npm task detection: failed to parse the file {0}', packageJsonUri.fsPath)
    throw new Error(localizedParseError)
  }
}

// ----------------------------------------------------------------------------
