/*
 * This file is part of the xPack project (http://xpack.github.io).
 * Copyright (c) 2021 Liviu Ionescu. All rights reserved.
 *
 * Licensed under the terms of the MIT License.
 * See LICENSE in the project root for license information.
 *
 * This file is inspired by vscode.git/extensions/npm/src/npmView.ts.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/* eslint max-len: [ "error", 80, { "ignoreUrls": true } ] */

// ----------------------------------------------------------------------------

import * as path from 'path'

// https://www.npmjs.com/package/vscode-nls
import * as nls from 'vscode-nls'

import {
  commands, Event, EventEmitter, ExtensionContext,
  Range,
  Selection, Task,
  TaskGroup, tasks, TextDocument, TextDocumentShowOptions, ThemeIcon,
  TreeDataProvider, TreeItem, TreeItemLabel, TreeItemCollapsibleState, Uri,
  window, workspace, WorkspaceFolder, Position, Location
} from 'vscode'

// ----------------------------------------------------------------------------

import {
  createTask, getPackageManagerName, getTaskName, isAutoDetectionEnabled,
  isWorkspaceFolder, XpackTaskDefinition,
  NpmTaskProvider,
  startDebugging,
  TaskWithLocation
} from './tasks'

import { readScripts } from './readScripts'

import { Commands } from '../src/lib/commands'

// ----------------------------------------------------------------------------

const localize = nls.loadMessageBundle()

class Folder extends TreeItem {
  packages: PackageJSON[] = []
  workspaceFolder: WorkspaceFolder

  constructor (folder: WorkspaceFolder) {
    super(folder.name, TreeItemCollapsibleState.Expanded)
    this.contextValue = 'folder'
    this.resourceUri = folder.uri
    this.workspaceFolder = folder
    this.iconPath = ThemeIcon.Folder
  }

  addPackage (packageJson: PackageJSON): void {
    this.packages.push(packageJson)
  }
}

const packageName = 'package.json'

class PackageJSON extends TreeItem {
  path: string
  folder: Folder
  scripts: NpmScript[] = []

  static getLabel (relativePath: string): string {
    if (relativePath.length > 0) {
      return path.join(relativePath, packageName)
    }
    return packageName
  }

  constructor (folder: Folder, relativePath: string) {
    super(PackageJSON.getLabel(relativePath), TreeItemCollapsibleState.Expanded)
    this.folder = folder
    this.path = relativePath
    this.contextValue = 'packageJSON'
    if (folder.resourceUri != null) {
      if (relativePath !== '') {
        this.resourceUri = Uri.file(path.join(folder.resourceUri.fsPath,
          relativePath, packageName))
      } else {
        this.resourceUri = Uri.file(path.join(folder.resourceUri.fsPath,
          packageName))
      }
    }
    this.iconPath = ThemeIcon.File
  }

  addScript (script: NpmScript): void {
    this.scripts.push(script)
  }
}

type ExplorerCommands = 'open' | 'run'

class NpmScript extends TreeItem {
  task: Task
  package: PackageJSON

  constructor (_context: ExtensionContext, packageJson: PackageJSON,
    task: Task, public taskLocation?: Location) {
    super(task.name, TreeItemCollapsibleState.None)
    const command: ExplorerCommands = workspace.getConfiguration('npm')
      ?.get<ExplorerCommands>('scriptExplorerAction') ?? 'open'

    const commandList = {
      open: {
        title: 'Edit Script',
        command: 'vscode.open',
        arguments: [
          taskLocation?.uri,
          /* eslint-disable @typescript-eslint/consistent-type-assertions */
          (taskLocation != null) ? {
            selection: new Range(taskLocation.range.start,
              taskLocation.range.start)
          } as TextDocumentShowOptions : undefined
        ]
      },
      run: {
        title: 'Run Script',
        command: 'xpm.runScript',
        arguments: [this]
      }
    }
    this.contextValue = 'script'
    this.package = packageJson
    this.task = task
    this.command = commandList[command]

    if ((task.group != null) && task.group === TaskGroup.Clean) {
      this.iconPath = new ThemeIcon('wrench-subaction')
    } else {
      this.iconPath = new ThemeIcon('wrench')
    }
    if (task.detail != null && task.detail !== '') {
      this.tooltip = task.detail
    }
  }

  getFolder (): WorkspaceFolder {
    return this.package.folder.workspaceFolder
  }
}

class NoScripts extends TreeItem {
  constructor (message: string) {
    super(message, TreeItemCollapsibleState.None)
    this.contextValue = 'noscripts'
  }
}

type TaskTree = Folder[] | PackageJSON[] | NoScripts[]

export class NpmScriptsTreeDataProvider implements TreeDataProvider<TreeItem> {
  private taskTree: TaskTree | null = null
  private readonly extensionContext: ExtensionContext
  private readonly _onDidChangeTreeData: EventEmitter<TreeItem | null> =
  new EventEmitter<TreeItem | null>()

  readonly onDidChangeTreeData: Event<TreeItem | null> =
  this._onDidChangeTreeData.event

  constructor (private readonly context: ExtensionContext,
    public taskProvider: NpmTaskProvider) {
    const subscriptions = context.subscriptions
    this.extensionContext = context

    subscriptions.push(commands.registerCommand('xpack.runXpmInstall',
      this.runInstall, this))

    subscriptions.push(commands.registerCommand('xpack.runScript',
      this.runScript, this))
    subscriptions.push(commands.registerCommand('xpack.debugScript',
      this.debugScript, this))

    subscriptions.push(commands.registerCommand('xpack.openScript',
      this.openScript, this))
  }

