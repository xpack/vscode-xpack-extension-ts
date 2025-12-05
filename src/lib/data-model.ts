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

// ----------------------------------------------------------------------------

import assert from 'node:assert'
import * as fs from 'fs/promises'
import { Dirent } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'
import {
  JsonNpmPackage,
  JsonXpmPackage,
  JsonScripts,
  JsonProperties,
  JsonBuildConfiguration,
  JsonBuildConfigurations,
  JsonXpack,
  JsonActions,
  XpmLiquidData,
  XpmLiquidSubstitutionMap,
} from '@xpack/xpm-liquid'

import { Xpack } from './xpack.js'
import {
  XpackTaskDefinition,
  buildFolderRelativePathPropertyName,
  // JsonBuildConfiguration
} from './definitions.js'

import * as utils from './utils.js'

import { XpmLiquid, filterPath } from '@xpack/xpm-liquid'

// ----------------------------------------------------------------------------

export class DataModel implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Members.

  workspaceFolders: DataNodeWorkspaceFolder[] = []
  workspaceProjects: DataNodePackage[] = []
  packages: DataNodePackage[] = []
  xpmConfigurations: DataNodeConfiguration[] = []

  npmScripts: DataNodeNpmScript[] = [] // npm scripts
  commands: DataNodeCommand[] = [] // Associated with npm scripts like install
  xpmActions: DataNodeXpmAction[] = [] // xpm actions

  tasks: vscode.Task[] = []

  _maxSearchDepth: number

  log: Logger

  cancellation: vscode.CancellationTokenSource =
    new vscode.CancellationTokenSource()

  // --------------------------------------------------------------------------
  // Constructor.

  constructor(log: Logger, maxSearchDepth: number) {
    this.log = log
    this._maxSearchDepth = maxSearchDepth
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
          new DataNodeWorkspaceFolder(workspaceFolder, this.log)
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
        const promise = this._findPackageJsonFilesRecursive(
          dataNodeWorkspaceFolder.workspaceFolder.uri.fsPath,
          this._maxSearchDepth,
          dataNodeWorkspaceFolder,
          excludeArray
        )
        promises.push(promise)
      })
      if (!this.cancellation.token.isCancellationRequested) {
        await Promise.all(promises)
      }
    }
  }

  async _findPackageJsonFilesRecursive(
    folderPath: string,
    depth: number,
    parentWorkspaceFolder: DataNodeWorkspaceFolder,
    exclude: string[]
  ): Promise<void> {
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

    const xpack = new Xpack(log, folderPath)
    const packageJson = await xpack.checkIfFolderHasPackageJson()
    if (packageJson !== null && xpack.isPackage()) {
      if (
        xpack.hasNpmScripts() ||
        (xpack.isXpmPackage() && xpack.hasXpmActions())
      ) {
        const dataNodePackage = parentWorkspaceFolder.addPackage(
          folderPath,
          packageJson
        )

        this.packages.push(dataNodePackage)

        if (dataNodePackage.folderRelativePath === '') {
          // If the package is in the root of the workspace folder,
          // it is a project.
          this.workspaceProjects.push(dataNodePackage)
        }

        if (xpack.hasNpmScripts()) {
          this.addNpmCommands(packageJson, dataNodePackage)
          this.addNpmScripts(packageJson.scripts, dataNodePackage)
        }

        if (xpack.isXpmPackage()) {
          if (!utils.isJsonObject(packageJson.xpack)) {
            // If not an object, enforce it, to avoid exceptions.
            packageJson.xpack = {}
            dataNodePackage.package.isPackageJsonDirty = true
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const xpackPackageJson: JsonXpmPackage = packageJson as JsonXpmPackage

          const liquidData = new XpmLiquidData({
            log: log,
            packageJson: xpackPackageJson,
          })

          this.addXpmCommands(xpackPackageJson.xpack, dataNodePackage)

          // await this.addXpmActions(
          //   xpackPackageJson.xpack.actions,
          //   dataNodePackage
          // )

          if (liquidData.topActions.hasActions()) {
            await this.addXpmTopActions(liquidData, dataNodePackage)
          }

          await this.addXpmConfigurations(
            xpackPackageJson.xpack.buildConfigurations,
            dataNodePackage
          )

          if (liquidData.hasBuildConfigurations()) {
            await this.addXpmBuildConfigurations(liquidData, dataNodePackage)
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
        this._findPackageJsonFilesRecursive(
          path.join(folderPath, entry.name),
          depth - 1,
          parentWorkspaceFolder,
          exclude
        )
      )
    })

    await Promise.all(promises)
  }

  addNpmCommands(fromJson: JsonNpmPackage, parent: DataNodePackage): void {
    if (this.cancellation.token.isCancellationRequested) {
      return
    }hasTopActions

    let scripts: JsonScripts | undefined
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

    const task = this.createTaskForCommand('npm install', '', parent.package)
    this.tasks.push(task)

    const dataNodeCommand = parent.addCommand('npm install', task)
    this.commands.push(dataNodeCommand)
  }

  addNpmScripts(
    fromJson: JsonScripts | undefined,
    parent: DataNodePackage
  ): void {
    // const log = this.log

    if (fromJson !== undefined) {
      for (const scriptName of Object.keys(fromJson)) {
        const task = this.createTaskForScript(scriptName, parent.package)

        if (this.cancellation.token.isCancellationRequested) {
          return
        }

        const dataNodeAction = parent.addNpmScript(
          scriptName,
          fromJson[scriptName],
          task
        )

        // Also collect an array of scripts
        this.npmScripts.push(dataNodeAction)

        this.tasks.push(task)
      }
    }
  }

  addXpmCommands(
    fromJson: JsonXpack | JsonBuildConfiguration,
    parent: DataNodeConfiguration | DataNodePackage
  ): void {
    const configurationName =
      parent instanceof DataNodeConfiguration ? parent.name : ''

    if (this.cancellation.token.isCancellationRequested) {
      return
    }

    let actions: JsonActions | undefined
    if (parent instanceof DataNodeConfiguration) {
      if (!utils.hasDependencies(fromJson)) {
        // There are no xpm dependencies to install.
        return
      }
      actions = (fromJson as JsonBuildConfiguration).actions
    } else if (parent instanceof DataNodePackage) {
      if (!utils.hasDependencies(fromJson)) {
        return
      }
      actions = (fromJson as JsonXpack).actions
    } else {
      throw new Error('Internal error, unknown parent.')
    }

    if (actions && ('install' in actions || 'xpm-install' in actions)) {
      // An action with the explicit name `install` or `xpm-install` is present;
      // do not show the default command.
      return
    }

    const task = this.createTaskForCommand(
      'xpm install',
      configurationName,
      parent.package
    )
    this.tasks.push(task)

    const dataNodeCommand = parent.addCommand('xpm install', task)
    this.commands.push(dataNodeCommand)
  }

  async addXpmTopActions(liquidData: XpmLiquidData, parent: DataNodePackage) {
    const log = this.log

    for (const actionName of liquidData.topActions.getActionNames()) {
      log.trace(actionName)
      const task = this.createTaskForAction(actionName, '', parent.package)

      if (this.cancellation.token.isCancellationRequested) {
        return
      }

      const actionCommands =
        await (liquidData.topActions.getAction(actionName)).getCommands()

      const dataNodeAction = parent.addXpmAction(
        actionName,
        actionCommands,
        task
      )

      // Also collect an array of actions
      this.xpmActions.push(dataNodeAction)

      this.tasks.push(task)
    }
  }

  async addXpmActions(
    fromJson: JsonActions | undefined,
    parent: DataNodeConfiguration | DataNodePackage
  ): Promise<void> {
    // const log = this.log

    const configurationName =
      parent instanceof DataNodeConfiguration ? parent.name : ''

    if (fromJson !== undefined) {
      for (const actionName of Object.keys(fromJson)) {
        const task = this.createTaskForAction(
          actionName,
          configurationName,
          parent.package
        )

        if (this.cancellation.token.isCancellationRequested) {
          return
        }

        const actionJsonValue: string = Array.isArray(fromJson[actionName])
          ? fromJson[actionName].join(os.EOL)
          : fromJson[actionName]

        let actionValue: string
        try {
          actionValue = await parent.xpmLiquidEngine.performSubstitutions(
            actionJsonValue,
            parent.xpmLiquidMap
          )
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
          // log.trace(err)
          actionValue = actionJsonValue
        }
        const dataNodeAction = parent.addXpmAction(
          actionName,
          actionValue.split(os.EOL),
          task
        )

        // Also collect an array of actions
        this.xpmActions.push(dataNodeAction)

        this.tasks.push(task)
      }
    }
  }

  async addXpmConfigurations(
    fromJson: JsonBuildConfigurations | undefined,
    parent: DataNodePackage
  ): Promise<void> {
    if (fromJson !== undefined) {
      for (const configurationName of Object.keys(fromJson)) {
        const jsonBuildConfiguration = fromJson[configurationName]

        const hidden = jsonBuildConfiguration.hidden ?? false
        const dataNodeConfiguration = parent.addConfiguration(
          configurationName,
          hidden
        )

        this.addXpmCommands(jsonBuildConfiguration, dataNodeConfiguration)
        await this.addXpmActions(
          jsonBuildConfiguration.actions,
          dataNodeConfiguration
        )

        if (this.cancellation.token.isCancellationRequested) {
          return
        }

        // Keep a separate array with all build configurations.
        this.xpmConfigurations.push(dataNodeConfiguration)
      }
    }
  }

  async addXpmBuildConfigurations(
    liquidData: XpmLiquidData,
    parent: DataNodePackage
  ) {
    const log = this.log

    for (const actionName of liquidData.listBuildConfigurationsNames()) {
      log.trace(actionName)
    }
  }

  createTaskForCommand(
    commandName: string,
    configurationName: string,
    dataNodePackage: DataNodePackage
  ): vscode.Task {
    const taskDefinition: XpackTaskDefinition = {
      type: 'xPack',
      xpmCommand: commandName,
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

    const task = utils.createTask(
      'xpm',
      commandArguments,
      dataNodePackage.parent.workspaceFolder,
      folderPath,
      taskLabel,
      taskDefinition
    )

    return task
  }

  createTaskForScript(
    scriptName: string,
    dataNodePackage: DataNodePackage
  ): vscode.Task {
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
      taskDefinition
    )

    return task
  }

  createTaskForAction(
    actionName: string,
    configurationName: string,
    dataNodePackage: DataNodePackage
  ): vscode.Task {
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

  constructor(name: string, log: Logger) {
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

  constructor(workspaceFolder: vscode.WorkspaceFolder, log: Logger) {
    // Use the index to generate unique names.
    super(workspaceFolder.index.toString(), log)
    this.workspaceFolder = workspaceFolder

    log.trace(
      'DataNodeWorkspaceFolder ' +
        `${workspaceFolder.name} ${workspaceFolder.index.toString()}`
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

  addPackage(folderPath: string, packageJson: JsonNpmPackage): DataNodePackage {
    const dataNodePackage = new DataNodePackage(
      folderPath,
      packageJson,
      this,
      this.log
    )
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
  packageJson: JsonNpmPackage

  isPackageJsonDirty = false

  isXpack = false

  npmScripts: DataNodeNpmScript[] = []

  /**
   * The xPack wide commands.
   */
  commands: DataNodeCommand[] = []

  /**
   * The xPack wide actions.
   */
  xpmActions: DataNodeXpmAction[] = []

  /**
   * The xPack build configurations.
   */
  xpmConfigurations: DataNodeConfiguration[] = []

  /**
   * A preconfigured instance of the Liquid engine.
   */
  xpmLiquidEngine: XpmLiquid

  /**
   * The map with properties used by the Liquid engine to perform substitutions.
   */
  xpmLiquidMap: XpmLiquidSubstitutionMap

  // --------------------------------------------------------------------------
  // Constructor.

  constructor(
    folderPath: string,
    packageJson: JsonNpmPackage,
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
  get folderRelativePath(): string {
    return this.name
  }

  get package(): this {
    return this
  }

  get properties(): JsonProperties {
    return (this.xpmLiquidMap.properties ?? {}) as JsonProperties
  }

  // --------------------------------------------------------------------------
  // Methods.

  addNpmScript(
    name: string,
    value: string,
    task: vscode.Task
  ): DataNodeNpmScript {
    const dataNodeScript = new DataNodeNpmScript(
      name,
      value,
      task,
      this,
      this.log
    )
    this.npmScripts.push(dataNodeScript)

    return dataNodeScript
  }

  addCommand(name: string, task: vscode.Task): DataNodeCommand {
    const dataNodeCommand = new DataNodeCommand(name, task, this, this.log)
    this.commands.push(dataNodeCommand)

    return dataNodeCommand
  }

  addXpmAction(
    name: string,
    value: string[],
    task: vscode.Task
  ): DataNodeXpmAction {
    const dataNodeAction = new DataNodeXpmAction(
      name,
      value,
      task,
      this,
      this.log
    )
    this.xpmActions.push(dataNodeAction)

    return dataNodeAction
  }

  addConfiguration(name: string, hidden: boolean): DataNodeConfiguration {
    const dataNodeConfiguration = new DataNodeConfiguration(
      name,
      hidden,
      this,
      this.log
    )

    this.xpmConfigurations.push(dataNodeConfiguration)

    return dataNodeConfiguration
  }

  dispose(): void {
    this.commands.forEach((node) => {
      node.dispose()
    })
    this.commands = undefined as unknown as DataNodeCommand[]

    this.npmScripts.forEach((node) => {
      node.dispose()
    })
    this.npmScripts = undefined as unknown as DataNodeNpmScript[]

    this.xpmActions.forEach((node) => {
      node.dispose()
    })
    this.xpmActions = undefined as unknown as DataNodeXpmAction[]

    this.xpmConfigurations.forEach((node) => {
      node.dispose()
    })
    this.xpmConfigurations = undefined as unknown as DataNodeConfiguration[]

    this.packageJson = undefined as unknown as JsonXpmPackage

    this.xpmLiquidEngine = undefined as unknown as XpmLiquid
    this.xpmLiquidMap = undefined as unknown as XpmLiquidSubstitutionMap

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
   * Configuration commands.
   */
  commands: DataNodeCommand[] = []

  /**
   * Configuration actions.
   */
  xpmActions: DataNodeXpmAction[] = []

  xpmLiquidEngine: XpmLiquid
  xpmLiquidMap: XpmLiquidSubstitutionMap

  // --------------------------------------------------------------------------
  // Constructor.

  constructor(
    name: string,
    hidden: boolean,
    parent: DataNodePackage,
    log: Logger
  ) {
    super(name, log)
    this.hidden = hidden
    this.parent = parent

    this.xpmLiquidEngine = new XpmLiquid(this.log)
    this.xpmLiquidMap = this.xpmLiquidEngine.prepareMap(
      parent.packageJson,
      name
    )

    log.trace(`DataNodeConfiguration ${this.name}`)
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  get package(): DataNodePackage {
    return this.parent
  }

  get properties(): JsonProperties {
    return (this.xpmLiquidMap.properties ?? {}) as JsonProperties
  }

  // --------------------------------------------------------------------------
  // Methods.

  addCommand(name: string, task: vscode.Task): DataNodeCommand {
    const dataNodeCommand = new DataNodeCommand(name, task, this, this.log)
    this.commands.push(dataNodeCommand)

    return dataNodeCommand
  }

  addXpmAction(
    name: string,
    value: string[],
    task: vscode.Task
  ): DataNodeXpmAction {
    const dataNodeAction = new DataNodeXpmAction(
      name,
      value,
      task,
      this,
      this.log
    )
    this.xpmActions.push(dataNodeAction)

    return dataNodeAction
  }

  async getBuildFolderRelativePath(): Promise<string> {
    const log = this.log

    let folderPath: string
    if (buildFolderRelativePathPropertyName in this.properties) {
      folderPath = this.properties[buildFolderRelativePathPropertyName]
      if (folderPath !== '') {
        try {
          return await this.xpmLiquidEngine.performSubstitutions(
            folderPath,
            this.xpmLiquidMap
          )
        } catch (err) {
          log.trace(err)
        }
      }
    }

    // Provide a default value, based on the name.
    return path.join('build', filterPath(this.name))
  }

  dispose(): void {
    this.commands.forEach((node) => {
      node.dispose()
    })
    this.commands = undefined as unknown as DataNodeCommand[]

    this.xpmActions.forEach((node) => {
      node.dispose()
    })
    this.xpmActions = undefined as unknown as DataNodeXpmAction[]

    this.xpmLiquidEngine = undefined as unknown as XpmLiquid
    this.xpmLiquidMap = undefined as unknown as XpmLiquidSubstitutionMap

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

  constructor(
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

  constructor(
    name: string,
    value: string[],
    task: vscode.Task,
    parent: DataNodeConfiguration | DataNodePackage,
    log: Logger
  ) {
    super(name, task, parent, log)

    this.value = value

    log.trace(`DataNodeXpmAction ${this.name}`)
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

  constructor(
    name: string,
    value: string,
    task: vscode.Task,
    parent: DataNodePackage,
    log: Logger
  ) {
    super(name, task, parent, log)

    this.value = value

    log.trace(`DataNodeNpmString ${this.name}`)
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
export class DataNodeCommand extends DataNodeRunnable {
  // --------------------------------------------------------------------------
  // Members.

  // --------------------------------------------------------------------------
  // Constructor.

  constructor(
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
