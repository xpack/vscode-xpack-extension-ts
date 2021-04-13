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
import * as path from 'path'

import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'
import { Xpack } from './xpack'
import {
  JsonActions,
  JsonBuildConfigurations,
  XpackTaskDefinition,
  PackageJson,
  JsonActionValue
} from './definitions'

import * as utils from './utils'

// ----------------------------------------------------------------------------

export class DataModel {
  // --------------------------------------------------------------------------
  // Members.

  workspaces: DataNodeWorkspace[] = []
  packages: DataNodePackage[] = []
  configurations: DataNodeConfiguration[] = []
  actions: DataNodeAction[] = []
  _maxSearchDepth: number

  log: Logger

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (
    log: Logger,
    maxSearchDepth: number
  ) {
    this.log = log
    this._maxSearchDepth = maxSearchDepth
  }

  // --------------------------------------------------------------------------
  // Methods.

  async refresh (): Promise<void> {
    this.workspaces.forEach(node => node.dispose())

    this.workspaces = []
    this.packages = []
    this.configurations = []
    this.actions = []

    await this._addWorkspaces()
  }

  async _addWorkspaces (): Promise<void> {
    if (vscode.workspace.workspaceFolders != null) {
      const filteredWorkspaces = vscode.workspace.workspaceFolders.filter(
        workspaceFolder => workspaceFolder.uri.scheme === 'file'
      )
      this.workspaces = filteredWorkspaces.map(
        workspaceFolder => new DataNodeWorkspace(workspaceFolder)
      )

      const promises: Array<Promise<void>> = []

      this.workspaces.forEach(
        (dataNodeWorkspace) => {
          const promise = this._findPackageJsonFilesRecursive(
            dataNodeWorkspace.workspaceFolder.uri.path,
            this._maxSearchDepth,
            dataNodeWorkspace
          )
          promises.push(promise)
        }
      )
      await Promise.all(promises)
    }
  }

  async _findPackageJsonFilesRecursive (
    folderPath: string,
    depth: number,
    parentWorkspace: DataNodeWorkspace
  ): Promise<void> {
    assert(folderPath)
    const log = this.log

    // May be null.
    log.trace(`check folder ${folderPath} `)
    const xpack = new Xpack(folderPath)
    const packageJson = await xpack.checkIfFolderHasPackageJson()
    if (xpack.isPackage()) {
      if (xpack.isXpack()) {
        if (utils.isPrimitive(packageJson.xpack) ||
          Array.isArray(packageJson.xpack)) {
          // If not an object, enforce it, to avoid exceptions.
          packageJson.xpack = {}
        }

        const xpackPackageJson: PackageJson = packageJson

        const nodePackage = parentWorkspace.addPackage(folderPath, packageJson)
        this.packages.push(nodePackage)

        await this.addActions(xpackPackageJson.xpack.actions, nodePackage)

        await this.addConfigurations(
          xpackPackageJson.xpack.buildConfigurations,
          nodePackage)
      }
      return
    }

    if (depth <= 0) {
      return
    }

    // Recurse on children folders.
    const entries =
      await fsPromises.readdir(folderPath, { withFileTypes: true })

    const filteredFolders: Dirent[] = entries.filter(entry =>
      entry.isDirectory() && !entry.name.startsWith('.') &&
      entry.name !== 'node_modules' && entry.name !== 'xpacks'
    )

    // .map() confuses the linter, which enforces await.
    const promises: Array<Promise<void>> = []
    filteredFolders.forEach(
      (entry) => {
        promises.push(
          this._findPackageJsonFilesRecursive(
            path.join(folderPath, entry.name), depth - 1, parentWorkspace)
        )
      })
    await Promise.all(promises)
  }

  async addActions (
    fromJson: JsonActions,
    parent: DataNodeConfiguration | DataNodePackage
  ): Promise<void> {
    if (fromJson !== undefined) {
      for (const actionName of Object.keys(fromJson)) {
        const actionValue = fromJson[actionName]

        const configurationName =
          (parent instanceof DataNodeConfiguration)
            ? parent.name
            : ''
        const task = await this.createTaskForAction(
          actionName,
          configurationName,
          parent.package
        )
        const nodeAction = parent.addAction(actionName, actionValue, task)

        // Also collect an array of actions
        this.actions.push(nodeAction)
      }
    }
  }

