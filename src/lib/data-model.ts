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
import { Dirent, promises as fsPromises } from 'fs'
import * as os from 'os'
import * as path from 'path'

import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'
import { Xpack } from './xpack'
import {
  JsonActions,
  JsonBuildConfigurations,
  XpackTaskDefinition,
  XpackPackageJson,
  // JsonActionValue,
  JsonProperties,
  buildFolderRelativePathPropertyName,
  JsonBuildConfiguration
  // JsonBuildConfiguration
} from './definitions'

import * as utils from './utils'
import { XpmLiquid, filterPath } from '@xpack/xpm-liquid'

// ----------------------------------------------------------------------------

export class DataModel implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Members.

  workspaceFolders: DataNodeWorkspaceFolder[] = []
  workspaceProjects: DataNodePackage[] = []
  packages: DataNodePackage[] = []
  configurations: DataNodeConfiguration[] = []
  commands: DataNodeCommand[] = []
  actions: DataNodeAction[] = []

  tasks: vscode.Task[] = []

  _maxSearchDepth: number

  log: Logger

  cancellation: vscode.CancellationTokenSource =
  new vscode.CancellationTokenSource()

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (
    log: Logger,
    maxSearchDepth: number
  ) {
    this.log = log
    this._maxSearchDepth = maxSearchDepth
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose (): void {
    // Dispose the current hierarchy, recursively.
    this.workspaceFolders.forEach(
      node => node.dispose())
  }

  async createTree (): Promise<void> {
    if (vscode.workspace.workspaceFolders != null) {
      const filteredWorkspaces = vscode.workspace.workspaceFolders.filter(
        (workspaceFolder) => workspaceFolder.uri.scheme === 'file'
      )
      this.workspaceFolders = filteredWorkspaces.map(
        (workspaceFolder) =>
          new DataNodeWorkspaceFolder(workspaceFolder, this.log)
      )

      const promises: Array<Promise<void>> = []

      this.workspaceFolders.forEach(
        (dataNodeWorkspaceFolder) => {
          const folderConfiguration = vscode.workspace.getConfiguration(
            'xpack', dataNodeWorkspaceFolder.workspaceFolder.uri)
          const exclude = folderConfiguration
            .get<string | string[]>('exclude', [])
          const excludeArray = Array.isArray(exclude) ? exclude : [exclude]
          const promise = this._findPackageJsonFilesRecursive(
            dataNodeWorkspaceFolder.workspaceFolder.uri.fsPath,
            this._maxSearchDepth,
            dataNodeWorkspaceFolder,
            excludeArray
          )
          promises.push(promise)
        }
      )
      if (!this.cancellation.token.isCancellationRequested) {
        await Promise.all(promises)
      }
    }
  }

  async _findPackageJsonFilesRecursive (
    folderPath: string,
    depth: number,
    parentWorkspaceFolder: DataNodeWorkspaceFolder,
    exclude: string[]
  ): Promise<void> {
    assert(folderPath)
    const log = this.log

    // May be null.
    log.trace(`check folder ${folderPath} `)

    if (this.cancellation.token.isCancellationRequested) {
      return
    }

    for (const pattern of exclude) {
      if (utils.testForExclusionPattern(folderPath, pattern)) {
        return
      }
    }

    const xpack = new Xpack(folderPath)
    const packageJson = await xpack.checkIfFolderHasPackageJson()
    if (xpack.isPackage()) {
      if (xpack.isXpack()) {
        let isPackageJsonDirty = false
        if (!utils.isJsonObject(packageJson.xpack)) {
          const saved = packageJson.xpack
          // If not an object, enforce it, to avoid exceptions.
          packageJson.xpack = {
            _saved: saved
          }
          isPackageJsonDirty = true
        }

        const xpackPackageJson: XpackPackageJson = packageJson

        const dataNodePackage =
          parentWorkspaceFolder.addPackage(folderPath, packageJson)
        dataNodePackage.package.isPackageJsonDirty = isPackageJsonDirty
        this.packages.push(dataNodePackage)

        if (dataNodePackage.folderRelativePath === '') {
          // If the package is in the root of the workspace folder,
          // it is a project.
          this.workspaceProjects.push(dataNodePackage)
        }

        await this.addCommands(xpackPackageJson, dataNodePackage)
        await this.addActions(xpackPackageJson.xpack.actions, dataNodePackage)

        await this.addConfigurations(
          xpackPackageJson.xpack.buildConfigurations, dataNodePackage)
      }
      return
    }

    if (depth <= 0) {
      return
    }

    if (this.cancellation.token.isCancellationRequested) {
      return
    }

    // Recurse on children folders.
    const entries =
      await fsPromises.readdir(folderPath, { withFileTypes: true })

    const filteredFolders: Dirent[] = entries.filter(entry =>
      entry.isDirectory() && !entry.name.startsWith('.') &&
      entry.name !== 'node_modules' && entry.name !== 'xpacks'
    )

    if (this.cancellation.token.isCancellationRequested) {
      return
    }

    // .map() confuses the linter, which enforces await.
    const promises: Array<Promise<void>> = []
    filteredFolders.forEach(
      (entry) => {
        promises.push(
          this._findPackageJsonFilesRecursive(
            path.join(folderPath, entry.name),
            depth - 1,
            parentWorkspaceFolder,
            exclude)
        )
      })

    await Promise.all(promises)
  }

  async addCommands (
    fromJson: XpackPackageJson | JsonBuildConfiguration,
    parent: DataNodeConfiguration | DataNodePackage
  ): Promise<void> {
    if (utils.isNonEmptyJsonObject(fromJson.dependencies) ||
    utils.isNonEmptyJsonObject(fromJson.devDependencies)) {
      const configurationName =
      (parent instanceof DataNodeConfiguration)
        ? parent.name
        : ''

      if (this.cancellation.token.isCancellationRequested) {
        return
      }

      const task = await this.createTaskForCommand(
        'install',
        configurationName,
        parent.package
      )

      const dataNodeCommand = parent.addCommand('install', task)

      this.commands.push(dataNodeCommand)
      this.tasks.push(task)
    }
  }

  async addActions (
    fromJson: JsonActions | undefined,
    parent: DataNodeConfiguration | DataNodePackage
  ): Promise<void> {
    const log = this.log

    if (fromJson !== undefined) {
      for (const actionName of Object.keys(fromJson)) {
        const configurationName =
          (parent instanceof DataNodeConfiguration)
            ? parent.name
            : ''
        const task = await this.createTaskForAction(
          actionName,
          configurationName,
          parent.package
        )

        if (this.cancellation.token.isCancellationRequested) {
          return
        }

        const actionJsonValue: string = Array.isArray(fromJson[actionName])
          ? (fromJson[actionName] as string[]).join(os.EOL)
          : (fromJson[actionName] as string)

        let actionValue: string
        try {
          actionValue = await parent.xpmLiquidEngine.performSubstitutions(
            actionJsonValue, parent.xpmLiquidMap)
        } catch (err) {
          log.trace(err)
          actionValue = actionJsonValue
        }
        const dataNodeAction = parent.addAction(actionName,
          actionValue.split(os.EOL), task)

        // Also collect an array of actions
        this.actions.push(dataNodeAction)

        this.tasks.push(task)
      }
    }
  }

  async addConfigurations (
    fromJson: JsonBuildConfigurations | undefined,
    parent: DataNodePackage
  ): Promise<void> {
    if (fromJson !== undefined) {
      for (const configurationName of Object.keys(fromJson)) {
        const jsonBuildConfiguration = fromJson[configurationName]

        const dataNodeConfiguration =
          parent.addConfiguration(configurationName)

        await this.addCommands(
          jsonBuildConfiguration, dataNodeConfiguration)
        await this.addActions(
          jsonBuildConfiguration.actions, dataNodeConfiguration)

        if (this.cancellation.token.isCancellationRequested) {
          return
        }

        // Keep a separate array with all build configurations.
        this.configurations.push(dataNodeConfiguration)
      }
    }
  }

  async createTaskForCommand (
    commandName: string,
    configurationName: string,
    dataNodePackage: DataNodePackage
  ): Promise<vscode.Task> {
    const taskDefinition: XpackTaskDefinition = {
      type: 'xPack',
      xpmCommand: commandName
    }

    const relativePath = dataNodePackage.folderRelativePath
    const folderPath = dataNodePackage.folderPath

    if (configurationName !== '') {
      taskDefinition.buildConfigurationName = configurationName
    }

    if (relativePath !== '') {
      taskDefinition.packageFolderRelativePath = relativePath
    }

    const commandArguments = [commandName]
    let taskLabel
    if (configurationName !== '') {
      taskLabel = `install configuration ${configurationName} dependencies`
      commandArguments.push('--config', configurationName)
    } else {
      taskLabel = 'install project dependencies'
    }

    if (relativePath !== '') {
      taskLabel += ` (${relativePath})`
    }

    const task = await utils.createTask(
      'xpm',
      commandArguments,
      (dataNodePackage.parent).workspaceFolder,
      folderPath,
      taskLabel,
      taskDefinition
    )

    return task
  }

  async createTaskForAction (
    actionName: string,
    configurationName: string,
    dataNodePackage: DataNodePackage
  ): Promise<vscode.Task> {
    const taskDefinition: XpackTaskDefinition = {
      type: 'xPack',
      actionName
    }

    const relativePath = dataNodePackage.folderRelativePath
    const folderPath = dataNodePackage.folderPath

    if (configurationName !== '') {
      taskDefinition.buildConfigurationName = configurationName
    }

    if (relativePath !== '') {
      taskDefinition.packageFolderRelativePath = relativePath
    }

    const commandArguments = ['run', actionName]
    let taskLabel = actionName
    if (configurationName !== '') {
      taskLabel += ` ${configurationName}`
      commandArguments.push('--config', configurationName)
    }
    if (relativePath !== '') {
      taskLabel += ` (${relativePath})`
    }

    const task = await utils.createTask(
      'xpm',
      commandArguments,
      (dataNodePackage.parent).workspaceFolder,
      folderPath,
      taskLabel,
      taskDefinition
    )

    return task
  }
}

