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

import * as vscode from 'vscode'

import { Logger } from '@xpack/logger'

import { ExtensionManager } from './manager'

// ----------------------------------------------------------------------------

// This class is only a placeholder, the actual implementation
// requires parsing the package.json and keeping a map of locations
// and explanations,
// which is not trivial and will be added in a future release.
// For now only the current line is shown on debug.

export class Hover implements vscode.Disposable {
  // --------------------------------------------------------------------------
  // Static members & methods.

  static async register (
    manager: ExtensionManager
  ): Promise<Hover> {
    const _hover = new Hover(manager)
    manager.subscriptions.push(_hover)

    const log = manager.log

    // Add possible async calls here.

    log.trace('Hover object created')
    return _hover
  }

  // --------------------------------------------------------------------------
  // Members.

  readonly log: Logger

  private readonly _hoverProvider: XpackHoverProvider

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (readonly manager: ExtensionManager) {
    this.log = manager.log

    const log = this.log

    this._hoverProvider = new XpackHoverProvider(manager)

    const context: vscode.ExtensionContext = manager.vscodeContext

    manager.addCallbackRefresh(
      async () => {
        this._hoverProvider.refresh()
      }
    )

    const packageJsonSelector: vscode.DocumentSelector = {
      language: 'json',
      scheme: 'file',
      pattern: '**/package.json'
    }
    context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        packageJsonSelector, this._hoverProvider)
    )

    log.trace('hover provider registered')
  }

  // --------------------------------------------------------------------------
  // Methods.

  dispose (): void {
    const log = this.log

    log.trace('Hover.dispose()')
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------

export class XpackHoverProvider implements vscode.HoverProvider {
  // --------------------------------------------------------------------------
  // Members.

  readonly log: Logger
  readonly manager: ExtensionManager

  // --------------------------------------------------------------------------
  // Constructor.

  constructor (manager: ExtensionManager) {
    this.manager = manager
    this.log = manager.log
  }

  // --------------------------------------------------------------------------
  // Methods.

  /**
   * Provide a hover for the given position and document. Multiple
   * hovers at the same position will be merged by the editor.
   * A hover can have a range which defaults
   * to the word range at the position when omitted.
   *
   * @param document The document in which the command was invoked.
   * @param position The position at which the command was invoked.
   * @param token A cancellation token.
   * @return A hover or a thenable that resolves to such. The lack of a
   * result can be signaled by returning `undefined` or `null`.
   *
   * @override
   */
  provideHover (
    _document: vscode.TextDocument,
    _position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const log = this.log

    // log.trace(_document)
    log.trace(`hover over line '${_document.lineAt(_position.line).text}'`)
    return null
  }

  refresh (): void {
    const log = this.log

    log.trace('XpackHoverProvider.refresh()')
  }
}

// ----------------------------------------------------------------------------
