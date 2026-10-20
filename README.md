# TinyCut

**Use it at [tinycut.pages.dev](https://tinycut.pages.dev/).**

A browser-based layout tool for placing images on printable pages at exact physical dimensions (mm/cm). Think of it as a digital trim-and-arrange board — place, resize, crop, and position images for print.

## Features

- Import PNG, JPG, JPEG, WEBP, and SVG images
- Place images on A4, A5, A6, or Letter page templates (or custom sizes)
- Resize images to exact physical dimensions in mm or cm
- Lock/unlock aspect ratio when resizing
- Crop images with numeric controls and visual crop handles
- Cut pieces from an image without trimming the original: drag a box anywhere on the photo for each piece
- Create rectangles, circles, lines, and editable text
- Rotate, resize, style, reorder, duplicate, and delete items
- Select several items with Shift-click, a drag box, or Ctrl/Cmd + A, then move, resize to one width or height, duplicate, or delete them together
- Copy, cut, and paste items with Ctrl/Cmd + C / X / V, including between tabs, and paste images copied from other apps
- Layers panel with stacking controls
- Configurable grid, snap-to-grid, and center guides
- Fit the full page into the workspace and center selected items precisely on the page
- Drag to move items on the page
- Visual resize handles (corners and edges)
- Undo/redo history
- Export JPEG or PNG at selectable 300, 600, or 1200 DPI, or print / save as PDF
- Add a configurable border (width and color) to images
- Print at correct physical page size
- Layouts save automatically in this browser (origin private file system), images included and stored once
- Open a new tab to start from an empty page; refresh restores the layout in that tab
- Download a single-file backup (.json with images inside) and import it on another device
- Light and dark DaisyUI themes

## Tech Stack

- **Svelte 5** (with runes: $state, $derived, $effect, $props)
- **TypeScript** (strict mode)
- **Tailwind CSS v4**
- **Vite** (build tool)
- **bun** (package manager)
- No backend — runs fully in the browser

## Privacy and cost

TinyCut is free to use and has no account, backend, ads, analytics, or paid features. Images and project content are processed in the browser. Layouts save automatically to this browser's origin private file system (files the browser keeps for this site on this device). Clearing site data removes them. Download a backup file for durable copies and for moving work to another device. A hosting provider may log ordinary page requests separately from the application.

## Install & Run

Use Node.js 24 or newer for the verification suite. Both npm and Bun lockfiles are included; use a frozen install for reproducible builds.

```bash
npm ci
npm run dev
npm run verify
npm run preview
```

Or with Bun:

```bash
# Install dependencies with bun
bun install --frozen-lockfile

# Start dev server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## How Physical Units Work

All dimensions are stored internally in **millimeters (mm)**. The display converts mm to pixels using the standard 96 DPI assumption:

```
1 inch = 25.4 mm
1 inch = 96 CSS pixels
PX_PER_MM = 96 / 25.4 ≈ 3.78
```

When you type values in the sidebar, you can switch between mm and cm display. Internal storage is always mm.

## How to Use

1. **Choose a page template**: Use the dropdown in the toolbar to select A4, A5, Letter, etc. Changing paper preserves your artwork and can be undone. Use Project → New document to start over.
2. **Import an image**: Click "Image" and select an image file from your computer.
3. **Position the image**: Drag it anywhere on the page.
4. **Resize**: Drag corner/edge handles, or type exact dimensions in the right panel.
5. **Add artwork**: Use the rectangle, circle, line, and text tools in the toolbar.
6. **Lock aspect ratio**: Toggle the checkbox in the properties panel to preserve proportions.
7. **Crop**: Click "Crop Image" and trim visually or enter the amount removed from each edge.
8. **Cut**: Click "Cut from Image" (or press X), then drag across the image to mark a piece. Drag inside the mark to move it or use its handles to resize, and press Enter to cut. Each cut makes a new object, keeps the original, and clears the mark so you can draw the next piece. Press Esc when you are done.
9. **Arrange**: Shift-click items or layers, or drag a box over empty space, to select several. With several selected, the inspector sets one width or height for all of them, or matches the last item you selected. Use the layer arrows or context menu for stacking.
10. **Align**: Use "Center X" or "Center Y" in the inspector to center one item or an entire selection while preserving its internal layout.
11. **Export/Print**: Open Export to download a JPEG or PNG at a chosen DPI, or print / save as PDF. JPEG is the default for smaller files; PNG is lossless and records the chosen physical print density.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Delete / Backspace | Delete selected items |
| Ctrl/Cmd + C / X / V | Copy, cut, and paste items (works across tabs; also pastes copied images) |
| Ctrl/Cmd + D | Duplicate selected items |
| Ctrl/Cmd + A | Select everything on the page |
| Ctrl/Cmd + S | Save now (layouts also save automatically) |
| Ctrl/Cmd + O | Your layouts |
| Ctrl/Cmd + N | New A4 document |
| Ctrl/Cmd + Z / Shift + Z | Undo / redo |
| Ctrl/Cmd + Y | Redo |
| Ctrl/Cmd + [ / ] | Send to back / bring to front |
| Arrow keys | Nudge selected items by 1 mm |
| Shift + Arrow keys | Nudge selected items by 10 mm |
| Shift + click | Add/remove an item from the selection |
| R / Shift + R | Rotate the primary item by +90° / −90° |
| Ctrl/Cmd + mouse wheel | Zoom around the pointer |
| C | Crop the selected image |
| X | Cut pieces from the selected image (drag to mark each one) |
| Escape | Deselect / exit crop or cut mode |
| Enter | Apply crop, or cut a piece and keep cutting |

## Saving layouts

Each tab is its own layout. Opening TinyCut in a new tab always starts with an empty page. The address bar gets a layout id (`#/p/…`) so refreshing **this** tab restores it.

Layouts save automatically shortly after each change. The toolbar shows "Saved", "Saving…", or "Not saved · Retry". An empty new tab writes nothing until you add something, so stray tabs do not fill the list. A layout can be open in only one tab at a time, so two tabs never overwrite each other.

Everything lives in this browser's origin private file system, a private folder the browser keeps for this site (not your Downloads folder):

```
tinycut/projects/<layout id>/project.json   page, items, and metadata (small)
tinycut/assets/<sha-256>                    image bytes, shared by every layout
```

Images are content-addressed, so a photo used in several layouts, duplicates, or cut pieces is stored once. While editing, images are held as blobs rather than base64 text, which keeps undo history and saving fast. Image files no saved layout uses are cleaned up after a day. Layouts saved by older versions are upgraded the first time they open.

Project → Your layouts lists what is stored, with item counts, image sizes, and total storage use, and can ask the browser not to clear the storage when space runs low. Project → Make a copy saves the layout under a new id. Download backup creates one `.json` file with the images embedded, for another browser or device; Import backup opens it. Clearing site data deletes saved layouts.

## Printing

When you click Print, the app prints a page-sized SVG of the layout (not the editor pasteboard), so off-page objects and zoom do not change the PDF. Choose the matching paper size and print at 100% scale with no margins or headers. For PDF export, use your browser's "Save as PDF" option in the print dialog.

## Project Structure

```
src/
  main.ts                    Entry point
  App.svelte                 Root component
  app.css                    Global styles + print CSS
  lib/
    types/
      document.ts            Type definitions, constants
    stores/
      documentStore.svelte.ts   Central state (Svelte 5 runes)
    utils/
      units.ts               mm/px/cm conversions
      ids.ts                 Unique ID generation
      image.ts               File loading & dimension detection
      assets.ts              Content-addressed image registry (blob URLs, hashing)
      projectStorage.ts      Origin private file system layout, upgrade, cleanup
      layoutLock.ts          One tab per layout (Web Locks)
      clipboard.ts           Copy/paste payload format
      pageSvg.ts             Page renderer used by image export and print
    components/
      TopToolbar.svelte      Toolbar with page, zoom, unit controls
      Workspace.svelte       Main editing area with drag support
      PageCanvas.svelte      The printable page
      ImageObject.svelte     Individual image rendering + interaction
      ResizeHandles.svelte   Visual resize handles
      CropHandles.svelte     Visual crop overlay
      PropertiesPanel.svelte Side panel (context-switches)
      PageSettingsPanel.svelte Page settings
      ImageSettingsPanel.svelte  Image properties
      CropPanel.svelte       Numeric crop controls
```

## Verification

`npm run verify` runs Svelte/TypeScript diagnostics, geometry and document-store regression tests, and the production build. CI also runs a dependency audit.

For browser-only checks, start the dev server and open:

- `/tests/browser.html`: image decoders, corrupt/unsupported input, print surface, raster pixels, and DPI metadata at 300/600/1200 DPI. Click **Run browser checks**.
- `/tests/accessibility.html`: WCAG A/AA checks for inspectors, page settings, menus, and dialogs in both themes. Click **Run accessibility checks** in a foreground Chrome tab.

These test pages are outside the production build. `tests/fixtures/print.json` is a small project for checking print/PDF dimensions, clipping, and rotation. See [the release review](RELEASE_READINESS.md) for verified coverage and remaining platform checks.

## Static hosting

Run `npm ci && npm run verify`, then serve **only `dist/`** from an HTTPS static host. The default build expects the site's root path. Set Vite's `base` and adjust root-relative icon URLs before hosting under a subdirectory. No application server, credentials, database, or environment variables are required. Vite's development and preview servers are for local testing, not the public service.

### Cloudflare Pages

Connect the GitHub repository `tmscsb/tinycut` to a Cloudflare Pages project with these build settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | `bun run pages:build` |
| Build output directory | `dist` |
| Build environment variables | `BUN_VERSION=1.4.0`, `NODE_VERSION=24`, `SKIP_DEPENDENCY_INSTALL=1` |

The build command installs dependencies from the committed `bun.lock` and builds the static site. Cloudflare Pages publishes the generated `dist/` directory; it should not be committed. The environment settings select the tested Bun version and the project's required Node version, while disabling Pages' separate dependency installation. Once Git integration is connected, pushes to `main` trigger production deployments.

`public/_headers` is copied into `dist/` and, on Cloudflare Pages, serves `index.html` with revalidation (`Cache-Control: no-cache`), hashed `/assets/` files with long-lived immutable caching, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`. The build also includes `robots.txt`, `sitemap.xml`, the Open Graph image, and app icons. The canonical URL in `index.html` is `https://tinycut.pages.dev/`; update it if the public origin changes. Check the deployed URL in a clean browser before announcing it.

## Known Limitations

- Multi-selection sets one width or height for every item, but there is no handle-drag resize of a whole group.
- Copying between tabs uses the system clipboard. When a browser does not fire clipboard events without a text selection, Ctrl/Cmd + V pastes items copied in the same tab only.
- Text uses a small browser-safe font list; custom font embedding is not available.
- Images are limited to 20 MB and 64 megapixels; project imports to 50 MB and 1,000 items; paper dimensions to 2,000 mm per side.
- Browser storage quotas still apply to layouts saved in this browser. Save failures show "Not saved · Retry" in the toolbar; download a backup to keep the work.
- PNG resolutions that would require an unsafe browser canvas allocation are disabled for the current page size; use a lower DPI or a smaller page.
- Undo keeps up to 50 operations, with a 64 MB snapshot budget (plus the most recent operation). Large embedded images reduce the available undo depth.
- Print margins and scaling must remain disabled in the browser print dialog; TinyCut supplies the exact CSS page size.

## License

MIT
