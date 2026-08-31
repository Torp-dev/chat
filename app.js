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

let settings = {
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.',
};

let messages = [];
let isStreaming = false;
let abortController = null;
let deferredPrompt = null;

function loadSettings() {
  const saved = localStorage.getItem('ai-chat-settings');
  if (saved) {
    settings = { ...settings, ...JSON.parse(saved) };
  }
  document.getElementById('api-url').value = settings.apiUrl;
  document.getElementById('api-key').value = settings.apiKey;
  document.getElementById('model').value = settings.model;
  document.getElementById('system-prompt').value = settings.systemPrompt;
}

function saveSettings() {
  settings.apiUrl = document.getElementById('api-url').value.trim() || settings.apiUrl;
  settings.apiKey = document.getElementById('api-key').value.trim();
  settings.model = document.getElementById('model').value.trim() || settings.model;
  settings.systemPrompt = document.getElementById('system-prompt').value.trim() || settings.systemPrompt;
  localStorage.setItem('ai-chat-settings', JSON.stringify(settings));
  settingsModal.hidden = true;
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
let startY, startInputHeight, startResponseHeight;

divider.addEventListener('mousedown', (e) => {
  startY = e.clientY;
  startInputHeight = inputSection.offsetHeight;
  startResponseHeight = responseSection.offsetHeight;
  divider.classList.add('dragging');
  document.body.style.cursor = 'row-resize';
  document.body.style.userSelect = 'none';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!divider.classList.contains('dragging')) return;
  const dy = e.clientY - startY;
  const containerHeight = document.getElementById('resizable-container').offsetHeight;
  const totalHeight = startInputHeight + startResponseHeight;

  let newInputHeight = startInputHeight + dy;
  let newResponseHeight = startResponseHeight - dy;

  const minHeight = 80;
  if (newInputHeight < minHeight) {
    newInputHeight = minHeight;
    newResponseHeight = totalHeight - minHeight;
  }
  if (newResponseHeight < minHeight) {
    newResponseHeight = minHeight;
    newInputHeight = totalHeight - minHeight;
  }

  const inputPercent = (newInputHeight / containerHeight) * 100;
  const responsePercent = (newResponseHeight / containerHeight) * 100;

  inputSection.style.flex = `1 1 ${inputPercent}%`;
  responseSection.style.flex = `1 1 ${responsePercent}%`;
});

document.addEventListener('mouseup', () => {
  divider.classList.remove('dragging');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

// Touch support for divider
divider.addEventListener('touchstart', (e) => {
  startY = e.touches[0].clientY;
  startInputHeight = inputSection.offsetHeight;
  startResponseHeight = responseSection.offsetHeight;
  divider.classList.add('dragging');
  e.preventDefault();
});

document.addEventListener('touchmove', (e) => {
  if (!divider.classList.contains('dragging')) return;
  const dy = e.touches[0].clientY - startY;
  const containerHeight = document.getElementById('resizable-container').offsetHeight;
  const totalHeight = startInputHeight + startResponseHeight;

  let newInputHeight = startInputHeight + dy;
  let newResponseHeight = startResponseHeight - dy;

  const minHeight = 80;
  if (newInputHeight < minHeight) {
    newInputHeight = minHeight;
    newResponseHeight = totalHeight - minHeight;
  }
  if (newResponseHeight < minHeight) {
    newResponseHeight = minHeight;
    newInputHeight = totalHeight - minHeight;
  }

  const inputPercent = (newInputHeight / containerHeight) * 100;
  const responsePercent = (newResponseHeight / containerHeight) * 100;

  inputSection.style.flex = `1 1 ${inputPercent}%`;
  responseSection.style.flex = `1 1 ${responsePercent}%`;
});

document.addEventListener('touchend', () => {
  divider.classList.remove('dragging');
});

// Events
sendBtn.addEventListener('click', sendMessage);
clearBtn.addEventListener('click', clearResponse);

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

userInput.addEventListener('input', autoResize);

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
  const { outcome } = await deferredPrompt.userChoice;
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
