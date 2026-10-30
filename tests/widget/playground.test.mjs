import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const directory = new URL('../../server/SiteChat.Api/wwwroot/', import.meta.url);
const html = readFileSync(new URL('index.html', directory), 'utf8');
const widgetCode = readFileSync(new URL('widget/sitechat.js', directory), 'utf8');
const playgroundCode = readFileSync(new URL('playground.js', directory), 'utf8');

test('copied installation snippet preserves configured welcome and accent on an unrelated host', async () => {
  const demo = new JSDOM(html, { url: 'https://bot.example/', runScripts: 'outside-only', pretendToBeVisual: true });
  demo.window.fetch = async () => ({ ok: true, json: async () => ({ reply: 'Hi' }) });
  demo.window.eval(widgetCode); demo.window.eval(playgroundCode);
  demo.window.document.dispatchEvent(new demo.window.Event('DOMContentLoaded'));
  const doc = demo.window.document;
  doc.querySelector('#bot-name').value = 'Alba';
  doc.querySelector('#welcome-message').value = 'A custom welcome <safe>';
  doc.querySelector('#accent-color').value = '#2457D6';
  doc.querySelector('#bot-name').dispatchEvent(new demo.window.Event('input'));
  await new Promise(resolve => setTimeout(resolve, 350));
  const snippet = doc.querySelector('#install-snippet').textContent;
  assert.ok(snippet.includes('script defer'));
  const website = new JSDOM(`<!doctype html><body>${snippet}</body>`, { url: 'https://unrelated.example/', runScripts: 'outside-only', pretendToBeVisual: true });
  website.window.eval(widgetCode);
  const host = website.window.document.querySelector('[data-sitechat-widget]');
  assert.equal(host.shadowRoot.querySelector('.sc-title').textContent, 'Alba');
  assert.ok(host.shadowRoot.textContent.includes('A custom welcome <safe>'));
  assert.equal(host.style.getPropertyValue('--sc-accent'), '#2457D6');
  assert.equal(website.window.document.querySelector('script').src, 'https://bot.example/widget/sitechat.js');
  website.window.close(); demo.window.close();
});
