// Run: node extension/content.test.cjs
// Pure history helpers of the DeepSeek content script (no browser needed).
const assert = require('node:assert/strict');
const content = require('./content.js');

const {
  extractFinalText,
  extractHistoryMessages,
  parseToken,
  sessionIdFromUrl,
  fragmentsText,
  historyMessages,
  ensureSearchToggle,
  findSearchToggle,
  isSearchToggleOn,
} = content;
let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok   ${name}`);
}

const CODE = '```text\nline one of a long block\nline two\n```';
const user = (content_ = 'hi') => ({ message_id: 1, parent_id: null, role: 'USER', status: 'FINISHED', has_pending_fragment: false, fragments: [{ type: 'REQUEST', content: content_ }] });
const assistant = (overrides = {}) => ({
  message_id: 2,
  parent_id: 1,
  role: 'ASSISTANT',
  status: 'FINISHED',
  has_pending_fragment: false,
  incomplete_message: null,
  fragments: [{ type: 'RESPONSE', content: `Intro\n\n${CODE}\n\nQuestion?` }],
  ...overrides,
});
const history = (...messages) => ({ data: { biz_data: { chat_messages: messages } } });

test('session id comes from the chat URL', () => {
  assert.equal(sessionIdFromUrl('https://chat.deepseek.com/a/chat/s/abc-123?x=1'), 'abc-123');
  assert.equal(sessionIdFromUrl('https://chat.deepseek.com/'), null);
  assert.equal(sessionIdFromUrl(undefined), null);
});

test('token is read from JSON { value } or a raw string', () => {
  assert.equal(parseToken('{"value":"tok","__version":"0"}'), 'tok');
  assert.equal(parseToken('"quoted"'), 'quoted');
  assert.equal(parseToken('rawtoken'), 'rawtoken');
  assert.equal(parseToken('{"nope":1}'), null);
  assert.equal(parseToken(''), null);
  assert.equal(parseToken(null), null);
});

test('finished reply: returns the complete original Markdown, code blocks intact', () => {
  const result = extractFinalText(history(user(), assistant()), 0);
  assert.equal(result.status, 'done');
  assert.ok(result.text.includes(CODE));
  assert.ok(result.text.endsWith('Question?'));
});

test('pending replies are not final', () => {
  assert.equal(extractFinalText(history(user(), assistant({ status: 'WIP' })), 0).status, 'pending');
  assert.equal(extractFinalText(history(user(), assistant({ has_pending_fragment: true })), 0).status, 'pending');
  // the user message was just added; the reply does not exist yet
  assert.equal(extractFinalText(history(user()), 0).status, 'pending');
});

test('thinking fragments are excluded from the final text', () => {
  const message = assistant({
    fragments: [
      { type: 'THINK', content: 'secret reasoning' },
      { type: 'RESPONSE', content: 'Part A. ' },
      { type: 'RESPONSE', content: 'Part B.' },
    ],
  });
  const result = extractFinalText(history(user(), message), 0);
  assert.deepEqual(result, { status: 'done', text: 'Part A. Part B.' });
});

test('an old finished reply is ignored until a newer message exists (minCount)', () => {
  const old = history(user('first'), assistant());
  assert.equal(extractFinalText(old, 2).status, 'pending');
  // a new prompt was sent: user message appended, reply not there yet
  assert.equal(extractFinalText(history(user('first'), assistant(), user('second')), 2).status, 'pending');
  const fresh = history(user('first'), assistant(), user('second'), assistant({ message_id: 4, fragments: [{ type: 'RESPONSE', content: 'second answer' }] }));
  assert.deepEqual(extractFinalText(fresh, 2), { status: 'done', text: 'second answer' });
});

test('shape errors and empty finished replies are reported as errors', () => {
  assert.deepEqual(extractFinalText(null, 0), { status: 'error', reason: 'shape' });
  assert.deepEqual(extractFinalText({}, 0), { status: 'error', reason: 'shape' });
  assert.deepEqual(extractFinalText({ data: { biz_data: { chat_messages: 'x' } } }, 0), { status: 'error', reason: 'shape' });
  assert.deepEqual(extractFinalText({ data: null }, 0), { status: 'error', reason: 'shape' });
  const onlyThinking = assistant({ fragments: [{ type: 'THINK', content: 'x' }] });
  assert.deepEqual(extractFinalText(history(user(), onlyThinking), 0), { status: 'error', reason: 'empty' });
  const noFragments = assistant({ fragments: undefined });
  assert.deepEqual(extractFinalText(history(user(), noFragments), 0), { status: 'error', reason: 'empty' });
});

test('extractHistoryMessages maps roles and fragment kinds; null on bad shape', () => {
  const messages = extractHistoryMessages(history(user('hola'), assistant(), { role: 'SYSTEM', fragments: [] }));
  assert.deepEqual(messages.map((m) => m.role), ['user', 'assistant']);
  assert.equal(messages[0].content, 'hola');
  assert.ok(messages[1].content.includes(CODE));
  assert.equal(extractHistoryMessages({}), null);
});

test('helpers tolerate junk', () => {
  assert.equal(fragmentsText(null, 'RESPONSE'), '');
  assert.equal(fragmentsText({ fragments: [null, { type: 'RESPONSE', content: 5 }] }, 'RESPONSE'), '');
  assert.equal(historyMessages(undefined), null);
});


// --- T7 DeepSeek web search toggle tests --------------------------------------------------------

function createFakeToggle({
  text = 'Búsqueda inteligente',
  ariaPressed = 'false',
  className = 'f79352dc ds-toggle-button ds-toggle-button--m',
  isCandidate = true,
} = {}) {
  const el = {
    tagName: 'DIV',
    innerText: text,
    textContent: text,
    className,
    isCandidate,
    attributes: {
      'aria-pressed': ariaPressed,
      tabindex: '0',
    },
    clicks: 0,
    getAttribute(attr) {
      return this.attributes[attr] || null;
    },
    hasAttribute(attr) {
      return attr in this.attributes;
    },
    click() {
      this.clicks++;
      const current = this.attributes['aria-pressed'];
      const next = current === 'true' ? 'false' : 'true';
      this.attributes['aria-pressed'] = next;
      if (next === 'true') {
        this.className += ' ds-toggle-button--selected';
      } else {
        this.className = this.className.replace(' ds-toggle-button--selected', '');
      }
    },
  };
  return el;
}

function createFakeDoc(elements = []) {
  return {
    querySelectorAll(selector) {
      if (
        selector.includes('.ds-toggle-button') ||
        selector.includes('[role="button"]') ||
        selector.includes('div[tabindex="0"]')
      ) {
        return elements.filter((el) => el.isCandidate);
      }
      return elements;
    },
    body: { tagName: 'BODY' },
  };
}

test('search toggle: off -> click once to enable', () => {
  const toggle = createFakeToggle({ ariaPressed: 'false' });
  const doc = createFakeDoc([toggle]);

  assert.equal(isSearchToggleOn(toggle), false);
  const result = ensureSearchToggle(doc, true);

  assert.equal(result.found, true);
  assert.equal(result.clicked, true);
  assert.equal(toggle.clicks, 1);
  assert.equal(isSearchToggleOn(toggle), true);
});

test('search toggle: on -> no click (idempotent)', () => {
  const toggle = createFakeToggle({
    ariaPressed: 'true',
    className: 'f79352dc ds-toggle-button ds-toggle-button--m ds-toggle-button--selected',
  });
  const doc = createFakeDoc([toggle]);

  assert.equal(isSearchToggleOn(toggle), true);
  const result = ensureSearchToggle(doc, true);

  assert.equal(result.found, true);
  assert.equal(result.clicked, false);
  assert.equal(toggle.clicks, 0);
  assert.equal(isSearchToggleOn(toggle), true);
});

test('search toggle: missing -> no throw and emits warning callback', () => {
  const deepThinkOnly = createFakeToggle({
    text: 'Pensamiento Profundo',
    ariaPressed: 'false',
  });
  const doc = createFakeDoc([deepThinkOnly]);

  let warning = null;
  assert.doesNotThrow(() => {
    const result = ensureSearchToggle(doc, true, (msg) => {
      warning = msg;
    });
    assert.equal(result.found, false);
    assert.equal(result.clicked, false);
  });

  assert.equal(deepThinkOnly.clicks, 0);
  assert.ok(warning && warning.includes('No se encontró'));
});

test('search toggle: recognizes English label "Search" and toggles correctly', () => {
  const toggle = createFakeToggle({ text: 'Search', ariaPressed: 'false' });
  const doc = createFakeDoc([toggle]);

  const result = ensureSearchToggle(doc, true);
  assert.equal(result.found, true);
  assert.equal(result.clicked, true);
  assert.equal(toggle.clicks, 1);
});

test('ensureSearchToggle(doc, false) clicks once when ON and not when OFF', () => {
  // When ON: clicks once to turn OFF
  const toggleOn = createFakeToggle({
    text: 'Búsqueda inteligente',
    ariaPressed: 'true',
    className: 'ds-toggle-button ds-toggle-button--selected',
  });
  const docOn = createFakeDoc([toggleOn]);

  const resultOn = ensureSearchToggle(docOn, false);
  assert.equal(resultOn.found, true);
  assert.equal(resultOn.clicked, true);
  assert.equal(toggleOn.clicks, 1);
  assert.equal(isSearchToggleOn(toggleOn), false);

  // When OFF: does not click
  const toggleOff = createFakeToggle({
    text: 'Búsqueda inteligente',
    ariaPressed: 'false',
    className: 'ds-toggle-button',
  });
  const docOff = createFakeDoc([toggleOff]);

  const resultOff = ensureSearchToggle(docOff, false);
  assert.equal(resultOff.found, true);
  assert.equal(resultOff.clicked, false);
  assert.equal(toggleOff.clicks, 0);
  assert.equal(isSearchToggleOn(toggleOff), false);
});

console.log(`\n${passed} passed`);