  async addConfigurations (
    fromJson: JsonBuildConfigurations,
    parent: DataNodePackage
  ): Promise<void> {
    if (fromJson !== undefined) {
      for (const configurationName of Object.keys(fromJson)) {
        const jsonBuildConfiguration = fromJson[configurationName]

        const dataNodeConfiguration =
          parent.addConfiguration(configurationName)

        await this.addActions(
          jsonBuildConfiguration.actions,
          dataNodeConfiguration
        )

        // Keep a separate array with all build configurations.
        this.configurations.push(dataNodeConfiguration)
      }
    }
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
// Define a hierarchy of data nodes.

/**
 * The base class for all data model nodes.
 */
export class DataNode implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Members.

  name: string

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (name: string) {
    this.name = name
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose (): void {
    throw new Error('dispose() Method not implemented.')
  }
}

/**
 * A class to store an workspace folder and an array of packages.
 */
export class DataNodeWorkspace extends DataNode {
  // --------------------------------------------------------------------------
  // Members.

  workspaceFolder: vscode.WorkspaceFolder
  packages: DataNodePackage[] = []

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (
    workspaceFolder: vscode.WorkspaceFolder
  ) {
    // Use the index to generate unique names.
    super(workspaceFolder.index.toString())
    this.workspaceFolder = workspaceFolder
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  get parent (): null { return null }

  // --------------------------------------------------------------------------
  // Methods.

  addPackage (folderPath: string, packageJson: PackageJson): DataNodePackage {
    const node = new DataNodePackage(folderPath, packageJson, this)
    this.packages.push(node)

    return node
  }

  dispose (): void {
    this.packages.forEach(node => node.dispose())
    this.packages = []
  }
}

/**
 * A class to store the data related to an xPack, its location and
 * configurations/actions.
 */
export class DataNodePackage extends DataNode {
  // --------------------------------------------------------------------------
  // Members.

  parent: DataNodeWorkspace

  /**
   * The xPack folder absolute path.
   * The relative path, is available as folderRelativePath.
   */
  folderPath: string

  /**
   * The parsed package.json
   */
  packageJson: PackageJson

  /**
   * xPack wide actions.
   */
  actions: DataNodeAction[] = []

  /**
   * xPack build configurations.
   */
  configurations: DataNodeConfiguration[] = []

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (
    folderPath: string,
    packageJson: PackageJson,
    parent: DataNodeWorkspace
  ) {
    // Pass the relative path as name.
    super(path.relative(parent.workspaceFolder.uri.path, folderPath))
    this.parent = parent

    this.folderPath = folderPath
    this.packageJson = packageJson
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

  // --------------------------------------------------------------------------
  // Methods.

  addAction (
    name: string,
    value: JsonActionValue,
    task: vscode.Task
  ): DataNodeAction {
    const nodeAction = new DataNodeAction(name, value, task, this)
    this.actions.push(nodeAction)

    return nodeAction
  }

  addConfiguration (
    name: string
  ): DataNodeConfiguration {
    const nodeBuildConfiguration = new DataNodeConfiguration(name, this)
    this.configurations.push(nodeBuildConfiguration)

    return nodeBuildConfiguration
  }

  dispose (): void {
    this.actions.forEach(node => node.dispose())
    this.actions = []
    this.configurations.forEach(node => node.dispose())
    this.configurations = []
  }
}

/**
 * A class to store the configuration name and its actions.
 */
export class DataNodeConfiguration extends DataNode {
  // --------------------------------------------------------------------------
  // Members.

  parent: DataNodePackage
  actions: DataNodeAction[] = []

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (name: string, parent: DataNodePackage) {
    super(name)
    this.parent = parent
  }

  // --------------------------------------------------------------------------
  // Getters & setters.

  get package (): DataNodePackage {
    return (this.parent)
  }

  // --------------------------------------------------------------------------
  // Methods.

  addAction (
    name: string,
    value: JsonActionValue,
    task: vscode.Task
  ): DataNodeAction {
    const nodeAction = new DataNodeAction(name, value, task, this)
    this.actions.push(nodeAction)

    return nodeAction
  }

  dispose (): void {
    this.actions.forEach(node => node.dispose())
    this.actions = []
  }
}

/**
 * A class to store the action commands and the associated task.
 */
export class DataNodeAction extends DataNode {
  // --------------------------------------------------------------------------
  // Members.

  parent: DataNodeConfiguration | DataNodePackage

  /**
   * The action value is always normalised to an array of commands.
   */
  value: string[]

  /**
   * The VSCode task to be executed when the Run button is pressed.
   */
  task: vscode.Task

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (
    name: string,
    value: JsonActionValue,
    task: vscode.Task,
    parent: DataNodeConfiguration | DataNodePackage
  ) {
    super(name)
    this.parent = parent

    // Ensure always array of strings.
    if (Array.isArray(value)) {
      this.value = value
    } else {
      this.value = [value]
    }

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
    this.value = []
    // Type protection
    this.task = undefined as unknown as vscode.Task
  }
}

// ----------------------------------------------------------------------------
