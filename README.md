# TrimKit

A browser-based layout tool for placing images on printable pages at exact physical dimensions (mm/cm). Think of it as a digital trim-and-arrange board — place, resize, crop, and position images for print.

## Features

- Import PNG, JPG, JPEG, WEBP, and SVG images
- Place images on A4, A5, A6, or Letter page templates (or custom sizes)
- Resize images to exact physical dimensions in mm or cm
- Lock/unlock aspect ratio when resizing
- Crop images with numeric controls and visual crop handles
- Create rectangles, circles, lines, and editable text
- Rotate, resize, style, reorder, duplicate, and delete items
- Shift-select and move, duplicate, or delete multiple items together
- Layers panel with stacking controls
- Configurable grid, snap-to-grid, and center guides
- Fit the full page into the workspace and center selected items precisely on the page
- Drag to move items on the page
- Visual resize handles (corners and edges)
- Undo/redo history
- Export to layered SVG with physical dimensions or PNG at selectable 300, 600, or 1200 DPI
- Print at correct physical page size
- Save/load projects via localStorage
- Import/export projects as JSON
- Light and dark DaisyUI themes

## Tech Stack

- **Svelte 5** (with runes: $state, $derived, $effect, $props)
- **TypeScript** (strict mode)
- **Tailwind CSS v4**
- **Vite** (build tool)
- **bun** (package manager)
- No backend — runs fully in the browser

## Privacy and cost

TrimKit is free to use and has no account, backend, ads, analytics, or paid features. Images and project content are processed in the browser. Saving uses this browser's local storage; clearing site data removes that saved copy. Download project JSON files for durable backups and transferring work to another device. A hosting provider may log ordinary page requests separately from the application.

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
8. **Arrange**: Shift-click items or layers for multi-selection; use the layer arrows or context menu for stacking.
9. **Align**: Use "Center X" or "Center Y" in the inspector to center one item or an entire selection while preserving its internal layout.
10. **Export/Print**: Open Export to download a layered SVG, choose a DPI and download PNG, or print / save as PDF. PNG defaults to 600 DPI and records the chosen physical print density.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Delete / Backspace | Delete selected items |
| Ctrl/Cmd + D | Duplicate selected items |
| Ctrl/Cmd + S | Save to localStorage |
| Ctrl/Cmd + N | New A4 document |
| Ctrl/Cmd + Z / Shift + Z | Undo / redo |
| Ctrl/Cmd + Y | Redo |
| Ctrl/Cmd + [ / ] | Send to back / bring to front |
| Arrow keys | Nudge selected items by 1 mm |
| Shift + Arrow keys | Nudge selected items by 10 mm |
| Shift + click | Add/remove an item from the selection |
| R / Shift + R | Rotate the primary item by +90° / −90° |
| Ctrl/Cmd + mouse wheel | Zoom around the pointer |
| Escape | Deselect / exit crop mode |

## Printing

When you click Print, the app uses `@media print` CSS rules to hide the UI and show only the page at its physical dimensions. The browser's print dialog handles the rest. For PDF export, use your browser's "Save as PDF" option in the print dialog.

## Export SVG

The SVG export uses mm-based coordinates in the viewBox, so the exported file preserves physical dimensions. Text exports as native SVG text, with the same wrapping and alignment as the editor. Images are embedded and layers preserve stacking order. Installed fonts can differ between devices; check the result when opening an SVG in another editor.

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
      exportSvg.ts           SVG export
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

- `/tests/browser.html`: image decoders, corrupt/unsupported input, layered SVG, raster pixels, and DPI metadata at 300/600/1200 DPI. Click **Run browser checks**.
- `/tests/accessibility.html`: WCAG A/AA checks for inspectors, page settings, menus, and dialogs in both themes. Click **Run accessibility checks** in a foreground Chrome tab.

These test pages are outside the production build. `tests/fixtures/print.json` is a small project for checking print/PDF dimensions, clipping, and rotation. See [the release review](RELEASE_READINESS.md) for verified coverage and remaining platform checks.

## Static hosting

Run `npm ci && npm run verify`, then serve **only `dist/`** from an HTTPS static host. The default build expects the site's root path. Set Vite's `base` and adjust root-relative icon URLs before hosting under a subdirectory. No application server, credentials, database, or environment variables are required. Vite's development and preview servers are for local testing, not the public service.

On the host, serve `index.html` with revalidation (`Cache-Control: no-cache`) and hashed `/assets/` files with long-lived immutable caching. Configure `X-Content-Type-Options: nosniff` and an appropriate `Referrer-Policy`. Check the deployed URL in a clean browser before announcing it.

## Known Limitations

- Multi-selection supports group movement, nudging, duplication, and deletion, but not marquee selection or group resizing.
- Text uses a small browser-safe font list; custom font embedding is not available.
- Images are limited to 20 MB and 64 megapixels; project imports to 50 MB and 1,000 items; paper dimensions to 2,000 mm per side.
- Browser storage quotas still apply to local saves containing large embedded images. JSON export is the durable backup path, and quota failures are reported in the UI.
- PNG resolutions that would require an unsafe browser canvas allocation are disabled for the current page size; use a lower DPI or a smaller page.
- Undo keeps up to 50 operations, with a 64 MB snapshot budget (plus the most recent operation). Large embedded images reduce the available undo depth.
- Print margins and scaling must remain disabled in the browser print dialog; TrimKit supplies the exact CSS page size.

## License

MIT
