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

import * as assert from 'assert'
import * as os from 'os'
import * as path from 'path'
import * as process from 'process'
import * as util from 'util'

// https://www.npmjs.com/package/liquidjs
import { Liquid } from 'liquidjs'

// https://www.npmjs.com/package/@xpack/logger
import { Logger } from '@xpack/logger'

// ----------------------------------------------------------------------------

function _isPrimitive (value: any): boolean {
  return (typeof value !== 'object' && typeof value !== 'function') ||
    value === null
}

function _isJsonObject (value: any): boolean {
  return value !== undefined && !_isPrimitive(value) && !Array.isArray(value)
}

export function filterPath (input: string): string {
  const lower = input.toLowerCase()
  const fixed = (os.platform() === 'win32')
    ? lower.replace(/[^a-z0-9\\]+/g, '-')
    : lower.replace(/[^a-z0-9/]+/g, '-')

  return fixed.replace(/--/g, '-')
}

// ----------------------------------------------------------------------------

export interface XpmLiquidMap {
  /**
   * https://nodejs.org/dist/latest-v14.x/docs/api/process.html#process_process_env
   */
  env: NodeJS.ProcessEnv
  /**
   * https://nodejs.org/dist/latest-v14.x/docs/api/os.html
   */
  os: {
    /**
     * The operating system-specific end-of-line marker.
     * - `\n` on POSIX
     * - `\r\n` on Windows
     */
    EOL: string
    /**
     * Possible values are 'arm', 'arm64', 'ia32', 'mips', 'mipsel',
     * 'ppc', 'ppc64', 's390', 's390x', 'x32', and 'x64'.
     */
    arch: string
    /**
     * Contains commonly used operating system-specific constants
     * for error codes, process signals, and so on. The specific
     * constants defined are described in
     * [OS constants](https://nodejs.org/dist/latest-v14.x/docs/api/os.html#os_os_constants_1)
     */
    constants: {
      signals: {
        [key: string]: number
      }
      errno: {
        [key: string]: number
      }
    }
    /**
     * An array of objects containing information about
     * each logical CPU core.
     */
    cpus: os.CpuInfo[]
    /**
     * A string identifying the endianness of the CPU
     * for which the Node.js binary was compiled.
     *
     * Possible values are 'BE' for big endian and 'LE' for little endian.
     */
    endianness: 'BE' | 'LE'
    /**
     * The string path of the current user's home directory.
     */
    homedir: string
    /**
     * The host name of the operating system as a string.
     */
    hostname: string
    /**
     * A string identifying the operating system platform.
     * Possible values are 'aix', 'darwin', 'freebsd', 'linux', 'openbsd',
     * 'sunos', and 'win32'.
     */
    platform: NodeJS.Platform
    /**
     * The operating system as a string.
     */
    release: string
    /**
     * Returns the operating system's default directory for
     * temporary files as a string.
     */
    tmpdir: string
    /**
     * Returns the operating system name as returned by uname(3).
     * For example, it returns 'Linux' on Linux, 'Darwin' on macOS,
     * and 'Windows_NT' on Windows.
     */
    type: string
    /**
     * Returns a string identifying the kernel version.
     *
     * On POSIX systems, the operating system release is determined
     * by calling `uname(3)`. On Windows, `RtlGetVersion()` is used,
     * and if it is not available, `GetVersionExW()` will be used.
     */
    version: string
  }
  /**
   * https://nodejs.org/dist/latest-v14.x/docs/api/path.html
   */
  path: {
    /**
     * Provides the platform-specific path delimiter:
     * - `;` for Windows
     * - `:` for POSIX
     */
    delimiter: string
    /**
     * Provides the platform-specific path segment separator:
     * - `\` on Windows
     * - `/` on POSIX
     */
    sep: string
    win32: {
      delimiter: string
      sep: string
    }
    posix: {
      delimiter: string
      sep: string
    }
  }
  package?: any
  configuration?: {
    name: string
    properties: {
      [key: string]: string[]
    }
  }
  properties?: {
    [key: string]: string[]
  }
}

// https://liquidjs.com/

export class XpmLiquid {
  // --------------------------------------------------------------------------
  // Members.

  readonly log: Logger
  readonly engine: Liquid

  // --------------------------------------------------------------------------
  // Constructors.

