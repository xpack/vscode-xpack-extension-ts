/*
 * This file is part of the µOS++ distribution.
 *   (https://github.com/micro-os-plus)
 * Copyright (c) 2021-2026 Liviu Ionescu. All rights reserved.
 *
 * Permission to use, copy, modify, and/or distribute this software
 * for any purpose is hereby granted, under the terms of the MIT license.
 *
 * If a copy of the license was not distributed with this file, it can
 * be obtained from https://opensource.org/licenses/mit.
 */

// ----------------------------------------------------------------------------

#include "hello-world.h"

#include <iostream>

int main(int argc, char *argv[])
{
  std::cout << "Hello World! " << std::endl;

#if defined(DEBUG)
  std::cout << "(in debug mode)";
#else
  std::cout << "(in release mode)";
#endif

  std::cout << std::endl;
  return 0;
}

// ----------------------------------------------------------------------------
