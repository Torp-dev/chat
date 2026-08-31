const userInput = document.getElementById('user-input');
const responseArea = document.getElementById('response-area');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const settingsBtn = document.getElementById('settings-btn');
const installBtn = document.getElementById('install-btn');
const settingsModal = document.getElementById('settings-modal');
const saveSettingsBtn = document.getElementById('save-settings');
const closeSettingsBtn = document.getElementById('close-settings');
const divider = document.getElementById('divider');
const inputSection = document.getElementById('input-section');
const responseSection = document.getElementById('response-section');
const searchToggle = document.getElementById('search-toggle');
const searchBadge = document.getElementById('search-badge');
const providerSelect = document.getElementById('provider');
const apiUrlRow = document.getElementById('api-url-row');
const modelSelect = document.getElementById('model');

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

function loadSettings() {
  const saved = localStorage.getItem('ai-chat-settings');
  if (saved) {
    settings = { ...settings, ...JSON.parse(saved) };
  }
  const savedSearch = localStorage.getItem('ai-chat-websearch');
  if (savedSearch !== null) webSearchEnabled = savedSearch === 'true';

  providerSelect.value = settings.provider;
  document.getElementById('api-key').value = settings.apiKey;
  document.getElementById('api-url').value = settings.apiUrl;
  document.getElementById('system-prompt').value = settings.systemPrompt;
  updateModelOptions();
  modelSelect.value = settings.model;
  updateProviderUI();
  updateSearchUI();
}

function saveSettings() {
  settings.provider = providerSelect.value;
  settings.apiKey = document.getElementById('api-key').value.trim();
  settings.apiUrl = document.getElementById('api-url').value.trim() || settings.apiUrl;
  settings.model = modelSelect.value;
  settings.systemPrompt = document.getElementById('system-prompt').value.trim() || settings.systemPrompt;
  localStorage.setItem('ai-chat-settings', JSON.stringify(settings));
  settingsModal.hidden = true;
}

function updateModelOptions() {
  modelSelect.innerHTML = '';
  let models;
  if (settings.provider === 'gemini') {
    models = GEMINI_MODELS;
  } else if (settings.provider === 'kilo') {
    models = KILO_MODELS;
  } else {
    models = OPENAI_MODELS;
  }
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    modelSelect.appendChild(opt);
  });
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
    if (err.name === 'AbortError') {
      streamingEl.classList.remove('streaming');
      if (!streamingEl.textContent) streamingEl.textContent = '(Cancelled)';
    } else {
      streamingEl.classList.remove('streaming');
      streamingEl.classList.add('error');
      streamingEl.textContent = `Error: ${err.message}`;
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

  if (webSearchEnabled) {
    body.tools = [{ googleSearch: {} }];
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: abortController.signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini API error ${res.status}: ${err.error?.message || res.statusText}`);
  }

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

      try {
        const parsed = JSON.parse(data);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
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

async function sendOpenAI(streamingEl) {
  const res = await fetch(settings.apiUrl, {
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

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
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
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

// Touch support for divider
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
  updateModelOptions();
  updateProviderUI();
  updateSearchUI();
  if (settings.provider === 'gemini') {
    modelSelect.value = 'gemini-2.5-flash';
  } else if (settings.provider === 'kilo') {
    modelSelect.value = 'kilo-auto/efficient';
  } else {
    modelSelect.value = 'gpt-4o-mini';
  }
});

settingsBtn.addEventListener('click', () => {
  settingsModal.hidden = false;
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.hidden = true;
});

saveSettingsBtn.addEventListener('click', saveSettings);

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.hidden = true;
});

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

// Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// Init
loadSettings();
autoResize();
