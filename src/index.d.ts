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

// TODO: migrate the modules to TS and no longer need these extra types.

declare module '@xpack/logger' {
  export class Logger {
    constructor (params: unknown)

    always (...args: unknown[]): void
    error (...args: unknown[]): void
    output (...args: unknown[]): void
    warn (...args: unknown[]): void
    info (...args: unknown[]): void
    verbose (...args: unknown[]): void
    debug (...args: unknown[]): void
    trace (...args: unknown[]): void
  }
}

// ----------------------------------------------------------------------------
