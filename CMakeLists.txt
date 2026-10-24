cmake_minimum_required(VERSION 3.16)

project(
  OpenNotes
  VERSION 1.0.0
  DESCRIPTION "OpenNotes - an all-in-one text editor (Notepad + Notepad++ + LibreOffice + Obsidian)"
  LANGUAGES CXX
)

# ---------------------------------------------------------------------------
# The launcher
#
# A tiny native program that starts the OpenNotes desktop app. It is meant to
# be the "double clickable" entry point: it finds the Electron runtime and the
# application folder next to itself, starts the app and forwards any files or
# folders that were passed on the command line.
# ---------------------------------------------------------------------------

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

option(OPENNOTES_GUI_LAUNCHER "Build the launcher without a console window (Windows)" ON)
option(OPENNOTES_INSTALL_TARGET "Add install rules for the launcher" ON)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "" FORCE)
endif()

set(OPENNOTES_ROOT "${CMAKE_CURRENT_SOURCE_DIR}")

if(WIN32)
  if(OPENNOTES_GUI_LAUNCHER)
    add_executable(opennotes-launcher WIN32 launcher/main.cpp)
  else()
    add_executable(opennotes-launcher launcher/main.cpp)
  endif()
else()
  add_executable(opennotes-launcher launcher/main.cpp)
endif()

target_compile_definitions(
  opennotes-launcher
  PRIVATE OPENNOTES_ROOT="${OPENNOTES_ROOT}"
)

# The application icon (Windows resource). Only added when a resource
# compiler is installed (rc.exe from MSVC or windres from MinGW).
if(WIN32 AND EXISTS "${OPENNOTES_ROOT}/build/icon.ico")
  find_program(OPENNOTES_RC NAMES rc.exe windres.exe)
  if(OPENNOTES_RC)
    enable_language(RC)
    target_sources(opennotes-launcher PRIVATE launcher/opennotes.rc)
  else()
    message(STATUS "No resource compiler found - the launcher is built without an icon")
  endif()
endif()

if(MSVC)
  target_compile_options(opennotes-launcher PRIVATE /W4 /utf-8)
else()
  target_compile_options(opennotes-launcher PRIVATE -Wall -Wextra)
endif()

# ---------------------------------------------------------------------------
# Convenience targets
# ---------------------------------------------------------------------------

# Build everything that belongs to the app (the Electron bundle).
add_custom_target(
  opennotes-bundle
  COMMAND ${CMAKE_COMMAND} -E env npm run build
  WORKING_DIRECTORY "${OPENNOTES_ROOT}"
  COMMENT "Building the OpenNotes renderer/main bundles"
)

# Launch the app through the freshly built launcher.
add_custom_target(
  opennotes-run
  COMMAND "${CMAKE_COMMAND}" -E env $<TARGET_FILE:opennotes-launcher>
  DEPENDS opennotes-launcher
  WORKING_DIRECTORY "${OPENNOTES_ROOT}"
  COMMENT "Starting OpenNotes"
)

if(OPENNOTES_INSTALL_TARGET)
  install(TARGETS opennotes-launcher RUNTIME DESTINATION bin)

  if(WIN32)
    # Create a start menu and desktop shortcut.
    install(
      CODE "
        execute_process(
          COMMAND powershell -NoProfile -ExecutionPolicy Bypass -File \"${OPENNOTES_ROOT}/scripts/create-shortcut.ps1\" -Launcher \"$<TARGET_FILE:opennotes-launcher>\" -Icon \"${OPENNOTES_ROOT}/build/icon.ico\" -Application \"${OPENNOTES_ROOT}/release/win-unpacked/OpenNotes.exe\"
          RESULT_VARIABLE shortcut_result
        )
        if(NOT shortcut_result EQUAL 0)
          message(WARNING \"The shortcut could not be created\")
        endif()
      "
    )
  else()
    install(
      FILES "${OPENNOTES_ROOT}/scripts/opennotes.desktop"
      DESTINATION share/applications
      RENAME opennotes.desktop
    )
  endif()
endif()