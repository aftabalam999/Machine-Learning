/**
 * AEGISSPAM AI - CLIENT APPLICATION CONTROLLER
 * Handles interactive inference, animations, SVG gauge updates,
 * feature token rendering, and session history.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const emailInput = document.getElementById('emailInput');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const analyzeBtnText = document.getElementById('analyzeBtnText');
  const analyzeSpinner = document.getElementById('analyzeSpinner');
  const clearBtn = document.getElementById('clearBtn');
  const clearInputBtn = document.getElementById('clearInputBtn');
  const pasteBtn = document.getElementById('pasteBtn');
  
  // Counters
  const charCounter = document.getElementById('charCounter');
  const wordCounter = document.getElementById('wordCounter');
  const readTimeCounter = document.getElementById('readTimeCounter');
  
  // Threshold
  const thresholdSlider = document.getElementById('thresholdSlider');
  const thresholdDisplay = document.getElementById('thresholdDisplay');
  
  // Verdict State Containers
  const emptyState = document.getElementById('verdictEmptyState');
  const activeState = document.getElementById('verdictActiveState');
  
  // Active Verdict Elements
  const verdictBanner = document.getElementById('verdictBanner');
  const verdictHeading = document.getElementById('verdictHeading');
  const verdictSubheading = document.getElementById('verdictSubheading');
  const verdictIcon = document.getElementById('verdictIcon');
  const riskBadge = document.getElementById('riskBadge');
  
  // Gauge & Bars
  const gaugeProgressRing = document.getElementById('gaugeProgressRing');
  const gaugeValueText = document.getElementById('gaugeValueText');
  const spamPctLabel = document.getElementById('spamPctLabel');
  const hamPctLabel = document.getElementById('hamPctLabel');
  const meterFillSpam = document.getElementById('meterFillSpam');
  const meterFillHam = document.getElementById('meterFillHam');
  const latencyBadge = document.getElementById('latencyBadge');
  
  // Token Indicators
  const spamChipsList = document.getElementById('spamChipsList');
  const hamChipsList = document.getElementById('hamChipsList');
  
  // Actions
  const copyResultBtn = document.getElementById('copyResultBtn');
  const shareReportBtn = document.getElementById('shareReportBtn');
  
  // History
  const historyTableBody = document.getElementById('historyTableBody');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const historyEmptyNote = document.getElementById('historyEmptyNote');
  
  // Model Modal
  const modelInfoBtn = document.getElementById('modelInfoBtn');
  const modelModal = document.getElementById('modelModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  
  // Samples
  const sampleChips = document.querySelectorAll('.sample-chip');
  
  // State cache
  let lastResult = null;
  const STORAGE_KEY = 'aegisspam_scan_history_v1';
  const SVG_CIRCUMFERENCE = 283; // 2 * PI * r (r=45)

  // -------------------------------------------------------------------------
  // 1. Text Metrics & Counter Updates
  // -------------------------------------------------------------------------
  function updateTextCounters() {
    const text = emailInput.value;
    const charCount = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const estSec = Math.max(1, Math.round((words / 200) * 60));

    charCounter.textContent = charCount.toLocaleString();
    wordCounter.textContent = words.toLocaleString();
    readTimeCounter.textContent = words > 0 ? `${estSec}s read` : '0s';
  }

  emailInput.addEventListener('input', updateTextCounters);

  // -------------------------------------------------------------------------
  // 2. Clipboard & Clear Actions
  // -------------------------------------------------------------------------
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      emailInput.value = '';
      updateTextCounters();
      emailInput.focus();
    });
  }

  if (clearInputBtn) {
    clearInputBtn.addEventListener('click', () => {
      emailInput.value = '';
      updateTextCounters();
      emailInput.focus();
    });
  }

  if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          emailInput.value = text;
          updateTextCounters();
          showToast('Message pasted from clipboard');
        }
      } catch (err) {
        showToast('Unable to access clipboard. Please paste manually.', 'warn');
      }
    });
  }

  // -------------------------------------------------------------------------
  // 3. Threshold Slider
  // -------------------------------------------------------------------------
  thresholdSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    thresholdDisplay.textContent = `${val}%`;

    // If we have cached results, update live without waiting
    if (lastResult && lastResult.spam_probability !== undefined) {
      const thresholdFloat = val / 100.0;
      recalculateVerdictThreshold(lastResult.spam_probability, thresholdFloat);
    }
  });

  function recalculateVerdictThreshold(spamProb, threshold) {
    const isSpam = spamProb >= threshold;
    const headingText = isSpam ? 'SPAM DETECTED' : 'LEGITIMATE (HAM)';
    
    verdictHeading.textContent = headingText;
    verdictSubheading.textContent = `Classified by Logistic Regression at ${Math.round(threshold * 100)}% decision boundary`;

    if (isSpam) {
      verdictBanner.className = 'verdict-banner is-spam';
      verdictIcon.innerHTML = `
        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>`;
    } else {
      verdictBanner.className = 'verdict-banner is-ham';
      verdictIcon.innerHTML = `
        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
        </svg>`;
    }
  }

  // -------------------------------------------------------------------------
  // 4. Sample Chips Quick Testing
  // -------------------------------------------------------------------------
  sampleChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const sampleText = chip.getAttribute('data-sample');
      if (sampleText) {
        emailInput.value = sampleText;
        updateTextCounters();
        executeInference();
      }
    });
  });

  // Keyboard shortcut Ctrl/Cmd + Enter
  emailInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeInference();
    }
  });

  analyzeBtn.addEventListener('click', executeInference);

  // -------------------------------------------------------------------------
  // 5. Model Inference AJAX
  // -------------------------------------------------------------------------
  async function executeInference() {
    const text = emailInput.value.trim();
    if (!text) {
      showToast('Please enter an email or text message to analyze.', 'warn');
      emailInput.focus();
      return;
    }

    const thresholdVal = parseInt(thresholdSlider.value, 10) / 100.0;

    // Set Loading State
    setLoading(true);

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          threshold: thresholdVal,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process inference.');
      }

      lastResult = data;
      renderVerdict(data, text);
      addToHistory(data, text);
    } catch (err) {
      console.error('Inference error:', err);
      showToast(err.message || 'An error occurred during classification.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    analyzeBtn.disabled = isLoading;
    if (isLoading) {
      analyzeBtnText.textContent = 'Analyzing...';
      analyzeSpinner.style.display = 'inline-block';
    } else {
      analyzeBtnText.textContent = 'Analyze Message';
      analyzeSpinner.style.display = 'none';
    }
  }

  // -------------------------------------------------------------------------
  // 6. Verdict Rendering & SVG Gauge Animation
  // -------------------------------------------------------------------------
  function renderVerdict(result, rawText) {
    emptyState.style.display = 'none';
    activeState.style.display = 'block';

    const isSpam = result.is_spam;
    const spamProb = result.spam_probability;
    const hamProb = result.ham_probability;

    // 1. Banner State
    recalculateVerdictThreshold(spamProb, result.threshold_used);

    // 2. Risk Level Tag
    riskBadge.textContent = result.risk_badge || result.risk_level;
    riskBadge.style.backgroundColor = isSpam ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)';
    riskBadge.style.color = isSpam ? '#fda4af' : '#6ee7b7';
    riskBadge.style.border = `1px solid ${isSpam ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`;

    // 3. SVG Radial Progress Gauge Animation
    const strokeOffset = SVG_CIRCUMFERENCE - (spamProb * SVG_CIRCUMFERENCE);
    gaugeProgressRing.style.strokeDashoffset = strokeOffset;
    gaugeValueText.textContent = `${Math.round(spamProb * 100)}%`;

    if (spamProb >= 0.6) {
      gaugeProgressRing.style.stroke = 'var(--spam-red)';
      gaugeValueText.style.color = '#fb7185';
    } else if (spamProb >= 0.4) {
      gaugeProgressRing.style.stroke = 'var(--warn-amber)';
      gaugeValueText.style.color = '#fbbf24';
    } else {
      gaugeProgressRing.style.stroke = 'var(--ham-emerald)';
      gaugeValueText.style.color = '#34d399';
    }

    // 4. Dual Distribution Meters
    spamPctLabel.textContent = result.spam_percentage;
    hamPctLabel.textContent = result.ham_percentage;
    meterFillSpam.style.width = result.spam_percentage;
    meterFillHam.style.width = result.ham_percentage;

    // 5. Latency
    if (result.stats && result.stats.latency_ms !== undefined) {
      latencyBadge.textContent = `${result.stats.latency_ms} ms`;
    }

    // 6. Keyword Indicators (Feature Contributions)
    renderTokenChips(result.indicators);

    // Scroll smoothly to result on mobile
    if (window.innerWidth < 1024) {
      activeState.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function renderTokenChips(indicators) {
    spamChipsList.innerHTML = '';
    hamChipsList.innerHTML = '';

    const spamTokens = (indicators && indicators.spam_indicators) || [];
    const hamTokens = (indicators && indicators.ham_indicators) || [];

    if (spamTokens.length === 0) {
      spamChipsList.innerHTML = '<span class="empty-tokens-note">No strong spam keywords triggered.</span>';
    } else {
      spamTokens.forEach((t) => {
        const item = document.createElement('div');
        item.className = 'token-chip spam-token';
        item.innerHTML = `
          <span class="token-word" title="${t.word}">"${escapeHtml(t.word)}"</span>
          <span class="token-weight">+${t.weight}</span>
        `;
        spamChipsList.appendChild(item);
      });
    }

    if (hamTokens.length === 0) {
      hamChipsList.innerHTML = '<span class="empty-tokens-note">No strong ham keywords triggered.</span>';
    } else {
      hamTokens.forEach((t) => {
        const item = document.createElement('div');
        item.className = 'token-chip ham-token';
        item.innerHTML = `
          <span class="token-word" title="${t.word}">"${escapeHtml(t.word)}"</span>
          <span class="token-weight">${t.weight}</span>
        `;
        hamChipsList.appendChild(item);
      });
    }
  }

  // -------------------------------------------------------------------------
  // 7. Session History (localStorage)
  // -------------------------------------------------------------------------
  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const items = raw ? JSON.parse(raw) : [];
      renderHistoryTable(items);
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }

  function addToHistory(result, text) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let items = raw ? JSON.parse(raw) : [];

      const newItem = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        text: text,
        snippet: text.length > 55 ? text.substring(0, 55) + '...' : text,
        is_spam: result.is_spam,
        spam_percentage: result.spam_percentage,
        risk_level: result.risk_level,
      };

      // Unshift to top & limit to 10 entries
      items.unshift(newItem);
      if (items.length > 10) items = items.slice(0, 10);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      renderHistoryTable(items);
    } catch (e) {
      console.error('Failed to save history item:', e);
    }
  }

  function renderHistoryTable(items) {
    historyTableBody.innerHTML = '';
    if (!items || items.length === 0) {
      historyEmptyNote.style.display = 'block';
      return;
    }

    historyEmptyNote.style.display = 'none';

    items.forEach((item) => {
      const tr = document.createElement('tr');
      const badgeClass = item.is_spam ? 'chip-tag spam' : 'chip-tag ham';
      const labelText = item.is_spam ? 'SPAM' : 'HAM';

      tr.innerHTML = `
        <td class="history-time">${item.timestamp}</td>
        <td><span class="${badgeClass}">${labelText}</span></td>
        <td style="font-family: var(--font-mono); font-weight: 700; color: ${item.is_spam ? '#fb7185' : '#34d399'}">${item.spam_percentage}</td>
        <td class="history-snippet" title="${escapeHtml(item.text)}">${escapeHtml(item.snippet)}</td>
        <td style="text-align: right;">
          <button class="history-load-btn" data-text="${escapeHtml(item.text)}" id="history-load-${item.id}">Load</button>
        </td>
      `;

      tr.querySelector('.history-load-btn').addEventListener('click', (e) => {
        const fullText = e.target.getAttribute('data-text');
        emailInput.value = fullText;
        updateTextCounters();
        executeInference();
      });

      historyTableBody.appendChild(tr);
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      loadHistory();
      showToast('Scan history cleared.');
    });
  }

  // -------------------------------------------------------------------------
  // 8. Sharing & Copying Results
  // -------------------------------------------------------------------------
  if (copyResultBtn) {
    copyResultBtn.addEventListener('click', async () => {
      if (!lastResult) return;
      const textToCopy = [
        `=== AegisSpam AI Analysis ===`,
        `Model: Logistic Regression`,
        `Verdict: ${lastResult.label_display}`,
        `Spam Probability: ${lastResult.spam_percentage}`,
        `Legitimate Likelihood: ${lastResult.ham_percentage}`,
        `Risk Rating: ${lastResult.risk_level}`,
        `Threshold: ${Math.round(lastResult.threshold_used * 100)}%`,
        `Latency: ${lastResult.stats.latency_ms} ms`,
      ].join('\n');

      try {
        await navigator.clipboard.writeText(textToCopy);
        showToast('Classification report copied to clipboard!');
      } catch (e) {
        showToast('Could not copy report.', 'warn');
      }
    });
  }

  if (shareReportBtn) {
    shareReportBtn.addEventListener('click', async () => {
      if (!lastResult) return;
      const jsonReport = JSON.stringify(lastResult, null, 2);
      try {
        await navigator.clipboard.writeText(jsonReport);
        showToast('Full JSON diagnostic data copied!');
      } catch (e) {
        showToast('Could not copy JSON.', 'warn');
      }
    });
  }

  // -------------------------------------------------------------------------
  // 9. Model Architecture Modal
  // -------------------------------------------------------------------------
  if (modelInfoBtn && modelModal) {
    modelInfoBtn.addEventListener('click', () => {
      modelModal.style.display = 'flex';
    });

    closeModalBtn.addEventListener('click', () => {
      modelModal.style.display = 'none';
    });

    modelModal.addEventListener('click', (e) => {
      if (e.target === modelModal) {
        modelModal.style.display = 'none';
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modelModal.style.display === 'flex') {
        modelModal.style.display = 'none';
      }
    });
  }

  // -------------------------------------------------------------------------
  // 10. Toast Notification System
  // -------------------------------------------------------------------------
  function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let iconSvg = '';
    if (type === 'warn' || type === 'error') {
      iconSvg = `<svg width="18" height="18" fill="none" stroke="#f43f5e" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" fill="none" stroke="#06b6d4" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial load
  updateTextCounters();
  loadHistory();

  // If page was rendered with initial result from POST form
  const initialDataTag = document.getElementById('initialDataPayload');
  if (initialDataTag) {
    try {
      const initialJson = JSON.parse(initialDataTag.textContent);
      if (initialJson && initialJson.success) {
        lastResult = initialJson;
        renderVerdict(initialJson, emailInput.value);
        addToHistory(initialJson, emailInput.value);
      }
    } catch (e) {}
  }
});
