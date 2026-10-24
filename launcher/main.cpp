/*
 * OpenNotes launcher
 *
 * A small native program that starts the OpenNotes desktop app. It looks for
 * the application relative to its own location, so the launcher keeps working
 * no matter where it is placed:
 *
 *   <somewhere>/bin/opennotes-launcher   ->  <root>
 *   <root>/opennotes-launcher             ->  <root>
 *
 * The packaged application is preferred over the development runtime: the
 * process of the packaged application is called "OpenNotes", while the
 * development runtime is "electron.exe".
 *
 * Every argument is forwarded to the app, so
 *
 *   opennotes-launcher notes.md src/     ->  opens both in OpenNotes
 *
 * works like a normal "open with" handler.
 *
 * On Windows the application is started without a console window: the
 * Electron runtime is a console program and would otherwise open one.
 */

#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#else
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <unistd.h>
#endif

namespace {

#ifdef _WIN32
constexpr char kSeparator = '\\';
constexpr char kElectronExe[] = "electron.exe";
constexpr char kElectronDir[] = "node_modules\\electron\\dist";
constexpr char kPackagedExe[] = "OpenNotes.exe";
#else
constexpr char kSeparator = '/';
constexpr char kElectronExe[] = "electron";
constexpr char kElectronDir[] = "node_modules/electron/dist";
constexpr char kPackagedExe[] = "OpenNotes";
#endif

std::string joinPath(const std::string &a, const std::string &b) {
  if (a.empty()) return b;
  if (!b.empty() && b[0] == kSeparator) return a + b;
  if (a.back() == kSeparator) return a + b;
  return a + kSeparator + b;
}

std::string directoryOf(const std::string &path) {
  const size_t slash = path.find_last_of(kSeparator);
  return slash == std::string::npos ? std::string() : path.substr(0, slash);
}

bool isDirectory(const std::string &path) {
#ifdef _WIN32
  const DWORD attributes = GetFileAttributesA(path.c_str());
  return attributes != INVALID_FILE_ATTRIBUTES && (attributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
#else
  struct stat info;
  return stat(path.c_str(), &info) == 0 && S_ISDIR(info.st_mode);
#endif
}

bool exists(const std::string &path) {
#ifdef _WIN32
  return GetFileAttributesA(path.c_str()) != INVALID_FILE_ATTRIBUTES;
#else
  struct stat info;
  return stat(path.c_str(), &info) == 0;
#endif
}

std::string executableDirectory() {
#ifdef _WIN32
  char buffer[MAX_PATH];
  const DWORD length = GetModuleFileNameA(nullptr, buffer, MAX_PATH);
  if (length == 0) return std::string();
  std::string path(buffer, length);
  return directoryOf(path);
#else
  char buffer[4096];
  const ssize_t length = readlink("/proc/self/exe", buffer, sizeof(buffer) - 1);
  if (length <= 0) return std::string();
  buffer[length] = '\0';
  return directoryOf(std::string(buffer));
#endif
}

/** The folder that holds the Electron runtime and the built application. */
std::string findApplicationRoot() {
  const char *forced = std::getenv("OPENNOTES_ROOT");
  if (forced != nullptr && *forced != '\0' && isDirectory(forced)) {
    return std::string(forced);
  }

  std::string dir = executableDirectory();
  for (int level = 0; level < 6 && !dir.empty(); ++level) {
    if (exists(joinPath(joinPath(dir, kElectronDir), kElectronExe))) {
      return dir;
    }
    if (exists(joinPath(dir, kPackagedExe))) {
      return dir;
    }
    const size_t slash = dir.find_last_of(kSeparator);
    if (slash == std::string::npos) break;
    dir = dir.substr(0, slash);
  }
  return std::string();
}

std::string electronPath(const std::string &root) {
  const char *forced = std::getenv("OPENNOTES_ELECTRON");
  if (forced != nullptr && *forced != '\0') {
    return std::string(forced);
  }
  return joinPath(joinPath(root, kElectronDir), kElectronExe);
}

/**
 * The packaged application, when it has been built.
 *
 * It is preferred over the development runtime: the process is called
 * "OpenNotes" in the task manager instead of "Electron".
 */
std::string packagedAppPath(const std::string &root) {
  const char *forced = std::getenv("OPENNOTES_APP");
  if (forced != nullptr && *forced != '\0' && exists(forced)) {
    return std::string(forced);
  }
#ifdef _WIN32
  const char *candidates[] = {
      "release\\win-unpacked\\OpenNotes.exe",
      "release\\OpenNotes.exe",
      "OpenNotes.exe",
  };
#else
  const char *candidates[] = {
      "release/linux-unpacked/opennotes",
      "release/OpenNotes",
      "OpenNotes",
  };
#endif
  for (const char *candidate : candidates) {
    const std::string path = joinPath(root, candidate);
    if (exists(path)) return path;
  }
  return std::string();
}

void reportError(const std::string &message) {
#ifdef _WIN32
  MessageBoxA(nullptr, message.c_str(), "OpenNotes", MB_OK | MB_ICONERROR);
#else
  std::fprintf(stderr, "%s\n", message.c_str());
#endif
}

} // namespace

int main(int argc, char **argv) {
  const std::string root = findApplicationRoot();
  if (root.empty()) {
    reportError("OpenNotes could not find its application folder.\n\n"
                "Keep the launcher next to the OpenNotes folder or set OPENNOTES_ROOT.");
    return 2;
  }

  // The packaged application first, the development runtime second.
  std::string program = packagedAppPath(root);
  std::string workingDirectory = root;
  bool developmentRuntime = false;
  if (program.empty()) {
    program = electronPath(root);
    developmentRuntime = true;
    if (!exists(program)) {
      reportError("The Electron runtime is missing.\n\n" + program +
                  "\n\nRun \"npm install\" in the OpenNotes folder, or set OPENNOTES_ELECTRON.");
      return 3;
    }
  } else {
    const std::string directory = directoryOf(program);
    if (!directory.empty()) workingDirectory = directory;
  }

  std::vector<std::string> arguments;
  arguments.push_back(program);
  if (developmentRuntime) {
    // The runtime needs to know which application it should start.
    arguments.push_back(root);
  }
  for (int i = 1; i < argc; ++i) {
    arguments.push_back(std::string(argv[i]));
  }

#ifdef _WIN32
  std::string commandLine;
  for (size_t i = 0; i < arguments.size(); ++i) {
    if (i > 0) commandLine += ' ';
    commandLine += '"' + arguments[i] + '"';
  }

  STARTUPINFOA startupInfo;
  ZeroMemory(&startupInfo, sizeof(startupInfo));
  startupInfo.cb = sizeof(startupInfo);
  // The window of the application is drawn by the application itself.
  startupInfo.dwFlags = STARTF_USESHOWWINDOW;
  startupInfo.wShowWindow = SW_HIDE;

  PROCESS_INFORMATION processInfo;
  ZeroMemory(&processInfo, sizeof(processInfo));

  // CREATE_NO_WINDOW keeps the console of the Electron runtime hidden: the
  // launcher is a window program and the user should not see a console.
  const DWORD flags = CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP;
  if (!CreateProcessA(program.c_str(), const_cast<char *>(commandLine.c_str()), nullptr, nullptr, FALSE,
                      flags, nullptr, workingDirectory.c_str(), &startupInfo, &processInfo)) {
    reportError("OpenNotes could not be started.");
    return 4;
  }
  CloseHandle(processInfo.hThread);
  WaitForSingleObject(processInfo.hProcess, INFINITE);
  DWORD exitCode = 0;
  GetExitCodeProcess(processInfo.hProcess, &exitCode);
  CloseHandle(processInfo.hProcess);
  return static_cast<int>(exitCode);
#else
  std::vector<char *> raw;
  raw.reserve(arguments.size());
  for (std::string &argument : arguments) {
    raw.push_back(const_cast<char *>(argument.c_str()));
  }
  raw.push_back(nullptr);

  const pid_t child = fork();
  if (child == 0) {
    if (chdir(workingDirectory.c_str()) != 0) {
      // Not fatal, the app resolves its own paths.
    }
    execv(program.c_str(), raw.data());
    _exit(127);
  }
  if (child < 0) {
    reportError("OpenNotes could not be started.");
    return 4;
  }
  int status = 0;
  waitpid(child, &status, 0);
  return WIFEXITED(status) ? WEXITSTATUS(status) : 1;
#endif
}
