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

/*
 * Module for vscode-cpptools integration.
 *
 * This module uses the [vscode-cpptools API](https://www.npmjs.com/package/vscode-cpptools)
 * to provide the C/C++ extension with per-file configuration information,
 * similar to vscode-cmake-tools integration.
 */

// import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

// ----------------------------------------------------------------------------

// https://www.npmjs.com/package/comment-json
import * as jsonc from 'comment-json'

import * as vscode from 'vscode'
import * as cpt from 'vscode-cpptools'

// ----------------------------------------------------------------------------

import { Logger } from '@xpack/logger'

import * as utils from '../functions/utils.js'
import { ExtensionManager } from './manager.js'
import { DataNodePackage, DataNodeWorkspaceFolder } from './data-model.js'

// ----------------------------------------------------------------------------

// The content is actually a bit more complicated, since it includes
// the objects required to store the JSON comments, but this is not
// relevant here, so keep them hidden.
// Both properties are optional, since a file edited by hand may lack them.
interface JsonCCppProperties {
  configurations?: JsonCCppPropertiesConfiguration[]
  version?: number
}

// Same here.
interface JsonCCppPropertiesConfiguration {
  name: string
  configurationProvider?: string
  compileCommands?: string
}

// ----------------------------------------------------------------------------

export class IntelliSense implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  static register(manager: ExtensionManager): IntelliSense {
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

  constructor(manager: ExtensionManager) {
    this.manager = manager
    this.log = manager.log

    // const log = this.log

    manager.addCallbackRefresh(async () => {
      await this.refresh()
    })

    const context = this.manager.vscodeContext

    this._configProvider = new XpackCppConfigurationProvider(manager)
    context.subscriptions.push(this._configProvider)
  }

  // --------------------------------------------------------------------------
  // Methods.

