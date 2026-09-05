<script lang="ts">
  const paths = {
    "rectangle": "M4 5h16v14H4z",
    "circle": "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    "line": "M5 19 19 5",
    "text": "M4 5h16M12 5v14M8 19h8",
    "image": "M4 3h16v18H4z M4 15l5-5 11 11 M15 7h.01",
    "undo": "M3 4v6h6 M3 10a8 8 0 1 1 2 8",
    "redo": "M21 4v6h-6 M21 10a8 8 0 1 0-2 8",
    "plus": "M12 5v14M5 12h14",
    "minus": "M5 12h14",
    "fit": "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5 M8 8h8v8H8z",
    "save": "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2 M7 3v6h10V3 M7 21v-8h10v8",
    "download": "M12 3v12m-5-5 5 5 5-5 M5 16v5h14v-5",
    "chevron": "m8 10 4 4 4-4",
    "sun": "M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    "moon": "M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10",
    "help": "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    "keyboard": "M3 5h18v14H3z M7 9h.01M11 9h.01M15 9h.01M18 9h.01M7 13h.01M11 13h.01M15 13h3M7 16h8",
    "close": "m6 6 12 12M6 18 18 6",
    "up": "m6 10 6-6 6 6M12 4v16",
    "down": "m6 14 6 6 6-6M12 4v16",
    "copy": "M9 9h12v12H9z M15 5V3H3v12h2",
    "trash": "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
    "center-x": "M12 3v18M4 8h4v8H4zM16 8h4v8h-4z",
    "center-y": "M3 12h18M8 4h8v4H8zM8 16h8v4H8z",
    "print": "M6 9V3h12v6M6 18H3V9h18v9h-3M6 14h12v7H6z",
    "file": "M14 2H4v20h16V8zM14 2v6h6",
    "folder": "M3 5h6l2 3h10v12H3z",
    "shield": "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z m-4 9 3 3 5-6"
} as const;
  let { name, size = 18 }: { name: keyof typeof paths; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="shrink-0"><path d={paths[name]} /></svg>
