import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { markdownToHtml } from './markdown.js';

describe('markdownToHtml', () => {
  it('converts headings', () => {
    assert.equal(markdownToHtml('# Hello'), '<h1>Hello</h1>');
    assert.equal(markdownToHtml('## World'), '<h2>World</h2>');
    assert.equal(markdownToHtml('### Three'), '<h3>Three</h3>');
    assert.equal(markdownToHtml('###### Six'), '<h6>Six</h6>');
  });

  it('converts bold text', () => {
    assert.equal(markdownToHtml('**bold**'), '<p><strong>bold</strong></p>');
    assert.equal(markdownToHtml('__bold__'), '<p><strong>bold</strong></p>');
  });

  it('converts italic text', () => {
    assert.equal(markdownToHtml('*italic*'), '<p><em>italic</em></p>');
    assert.equal(markdownToHtml('_italic_'), '<p><em>italic</em></p>');
  });

  it('converts inline code', () => {
    assert.equal(markdownToHtml('use `console.log`'), '<p>use <code>console.log</code></p>');
  });

  it('converts code blocks', () => {
    const md = '```js\nconst x = 1;\n```';
    const html = markdownToHtml(md);
    assert.ok(html.includes('<pre><code class="language-js">'));
    assert.ok(html.includes('const x = 1;'));
  });

  it('converts links', () => {
    const html = markdownToHtml('[Google](https://google.com)');
    assert.ok(html.includes('<a href="https://google.com">Google</a>'));
  });

  it('converts images', () => {
    const html = markdownToHtml('![alt](pic.png)');
    assert.ok(html.includes('<img src="pic.png" alt="alt">'));
  });

  it('converts unordered lists', () => {
    const md = '- one\n- two\n- three';
    const html = markdownToHtml(md);
    assert.ok(html.includes('<ul>'));
    assert.ok(html.includes('<li>one</li>'));
    assert.ok(html.includes('<li>two</li>'));
    assert.ok(html.includes('<li>three</li>'));
  });

  it('converts ordered lists', () => {
    const md = '1. first\n2. second';
    const html = markdownToHtml(md);
    assert.ok(html.includes('<ol>'));
    assert.ok(html.includes('<li>first</li>'));
    assert.ok(html.includes('<li>second</li>'));
  });

  it('converts blockquotes', () => {
    const html = markdownToHtml('> quoted text');
    assert.ok(html.includes('<blockquote>'));
    assert.ok(html.includes('quoted text'));
  });

  it('converts horizontal rules', () => {
    assert.ok(markdownToHtml('---').includes('<hr>'));
    assert.ok(markdownToHtml('***').includes('<hr>'));
    assert.ok(markdownToHtml('___').includes('<hr>'));
  });

  it('converts paragraphs', () => {
    assert.equal(markdownToHtml('Hello world'), '<p>Hello world</p>');
  });

  it('handles multiple paragraphs', () => {
    const md = 'First para\n\nSecond para';
    const html = markdownToHtml(md);
    assert.ok(html.includes('<p>First para</p>'));
    assert.ok(html.includes('<p>Second para</p>'));
  });

  it('escapes HTML in input', () => {
    const html = markdownToHtml('<script>alert("xss")</script>');
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });

  it('throws on non-string input', () => {
    assert.throws(() => markdownToHtml(42), { message: 'Input must be a string' });
    assert.throws(() => markdownToHtml(null), { message: 'Input must be a string' });
  });

  it('handles empty string', () => {
    assert.equal(markdownToHtml(''), '');
  });
});

describe('POST /api/markdown', () => {
  let server;
  let baseUrl;

  it('setup server', async () => {
    const { createApp } = await import('./server.js');
    server = createApp();
    await new Promise((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  it('returns 200 with HTML for valid markdown', async () => {
    const res = await fetch(`${baseUrl}/api/markdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: '# Test' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.html, '<h1>Test</h1>');
  });

  it('returns 400 when markdown field is missing', async () => {
    const res = await fetch(`${baseUrl}/api/markdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('markdown'));
  });

  it('returns 405 for GET', async () => {
    const res = await fetch(`${baseUrl}/api/markdown`);
    assert.equal(res.status, 405);
  });

  it('serves markdown preview page', async () => {
    const res = await fetch(`${baseUrl}/markdown`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Markdown Preview'));
  });

  it('cleanup server', async () => {
    await new Promise((resolve) => server.close(resolve));
  });
});
