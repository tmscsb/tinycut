# TrimKit release review

Reviewed 5 September 2026 against the working tree, including existing rotation and toolbar work.

The tested desktop Chromium workflows pass after the fixes below. The production bundle builds successfully. This is a release candidate review, not a guarantee of defect-free behavior or a complete accessibility certification. No public deployment was performed.

## Fixes completed

- Changing paper templates now preserves artwork and supports undo. Starting a new document remains a separate action with an unsaved-changes confirmation.
- PNG export now renders text successfully using native SVG text. The editor, SVG, PNG, and print share text wrapping. PNG files record the selected 300, 600, or 1200 DPI in their density metadata.
- Print layout uses physical dimensions independently of editor zoom, including correct rotation origins for cropped images. Printing waits for fonts and images to load.
- Crop changes preserve source-image positioning when rotated. Minimum-size resizing preserves locked proportions. Group centering accounts for rotated bounds.
- The toolbar wraps across desktop, tablet, and phone widths. Project and export menus expose all file operations, including the previously missing SVG download. Buttons use a shared SVG icon set.
- Inspector controls now follow the installed DaisyUI version's layout requirements. Theme contrast, selected layers, empty-page guidance, and keyboard focus handling were improved.
- Image editing uses a figure accessibility role so its rotation control remains exposed. Dialogs and the mobile inspector manage keyboard focus.
- Text updates immediately and groups continuous typing into one undo step. Save shortcuts commit pending fields. Failed saves explain how to download a JSON backup.
- Image and project imports have size limits and clearer errors. Unsupported project versions are rejected. Asynchronous imports cannot silently overwrite concurrent edits. Undo history has a memory budget.
- Dependency lockfiles were aligned and vulnerable transitive packages updated. Verification commands, CI, MIT license text, privacy notes, and static-hosting instructions were added.

## Verification results

| Check | Result |
| --- | --- |
| Svelte and TypeScript diagnostics | 0 errors, 0 warnings |
| Node regression suite | 49 passed |
| Production build | Passed |
| Dependency audit | 0 reported vulnerabilities at review time |
| npm clean install and Bun frozen install | Passed |
| Browser image/export suite | 10 of 10 passed |
| axe WCAG A/AA checks | 20 screen states, 0 reported violations |
| Git whitespace check | Passed |

The regression suite covers crop and resize geometry, rotation snapping, group alignment, undo/redo, selection operations, persistence and quota failures, JSON validation/round-tripping, concurrent import protection, text wrapping, SVG output, and PNG metadata.

The browser suite decodes PNG, JPEG, WebP, and SVG; rejects corrupt or unsupported images; validates layered SVG with editable text; and checks PNG dimensions, density metadata, and actual image/text pixels at all three export resolutions. High-resolution tests use a small page; oversized canvas choices are disabled for larger pages.

Accessibility checks cover page, rectangle, text, image and crop inspectors, page settings, project/export menus, shortcuts, and unsaved-changes dialogs in both themes. These automated checks do not replace screen-reader and keyboard usability testing.

## Interactive and visual checks

Checked in Chromium using the development server and production preview:

- Image import, numeric cropping, rotation, dragging, edge resizing, and undo restoration.
- Rectangle, circle, line, and text creation; live text editing; multi-selection, duplication and deletion; layer controls and alignment.
- Paper templates, mm/cm units, grid/snap/guides, keyboard nudging, fit-to-page, and zoom.
- Browser save/reload, JSON import, unsaved-change protection, help, menus, themes, and mobile inspector opening/closing.
- Responsive layouts at 320, 390, 768, 1280, and 1920 CSS-pixel widths. No page-level horizontal overflow was observed in the checked layouts.
- Chrome-generated A4 portrait and A5 landscape PDFs. Both contain one page at the expected physical size, correct text and artwork, and no editor UI. A5 was checked at 200% editor zoom. Rendered PDF pages were visually inspected.

## Before the public announcement

1. Serve only `dist/` over HTTPS using the instructions in the README. Verify asset loading, caching, and file downloads at the actual public URL; no deployment target was supplied for this review.
2. Smoke-test the same project in Safari and Firefox, including SVG-to-PNG rendering and print output. This review used Chromium; those engines were not tested.
3. Check dragging, cropping, and the inspector on real iOS and Android devices. Narrow viewport layouts were checked, but physical touch hardware was not.
4. Print a measured sample on a physical printer with scaling, margins, and headers disabled. PDF dimensions were verified; printer-driver behavior was not.

Browser storage remains device- and origin-specific. Keep the JSON backup guidance visible. Font availability can affect SVG files opened elsewhere; custom font embedding is not supported.

## Reproduce the checks

```bash
npm ci
npm run verify
npm audit --audit-level=high
npm run dev
```

Open `/tests/browser.html` and `/tests/accessibility.html` and run their checks. The accessibility harness exercises both themes and adds temporary test artwork without saving it. Run it in a foreground Chrome tab so color transitions and painting settle normally. Neither test page is included in `dist/`.

Import `tests/fixtures/print.json` for a repeatable print sample. Choose A4 portrait, then A5 landscape, and inspect the resulting PDFs at 100% print scale.
