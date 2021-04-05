#
# This file is part of the µOS++ distribution.
#   (https://github.com/micro-os-plus)
# Copyright (c) 2021 Liviu Ionescu
#
# This Source Code Form is subject to the terms of the MIT License.
# If a copy of the license was not distributed with this file, it can
# be obtained from https://opensource.org/licenses/MIT/.
#
# -----------------------------------------------------------------------------

# https://cmake.org/cmake/help/v3.19/
cmake_minimum_required(VERSION 3.19)

message(STATUS "CMake version: ${CMAKE_VERSION}")

if(CMAKE_BINARY_DIR STREQUAL CMAKE_SOURCE_DIR)
  message(FATAL_ERROR "In-source builds are not supported. Please use separate folder for build.")
endif()

# -----------------------------------------------------------------------------

enable_language(C)
enable_language(CXX)
enable_language(ASM)

# Specify the C/C++ standards.
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS ON)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS ON)

message(STATUS "Compiler: ${CMAKE_C_COMPILER_ID} ${CMAKE_C_COMPILER_VERSION}")

# Generate the compile_commands.json file to feed the indexer.
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# -----------------------------------------------------------------------------

set(xpack_project_folder ${CMAKE_SOURCE_DIR})

# -----------------------------------------------------------------------------

message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "Project path: ${xpack_project_folder}")
# message(STATUS "Prefix path: ${CMAKE_PREFIX_PATH}")
message(STATUS "PATH: $ENV{PATH}")

# -----------------------------------------------------------------------------

project(
	hallo-welt
	DESCRIPTION "A simple Hello World application"
)

# -----------------------------------------------------------------------------

# Common to all platforms.
add_compile_definitions(
  $<$<STREQUAL:"${CMAKE_BUILD_TYPE}","Debug">:DEBUG>
)

# Options passed to the compilers and linker.
set(common_options 

  -fmessage-length=0
  -fsigned-char

  -ffunction-sections
  -fdata-sections
)

add_compile_options(

  ${common_options}
)

add_link_options(

  ${common_cpu_options}
)

# -----------------------------------------------------------------------------
# Create the application.

add_executable(application)
message(STATUS "==> application")

set_target_properties(
  application

  PROPERTIES
    OUTPUT_NAME "${CMAKE_PROJECT_NAME}"
)

# Application sources.
target_sources(
  application

  PRIVATE
    src/hallo-welt.cpp
)

# Application includes.
target_include_directories(
  application

  PRIVATE
    include
)

# -----------------------------------------------------------------------------
