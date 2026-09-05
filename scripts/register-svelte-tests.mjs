import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { compileModule } from 'svelte/compiler';

// Test the real reactive stores, compiling runes as the application build does.
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.svelte.ts')) {
      const source = stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'));
      const compiled = compileModule(source, { filename: new URL(url).pathname, generate: 'client' });
      return { format: 'module', source: compiled.js.code, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
