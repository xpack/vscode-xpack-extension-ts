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

/*
 * Module for vscode-cpptools integration.
 *
 * This module uses the [vscode-cpptools API](https://www.npmjs.com/package/vscode-cpptools)
 * to provide the C/C++ extension with per-file configuration information,
 * similar to vscode-cmake-tools integration.
 */

import * as assert from 'assert'
import { promises as fsPromises } from 'fs'
import * as os from 'os'
import * as path from 'path'

// https://www.npmjs.com/package/make-dir
import * as makeDir from 'make-dir'

import * as vscode from 'vscode'
import * as cpt from 'vscode-cpptools'

import { Logger } from '@xpack/logger'

import { ExtensionManager } from './manager'
import { DataNodeWorkspaceFolder } from './data-model'

// ----------------------------------------------------------------------------

interface JsonCCppProperties {
  configurations: JsonCCppPropertiesConfiguration[]
  version: number
}

interface JsonCCppPropertiesConfiguration {
  name: string
  configurationProvider?: string
  compileCommands?: string
}

// ----------------------------------------------------------------------------

export class IntelliSense implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  static async register (
    manager: ExtensionManager
  ): Promise<IntelliSense> {
    const _intellisense = new IntelliSense(manager)
    manager.subscriptions.push(_intellisense)

    const log = manager.log

    await _intellisense._initialize()

    log.trace('IntelliSense object created')
    return _intellisense
  }

  // --------------------------------------------------------------------------
  // Members.

  readonly log: Logger

  readonly manager: ExtensionManager

  private readonly _configProvider: CppConfigurationProvider
  private _cppToolsAPI?: cpt.CppToolsApi

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (manager: ExtensionManager) {
    this.manager = manager
    this.log = manager.log

    // const log = this.log

    manager.addCallbackRefresh(
      async () => {
        await this.refresh()
      }
    )

    const context = this.manager.vscodeContext

    this._configProvider = new CppConfigurationProvider(manager)
    context.subscriptions.push(this._configProvider)
  }

  // --------------------------------------------------------------------------
  // Methods.

  async _initialize (): Promise<void> {
    const log = this.log

    this._cppToolsAPI = await cpt.getCppToolsApi(cpt.Version.v4)

    if (this._cppToolsAPI !== undefined) {
      // Cannot do this in the constructor, since it requires the API,
      // available only as async.
      this._cppToolsAPI.registerCustomConfigurationProvider(
        this._configProvider)
      log.trace('CustomConfigurationProvider registered')

      // TODO more inits

      // When done, notify C++.
      // TODO: check if this is the right place for it.
      this._cppToolsAPI.notifyReady(this._configProvider)
    }
  }

  // --------------------------------------------------------------------------

  async updateCppPropertiesJson (): Promise<void> {
    const log = this.log

    log.trace('IntelliSense.updateCppPropertiesJson()')

    const promises: Array<Promise<void>> = []
    this.manager.data.workspaceFolders.forEach(
      (workspaceFolder) =>
        promises.push(this.updateWorkspaceCCppProperties(workspaceFolder))
    )

    await Promise.all(promises)
  }

  async updateWorkspaceCCppProperties (
    workspaceFolder: DataNodeWorkspaceFolder
  ): Promise<void> {
    const log = this.log

    log.trace(workspaceFolder.workspaceFolder.uri.fsPath)

    const vscodeFolderPath: string = path.join(
      workspaceFolder.workspaceFolder.uri.fsPath, '.vscode')

    const jsonFilePath: string = path.join(
      vscodeFolderPath, 'c_cpp_properties.json')

    let json: JsonCCppProperties
    try {
      const fileContent = await fsPromises.readFile(jsonFilePath)
      assert(fileContent !== null)
      json = JSON.parse(fileContent.toString())
    } catch (err) {
      // Ensure that the folder is there.
      await makeDir(vscodeFolderPath)
      json = {
        configurations: [],
        version: 4
      }
    }

    if (json.configurations === undefined) {
      // If it does not exist, add an empty array.
      json.configurations = []
    }

    await this.updateWorkspaceFolderCompileCommands(
      workspaceFolder, json.configurations)

    if (json.configurations.length > 0) {
      const fileNewContent = JSON.stringify(json, null, 2) + os.EOL
      await fsPromises.writeFile(jsonFilePath, fileNewContent)
      log.trace(`${jsonFilePath} written back`)
    }
  }

  async updateWorkspaceFolderCompileCommands (
    dataNodeWorkspaceFolder: DataNodeWorkspaceFolder,
    jsonConfigurations: JsonCCppPropertiesConfiguration[]
  ): Promise<void> {
    const log = this.log

    for (const dataNodePackage of dataNodeWorkspaceFolder.packages) {
      for (const dataNodeConfiguration of dataNodePackage.configurations) {
        let globalConfigurationName = dataNodeConfiguration.name
        if (dataNodePackage.folderRelativePath !== '') {
          globalConfigurationName += ' - '
          globalConfigurationName += dataNodePackage.folderRelativePath
        }
        log.trace(`c/c++ configuration name: ${globalConfigurationName}`)

        // First try to identify an existing configuration;
        // if not found, create a new empty one.
        const currentJsonConfiguration =
          this.prepareCCppPropertiesConfiguration(
            globalConfigurationName, jsonConfigurations)

        // Then set/override two properties, one being the provider.
        currentJsonConfiguration.configurationProvider = 'ms-vscode.cmake-tools'

        // TODO: use the variable (via substitutions)
        const buildFolderRelativePath =
          await dataNodeConfiguration.getBuildFolderRelativePath()

        const newBaseFolderPath =
          (dataNodeWorkspaceFolder.packages.length > 1)
            ? dataNodePackage.folderPath
            : '$' + '{workspaceFolder}'

        const newPath = path.join(
          newBaseFolderPath,
          buildFolderRelativePath,
          'compile_commands.json'
        )

        // Also set/override the path to compile_commands.json.
        currentJsonConfiguration.compileCommands = newPath

        log.trace(`c/c++ compileCommands: ${newPath}`)
      }
    }
  }

  /**
   * First try to identify an existing configuration in the given array;
   * if not found, create a new empty one and add it to the array.
   *
   * @param configurationName - The configuration name as it
   * is expected to appear in the compile_commands.json file.
   * @param jsonConfigurations - An array of configurations.
   *
   * @returns Either an exisiting configuration or a new empty one.
   */
  prepareCCppPropertiesConfiguration (
    configurationName: string,
    jsonConfigurations: JsonCCppPropertiesConfiguration[]
  ): JsonCCppPropertiesConfiguration {
    // If a configuration with the same name exists, return it.
    for (const jsonConfiguration of jsonConfigurations) {
      if (jsonConfiguration.name === configurationName) {
        return jsonConfiguration
      }
    }

    // If it does not exist, create a minimal named object...
    const currentJsonConfiguration: JsonCCppPropertiesConfiguration = {
      name: configurationName
    }
    // ... and add it to the array.
    jsonConfigurations.push(currentJsonConfiguration)

    return currentJsonConfiguration
  }

  // --------------------------------------------------------------------------

  async refresh (): Promise<void> {
    const log = this.log

    log.trace('IntelliSense.refresh()')

    await this.updateCppPropertiesJson()
  }

  // --------------------------------------------------------------------------

  dispose (): void {
    const log = this.log

    log.trace('IntelliSense.dispose()')

    if (this._cppToolsAPI != null) {
      this._cppToolsAPI.dispose()
    }
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------

// Cpp calls:
// - canProvideBrowseConfigurationsPerFolder
// - canProvideBrowseConfiguration

export class CppConfigurationProvider
implements cpt.CustomConfigurationProvider {
  // --------------------------------------------------------------------------
  // Members.

  // Name and ID, as visible to cpptools.
  readonly name: string = 'xPack Tools'
  extensionId: string = 'ilg-vscode.xpack'

  private readonly _workspaceBrowseConfiguration:
  cpt.WorkspaceBrowseConfiguration =
  {
    browsePath: []
  }

  private readonly _workspaceBrowseConfigurations =
  new Map<string, cpt.WorkspaceBrowseConfiguration>()

  readonly log: Logger

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (extensionManager: ExtensionManager) {
    this.log = extensionManager.log
  }

  // --------------------------------------------------------------------------
  // Methods.

  async canProvideConfiguration (
    _uri: vscode.Uri,
    _token?: vscode.CancellationToken
  ): Promise<boolean> {
    const log = this.log

    log.error(`canProvideConfiguration(${_uri.fsPath}) not implemented`)
    throw new Error('Method not implemented.')
    // return false
  }

  async provideConfigurations (
    _uris: vscode.Uri[],
    _token?: vscode.CancellationToken
  ): Promise<cpt.SourceFileConfigurationItem[]> {
    const log = this.log

    log.error('provideConfigurations() not implemented')
    throw new Error('Method not implemented.')
  }

  async canProvideBrowseConfiguration (
    _token?: vscode.CancellationToken
  ): Promise<boolean> {
    return true
  }

  async provideBrowseConfiguration (
    _token?: vscode.CancellationToken
  ): Promise<cpt.WorkspaceBrowseConfiguration | null> {
    return this._workspaceBrowseConfiguration
  }

  async canProvideBrowseConfigurationsPerFolder (
    _token?: vscode.CancellationToken
  ): Promise<boolean> {
    return true
  }

  async provideFolderBrowseConfiguration (
    _uri: vscode.Uri,
    _token?: vscode.CancellationToken
  ): Promise<cpt.WorkspaceBrowseConfiguration | null> {
    const log = this.log

    log.trace(`provideFolderBrowseConfiguration(${_uri.fsPath})`)
    return this._workspaceBrowseConfigurations.get(_uri.fsPath) ??
      this._workspaceBrowseConfiguration
  }

  dispose (): void {
    const log = this.log

    log.trace('CppConfigurationProvider.dispose()')
  }

  // --------------------------------------------------------------------------

  refresh (): void {
    // Nothing yet.
  }
}

// ----------------------------------------------------------------------------