  constructor (log: Logger) {
    this.log = log

    this.engine = new Liquid({
      strictFilters: true,
      strictVariables: true,
      trimTagLeft: false,
      trimTagRight: false,
      trimOutputLeft: false,
      trimOutputRight: false,
      greedy: false
    })

    // https://liquidjs.com/api/classes/liquid_.liquid.html#registerFilter
    // https://nodejs.org/dist/latest-v14.x/docs/api/path.html

    // Add the main path manipulation functions.
    this.engine.registerFilter('path_basename',
      (p, ...arg) => path.basename(p, ...arg)
    )

    this.engine.registerFilter('path_dirname',
      (p) => path.dirname(p)
    )

    this.engine.registerFilter('path_dirname',
      (p) => path.dirname(p)
    )

    this.engine.registerFilter('path_normalize',
      (p) => path.normalize(p)
    )

    this.engine.registerFilter('path_join',
      (p, ...args) => path.join(p, ...args)
    )

    this.engine.registerFilter('path_relative',
      (from, to) => path.relative(from, to)
    )

    this.engine.registerFilter('path_posix_basename',
      (p, ...arg) => path.posix.basename(p, ...arg)
    )

    this.engine.registerFilter('path_posix_dirname',
      (p) => path.posix.dirname(p)
    )

    this.engine.registerFilter('path_posix_dirname',
      (p) => path.posix.dirname(p)
    )

    this.engine.registerFilter('path_posix_normalize',
      (p) => path.posix.normalize(p)
    )

    this.engine.registerFilter('path_posix_join',
      (p, ...args) => path.posix.join(p, ...args)
    )

    this.engine.registerFilter('path_posix_relative',
      (from, to) => path.posix.relative(from, to)
    )

    this.engine.registerFilter('path_win32_basename',
      (p, ...arg) => path.win32.basename(p, ...arg)
    )

    this.engine.registerFilter('path_win32_dirname',
      (p) => path.win32.dirname(p)
    )

    this.engine.registerFilter('path_win32_dirname',
      (p) => path.win32.dirname(p)
    )

    this.engine.registerFilter('path_win32_normalize',
      (p) => path.win32.normalize(p)
    )

    this.engine.registerFilter('path_win32_join',
      (p, ...args) => path.win32.join(p, ...args)
    )

    this.engine.registerFilter('path_win32_relative',
      (from, to) => path.win32.relative(from, to)
    )

    // https://nodejs.org/dist/latest-v14.x/docs/api/util.html

    this.engine.registerFilter('util_format',
      (format, ...args) => util.format(format, ...args)
    )

    // Custom action.
    this.engine.registerFilter('path_filter',
      (p) => filterPath(p)
    )
  }

  // --------------------------------------------------------------------------
  // Methods.

  /**
   * Return the base for a liquid map.
   *
   * The `package`, `configuration` and `properties` must be added later,
   * when available.
   *
   * @returns A map of properties.
   */
  prepareMap (packageJson: any, buildConfigurationName?: string): XpmLiquidMap {
    const liquidMap: XpmLiquidMap = {
      env: process.env,
      os: {
        EOL: os.EOL,
        arch: os.arch(),
        constants: {
          signals: os.constants.signals,
          errno: os.constants.errno
        },
        cpus: os.cpus(),
        endianness: os.endianness(),
        homedir: os.homedir(),
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        tmpdir: os.tmpdir(),
        type: os.type(),
        // Workaround for the missing type definition.
        version: (os as any).version() as string
      },
      path: {
        delimiter: path.delimiter,
        sep: path.sep,
        win32: {
          delimiter: path.win32.delimiter,
          sep: path.win32.sep
        },
        posix: {
          delimiter: path.posix.delimiter,
          sep: path.posix.sep
        }
      },
      package: packageJson
    }

    if (_isJsonObject(packageJson.xpack?.properties)) {
      liquidMap.properties = packageJson.xpack?.properties
    } else {
      liquidMap.properties = {}
    }

    if (buildConfigurationName !== undefined) {
      assert(packageJson.xpack?.buildConfigurations)
      const buildConfiguration =
        packageJson.xpack.buildConfigurations[buildConfigurationName]
      assert(buildConfiguration)

      liquidMap.configuration = {
        ...buildConfiguration,
        name: buildConfigurationName
      }

      if (_isJsonObject(buildConfiguration.properties)) {
        liquidMap.properties = {
          ...liquidMap.properties,
          ...buildConfiguration.properties
        }
      }
    }

    return liquidMap
  }

  // --------------------------------------------------------------------------

  /**
   * Perform substitution on the input string.
   * Repeat until no more Liquid variables or tags are identified.
   *
   * @param input - The input string, possibly with substitutions.
   * @param map - The substitution map.
   * @returns The substituted string.
   *
   * @throws Liquid exceptions
   */
  async performSubstitutions (
    input: string,
    map: XpmLiquidMap
  ): Promise<string> {
    assert(input)
    assert(map)

    const log = this.log

    let current: string = input
    let substituted: string = current

    // Iterate until all substitutions are done.
    while (current.includes('{{') || current.includes('{%')) {
      // May throw.
      substituted = await this.engine.parseAndRender(current, map)

      log.trace(`XpmLiquidMap.performSubstitutions(): '${substituted}'`)
      if (substituted === current) {
        // If nothing changed, we're done.
        break
      }
      current = substituted
    }

    return substituted
  }
}

// ----------------------------------------------------------------------------