// ----------------------------------------------------------------------------
// Objects to define a hierarchy of data nodes.

/**
 * The base class for all data model nodes.
 */
export class DataNode implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Members.

  name: string
  log: Logger

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (name: string, log: Logger) {
    this.name = name
    this.log = log
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose (): void {
    this.name = undefined as unknown as string
    this.log = undefined as unknown as Logger
  }
}

/**
 * A class to store an workspace folder and an array of packages.
 */
export class DataNodeWorkspaceFolder extends DataNode {
  // --------------------------------------------------------------------------
  // Members.

  workspaceFolder: vscode.WorkspaceFolder
  packages: DataNodePackage[] = []

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (
    workspaceFolder: vscode.WorkspaceFolder,
    log: Logger
  ) {
    // Use the index to generate unique names.
    super(workspaceFolder.index.toString(), log)
    this.workspaceFolder = workspaceFolder

    log.trace(
      `DataNodeWorkspace ${workspaceFolder.name} ${workspaceFolder.index}`)
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  get parent (): null { return null }

  // --------------------------------------------------------------------------
  // Methods.

  addPackage (
    folderPath: string,
    packageJson: XpackPackageJson
  ): DataNodePackage {
    const dataNodePackage =
      new DataNodePackage(folderPath, packageJson, this, this.log)
    this.packages.push(dataNodePackage)

    return dataNodePackage
  }

  dispose (): void {
    this.packages.forEach(
      (node) => node.dispose())

    this.packages = undefined as unknown as DataNodePackage[]
    this.workspaceFolder = undefined as unknown as vscode.WorkspaceFolder

    this.log = undefined as unknown as Logger
  }
}

/**
 * A class to store the data related to an xPack, its location and
 * configurations/actions.
 */
export class DataNodePackage extends DataNode {
  // --------------------------------------------------------------------------
  // Members.

