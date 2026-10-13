/**
 * RetainX AI - Customer Churn Prediction Engine
 * Interactive Frontend Controller (Vanilla JavaScript)
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements Reference ---
  const churnForm = document.getElementById('churnForm');
  const predictBtn = document.getElementById('predictBtn');
  const resetBtn = document.getElementById('resetBtn');
  const randomBtn = document.getElementById('randomBtn');

  // Sliders & Number Inputs
  const tenureSlider = document.getElementById('tenureSlider');
  const tenureInput = document.getElementById('tenureInput');
  const tenureYearsHint = document.getElementById('tenureYearsHint');

  const monthlyChargesSlider = document.getElementById('monthlyChargesSlider');
  const monthlyChargesInput = document.getElementById('monthlyChargesInput');

  const totalChargesInput = document.getElementById('totalChargesInput');
  const syncTotalChargesBtn = document.getElementById('syncTotalChargesBtn');

  const thresholdSlider = document.getElementById('thresholdSlider');
  const thresholdDisplay = document.getElementById('thresholdDisplay');
  const thresholdStrategyBadge = document.getElementById('thresholdStrategyBadge');

  // Results Card Elements
  const resultsCard = document.getElementById('resultsCard');
  const resultsLoading = document.getElementById('resultsLoading');
  const resultsContent = document.getElementById('resultsContent');

  const riskBanner = document.getElementById('riskBanner');
  const riskBadgePill = document.getElementById('riskBadgePill');
  const riskBadgeText = document.getElementById('riskBadgeText');
  const riskTierTitle = document.getElementById('riskTierTitle');
  const riskExplanation = document.getElementById('riskExplanation');

  const gaugeCircle = document.getElementById('gaugeCircle');
  const churnPercentageText = document.getElementById('churnPercentageText');
  const churnProbRaw = document.getElementById('churnProbRaw');
  const retainProbRaw = document.getElementById('retainProbRaw');

  const statRevenueRisk = document.getElementById('statRevenueRisk');
  const statLatency = document.getElementById('statLatency');
  const statThreshold = document.getElementById('statThreshold');
  const statConfidence = document.getElementById('statConfidence');

  const churnDriversList = document.getElementById('churnDriversList');
  const retainDriversList = document.getElementById('retainDriversList');
  const recommendationsList = document.getElementById('recommendationsList');

  // Action Buttons
  const copyReportBtn = document.getElementById('copyReportBtn');
  const downloadJsonBtn = document.getElementById('downloadJsonBtn');

  // Sample Chips
  const sampleChips = document.querySelectorAll('.sample-chip');

  // Modals
  const modelInfoBtn = document.getElementById('modelInfoBtn');
  const modelModal = document.getElementById('modelModal');
  const closeModelModalBtn = document.getElementById('closeModelModalBtn');
  const globalChurnWeightsList = document.getElementById('globalChurnWeightsList');
  const globalRetainWeightsList = document.getElementById('globalRetainWeightsList');

  const batchModalBtn = document.getElementById('batchModalBtn');
  const batchModal = document.getElementById('batchModal');
  const closeBatchModalBtn = document.getElementById('closeBatchModalBtn');
  const uploadDropzone = document.getElementById('uploadDropzone');
  const batchCsvInput = document.getElementById('batchCsvInput');
  const browseFileBtn = document.getElementById('browseFileBtn');
  const batchLoading = document.getElementById('batchLoading');
  const batchResultsWrapper = document.getElementById('batchResultsWrapper');
  const batchTotalAnalyzed = document.getElementById('batchTotalAnalyzed');
  const batchChurnCount = document.getElementById('batchChurnCount');
  const batchChurnRate = document.getElementById('batchChurnRate');
  const batchRiskRevenue = document.getElementById('batchRiskRevenue');
  const batchTableBody = document.getElementById('batchTableBody');

  // Application State Cache
  let currentPredictionData = null;
  let cachedModelInfo = null;

  // ==========================================
  // Slider & Numerical Input Synchronization
  // ==========================================

  function updateTenureYears(val) {
    const years = (parseFloat(val) / 12).toFixed(1);
    tenureYearsHint.textContent = `(${years} yrs)`;
  }

  function autoCalculateTotalCharges() {
    const t = parseFloat(tenureInput.value) || 0;
    const m = parseFloat(monthlyChargesInput.value) || 0;
    const calc = Math.max(18.0, t * m);
    totalChargesInput.value = calc.toFixed(2);
  }

  tenureSlider.addEventListener('input', (e) => {
    tenureInput.value = e.target.value;
    updateTenureYears(e.target.value);
    autoCalculateTotalCharges();
  });

  tenureInput.addEventListener('input', (e) => {
    let val = parseFloat(e.target.value) || 0;
    val = Math.max(0, Math.min(72, val));
    tenureSlider.value = val;
    updateTenureYears(val);
    autoCalculateTotalCharges();
  });

  monthlyChargesSlider.addEventListener('input', (e) => {
    monthlyChargesInput.value = parseFloat(e.target.value).toFixed(2);
    autoCalculateTotalCharges();
  });

  monthlyChargesInput.addEventListener('input', (e) => {
    let val = parseFloat(e.target.value) || 18.0;
    val = Math.max(18, Math.min(120, val));
    monthlyChargesSlider.value = val;
    autoCalculateTotalCharges();
  });

  syncTotalChargesBtn.addEventListener('click', () => {
    autoCalculateTotalCharges();
    showToast('Recalculated Total Charges: Tenure × Monthly Bill', 'info');
  });

  // Threshold Sensitivity Slider
  thresholdSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    thresholdDisplay.textContent = val.toFixed(2);

    if (val < 0.35) {
      thresholdStrategyBadge.textContent = 'Aggressive Outreach (High Sensitivity)';
      thresholdStrategyBadge.style.color = '#f87171';
    } else if (val > 0.65) {
      thresholdStrategyBadge.textContent = 'High Specificity (Conservative)';
      thresholdStrategyBadge.style.color = '#34d399';
    } else {
      thresholdStrategyBadge.textContent = 'Balanced (Standard 0.50)';
      thresholdStrategyBadge.style.color = '#a5b4fc';
    }

    // If we already have active results, re-evaluate with the new threshold
    if (currentPredictionData) {
      submitPrediction(false);
    }
  });

  // ==========================================
  // Form Submission & Inference API Call
  // ==========================================

  function getFormData() {
    const formData = new FormData(churnForm);
    const data = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });

    data.tenure = parseFloat(tenureInput.value) || 1;
    data.MonthlyCharges = parseFloat(monthlyChargesInput.value) || 50.0;
    data.TotalCharges = parseFloat(totalChargesInput.value) || (data.tenure * data.MonthlyCharges);
    data.threshold = parseFloat(thresholdSlider.value) || 0.50;

    return data;
  }

  async function submitPrediction(scrollToResults = true) {
    const payload = getFormData();

    predictBtn.disabled = true;
    resultsLoading.classList.remove('hidden');
    resultsContent.style.opacity = '0.3';

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.error || 'Prediction calculation failed.', 'danger');
        return;
      }

      currentPredictionData = data;
      renderResults(data);

      if (scrollToResults && window.innerWidth < 1024) {
        resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      console.error('Inference error:', err);
      showToast('Network error while analyzing churn risk.', 'danger');
    } finally {
      predictBtn.disabled = false;
      resultsLoading.classList.add('hidden');
      resultsContent.style.opacity = '1';
    }
  }

  churnForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitPrediction(true);
  });

  // ==========================================
  // Rendering Results Dashboard
  // ==========================================

  function renderResults(data) {
    // 1. Risk Banner & Colors
    riskBanner.style.backgroundColor = data.risk_bg;
    riskBanner.style.borderColor = data.risk_color;

    riskBadgePill.style.backgroundColor = data.risk_color;
    riskBadgeText.textContent = data.risk_badge;

    riskTierTitle.textContent = data.is_churn
      ? `High Churn Probability (${data.risk_tier})`
      : `High Retention Likelihood (${data.risk_tier})`;

    riskExplanation.textContent = data.is_churn
      ? `Current model logit is positive (+). Without intervention, this subscriber is predicted to churn within 30-90 days.`
      : `Current model logit is negative (-). Subscriber indicators demonstrate stable retention commitment.`;

    // 2. Circular Gauge
    // Circumference of r=50 circle: 2 * PI * 50 = 314.159
    const circumference = 314.159;
    const churnProb = data.churn_probability;
    const offset = circumference * (1 - churnProb);

    gaugeCircle.style.strokeDashoffset = offset;
    gaugeCircle.style.stroke = data.risk_color;

    churnPercentageText.textContent = data.churn_percentage;
    churnPercentageText.style.color = data.risk_color;

    churnProbRaw.textContent = data.churn_probability.toFixed(3);
    retainProbRaw.textContent = data.retain_probability.toFixed(3);

    // 3. Stat Boxes
    statRevenueRisk.textContent = data.is_churn
      ? `$${data.annual_revenue_risk.toFixed(2)}`
      : '$0.00 (Protected)';
    statRevenueRisk.style.color = data.is_churn ? '#f87171' : '#34d399';

    statLatency.textContent = `${data.latency_ms} ms`;
    statThreshold.textContent = data.threshold_used.toFixed(2);

    const margin = Math.abs(churnProb - data.threshold_used);
    statConfidence.textContent = margin > 0.25 ? 'High' : margin > 0.1 ? 'Moderate' : 'Borderline';

    // 4. Feature Contributions (Explainable AI)
    renderDrivers(churnDriversList, data.indicators.churn_drivers, 'bar-churn', 'churn-score');
    renderDrivers(retainDriversList, data.indicators.retention_drivers, 'bar-retain', 'retain-score');

    // 5. Prescriptive Retention Interventions
    renderRecommendations(data.recommendations);
  }

  function renderDrivers(container, drivers, barClass, scoreClass) {
    container.innerHTML = '';

    if (!drivers || drivers.length === 0) {
      container.innerHTML = '<p class="text-dim" style="font-size:0.75rem;">No significant active factors.</p>';
      return;
    }

    // Determine max absolute impact for relative scaling
    const maxImpact = Math.max(...drivers.map((d) => d.abs_impact), 1.0);

    drivers.forEach((driver) => {
      const percentage = Math.min(100, Math.round((driver.abs_impact / maxImpact) * 100));

      const item = document.createElement('div');
      item.className = 'driver-item';
      item.innerHTML = `
        <div class="driver-meta">
          <span class="driver-name" title="${driver.name}">${driver.name}</span>
          <span class="driver-score ${scoreClass}">${driver.impact > 0 ? '+' : ''}${driver.impact.toFixed(2)}</span>
        </div>
        <div class="driver-bar-wrap">
          <div class="driver-bar-fill ${barClass}" style="width: ${percentage}%"></div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  function renderRecommendations(recs) {
    recommendationsList.innerHTML = '';

    if (!recs || recs.length === 0) {
      recommendationsList.innerHTML = '<p class="text-dim" style="font-size:0.8rem;">No special actions required.</p>';
      return;
    }

    recs.forEach((rec) => {
      const card = document.createElement('div');
      card.className = `recommendation-card priority-${rec.priority}`;
      card.innerHTML = `
        <div class="rec-header-row">
          <span class="rec-title">${rec.title}</span>
          <span class="rec-priority-badge badge-${getPriorityBadgeClass(rec.priority)}">${rec.priority} Priority</span>
        </div>
        <p class="rec-desc">${rec.action}</p>
      `;
      recommendationsList.appendChild(card);
    });
  }

  function getPriorityBadgeClass(priority) {
    if (priority === 'Critical') return 'danger';
    if (priority === 'High') return 'warning';
    if (priority === 'Medium') return 'info';
    return 'success';
  }

  // ==========================================
  // Sample Personas 1-Click Loading
  // ==========================================

  let samplePersonasData = {};

  async function initSamplePersonas() {
    try {
      const res = await fetch('/api/samples');
      const data = await res.json();
      if (data.success && data.samples) {
        data.samples.forEach((sample) => {
          samplePersonasData[sample.id] = sample.data;
        });
      }
    } catch (e) {
      console.warn('Failed to fetch samples API, will use embedded fallback:', e);
    }
  }

  initSamplePersonas();

  sampleChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const sampleId = chip.getAttribute('data-sample-id');

      // Highlight active chip
      sampleChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');

      const sampleValues = samplePersonasData[sampleId];
      if (sampleValues) {
        populateForm(sampleValues);
        submitPrediction(true);
        showToast(`Loaded profile: ${chip.querySelector('.sample-name').textContent}`, 'info');
      }
    });
  });

  function populateForm(data) {
    Object.keys(data).forEach((key) => {
      const field = churnForm.elements[key];
      if (field) {
        field.value = data[key];
      }
    });

    // Sync sliders
    if (data.tenure !== undefined) {
      tenureSlider.value = data.tenure;
      tenureInput.value = data.tenure;
      updateTenureYears(data.tenure);
    }

    if (data.MonthlyCharges !== undefined) {
      monthlyChargesSlider.value = data.MonthlyCharges;
      monthlyChargesInput.value = data.MonthlyCharges;
    }

    if (data.TotalCharges !== undefined) {
      totalChargesInput.value = data.TotalCharges;
    } else {
      autoCalculateTotalCharges();
    }
  }

  // ==========================================
  // Reset & Randomize Controls
  // ==========================================

  resetBtn.addEventListener('click', () => {
    sampleChips.forEach((c) => c.classList.remove('active'));
    churnForm.reset();
    tenureSlider.value = 12;
    tenureInput.value = 12;
    updateTenureYears(12);
    monthlyChargesSlider.value = 55.0;
    monthlyChargesInput.value = 55.0;
    thresholdSlider.value = 0.50;
    thresholdDisplay.textContent = '0.50';
    thresholdStrategyBadge.textContent = 'Balanced (Standard 0.50)';
    thresholdStrategyBadge.style.color = '#a5b4fc';
    autoCalculateTotalCharges();
    submitPrediction(false);
    showToast('Form reset to standard baseline defaults.', 'info');
  });

  randomBtn.addEventListener('click', () => {
    sampleChips.forEach((c) => c.classList.remove('active'));

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randFloat = (min, max) => (Math.random() * (max - min) + min).toFixed(2);

    const randomTenure = randInt(1, 70);
    const randomMonthly = parseFloat(randFloat(20, 115));
    const randomTotal = (randomTenure * randomMonthly).toFixed(2);

    const randomData = {
      gender: pick(['Female', 'Male']),
      SeniorCitizen: pick(['0', '1']),
      Partner: pick(['Yes', 'No']),
      Dependents: pick(['Yes', 'No']),
      PhoneService: pick(['Yes', 'No']),
      MultipleLines: pick(['No', 'Yes', 'No phone service']),
      InternetService: pick(['Fiber optic', 'DSL', 'No']),
      OnlineSecurity: pick(['Yes', 'No', 'No internet service']),
      OnlineBackup: pick(['Yes', 'No', 'No internet service']),
      DeviceProtection: pick(['Yes', 'No', 'No internet service']),
      TechSupport: pick(['Yes', 'No', 'No internet service']),
      StreamingTV: pick(['Yes', 'No', 'No internet service']),
      StreamingMovies: pick(['Yes', 'No', 'No internet service']),
      Contract: pick(['Month-to-month', 'One year', 'Two year']),
      PaperlessBilling: pick(['Yes', 'No']),
      PaymentMethod: pick([
        'Electronic check',
        'Mailed check',
        'Bank transfer (automatic)',
        'Credit card (automatic)',
      ]),
      tenure: randomTenure,
      MonthlyCharges: randomMonthly,
      TotalCharges: randomTotal,
    };

    populateForm(randomData);
    submitPrediction(false);
    showToast('Generated random subscriber profile.', 'info');
  });

  // ==========================================
  // Report Export Actions
  // ==========================================

  copyReportBtn.addEventListener('click', () => {
    if (!currentPredictionData) return;

    const d = currentPredictionData;
    const reportText = `
========================================
RetainX AI - CUSTOMER RETENTION REPORT
========================================
Prediction Outcome: ${d.label_display}
Churn Probability:  ${d.churn_percentage}
Retention Chance:   ${d.retain_percentage}
Risk Classification: ${d.risk_tier}
Annual Bill At Risk: ${d.annual_revenue_risk ? '$' + d.annual_revenue_risk.toFixed(2) : '$0.00'}

CUSTOMER PROFILE:
- Tenure:            ${d.customer_summary.tenure} months
- Contract:          ${d.customer_summary.Contract}
- Internet Service:  ${d.customer_summary.InternetService}
- Payment Method:    ${d.customer_summary.PaymentMethod}
- Monthly Billing:   $${d.customer_summary.MonthlyCharges}/mo

TOP DRIVERS OF CHURN:
${d.indicators.churn_drivers.map((c) => ` • ${c.name} (+${c.impact})`).join('\n')}

TOP RETENTION PROTECTORS:
${d.indicators.retention_drivers.map((r) => ` • ${r.name} (${r.impact})`).join('\n')}

PRESCRIPTIVE ACTIONS:
${d.recommendations.map((a) => ` [${a.priority}] ${a.title}: ${a.action}`).join('\n')}

Model: Logistic Regression (Scikit-Learn Pipeline)
Generated by RetainX AI
========================================
`.trim();

    navigator.clipboard.writeText(reportText).then(() => {
      showToast('Summary report copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy to clipboard.', 'danger');
    });
  });

  downloadJsonBtn.addEventListener('click', () => {
    if (!currentPredictionData) return;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentPredictionData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'customer_churn_prediction.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('Exported prediction JSON file.', 'success');
  });

  // ==========================================
  // Modal 1: Model Architecture & Global Weights
  // ==========================================

  async function loadModelInfo() {
    if (cachedModelInfo) return;

    try {
      const res = await fetch('/api/model-info');
      const data = await res.json();
      if (data.success) {
        cachedModelInfo = data;

        // Render global churn weights (+)
        globalChurnWeightsList.innerHTML = '';
        data.top_churn_drivers.forEach((item) => {
          const row = document.createElement('div');
          row.className = 'weight-row';
          row.innerHTML = `
            <span class="fn">${item.friendly_name}</span>
            <span class="wt" style="color: #f87171;">+${item.weight.toFixed(3)}</span>
          `;
          globalChurnWeightsList.appendChild(row);
        });

        // Render global retention weights (-)
        globalRetainWeightsList.innerHTML = '';
        data.top_retention_drivers.forEach((item) => {
          const row = document.createElement('div');
          row.className = 'weight-row';
          row.innerHTML = `
            <span class="fn">${item.friendly_name}</span>
            <span class="wt" style="color: #34d399;">${item.weight.toFixed(3)}</span>
          `;
          globalRetainWeightsList.appendChild(row);
        });
      }
    } catch (e) {
      console.error('Failed to load model info:', e);
    }
  }

  modelInfoBtn.addEventListener('click', () => {
    modelModal.classList.remove('hidden');
    loadModelInfo();
  });

  closeModelModalBtn.addEventListener('click', () => {
    modelModal.classList.add('hidden');
  });

  // ==========================================
  // Modal 2: Batch CSV Scoring
  // ==========================================

  batchModalBtn.addEventListener('click', () => {
    batchModal.classList.remove('hidden');
  });

  closeBatchModalBtn.addEventListener('click', () => {
    batchModal.classList.add('hidden');
  });

  // Close modals on backdrop click
  [modelModal, batchModal].forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modelModal.classList.add('hidden');
      batchModal.classList.add('hidden');
    }
  });

  // Batch Dropzone interactions
  browseFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    batchCsvInput.click();
  });

  uploadDropzone.addEventListener('click', () => {
    batchCsvInput.click();
  });

  uploadDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadDropzone.classList.add('dragover');
  });

  uploadDropzone.addEventListener('dragleave', () => {
    uploadDropzone.classList.remove('dragover');
  });

  uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleBatchFileUpload(e.dataTransfer.files[0]);
    }
  });

  batchCsvInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleBatchFileUpload(e.target.files[0]);
    }
  });

  async function handleBatchFileUpload(file) {
    if (!file.name.endsWith('.csv')) {
      showToast('Please upload a valid .csv file.', 'danger');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('threshold', thresholdSlider.value);

    batchLoading.classList.remove('hidden');
    batchResultsWrapper.classList.add('hidden');

    try {
      const res = await fetch('/api/batch-predict', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
        showToast(data.error || 'Batch scoring failed.', 'danger');
        return;
      }

      // Populate summary stats
      batchTotalAnalyzed.textContent = data.total_analyzed;
      batchChurnCount.textContent = data.churn_count;
      batchChurnRate.textContent = data.churn_rate_percentage;
      batchRiskRevenue.textContent = data.total_annual_risk_revenue;

      // Populate table preview
      batchTableBody.innerHTML = '';
      data.results.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code>${row.customerID}</code></td>
          <td>${row.tenure} mo</td>
          <td>${row.contract}</td>
          <td>$${parseFloat(row.monthlyCharges || 0).toFixed(2)}</td>
          <td><strong style="color: ${row.riskColor}">${row.churnProbability}</strong></td>
          <td><span style="color: ${row.riskColor}; font-weight:700;">${row.riskTier}</span></td>
          <td><span class="sample-badge badge-${row.prediction === 'Churn' ? 'danger' : 'success'}">${row.prediction}</span></td>
        `;
        batchTableBody.appendChild(tr);
      });

      batchResultsWrapper.classList.remove('hidden');
      showToast(`Batch scoring complete for ${data.total_analyzed} subscribers!`, 'success');
    } catch (e) {
      console.error('Batch error:', e);
      showToast('Error uploading and processing CSV batch.', 'danger');
    } finally {
      batchLoading.classList.add('hidden');
    }
  }

  // ==========================================
  // Toast Notifications Helper
  // ==========================================

  function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<span style="color:#10b981;font-size:1.1rem;">✓</span>';
    } else if (type === 'danger') {
      iconSvg = '<span style="color:#ef4444;font-size:1.1rem;">✕</span>';
    } else {
      iconSvg = '<span style="color:#6366f1;font-size:1.1rem;">ℹ</span>';
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Initial evaluation on page load with the default pre-filled sample
  submitPrediction(false);
});
