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
import { DataNodePackage } from './data-model'

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

    // Temporarily disabled.
    // await _intellisense._register()

    log.trace('IntelliSense object created')
    return _intellisense
  }

  // --------------------------------------------------------------------------
  // Members.

  readonly log: Logger

  readonly manager: ExtensionManager

  private readonly _configProvider: XpackCppConfigurationProvider
  private _cppToolsAPI?: cpt.CppToolsApi

  watcherCompileCommandsJson: vscode.FileSystemWatcher | undefined

  // --------------------------------------------------------------------------
  // Constructor.

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

    this._configProvider = new XpackCppConfigurationProvider(manager)
    context.subscriptions.push(this._configProvider)
  }

  // --------------------------------------------------------------------------
  // Methods.

  // Currently not called.
  async _register (): Promise<void> {
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

  /**
   * Update all `c_cpp_properties.json` files.
   */
  async updateCppPropertiesJson (): Promise<void> {
    const log = this.log

    log.trace('IntelliSense.updateCppPropertiesJson()')

    const promises: Array<Promise<void>> = []
    this.manager.data.workspaceProjects.forEach(
      (dataNodePackage) =>
        promises.push(
          this.updateWorkspaceProjectCCppProperties(dataNodePackage))
    )

    await Promise.all(promises)
  }

  /**
   * Update the `c_cpp_properties.json` file for a workspace folder.
   * - https://code.visualstudio.com/docs/cpp/c-cpp-properties-schema-reference
   */
  async updateWorkspaceProjectCCppProperties (
    dataNodePackage: DataNodePackage
  ): Promise<void> {
    const log = this.log

    log.trace(dataNodePackage.folderPath)

    const vscodeFolderPath: string = path.join(
      dataNodePackage.folderPath, '.vscode')

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

    await this.updateCompileCommandsReferences(
      dataNodePackage, json.configurations)

    if (json.configurations.length > 0) {
      const fileNewContent = JSON.stringify(json, null, 2) + os.EOL
      await fsPromises.writeFile(jsonFilePath, fileNewContent)
      log.trace(`${jsonFilePath} written back`)
    }
  }

  async updateCompileCommandsReferences (
    dataNodePackage: DataNodePackage,
    jsonConfigurations: JsonCCppPropertiesConfiguration[]
  ): Promise<void> {
    const log = this.log

    for (const dataNodeConfiguration of dataNodePackage.configurations) {
      const globalConfigurationName = dataNodeConfiguration.name
      log.trace(`c/c++ configuration name: ${globalConfigurationName}`)

      // First try to identify an existing configuration;
      // if not found, create a new empty one.
      const currentJsonConfiguration =
          this.prepareCCppPropertiesConfiguration(
            globalConfigurationName, jsonConfigurations)

      // Get the variable value (via substitutions).
      const buildFolderRelativePath =
          await dataNodeConfiguration.getBuildFolderRelativePath()

      // Use relative paths.
      const newBaseFolderPath = '$' + '{workspaceFolder}'

      const compileCommandsValue = path.join(
        newBaseFolderPath,
        buildFolderRelativePath,
        'compile_commands.json'
      )

      const compileCommandsFileAbsolutePath = path.join(
        dataNodePackage.folderPath,
        buildFolderRelativePath,
        'compile_commands.json')

      // Based on feedback and tests, the dependency on CMake seems no
      // longer necessary and was disabled, at least until a proper
      // `ilg-vscode.xpack` provider will be added.
      /*
      if (currentJsonConfiguration.configurationProvider === undefined) {
        // Configure the provider to the CMake one for now.
        currentJsonConfiguration.configurationProvider =
        'ms-vscode.cmake-tools' // 'ilg-vscode.xpack'
      }
      */

      try {
        // Will throw if the file does not exists.
        await fsPromises.stat(compileCommandsFileAbsolutePath)

        // If the file exists, configure the path to it.
        currentJsonConfiguration.compileCommands = compileCommandsValue
      } catch (err) {
        // The `compile_commands.json` file does not exist yet,
        // ensure that this property is not set, to avoid an
        // warning from the C/C++ extension.
        delete currentJsonConfiguration.compileCommands
      }

      log.trace(`c/c++ compileCommands: ${compileCommandsValue}`)
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

  registerCompileCommandsJsonWatchers (): void {
    const log = this.log

    // Register only once.
    if (this.watcherCompileCommandsJson === undefined &&
      vscode.workspace.workspaceFolders !== undefined) {
      log.trace('registerPackageJsonWatchers()')
      const watcherCompileCommandsJson =
      vscode.workspace.createFileSystemWatcher('**/compile_commands.json')
      watcherCompileCommandsJson.onDidChange(
        async (e): Promise<void> => {
          log.trace(`onDidChange() ${e.fsPath}`)
          await this.refreshCompileCommands(vscode.FileChangeType.Changed, e)
        }
      )
      watcherCompileCommandsJson.onDidDelete(
        async (e): Promise<void> => {
          log.trace(`onDidDelete() ${e.fsPath}`)
          await this.refreshCompileCommands(vscode.FileChangeType.Deleted, e)
        }
      )
      watcherCompileCommandsJson.onDidCreate(
        async (e): Promise<void> => {
          log.trace(`onDidCreate() ${e.fsPath}`)
          await this.refreshCompileCommands(vscode.FileChangeType.Created, e)
        }
      )

      const context = this.manager.vscodeContext
      context.subscriptions.push(watcherCompileCommandsJson)

      this.watcherCompileCommandsJson = watcherCompileCommandsJson
    }
  }

  // --------------------------------------------------------------------------

  async refresh (): Promise<void> {
    const log = this.log

    log.trace('IntelliSense.refresh()')

    await this.updateCppPropertiesJson()
  }

  async refreshCompileCommands (
    changeType: vscode.FileChangeType,
    uri: vscode.Uri
  ): Promise<void> {
    const log = this.log

    log.trace(changeType, uri.fsPath)

    if (changeType === vscode.FileChangeType.Created) {
      let dataNodePackage: DataNodePackage | undefined

      // Iterate through all configurations and identify the workspace folder
      // where to update the `c_cpp_properties.json`.
      for (const node of this.manager.data.configurations) {
        const buildFolderRelativePath = await node.getBuildFolderRelativePath()
        const compileCommandsFilePath = path.join(node.package.folderPath,
          buildFolderRelativePath,
          'compile_commands.json')

        if (compileCommandsFilePath === uri.fsPath &&
            node.package.folderRelativePath === '') {
          // Process only workspace folders that include top packages.
          dataNodePackage = node.package
          break
        }
      }
      if (dataNodePackage !== undefined) {
        await this.updateWorkspaceProjectCCppProperties(dataNodePackage)
      }
    }
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
// Not yet used, for now use the CMake configuration provider.

// Cpp calls:
// - canProvideBrowseConfigurationsPerFolder
// - canProvideBrowseConfiguration

export class XpackCppConfigurationProvider
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
  // Constructor.

  constructor (extensionManager: ExtensionManager) {
    this.log = extensionManager.log
    const log = this.log

    log.trace('XpackCppConfigurationProvider constructed')
  }

  // --------------------------------------------------------------------------
  // Methods.

  async canProvideConfiguration (
    _uri: vscode.Uri,
    _token?: vscode.CancellationToken
  ): Promise<boolean> {
    const log = this.log

    log.trace(`canProvideConfiguration(${_uri.fsPath})`)
    // throw new Error('Method not implemented.')
    return true
  }

  async provideConfigurations (
    _uris: vscode.Uri[],
    _token?: vscode.CancellationToken
  ): Promise<cpt.SourceFileConfigurationItem[]> {
    const log = this.log

    log.error('provideConfigurations() not implemented, ' +
    'use \'ms-vscode.cmake-tools\'')
    // throw new Error('Method not implemented.')
    return []
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

    log.trace('XpackCppConfigurationProvider.dispose()')
  }

  // --------------------------------------------------------------------------

  refresh (): void {
    // Nothing yet.
  }
}

// ----------------------------------------------------------------------------
