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

import * as fs from 'node:fs/promises'
import * as os from 'node:os'

import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'

import * as xpmLib from '@xpack/xpm-lib'

import { ExtensionManager, BuildConfigurationPick } from './manager.js'

import {
  TreeItem,
  TreeItemXpmAction,
  TreeItemNpmCommand,
  TreeItemConfiguration,
  TreeItemPackage,
  TreeItemNpmScript,
  TreeItemXpmCommand,
} from './explorer.js'

import { MessageItemConfirmation } from './definitions.js'

import * as utils from '../functions/utils.js'
import { DataNodeConfiguration } from './data-model.js'

// ----------------------------------------------------------------------------

/**
 * A class to manage commands.
 */
export class Commands implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  // Factory method pattern.
  static register(extensionManager: ExtensionManager): Commands {
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

  constructor(manager: ExtensionManager) {
    this.manager = manager
    this.log = manager.log

    // eslint-disable-next-line @typescript-eslint/require-await
    manager.addCallbackRefresh(async () => {
      this.refresh()
    })

    const context: vscode.ExtensionContext = manager.vscodeContext

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.treeViewRefresh',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.refreshTreeView,
        this
      )
    )

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.runNpmScript',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.runNpmScript,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.copyNpmScript',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.copyNpmScript,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.runNpmCommand',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.runNpmCommand,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.copyNpmCommand',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.copyNpmCommand,
        this
      )
    )

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.runXpmAction',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.runXpmAction,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.copyXpmAction',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.copyXpmAction,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.runXpmCommand',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.runXpmCommand,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.copyXpmCommand',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.copyXpmCommand,
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
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.addConfiguration,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.addAction',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.addXpmAction,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.removeAction',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.removeAction,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.duplicateConfiguration',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.duplicateConfiguration,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.removeConfiguration',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.removeConfiguration,
        this
      )
    )

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.createProjectEmpty',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.createProjectEmpty,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.createProjectHelloQuick',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.createProjectHelloQuick,
        this
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.createProjectHello',
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.createProjectHello,
        this
      )
    )

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'xpack.createProjectHelloQemu',
        // eslint-disable-next-line @typescript-eslint/unbound-method
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
  async refreshTreeView(): Promise<void> {
    const log = this.log

    log.trace('Command.refreshTreeView()')
    await this.manager.refresh()
  }

  /**
   * Run a npm script.
   *
   * @param treeItem - When invoked by the tree viewer it gets the
   * TreeItem where the invocation occurred.
   *
   * Errors trigger a generic message, and the exceptions are not
   * reflected in the output, so better use log messages.
   */
  async runNpmScript(treeItem: TreeItem): Promise<void> {
    const log = this.log

    log.trace('Command.runNpmScript()')
    if (treeItem instanceof TreeItemNpmScript) {
      // if (treeItem.task === undefined) {
      //   log.debug('runXpmAction(): inconsistent treeItem, no task')
      //   return
      // }
      log.trace(treeItem.task.execution)
      await treeItem.runTask()
    } else {
      log.debug('runNpmScript(): treeItem not yet implemented')
    }
  }

  async copyNpmScript(treeItem: TreeItem): Promise<void> {
    const log = this.log

    log.trace('Command.copyNpmScript()')
    if (treeItem instanceof TreeItemNpmScript) {
      // if (treeItem.task === undefined) {
      //   log.debug('copyXpmAction(): inconsistent treeItem, no task')
      //   return
      // }
      log.trace(treeItem.task.execution)

      let node = treeItem.parent
      while (!(node instanceof TreeItemPackage)) {
        node = node.parent
      }

      const projectFolderPath = node.dataNode.folderPath

      const command = `npm --prefix '${projectFolderPath}' run ${treeItem.name}`
      log.trace(command)
      await vscode.env.clipboard.writeText(command)
    } else {
      log.debug('copyNpmScript(): treeItem not yet implemented')
    }
  }

  /**
   * Run a command.
   *
   * @param treeItem - When invoked by the tree viewer it gets the
   * TreeItem where the invocation occurred.
   */
  async runNpmCommand(treeItem: TreeItem): Promise<void> {
    const log = this.log

    log.trace('Command.runNpmCommand()')
    if (treeItem instanceof TreeItemNpmCommand) {
      // if (treeItem.task === undefined) {
      //   log.debug('runNpmCommand(): inconsistent treeItem, no task')
      //   return
      // }
      log.trace(treeItem.task.execution)
      await treeItem.runTask()
    } else {
      log.debug('runNpmCommand(): treeItem not yet implemented')
    }
  }

  async copyNpmCommand(treeItem: TreeItem): Promise<void> {
    const log = this.log

    log.trace('Command.copyNpmCommand()')
    if (treeItem instanceof TreeItemNpmCommand) {
      // if (treeItem.task === undefined) {
      //   log.debug('copyXpmAction(): inconsistent treeItem, no task')
      //   return
      // }
      log.trace(treeItem.task.execution)

      let node = treeItem.parent
      while (!(node instanceof TreeItemPackage)) {
        node = node.parent
      }

      const projectFolderPath = node.dataNode.folderPath

      // The command name is like `npm install` or `xpm install`.
      const command = `npm --prefix '${projectFolderPath}' ${treeItem.name}`
      log.trace(command)
      await vscode.env.clipboard.writeText(command)
    } else {
      log.debug('copyNpmCommand(): treeItem not yet implemented')
    }
  }

  /**
   * Run an xpm action.
   *
   * @param treeItem - When invoked by the tree viewer it gets the
   * TreeItem where the invocation occurred.
   *
   * Errors trigger a generic message, and the exceptions are not
   * reflected in the output, so better use log messages.
   */
  async runXpmAction(treeItem: TreeItem): Promise<void> {
    const log = this.log

    log.trace('Command.runXpmAction()')
    if (treeItem instanceof TreeItemXpmAction) {
      // if (treeItem.task === undefined) {
      //   log.debug('runXpmAction(): inconsistent treeItem, no task')
      //   return
      // }
      log.trace(treeItem.task.execution)
      await treeItem.runTask()
    } else {
      log.debug('runXpmAction(): treeItem not yet implemented')
    }
  }

  async copyXpmAction(treeItem: TreeItem): Promise<void> {
    const log = this.log

    log.trace('Command.copyXpmAction()')
    if (treeItem instanceof TreeItemXpmAction) {
      // if (treeItem.task === undefined) {
      //   log.debug('copyXpmAction(): inconsistent treeItem, no task')
      //   return
      // }
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
      log.debug('copyXpmAction(): treeItem not yet implemented')
    }
  }

  /**
   * Run an xpm command.
   *
   * @param treeItem - When invoked by the tree viewer it gets the
   * TreeItem where the invocation occurred.
   */
  async runXpmCommand(treeItem: TreeItem): Promise<void> {
    const log = this.log

    log.trace('Command.runXpmCommand()')
    if (treeItem instanceof TreeItemXpmCommand) {
      // if (treeItem.task === undefined) {
      //   log.debug('runNpmCommand(): inconsistent treeItem, no task')
      //   return
      // }
      log.trace(treeItem.task.execution)
      await treeItem.runTask()
    } else {
      log.debug('runXpmCommand(): treeItem not yet implemented')
    }
  }

  async copyXpmCommand(treeItem: TreeItem): Promise<void> {
    const log = this.log

    log.trace('Command.copyXpmCommand()')
    if (treeItem instanceof TreeItemXpmCommand) {
      // if (treeItem.task === undefined) {
      //   log.debug('copyXpmAction(): inconsistent treeItem, no task')
      //   return
      // }
      log.trace(treeItem.task.execution)

      let node = treeItem.parent
      while (!(node instanceof TreeItemPackage)) {
        node = node.parent
      }

      const projectFolderPath = node.dataNode.folderPath

      // The command name is like `npm install` or `xpm install`.
      const command = `xpm ${treeItem.name} -C '${projectFolderPath}'`
      log.trace(command)
      await vscode.env.clipboard.writeText(command)
    } else {
      log.debug('copyXpmCommand(): treeItem not yet implemented')
    }
  }

  async addConfiguration(treeItem: TreeItem): Promise<void> {
    const log = this.log

    if (treeItem instanceof TreeItemPackage) {
      log.trace(`addConfiguration() to package '${treeItem.name}'`)
    } else {
      return
    }

    const configurationName = await vscode.window.showInputBox({
      prompt: 'New configuration name',
      placeHolder: 'Prefer capitalised words, dash separated',
    })
    if (configurationName === undefined) {
      return
    }
    log.trace(configurationName)

    const jsonPackage: xpmLib.JsonXpmPackage = treeItem.dataNode
      .jsonPackage as xpmLib.JsonXpmPackage
    if (jsonPackage.xpack.buildConfigurations === undefined) {
      jsonPackage.xpack.buildConfigurations = {}
    } else {
      if (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        jsonPackage.xpack.buildConfigurations[configurationName] !== undefined
      ) {
        await vscode.window.showErrorMessage(
          `Configuration '${configurationName}' ` +
            'already present, choose a different name.'
        )
        return
      }
    }
    jsonPackage.xpack.buildConfigurations[configurationName] = {
      properties: {},
      actions: {},
    }
    log.trace(jsonPackage)

    const fileNewContent = JSON.stringify(jsonPackage, null, 2) + os.EOL
    await fs.writeFile(treeItem.packageJsonPath, fileNewContent)
    log.trace(`${treeItem.packageJsonPath} written back`)
  }

  async addXpmAction(treeItem: TreeItem): Promise<void> {
    const log = this.log

    let treeItemPackage
    if (treeItem instanceof TreeItemPackage) {
      log.trace(`addXpmAction() to package '${treeItem.name}'`)
      treeItemPackage = treeItem
    } else if (treeItem instanceof TreeItemConfiguration) {
      log.trace(`addXpmAction() to configuration ${treeItem.name}`)
      treeItemPackage = treeItem.parent
    } else {
      return
    }

    const actionName = await vscode.window.showInputBox({
      prompt: 'Enter the name of the new action',
      placeHolder: 'Prefer lowercase words, dash separated',
    })
    if (actionName === undefined) {
      return
    }
    log.trace(actionName)

    const jsonPackage: xpmLib.JsonXpmPackage = treeItemPackage.dataNode
      .jsonPackage as xpmLib.JsonXpmPackage

    let fromJson: xpmLib.JsonXpack | xpmLib.JsonBuildConfigurationContent =
      jsonPackage.xpack
    if (treeItem instanceof TreeItemConfiguration) {
      const jsonConfigurations: xpmLib.JsonBuildConfigurations | undefined =
        jsonPackage.xpack.buildConfigurations
      if (jsonConfigurations !== undefined) {
        fromJson = jsonConfigurations[treeItem.name]
      }
    }
    if (fromJson.actions === undefined) {
      fromJson.actions = {}
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (fromJson.actions[actionName] !== undefined) {
        await vscode.window.showErrorMessage(
          `Action '${actionName}' ` +
            'already present, choose a different name.'
        )
        return
      }
    }
    fromJson.actions[actionName] = []

    log.trace(jsonPackage)

    const fileNewContent = JSON.stringify(jsonPackage, null, 2) + os.EOL
    await fs.writeFile(treeItemPackage.packageJsonPath, fileNewContent)
    log.trace(`${treeItemPackage.packageJsonPath} written back`)
  }

  async removeAction(treeItem: TreeItem): Promise<void> {
    const log = this.log

    if (treeItem instanceof TreeItemXpmAction) {
      log.trace(`removeAction() '${treeItem.name}'`)
    } else {
      return
    }

    const actionName: string = treeItem.name
    const chosen =
      await vscode.window.showInformationMessage<MessageItemConfirmation>(
        `Do you really want to remove action '${actionName}'?`,
        { modal: true },
        { title: 'Remove', isConfirmed: true }
      )
    if (!chosen?.isConfirmed) {
      return
    }

    const treeItemPackage: TreeItemPackage = treeItem.parent.package

    const jsonPackage: xpmLib.JsonXpmPackage = treeItemPackage.dataNode
      .jsonPackage as xpmLib.JsonXpmPackage
    let jsonActions: xpmLib.JsonActions | undefined = jsonPackage.xpack.actions
    if (treeItem.parent instanceof TreeItemConfiguration) {
      const buildConfigurationName = treeItem.parent.name

      const buildConfigurations = jsonPackage.xpack.buildConfigurations

      if (buildConfigurations?.[buildConfigurationName] === undefined) {
        await vscode.window.showErrorMessage(
          `Build configuration '${buildConfigurationName}' not found.`
        )
        return
      }
      jsonActions = (
        buildConfigurations[
          buildConfigurationName
        ] as xpmLib.JsonBuildConfigurationContent
      ).actions
    }

    if (jsonActions !== undefined) {
      // Finally permanently remove the action.
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete jsonActions[actionName]
    }

    const fileNewContent = JSON.stringify(jsonPackage, null, 2) + os.EOL
    await fs.writeFile(treeItemPackage.packageJsonPath, fileNewContent)
    log.trace(`${treeItemPackage.packageJsonPath} written back`)
  }

  async duplicateConfiguration(treeItem: TreeItem): Promise<void> {
    const log = this.log

    if (treeItem instanceof TreeItemConfiguration) {
      log.trace(`duplicateConfiguration() '${treeItem.name}'`)
    } else {
      return
    }

    const configurationName = await vscode.window.showInputBox({
      prompt: 'Enter the name of the new configuration',
      placeHolder: 'Prefer capitalised words, dash separated',
    })
    if (configurationName === undefined) {
      return
    }
    log.trace(configurationName)

    const jsonPackage: xpmLib.JsonXpmPackage = treeItem.parent.dataNode
      .jsonPackage as xpmLib.JsonXpmPackage
    const buildConfigurations = jsonPackage.xpack.buildConfigurations

    if (buildConfigurations !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (buildConfigurations[configurationName] !== undefined) {
        await vscode.window.showErrorMessage(
          `Configuration '${configurationName}' ` +
            'already present, choose a different name.'
        )
        return
      }

      const sourceBuildConfiguration =
        buildConfigurations[treeItem.dataNode.name]
      buildConfigurations[configurationName] = {
        ...sourceBuildConfiguration,
      }
      log.trace(jsonPackage)

      const fileNewContent = JSON.stringify(jsonPackage, null, 2) + os.EOL
      await fs.writeFile(treeItem.parent.packageJsonPath, fileNewContent)
      log.trace(`${treeItem.parent.packageJsonPath} written back`)
    }
  }

  async removeConfiguration(treeItem: TreeItem): Promise<void> {
    const log = this.log

    if (treeItem instanceof TreeItemConfiguration) {
      log.trace(`removeConfiguration() '${treeItem.name}'`)
    } else {
      return
    }

    const buildConfigurationName = treeItem.dataNode.name
    const chosen =
      await vscode.window.showInformationMessage<MessageItemConfirmation>(
        'Do you really want to remove configuration ' +
          `'${buildConfigurationName}'?`,
        { modal: true },
        { title: 'Remove', isConfirmed: true }
      )
    if (!chosen?.isConfirmed) {
      return
    }

    const jsonPackage: xpmLib.JsonXpmPackage = treeItem.parent.dataNode
      .jsonPackage as xpmLib.JsonXpmPackage
    const buildConfigurations = jsonPackage.xpack.buildConfigurations

    if (buildConfigurations !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete buildConfigurations[buildConfigurationName]
    }

    const fileNewContent = JSON.stringify(jsonPackage, null, 2) + os.EOL
    await fs.writeFile(treeItem.parent.packageJsonPath, fileNewContent)
    log.trace(`${treeItem.parent.packageJsonPath} written back`)
  }

  // --------------------------------------------------------------------------

  /**
   * Select the build configuration. Currently Not used.
   */
  async selectBuildConfiguration(): Promise<void> {
    const log = this.log

    log.trace('Command.selectBuildConfiguration()')

    this._buildConfigurationPicks ??= this.manager.data.xpmConfigurations.map(
      (dataNode: DataNodeConfiguration) => {
        return new BuildConfigurationPick(dataNode)
      }
    )
    const pick = await vscode.window.showQuickPick<BuildConfigurationPick>(
      this._buildConfigurationPicks,
      {
        placeHolder:
          'Select the build configuration for IntelliSense ' +
          '(not yet functional)',
      }
    )

    log.trace(pick)
    if (pick !== undefined) {
      this.manager.setBuildConfiguration(pick.dataNode)
    }
  }

  async createProjectEmpty(): Promise<void> {
    const log = this.log

    log.trace('Command.createProjectEmpty()')

    await this._createXpmProject(['init'])
  }

  async createProjectHelloQuick(): Promise<void> {
    const log = this.log

    log.trace('Command.createProjectHelloQuick()')

    await this._createXpmProject([
      'init',
      '--template',
      '@xpack/hello-world-template@latest',
      '--property',
      'language=cpp',
    ])
  }

  async createProjectHello(): Promise<void> {
    const log = this.log

    log.trace('Command.createProjectHello()')

    await this._createXpmProject([
      'init',
      '--template',
      '@xpack/hello-world-template@latest',
    ])
  }

  async createProjectHelloQemu(): Promise<void> {
    const log = this.log

    log.trace('Command.createProjectHelloQemu()')

    await this._createXpmProject([
      'init',
      '--template',
      '@micro-os-plus/hello-world-qemu-template@latest',
    ])
  }

  async _createXpmProject(commandArguments: string[]): Promise<void> {
    const log = this.log

    log.trace('Command._createProject()')

    const homeUri = vscode.Uri.file(os.homedir())
    const defaultUri =
      vscode.workspace.workspaceFolders != null &&
      vscode.workspace.workspaceFolders.length > 0
        ? vscode.Uri.file(vscode.workspace.workspaceFolders[0].uri.fsPath)
        : homeUri

    const uris = await vscode.window.showOpenDialog({
      title: 'Choose Folder', // Not used on macOS
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri,
    })

    if (uris === undefined) {
      return
    }

    log.trace(uris[0].fsPath)

    const xpmProgramName = 'xpm'
    const taskLabel = [xpmProgramName, ...commandArguments].join(' ')

    const task = utils.createTask(
      xpmProgramName,
      commandArguments,
      vscode.TaskScope.Workspace,
      uris[0].fsPath,
      taskLabel,
      { type: 'xPack' },
      log
    )
    const code = await vscode.tasks.executeTask(task)
    // Does not wait for the process to terminate.

    // https://code.visualstudio.com/api/references/vscode-api#tasks
    // onDidEndTaskProcess: Event<TaskProcessEndEvent>

    const start =
      vscode.workspace.workspaceFolders !== undefined
        ? vscode.workspace.workspaceFolders.length
        : 0
    vscode.workspace.updateWorkspaceFolders(start, 0, { uri: uris[0] })

    log.trace(code)
  }

  // --------------------------------------------------------------------------

  refresh(): void {
    const log = this.log

    log.trace('Commands.refresh()')

    this._buildConfigurationPicks = undefined
  }

  // --------------------------------------------------------------------------

  dispose(): void {
    const log = this.log

    log.trace('Commands.dispose()')
    // Nothing to do
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
