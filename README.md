# TrimKit

A browser-based layout tool for placing images on printable pages at exact physical dimensions (mm/cm). Think of it as a digital trim-and-arrange board — place, resize, crop, and position images for print.

## Features

- Import PNG, JPG, JPEG, WEBP images
- Place images on A4, A5, A6, or Letter page templates (or custom sizes)
- Resize images to exact physical dimensions in mm or cm
- Lock/unlock aspect ratio when resizing
- Crop images with numeric controls and visual crop handles
- Create rectangles, circles, lines, and editable text
- Rotate, resize, style, reorder, duplicate, and delete items
- Shift-select and move, duplicate, or delete multiple items together
- Layers panel with stacking controls
- Configurable grid, snap-to-grid, and center guides
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

## Install & Run

```bash
# Install dependencies with bun
bun install

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

1. **Choose a page template**: Use the dropdown in the toolbar to select A4, A5, Letter, etc.
2. **Import an image**: Click "+ Image" and select an image file from your computer.
3. **Position the image**: Drag it anywhere on the page.
4. **Resize**: Drag corner/edge handles, or type exact dimensions in the right panel.
5. **Add artwork**: Use the rectangle, circle, line, and text tools in the toolbar.
6. **Lock aspect ratio**: Toggle the checkbox in the properties panel to preserve proportions.
7. **Crop**: Click "Crop Image" and trim visually or enter the amount removed from each edge.
8. **Arrange**: Shift-click items or layers for multi-selection; use the layer arrows or context menu for stacking.
9. **Export/Print**: Click "SVG" for a self-contained layered vector file, or choose 300, 600, or 1200 DPI and click "PNG" for a raster file. PNG defaults to 600 DPI.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Delete / Backspace | Delete selected image |
| Ctrl/Cmd + D | Duplicate selected items |
| Ctrl/Cmd + S | Save to localStorage |
| Ctrl/Cmd + N | New A4 document |
| Ctrl/Cmd + Z / Shift + Z | Undo / redo |
| Ctrl/Cmd + Y | Redo |
| Ctrl/Cmd + [ / ] | Send to back / bring to front |
| Arrow keys | Nudge selected items by 1 mm |
| Shift + Arrow keys | Nudge selected items by 10 mm |
| Shift + click | Add/remove an item from the selection |
| Escape | Deselect / exit crop mode |

## Printing

When you click Print, the app uses `@media print` CSS rules to hide the UI and show only the page at its physical dimensions. The browser's print dialog handles the rest. For PDF export, use your browser's "Save as PDF" option in the print dialog.

## Export SVG

The SVG export uses mm-based coordinates in the viewBox, so the exported file preserves physical dimensions. You can open it in Illustrator, Inkscape, or any SVG-compatible tool.

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

## Known Limitations

- Multi-selection supports group movement, nudging, duplication, and deletion, but not marquee selection or group resizing.
- Text uses a small browser-safe font list; custom font embedding is not available.
- Browser storage quotas still apply to local saves containing large embedded images. JSON export is the durable backup path, and quota failures are reported in the UI.
- Print margins and scaling must remain disabled in the browser print dialog; TrimKit supplies the exact CSS page size.

## License

MIT
