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

/**
 * Module for vscode-cpptools integration.
 *
 * This module uses the [vscode-cpptools API](https://www.npmjs.com/package/vscode-cpptools)
 * to provide that extension with per-file configuration information,
 * similar to vscode-cmake-tools integration.
 */

import * as assert from 'assert'
import * as path from 'path'
import { promises as fsPromises } from 'fs'

// https://www.npmjs.com/package/make-dir
import * as makeDir from 'make-dir'

import * as vscode from 'vscode'
import * as cpt from 'vscode-cpptools'

import { Logger } from '@xpack/logger'

import {
  ExtensionManager
} from './manager'

// ----------------------------------------------------------------------------

export class IntelliSense implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  static async register (
    extensionManager: ExtensionManager
  ): Promise<IntelliSense> {
    const _intellisense = new IntelliSense(extensionManager)
    extensionManager.subscriptions.push(_intellisense)

    const log = extensionManager.log

    await _intellisense._initialize()

    log.trace('IntelliSense object created')
    return _intellisense
  }

  readonly log: Logger

  readonly extensionManager: ExtensionManager

  private readonly _configProvider: CppConfigurationProvider
  private _cppToolsAPI?: cpt.CppToolsApi

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (extensionManager: ExtensionManager) {
    this.extensionManager = extensionManager
    this.log = extensionManager.log

    // const log = this.log

    extensionManager.addRefreshFunction(
      async () => {
        await this.refresh()
      }
    )

    const context = this.extensionManager.vscodeContext

    this._configProvider = new CppConfigurationProvider(extensionManager)
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

    for (const nodePackage of this.extensionManager.tasksTree) {
      log.trace(nodePackage.xpackFolderPath.path)
      const jsonFilePath: string = path.join(nodePackage.xpackFolderPath.path,
        '.vscode', 'c_cpp_properties.json')

      let json
      try {
        const fileContent = await fsPromises.readFile(jsonFilePath)
        assert(fileContent !== null)
        json = JSON.parse(fileContent.toString())
      } catch (err) {
        // Ensure that the folder is there.
        await makeDir(path.join(nodePackage.xpackFolderPath.path, '.vscode'))
        json = {
          configurations: [],
          version: 4
        }
      }

      if (json.configurations === undefined) {
        json.configurations = []
      }

      for (const nodeConfiguration of nodePackage.buildConfigurations) {
        interface JsonConfiguration {
          name: string
          configurationProvider?: string
          compileCommands?: string
        }

        let existing: JsonConfiguration | undefined
        // If it exists, use it.
        for (const jsonConfiguration of json.configurations) {
          if (jsonConfiguration.name === nodeConfiguration.name) {
            existing = jsonConfiguration
            break
          }
        }

        if (existing === undefined) {
          existing = {
            name: nodeConfiguration.name
          }
          json.configurations.push(existing)
        }

        // And always override two properties.
        existing.configurationProvider = 'ms-vscode.cmake-tools'

        // TODO: use the variable (via substitutions)
        const newPath = path.join(
          '$' + '{workspaceFolder}',
          'build',
          nodeConfiguration.name,
          'compile_commands.json')

        existing.compileCommands = newPath
      }

      const fileNewContent = JSON.stringify(json, null, 2) + '\n'
      await fsPromises.writeFile(jsonFilePath, fileNewContent)
      log.trace(`${jsonFilePath} written back`)
    }
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

  constructor (extensionManager: ExtensionManager) {
    this.log = extensionManager.log
  }

  async canProvideConfiguration (
    _uri: vscode.Uri,
    _token?: vscode.CancellationToken
  ): Promise<boolean> {
    const log = this.log

    log.error(`canProvideConfiguration(${_uri.fsPath}) not implemented`)
    throw new Error('Method not implemented.')
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

  }
}

// ----------------------------------------------------------------------------
