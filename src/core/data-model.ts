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
 * This file was inspired by vscode.git/extensions/npm/src/*.ts.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

// ----------------------------------------------------------------------------

import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import { Dirent } from 'node:fs'
import * as path from 'node:path'

import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'
import * as xpmLib from '@xpack/xpm-lib'

import { XpackTaskDefinition } from './definitions.js'

import * as utils from '../functions/utils.js'

// ----------------------------------------------------------------------------

export class DataModel implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Members.

  workspaceFolders: DataNodeWorkspaceFolder[] = []
  workspaceProjects: DataNodePackage[] = []
  packages: DataNodePackage[] = []
  xpmConfigurations: DataNodeConfiguration[] = []

  npmScripts: DataNodeNpmScript[] = [] // npm scripts
  npmCommands: DataNodeNpmCommand[] = [] // npm scripts like install
  xpmActions: DataNodeXpmAction[] = [] // xpm actions
  xpmCommands: DataNodeNpmCommand[] = [] // xpm actions like install

  tasks: vscode.Task[] = []

  #maxSearchDepth: number

  log: Logger

  cancellation: vscode.CancellationTokenSource =
    new vscode.CancellationTokenSource()

  // --------------------------------------------------------------------------
  // Constructor.

  constructor({
    log,
    maxSearchDepth,
  }: {
    log: Logger
    maxSearchDepth: number
  }) {
    this.log = log
    this.#maxSearchDepth = maxSearchDepth

    log.trace(`${DataModel.name}()`)
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose(): void {
    // Dispose the current hierarchy, recursively.
    this.workspaceFolders.forEach((node) => {
      node.dispose()
    })
  }

  async createTree(): Promise<void> {
    const log = this.log
    if (vscode.workspace.workspaceFolders != null) {
      const filteredWorkspaces = vscode.workspace.workspaceFolders.filter(
        (workspaceFolder) => workspaceFolder.uri.scheme === 'file'
      )
      this.workspaceFolders = filteredWorkspaces.map(
        (workspaceFolder) =>
          new DataNodeWorkspaceFolder({ workspaceFolder, log: this.log })
      )

      const promises: Promise<void>[] = []

      this.workspaceFolders.forEach((dataNodeWorkspaceFolder) => {
        const folderConfiguration = vscode.workspace.getConfiguration(
          'xpack',
          dataNodeWorkspaceFolder.workspaceFolder.uri
        )
        const exclude = folderConfiguration.get<string | string[]>(
          'exclude',
          []
        )
        const excludeArray = Array.isArray(exclude) ? exclude : [exclude]
        log.trace(`excludeArray [${excludeArray.join(',')}]`)
        const promise = this.#findPackageJsonFilesRecursive({
          folderPath: dataNodeWorkspaceFolder.workspaceFolder.uri.fsPath,
          depth: this.#maxSearchDepth,
          parentWorkspaceFolder: dataNodeWorkspaceFolder,
          exclude: excludeArray,
        })
        promises.push(promise)
      })
      if (!this.cancellation.token.isCancellationRequested) {
        await Promise.all(promises)
      }
    }
  }

  async #findPackageJsonFilesRecursive({
    folderPath,
    depth,
    parentWorkspaceFolder,
    exclude,
  }: {
    folderPath: string
    depth: number
    parentWorkspaceFolder: DataNodeWorkspaceFolder
    exclude: string[]
  }): Promise<void> {
    assert(folderPath)
    const log = this.log

    if (this.cancellation.token.isCancellationRequested) {
      return
    }

    for (const pattern of exclude) {
      if (utils.testForExclusionPattern(folderPath, pattern)) {
        log.trace(`excluded ${folderPath} ${pattern}`)
        return
      }
    }

    // May be null.
    log.trace(`check folder ${folderPath} `)

    const xpmPackage = new xpmLib.Package({
      log,
      packageFolderPath: folderPath,
    })
    const jsonPackage = await xpmPackage.readPackageDotJson()

    if (xpmPackage.isNpmPackage()) {
      if (
        xpmPackage.hasNpmScripts() ||
        (xpmPackage.isXpmPackage() && xpmPackage.hasXpmActions())
      ) {
        assert(jsonPackage)
        const dataNodePackage = parentWorkspaceFolder.addPackage({
          folderPath,
          jsonPackage,
        })

        this.packages.push(dataNodePackage)

        if (dataNodePackage.folderRelativePath === '') {
          // If the package is in the root of the workspace folder,
          // it is a project.
          this.workspaceProjects.push(dataNodePackage)
        }

        if (xpmPackage.hasNpmScripts()) {
          this.addNpmCommands({
            fromJson: jsonPackage,
            parent: dataNodePackage,
          })
          this.addNpmScripts({
            fromJson: jsonPackage.scripts,
            parent: dataNodePackage,
          })
        }

        if (xpmPackage.isXpmPackage()) {
          if (!utils.isJsonObject(jsonPackage.xpack)) {
            // If not an object, enforce it, to avoid exceptions.
            jsonPackage.xpack = {}
            dataNodePackage.package.isPackageJsonDirty = true
          }

          const liquidDataModel = new xpmLib.DataModel({
            log: log,
            jsonPackage,
          })

          this.addXpmCommands({
            fromJson: jsonPackage.xpack,
            parent: dataNodePackage,
          })

          await liquidDataModel.actions.initialise()
          if (!liquidDataModel.actions.isEmpty) {
            await this.addXpmTopActions({
              liquidDataModel: liquidDataModel,
              parent: dataNodePackage,
            })
          }

          await liquidDataModel.buildConfigurations.initialise()
          if (!liquidDataModel.buildConfigurations.isEmpty) {
            await this.addXpmBuildConfigurations({
              liquidDataModel,
              parent: dataNodePackage,
            })
          }
        }
      }
    }

    if (depth <= 0) {
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.cancellation.token.isCancellationRequested) {
      return
    }

    // Recurse on children folders.
    const entries = await fs.readdir(folderPath, { withFileTypes: true })

    const filteredFolders: Dirent[] = entries.filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules' &&
        entry.name !== 'xpacks'
    )

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.cancellation.token.isCancellationRequested) {
      return
    }

    // .map() confuses the linter, which enforces await.
    const promises: Promise<void>[] = []
    filteredFolders.forEach((entry) => {
      promises.push(
        this.#findPackageJsonFilesRecursive({
          folderPath: path.join(folderPath, entry.name),
          depth: depth - 1,
          parentWorkspaceFolder,
          exclude,
        })
      )
    })

    await Promise.all(promises)
  }

  addNpmCommands({
    fromJson,
    parent,
  }: {
    fromJson: xpmLib.JsonNpmPackage
    parent: DataNodePackage
  }): void {
    if (this.cancellation.token.isCancellationRequested) {
      return
    }

    let scripts: xpmLib.JsonScripts | undefined
    if (parent instanceof DataNodePackage) {
      if (!utils.hasDependencies(fromJson)) {
        // There are no npm dependencies to install.
        return
      }
      scripts = fromJson.scripts
    } else {
      throw new Error('Internal error, unknown parent.')
    }

    if (scripts && ('install' in scripts || 'npm-install' in scripts)) {
      // An action with the explicit name `install` or `npm-install` is present;
      // do not show the default command.
      return
    }

    const task = this.createTaskForCommand({
      command: 'npm',
      commandArguments: ['install'],
      configurationName: '',
      dataNodePackage: parent.package,
    })
    this.tasks.push(task)

    const dataNodeNpmCommand = parent.addNpmCommand({
      command: 'install',
      task,
    })
    this.npmCommands.push(dataNodeNpmCommand)
  }

  addNpmScripts({
    fromJson,
    parent,
  }: {
    fromJson: xpmLib.JsonScripts | undefined
    parent: DataNodePackage
  }): void {
    // const log = this.log

    if (fromJson !== undefined) {
      for (const scriptName of Object.keys(fromJson)) {
        const task = this.createTaskForScript({
          scriptName,
          dataNodePackage: parent.package,
        })

        if (this.cancellation.token.isCancellationRequested) {
          return
        }

        const dataNodeAction = parent.addNpmScript({
          name: scriptName,
          value: fromJson[scriptName],
          task,
        })

        // Also collect an array of scripts
        this.npmScripts.push(dataNodeAction)

        this.tasks.push(task)
      }
    }
  }

  addXpmCommands({
    fromJson,
    parent,
  }: {
    fromJson: xpmLib.JsonXpack | xpmLib.JsonBuildConfiguration
    parent: DataNodeConfiguration | DataNodePackage
  }): void {
    const configurationName =
      parent instanceof DataNodeConfiguration ? parent.name : ''

    if (this.cancellation.token.isCancellationRequested) {
      return
    }

    let jsonActions: xpmLib.JsonActions | undefined
    if (parent instanceof DataNodeConfiguration) {
      if (!utils.hasDependencies(fromJson)) {
        // There are no xpm dependencies to install.
        return
      }
      jsonActions = (fromJson as xpmLib.JsonBuildConfigurationContent).actions
    } else if (parent instanceof DataNodePackage) {
      if (!utils.hasDependencies(fromJson)) {
        return
      }
      jsonActions = (fromJson as xpmLib.JsonXpack).actions
    } else {
      throw new Error('Internal error, unknown parent.')
    }

    if (
      jsonActions &&
      ('install' in jsonActions || 'xpm-install' in jsonActions)
    ) {
      // An action with the explicit name `install` or `xpm-install` is present;
      // do not show the default command.
      return
    }

    const task = this.createTaskForCommand({
      command: 'xpm',
      commandArguments: ['install'],
      configurationName,
      dataNodePackage: parent.package,
    })
    this.tasks.push(task)

    const dataNodeXpmCommand = parent.addXpmCommand({
      command: 'install',
      task,
    })
    this.xpmCommands.push(dataNodeXpmCommand)
  }

  async addXpmTopActions({
    liquidDataModel,
    parent,
  }: {
    liquidDataModel: xpmLib.DataModel
    parent: DataNodePackage
  }) {
    const log = this.log

    for (const actionName of liquidDataModel.actions.names) {
      log.trace(actionName)
      const task = this.createTaskForAction({
        actionName,
        configurationName: '',
        dataNodePackage: parent.package,
      })

      if (this.cancellation.token.isCancellationRequested) {
        return
      }

      const action = liquidDataModel.actions.get(actionName)
      await action.initialise()

      const dataNodeAction = parent.addXpmAction({
        name: actionName,
        value: action.commands,
        task,
      })

      // Also collect an array of actions
      this.xpmActions.push(dataNodeAction)

      this.tasks.push(task)
    }
  }

  async addXpmBuildConfigurationActions({
    liquidDataModel,
    parent,
  }: {
    liquidDataModel: xpmLib.DataModel
    parent: DataNodeConfiguration
  }): Promise<void> {
    const buildConfigurationName = parent.name

    const buildConfiguration = liquidDataModel.buildConfigurations.get(
      buildConfigurationName
    )
    await buildConfiguration.initialise()

    await buildConfiguration.actions.initialise()
    if (buildConfiguration.actions.isEmpty) {
      return
    }

    for (const actionName of buildConfiguration.actions.names) {
      const task = this.createTaskForAction({
        actionName,
        configurationName: buildConfigurationName,
        dataNodePackage: parent.package,
      })

      if (this.cancellation.token.isCancellationRequested) {
        return
      }

      const action = buildConfiguration.actions.get(actionName)
      await action.initialise()

      const dataNodeAction = parent.addXpmAction({
        name: actionName,
        value: action.commands,
        task,
      })

      // Collect an array of actions.
      this.xpmActions.push(dataNodeAction)

      this.tasks.push(task)
    }
  }

  async addXpmBuildConfigurations({
    liquidDataModel,
    parent,
  }: {
    liquidDataModel: xpmLib.DataModel
    parent: DataNodePackage
  }) {
    const log = this.log

    const buildConfigurationNames = liquidDataModel.buildConfigurations.names
    for (const buildConfigurationName of buildConfigurationNames) {
      log.trace(buildConfigurationName)
      const hidden = liquidDataModel.buildConfigurations.isHidden(
        buildConfigurationName
      )
      if (hidden) {
        continue
      }
      if (
        !liquidDataModel.buildConfigurations.hasJson(buildConfigurationName)
      ) {
        continue
      }

      const buildConfiguration = liquidDataModel.buildConfigurations.get(
        buildConfigurationName
      )
      await buildConfiguration.initialise()

      const dataNodeConfiguration = parent.addConfiguration({
        name: buildConfigurationName,
        hidden,
        buildFolderRelativePath: buildConfiguration.buildFolderRelativePath,
      })

      const jsonBuildConfiguration =
        liquidDataModel.buildConfigurations.getJson(buildConfigurationName)

      this.addXpmCommands({
        fromJson: jsonBuildConfiguration,
        parent: dataNodeConfiguration,
      })

      await this.addXpmBuildConfigurationActions({
        liquidDataModel,
        parent: dataNodeConfiguration,
      })

      if (this.cancellation.token.isCancellationRequested) {
        return
      }

      // Keep a separate array with all build configurations.
      this.xpmConfigurations.push(dataNodeConfiguration)
    }
  }

  createTaskForCommand({
    command,
    commandArguments,
    configurationName,
    dataNodePackage,
  }: {
    command: string
    commandArguments: string[]
    configurationName: string
    dataNodePackage: DataNodePackage
  }): vscode.Task {
    const taskDefinition: XpackTaskDefinition = {
      type: 'xPack',
      xpmCommand: command,
    }

    const relativePath = dataNodePackage.folderRelativePath
    const folderPath = dataNodePackage.folderPath

    if (configurationName !== '') {
      taskDefinition.buildConfigurationName = configurationName
    }

    if (relativePath !== '') {
      taskDefinition.packageFolderRelativePath = relativePath
    }

    const taskCommandArguments = commandArguments
    let taskLabel
    if (configurationName !== '') {
      taskLabel = `install configuration ${configurationName} dependencies`
      taskCommandArguments.push('--config', configurationName)
    } else {
      taskLabel = 'install project dependencies'
    }

    if (relativePath !== '') {
      taskLabel += ` (${relativePath})`
    }
    this.log.trace(taskDefinition)

    const task = utils.createTask(
      command,
      taskCommandArguments,
      dataNodePackage.parent.workspaceFolder,
      folderPath,
      taskLabel,
      taskDefinition,
      this.log
    )

    return task
  }

  createTaskForScript({
    scriptName,
    dataNodePackage,
  }: {
    scriptName: string
    dataNodePackage: DataNodePackage
  }): vscode.Task {
    const taskDefinition: XpackTaskDefinition = {
      type: 'xPack',
      scriptName,
    }

    const relativePath = dataNodePackage.folderRelativePath
    const folderPath = dataNodePackage.folderPath

    if (relativePath !== '') {
      taskDefinition.packageFolderRelativePath = relativePath
    }

    const commandArguments = ['run', scriptName]
    let taskLabel = scriptName
    if (relativePath !== '') {
      taskLabel += ` (${relativePath})`
    }

    const task = utils.createTask(
      'npm',
      commandArguments,
      dataNodePackage.parent.workspaceFolder,
      folderPath,
      taskLabel,
      taskDefinition,
      this.log
    )

    return task
  }

  createTaskForAction({
    actionName,
    configurationName,
    dataNodePackage,
  }: {
    actionName: string
    configurationName: string
    dataNodePackage: DataNodePackage
  }): vscode.Task {
    const taskDefinition: XpackTaskDefinition = {
      type: 'xPack',
      actionName,
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

    const task = utils.createTask(
      'xpm',
      commandArguments,
      dataNodePackage.parent.workspaceFolder,
      folderPath,
      taskLabel,
      taskDefinition,
      this.log
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

  constructor({ name, log }: { name: string; log: Logger }) {
    this.name = name
    this.log = log
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose(): void {
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

  constructor({
    workspaceFolder,
    log,
  }: {
    workspaceFolder: vscode.WorkspaceFolder
    log: Logger
  }) {
    // Use the index to generate unique names.
    super({ name: workspaceFolder.index.toString(), log })
    this.workspaceFolder = workspaceFolder

    log.trace(
      DataNodeWorkspaceFolder.name +
        `(${workspaceFolder.name}, ${workspaceFolder.index.toString()})`
    )
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get parent(): null {
    return null
  }

  get folderName(): string {
    return this.workspaceFolder.name
  }

  // --------------------------------------------------------------------------
  // Methods.

  addPackage({
    folderPath,
    jsonPackage,
  }: {
    folderPath: string
    jsonPackage: xpmLib.JsonNpmPackage
  }): DataNodePackage {
    const dataNodePackage = new DataNodePackage({
      folderPath,
      jsonPackage,
      parent: this,
      log: this.log,
    })
    this.packages.push(dataNodePackage)

    return dataNodePackage
  }

  dispose(): void {
    this.packages.forEach((node) => {
      node.dispose()
    })

    this.packages = undefined as unknown as DataNodePackage[]
    this.workspaceFolder = undefined as unknown as vscode.WorkspaceFolder

    this.log = undefined as unknown as Logger
  }
}

/**
 * A class to store the data related to an xpm package, its location and
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
  jsonPackage: xpmLib.JsonNpmPackage

  isPackageJsonDirty = false

  isXpack = false

  npmScripts: DataNodeNpmScript[] = []

  /**
   * The npm top commands.
   */
  npmCommands: DataNodeNpmCommand[] = []

  /**
   * The xpm top actions.
   */
  xpmActions: DataNodeXpmAction[] = []

  /**
   * The xpm top commands.
   */
  xpmCommands: DataNodeXpmCommand[] = []

  /**
   * The xpm build configurations.
   */
  xpmConfigurations: DataNodeConfiguration[] = []

  // --------------------------------------------------------------------------
  // Constructor.

  constructor({
    folderPath,
    jsonPackage,
    parent,
    log,
  }: {
    folderPath: string
    jsonPackage: xpmLib.JsonNpmPackage
    parent: DataNodeWorkspaceFolder
    log: Logger
  }) {
    // Pass the relative path as name.
    super({
      name: path.relative(parent.workspaceFolder.uri.fsPath, folderPath),
      log,
    })
    this.parent = parent

    this.folderPath = folderPath
    this.jsonPackage = jsonPackage

    log.trace(`${DataNodePackage.name}(${this.name})`)
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  /** The xPack folder path, relative to the workspace folder. */
  get folderRelativePath(): string {
    return this.name
  }

  get package(): this {
    return this
  }

  // --------------------------------------------------------------------------
  // Methods.

  addNpmScript({
    name,
    value,
    task,
  }: {
    name: string
    value: string
    task: vscode.Task
  }): DataNodeNpmScript {
    const dataNodeScript = new DataNodeNpmScript({
      name,
      value,
      task,
      parent: this,
      log: this.log,
    })
    this.npmScripts.push(dataNodeScript)

    return dataNodeScript
  }

  addNpmCommand({
    command,
    task,
  }: {
    command: string
    task: vscode.Task
  }): DataNodeNpmCommand {
    const dataNodeNpmCommand = new DataNodeNpmCommand({
      command,
      task,
      parent: this,
      log: this.log,
    })
    this.npmCommands.push(dataNodeNpmCommand)

    return dataNodeNpmCommand
  }

  addXpmAction({
    name,
    value,
    task,
  }: {
    name: string
    value: string[]
    task: vscode.Task
  }): DataNodeXpmAction {
    const dataNodeXpmAction = new DataNodeXpmAction({
      name,
      value,
      task,
      parent: this,
      log: this.log,
    })
    this.xpmActions.push(dataNodeXpmAction)

    return dataNodeXpmAction
  }

  addXpmCommand({
    command,
    task,
  }: {
    command: string
    task: vscode.Task
  }): DataNodeXpmCommand {
    const dataNodeXpmCommand = new DataNodeXpmCommand({
      command: command,
      task,
      parent: this,
      log: this.log,
    })
    this.xpmCommands.push(dataNodeXpmCommand)

    return dataNodeXpmCommand
  }

  addConfiguration({
    name,
    hidden,
    buildFolderRelativePath,
  }: {
    name: string
    hidden: boolean
    buildFolderRelativePath: string
  }): DataNodeConfiguration {
    const dataNodeConfiguration = new DataNodeConfiguration({
      name,
      hidden,
      parent: this,
      buildFolderRelativePath,
      log: this.log,
    })

    this.xpmConfigurations.push(dataNodeConfiguration)

    return dataNodeConfiguration
  }

  dispose(): void {
    this.npmScripts.forEach((node) => {
      node.dispose()
    })
    this.npmScripts = undefined as unknown as DataNodeNpmScript[]

    this.npmCommands.forEach((node) => {
      node.dispose()
    })
    this.npmCommands = undefined as unknown as DataNodeNpmCommand[]

    this.xpmActions.forEach((node) => {
      node.dispose()
    })
    this.xpmActions = undefined as unknown as DataNodeXpmAction[]

    this.xpmCommands.forEach((node) => {
      node.dispose()
    })
    this.xpmCommands = undefined as unknown as DataNodeXpmCommand[]

    this.xpmConfigurations.forEach((node) => {
      node.dispose()
    })
    this.xpmConfigurations = undefined as unknown as DataNodeConfiguration[]

    this.jsonPackage = undefined as unknown as xpmLib.JsonXpmPackage

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

  hidden: boolean

  parent: DataNodePackage

  /**
   * Configuration actions.
   */
  xpmActions: DataNodeXpmAction[] = []

  /**
   * Configuration xpm commands.
   */
  xpmCommands: DataNodeXpmCommand[] = []

  buildFolderRelativePath: string

  // --------------------------------------------------------------------------
  // Constructor.

  constructor({
    name,
    hidden,
    parent,
    buildFolderRelativePath,
    log,
  }: {
    name: string
    hidden: boolean
    parent: DataNodePackage
    buildFolderRelativePath: string
    log: Logger
  }) {
    super({ name, log })
    this.hidden = hidden
    this.parent = parent

    this.buildFolderRelativePath = buildFolderRelativePath

    log.trace(`${DataNodeConfiguration.name}(${this.name})`)
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  get package(): DataNodePackage {
    return this.parent
  }

  // --------------------------------------------------------------------------
  // Methods.

  addXpmAction({
    name,
    value,
    task,
  }: {
    name: string
    value: string[]
    task: vscode.Task
  }): DataNodeXpmAction {
    const dataNodeAction = new DataNodeXpmAction({
      name,
      value,
      task,
      parent: this,
      log: this.log,
    })
    this.xpmActions.push(dataNodeAction)

    return dataNodeAction
  }

  addXpmCommand({
    command,
    task,
  }: {
    command: string
    task: vscode.Task
  }): DataNodeXpmCommand {
    const dataNodeXpmCommand = new DataNodeXpmCommand({
      command,
      task,
      parent: this,
      log: this.log,
    })
    this.xpmCommands.push(dataNodeXpmCommand)

    return dataNodeXpmCommand
  }

  dispose(): void {
    this.xpmActions.forEach((node) => {
      node.dispose()
    })
    this.xpmActions = undefined as unknown as DataNodeXpmAction[]

    this.xpmCommands.forEach((node) => {
      node.dispose()
    })
    this.xpmCommands = undefined as unknown as DataNodeXpmCommand[]

    this.parent = undefined as unknown as DataNodePackage

    super.dispose()
  }
}

// ----------------------------------------------------------------------------

/**
 * A parent class for actions and commands to store the associated task.
 */
class DataNodeRunnable extends DataNode {
  // --------------------------------------------------------------------------
  // Members.

  parent: DataNodeConfiguration | DataNodePackage

  /**
   * The VS Code task to be executed when the Run button is pressed.
   */
  task: vscode.Task

  // --------------------------------------------------------------------------
  // Constructor.

  constructor({
    name,
    task,
    parent,
    log,
  }: {
    name: string
    task: vscode.Task
    parent: DataNodeConfiguration | DataNodePackage
    log: Logger
  }) {
    super({ name, log })

    this.parent = parent
    this.task = task

    log.trace(`${DataNodeRunnable.name}(${this.name})`)
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  get package(): DataNodePackage {
    if (this.parent instanceof DataNodePackage) {
      return this.parent
    } else if (this.parent instanceof DataNodeConfiguration) {
      return this.parent.parent
    } else {
      throw new Error('Unexpected hierarchy')
    }
  }

  get configurationName(): string {
    if (this.parent instanceof DataNodeConfiguration) {
      return this.parent.name
    } else {
      return ''
    }
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose(): void {
    // Avoid type protection.
    this.task = undefined as unknown as vscode.Task
    this.parent = undefined as unknown as DataNodePackage

    super.dispose()
  }
}

/**
 * A class to store the action value and the associated task.
 */
export class DataNodeXpmAction extends DataNodeRunnable {
  // --------------------------------------------------------------------------
  // Members.

  /**
   * The action value is always normalised to an array of commands,
   * and has all substitutions performed.
   */
  value: string[]

  // --------------------------------------------------------------------------
  // Constructor.

  constructor({
    name,
    value,
    task,
    parent,
    log,
  }: {
    name: string
    value: string[]
    task: vscode.Task
    parent: DataNodeConfiguration | DataNodePackage
    log: Logger
  }) {
    super({ name, task, parent, log })

    this.value = value

    log.trace(`${DataNodeXpmAction.name}(${this.name})`)
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  // --------------------------------------------------------------------------
  // Methods.

  dispose(): void {
    this.value = undefined as unknown as string[]

    super.dispose()
  }
}

/**
 * A class to store the command and the associated task.
 */
export class DataNodeXpmCommand extends DataNodeRunnable {
  // --------------------------------------------------------------------------
  // Members.

  // --------------------------------------------------------------------------
  // Constructor.

  constructor({
    command,
    task,
    parent,
    log,
  }: {
    command: string
    task: vscode.Task
    parent: DataNodeConfiguration | DataNodePackage
    log: Logger
  }) {
    super({ name: command, task, parent, log })

    log.trace(`${DataNodeXpmCommand.name}(${this.name})`)
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  // --------------------------------------------------------------------------
  // Methods.
}

/**
 * A class to store the npm script value and the associated task.
 */
export class DataNodeNpmScript extends DataNodeRunnable {
  // --------------------------------------------------------------------------
  // Members.

  /**
   * The script value is always a string
   */
  value: string

  // --------------------------------------------------------------------------
  // Constructor.

  constructor({
    name,
    value,
    task,
    parent,
    log,
  }: {
    name: string
    value: string
    task: vscode.Task
    parent: DataNodePackage
    log: Logger
  }) {
    super({ name, task, parent, log })

    this.value = value

    log.trace(`${DataNodeNpmScript.name}(${this.name})`)
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  // --------------------------------------------------------------------------
  // Methods.

  dispose(): void {
    this.value = undefined as unknown as string

    super.dispose()
  }
}

// ----------------------------------------------------------------------------

/**
 * A class to store the command and the associated task.
 */
export class DataNodeNpmCommand extends DataNodeRunnable {
  // --------------------------------------------------------------------------
  // Members.

  // --------------------------------------------------------------------------
  // Constructor.

  constructor({
    command,
    task,
    parent,
    log,
  }: {
    command: string
    task: vscode.Task
    parent: DataNodePackage
    log: Logger
  }) {
    super({ name: command, task, parent, log })

    log.trace(`${DataNodeNpmCommand.name}(${this.name})`)
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  // --------------------------------------------------------------------------
  // Methods.
}

// ----------------------------------------------------------------------------
