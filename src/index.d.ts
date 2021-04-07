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

// TODO: migrate the modules to TS and no longer need these extra types.

declare module '@xpack/logger' {
  export class Logger {
    constructor (params: any)

    always (...args: any[]): void
    error (...args: any[]): void
    output (...args: any[]): void
    warn (...args: any[]): void
    info (...args: any[]): void
    verbose (...args: any[]): void
    debug (...args: any[]): void
    trace (...args: any[]): void
  }
}

// ----------------------------------------------------------------------------
