const BUILD = 'v7';

const userInput = document.getElementById('user-input');
const responseArea = document.getElementById('response-area');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const settingsBtn = document.getElementById('settings-btn');
const installBtn = document.getElementById('install-btn');
const settingsModal = document.getElementById('settings-modal');
const saveSettingsBtn = document.getElementById('save-settings');
const closeSettingsBtn = document.getElementById('close-settings');
const resetDataBtn = document.getElementById('reset-data');
const divider = document.getElementById('divider');
const inputSection = document.getElementById('input-section');
const responseSection = document.getElementById('response-section');
const searchToggle = document.getElementById('search-toggle');
const searchBadge = document.getElementById('search-badge');
const providerSelect = document.getElementById('provider');
const apiUrlRow = document.getElementById('api-url-row');
const modelList = document.getElementById('model-list');
const debugPanel = document.getElementById('debug-panel');
const debugContent = document.getElementById('debug-content');
const debugBtn = document.getElementById('debug-btn');
const debugClearBtn = document.getElementById('debug-clear');

const versionTag = document.getElementById('version-tag');
const versionTagDebug = document.getElementById('version-tag-debug');
if (versionTag) versionTag.textContent = BUILD;
if (versionTagDebug) versionTagDebug.textContent = BUILD;

const GEMINI_MODELS = [
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
];

const KILO_MODELS = [
  { id: 'anthropic/claude-opus-4.7', name: 'Claude Opus 4.7' },
  { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6' },
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5' },
  { id: 'openai/gpt-5.4', name: 'GPT-5.4' },
  { id: 'openai/gpt-5.4-mini', name: 'GPT-5.4 Mini' },
  { id: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'x-ai/grok-4', name: 'Grok 4' },
  { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2' },
  { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5' },
  { id: 'kilo-auto/frontier', name: 'Auto Frontier' },
  { id: 'kilo-auto/efficient', name: 'Auto Efficient' },
  { id: 'kilo-auto/free', name: 'Auto Free' },
  { id: 'stepfun/step-3.7-flash:free', name: 'Step 3.7 Flash (Free)' },
  { id: 'openrouter/free', name: 'OpenRouter Free' },
];

const OPENAI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  { id: 'o1-mini', name: 'o1 Mini' },
];

let settings = {
  provider: 'kilo',
  apiUrl: 'https://api.kilo.ai/api/gateway/chat/completions',
  apiKey: '',
  model: 'kilo-auto/efficient',
  systemPrompt: 'You are a helpful assistant.',
};

let webSearchEnabled = false;
let messages = [];
let isStreaming = false;
let abortController = null;
let deferredPrompt = null;

function debugLog(msg, type = 'info') {
  const line = document.createElement('div');
  line.className = type;
  const time = new Date().toLocaleTimeString();
  line.textContent = `[${time}] ${msg}`;
  debugContent.appendChild(line);
  debugContent.scrollTop = debugContent.scrollHeight;
  if (type === 'error' && debugPanel.hidden) {
    debugPanel.hidden = false;
  }
}

function loadSettings() {
  try {
    const saved = localStorage.getItem('ai-chat-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      settings = { ...settings, ...parsed };
    }
    const savedSearch = localStorage.getItem('ai-chat-websearch');
    if (savedSearch !== null) webSearchEnabled = savedSearch === 'true';
  } catch (e) {
    debugLog(`loadSettings error: ${e.message}`, 'error');
  }

  providerSelect.value = settings.provider;
  document.getElementById('api-key').value = settings.apiKey;
  document.getElementById('api-url').value = settings.apiUrl;
  document.getElementById('system-prompt').value = settings.systemPrompt;
  updateModelList();
  if (!settings.model || !getModelById(settings.model)) {
    settings.model = (KILO_MODELS[0] || GEMINI_MODELS[0] || OPENAI_MODELS[0]).id;
  }
  selectModelInUI(settings.model);
  updateProviderUI();
  updateSearchUI();
  debugLog(`Build ${BUILD} loaded: provider=${settings.provider} model=${settings.model} keySet=${!!settings.apiKey}`, 'info');
}

function getModelsForProvider() {
  if (settings.provider === 'gemini') return GEMINI_MODELS;
  if (settings.provider === 'kilo') return KILO_MODELS;
  return OPENAI_MODELS;
}

function getModelById(id) {
  return getModelsForProvider().find(m => m.id === id);
}

function updateModelList() {
  const models = getModelsForProvider();
  modelList.innerHTML = '';
  models.forEach(m => {
    const row = document.createElement('label');
    row.className = 'model-row';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'model';
    radio.value = m.id;
    radio.checked = (m.id === settings.model);
    radio.addEventListener('change', () => {
      settings.model = m.id;
      debugLog(`Model selected: ${m.id}`, 'info');
    });
    const span = document.createElement('span');
    span.textContent = m.name;
    row.appendChild(radio);
    row.appendChild(span);
    modelList.appendChild(row);
  });
}

function selectModelInUI(id) {
  const radios = modelList.querySelectorAll('input[type=radio]');
  radios.forEach(r => r.checked = (r.value === id));
}

function saveSettings() {
  settings.provider = providerSelect.value;
  settings.apiKey = document.getElementById('api-key').value.trim();
  settings.apiUrl = document.getElementById('api-url').value.trim() || settings.apiUrl;
  settings.systemPrompt = document.getElementById('system-prompt').value.trim() || settings.systemPrompt;
  if (!settings.model || !getModelById(settings.model)) {
    settings.model = (KILO_MODELS[0] || GEMINI_MODELS[0] || OPENAI_MODELS[0]).id;
  }
  try {
    localStorage.setItem('ai-chat-settings', JSON.stringify(settings));
    debugLog(`Settings saved OK: model=${settings.model} provider=${settings.provider}`, 'info');
  } catch (e) {
    debugLog(`localStorage.setItem FAILED: ${e.message}`, 'error');
  }
  settingsModal.hidden = true;
}

function updateProviderUI() {
  if (settings.provider === 'openai') {
    apiUrlRow.hidden = false;
  } else {
    apiUrlRow.hidden = true;
  }
  searchToggle.style.display = settings.provider === 'gemini' ? 'flex' : 'none';
}

function updateSearchUI() {
  if (webSearchEnabled && settings.provider === 'gemini') {
    searchBadge.hidden = false;
    searchToggle.style.borderColor = 'var(--accent)';
    searchToggle.style.color = 'var(--accent)';
  } else {
    searchBadge.hidden = true;
    searchToggle.style.borderColor = 'var(--border)';
    searchToggle.style.color = 'var(--text)';
  }
}

function toggleWebSearch() {
  if (settings.provider !== 'gemini') return;
  webSearchEnabled = !webSearchEnabled;
  localStorage.setItem('ai-chat-websearch', webSearchEnabled);
  updateSearchUI();
}

function clearResponse() {
  responseArea.innerHTML = '<div class="placeholder">AI response will appear here...</div>';
  messages = [];
}

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isStreaming) return;

  if (!settings.apiKey) {
    appendMessage('Please set your API key in settings (top-right gear icon).', 'error');
    return;
  }

  if (!settings.model) {
    appendMessage('No model selected. Open settings and choose a model, then Save.', 'error');
    return;
  }

  userInput.value = '';
  autoResize();

  if (messages.length === 0) {
    responseArea.innerHTML = '';
  }

  messages.push({ role: 'user', content: text });

  const streamingEl = document.createElement('div');
  streamingEl.className = 'message streaming';
  responseArea.appendChild(streamingEl);
  responseArea.scrollTop = responseArea.scrollHeight;

  isStreaming = true;
  sendBtn.disabled = true;
  abortController = new AbortController();

  try {
    if (settings.provider === 'gemini') {
      await sendGemini(streamingEl);
    } else {
      await sendOpenAI(streamingEl);
    }
  } catch (err) {
    console.error('Full error:', err);
    debugLog(`Error name: ${err.name}`, 'error');
    debugLog(`Error message: ${err.message}`, 'error');
    debugLog(`Provider: ${settings.provider} URL: ${settings.apiUrl} Model: ${settings.model}`, 'error');
    if (err.name === 'AbortError') {
      streamingEl.classList.remove('streaming');
      if (!streamingEl.textContent) streamingEl.textContent = '(Cancelled)';
    } else {
      streamingEl.classList.remove('streaming');
      streamingEl.classList.add('error');
      streamingEl.textContent = `Error: ${err.message}`;
      responseArea.scrollTop = responseArea.scrollHeight;
    }
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
    abortController = null;
  }
}

