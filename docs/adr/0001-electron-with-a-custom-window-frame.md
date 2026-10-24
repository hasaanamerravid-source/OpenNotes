# 1. Electron with a window frame drawn by the application

**Status:** accepted

## Context

OpenNotes puts the file tabs in the title bar and lets the user drag the window by the empty space of that bar, the way a browser or a native code editor does. The tab strip, the toolbar icons and the window buttons therefore share one horizontal band, and the band has to reach the top edge of the window on every platform.

The operating system draws its own title bar by default: a caption with the icon, the title and the minimise/maximise/close buttons. On Windows that caption has a fixed height, and the buttons are placed by the system. Two consequences follow:

* the caption takes vertical space that the editor cannot use, and the file tabs would have to live in a second row below it;
* the system buttons are drawn over the client area, so whatever the application puts in the top right corner can be covered by them.

Electron offers two ways to get rid of the system caption. `titleBarStyle: 'hidden'` removes the caption but leaves the window frame (the resize border); on macOS the traffic-light buttons stay where the platform puts them. `titleBarStyle: 'hidden'` combined with `titleBarOverlay` keeps the caption buttons and draws them over the application — the application then has to leave room for them and cannot put anything under them.

## Decision

The main window is created without a caption and without an overlay:

```ts
// src/main/window.ts, createAppWindow()
titleBarStyle: 'hidden',
autoHideMenuBar: true,
```

The application draws the frame itself. `src/renderer/src/components/TitleBar.tsx` renders the minimise, maximise/restore and close buttons, and calls `window.api.win.minimize()`, `window.api.win.toggleMaximize()` and `window.api.win.close()`, which are handled in `src/main/ipc/window.ts`. The maximise state is pushed to the renderer with the `win:maximize-change` event, so the button can switch between the "restore" and the "maximise" glyph.

The window is dragged by the elements that are explicitly marked as a drag region. `src/renderer/src/styles/appearance.css` sets `-webkit-app-region: no-drag` on the title bar as a whole and `-webkit-app-region: drag` only on `.titlebar-drag`, `.titlebar-logo` and `.titlebar-title`. The interactive elements are marked `no-drag` individually, because the property is not inherited. A control can therefore never be swallowed by the window manager.

The native menu bar is not part of the frame. It is hidden with `autoHideMenuBar` and `win.setMenuBarVisibility(false)`, but it is still installed, so `Alt` opens it and every accelerator keeps working. The `settings.mainMenuStyle` setting decides whether the in-app hamburger menu, the native bar, or both are shown.

## Consequences

* Nothing the operating system draws can overlap the toolbar, the tab strip or the window buttons — the buttons are part of the layout, not on top of it.
* The application owns the caption: it draws the buttons, the hover states and the close behaviour, and it has to keep them in sync with the window state.
* The window needs its own drag region, and the CSS has to be careful with `-webkit-app-region`, because the property is not inherited and a missing `no-drag` turns a button into a drag handle.
* The title of the window is set by the application (`win:setTitle`), so it shows the active tab and the dirty marker.
* `win:setTheme` still calls `win.setTitleBarOverlay`, which is wrapped in a `try`/`catch`: without an overlay the call fails on every platform and the failure is ignored. The function is a leftover from the earlier overlay design.
* The "new window" command creates a second window in `src/main/ipc/shell.ts`, and that path still passes `titleBarOverlay` and does not draw the window controls. A second window therefore looks different from the first one. This is a known inconsistency, not a deliberate design.
* The window controls are drawn unconditionally: there is no platform check in `TitleBar.tsx` and no rule for them in the stylesheets, so on macOS the application's buttons sit next to the traffic lights the platform keeps.

## Alternatives considered

* **The native frame** (`frame: true`, no `titleBarStyle`). The system draws the caption, the tabs live below it and the title bar area is lost. This is the default of every Electron application and was rejected because the tab strip is the point of the custom frame.
* **`titleBarStyle: 'hidden'` with `titleBarOverlay`.** The caption buttons are drawn by the system over the client area, on the right, in a band of a fixed height. The toolbar icons and the tab strip would have to stop short of that band, and the buttons would sit on top of the application's own content. The README records the outcome: the native overlay is gone, so nothing of the operating system can overlap the toolbar.
* **`frame: false`.** A completely frameless window without the resize border. The window could not be resized by dragging its edge, which is not acceptable for an editor.
* **A web-based frame only, with the native buttons kept.** The application would draw the tab strip but leave the system buttons in place. This is the overlay variant above, with the same overlap problem.
