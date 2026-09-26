import assert from 'node:assert/strict';
import { escapeHtmlText } from '../src/lib/escapeHtmlText';

const untrusted = '</title><script>window.opener.alert(1)</script><img src=x onerror=alert(1)>&"\'';
const escaped = escapeHtmlText(untrusted);
assert.equal(escaped.includes('<script'), false);
assert.equal(escaped.includes('<img'), false);
assert.equal(escaped.includes('</title'), false);
assert.match(escaped, /&lt;script&gt;/);
assert.match(escaped, /&amp;&quot;&#39;$/);
console.log('Printable answer escaping passed');
