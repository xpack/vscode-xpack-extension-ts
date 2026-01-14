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

// TODO: migrate the modules to TS and no longer need these extra types.

declare module '@xpack/logger' {
  export class Logger {
    constructor(params: unknown)

    always(...args: unknown[]): void
    error(...args: unknown[]): void
    output(...args: unknown[]): void
    warn(...args: unknown[]): void
    info(...args: unknown[]): void
    verbose(...args: unknown[]): void
    debug(...args: unknown[]): void
    trace(...args: unknown[]): void
  }
}

// ----------------------------------------------------------------------------
