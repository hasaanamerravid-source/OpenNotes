# 2. A language server client written by hand

**Status:** accepted

## Context

OpenNotes shows the problems of a file, jumps to the definition of a symbol and lists its references. That information comes from real language servers (`gopls`, `clangd`, `typescript-language-server`, `rust-analyzer`, …) that speak the Language Server Protocol over stdin and stdout.

The obvious way to implement a client is `vscode-languageserver-node`, the package that powers the language support of Visual Studio Code. It offers the framing, the JSON-RPC transport, the document synchronisation, the capability negotiation and the type definitions of the protocol.

The problem is that `vscode-languageserver-node` is written for an extension host. It expects to run inside Visual Studio Code, where the extension host owns the documents, the workspace folders, the configuration and the lifecycle of the server. It brings its own document store and its own connection manager, and it is driven by the host through a `ConnectionProvider` and by the workspace through the `workspace` and `languages` namespaces of the extension API. OpenNotes has none of that: the documents live in the renderer, the workspace is a single folder, and the application is not Visual Studio Code.

What the application actually needs from the protocol is narrow:

* `initialize` / `initialized` with a capability set, and `shutdown` / `exit`;
* `textDocument/didOpen`, `didChange` and `didClose`;
* `textDocument/publishDiagnostics` in the other direction;
* `textDocument/definition` and `textDocument/references` as requests;
* a handful of `client/*` and `workspace/*` requests that the server sends to the client, which have to be answered with something plausible.

## Decision

The client is written by hand in `src/main/ipc/lsp.ts`. The framing is the one of the specification:

```text
Content-Length: <n>\r\n\r\n<json>
```

`parseContentLength` reads the header, `onData` cuts the complete messages out of the stream buffer, and `handleMessage` sorts an incoming message into a notification, a request from the server or an answer to a pending request. The capability set (`CLIENT_CAPABILITIES`) is a literal object in the file; it advertises hover, completion, definition, references, document symbols, signature help, formatting, code actions, code lenses, rename and inlay hints, and explicitly declines dynamic registration, workspace edits and semantic tokens.

The lifecycle is a small state machine per server process: `starting`, `ready`, `error`, `stopped`. The server is spawned, `initialize` is sent with a 20 second timeout, the answer is read (`textDocumentSync` decides whether the documents are synchronised at all, fully or incrementally), and `initialized` follows. Every state change is pushed to the renderer as a `lsp:status` event.

The renderer never speaks the protocol. It keeps the state (`src/renderer/src/core/lspState.ts`), sends the documents (`src/renderer/src/core/lspIntegration.ts`) and turns the answers into jumps (`src/renderer/src/core/lspCommands.ts`).

## Consequences

* The protocol surface is exactly the surface the application uses. There is no hidden state, no dependency on a host API and no behaviour that the application does not control.
* The document model stays in one place. The renderer owns the buffer, the main process keeps a copy of the text of every open document (the host bridge exposes `getText` and `getLanguage`) because the diagnostics have to be turned into character offsets, and the offset computation needs the text.
* The server table, the search for the executable, the handling of the Windows `.cmd` shims, the "the server is not installed" message with the install hint and the restart after a configuration change are application-specific and would have to be written anyway.
* The cost is a large file: `src/main/ipc/lsp.ts` is roughly 1200 lines, and the transport, the protocol and the configuration live in it.
* The client capabilities are a fixed subset. A server that needs a capability the client does not advertise — semantic tokens, for example — will not use it.
* The incremental synchronisation only covers `textDocumentSync` kinds 0, 1 and 2. A server that asks for something else is treated as a full synchronisation.
* The behaviour of a server is only as good as the table. `phpactor` is used for PHP because `intelephense` does not speak the protocol, and `ruby-lsp` is used because `solargraph` only speaks the older one. Those judgements live in the application, next to the table.

## Alternatives considered

* **`vscode-languageserver-node`.** Rejected because it is an extension-host library: it would bring a second document store and a second lifecycle next to the ones the application already has, and it would have to be driven through an API that does not exist outside Visual Studio Code. The transport alone is not the expensive part.
* **The `vscode-languageserver-protocol` package alone.** It provides the type definitions of the messages, not the transport or the lifecycle. The application would still have to write the framing and the state machine, and it would gain a dependency on the protocol version of a package it otherwise does not use.
* **A generic JSON-RPC library over a pipe.** It would replace about forty lines of framing with a dependency and would not solve the document synchronisation or the lifecycle, which are the parts that actually have to be right.
* **No language servers at all.** The application would rely on its own syntax diagnostics only. This loses the type information, the unused imports and the cross-file navigation, which are the reasons the feature exists.
* **A plugin model for the servers.** More flexible, but it moves the protocol into user-supplied code and leaves the diagnostics of the built-in languages unmaintained.
