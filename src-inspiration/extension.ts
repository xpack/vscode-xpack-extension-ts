/*
 * This file is part of the xPack project (http://xpack.github.io).
 * Copyright (c) 2021 Liviu Ionescu. All rights reserved.
 *
 * Licensed under the terms of the MIT License.
 * See LICENSE in the project root for license information.
 *
 * This file is inspired by vscode.git/extensions/npm/src/npmView.ts.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/* eslint max-len: [ "error", 80, { "ignoreUrls": true } ] */

// ----------------------------------------------------------------------------

// import * as assert from 'assert'

// https://www.npmjs.com/package/request-light
// import * as httpRequest from 'request-light'

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'

// import { NpmScriptsTreeDataProvider } from './lib/other/tree-view-actions'
// import {
//   // getPackageManager, hasPackageJson
//   invalidateTasksCache,
//   NpmTaskProvider
// } from './lib/other/tasks'

import { Commands } from './lib/commands'

// ----------------------------------------------------------------------------

let commands: Commands

// let treeDataProvider: NpmScriptsTreeDataProvider | undefined

export async function activate (
  context: vscode.ExtensionContext): Promise<void> {
  console.log('"ilg-vscode.xpack" activated')

  commands = new Commands(context)
  commands.register()

  // configureHttpRequest()
  // context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(
  //   (e) => {
  //     if (e.affectsConfiguration('http.proxy') ||
  //       e.affectsConfiguration('http.proxyStrictSSL')) {
  //       configureHttpRequest()
  //     }
  //   }))

  // const canRunNPM = canRunNpmInCurrentWorkspace();
  // context.subscriptions.push(addJSONProviders(httpRequest.xhr, canRunNPM));

  // registerTaskProvider(context)

  // treeDataProvider = registerExplorer(context)

  /*
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('npm.exclude') ||
    e.affectsConfiguration('npm.autoDetect')) {
      invalidateTasksCache()
      if (treeDataProvider != null) {
        treeDataProvider.refresh()
      }
    }
    if (e.affectsConfiguration('npm.scriptExplorerAction')) {
      if (treeDataProvider != null) {
        treeDataProvider.refresh()
      }
    }
  }))
  */

  // registerHoverProvider(context);
  // TODO: add the rest
  console.log('"ilg-vscode.xpack" activation completed')
}

export function deactivate (): void {
  console.log('"ilg-vscode.xpack" deactivated')
}

// ----------------------------------------------------------------------------

// function invalidateScriptCaches (): void {
//   // invalidateHoverScriptsCache();
//   invalidateTasksCache()
//   if (treeDataProvider != null) {
//     treeDataProvider.refresh()
//   }
// }

// let taskProvider: NpmTaskProvider
// function registerTaskProvider (
//   context: vscode.ExtensionContext): vscode.Disposable | undefined {
//   if (vscode.workspace.workspaceFolders != null) {
//     const watcher = vscode.workspace.createFileSystemWatcher('**/package.json')
//     watcher.onDidChange((_e) => invalidateScriptCaches())
//     watcher.onDidDelete((_e) => invalidateScriptCaches())
//     watcher.onDidCreate((_e) => invalidateScriptCaches())
//     context.subscriptions.push(watcher)

//     const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(
//       (_e) => {
//         invalidateScriptCaches()
//       }
//     )
//     context.subscriptions.push(workspaceWatcher)

//     taskProvider = new NpmTaskProvider(context)
//     const disposable = vscode.tasks.registerTaskProvider('xpack', taskProvider)
//     context.subscriptions.push(disposable)
//     return disposable
//   }
//   return undefined
// }

// function registerExplorer (
//   context: vscode.ExtensionContext): NpmScriptsTreeDataProvider | undefined {
//   if (vscode.workspace.workspaceFolders != null) {
//     assert(taskProvider)
//     const treeDataProvider =
//     new NpmScriptsTreeDataProvider(context, taskProvider)
//     const view = vscode.window.createTreeView('xpack',
//       { treeDataProvider: treeDataProvider, showCollapseAll: true })
//     context.subscriptions.push(view)
//     return treeDataProvider
//   }
//   return undefined
// }

// function registerHoverProvider(context: vscode.ExtensionContext):
// NpmScriptHoverProvider | undefined

// function configureHttpRequest (): void {
//   const httpSettings = vscode.workspace.getConfiguration('http')
//   httpRequest.configure(httpSettings.get<string>('proxy', ''),
//     httpSettings.get<boolean>('proxyStrictSSL', true))
// }

// function canRunNpmInCurrentWorkspace (): boolean {
//   if (vscode.workspace.workspaceFolders != null) {
//     return vscode.workspace.workspaceFolders.some(
//        (f) => f.uri.scheme === 'file'
//     )
//   }
//   return false
// }

// ----------------------------------------------------------------------------