  // Currently not called.
  async _register(): Promise<void> {
    const log = this.log

    this._cppToolsAPI = await cpt.getCppToolsApi(cpt.Version.v4)

    if (this._cppToolsAPI !== undefined) {
      // Cannot do this in the constructor, since it requires the API,
      // available only as async.
      this._cppToolsAPI.registerCustomConfigurationProvider(
        this._configProvider
      )
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
  async updateCppPropertiesJson(): Promise<void> {
    const log = this.log

    log.trace('IntelliSense.updateCppPropertiesJson()')

    const promises: Promise<void>[] = []
    this.manager.data.workspaceProjects.forEach((dataNodePackage) =>
      promises.push(this.updateWorkspaceProjectCCppProperties(dataNodePackage))
    )

    await Promise.all(promises)
  }

  /**
   * Update the `c_cpp_properties.json` file for a workspace folder.
   * - https://code.visualstudio.com/docs/cpp/c-cpp-properties-schema-reference
   *
   * @remarks
   * The `configurations` array is rebuilt in the order of the xpm build
   * configurations. Existing entries with a matching name are reused,
   * so the properties added to them by hand are preserved; entries that
   * no longer correspond to a build configuration are removed. The
   * other top-level properties are kept as they are.
   *
   * The file is written only when its content changes, since each write
   * makes the C/C++ extension reload it. A file that cannot be read or
   * parsed is left untouched, as it may be in the middle of an edit.
   *
   * @param dataNodePackage - The package at the root of the workspace
   * folder.
   * @returns A promise that resolves when the file is up to date.
   */
  async updateWorkspaceProjectCCppProperties(
    dataNodePackage: DataNodePackage
  ): Promise<void> {
    const log = this.log

    log.trace(dataNodePackage.folderPath)

    const vscodeFolderPath: string = path.join(
      dataNodePackage.folderPath,
      '.vscode'
    )

    const jsonFilePath: string = path.join(
      vscodeFolderPath,
      'c_cpp_properties.json'
    )

    // The current content; undefined if the file does not exist.
    let fileOldContent: string | undefined
    try {
      fileOldContent = await fs.readFile(jsonFilePath, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.warn(
          `${jsonFilePath} cannot be read, not updated, ` +
            (err as Error).message
        )
        return
      }
    }

    let json: JsonCCppProperties
    if (fileOldContent === undefined) {
      json = {
        configurations: [],
        version: 4,
      }
    } else {
      let parsed: jsonc.CommentJSONValue
      try {
        parsed = jsonc.parse(fileOldContent)
      } catch (err) {
        log.warn(
          `${jsonFilePath} is not valid JSON, not updated, ` +
            (err as Error).message
        )
        return
      }
      if (!utils.isJsonObject(parsed)) {
        log.warn(`${jsonFilePath} is not a JSON object, not updated`)
        return
      }
      json = parsed as unknown as JsonCCppProperties
    }

    const oldConfigurations: unknown[] = Array.isArray(json.configurations)
      ? json.configurations
      : []

    json.configurations = await this.updateCompileCommandsReferences(
      dataNodePackage,
      oldConfigurations
    )

    if (json.configurations.length === 0) {
      // There are no build configurations; leave the file as it is.
      return
    }

    const fileNewContent = jsonc.stringify(json, null, 2) + '\n'
    if (fileNewContent === fileOldContent) {
      log.trace(`${jsonFilePath} unchanged, not written`)
      return
    }

    await fs.mkdir(vscodeFolderPath, { recursive: true })
    await fs.writeFile(jsonFilePath, fileNewContent)
    log.trace(`${jsonFilePath} written back`)
  }

  /**
   * Create the list of C/C++ configurations, one for each visible xpm
   * build configuration of the packages in the workspace folder.
   *
   * @param dataNodePackage - The package at the root of the workspace
   * folder.
   * @param oldConfigurations - The entries currently in the file, reused
   * when their names match.
   * @returns The new list of configurations, in the order of the build
   * configurations.
   */
  async updateCompileCommandsReferences(
    dataNodePackage: DataNodePackage,
    oldConfigurations: unknown[]
  ): Promise<JsonCCppPropertiesConfiguration[]> {
    const log = this.log

    const newConfigurations: JsonCCppPropertiesConfiguration[] = []

    const parentWorkspaceFolder: DataNodeWorkspaceFolder =
      dataNodePackage.parent

    for (const childDataNodePackage of parentWorkspaceFolder.packages) {
      // eslint-disable-next-line max-len
      for (const dataNodeConfiguration of childDataNodePackage.xpmConfigurations) {
        const globalConfigurationName =
          childDataNodePackage.name !== ''
            ? // For sub-folders, prefix the configuration name.
              childDataNodePackage.name + '/' + dataNodeConfiguration.name
            : dataNodeConfiguration.name

        if (dataNodeConfiguration.hidden) {
          log.trace(
            `c/c++ configuration name: ${globalConfigurationName} hidden`
          )
          continue
        }

        log.trace(`c/c++ configuration name: ${globalConfigurationName}`)

        // First try to identify an existing configuration;
        // if not found, create a new empty one.
        const currentJsonConfiguration =
          this.prepareCCppPropertiesConfiguration(
            globalConfigurationName,
            oldConfigurations
          )
        newConfigurations.push(currentJsonConfiguration)

        // Get the variable value (via substitutions).
        const buildFolderRelativePath =
          dataNodeConfiguration.buildFolderRelativePath

        // Use relative paths.
        const newBaseFolderPath = '$' + '{workspaceFolder}'

        const compileCommandsValue = path.join(
          newBaseFolderPath,
          childDataNodePackage.name, // May be empty
          buildFolderRelativePath,
          'compile_commands.json'
        )

        const compileCommandsFileAbsolutePath = path.join(
          childDataNodePackage.folderPath,
          buildFolderRelativePath,
          'compile_commands.json'
        )

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
          await fs.stat(compileCommandsFileAbsolutePath)

          // If the file exists, configure the path to it.
          currentJsonConfiguration.compileCommands = compileCommandsValue
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
          // The `compile_commands.json` file does not exist yet,
          // ensure that this property is not set, to avoid an
          // warning from the C/C++ extension.
          delete currentJsonConfiguration.compileCommands
        }

        log.trace(`c/c++ compileCommands: ${compileCommandsValue}`)
      }
    }

    return newConfigurations
  }

  /**
   * Find an existing configuration with the given name; if there is
   * none, create a new one with only the name set.
   *
   * @param configurationName - The configuration name as it
   * is expected to appear in the `c_cpp_properties.json` file.
   * @param oldConfigurations - The entries currently in the file; those
   * that are not objects are ignored.
   *
   * @returns Either an existing configuration or a new one. The new one
   * is not added to any array.
   */
  prepareCCppPropertiesConfiguration(
    configurationName: string,
    oldConfigurations: unknown[]
  ): JsonCCppPropertiesConfiguration {
    // If a configuration with the same name exists, return it.
    for (const oldConfiguration of oldConfigurations) {
      if (
        utils.isJsonObject(oldConfiguration) &&
        (oldConfiguration as JsonCCppPropertiesConfiguration).name ===
          configurationName
      ) {
        return oldConfiguration as JsonCCppPropertiesConfiguration
      }
    }

    // If it does not exist, create a minimal named object.
    return {
      name: configurationName,
    }
  }

  // --------------------------------------------------------------------------

  registerCompileCommandsJsonWatchers(): void {
    const log = this.log

    // Register only once.
    if (
      this.watcherCompileCommandsJson === undefined &&
      vscode.workspace.workspaceFolders !== undefined
    ) {
      log.trace('registerCompileCommandsJsonWatchers()')
      const watcherCompileCommandsJson =
        vscode.workspace.createFileSystemWatcher('**/compile_commands.json')
      watcherCompileCommandsJson.onDidChange(async (e): Promise<void> => {
        log.trace(`onDidChange() ${e.fsPath}`)
        await this.refreshCompileCommands(vscode.FileChangeType.Changed, e)
      })
      watcherCompileCommandsJson.onDidDelete(async (e): Promise<void> => {
        log.trace(`onDidDelete() ${e.fsPath}`)
        await this.refreshCompileCommands(vscode.FileChangeType.Deleted, e)
      })
      watcherCompileCommandsJson.onDidCreate(async (e): Promise<void> => {
        log.trace(`onDidCreate() ${e.fsPath}`)
        await this.refreshCompileCommands(vscode.FileChangeType.Created, e)
      })

      const context = this.manager.vscodeContext
      context.subscriptions.push(watcherCompileCommandsJson)

      this.watcherCompileCommandsJson = watcherCompileCommandsJson
    }
  }

  // --------------------------------------------------------------------------

  async refresh(): Promise<void> {
    const log = this.log

    log.trace('IntelliSense.refresh()')

    await this.updateCppPropertiesJson()
  }

  async refreshCompileCommands(
    changeType: vscode.FileChangeType,
    uri: vscode.Uri
  ): Promise<void> {
    const log = this.log

    log.trace(changeType, uri.fsPath)

    if (changeType === vscode.FileChangeType.Created) {
      let dataNodePackage: DataNodePackage | undefined

      // Iterate through all configurations and identify the workspace folder
      // where to update the `c_cpp_properties.json`.
      for (const node of this.manager.data.xpmConfigurations) {
        const buildFolderRelativePath = node.buildFolderRelativePath
        const compileCommandsFilePath = path.join(
          node.package.folderPath,
          buildFolderRelativePath,
          'compile_commands.json'
        )

        if (
          compileCommandsFilePath === uri.fsPath &&
          node.package.folderRelativePath === ''
        ) {
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

  dispose(): void {
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
  implements cpt.CustomConfigurationProvider
{
  // --------------------------------------------------------------------------
  // Members.

  // Name and ID, as visible to cpptools.
  readonly name: string = 'xPack Tools'
  extensionId = 'ilg-vscode.xpack'

  // eslint-disable-next-line max-len
  private readonly _workspaceBrowseConfiguration: cpt.WorkspaceBrowseConfiguration =
    { browsePath: [] }

  private readonly _workspaceBrowseConfigurations = new Map<
    string,
    cpt.WorkspaceBrowseConfiguration
  >()

  readonly log: Logger

  // --------------------------------------------------------------------------
  // Constructor.

  constructor(extensionManager: ExtensionManager) {
    this.log = extensionManager.log
    const log = this.log

    log.trace('XpackCppConfigurationProvider constructed')
  }

  // --------------------------------------------------------------------------
  // Methods.

  canProvideConfiguration(
    _uri: vscode.Uri,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token?: vscode.CancellationToken
  ): Thenable<boolean> {
    const log = this.log

    log.trace(`canProvideConfiguration(${_uri.fsPath})`)
    // throw new Error('Method not implemented.')
    return Promise.resolve(true)
  }

  provideConfigurations(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _uris: vscode.Uri[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token?: vscode.CancellationToken
  ): Thenable<cpt.SourceFileConfigurationItem[]> {
    const log = this.log

    log.error(
      'provideConfigurations() not implemented, ' +
        "use 'ms-vscode.cmake-tools'"
    )
    // throw new Error('Method not implemented.')
    return Promise.resolve([])
  }

  canProvideBrowseConfiguration(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token?: vscode.CancellationToken
  ): Thenable<boolean> {
    return Promise.resolve(true)
  }

  provideBrowseConfiguration(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token?: vscode.CancellationToken
  ): Thenable<cpt.WorkspaceBrowseConfiguration | null> {
    return Promise.resolve(this._workspaceBrowseConfiguration)
  }

  canProvideBrowseConfigurationsPerFolder(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token?: vscode.CancellationToken
  ): Thenable<boolean> {
    return Promise.resolve(true)
  }

  provideFolderBrowseConfiguration(
    _uri: vscode.Uri,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token?: vscode.CancellationToken
  ): Thenable<cpt.WorkspaceBrowseConfiguration | null> {
    const log = this.log

    log.trace(`provideFolderBrowseConfiguration(${_uri.fsPath})`)
    return Promise.resolve(
      this._workspaceBrowseConfigurations.get(_uri.fsPath) ??
        this._workspaceBrowseConfiguration
    )
  }

  dispose(): void {
    const log = this.log

    log.trace('XpackCppConfigurationProvider.dispose()')
  }

  // --------------------------------------------------------------------------

  refresh(): void {
    // Nothing yet.
  }
}

// ----------------------------------------------------------------------------
