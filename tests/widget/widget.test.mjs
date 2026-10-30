import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const code = readFileSync(new URL('../../server/SiteChat.Api/wwwroot/widget/sitechat.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setTimeout(resolve, 15));
function fixture(manual = true) {
  const dom = new JSDOM(`<!doctype html><html><body><p id="host-content">Website</p><script src="https://bot.example/widget/sitechat.js" data-site-id="demo" ${manual ? 'data-manual="true"' : ''}></script></body></html>`, { url: 'https://website.example', runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.fetch = async () => ({ ok: true, status: 200, json: async () => ({ reply: 'Reply' }) });
  dom.window.eval(code);
  return dom;
}
function mount(dom, options = {}) {
  const api = dom.window.SiteChat.init({ siteId: 'demo', ...options });
  const host = dom.window.document.querySelector('[data-sitechat-widget]');
  return { api, host, root: host.shadowRoot };
}
function send(dom, root, value) {
  root.querySelector('.sc-input').value = value;
  root.querySelector('.sc-composer').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
}

test('manual mode exposes SDK without adding a widget', () => {
  const dom = fixture();
  assert.equal(typeof dom.window.SiteChat.init, 'function');
  assert.equal(dom.window.document.querySelector('[data-sitechat-widget]'), null);
  dom.window.close();
});
test('floating widget uses shadow styling and accessible lifecycle', () => {
  const dom = fixture(); const { api, host, root } = mount(dom, { botName: 'Alba', position: 'left', accentColor: '#abc' });
  assert.equal(root.querySelector('link').href, 'https://bot.example/widget/sitechat.css');
  assert.equal(root.querySelector('.sc-title').textContent, 'Alba');
  assert.equal(host.style.getPropertyValue('--sc-accent'), '#AABBCC');
  assert.ok(root.querySelector('.sc-left')); assert.equal(root.querySelector('.sc-panel').hidden, true);
  api.open(); assert.equal(root.querySelector('.sc-panel').hidden, false);
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
  assert.equal(root.querySelector('.sc-panel').hidden, true);
  assert.equal(root.querySelector('.sc-launcher').getAttribute('aria-expanded'), 'false');
  assert.equal(dom.window.document.querySelector('#host-content').textContent, 'Website');
  api.destroy(); assert.equal(dom.window.document.querySelector('[data-sitechat-widget]'), null); dom.window.close();
});
test('auto initialization derives API from bot script, not host website', async () => {
  const dom = fixture(false); let endpoint; let body;
  dom.window.fetch = async (url, options) => { endpoint = url; body = JSON.parse(options.body); return { ok: true, json: async () => ({ reply: 'Hi' }) }; };
  const root = dom.window.document.querySelector('[data-sitechat-widget]').shadowRoot;
  send(dom, root, 'Hello'); await settle();
  assert.equal(endpoint, 'https://bot.example/api/chat');
  assert.equal(body.siteId, 'demo'); assert.deepEqual(body.messages, [{ role: 'user', content: 'Hello' }]); dom.window.close();
});
test('reply HTML is text, never executable markup', async () => {
  const dom = fixture(); const { root } = mount(dom);
  const reply = '<img src=x onerror="alert(1)"><script>bad()</script>';
  dom.window.fetch = async () => ({ ok: true, json: async () => ({ reply }) });
  send(dom, root, 'Hello'); await settle();
  assert.ok(root.textContent.includes(reply)); assert.equal(root.querySelector('img'), null); assert.equal(root.querySelector('script'), null); dom.window.close();
});
test('pending state blocks duplicate requests and shows typing', async () => {
  const dom = fixture(); const { root } = mount(dom); let complete; let calls = 0;
  dom.window.fetch = () => { calls++; return new Promise(resolve => { complete = resolve; }); };
  send(dom, root, 'Hello'); send(dom, root, 'Duplicate'); await settle();
  assert.equal(calls, 1); assert.equal(root.querySelector('.sc-input').disabled, true); assert.ok(root.querySelector('.sc-typing'));
  complete({ ok: true, json: async () => ({ reply: 'Hi' }) }); await settle();
  assert.equal(root.querySelector('.sc-input').disabled, false); assert.equal(root.querySelector('.sc-typing'), null); dom.window.close();
});
test('failed turn restores input and retry does not duplicate history', async () => {
  const dom = fixture(); const { root } = mount(dom); let calls = 0; const bodies = [];
  dom.window.fetch = async (_, options) => { bodies.push(JSON.parse(options.body)); calls++; if (calls === 1) return { ok: false, status: 502, json: async () => ({ error: { message: 'Please retry.' } }) }; return { ok: true, json: async () => ({ reply: 'Recovered' }) }; };
  send(dom, root, 'Hello'); await settle();
  assert.equal(root.querySelector('.sc-input').value, 'Hello'); assert.equal(root.querySelector('.sc-send').textContent, 'Retry');
  send(dom, root, 'Hello'); await settle();
  assert.equal(bodies[1].messages.length, 1); assert.equal(root.querySelectorAll('[data-role="user"]').length, 1); assert.ok(root.textContent.includes('Recovered')); dom.window.close();
});
test('context remains bounded and starts and ends with user', async () => {
  const dom = fixture(); const { root } = mount(dom); const bodies = [];
  dom.window.fetch = async (_, options) => { bodies.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ reply: 'a'.repeat(2000) }) }; };
  for (let i = 0; i < 12; i++) { send(dom, root, String(i).padEnd(2000, 'x')); await settle(); }
  for (const { messages } of bodies) {
    assert.ok(messages.length <= 20); assert.equal(messages[0].role, 'user'); assert.equal(messages.at(-1).role, 'user');
    assert.ok(messages.reduce((n,m) => n + m.content.length, 0) <= 12000);
    messages.forEach((m,i) => assert.equal(m.role, i % 2 ? 'assistant' : 'user'));
  }
  dom.window.close();
});
test('reinitialization replaces old instance and clears DOM listeners', () => {
  const dom = fixture(); const first = mount(dom); first.api.open(); const second = mount(dom, { botName: 'New bot' });
  assert.equal(first.host.isConnected, false); assert.equal(dom.window.document.querySelectorAll('[data-sitechat-widget]').length, 1);
  assert.equal(second.root.querySelector('.sc-title').textContent, 'New bot'); first.api.destroy(); assert.equal(second.host.isConnected, true); dom.window.close();
});
test('inline preview is always open and does not add launcher', () => {
  const dom = fixture(); const container = dom.window.document.createElement('div'); dom.window.document.body.appendChild(container);
  const { root, api } = mount(dom, { container }); assert.equal(root.querySelector('.sc-panel').hidden, false);
  assert.equal(root.querySelector('.sc-launcher'), null); api.close(); assert.equal(root.querySelector('.sc-panel').hidden, false); dom.window.close();
});
test('unsafe endpoint and accent values disable sending', () => {
  const dom = fixture(); const { root } = mount(dom, { endpoint: 'javascript:alert(1)', accentColor: 'url(evil)' });
  assert.equal(root.querySelector('.sc-send').disabled, true); assert.ok(root.querySelector('.sc-status').textContent.includes('endpoint')); dom.window.close();
});
test('existing unrelated global is preserved', () => {
  const dom = new JSDOM('<body></body>', { url: 'https://website.example', runScripts: 'outside-only' });
  const existing = { application: true }; dom.window.SiteChat = existing; dom.window.console.warn = () => {}; dom.window.eval(code);
  assert.equal(dom.window.SiteChat, existing); dom.window.close();
});