  parent: DataNodeWorkspaceFolder

  /**
   * The xPack folder absolute path.
   * The relative path, is available as folderRelativePath.
   */
  folderPath: string

  /**
   * The parsed package.json
   */
  packageJson: XpackPackageJson

  isPackageJsonDirty: boolean = false

  /**
   * The xPack wide commands.
   */
  commands: DataNodeCommand[] = []

  /**
   * The xPack wide actions.
   */
  actions: DataNodeAction[] = []

  /**
   * The xPack build configurations.
   */
  configurations: DataNodeConfiguration[] = []

  /**
   * A preconfigured instance of the Liquid engine.
   */
  xpmLiquidEngine: XpmLiquid

  /**
   * The map with properties used by the Liquid engine to perform substitutions.
   */
  xpmLiquidMap: any

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (
    folderPath: string,
    packageJson: XpackPackageJson,
    parent: DataNodeWorkspaceFolder,
    log: Logger
  ) {
    // Pass the relative path as name.
    super(path.relative(parent.workspaceFolder.uri.fsPath, folderPath), log)
    this.parent = parent

    this.folderPath = folderPath
    this.packageJson = packageJson

    this.xpmLiquidEngine = new XpmLiquid(this.log)
    this.xpmLiquidMap = this.xpmLiquidEngine.prepareMap(packageJson)

    log.trace(`DataNodePackage ${this.name}`)
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  /** The xPack folder path, relative to the workspace folder. */
  get folderRelativePath (): string {
    return this.name
  }

  get package (): DataNodePackage {
    return this
  }

  get properties (): JsonProperties {
    return this.xpmLiquidMap.properties
  }

  // --------------------------------------------------------------------------
  // Methods.

  addCommand (
    name: string,
    task: vscode.Task
  ): DataNodeCommand {
    const dataNodeCommand = new DataNodeCommand(name, task, this, this.log)
    this.commands.push(dataNodeCommand)

    return dataNodeCommand
  }

  addAction (
    name: string,
    value: string[],
    task: vscode.Task
  ): DataNodeAction {
    const dataNodeAction = new DataNodeAction(name, value, task, this, this.log)
    this.actions.push(dataNodeAction)

    return dataNodeAction
  }

  addConfiguration (
    name: string
  ): DataNodeConfiguration {
    const dataNodeConfiguration =
      new DataNodeConfiguration(name, this, this.log)

    this.configurations.push(dataNodeConfiguration)

    return dataNodeConfiguration
  }

  dispose (): void {
    this.commands.forEach(
      (node) => node.dispose())
    this.commands = undefined as unknown as DataNodeCommand[]

    this.actions.forEach(
      (node) => node.dispose())
    this.actions = undefined as unknown as DataNodeAction[]

    this.configurations.forEach(
      (node) => node.dispose())
    this.configurations = undefined as unknown as DataNodeConfiguration[]

    this.packageJson = undefined as unknown as XpackPackageJson

    this.xpmLiquidEngine = undefined as unknown as XpmLiquid
    this.xpmLiquidMap = undefined

    this.parent = undefined as unknown as DataNodeWorkspaceFolder

    super.dispose()
  }
}

/**
 * A class to store the configuration name and its actions.
 */
export class DataNodeConfiguration extends DataNode {
  // --------------------------------------------------------------------------
  // Members.

