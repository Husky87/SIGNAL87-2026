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

  // 10. Toolbar: fonts, sizes, underline/strike, colour, highlight, checklist.
  const selectAll = () => editor.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  });
  await editor.click();
  await page.keyboard.type('Styled words here', { delay: 10 });
  await selectAll();
  await page.getByRole('combobox', { name: 'Font' }).selectOption('serif');
  await selectAll();
  await page.getByRole('combobox', { name: 'Text size' }).selectOption('5');
  await selectAll();
  await page.getByRole('button', { name: 'Underline' }).click();
  await page.getByRole('button', { name: 'Strikethrough' }).click();
  await page.getByRole('button', { name: 'Highlight' }).click();
  await page.getByRole('button', { name: 'Text color' }).click();
  await page.getByRole('menuitem', { name: 'Blue' }).click();
  const styled = await editor.evaluate((el) => el.innerHTML);
  assert.match(styled, /face="Georgia, serif"/, 'font family applied');
  assert.match(styled, /size="5"/, 'font size applied');
  assert.match(styled, /<u>/, 'underline applied');
  assert.match(styled, /<(s|strike)[\s>]/, 'strikethrough applied');
  assert.match(styled, /background-color/, 'highlight applied');
  assert.match(styled, /color="#1a73e8"|color: rgb\(26, 115, 232\)/, 'text colour applied');
  assert.match(await editor.innerText(), /Styled words here/, 'formatting keeps the text');
  results.push('font, size, underline, strikethrough, highlight and colour apply to a selection');

  // 11. Word count and autosave status.
  const footer = page.getByText(/^\d+ words?$/);
  assert.equal(await footer.innerText(), '3 words', 'word count reflects the body');
  await page.getByText('Saved', { exact: true }).waitFor({ timeout: 3000 });
  results.push('footer shows the word count and "Saved" after autosave');

  // 12. Keyboard shortcuts and checklist.
  await editor.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  });
  await page.keyboard.press('Enter');
  await page.keyboard.type('task one', { delay: 10 });
  await page.getByRole('button', { name: 'Checklist' }).click();
  const checklistItem = editor.locator('ul[data-checklist="true"] > li', { hasText: 'task one' });
  assert.equal(await checklistItem.getAttribute('data-checked'), 'false', 'checklist item starts unchecked');
  const box = await checklistItem.boundingBox();
  await page.mouse.click(box.x + 6, box.y + 16);
  assert.equal(await checklistItem.getAttribute('data-checked'), 'true', 'clicking the box checks the item');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('task two', { delay: 10 });
  assert.equal(await editor.locator('li', { hasText: 'task two' }).getAttribute('data-checked'), 'false', 'a new checklist item starts unchecked');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+Shift+Digit7`);
  await page.keyboard.type('numbered', { delay: 10 });
  assert.equal(await editor.locator('ol li', { hasText: 'numbered' }).count(), 1, 'Mod+Shift+7 starts a numbered list');
  results.push('checklist toggles, new items start unchecked, Mod+Shift+7 starts a numbered list');

  // 13. Links: Mod+K prompts, the link opens in a new tab, and it survives a save.
  await page.keyboard.press('Enter');
  page.once('dialog', (dialog) => dialog.accept('example.com'));
  await page.keyboard.press(`${mod}+k`);
  const link = editor.locator('a[href="https://example.com"]');
  assert.equal(await link.count(), 1, 'Mod+K inserts a link');
  assert.equal(await link.getAttribute('target'), '_blank', 'links open in a new tab');
  await page.getByRole('button', { name: /Save note/ }).click();

  // 14. The list preview is plain text, and a reopened note keeps its formatting.
  const listText = await page.locator('button', { hasText: 'Untitled Note' }).first().innerText();
  assert.doesNotMatch(listText, /</, 'list preview has no markup');
  await page.locator('button', { hasText: 'Untitled Note' }).first().click();
  editor = page.getByRole('textbox', { name: 'Note body' });
  await editor.waitFor();
  const reopened = await editor.evaluate((el) => el.innerHTML);
  for (const pattern of [/face="Georgia, serif"/, /<u>/, /data-checklist="true"/, /data-checked="true"/, /href="https:\/\/example.com" target="_blank" rel="noopener noreferrer"/]) {
    assert.match(reopened, pattern, `saved html keeps ${pattern}`);
  }
  results.push('links get target=_blank; saved html keeps fonts, underline, checklist and links; list preview is plain');

  // 15. The sanitizer drops unsafe markup from stored bodies.
  await page.getByRole('button', { name: /Back to notes/ }).click();
  await page.getByRole('button', { name: 'Harness unsafe note' }).click();
  await page.getByText('Unsafe note', { exact: true }).click();
  editor = page.getByRole('textbox', { name: 'Note body' });
  await editor.waitFor();
  const cleaned = await editor.evaluate((el) => el.innerHTML);
  assert.doesNotMatch(cleaned, /javascript:|onerror|<img|url\(/i, 'unsafe markup removed');
  assert.match(cleaned, /safe text/, 'text content kept');
  results.push('unsafe links, handlers and style urls are stripped from stored html');

  // 16. Mod+B / I / U toggle inline styles in a plain note.
  await page.getByRole('button', { name: /Back to notes/ }).click();
  editor = await openBlankEditor();
  await editor.click();
  await page.keyboard.type('plain ', { delay: 10 });
  for (const [key, tag] of [['b', 'b'], ['i', 'i'], ['u', 'u']]) {
    await page.keyboard.press(`${mod}+${key}`);
    await page.keyboard.type(`${key}x`, { delay: 10 });
    await page.keyboard.press(`${mod}+${key}`);
    assert.equal(await editor.locator(tag, { hasText: `${key}x` }).count(), 1, `Mod+${key.toUpperCase()} applies <${tag}>`);
  }
  results.push('Mod+B, Mod+I and Mod+U apply bold, italic and underline');

  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(results.map((line) => `pass: ${line}`).join('\n'));
} finally {
  await browser.close();
  await vite.close();
}
