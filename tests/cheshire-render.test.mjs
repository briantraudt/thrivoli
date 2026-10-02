import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

test("dashboard renders verified source and all missing/access states without invented financial values", async () => {
  const cache = fileURLToPath(
    new URL("../node_modules/.cache/", import.meta.url),
  );
  await mkdir(cache, { recursive: true });
  const dir = await mkdtemp(`${cache}/cheshire-render-`);
  try {
    await build({
      stdin: {
        contents: `
      import React from 'react';
      import {renderToStaticMarkup} from 'react-dom/server';
      import {CheshireFinanceDashboardView} from './src/cheshire/CheshireFinanceDashboardView';
      import {LOCATIONS,CATEGORIES,parseFinanceSnapshot} from './src/cheshire/finance';
      export function render(state, amount='100') {
        const snapshot=state==='ready'?parseFinanceSnapshot({source_name:'Synthetic test fixture',cadence:'monthly',effective_month:null,imported_at:'2026-10-01T12:00:00Z',overhead_rows:LOCATIONS.flatMap((location,index)=>CATEGORIES.map((category,row)=>({location,category,sourceCell:String.fromCharCode(68+index)+(row+5),amount})))}):null;
        return renderToStaticMarkup(<CheshireFinanceDashboardView snapshot={snapshot} state={state} onRefresh={()=>{}}/>);
      }
    `,
        resolveDir: fileURLToPath(new URL("../", import.meta.url)),
        loader: "tsx",
      },
      outfile: `${dir}/render.mjs`,
      bundle: true,
      packages: "external",
      platform: "node",
      format: "esm",
      loader: { ".css": "empty" },
      define: { "import.meta.env": "{}" },
      jsx: "automatic",
      logLevel: "silent",
    });
    const { render } = await import(pathToFileURL(`${dir}/render.mjs`));
    const ready = render("ready");
    assert.match(ready, /\$14,000\.00/);
    assert.match(ready, /Month to confirm/);
    assert.match(ready, /Not yet available/);
    assert.match(ready, /140 of 140/);
    assert.match(ready, /Profitability by location, scrollable spreadsheet/);
    assert.match(ready, /All-source subtotal/);
    for (const name of ["Cheshire", "Cromwell", "Guilford", "Meriden", "Orange", "Pool", "Torrington"])
      assert.match(ready, new RegExp(`Upload Insurance payments · ${name}`));
    for (const state of ["loading", "no-access", "empty", "error"]) {
      const html = render(state);
      assert.doesNotMatch(
        html,
        /\$14,000\.00|\$2,000\.00|Synthetic test fixture/,
      );
      assert.match(html, /role="status"/);
      assert.match(html, /Not yet available/);
    }
    const blank = render("ready", null);
    assert.match(blank, /140 blank cells remain unknown/);
    assert.doesNotMatch(blank, /<strong>\$0\.00<\/strong>/);
    const zero = render("ready", "0");
    assert.match(zero, /<strong>\$0\.00<\/strong>/);
    assert.match(zero, /Not yet available/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

