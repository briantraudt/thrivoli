import assert from 'node:assert/strict';
export const words = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(words).join('') : node?.children?.map(words).join('') ?? '';
export const rows = renderer => renderer.root.findAllByProps({className:'ced-item ced-compact-row'});
export const category = (renderer, name) => rows(renderer).find(row => words(row.findByType('dt')).startsWith(name));
export const amount = (renderer, name) => { const row = category(renderer, name); assert.ok(row, `Missing category ${name}`); return words(row.findByType('dd')); };
export function assertCompact(renderer) {
  for (const type of ['details','summary','table','p']) assert.equal(renderer.root.findAllByType(type).length,0,`${type} must not appear in compact dashboard`);
  for (const row of rows(renderer)) { assert.equal(row.findAllByType('button').length,0); assert.equal(row.findAllByType('a').length,0); assert.equal(row.findAllByType('dt').length,1); assert.equal(row.findAllByType('dd').length,1); }
  assert.equal(renderer.root.findAllByProps({className:'csd-totals'})[0].findAllByType('article').length,3);
}
