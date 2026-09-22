// Regression test for the note editor caret bug: a controlled
// dangerouslySetInnerHTML on the contentEditable body re-set innerHTML on every
// keystroke, collapsing the selection to offset 0 so characters prepended.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const vite = await createServer({ server: { host: '127.0.0.1', port: 5187 }, logLevel: 'error' });
await vite.listen();
const browser = await chromium.launch({
  args: ['--no-sandbox'],
  // Honour a preinstalled browser when the bundled download is unavailable.
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined
});
const results = [];

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5187/tests/note-editor.harness.html');

  const openBlankEditor = async () => {
    await page.getByRole('button', { name: 'Harness new note' }).click();
    const editor = page.getByRole('textbox', { name: 'Note body' });
    await editor.waitFor();
    return editor;
  };

  // 1. Typing characters one at a time must append, not prepend.
  let editor = await openBlankEditor();
  await editor.click();
  for (const character of 'hello') await page.keyboard.type(character, { delay: 20 });
  assert.equal((await editor.innerText()).trim(), 'hello', 'characters typed in sequence append in order');
  results.push('typing "hello" one key at a time appends left-to-right');

  // 2. The caret must stay at the end after each keystroke, not reset to 0.
  const caret = await editor.evaluate((el) => {
    const range = getSelection().getRangeAt(0);
    const probe = range.cloneRange();
    probe.selectNodeContents(el);
    probe.setEnd(range.endContainer, range.endOffset);
    return { offset: probe.toString().length, length: el.innerText.trim().length };
  });
  assert.equal(caret.offset, caret.length, 'caret rests at the end of the typed text');
  results.push(`caret offset ${caret.offset} matches text length ${caret.length}`);

  // 3. Continuing to type after a pause keeps appending.
  await page.keyboard.type(' world', { delay: 20 });
  assert.equal((await editor.innerText()).trim(), 'hello world', 'later keystrokes keep appending');
  results.push('continued typing yields "hello world"');

  // 4. Typing mid-string inserts at the caret, not at the start.
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('X', { delay: 20 });
  assert.equal((await editor.innerText()).trim(), 'helloX world', 'mid-string insert lands at the caret');
  results.push('mid-string insert lands at the caret');

  // 5. No right-to-left flow is applied to the editor or its ancestors.
  const direction = await editor.evaluate((el) => {
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.direction === 'rtl' || node.getAttribute?.('dir') === 'rtl') return 'rtl';
    }
    return 'ltr';
  });
  assert.equal(direction, 'ltr', 'no rtl direction on the editor or its ancestors');
  results.push('editor and ancestors resolve to ltr');

  // 6. Formatting still works and does not lose the typed text.
  await page.getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.type('bold', { delay: 20 });
  assert.match(await editor.innerText(), /bold/, 'bold formatting keeps appending text');
  assert.equal(await editor.evaluate((el) => el.querySelectorAll('b, strong').length > 0), true, 'bold command applied');
  results.push('bold toolbar command applies and text keeps appending');

  // 7. Opening an existing note still loads its stored HTML into the editor.
  await page.getByRole('button', { name: /Back to notes/ }).click();
  await page.getByText('Seeded note', { exact: true }).click();
  editor = page.getByRole('textbox', { name: 'Note body' });
  await editor.waitFor();
  assert.match(await editor.innerText(), /Existing body/, 'stored note html loads into the editor');
  results.push('existing note loads its saved body html');

  // 8. Typing into a loaded note also appends.
  await editor.click();
  await page.keyboard.press('End');
  await page.keyboard.type('!!', { delay: 20 });
  assert.match(await editor.innerText(), /Existing body!!/, 'typing into a loaded note appends');
  results.push('typing into a loaded note appends');

  // 9. Reopening a blank new note clears the previous body.
  await page.getByRole('button', { name: /Back to notes/ }).click();
  editor = await openBlankEditor();
  assert.equal((await editor.innerText()).trim(), '', 'a fresh note starts empty');
  results.push('a fresh note starts with an empty body');

  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(results.map((line) => `pass: ${line}`).join('\n'));
} finally {
  await browser.close();
  await vite.close();
}