  private async runScript (script: NpmScript): Promise<void> {
    // Call getPackageManager to trigger the multiple lock files warning.
    await getPackageManagerName(this.context, script.getFolder().uri)
    await tasks.executeTask(script.task)
  }

  private async debugScript (script: NpmScript): Promise<void> {
    if (script.package.resourceUri != null) {
      await startDebugging(this.extensionContext, script.task.definition.script,
        path.dirname(script.package.resourceUri.fsPath), script.getFolder())
    }
  }

  private findScriptPosition (document: TextDocument, script?: NpmScript):
  Position | undefined {
    const scripts = readScripts(document)
    if (scripts == null) {
      return undefined
    }

    if (script == null) {
      return scripts.location.range.start
    }

    const found = scripts.scripts.find(s => getTaskName(s.name,
      script.task.definition.path) === script.task.name)
    return found?.nameRange.start
  }

  private async runInstall (): Promise<void> {
  }

  private async openScript (selection: PackageJSON | NpmScript):
  Promise<void> {
    let uri: Uri | undefined
    if (selection instanceof PackageJSON) {
      uri = selection.resourceUri
    } else if (selection instanceof NpmScript) {
      uri = selection.package.resourceUri
    }
    if (uri == null) {
      return
    }
    const document: TextDocument = await workspace.openTextDocument(uri)
    const position = (this.findScriptPosition(document,
      selection instanceof NpmScript ? selection : undefined) != null) ||
      new Position(0, 0)
    await window.showTextDocument(document, {
      preserveFocus: true,
      selection: new Selection(position as Position, position as Position)
    })
  }

  public refresh (): void {
    this.taskTree = null
    this._onDidChangeTreeData.fire(null)
  }

  getTreeItem (element: TreeItem): TreeItem {
    return element
  }

  getParent (element: TreeItem): TreeItem | null {
    if (element instanceof Folder) {
      return null
    }
    if (element instanceof PackageJSON) {
      return element.folder
    }
    if (element instanceof NpmScript) {
      return element.package
    }
    if (element instanceof NoScripts) {
      return null
    }
    return null
  }

  async getChildren (element?: TreeItem): Promise<TreeItem[]> {
    if (this.taskTree == null) {
      const taskItems = await this.taskProvider.tasksWithLocation
      /* if (taskItems) */ {
        const taskTree = this.buildTaskTree(taskItems)
        this.taskTree = this.sortTaskTree(taskTree)
        if (this.taskTree.length === 0) {
          let message = localize('noScripts', 'No scripts found.')
          if (!isAutoDetectionEnabled()) {
            message = localize('autoDetectIsOff',
              'The setting "npm.autoDetect" is "off".')
          }
          this.taskTree = [new NoScripts(message)]
        }
      }
    }
    if (element instanceof Folder) {
      return element.packages
    }
    if (element instanceof PackageJSON) {
      return element.scripts
    }
    if (element instanceof NpmScript) {
      return []
    }
    if (element instanceof NoScripts) {
      return []
    }
    if (element == null) {
      if (this.taskTree != null) {
        return this.taskTree
      }
    }
    return []
  }

  private isInstallTask (task: Task): boolean {
    const fullName = getTaskName('install', task.definition.path)
    return fullName === task.name
  }

  private getTaskTreeItemLabel (taskTreeLabel: string | TreeItemLabel
  | undefined): string {
    if (taskTreeLabel === undefined) {
      return ''
    }

    if (typeof taskTreeLabel === 'string') {
      return taskTreeLabel
    }

    return taskTreeLabel.label
  }

  private sortTaskTree (taskTree: TaskTree): TaskTree {
    return taskTree.sort((first: TreeItem, second: TreeItem) => {
      const firstLabel = this.getTaskTreeItemLabel(first.label)
      const secondLabel = this.getTaskTreeItemLabel(second.label)
      return firstLabel.localeCompare(secondLabel)
    })
  }

  private buildTaskTree (tasks: TaskWithLocation[]): TaskTree {
    const folders: Map<String, Folder> = new Map()
    const packages: Map<String, PackageJSON> = new Map()

    let folder = null
    let packageJson = null

    tasks.forEach(each => {
      if (isWorkspaceFolder(each.task.scope) &&
          !this.isInstallTask(each.task)) {
        folder = folders.get(each.task.scope.name)
        if (folder == null) {
          folder = new Folder(each.task.scope)
          folders.set(each.task.scope.name, folder)
        }
        const definition: XpackTaskDefinition =
          each.task.definition as XpackTaskDefinition

        /* eslint-disable @typescript-eslint/strict-boolean-expressions */
        const relativePath = definition?.path ? definition.path : ''
        const fullPath = path.join(each.task.scope.name, relativePath)
        packageJson = packages.get(fullPath)
        if (packageJson == null) {
          packageJson = new PackageJSON(folder, relativePath)
          folder.addPackage(packageJson)
          packages.set(fullPath, packageJson)
        }
        const script = new NpmScript(this.extensionContext, packageJson,
          each.task, each.location)
        packageJson.addScript(script)
      }
    })
    if (folders.size === 1) {
      return [...packages.values()]
    }
    return [...folders.values()]
  }
}

// ----------------------------------------------------------------------------
