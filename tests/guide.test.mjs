import test from 'node:test';
import assert from 'node:assert/strict';
import { guideItems } from '../src/guide.mjs';
const base = { session: { topic: 'Free-form topic', material: 'Short opening concept.\n\nSupporting details and sources.', tasks: 'First learner operation\nSecond transfer operation', packages: 'Verbose installer guidance' }, phase: 'learning', rows: [{ key: 'tool', label: 'Tool', status: 'observed', evidence: 'Version evidence' }], gaps: [], selectedTask: 0, completed: [] };
const text = rows => rows.map(item => item.text).join('\n');
test('main guide displays one current step and hides full evidence/supporting wall of text', () => {
  const items = guideItems(base), view = text(items);
  assert.match(view, /Short opening concept/);
  assert.match(view, /First learner operation/);
  assert.doesNotMatch(view, /Second transfer operation|Version evidence|Supporting details|Verbose installer/);
  assert.ok(items.some(item => item.action === 'hint'));
});
test('details explicitly exposes evidence, supporting material and setup info', () => {
  const view = text(guideItems({ ...base, page: 'details' }));
  assert.match(view, /Version evidence/);
  assert.match(view, /Supporting details/);
  assert.match(view, /Verbose installer/);
});
test('steps page advances the learner action without revealing future answers', () => {
  const view = text(guideItems({ ...base, page: 'steps', selectedTask: 1 }));
  assert.match(view, /Langkah 2\/2/);
  assert.match(view, /Second transfer operation/);
  assert.doesNotMatch(view, /First learner operation/);
});
test('probe approval page preserves entire command, never hides argv behind a clipped summary', () => {
  const items = guideItems({ ...base, probePlan: [{ label: 'Check', probe: { executable: 'tool', args: ['--specific-argument', 'value'] } }] });
  assert.match(text(items), /--specific-argument/);
  assert.ok(items.some(item => item.action === 'approve'));
  assert.ok(items.some(item => item.action === 'cancel'));
});
test('large summary is bounded but full original material remains in details', () => {
  const input = { ...base, session: { ...base.session, material: 'x'.repeat(2000) } };
  assert.ok(text(guideItems(input)).length < 1500);
  assert.match(text(guideItems({ ...input, page: 'details' })), /x{2000}/);
});