  parent: DataNodePackage

  /**
   * Configuration commands.
   */
  commands: DataNodeCommand[] = []

  /**
   * Configuration actions.
   */
  actions: DataNodeAction[] = []

  xpmLiquidEngine: XpmLiquid
  xpmLiquidMap: any

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (
    name: string,
    parent: DataNodePackage,
    log: Logger
  ) {
    super(name, log)
    this.parent = parent

    this.xpmLiquidEngine = new XpmLiquid(this.log)
    this.xpmLiquidMap = this.xpmLiquidEngine.prepareMap(
      parent.packageJson, name)

    log.trace(`DataNodeConfiguration ${this.name}`)
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  get package (): DataNodePackage {
    return (this.parent)
  }

  get properties (): JsonProperties {
    return this.xpmLiquidMap.properties
  }

  // --------------------------------------------------------------------------
  // Methods.

  addCommand (
    name: string,
    task: vscode.Task
  ): DataNodeCommand {
    const dataNodeCommand = new DataNodeCommand(name, task, this, this.log)
    this.commands.push(dataNodeCommand)

    return dataNodeCommand
  }

  addAction (
    name: string,
    value: string[],
    task: vscode.Task
  ): DataNodeAction {
    const dataNodeAction = new DataNodeAction(name, value, task, this, this.log)
    this.actions.push(dataNodeAction)

    return dataNodeAction
  }

  async getBuildFolderRelativePath (): Promise<string> {
    const log = this.log

    const folderPath = this.properties[buildFolderRelativePathPropertyName]
    if (folderPath !== undefined && folderPath !== '') {
      try {
        return await this.xpmLiquidEngine.performSubstitutions(
          folderPath, this.xpmLiquidMap)
      } catch (err) {
        log.trace(err)
      }
    }

    // Provide a default value, based on the name.
    return path.join('build', filterPath(this.name))
  }

  dispose (): void {
    this.commands.forEach(
      (node) => node.dispose())
    this.commands = undefined as unknown as DataNodeCommand[]

    this.actions.forEach(
      (node) => node.dispose())
    this.actions = undefined as unknown as DataNodeAction[]

    this.xpmLiquidEngine = undefined as unknown as XpmLiquid
    this.xpmLiquidMap = undefined

    this.parent = undefined as unknown as DataNodePackage

    super.dispose()
  }
}

// ----------------------------------------------------------------------------

/**
 * A parent class for actions and commands to store the associated task.
 */
class DataNodeRunable extends DataNode {
  // --------------------------------------------------------------------------
  // Members.