async function sendGemini(streamingEl) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:streamGenerateContent?key=${settings.apiKey}&alt=sse`;
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : m.role,
    parts: [{ text: m.content }],
  }));
  const body = {
    contents,
    systemInstruction: settings.systemPrompt ? { parts: [{ text: settings.systemPrompt }] } : undefined,
  };
  if (webSearchEnabled) body.tools = [{ googleSearch: {} }];

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: abortController.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini API ${res.status}: ${err.error?.message || res.statusText}`);
  }
  await readSSE(res, streamingEl, (parsed) => parsed.candidates?.[0]?.content?.parts?.[0]?.text);
}

async function sendOpenAI(streamingEl) {
  const url = settings.apiUrl;
  debugLog(`POST ${url} model=${settings.model}`, 'info');

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: settings.systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
      signal: abortController.signal,
    });
  } catch (fetchErr) {
    debugLog(`Fetch failed: ${fetchErr.message}`, 'error');
    throw new Error(`Network error: ${fetchErr.message}`);
  }

  debugLog(`Response: ${res.status} ${res.statusText}`, res.ok ? 'info' : 'error');
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status} ${res.statusText}: ${err}`);
  }
  await readSSE(res, streamingEl, (parsed) => parsed.choices?.[0]?.delta?.content);
}

async function readSSE(res, streamingEl, extractText) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') break;
      try {
        const parsed = JSON.parse(data);
        const text = extractText(parsed);
        if (text) {
          fullText += text;
          streamingEl.textContent = fullText;
          responseArea.scrollTop = responseArea.scrollHeight;
        }
      } catch (e) {}
    }
  }
  streamingEl.classList.remove('streaming');
  if (fullText) {
    messages.push({ role: 'assistant', content: fullText });
  } else {
    streamingEl.textContent = '(No response received)';
    streamingEl.classList.add('error');
  }
}

function appendMessage(text, type = '') {
  const el = document.createElement('div');
  el.className = `message ${type}`;
  el.textContent = text;
  responseArea.appendChild(el);
  responseArea.scrollTop = responseArea.scrollHeight;
}

function autoResize() {
  userInput.style.height = 'auto';
  userInput.style.height = userInput.scrollHeight + 'px';
}

// Divider drag-to-resize
divider.addEventListener('mousedown', (e) => {
  const startY = e.clientY;
  const startInputHeight = inputSection.offsetHeight;
  const startResponseHeight = responseSection.offsetHeight;
  divider.classList.add('dragging');
  document.body.style.cursor = 'row-resize';
  document.body.style.userSelect = 'none';
  e.preventDefault();

  function onMove(ev) {
    const dy = ev.clientY - startY;
    const containerHeight = document.getElementById('resizable-container').offsetHeight;
    const totalHeight = startInputHeight + startResponseHeight;
    let newInputHeight = startInputHeight + dy;
    let newResponseHeight = startResponseHeight - dy;
    const minHeight = 80;
    if (newInputHeight < minHeight) { newInputHeight = minHeight; newResponseHeight = totalHeight - minHeight; }
    if (newResponseHeight < minHeight) { newResponseHeight = minHeight; newInputHeight = totalHeight - minHeight; }
    const inputPercent = (newInputHeight / containerHeight) * 100;
    const responsePercent = (newResponseHeight / containerHeight) * 100;
    inputSection.style.flex = `1 1 ${inputPercent}%`;
    responseSection.style.flex = `1 1 ${responsePercent}%`;
  }
  function onUp() {
    divider.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});

divider.addEventListener('touchstart', (e) => {
  const startY = e.touches[0].clientY;
  const startInputHeight = inputSection.offsetHeight;
  const startResponseHeight = responseSection.offsetHeight;
  divider.classList.add('dragging');
  e.preventDefault();

  function onMove(ev) {
    const dy = ev.touches[0].clientY - startY;
    const containerHeight = document.getElementById('resizable-container').offsetHeight;
    const totalHeight = startInputHeight + startResponseHeight;
    let newInputHeight = startInputHeight + dy;
    let newResponseHeight = startResponseHeight - dy;
    const minHeight = 80;
    if (newInputHeight < minHeight) { newInputHeight = minHeight; newResponseHeight = totalHeight - minHeight; }
    if (newResponseHeight < minHeight) { newResponseHeight = minHeight; newInputHeight = totalHeight - minHeight; }
    const inputPercent = (newInputHeight / containerHeight) * 100;
    const responsePercent = (newResponseHeight / containerHeight) * 100;
    inputSection.style.flex = `1 1 ${inputPercent}%`;
    responseSection.style.flex = `1 1 ${responsePercent}%`;
  }
  function onEnd() {
    divider.classList.remove('dragging');
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
  }
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
});

// Events
sendBtn.addEventListener('click', sendMessage);
clearBtn.addEventListener('click', clearResponse);
searchToggle.addEventListener('click', toggleWebSearch);

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

userInput.addEventListener('input', autoResize);

providerSelect.addEventListener('change', () => {
  settings.provider = providerSelect.value;
  let def = 'kilo-auto/efficient';
  if (settings.provider === 'gemini') def = 'gemini-2.5-flash';
  else if (settings.provider === 'openai') def = 'gpt-4o-mini';
  settings.model = def;
  updateModelList();
  updateProviderUI();
  updateSearchUI();
});

settingsBtn.addEventListener('click', () => {
  updateModelList();
  selectModelInUI(settings.model);
  settingsModal.hidden = false;
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.hidden = true;
});

saveSettingsBtn.addEventListener('click', saveSettings);

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.hidden = true;
});

resetDataBtn.addEventListener('click', async () => {
  if (!confirm('Clear all saved data and reload?')) return;
  localStorage.removeItem('ai-chat-settings');
  localStorage.removeItem('ai-chat-websearch');
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  location.reload(true);
});

debugBtn.addEventListener('click', () => {
  debugPanel.hidden = !debugPanel.hidden;
});
debugClearBtn.addEventListener('click', () => { debugContent.innerHTML = ''; });

// PWA install
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

// Self-destruct any old service worker and clear its caches so the user
// always gets the latest app.js. Then never register a new one.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    for (const r of regs) r.unregister();
  });
  if ('caches' in window) {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
}

// Init
loadSettings();
autoResize();
