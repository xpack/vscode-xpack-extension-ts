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

/**
 *
 * Commands are defined in package.json as
 * - `contributes.commands` - global definitions
 * - `contributes.menus.commandPalette` - what is shown in the palette
 * - `contributes.menus.'view/title'` - appear in the view title
 * - `contributes.menus.'view/item/context'` - icons associated with tree items
 *
 * For details see:
 * https://code.visualstudio.com/api/references/contribution-points#contributes.menus
 */

import { promises as fsPromises } from 'fs'
import * as os from 'os'

import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'

import {
  ExtensionManager,
  BuildConfigurationPick
} from './manager'

import {
  TreeItem,
  TreeItemAction,
  TreeItemCommand,
  TreeItemConfiguration,
  TreeItemPackage
} from './explorer'

import {
  JsonActions,
  JsonBuildConfigurations,
  MessageItemConfirmation,
  XpackPackageJson
} from './definitions'

import * as utils from './utils'

// ----------------------------------------------------------------------------

/**
 * A class to manage commands.
 */
export class Commands implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  // Factory method pattern.
  static async register (
    extensionManager: ExtensionManager
  ): Promise<Commands> {
    const _commands = new Commands(extensionManager)
    extensionManager.subscriptions.push(_commands)

    const log = extensionManager.log

    // Add possible async calls here.

    log.trace('Commands object created')
    return _commands
  }

  // --------------------------------------------------------------------------
  // Members.

  readonly log: Logger

  readonly manager: ExtensionManager
  private _buildConfigurationPicks: BuildConfigurationPick[] | undefined

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (manager: ExtensionManager) {
    this.manager = manager
    this.log = manager.log

    manager.addCallbackRefresh(
      async () => {
        this.refresh()
      }
    )

    const context: vscode.ExtensionContext = manager.vscodeContext

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.treeViewRefresh',
        this.refreshTreeView,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.runCommand',
        this.runCommand,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.runAction',
        this.runAction,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.copyAction',
        this.copyAction,
        this
      )
    )

    // context.subscriptions.push(
    //   vscode.commands.registerCommand(
    //     'xpack.selectBuildConfiguration',
    //     this.selectBuildConfiguration,
    //     this
    //   )
    // )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.addConfiguration',
        this.addConfiguration,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.addAction',
        this.addAction,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.removeAction',
        this.removeAction,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.duplicateConfiguration',
        this.duplicateConfiguration,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.removeConfiguration',
        this.removeConfiguration,
        this
      )
    )

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.createProjectEmpty',
        this.createProjectEmpty,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.createProjectHelloQuick',
        this.createProjectHelloQuick,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.createProjectHello',
        this.createProjectHello,
        this
      )
    )

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.createProjectHelloQemu',
        this.createProjectHelloQemu,
        this
      )
    )
  }

  // --------------------------------------------------------------------------
  // Methods.

  /**
   * Refresh the explorer tree view.
   */
  async refreshTreeView (): Promise<void> {
    const log = this.log

    log.trace('Command.refreshTreeView()')
    await this.manager.refresh()
  }

  /**
   * Run a command.
   *
   * @param treeItem - When invoked by the tree viewer it gets the
   * TreeItem where the invocation occurred.
   */
  async runCommand (treeItem: TreeItem): Promise<void> {
    const log = this.log

    log.trace('Command.runCommand()')
    if (treeItem instanceof TreeItemCommand) {
      if (treeItem.task === undefined) {
        log.debug('runCommand(): inconsistent treeItem, no task')
        return
      }
      log.trace(treeItem.task.execution)
      await treeItem.runTask()
    } else {
      log.debug('runCommand(): treeItem not yet implemented')
    }
  }

  /**
   * Run an action.
   *
   * @param treeItem - When invoked by the tree viewer it gets the
   * TreeItem where the invocation occurred.
   *
   * Errors trigger a generic message, and the exceptions are not
   * reflected in the output, so better use log messages.
   */
  async runAction (treeItem: TreeItem): Promise<void> {
    const log = this.log

    log.trace('Command.runAction()')
    if (treeItem instanceof TreeItemAction) {
      if (treeItem.task === undefined) {
        log.debug('runAction(): inconsistent treeItem, no task')
        return
      }
      log.trace(treeItem.task.execution)
      await treeItem.runTask()
    } else {
      log.debug('runAction(): treeItem not yet implemented')
    }
  }

  async copyAction (treeItem: TreeItem): Promise<void> {
    const log = this.log

    log.trace('Command.copyAction()')
    if (treeItem instanceof TreeItemAction) {
      if (treeItem.task === undefined) {
        log.debug('copyAction(): inconsistent treeItem, no task')
        return
      }
      log.trace(treeItem.task.execution)
      let command = `xpm run ${treeItem.name}`
      if (treeItem.parent instanceof TreeItemConfiguration) {
        command += ` --config ${treeItem.parent.name}`
      }

      let node = treeItem.parent
      while (!(node instanceof TreeItemPackage)) {
        node = node.parent
      }

      const projectFolderPath = node.dataNode.folderPath

      command += ` -C '${projectFolderPath}'`
      log.trace(command)
      await vscode.env.clipboard.writeText(command)
    } else {
      log.debug('copyAction(): treeItem not yet implemented')
    }
  }

  async addConfiguration (treeItem: TreeItem): Promise<void> {
    const log = this.log

    if (treeItem instanceof TreeItemPackage) {
      log.trace(`addConfiguration() to package '${treeItem.name}'`)
    } else {
      return
    }

    const configurationName = await vscode.window.showInputBox({
      prompt: 'New configuration name',
      placeHolder: 'Prefer capitalised words, dash separated'
    })
    if (configurationName === undefined) {
      return
    }
    log.trace(configurationName)

    const packageJson: XpackPackageJson = treeItem.dataNode.packageJson
    if (packageJson.xpack.buildConfigurations === undefined) {
      packageJson.xpack.buildConfigurations = {}
    } else {
      if (packageJson.xpack.buildConfigurations[configurationName] !==
        undefined) {
        await vscode.window.showErrorMessage(
          `Configuration '${configurationName}' ` +
          'already present, choose a different name.')
        return
      }
    }
    packageJson.xpack.buildConfigurations[configurationName] = {
      properties: {},
      actions: {}
    }
    log.trace(packageJson)

    const fileNewContent = JSON.stringify(packageJson, null, 2) + os.EOL
    await fsPromises.writeFile(treeItem.packageJsonPath, fileNewContent)
    log.trace(`${treeItem.packageJsonPath} written back`)
  }

  async addAction (treeItem: TreeItem): Promise<void> {
    const log = this.log

    let treeItemPackage
    if (treeItem instanceof TreeItemPackage) {
      log.trace(`addAction() to package '${treeItem.name}'`)
      treeItemPackage = treeItem
    } else if (treeItem instanceof TreeItemConfiguration) {
      log.trace(`addAction() to configuration ${treeItem.name}`)
      treeItemPackage = treeItem.parent
    } else {
      return
    }

    const actionName = await vscode.window.showInputBox({
      prompt: 'Enter the name of the new action',
      placeHolder: 'Prefer lowercase words, dash separated'
    })
    if (actionName === undefined) {
      return
    }
    log.trace(actionName)

    const packageJson: XpackPackageJson = treeItemPackage.dataNode.packageJson

    let fromJson = packageJson.xpack
    if (treeItem instanceof TreeItemConfiguration) {
      const jsonConfigurations: JsonBuildConfigurations =
        packageJson.xpack.buildConfigurations as JsonBuildConfigurations
      fromJson = jsonConfigurations[treeItem.name]
    }
    if (fromJson.actions === undefined) {
      fromJson.actions = {}
    } else {
      if (fromJson.actions[actionName] !==
        undefined) {
        await vscode.window.showErrorMessage(
          `Action '${actionName}' ` +
          'already present, choose a different name.')
        return
      }
    }
    fromJson.actions[actionName] = []

    log.trace(packageJson)

    const fileNewContent = JSON.stringify(packageJson, null, 2) + os.EOL
    await fsPromises.writeFile(treeItemPackage.packageJsonPath, fileNewContent)
    log.trace(`${treeItemPackage.packageJsonPath} written back`)
  }

  async removeAction (treeItem: TreeItem): Promise<void> {
    const log = this.log

    if (treeItem instanceof TreeItemAction) {
      log.trace(`removeAction() '${treeItem.name}'`)
    } else {
      return
    }

    const actionName: string = treeItem.name
    const chosen = await vscode.window
      .showInformationMessage<MessageItemConfirmation>(
      `Do you really want to remove action '${actionName}'?`,
      { modal: true },
      { title: 'Remove', isConfirmed: true }
    )
    if (chosen === undefined || !chosen.isConfirmed) {
      return
    }

    const treeItemPackage: TreeItemPackage = treeItem.parent.package

    const packageJson: XpackPackageJson = treeItemPackage.dataNode.packageJson
    let actions: JsonActions = packageJson.xpack.actions as JsonActions
    if (treeItem.parent instanceof TreeItemConfiguration) {
      const buildConfigurationName = treeItem.parent.name

      const buildConfigurations =
      packageJson.xpack.buildConfigurations as JsonBuildConfigurations

      actions =
        buildConfigurations[buildConfigurationName].actions as JsonActions
    }

    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete actions[actionName]

    const fileNewContent = JSON.stringify(packageJson, null, 2) + os.EOL
    await fsPromises.writeFile(treeItemPackage.packageJsonPath,
      fileNewContent)
    log.trace(`${treeItemPackage.packageJsonPath} written back`)
  }

  async duplicateConfiguration (treeItem: TreeItem): Promise<void> {
    const log = this.log

    if (treeItem instanceof TreeItemConfiguration) {
      log.trace(`duplicateConfiguration() '${treeItem.name}'`)
    } else {
      return
    }

    const configurationName = await vscode.window.showInputBox({
      prompt: 'Enter the name of the new configuration',
      placeHolder: 'Prefer capitalised words, dash separated'
    })
    if (configurationName === undefined) {
      return
    }
    log.trace(configurationName)

    const packageJson: XpackPackageJson = treeItem.parent.dataNode.packageJson
    const buildConfigurations =
      packageJson.xpack.buildConfigurations as JsonBuildConfigurations

    if (buildConfigurations[configurationName] !== undefined) {
      await vscode.window.showErrorMessage(
          `Configuration '${configurationName}' ` +
          'already present, choose a different name.')
      return
    }

    const sourceBuildConfiguration = buildConfigurations[treeItem.dataNode.name]
    buildConfigurations[configurationName] = {
      ...sourceBuildConfiguration
    }
    log.trace(packageJson)

    const fileNewContent = JSON.stringify(packageJson, null, 2) + os.EOL
    await fsPromises.writeFile(treeItem.parent.packageJsonPath,
      fileNewContent)
    log.trace(`${treeItem.parent.packageJsonPath} written back`)
  }

  async removeConfiguration (treeItem: TreeItem): Promise<void> {
    const log = this.log

    if (treeItem instanceof TreeItemConfiguration) {
      log.trace(`removeConfiguration() '${treeItem.name}'`)
    } else {
      return
    }

    const buildConfigurationName = treeItem.dataNode.name
    const chosen = await vscode.window
      .showInformationMessage<MessageItemConfirmation>(
      `Do you really want to remove configuration '${buildConfigurationName}'?`,
      { modal: true },
      { title: 'Remove', isConfirmed: true }
    )
    if (chosen === undefined || !chosen.isConfirmed) {
      return
    }

    const packageJson: XpackPackageJson = treeItem.parent.dataNode.packageJson
    const buildConfigurations =
      packageJson.xpack.buildConfigurations as JsonBuildConfigurations

    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete buildConfigurations[buildConfigurationName]

    const fileNewContent = JSON.stringify(packageJson, null, 2) + os.EOL
    await fsPromises.writeFile(treeItem.parent.packageJsonPath,
      fileNewContent)
    log.trace(`${treeItem.parent.packageJsonPath} written back`)
  }

  // --------------------------------------------------------------------------

  /**
   * Select the build configuration. Currently Not used.
   */
  async selectBuildConfiguration (): Promise<void> {
    const log = this.log

    log.trace('Command.selectBuildConfiguration()')

    if (this._buildConfigurationPicks === undefined) {
      this._buildConfigurationPicks =
        this.manager.data.configurations.map(
          (dataNode) => {
            return new BuildConfigurationPick(dataNode)
          }
        )
    }
    const pick = await vscode.window.showQuickPick<BuildConfigurationPick>(
      this._buildConfigurationPicks,
      {
        placeHolder: 'Select the build configuration for IntelliSense ' +
          '(not yet functional)'
      }
    )

    log.trace(pick)
    if (pick !== undefined) {
      this.manager.setBuildConfiguration(pick.dataNode)
    }
  }

  async createProjectEmpty (): Promise<void> {
    const log = this.log

    log.trace('Command.createProjectEmpty()')

    await this._createXpmProject(['init'])
  }

  async createProjectHelloQuick (): Promise<void> {
    const log = this.log

    log.trace('Command.createProjectHelloQuick()')

    await this._createXpmProject(
      [
        'init',
        '--template', '@xpack/hello-world-template@latest',
        '--property', 'language=cpp'
      ]
    )
  }

  async createProjectHello (): Promise<void> {
    const log = this.log

    log.trace('Command.createProjectHello()')

    await this._createXpmProject(
      [
        'init',
        '--template', '@xpack/hello-world-template@latest'
      ]
    )
  }

  async createProjectHelloQemu (): Promise<void> {
    const log = this.log

    log.trace('Command.createProjectHelloQemu()')

    await this._createXpmProject(
      [
        'init',
        '--template', '@micro-os-plus/hello-world-qemu-template@latest'
      ]
    )
  }

  async _createXpmProject (commandArguments: string[]): Promise<void> {
    const log = this.log

    log.trace('Command._createProject()')

    const homeUri = vscode.Uri.file(os.homedir())
    const defaultUri =
      (vscode.workspace.workspaceFolders != null) &&
        vscode.workspace.workspaceFolders.length > 0
        ? vscode.Uri.file(vscode.workspace.workspaceFolders[0].uri.fsPath)
        : homeUri

    const uris = await vscode.window.showOpenDialog({
      title: 'Choose Folder', // Not used on macOS
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri
    })

    if (uris === undefined) {
      return
    }

    log.trace(uris[0].fsPath)

    const xpmProgramName = 'xpm'
    const taskLabel = [xpmProgramName, ...commandArguments].join(' ')

    const task = await utils.createTask(
      xpmProgramName,
      commandArguments,
      vscode.TaskScope.Workspace,
      uris[0].fsPath,
      taskLabel,
      { type: 'xPack' }
    )
    const code = await vscode.tasks.executeTask(task)
    // Does not wait for the process to terminate.

    // https://code.visualstudio.com/api/references/vscode-api#tasks
    // onDidEndTaskProcess: Event<TaskProcessEndEvent>

    const start = (vscode.workspace.workspaceFolders !== undefined)
      ? vscode.workspace.workspaceFolders.length
      : 0
    vscode.workspace.updateWorkspaceFolders(start, 0, { uri: uris[0] })

    log.trace(code)
  }

  // --------------------------------------------------------------------------

  refresh (): void {
    const log = this.log

    log.trace('Commands.refresh()')

    this._buildConfigurationPicks = undefined
  }

  // --------------------------------------------------------------------------

  dispose (): void {
    const log = this.log

    log.trace('Commands.dispose()')
    // Nothing to do
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
