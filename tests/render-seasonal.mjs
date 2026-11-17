import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const output = mkdtempSync(join(tmpdir(), 'pinlabs-render-check-'));
try {
  execFileSync(join(root,'node_modules/.bin/vite'), ['build','--ssr','tests/seasonal-render.tsx','--outDir',output], {cwd:root,stdio:'inherit'});
  writeFileSync(join(output,'package.json'), '{"type":"module"}');
  symlinkSync(join(root,'node_modules'),join(output,'node_modules'),'dir');
  execFileSync(process.execPath,[join(output,'seasonal-render.js')],{cwd:root,stdio:'inherit'});
} finally { rmSync(output,{recursive:true,force:true}); }