  parent: DataNodeConfiguration | DataNodePackage

  /**
   * The VS Code task to be executed when the Run button is pressed.
   */
  task: vscode.Task

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (
    name: string,
    task: vscode.Task,
    parent: DataNodeConfiguration | DataNodePackage,
    log: Logger
  ) {
    super(name, log)

    this.parent = parent
    this.task = task
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  get package (): DataNodePackage {
    if (this.parent instanceof DataNodePackage) {
      return (this.parent)
    } else if (this.parent instanceof DataNodeConfiguration) {
      return (this.parent.parent)
    } else {
      throw new Error('Unexpected hierarchy')
    }
  }

  get configurationName (): string {
    if (this.parent instanceof DataNodeConfiguration) {
      return this.parent.name
    } else {
      return ''
    }
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose (): void {
    // Avoid type protection.
    this.task = undefined as unknown as vscode.Task
    this.parent = undefined as unknown as DataNodePackage

    super.dispose()
  }
}

/**
 * A class to store the action value and the associated task.
 */
export class DataNodeAction extends DataNodeRunable {
  // --------------------------------------------------------------------------
  // Members.

  /**
   * The action value is always normalised to an array of commands,
   * and has all substitutions performed.
   */
  value: string[]

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (
    name: string,
    value: string[],
    task: vscode.Task,
    parent: DataNodeConfiguration | DataNodePackage,
    log: Logger
  ) {
    super(name, task, parent, log)

    this.value = value

    log.trace(`DataNodeAction ${this.name}`)
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  // --------------------------------------------------------------------------
  // Methods.

  dispose (): void {
    this.value = undefined as unknown as string[]

    super.dispose()
  }
}

// ----------------------------------------------------------------------------

/**
 * A class to store the command and the associated task.
 */
export class DataNodeCommand extends DataNodeRunable {
  // --------------------------------------------------------------------------
  // Members.

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (
    name: string,
    task: vscode.Task,
    parent: DataNodeConfiguration | DataNodePackage,
    log: Logger
  ) {
    super(name, task, parent, log)

    log.trace(`DataNodeCommand ${this.name}`)
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  // --------------------------------------------------------------------------
  // Methods.
}

// ----------------------------------------------------------------------------
