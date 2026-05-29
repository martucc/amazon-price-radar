/**
 * Amazon Price Radar - Application Logic
 * Gestisce lo stato, i grafici Chart.js, il simulatore temporale,
 * le predizioni AI e il sistema di notifiche sonore/visive.
 */

// ==========================================================================
// 1. STATO DELL'APPLICAZIONE
// ==========================================================================
let state = {
  products: [],
  notifications: [],
  currentDate: '2026-05-30', // Data iniziale allineata alla data corrente
  activeTab: 'tab-dashboard',
  soundEnabled: true,
  chartInstance: null,
  activeChartPeriod: 'all', // 'all', '30', '7'
  activeChartProduct: 'all',  // 'all' o ID prodotto specifico
  geminiKey: "",               // Chiave API Gemini caricata da LocalStorage
  telegramConfig: { enabled: false, token: "", chatId: "" } // Configurazione Telegram
};

// Immagini segnaposto premium da Unsplash per categoria
const CATEGORY_IMAGES = {
  "Elettronica": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=400&q=80",
  "Audio": "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=400&q=80",
  "Gaming": "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=400&q=80",
  "Computer": "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=400&q=80",
  "Libri & E-Reader": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=400&q=80",
  "Casa & Cucina": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80",
  "Abbigliamento": "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=400&q=80",
  "Altro": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80"
};

// ==========================================================================
// 2. INIZIALIZZAZIONE DELL'APP
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  setupEventListeners();

  // Registrazione del Service Worker per la PWA installabile e offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('[PWA] Service Worker registrato con successo:', reg.scope))
      .catch(err => console.error('[PWA] Errore registrazione Service Worker:', err));
  }
});

function initApp() {
  // Caricamento prodotti dal LocalStorage o caricamento mock
  const storedProducts = localStorage.getItem("amazon_price_tracker_products");
  if (storedProducts) {
    state.products = JSON.parse(storedProducts);
  } else {
    state.products = [...INITIAL_PRODUCTS];
    saveToLocalStorage();
  }

  // Caricamento notifiche
  const storedNotifications = localStorage.getItem("amazon_price_tracker_notifications");
  state.notifications = storedNotifications ? JSON.parse(storedNotifications) : [];

  // Caricamento data di simulazione salvata
  const storedDate = localStorage.getItem("amazon_price_tracker_date");
  if (storedDate) {
    state.currentDate = storedDate;
  } else {
    localStorage.setItem("amazon_price_tracker_date", state.currentDate);
  }

  // Impostazioni audio caricate
  const storedSound = localStorage.getItem("amazon_price_tracker_sound");
  if (storedSound !== null) {
    state.soundEnabled = storedSound === "true";
    document.getElementById("sound-toggle").checked = state.soundEnabled;
  }

  // Caricamento chiave API Gemini
  const storedGeminiKey = localStorage.getItem("amazon_price_tracker_gemini_key");
  if (storedGeminiKey) {
    state.geminiKey = storedGeminiKey;
    const apiKeyInput = document.getElementById("input-api-key");
    if (apiKeyInput) {
      apiKeyInput.value = state.geminiKey;
    }
  }

  // Caricamento configurazione Telegram
  const storedTelegramConfig = localStorage.getItem("amazon_price_tracker_telegram_config");
  if (storedTelegramConfig) {
    state.telegramConfig = JSON.parse(storedTelegramConfig);
    
    const notifToggle = document.getElementById("telegram-notif-toggle");
    if (notifToggle) notifToggle.checked = state.telegramConfig.enabled;
    
    const tokenInput = document.getElementById("input-telegram-token");
    if (tokenInput) tokenInput.value = state.telegramConfig.token || "";
    
    const chatidInput = document.getElementById("input-telegram-chatid");
    if (chatidInput) chatidInput.value = state.telegramConfig.chatId || "";
  }

  // Aggiorna data in interfaccia
  updateSimulationDateUI();

  // Popola i menu a tendina e categorie
  populateCategorySelects();
  populateChartProductSelect();
  populateAnalysisProductSelect();

  // Renderizza i moduli
  renderDashboard();
  renderProductsGrid();
  renderNotificationsList();
  
  // Inizializza il primo grafico
  setTimeout(() => {
    initChart();
  }, 100);
  
  // Esegui la prima analisi predittiva
  updatePredictiveAnalysis();
  
  // Sincronizza prodotti con il server per Telegram Bot
  setTimeout(() => {
    syncTelegramProducts();
  }, 500);
}

function saveToLocalStorage() {
  localStorage.setItem("amazon_price_tracker_products", JSON.stringify(state.products));
  localStorage.setItem("amazon_price_tracker_notifications", JSON.stringify(state.notifications));
  localStorage.setItem("amazon_price_tracker_date", state.currentDate);
  localStorage.setItem("amazon_price_tracker_sound", state.soundEnabled.toString());
  localStorage.setItem("amazon_price_tracker_gemini_key", state.geminiKey || "");
  localStorage.setItem("amazon_price_tracker_telegram_config", JSON.stringify(state.telegramConfig || { enabled: false, token: "", chatId: "" }));
}

// ==========================================================================
// 3. EVENT LISTENERS SETUP
// ==========================================================================
function setupEventListeners() {
  // Tab Navigation
  document.querySelectorAll(".menu-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetPanel = item.getAttribute("data-target");
      switchTab(targetPanel);
    });
  });

  // Global Search
  document.getElementById("global-search-input").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    filterProductsBySearch(query);
  });

  // Modal Controls
  const addModal = document.getElementById("add-product-modal");
  
  const openModal = () => {
    addModal.classList.add("show");
  };

  document.getElementById("btn-open-add-modal").addEventListener("click", openModal);
  
  const mobileFab = document.getElementById("btn-mobile-fab");
  if (mobileFab) {
    mobileFab.addEventListener("click", openModal);
  }
  
  const closeModal = () => {
    addModal.classList.remove("show");
    document.getElementById("add-product-form").reset();
  };
  
  document.getElementById("btn-close-add-modal").addEventListener("click", closeModal);
  document.getElementById("btn-cancel-add").addEventListener("click", closeModal);
  
  // Submit Aggiungi Prodotto
  document.getElementById("add-product-form").addEventListener("submit", (e) => {
    e.preventDefault();
    addNewProduct();
    closeModal();
  });

  // Sound Toggle Switch
  document.getElementById("sound-toggle").addEventListener("change", (e) => {
    state.soundEnabled = e.target.checked;
    saveToLocalStorage();
    showToast("Impostazioni Audio", `Notifiche sonore ${state.soundEnabled ? 'attivate' : 'disattivate'}`, "success");
    logToTerminal(`Audio delle notifiche ${state.soundEnabled ? 'attivato' : 'disattivato'}.`, "system");
  });

  // Test Sound Tone Button
  document.getElementById("btn-test-sound").addEventListener("click", () => {
    playAlertSound(true);
    showToast("Test Audio", "Riproduzione del tono sintetico di alert eseguita.", "success");
  });

  // Clear Notifications
  document.getElementById("btn-clear-notifications").addEventListener("click", () => {
    state.notifications = [];
    saveToLocalStorage();
    renderNotificationsList();
    showToast("Notifiche", "Registro notifiche svuotato.", "success");
  });

  // Category Filter in Products Grid
  document.getElementById("product-category-filter").addEventListener("change", (e) => {
    renderProductsGrid(e.target.value);
  });

  // Chart Controls Event Listener
  document.getElementById("chart-product-select").addEventListener("change", (e) => {
    state.activeChartProduct = e.target.value;
    updateChartData();
  });

  document.querySelectorAll(".chart-controls .btn-outline").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".chart-controls .btn-outline").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeChartPeriod = btn.getAttribute("data-period");
      updateChartData();
    });
  });

  // Predictive Product Selection
  document.getElementById("analysis-product-select").addEventListener("change", () => {
    updatePredictiveAnalysis();
  });

  // Simulator Panel Event Listeners
  document.getElementById("btn-sim-day").addEventListener("click", () => {
    simulateTime(1);
  });

  document.getElementById("btn-sim-week").addEventListener("click", () => {
    simulateTime(7);
  });

  document.getElementById("btn-sim-blackfriday").addEventListener("click", () => {
    triggerSpecialMarketEvent();
  });

  document.getElementById("btn-sim-reset").addEventListener("click", () => {
    if (confirm("Sei sicuro di voler ripristinare tutti i dati allo stato iniziale? I prodotti aggiunti e la cronologia delle simulazioni verranno cancellati.")) {
      localStorage.removeItem("amazon_price_tracker_products");
      localStorage.removeItem("amazon_price_tracker_notifications");
      localStorage.removeItem("amazon_price_tracker_date");
      location.reload();
    }
  });

  // Autocompila Scraper Button
  document.getElementById("btn-verify-url").addEventListener("click", () => {
    verifyAmazonUrlAndAutocompila();
  });

  // Sincronizza Prezzi Reali Button
  document.getElementById("btn-sync-prices").addEventListener("click", () => {
    syncRealAmazonPrices();
  });

  // Gemini API Key Input Change
  const apiKeyInput = document.getElementById("input-api-key");
  if (apiKeyInput) {
    apiKeyInput.addEventListener("input", (e) => {
      state.geminiKey = e.target.value.trim();
      saveToLocalStorage();
      logToTerminal(`Chiave API Gemini aggiornata localmente. ${state.geminiKey ? 'Modalità reale abilitata.' : 'Esecuzione in Modalità Demo.'}`, "system");
    });
  }

  // AI Review Summarizer Click
  const btnAnalyzeReviews = document.getElementById("btn-analyze-reviews");
  if (btnAnalyzeReviews) {
    btnAnalyzeReviews.addEventListener("click", () => {
      analyzeReviewsWithGemini();
    });
  }

  // Chat Submit Form
  const chatForm = document.getElementById("chat-input-form");
  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const chatInput = document.getElementById("chat-user-message");
      const message = chatInput.value.trim();
      if (message) {
        chatInput.value = "";
        sendChatBotMessage(message);
      }
    });
  }

  // Chat Suggestions Pills Click
  document.querySelectorAll(".suggestion-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const promptText = pill.getAttribute("data-prompt");
      if (promptText) {
        sendChatBotMessage(promptText);
      }
    });
  });

  // Telegram Notifications Toggle Change
  const tgToggle = document.getElementById("telegram-notif-toggle");
  if (tgToggle) {
    tgToggle.addEventListener("change", (e) => {
      state.telegramConfig.enabled = e.target.checked;
      saveToLocalStorage();
      showToast("Notifiche Telegram", `Avvisi push su Telegram ${state.telegramConfig.enabled ? 'abilitati' : 'disabilitati'}`, "success");
      logToTerminal(`Notifiche push Telegram ${state.telegramConfig.enabled ? 'ATTIVATE' : 'DISATTIVATE'}.`, "system");
      
      // Sincronizza subito i prodotti per allineare il bot
      syncTelegramProducts();
    });
  }

  // Telegram Token Input Change
  const tgTokenInput = document.getElementById("input-telegram-token");
  if (tgTokenInput) {
    tgTokenInput.addEventListener("input", (e) => {
      const tokenVal = e.target.value.trim();
      state.telegramConfig.token = tokenVal;
      saveToLocalStorage();
      // Notifica al server per avviare/fermare il polling
      fetch("http://localhost:3000/api/telegram/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: state.telegramConfig.token })
      }).catch(err => console.error("Errore registrazione bot polling:", err));

      // Avvia rilevamento automatico se viene inserito un token valido
      if (tokenVal.length > 35 && tokenVal.includes(":")) {
        runTelegramChatIdDetection(tokenVal, true);
      } else {
        // Se il token è vuoto o troppo corto, ferma qualsiasi ricerca attiva
        runTelegramChatIdDetection("", true);
      }
    });
  }

  // Telegram Chat ID Input Change
  const tgChatIdInput = document.getElementById("input-telegram-chatid");
  if (tgChatIdInput) {
    tgChatIdInput.addEventListener("input", (e) => {
      state.telegramConfig.chatId = e.target.value.trim();
      saveToLocalStorage();
    });
  }

  // Telegram Test Push Button Click
  const btnTestTg = document.getElementById("btn-test-telegram");
  if (btnTestTg) {
    btnTestTg.addEventListener("click", () => {
      const testMsg = `🔔 <b>TEST RADAR PUSH SUCCESSFUL!</b> 🔔\n\n` +
                      `Ottimo lavoro! Il tuo finto cellulare e il tuo account Telegram reale sono ora connessi in tempo reale con <b>Amazon Price Radar</b>.\n\n` +
                      `Riceverai allarmi push immediati ogni volta che rileveremo cali di prezzo sotto il tuo target!\n` +
                      `⏰ Ora di sistema: <code>${state.currentDate}</code>`;
      pushTelegramNotification(testMsg, "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500");
    });
  }

  // Telegram Trigger Briefing Button Click
  const btnTriggerBriefing = document.getElementById("btn-trigger-briefing");
  if (btnTriggerBriefing) {
    btnTriggerBriefing.addEventListener("click", async () => {
      if (state.products.length === 0) {
        showToast("Nessun Prodotto", "Aggiungi prima dei prodotti nel tuo radar per generare il briefing!", "warning");
        return;
      }
      
      const originalHtml = btnTriggerBriefing.innerHTML;
      btnTriggerBriefing.disabled = true;
      btnTriggerBriefing.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generazione...';
      
      showToast("Generazione Briefing", "L'AI sta analizzando il tuo radar prezzi... Un attimo.", "success");
      logToTerminal("Avviata generazione manuale del Morning Briefing con Gemini AI...", "system");
      
      try {
        const response = await fetch("http://localhost:3000/api/telegram/morning-briefing", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-gemini-key": state.geminiKey || ""
          },
          body: JSON.stringify({
            products: state.products,
            token: state.telegramConfig.token,
            chatId: state.telegramConfig.chatId
          })
        });
        
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || `Errore HTTP ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success) {
          showToast("Briefing Inviato!", "Il briefing AI è stato inviato con successo!", "success");
          logToTerminal(`Morning Briefing AI completato. Risposta inviata a Telegram. ${data.demo ? '(Simulato in modalità Demo)' : ''}`, "system");
          
          // Inietta finto push nello smartphone simulator
          appendVirtualTelegramMessage(`🌅 <b>AI Morning Briefing</b><br><br>${data.text.replace(/\n/g, '<br>')}`, 'system');
          
          playAlertSound();
        } else {
          throw new Error(data.message || "Errore sconosciuto.");
        }
      } catch (err) {
        console.error("Errore generazione briefing:", err);
        showToast("Errore Briefing", `Impossibile generare il briefing: ${err.message}`, "warning");
        logToTerminal(`ATTENZIONE: Generazione briefing fallita. Dettaglio: ${err.message}`, "warning");
      } finally {
        btnTriggerBriefing.disabled = false;
        btnTriggerBriefing.innerHTML = originalHtml;
      }
    });
  }

  // Telegram Chat ID Auto-Detection Click
  const btnDetectTg = document.getElementById("btn-detect-chatid");
  if (btnDetectTg) {
    btnDetectTg.addEventListener("click", () => {
      runTelegramChatIdDetection(state.telegramConfig.token, false);
    });
  }
}

// Switch tab panel utility
function switchTab(tabId) {
  state.activeTab = tabId;
  
  // Menu buttons update
  document.querySelectorAll(".menu-item").forEach(item => {
    if (item.getAttribute("data-target") === tabId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Tab Panels update
  document.querySelectorAll(".tab-panel").forEach(panel => {
    if (panel.getAttribute("id") === tabId) {
      panel.classList.add("active");
    } else {
      panel.classList.remove("active");
    }
  });

  // Se passiamo al tab Analisi, sincronizziamo il dropdown col prodotto visualizzato
  if (tabId === 'tab-analysis') {
    updatePredictiveAnalysis();
  }

  // Se passiamo al tab Chat AI, scrolliamo in basso e mettiamo il focus sull'input
  if (tabId === 'tab-chatai') {
    setTimeout(() => {
      const chatInput = document.getElementById("chat-user-message");
      if (chatInput) chatInput.focus();
      const chatContainer = document.getElementById("chat-messages-container");
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
  }

  // Se passiamo alla Dashboard e il grafico esiste, rifacciamo il resize per sicurezza
  if (tabId === 'tab-dashboard' && state.chartInstance) {
    setTimeout(() => {
      state.chartInstance.resize();
    }, 50);
  }
}

// ==========================================================================
// 4. LOGICA PRODOTTI (POPULATE, RENDER, SEARCH, ADD)
// ==========================================================================
function populateCategorySelects() {
  const filterSelect = document.getElementById("product-category-filter");
  const formSelect = document.getElementById("input-product-category");
  
  // Resetta i vecchi elementi
  filterSelect.innerHTML = "";
  formSelect.innerHTML = "";

  CATEGORIES.forEach(cat => {
    // Aggiungi a filtro
    const optFilter = document.createElement("option");
    optFilter.value = cat;
    optFilter.textContent = cat === "Tutti" ? "Tutte le Categorie" : cat;
    filterSelect.appendChild(optFilter);

    // Aggiungi a form modal (escludendo "Tutti")
    if (cat !== "Tutti") {
      const optForm = document.createElement("option");
      optForm.value = cat;
      optForm.textContent = cat;
      formSelect.appendChild(optForm);
    }
  });
}

function populateChartProductSelect() {
  const chartSelect = document.getElementById("chart-product-select");
  chartSelect.innerHTML = '<option value="all">Confronta tutti i prodotti</option>';
  
  state.products.forEach(prod => {
    const opt = document.createElement("option");
    opt.value = prod.id;
    opt.textContent = prod.title.length > 35 ? prod.title.substring(0, 35) + "..." : prod.title;
    chartSelect.appendChild(opt);
  });
}

function populateAnalysisProductSelect() {
  const analysisSelect = document.getElementById("analysis-product-select");
  analysisSelect.innerHTML = "";
  
  state.products.forEach(prod => {
    const opt = document.createElement("option");
    opt.value = prod.id;
    opt.textContent = prod.title;
    analysisSelect.appendChild(opt);
  });
}

function filterProductsBySearch(query) {
  if (state.activeTab !== 'tab-products') {
    switchTab('tab-products');
  }
  
  const cards = document.querySelectorAll("#products-grid-container .product-card");
  let foundCount = 0;
  
  cards.forEach(card => {
    const title = card.querySelector(".product-title-link").textContent.toLowerCase();
    const category = card.querySelector(".product-category-tag").textContent.toLowerCase();
    
    if (title.includes(query) || category.includes(query)) {
      card.style.display = "flex";
      foundCount++;
    } else {
      card.style.display = "none";
    }
  });

  if (query !== "") {
    logToTerminal(`Ricerca in corso per "${query}": trovati ${foundCount} risultati.`, "system");
  }
}

// Renderizzazione Dashboard
function renderDashboard() {
  // 1. Statistiche in cima
  document.getElementById("metric-total-products").textContent = state.products.length;
  document.getElementById("products-count-badge").textContent = state.products.length;
  
  // Calcolo Risparmio Potenziale cumulativo
  let potentialSavings = 0;
  let allTimeLowCount = 0;
  let activeAlerts = 0;

  state.products.forEach(prod => {
    // Risparmio = Prezzo Attuale - Prezzo Target (se il target è inferiore)
    if (prod.currentPrice > prod.targetPrice) {
      potentialSavings += (prod.currentPrice - prod.targetPrice);
    }
    
    // Controlla se siamo al minimo storico
    const prices = prod.history.map(h => h.price);
    const minPrice = Math.min(...prices);
    if (prod.currentPrice <= minPrice) {
      allTimeLowCount++;
    }

    if (prod.alertEnabled) {
      activeAlerts++;
    }
  });

  document.getElementById("metric-potential-savings").textContent = `${potentialSavings.toFixed(2)} €`;
  document.getElementById("metric-alltime-low").textContent = allTimeLowCount;
  document.getElementById("metric-active-alerts").textContent = activeAlerts;

  // 2. Popolamento delle migliori offerte del momento (maggiore percentuale di calo)
  const dealsGrid = document.getElementById("top-deals-grid");
  dealsGrid.innerHTML = "";

  // Calcola sconto percentuale e ordina
  const sortedDeals = [...state.products]
    .map(p => {
      const discountPercent = ((p.originalPrice - p.currentPrice) / p.originalPrice) * 100;
      return { ...p, discountPercent };
    })
    .sort((a, b) => b.discountPercent - a.discountPercent)
    .slice(0, 3); // Prendi i primi 3 sconti migliori

  sortedDeals.forEach(prod => {
    dealsGrid.appendChild(createProductCardElement(prod, true));
  });
}

// Renderizzazione Libreria dei Prodotti
function renderProductsGrid(categoryFilter = "Tutti") {
  const container = document.getElementById("products-grid-container");
  container.innerHTML = "";

  const filtered = categoryFilter === "Tutti" 
    ? state.products 
    : state.products.filter(p => p.category === categoryFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="glass text-center flex-column flex-grow" style="padding: 40px; grid-column: 1/-1; color: var(--text-secondary);">
        <i class="fa-solid fa-boxes-stacked" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 16px;"></i>
        <h3>Nessun prodotto trovato</h3>
        <p style="font-size: 0.85rem; margin-top: 4px;">Non ci sono prodotti tracciati in questa categoria. Prova ad aggiungerne uno nuovo!</p>
      </div>
    `;
    return;
  }

  filtered.forEach(prod => {
    container.appendChild(createProductCardElement(prod, false));
  });
}

// Genera il markup di una scheda prodotto
function createProductCardElement(prod, isMini = false) {
  const card = document.createElement("div");
  card.className = `product-card glass ${isMini ? 'mini-deal' : ''}`;
  card.id = `card-${prod.id}`;

  const discountPercent = ((prod.originalPrice - prod.currentPrice) / prod.originalPrice) * 100;
  const hasDiscount = discountPercent > 0.5;

  // Calcolo avanzamento target price
  let progressPercent = 0;
  const startPrice = prod.originalPrice;
  const current = prod.currentPrice;
  const target = prod.targetPrice;

  if (current <= target) {
    progressPercent = 100;
  } else if (startPrice > target) {
    // Percentuale di avanzamento del calo dal prezzo originale al target
    const totalDiff = startPrice - target;
    const currentDiff = startPrice - current;
    progressPercent = Math.max(0, Math.min(100, (currentDiff / totalDiff) * 100));
  }

  const isTargetReached = current <= target;

  card.innerHTML = `
    ${hasDiscount ? `<span class="card-badge-discount">-${discountPercent.toFixed(0)}% Sconto</span>` : ''}
    <div class="product-img-container">
      <img src="${prod.imageUrl || CATEGORY_IMAGES[prod.category]}" alt="${prod.title}" class="product-img" loading="lazy">
    </div>
    
    <div class="product-category-tag">${prod.category}</div>
    <a href="${prod.url}" target="_blank" class="product-title-link" title="${prod.title}">${prod.title}</a>
    
    <div class="product-rating-row">
      <div class="stars">
        ${getStarsHtml(prod.rating)}
      </div>
      <span>(${prod.reviewsCount} recensioni)</span>
    </div>

    <div class="product-price-info">
      <span class="price-current text-purple">${prod.currentPrice.toFixed(2)} €</span>
      ${hasDiscount ? `<span class="price-original">${prod.originalPrice.toFixed(2)} €</span>` : ''}
    </div>

    <div class="target-price-alert-box">
      <div class="target-price-header">
        <span>Obiettivo:</span>
        <span class="target-price-value ${isTargetReached ? 'text-green' : ''}">
          ${prod.targetPrice.toFixed(2)} € ${isTargetReached ? '<i class="fa-solid fa-circle-check"></i>' : ''}
        </span>
      </div>
      <div class="progress-bar-wrapper">
        <div class="progress-bar-fill ${isTargetReached ? 'target-reached' : ''}" style="width: ${progressPercent}%"></div>
      </div>
      <small style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px; text-align: right;">
        ${isTargetReached ? 'Obiettivo Raggiunto!' : `Target al ${progressPercent.toFixed(0)}%`}
      </small>
    </div>

    <div class="product-card-footer">
      <button class="alert-toggle-btn ${prod.alertEnabled ? 'active' : ''}" onclick="toggleProductAlert('${prod.id}')" title="${prod.alertEnabled ? 'Disattiva Avviso' : 'Attiva Avviso'}">
        <i class="fa-solid ${prod.alertEnabled ? 'fa-bell' : 'fa-bell-slash'}"></i>
      </button>
      
      <div class="card-actions-row">
        <button class="btn-icon" onclick="openEditTargetModal('${prod.id}')" title="Modifica Target">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="btn-icon btn-danger" onclick="deleteProduct('${prod.id}')" title="Elimina Prodotto">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
  `;

  return card;
}

function getStarsHtml(rating) {
  let html = "";
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.4;
  
  for (let i = 1; i <= 5; i++) {
    if (i <= fullStars) {
      html += '<i class="fa-solid fa-star"></i>';
    } else if (i === fullStars + 1 && halfStar) {
      html += '<i class="fa-solid fa-star-half-stroke"></i>';
    } else {
      html += '<i class="fa-regular fa-star"></i>';
    }
  }
  return html;
}

// Aggiunta di un nuovo prodotto da form
function addNewProduct() {
  const url = document.getElementById("input-product-url").value;
  const title = document.getElementById("input-product-title").value;
  const category = document.getElementById("input-product-category").value;
  const currentPrice = parseFloat(document.getElementById("input-product-price").value);
  const targetPrice = parseFloat(document.getElementById("input-target-price").value);
  const imageUrlInput = document.getElementById("input-product-image").value;

  // Analisi URL per estrarre l'ASIN (Amazon Standard Identification Number)
  let asin = "MOCK" + Math.floor(100000 + Math.random() * 900000);
  const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/) || url.match(/\/gp\/product\/([A-Z0-9]{10})/);
  if (asinMatch && asinMatch[1]) {
    asin = asinMatch[1];
  }

  // Generiamo uno storico prezzi di 30 giorni per rendere il grafico fin da subito bello
  const history = [];
  const startDay = new Date(state.currentDate);
  startDay.setDate(startDay.getDate() - 30);
  
  // Il prezzo originale simulato sarà leggermente superiore a quello inserito
  const originalPrice = currentPrice * (1.1 + Math.random() * 0.1);
  let walkPrice = originalPrice;

  for (let i = 0; i <= 30; i++) {
    const d = new Date(startDay);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    
    if (i === 30) {
      history.push({ date: dateStr, price: currentPrice });
    } else {
      // Fluttuazione casuale guidata verso il prezzo finale
      const stepsRemaining = 30 - i;
      const priceDiff = currentPrice - walkPrice;
      const trendStep = priceDiff / stepsRemaining;
      
      walkPrice += trendStep + (Math.random() - 0.5) * (currentPrice * 0.03);
      walkPrice = Math.max(currentPrice * 0.8, walkPrice); // no prezzi assurdi
      history.push({ date: dateStr, price: parseFloat(walkPrice.toFixed(2)) });
    }
  }

  const newProd = {
    id: "prod-" + Date.now(),
    asin: asin,
    title: title,
    url: url,
    imageUrl: imageUrlInput || CATEGORY_IMAGES[category],
    category: category,
    currentPrice: currentPrice,
    originalPrice: parseFloat(originalPrice.toFixed(2)),
    targetPrice: targetPrice,
    rating: parseFloat((4.2 + Math.random() * 0.8).toFixed(1)),
    reviewsCount: Math.floor(10 + Math.random() * 1200),
    volatility: Math.random() > 0.6 ? "Alta" : (Math.random() > 0.3 ? "Media" : "Bassa"),
    alertEnabled: true,
    history: history
  };

  state.products.push(newProd);
  saveToLocalStorage();
  
  // Log & Toast
  showToast("Prodotto Aggiunto", `Tracciamento avviato per "${title}"`, "success");
  logToTerminal(`Avviato tracciamento per il prodotto [${asin}] ${title} in categoria ${category}. Prezzo Iniziale: ${currentPrice}€, Target: ${targetPrice}€`, "system");

  // Aggiorna Interfaccia
  populateChartProductSelect();
  populateAnalysisProductSelect();
  renderDashboard();
  renderProductsGrid();
  updateChartData();
  updatePredictiveAnalysis();
  
  // Sync col bot Telegram
  syncTelegramProducts();
}

// Eliminazione di un prodotto
window.deleteProduct = function(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  if (confirm(`Sei sicuro di voler interrompere il tracciamento di "${prod.title}"?`)) {
    state.products = state.products.filter(p => p.id !== productId);
    saveToLocalStorage();
    
    showToast("Prodotto Rimosso", `Tracciamento interrotto per "${prod.title}"`, "warning");
    logToTerminal(`Tracciamento del prodotto "${prod.title}" rimosso dal database.`, "warning");

    populateChartProductSelect();
    populateAnalysisProductSelect();
    renderDashboard();
    renderProductsGrid();
    
    // Se stavamo visualizzando il grafico di questo prodotto, rimettiamo 'all'
    if (state.activeChartProduct === productId) {
      state.activeChartProduct = 'all';
      document.getElementById("chart-product-select").value = 'all';
    }
    
    updateChartData();
    updatePredictiveAnalysis();
    syncTelegramProducts();
  }
};

// Modifica Target Price rapido
window.openEditTargetModal = function(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  const newTarget = prompt(`Imposta un nuovo prezzo Target per:\n"${prod.title}"\nPrezzo Attuale: ${prod.currentPrice.toFixed(2)} €\nTarget Attuale: ${prod.targetPrice.toFixed(2)} €`, prod.targetPrice);
  
  if (newTarget !== null && !isNaN(parseFloat(newTarget))) {
    const parsedTarget = parseFloat(newTarget);
    if (parsedTarget <= 0) return alert("Inserisci un prezzo valido superiore a 0!");

    prod.targetPrice = parsedTarget;
    saveToLocalStorage();

    showToast("Target Aggiornato", `Nuovo target per "${prod.title}": ${parsedTarget.toFixed(2)} €`, "success");
    logToTerminal(`Target modificato per "${prod.title}". Nuovo target: ${parsedTarget.toFixed(2)} €`, "system");

    renderDashboard();
    renderProductsGrid();
    updatePredictiveAnalysis();
    syncTelegramProducts();
  }
};

// Toggle allerta singola scheda
window.toggleProductAlert = function(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  prod.alertEnabled = !prod.alertEnabled;
  saveToLocalStorage();

  showToast(
    prod.alertEnabled ? "Avviso Attivato" : "Avviso Silenziato", 
    `Le notifiche per "${prod.title}" sono state ${prod.alertEnabled ? 'attivate' : 'silenziate'}.`, 
    "success"
  );
  
  logToTerminal(`Notifiche per "${prod.title}" ${prod.alertEnabled ? 'ATTIVATE' : 'DISATTIVATE'}.`, "system");

  renderDashboard();
  renderProductsGrid();
};

// ==========================================================================
// 5. SISTEMA DI NOTIFICHE & AUDIO (WEB AUDIO API SYNTHESIZER)
// ==========================================================================
function renderNotificationsList() {
  const list = document.getElementById("notifications-list");
  list.innerHTML = "";

  if (state.notifications.length === 0) {
    list.innerHTML = `
      <div class="no-notifications">
        <i class="fa-solid fa-circle-check"></i>
        <p>Nessun nuovo avviso di prezzo. Tutto sotto controllo!</p>
      </div>
    `;
    return;
  }

  // Mostra prima le notifiche più recenti (reverse order)
  const reversed = [...state.notifications].reverse().slice(0, 15); // max 15 notifiche in lista
  
  reversed.forEach(notif => {
    const item = document.createElement("div");
    item.className = "notification-item";
    
    let iconClass = "fa-bell";
    if (notif.type === 'danger') iconClass = "fa-circle-down";
    if (notif.type === 'success') iconClass = "fa-arrow-trend-down";
    if (notif.type === 'warning') iconClass = "fa-triangle-exclamation";

    item.innerHTML = `
      <div class="notification-icon-wrapper ${notif.type}">
        <i class="fa-solid ${iconClass}"></i>
      </div>
      <div class="notification-details">
        <span class="notification-msg">${notif.message}</span>
        <span class="notification-time">${notif.time}</span>
      </div>
    `;
    list.appendChild(item);
  });
}

function addNotification(message, type = 'success') {
  const now = new Date();
  const timeStr = `${state.currentDate} alle ${now.toTimeString().split(' ')[0].substring(0, 5)}`;
  
  const newNotif = {
    id: "notif-" + Date.now() + Math.random(),
    message: message,
    type: type, // 'success', 'warning', 'danger'
    time: timeStr
  };

  state.notifications.push(newNotif);
  
  // Limita a 50 notifiche salvate
  if (state.notifications.length > 50) {
    state.notifications.shift();
  }

  saveToLocalStorage();
  renderNotificationsList();
}

// Toast notification popups
function showToast(title, message, type = "success") {
  const container = document.getElementById("toast-container");
  
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let iconHtml = '<i class="fa-solid fa-circle-check"></i>';
  if (type === 'warning') iconHtml = '<i class="fa-solid fa-circle-exclamation"></i>';
  if (type === 'danger') iconHtml = '<i class="fa-solid fa-circle-down"></i>';

  toast.innerHTML = `
    <div class="toast-icon">${iconHtml}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>
  `;

  container.appendChild(toast);
  
  // Anima entrata
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  // Auto chiusura dopo 5 secondi
  const autoClose = setTimeout(() => {
    closeToast(toast);
  }, 5000);

  // Chiudi cliccando sulla X
  toast.querySelector(".toast-close").addEventListener("click", () => {
    clearTimeout(autoClose);
    closeToast(toast);
  });
}

function closeToast(toast) {
  toast.classList.remove("show");
  // Attendi che finisca la transizione e rimuovi dal DOM
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 400);
}

// Sintetizzatore Web Audio API per suono allarme personalizzato
function playAlertSound(force = false) {
  if (!state.soundEnabled && !force) return;

  try {
    // Inizializza l'audio context (supporto multi-browser)
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    
    // Tono 1: Nota La5 (880 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    
    // Configura volume ed inviluppo per suono morbido e tech
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.start();
    osc1.stop(ctx.currentTime + 0.15);

    // Tono 2 (in ritardo di 120ms): Nota Do#6 (1100 Hz) per dare un feedback armonico positivo
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1100, ctx.currentTime);
      
      gain2.gain.setValueAtTime(0.08, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc2.start();
      osc2.stop(ctx.currentTime + 0.2);
    }, 120);

  } catch (err) {
    console.warn("L'autoplay o il Web Audio non è supportato o attivo prima dell'interazione utente:", err);
  }
}

// ==========================================================================
// 6. INTEGRAZIONE CON CHART.JS (DISEGNO GRAFICI)
// ==========================================================================
function initChart() {
  const ctx = document.getElementById("main-price-chart").getContext("2d");
  
  // Impostiamo font globale di Chart.js coordinato col foglio di stile
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = '#9ca3af';

  const chartConfig = getChartConfig();
  state.chartInstance = new Chart(ctx, chartConfig);
}

function getChartConfig() {
  const chartData = getChartDataset();
  
  return {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
            color: '#9ca3af',
            font: {
              size: 11,
              weight: 500
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(139, 92, 246, 0.3)',
          borderWidth: 1,
          titleColor: '#fff',
          titleFont: { family: "'Outfit', sans-serif", weight: 700 },
          bodyColor: '#f3f4f6',
          bodyFont: { family: "'Inter', sans-serif" },
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) label += context.parsed.y.toFixed(2) + ' €';
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.03)',
            borderColor: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.03)',
            borderColor: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            font: { size: 10 },
            callback: function(value) {
              return value + ' €';
            }
          }
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      elements: {
        line: {
          tension: 0.35 // Curve morbide ed eleganti
        },
        point: {
          radius: 3,
          hoverRadius: 6,
          backgroundColor: '#8b5cf6'
        }
      }
    }
  };
}

// Estrazione e filtraggio dei dati per i dataset del grafico
function getChartDataset() {
  const period = state.activeChartPeriod; // 'all', '30', '7'
  const productId = state.activeChartProduct;
  
  // Definiamo i colori preimpostati per i grafici
  const colors = [
    { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.05)' }, // Viola
    { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.05)' }, // Smeraldo
    { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.05)' }, // Blu
    { stroke: '#ff9900', fill: 'rgba(255, 153, 0, 0.05)' }, // Amazon Arancio
    { stroke: '#f43f5e', fill: 'rgba(244, 63, 94, 0.05)' }, // Corallo
    { stroke: '#ec4899', fill: 'rgba(236, 72, 153, 0.05)' }  // Rosa
  ];

  // 1. Raccogliamo tutte le date uniche ordinate
  let allDates = [];
  state.products.forEach(p => {
    p.history.forEach(h => {
      if (!allDates.includes(h.date)) allDates.push(h.date);
    });
  });
  
  allDates.sort((a, b) => new Date(a) - new Date(b));

  // Filtriamo le date in base al periodo richiesto
  if (period !== 'all') {
    const daysLimit = parseInt(period);
    const limitDate = new Date(state.currentDate);
    limitDate.setDate(limitDate.getDate() - daysLimit);
    allDates = allDates.filter(d => new Date(d) >= limitDate);
  }

  const datasets = [];

  // Se dobbiamo visualizzare un prodotto specifico
  if (productId !== 'all') {
    const prod = state.products.find(p => p.id === productId);
    if (prod) {
      const dataPoints = [];
      
      allDates.forEach(date => {
        // Troviamo il prezzo a quella data, oppure cerchiamo il più vicino precedente
        const histEntry = prod.history.find(h => h.date === date);
        if (histEntry) {
          dataPoints.push(histEntry.price);
        } else {
          // Fallback al precedente storico disponibile
          const prevs = prod.history.filter(h => new Date(h.date) <= new Date(date));
          if (prevs.length > 0) {
            dataPoints.push(prevs[prevs.length - 1].price);
          } else {
            dataPoints.push(null);
          }
        }
      });

      // Configurazione gradiente di sfondo sotto la curva del prodotto singolo
      const canvas = document.getElementById("main-price-chart");
      let gradient = 'rgba(139, 92, 246, 0.03)';
      if (canvas) {
        const ctx = canvas.getContext("2d");
        gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
      }

      datasets.push({
        label: prod.title.length > 30 ? prod.title.substring(0, 30) + '...' : prod.title,
        data: dataPoints,
        borderColor: '#8b5cf6',
        backgroundColor: gradient,
        borderWidth: 3,
        fill: true,
        pointBackgroundColor: '#8b5cf6',
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        tension: 0.3
      });
    }
  } else {
    // Confronto multi-prodotto (visualizziamo tutti i prodotti con colori diversi)
    state.products.forEach((prod, index) => {
      const color = colors[index % colors.length];
      const dataPoints = [];

      allDates.forEach(date => {
        const histEntry = prod.history.find(h => h.date === date);
        if (histEntry) {
          dataPoints.push(histEntry.price);
        } else {
          const prevs = prod.history.filter(h => new Date(h.date) <= new Date(date));
          if (prevs.length > 0) {
            dataPoints.push(prevs[prevs.length - 1].price);
          } else {
            dataPoints.push(null);
          }
        }
      });

      datasets.push({
        label: prod.title.length > 20 ? prod.title.substring(0, 20) + '...' : prod.title,
        data: dataPoints,
        borderColor: color.stroke,
        backgroundColor: 'transparent',
        borderWidth: 2,
        fill: false,
        pointRadius: 2,
        tension: 0.3
      });
    });
  }

  // Formattiamo le etichette delle date in un formato italiano leggibile (es: "15 Mag")
  const labels = allDates.map(d => {
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]}`;
  });

  return { labels, datasets };
}

function updateChartData() {
  if (!state.chartInstance) return;
  
  const newData = getChartDataset();
  state.chartInstance.data = newData;
  
  // Ricalcoliamo il gradiente se passiamo a visualizzazione singola
  if (state.activeChartProduct !== 'all') {
    const canvas = document.getElementById("main-price-chart");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
      gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
      state.chartInstance.data.datasets[0].backgroundColor = gradient;
    }
  }

  state.chartInstance.update();
}

// ==========================================================================
// 7. ANALISI PREDITTIVA & REPORT AI
// ==========================================================================
function updatePredictiveAnalysis() {
  const select = document.getElementById("analysis-product-select");
  if (!select) return;

  const productId = select.value || (state.products.length > 0 ? state.products[0].id : null);
  if (!productId) return;

  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  // 1. Calcoli Statistici dallo storico
  const historyPrices = prod.history.map(h => h.price);
  const current = prod.currentPrice;
  const min = Math.min(...historyPrices);
  const max = Math.max(...historyPrices);
  
  const sum = historyPrices.reduce((a, b) => a + b, 0);
  const avg = sum / historyPrices.length;
  
  // Calcolo deviazione standard per determinare la volatilità reale
  const sqDiffs = historyPrices.map(p => Math.pow(p - avg, 2));
  const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / sqDiffs.length;
  const stdDev = Math.sqrt(avgSqDiff);
  const volatilityPercent = (stdDev / avg) * 100;
  
  let calculatedVolatility = "Bassa";
  if (volatilityPercent > 5) calculatedVolatility = "Alta";
  else if (volatilityPercent > 2) calculatedVolatility = "Media";

  // Aggiorna metriche testuali
  document.getElementById("stat-current-price").textContent = `${current.toFixed(2)} €`;
  document.getElementById("stat-max-price").textContent = `${max.toFixed(2)} €`;
  document.getElementById("stat-min-price").textContent = `${min.toFixed(2)} €`;
  document.getElementById("stat-avg-price").textContent = `${avg.toFixed(2)} €`;
  
  const volBadge = document.getElementById("stat-volatility-badge");
  volBadge.textContent = `${calculatedVolatility} (${volatilityPercent.toFixed(1)}%)`;
  volBadge.className = "stat-value";
  if (calculatedVolatility === "Alta") volBadge.classList.add("text-red");
  else if (calculatedVolatility === "Bassa") volBadge.classList.add("text-green");
  else volBadge.classList.add("text-purple");

  // Calcola frequenza cambi prezzo
  let changeCount = 0;
  for (let i = 1; i < prod.history.length; i++) {
    if (prod.history[i].price !== prod.history[i-1].price) changeCount++;
  }
  const avgFreqDays = changeCount > 0 ? (prod.history.length / changeCount).toFixed(0) : "N/D";
  document.getElementById("stat-change-frequency").textContent = changeCount > 0 ? `Ogni ${avgFreqDays} giorni` : "Nessun cambio registrato";

  // 2. LOGICA INDICATORE AI (Gauges e Consiglio)
  // Il punteggio (da 0 a 100%) esprime quanto il prezzo sia favorevole (vicino al minimo storico)
  let buyScore = 0;
  if (max !== min) {
    buyScore = ((max - current) / (max - min)) * 100;
  } else {
    buyScore = 50; // prezzo piatto
  }

  // Correzione in base al prezzo target
  if (current <= prod.targetPrice) {
    buyScore = Math.min(100, buyScore + 15);
  }

  buyScore = Math.max(5, Math.min(95, buyScore)); // mantieni entro i limiti grafici

  // Orientamento lancetta: -90deg è 0% (sinistra/rosso), 90deg è 100% (destra/verde)
  const angle = -90 + (buyScore / 100) * 180;
  document.getElementById("gauge-needle").style.transform = `rotate(${angle}deg)`;
  document.getElementById("gauge-advice-percentage").textContent = `${buyScore.toFixed(0)}%`;

  const adviceLabel = document.getElementById("gauge-advice-label");
  const adviceSummary = document.getElementById("predictor-summary-text");
  
  let labelText = "";
  let summaryText = "";
  let badgeColorClass = "";

  if (buyScore >= 75) {
    labelText = "COMPRA ORA";
    badgeColorClass = "text-green";
    summaryText = `Il prezzo attuale di ${current.toFixed(2)} € è estremamente basso, vicino al minimo storico di ${min.toFixed(2)} €. Il nostro algoritmo indica che è improbabile un ulteriore calo nel breve termine. Ottimo affare!`;
  } else if (buyScore >= 50) {
    labelText = "MOLTO BUONO";
    badgeColorClass = "text-purple";
    summaryText = `Prezzo inferiore alla media storica del periodo. È una buona finestra d'acquisto, specialmente se hai urgenza di ricevere il prodotto.`;
  } else if (buyScore >= 25) {
    labelText = "ATTENDI CALO";
    badgeColorClass = "text-purple";
    summaryText = `Il prezzo si trova in una fascia medio-alta. Suggeriamo di attendere sconti. Ti conviene mantenere attivo il tuo target price di ${prod.targetPrice.toFixed(2)} € ed essere paziente.`;
  } else {
    labelText = "NON COMPRARE";
    badgeColorClass = "text-red";
    summaryText = `Prezzo vicino ai massimi storici di ${max.toFixed(2)} €. Comprare in questo momento significa strapagare il prodotto. Si consiglia vivamente di attendere i trend ribassisti.`;
  }

  adviceLabel.textContent = labelText;
  adviceLabel.className = `label ${badgeColorClass}`;
  adviceSummary.textContent = summaryText;

  // 3. Generazione report di mercato AI dettagliato
  const insightsBox = document.getElementById("analysis-insights-box");
  insightsBox.innerHTML = `
    <div class="insight-block">
      <div class="insight-block-header">
        <i class="fa-solid fa-compass-drafting"></i>
        <span>Andamento del Trend</span>
      </div>
      <p>Nelle ultime 4 settimane, il prodotto ha mostrato una volatilità ${calculatedVolatility.toLowerCase()}. Il prezzo medio si attesta su ${avg.toFixed(2)} €. Rispetto a questo valore, oggi stai risparmiando ben <strong>${(avg - current > 0 ? (avg - current).toFixed(2) : 0)} €</strong>.</p>
    </div>

    <div class="insight-block">
      <div class="insight-block-header">
        <i class="fa-solid fa-calendar-days"></i>
        <span>Analisi Stagionale e Prime Day</span>
      </div>
      <p>I dati storici su prodotti simili nella categoria <strong>${prod.category}</strong> indicano che i periodi di picco degli sconti si concentrano solitamente a metà estate (Prime Day a Luglio) e fine autunno (Black Friday). Se puoi aspettare, questi eventi potrebbero portare il prezzo a circa il 15-20% in meno rispetto a oggi.</p>
    </div>

    <div class="insight-block">
      <div class="insight-block-header">
        <i class="fa-solid fa-shield-halved"></i>
        <span>Affidabilità del Venditore</span>
      </div>
      <p>Prodotto venduto e spedito da Amazon. Massima garanzia sul prezzo minimo garantito e reso esteso fino a 30 giorni. Consigliamo di effettuare l'acquisto se il consiglio sopra indica '${labelText}'.</p>
    </div>
  `;
}

// ==========================================================================
// 8. MOTORE DI SIMULAZIONE TEMPORALE (TIME MACHINE PANEL)
// ==========================================================================
function updateSimulationDateUI() {
  const d = new Date(state.currentDate);
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  document.getElementById("current-simulation-date").textContent = d.toLocaleDateString('it-IT', options);
}

function logToTerminal(message, type = "") {
  const terminal = document.getElementById("simulator-terminal-log");
  if (!terminal) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  
  const line = document.createElement("div");
  line.className = `terminal-line ${type}`;
  line.innerHTML = `<span class="terminal-time">[${timeStr}]</span> ${message}`;
  
  terminal.appendChild(line);
  
  // Auto scroll in fondo alla console
  terminal.scrollTop = terminal.scrollHeight;
}

// Simulazione avanzamento temporale
function simulateTime(days) {
  logToTerminal(`Avvio simulazione di avanzamento tempo: +${days} giorn${days === 1 ? 'o' : 'i'}...`, "system");
  
  const currentDateObj = new Date(state.currentDate);

  for (let d = 1; d <= days; d++) {
    // Avanza di un giorno
    currentDateObj.setDate(currentDateObj.getDate() + 1);
    const dateStr = currentDateObj.toISOString().split('T')[0];
    
    // Per ogni giorno simulato, aggiorna i prezzi di tutti i prodotti
    state.products.forEach(prod => {
      // Determina il fattore di oscillazione casuale in base alla volatilità del prodotto
      let maxChange = 0.02; // Bassa: +/- 2%
      if (prod.volatility === "Media") maxChange = 0.04; // Media: +/- 4%
      if (prod.volatility === "Alta") maxChange = 0.07;  // Alta: +/- 7%

      // Aggiunge un leggero bias ribassista per rendere la simulazione attraente (es. sconti)
      const randomFactor = (Math.random() - 0.52) * maxChange; 
      const oldPrice = prod.currentPrice;
      let newPrice = oldPrice * (1 + randomFactor);
      
      // Limitiamo il prezzo in modo che non scenda sotto il 50% dell'originale e non superi il 120%
      newPrice = Math.max(prod.originalPrice * 0.45, Math.min(prod.originalPrice * 1.25, newPrice));
      prod.currentPrice = parseFloat(newPrice.toFixed(2));

      // Salva nel log della cronologia del prodotto
      prod.history.push({ date: dateStr, price: prod.currentPrice });

      // Se superiamo le 60 date nello storico, rimuoviamo la più vecchia per non appesantire
      if (prod.history.length > 90) {
        prod.history.shift();
      }

      // Controlla se abbiamo attivato degli alert
      checkPriceAlerts(prod, oldPrice);
    });
  }

  // Aggiorna lo stato della data
  state.currentDate = currentDateObj.toISOString().split('T')[0];
  saveToLocalStorage();
  
  // Aggiorna tutta l'interfaccia utente
  updateSimulationDateUI();
  renderDashboard();
  renderProductsGrid();
  updateChartData();
  updatePredictiveAnalysis();

  logToTerminal(`Tempo simulato aggiornato al ${state.currentDate}. Storici ricalcolati con successo.`, "system");
  showToast("Tempo Avanzato", `Sei andato avanti nel futuro di ${days} giorn${days === 1 ? 'o' : 'i'}!`, "success");
  
  // Sync col bot dopo simulazione
  syncTelegramProducts();

  // Trigger automatico del Morning Briefing per il nuovo giorno simulato
  setTimeout(async () => {
    logToTerminal(`[Simulatore AI] Generazione del briefing del mattino per il giorno ${state.currentDate}...`, "system");
    try {
      const response = await fetch("http://localhost:3000/api/telegram/morning-briefing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-key": state.geminiKey || ""
        },
        body: JSON.stringify({
          products: state.products,
          token: state.telegramConfig.token,
          chatId: state.telegramConfig.chatId
        })
      });
      const data = await response.json();
      if (data.success) {
        appendVirtualTelegramMessage(`🌅 <b>AI Morning Briefing (${state.currentDate})</b><br><br>${data.text.replace(/\n/g, '<br>')}`, 'system');
      }
    } catch(e) {
      console.warn("Briefing temporale fallito:", e);
    }
  }, 1000);
}

// Analizzatore degli allarmi al calo dei prezzi
function checkPriceAlerts(prod, oldPrice) {
  const current = prod.currentPrice;
  const target = prod.targetPrice;
  
  // Caso 1: Raggiunto o sceso sotto il Target Price
  if (current <= target && oldPrice > target && prod.alertEnabled) {
    const alertMsg = `🎯 OBIETTIVO RAGGIUNTO! "${prod.title}" è sceso a ${current.toFixed(2)} € (Target impostato: ${target.toFixed(2)} €)`;
    addNotification(alertMsg, "danger");
    showToast("Target Raggiunto!", alertMsg, "danger");
    logToTerminal(`ALERT: Target raggiunto per "${prod.title}"! Prezzo sceso da ${oldPrice.toFixed(2)}€ a ${current.toFixed(2)}€ (Target: ${target.toFixed(2)}€).`, "alert");
    playAlertSound();
    
    // Telegram Alert Push
    const tgMsg = `🎯 <b>TARGET PREZZO RAGGIUNTO!</b> 🎯\n\n` +
                  `Il prodotto <a href="${prod.url}"><b>${prod.title}</b></a> è sceso a soli <b>${current.toFixed(2)} €</b>!\n` +
                  `• Target impostato: <b>${target.toFixed(2)} €</b>\n` +
                  `• Risparmio accumulato: <b>${(prod.originalPrice - current).toFixed(2)} €</b> rispetto al listino originale.\n` +
                  `👉 Approfitta subito dell'affare su Amazon!`;
    pushTelegramNotification(tgMsg, prod.imageUrl);
  } 
  // Caso 2: Forte calo improvviso (sconto superiore al 10% in un solo colpo)
  else if (current < oldPrice * 0.9) {
    const dropPercent = ((oldPrice - current) / oldPrice) * 100;
    const msg = `⚡ CROLLO PREZZO! "${prod.title}" è sceso del ${dropPercent.toFixed(0)}%! Ora a soli ${current.toFixed(2)} €`;
    addNotification(msg, "success");
    showToast("Crollo Prezzo!", msg, "success");
    logToTerminal(`OFFERTA: Rilevato crollo prezzo del -${dropPercent.toFixed(0)}% su "${prod.title}". Da ${oldPrice.toFixed(2)}€ a ${current.toFixed(2)}€!`, "warning");
    playAlertSound();
    
    // Telegram Alert Push
    const tgMsg = `⚡ <b>CROLLO PREZZO RILEVATO! (-${dropPercent.toFixed(0)}%)</b> ⚡\n\n` +
                  `Prezzo crollato sul prodotto <a href="${prod.url}"><b>${prod.title}</b></a>!\n` +
                  `• Prezzo precedente: <s>${oldPrice.toFixed(2)} €</s>\n` +
                  `• Nuovo prezzo: <b>${current.toFixed(2)} €</b>\n` +
                  `🔥 Il radar consiglia vivamente di monitorare l'acquisto prima che il prezzo risalga!`;
    pushTelegramNotification(tgMsg, prod.imageUrl);
  }
}

// Evento speciale simulator: Black Friday
function triggerSpecialMarketEvent() {
  logToTerminal(`*** ATTIVAZIONE EVENTO SPECIALE: VENDITE STRAORDINARIE BLACK FRIDAY! ***`, "alert");
  
  const currentDateObj = new Date(state.currentDate);
  currentDateObj.setDate(currentDateObj.getDate() + 1); // avanza di un giorno
  const dateStr = currentDateObj.toISOString().split('T')[0];

  state.products.forEach(prod => {
    const oldPrice = prod.currentPrice;
    
    // Taglio netto dei prezzi dal 15% al 42%
    const bfDiscount = 0.15 + Math.random() * 0.27;
    const newPrice = oldPrice * (1 - bfDiscount);
    
    prod.currentPrice = parseFloat(newPrice.toFixed(2));
    prod.history.push({ date: dateStr, price: prod.currentPrice });

    if (prod.history.length > 90) {
      prod.history.shift();
    }

    logToTerminal(`SCONTO BLACK FRIDAY: "${prod.title}" tagliato del ${(bfDiscount*100).toFixed(0)}%. Prezzo: ${oldPrice.toFixed(2)}€ ➔ ${prod.currentPrice.toFixed(2)}€!`, "warning");
    
    // Controlla allarmi
    checkPriceAlerts(prod, oldPrice);
  });

  state.currentDate = dateStr;
  saveToLocalStorage();

  updateSimulationDateUI();
  renderDashboard();
  renderProductsGrid();
  updateChartData();
  updatePredictiveAnalysis();

  showToast("EVENTO SPECIALE", "Sconti massicci simulati su tutti i prodotti! Controlla la dashboard!", "danger");
  logToTerminal(`Simulazione Black Friday completata. Nuovi dati salvati.`, "system");
  
  // Notifica su Telegram e sync prodotti
  const bfMsg = `🖤 <b>SCONTI BLACK FRIDAY ATTIVI!</b> 🖤\n\n` +
                `Il simulatore ha forzato sconti spettacolari fino al 40% su tutti i tuoi prodotti monitorati!\n` +
                `Controlla subito la Dashboard per approfittare delle offerte!`;
  pushTelegramNotification(bfMsg, "https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=500");
  syncTelegramProducts();
}

// ==========================================================================
// 9. INTEGRAZIONE CON LO SCRAPER REALE (NODE.JS SERVER ON PORT 3000)
// ==========================================================================

// Autocompilazione da link Amazon reale
async function verifyAmazonUrlAndAutocompila() {
  const urlInput = document.getElementById("input-product-url");
  const btnVerify = document.getElementById("btn-verify-url");
  const url = urlInput.value.trim();

  if (!url) {
    showToast("URL Mancante", "Inserisci prima un link Amazon valido da verificare!", "warning");
    return;
  }

  // Animazione pulsante caricamento
  const originalHtml = btnVerify.innerHTML;
  btnVerify.disabled = true;
  btnVerify.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Estrazione...';

  logToTerminal(`Avvio scraping in tempo reale per l'URL fornito...`, "system");

  try {
    const response = await fetch(`http://localhost:3000/api/scrape?url=${encodeURIComponent(url)}`);
    
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message || `Errore HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      // Autocompila i campi del form nel modal
      document.getElementById("input-product-title").value = data.title;
      document.getElementById("input-product-price").value = data.price;
      
      if (data.imageUrl) {
        document.getElementById("input-product-image").value = data.imageUrl;
      }

      showToast("Collegamento Riuscito!", "Dati estratti con successo da Amazon!", "success");
      logToTerminal(`Scraping completato con successo. Titolo: "${data.title.substring(0, 30)}...", Prezzo Rilevato: ${data.price}€`, "system");
    } else {
      throw new Error(data.message || "Errore sconosciuto durante lo scraping.");
    }

  } catch (err) {
    console.error("Errore di autocompilazione:", err);
    showToast(
      "Autocompilazione Fallita", 
      "Impossibile collegarsi ad Amazon. Verifica che il server Node.js sia attivo o inserisci i dati manualmente.", 
      "warning"
    );
    logToTerminal(`ATTENZIONE: Scraping fallito. Dettaglio: ${err.message}. Puoi comunque compilare manualmente.`, "warning");
  } finally {
    // Ripristina stato pulsante
    btnVerify.disabled = false;
    btnVerify.innerHTML = originalHtml;
  }
}

// Sincronizzazione in tempo reale di tutti i prezzi dei prodotti tracciati
async function syncRealAmazonPrices() {
  const btnSync = document.getElementById("btn-sync-prices");
  if (state.products.length === 0) {
    showToast("Nessun Prodotto", "Non ci sono prodotti tracciati da sincronizzare!", "warning");
    return;
  }

  const originalHtml = btnSync.innerHTML;
  btnSync.disabled = true;
  btnSync.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizzazione...';

  logToTerminal(`*** AVVIO AGGIORNAMENTO PREZZI REALI IN TEMPO REALE DA AMAZON ***`, "system");
  showToast("Sincronizzazione", "Aggiornamento dei prezzi reali in corso... Attendi.", "success");

  let successCount = 0;
  let failCount = 0;

  for (const prod of state.products) {
    // Salta i prodotti mock che non hanno un vero URL Amazon funzionante (o gestiscili con grazia)
    if (prod.url.startsWith("https://www.amazon.it") || prod.url.startsWith("https://www.amazon.com")) {
      logToTerminal(`Sincronizzazione in corso per: "${prod.title.substring(0, 30)}..."`, "system");
      
      try {
        const response = await fetch(`http://localhost:3000/api/scrape?url=${encodeURIComponent(prod.url)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (data.success && data.price !== null) {
          const oldPrice = prod.currentPrice;
          const newPrice = data.price;
          
          prod.currentPrice = newPrice;
          
          // Se la foto è segnaposto e abbiamo trovato la foto reale, la aggiorniamo
          if (data.imageUrl && (prod.imageUrl.includes("unsplash") || !prod.imageUrl)) {
            prod.imageUrl = data.imageUrl;
          }

          // Aggiungiamo l'andamento reale allo storico usando la data corrente di simulazione
          // per mantenere coerenza visiva immediata
          const dateStr = state.currentDate;
          
          // Controlliamo se esiste già una rilevazione per questo giorno, altrimenti l'aggiungiamo
          const todayEntry = prod.history.find(h => h.date === dateStr);
          if (todayEntry) {
            todayEntry.price = newPrice;
          } else {
            prod.history.push({ date: dateStr, price: newPrice });
          }

          if (prod.history.length > 90) {
            prod.history.shift();
          }

          logToTerminal(`Aggiornato: "${prod.title.substring(0, 25)}..." da ${oldPrice.toFixed(2)}€ a ${newPrice.toFixed(2)}€`, "system");
          
          // Esegui controlli degli alert prezzo
          checkPriceAlerts(prod, oldPrice);
          successCount++;
        } else {
          throw new Error(data.message || "Risposta incompleta");
        }
      } catch (err) {
        failCount++;
        logToTerminal(`Sincronizzazione fallita per "${prod.title.substring(0, 25)}...". Dettaglio: ${err.message}`, "warning");
      }
    } else {
      // Per i prodotti mock non Amazon.it/com reali, facciamo una fluttuazione guidata simulata per coerenza
      const oldPrice = prod.currentPrice;
      const change = (Math.random() - 0.52) * (prod.volatility === "Alta" ? 0.05 : 0.02);
      prod.currentPrice = parseFloat((oldPrice * (1 + change)).toFixed(2));
      
      const todayEntry = prod.history.find(h => h.date === state.currentDate);
      if (todayEntry) todayEntry.price = prod.currentPrice;
      else prod.history.push({ date: state.currentDate, price: prod.currentPrice });

      checkPriceAlerts(prod, oldPrice);
      successCount++;
    }
  }

  saveToLocalStorage();

  // Rinfresca UI
  renderDashboard();
  renderProductsGrid();
  updateChartData();
  updatePredictiveAnalysis();

  btnSync.disabled = false;
  btnSync.innerHTML = originalHtml;

  logToTerminal(`*** FINE AGGIORNAMENTO LIVE: Sincronizzati ${successCount} prodotti (${failCount} falliti) ***`, "system");
  
  if (failCount > 0) {
    showToast("Sync Parziale", `Sincronizzazione completata con ${failCount} errori. Assicurati che il server locale sia attivo!`, "warning");
  } else {
    showToast("Sync Completato", "Tutti i prezzi correnti sono stati allineati a quelli reali di Amazon!", "success");
  }
  
  // Notifica Telegram del sync e aggiornamento prodotti
  const syncMsg = `🔄 <b>ALLINEAMENTO PREZZI LIVE COMPLETATO</b> 🔄\n\n` +
                  `I prezzi correnti sul tuo radar sono stati aggiornati confrontandoli in tempo reale con le pagine Amazon!\n` +
                  `• Successi: <b>${successCount}</b>\n` +
                  `• Falliti: <b>${failCount}</b>`;
  pushTelegramNotification(syncMsg, "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500");
  syncTelegramProducts();
}

// ==========================================================================
// 10. FUNZIONALITÀ GOOGLE GEMINI AI (ANALIZZATORE E CHATBOT)
// ==========================================================================

// Analizzatore di Recensioni con Gemini
async function analyzeReviewsWithGemini() {
  const select = document.getElementById("analysis-product-select");
  if (!select) return;

  const productId = select.value;
  if (!productId) {
    showToast("Nessun Prodotto", "Seleziona prima un prodotto da analizzare!", "warning");
    return;
  }

  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  const btnAnalyze = document.getElementById("btn-analyze-reviews");
  const insightsBox = document.getElementById("analysis-insights-box");

  // Salva stato originale
  const originalHtml = btnAnalyze.innerHTML;
  btnAnalyze.disabled = true;
  btnAnalyze.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analisi in corso...';

  // Caricamento visivo (radar scan)
  insightsBox.innerHTML = `
    <div class="ai-cta-box text-center flex-column" style="display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 40px 20px;">
      <i class="fa-solid fa-circle-notch fa-spin text-purple" style="font-size: 3rem; filter: drop-shadow(0 0 10px var(--accent-purple-glow));"></i>
      <h3 style="font-family: var(--font-heading); font-weight: 600; font-size: 1.05rem; color: #fff;">Scansione Recensioni...</h3>
      <p style="font-size: 0.8rem; line-height: 1.45; max-width: 90%; color: var(--text-secondary);">Sto leggendo le opinioni dei clienti su Amazon e interrogando l'intelligenza artificiale Google Gemini. Un momento...</p>
    </div>
  `;

  logToTerminal(`Avvio analisi recensioni AI con Gemini per: "${prod.title.substring(0, 30)}..."`, "system");

  try {
    const response = await fetch("http://localhost:3000/api/gemini/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-key": state.geminiKey || ""
      },
      body: JSON.stringify({
        url: prod.url,
        title: prod.title,
        demo: !state.geminiKey
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      // Formattiamo le liste dei pros e dei cons
      const prosHtml = data.pros.map(pro => `<li><i class="fa-solid fa-circle-check" style="color: var(--accent-emerald);"></i> ${escapeHTML(pro)}</li>`).join('');
      const consHtml = data.cons.map(con => `<li><i class="fa-solid fa-circle-xmark" style="color: var(--accent-coral);"></i> ${escapeHTML(con)}</li>`).join('');

      insightsBox.innerHTML = `
        <div class="review-report-verdict" style="margin-top: 0; animation: chat-bubble-in 0.3s ease-out;">
          <strong style="color: #fff;"><i class="fa-solid fa-brain text-purple"></i> Verdetto AI:</strong> ${escapeHTML(data.verdict)}
        </div>
        <div class="review-report-grid" style="animation: chat-bubble-in 0.4s ease-out;">
          <div class="review-report-card pros">
            <div class="review-report-title pros">
              <i class="fa-solid fa-circle-check"></i> I PUNTI DI FORZA
            </div>
            <ul class="review-report-list">
              ${prosHtml}
            </ul>
          </div>
          <div class="review-report-card cons">
            <div class="review-report-title cons">
              <i class="fa-solid fa-circle-xmark"></i> I PUNTI DEBOLI
            </div>
            <ul class="review-report-list">
              ${consHtml}
            </ul>
          </div>
        </div>
        <div class="review-report-target" style="animation: chat-bubble-in 0.5s ease-out;">
          <strong style="color: #fff;"><i class="fa-solid fa-user-gear text-blue"></i> Profilo Cliente Ideale:</strong> ${escapeHTML(data.target)}
        </div>
        ${data.demo ? `
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 10px; font-style: italic; text-align: right; animation: chat-bubble-in 0.6s ease-out;">
            <i class="fa-solid fa-circle-exclamation"></i> Generato in Modalità Demo (Risposta Simulata)
          </div>
        ` : ''}
      `;

      showToast("Analisi Completata", `Sintesi recensioni per "${prod.title.substring(0, 20)}..." completata!`, "success");
      logToTerminal(`Analisi AI recensioni completata. Verdetto: "${data.verdict}"`, "system");
      playAlertSound();
    } else {
      throw new Error(data.message || "Errore sconosciuto.");
    }

  } catch (err) {
    console.error("Errore analisi recensioni:", err);
    showToast("Analisi Fallita", "Impossibile completare l'analisi con Gemini. Verifica la console.", "warning");
    logToTerminal(`ATTENZIONE: Analisi recensioni fallita. Dettaglio: ${err.message}`, "warning");
    
    // Ripristina CTA iniziale
    insightsBox.innerHTML = `
      <div class="ai-cta-box text-center flex-column" style="display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 40px 20px; color: var(--text-secondary);">
        <i class="fa-solid fa-comments text-purple" style="font-size: 2.8rem; opacity: 0.6; filter: drop-shadow(0 0 10px var(--accent-purple-glow));"></i>
        <h3 style="font-family: var(--font-heading); font-weight: 600; font-size: 1.05rem; color: #fff;">Sintesi Opinioni con Gemini</h3>
        <p style="font-size: 0.8rem; line-height: 1.45; max-width: 90%;">Clicca su <strong>"Analizza con Gemini"</strong> in alto per raccogliere le recensioni degli acquirenti reali su Amazon e comporre un report automatico dei Pro, Contro ed un Verdetto d'acquisto obiettivo!</p>
      </div>
    `;
  } finally {
    btnAnalyze.disabled = false;
    btnAnalyze.innerHTML = originalHtml;
  }
}

// Conversational Chatbot Radar Assistant
async function sendChatBotMessage(message) {
  const container = document.getElementById("chat-messages-container");
  if (!container) return;

  // Append User Bubble
  const userBubble = document.createElement("div");
  userBubble.className = "chat-message-bubble user";
  userBubble.innerHTML = `
    <div class="avatar"><i class="fa-solid fa-user"></i></div>
    <div class="message-content">
      <p style="font-weight: 600; margin-bottom: 2px; color: #fff; opacity: 0.85; font-size: 0.75rem;">Tu</p>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
  container.appendChild(userBubble);
  container.scrollTop = container.scrollHeight;

  // Append Typing Indicator
  const typingBubble = document.createElement("div");
  typingBubble.className = "chat-message-bubble system";
  typingBubble.id = "chat-typing-indicator-bubble";
  typingBubble.innerHTML = `
    <div class="avatar"><i class="fa-solid fa-robot"></i></div>
    <div class="message-content">
      <p style="font-weight: 600; margin-bottom: 2px; color: #fff; opacity: 0.85; font-size: 0.75rem;">Radar Assistant AI</p>
      <div class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
  container.appendChild(typingBubble);
  container.scrollTop = container.scrollHeight;

  try {
    const response = await fetch("http://localhost:3000/api/gemini/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-key": state.geminiKey || ""
      },
      body: JSON.stringify({
        message: message,
        products: state.products,
        demo: !state.geminiKey
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Rimuovi indicatore di digitazione
    const ind = document.getElementById("chat-typing-indicator-bubble");
    if (ind && ind.parentNode) {
      ind.parentNode.removeChild(ind);
    }

    if (data.success) {
      // Append System Message with Markdown-to-HTML parsed text
      const replyBubble = document.createElement("div");
      replyBubble.className = "chat-message-bubble system";
      replyBubble.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="message-content">
          <p style="font-weight: 600; margin-bottom: 4px; color: #fff; opacity: 0.85; font-size: 0.75rem;">Radar Assistant AI</p>
          <div class="reply-text">${markdownToHTML(data.reply)}</div>
          ${data.demo ? `
            <span style="font-size: 0.7rem; color: var(--text-muted); display: block; margin-top: 8px; font-style: italic;">
              <i class="fa-solid fa-circle-exclamation"></i> Modalità Demo (Risposta Simulata)
            </span>
          ` : ''}
        </div>
      `;
      container.appendChild(replyBubble);
      container.scrollTop = container.scrollHeight;

      // Audio notification of reply
      playAlertSound();
    } else {
      throw new Error(data.message || "Errore sconosciuto nella risposta del server.");
    }

  } catch (err) {
    console.error("Errore chat:", err);
    
    // Rimuovi indicatore di digitazione se ancora presente
    const ind = document.getElementById("chat-typing-indicator-bubble");
    if (ind && ind.parentNode) {
      ind.parentNode.removeChild(ind);
    }

    // Append Error Bubble
    const errorBubble = document.createElement("div");
    errorBubble.className = "chat-message-bubble system";
    errorBubble.innerHTML = `
      <div class="avatar" style="background: rgba(244, 63, 94, 0.2); color: var(--accent-coral);"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div class="message-content">
        <p style="font-weight: 600; margin-bottom: 4px; color: var(--accent-coral); font-size: 0.75rem;">Errore di Connessione</p>
        <p style="color: var(--text-secondary);">Impossibile comunicare con l'Assistente Radar. Assicurati che il server Node.js sia in esecuzione localmente sulla porta 3000.</p>
      </div>
    `;
    container.appendChild(errorBubble);
    container.scrollTop = container.scrollHeight;

    showToast("Errore Radar Assistant", "Impossibile inviare il messaggio. Controlla la connessione al server.", "warning");
    logToTerminal(`Errore chatbot: ${err.message}`, "warning");
  }
}

// Helper per escape HTML contro vulnerabilità XSS
function escapeHTML(str) {
  if (!str) return "";
  return str.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Convertitore Markdown-to-HTML personalizzato, leggero ed elegante per il browser
function markdownToHTML(text) {
  if (!text) return "";
  
  // Escape del testo di base prima di formattare con i nostri tag HTML
  let html = escapeHTML(text);
  
  // Ripristina i tag di base ed esegui i rimpiazzi per grassetto, corsivo e codice
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#fff; font-weight:600;">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em style="color:#e2e8f0;">$1</em>');
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
  
  // Blocchi di codice multilinea
  html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.4); padding:10px; border-radius:6px; border:1px solid var(--card-border); margin:8px 0; overflow-x:auto;"><code style="font-family:monospace; font-size:0.8rem; color:#a5f3fc;">$1</code></pre>');
  
  // Codice inline
  html = html.replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.08); padding:2px 5px; border-radius:4px; font-family:monospace; font-size:0.82rem; color:#a5f3fc;">$1</code>');
  
  // Intestazioni (Headers)
  html = html.replace(/^### (.*?)$/gm, '<h5 style="margin: 14px 0 6px 0; font-family:var(--font-heading); font-weight:700; font-size:0.92rem; color:#fff; display:flex; align-items:center; gap:6px;">$1</h5>');
  html = html.replace(/^## (.*?)$/gm, '<h4 style="margin: 18px 0 8px 0; font-family:var(--font-heading); font-weight:700; font-size:1rem; color:#fff;">$1</h4>');
  html = html.replace(/^# (.*?)$/gm, '<h3 style="margin: 22px 0 10px 0; font-family:var(--font-heading); font-weight:800; font-size:1.1rem; color:#fff; border-bottom:1px solid var(--card-border); padding-bottom:4px;">$1</h3>');

  // Liste non ordinate
  const lines = html.split('\n');
  let inList = false;
  let parsedLines = [];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        inList = true;
        parsedLines.push('<ul style="margin: 6px 0 8px 18px; padding-left:0; display:flex; flex-direction:column; gap:4px; list-style-type:disc;">');
      }
      const content = trimmed.substring(2);
      parsedLines.push(`<li style="color:var(--text-secondary); line-height:1.45;">${content}</li>`);
    } else {
      if (inList) {
        inList = false;
        parsedLines.push('</ul>');
      }
      parsedLines.push(line);
    }
  });
  
  if (inList) {
    parsedLines.push('</ul>');
  }
  
  html = parsedLines.join('\n');
  
  // Linee vuote ed a capo standard
  return html.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    // Salta se è già un tag di blocco o di lista
    if (trimmed.startsWith('<ul') || trimmed.startsWith('</ul') || trimmed.startsWith('<li') || trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('</pre') || trimmed.startsWith('<code') || trimmed.startsWith('</code')) {
      return line;
    }
    return `<p style="margin: 0 0 8px 0; line-height: 1.5; color: var(--text-secondary);">${line}</p>`;
  }).join('');
}

// ==========================================================================
// 11. FUNZIONALITÀ TELEGRAM BOT & NOTIFICHE PUSH
// ==========================================================================

let chatIdDetectionInterval = null;

// Rilevamento automatico o manuale del Chat ID del Bot Telegram interrogando getUpdates
async function runTelegramChatIdDetection(token, isAuto = false) {
  if (!token) {
    if (chatIdDetectionInterval) {
      clearInterval(chatIdDetectionInterval);
      chatIdDetectionInterval = null;
    }
    const autoStatusDiv = document.getElementById("telegram-auto-status");
    if (autoStatusDiv) autoStatusDiv.style.display = "none";
    const btnDetectTg = document.getElementById("btn-detect-chatid");
    if (btnDetectTg) {
      btnDetectTg.disabled = false;
      btnDetectTg.innerHTML = '<i class="fa-solid fa-arrows-spin"></i> Rileva';
    }
    const chatIdInput = document.getElementById("input-telegram-chatid");
    if (chatIdInput) {
      chatIdInput.style.borderColor = "var(--card-border)";
      chatIdInput.style.boxShadow = "none";
    }
    return;
  }

  // Se c'è già una ricerca in corso, la interrompiamo prima di avviarne una nuova
  if (chatIdDetectionInterval) {
    clearInterval(chatIdDetectionInterval);
    chatIdDetectionInterval = null;
  }

  const btnDetectTg = document.getElementById("btn-detect-chatid");
  const autoStatusDiv = document.getElementById("telegram-auto-status");
  const autoStatusText = document.getElementById("telegram-auto-status-text");
  const chatIdInput = document.getElementById("input-telegram-chatid");

  let originalHtml = "";
  if (btnDetectTg) {
    originalHtml = '<i class="fa-solid fa-arrows-spin"></i> Rileva';
    if (!isAuto) {
      btnDetectTg.disabled = true;
      btnDetectTg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Attesa...';
    }
  }

  if (autoStatusDiv && autoStatusText) {
    autoStatusDiv.style.display = "flex";
    autoStatusDiv.style.borderColor = "rgba(139, 92, 246, 0.3)";
    autoStatusDiv.style.color = "var(--accent-purple)";
    const dot = autoStatusDiv.querySelector(".status-pulse-dot");
    if (dot) {
      dot.style.background = "var(--accent-purple)";
      dot.style.animation = "status-pulse-glow 1.5s infinite ease-in-out";
    }
    autoStatusText.innerHTML = isAuto 
      ? "<b>Ricerca automatica Chat ID attiva!</b> Invia un messaggio (es. <code>/start</code>) al bot su Telegram."
      : "<b>Scansione in corso...</b> Invia un messaggio (es. <code>/start</code>) al bot dal tuo telefono.";
  }

  if (chatIdInput) {
    chatIdInput.style.borderColor = "rgba(139, 92, 246, 0.5)";
    chatIdInput.style.boxShadow = "0 0 10px rgba(139, 92, 246, 0.2)";
  }

  if (!isAuto) {
    showToast("Rilevamento in Corso", "Cerca il tuo bot su Telegram ed inviagli un messaggio (es. /start). Sto scansionando...", "success");
  }
  logToTerminal(`Avviata scansione ${isAuto ? 'automatica' : 'manuale'} del Chat ID. Invia un messaggio al bot Telegram...`, "system");

  let attempts = 0;
  const maxAttempts = isAuto ? 45 : 30; // Più tempo per la modalità automatica (1.5 min vs 1 min)
  
  chatIdDetectionInterval = setInterval(async () => {
    attempts++;
    try {
      const response = await fetch(`http://localhost:3000/api/telegram/detect-chatid?token=${encodeURIComponent(token)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      if (data.success && data.found) {
        clearInterval(chatIdDetectionInterval);
        chatIdDetectionInterval = null;
        
        // Aggiorna Stato e UI
        state.telegramConfig.chatId = data.chatId.toString();
        if (chatIdInput) {
          chatIdInput.value = state.telegramConfig.chatId;
          chatIdInput.style.borderColor = "var(--accent-emerald)";
          chatIdInput.style.boxShadow = "0 0 12px rgba(16, 185, 129, 0.35)";
          
          // Animazione flash verde neon per feedback premium
          chatIdInput.animate([
            { transform: 'scale(1)', boxShadow: '0 0 0px transparent' },
            { transform: 'scale(1.02)', boxShadow: '0 0 20px var(--accent-emerald)' },
            { transform: 'scale(1)', boxShadow: '0 0 12px rgba(16, 185, 129, 0.35)' }
          ], { duration: 500, iterations: 1 });
        }
        
        // Abilita notifiche automaticamente per una UX magica!
        state.telegramConfig.enabled = true;
        const tgToggle = document.getElementById("telegram-notif-toggle");
        if (tgToggle) tgToggle.checked = true;
        
        saveToLocalStorage();

        showToast("Bot Connesso!", `Rilevato utente ${data.name} (Chat ID: ${data.chatId})!`, "success");
        logToTerminal(`Rilevato con successo Chat ID per l'utente ${data.name}: ${data.chatId}. Notifiche abilitate.`, "system");
        
        // Invia finto push al simulatore
        appendVirtualTelegramMessage(`📱 <b>Radar Collegato!</b><br><br>Rilevato utente Telegram: <b>${data.name}</b> (ID: <code>${data.chatId}</code>). Notifiche push attivate!`, 'system');

        // Invia messaggio reale di benvenuto su Telegram per confermare!
        const welcomeMsg = `🎉 <b>Price Radar Collegato con Successo!</b> 🎉\n\n` +
                           `Ciao <b>${data.name}</b>, il tuo smartphone è stato associato ad <b>Amazon Price Radar</b>!\n` +
                           `Da adesso riceverai avvisi push istantanei non appena rileveremo cali di prezzo.\n\n` +
                           `Digita /radar in questa chat per vedere i tuoi prodotti!`;
        pushTelegramNotification(welcomeMsg);
        
        if (btnDetectTg) {
          btnDetectTg.disabled = false;
          btnDetectTg.innerHTML = originalHtml;
        }

        if (autoStatusDiv && autoStatusText) {
          autoStatusDiv.style.borderColor = "rgba(16, 185, 129, 0.3)";
          autoStatusDiv.style.color = "var(--accent-emerald)";
          const dot = autoStatusDiv.querySelector(".status-pulse-dot");
          if (dot) {
            dot.style.background = "var(--accent-emerald)";
            dot.style.animation = "none";
          }
          autoStatusText.innerHTML = `✔️ <b>Collegato!</b> Rilevato utente: <b>${data.name}</b>`;
          
          // Nascondiamo dopo 5 secondi
          setTimeout(() => {
            if (autoStatusDiv.style.color.includes("emerald")) {
              autoStatusDiv.style.display = "none";
            }
          }, 5000);
        }
      }
    } catch (err) {
      console.error("Errore durante il rilevamento del Chat ID:", err);
    }

    if (attempts >= maxAttempts) {
      if (chatIdDetectionInterval) {
        clearInterval(chatIdDetectionInterval);
        chatIdDetectionInterval = null;
      }
      
      if (btnDetectTg) {
        btnDetectTg.disabled = false;
        btnDetectTg.innerHTML = originalHtml;
      }

      if (chatIdInput) {
        chatIdInput.style.borderColor = "var(--card-border)";
        chatIdInput.style.boxShadow = "none";
      }

      if (autoStatusDiv && autoStatusText) {
        autoStatusDiv.style.borderColor = "rgba(244, 63, 94, 0.25)";
        autoStatusDiv.style.color = "var(--accent-coral)";
        const dot = autoStatusDiv.querySelector(".status-pulse-dot");
        if (dot) {
          dot.style.background = "var(--accent-coral)";
          dot.style.animation = "none";
        }
        autoStatusText.innerHTML = `⚠️ <b>Rilevamento scaduto.</b> Scrivi al bot su Telegram e clicca "Rileva" per riprovare.`;
      }
      
      if (!isAuto) {
        showToast("Rilevamento Scaduto", "Tempo scaduto. Assicurati di aver inviato un messaggio al bot su Telegram e riprova.", "warning");
      }
      logToTerminal("Scansione Chat ID terminata per inattività. Invia un messaggio al bot e riprova.", "warning");
    }
  }, 2000);
}

// Sincronizza i prodotti monitorati con il backend per il bot Telegram
async function syncTelegramProducts() {
  try {
    await fetch("http://localhost:3000/api/telegram/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        products: state.products,
        chatId: state.telegramConfig.chatId,
        token: state.telegramConfig.token
      })
    });
    console.log("[TELEGRAM] Catalogo prodotti e configurazioni sincronizzati con il server.");
  } catch (err) {
    console.warn("[TELEGRAM] Impossibile sincronizzare i prodotti col server backend:", err.message);
  }
}

// Invia una notifica push (reale via bot Telegram ed estetica sul finto smartphone)
async function pushTelegramNotification(message, imageUrl = "") {
  // 1. Spedisci al finto smartphone virtuale sempre per dar prova estetica!
  appendVirtualTelegramMessage(message, 'system', imageUrl);
  
  // 2. Se le notifiche sono abilitate, prova a spedirle
  if (!state.telegramConfig.enabled) {
    console.log("[TELEGRAM] Spedizione notifica ignorata (avvisi push disabilitati).");
    return;
  }
  
  try {
    const response = await fetch("http://localhost:3000/api/telegram/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-token": state.telegramConfig.token || "",
        "x-telegram-chatid": state.telegramConfig.chatId || ""
      },
      body: JSON.stringify({
        message: message,
        imageUrl: imageUrl,
        demo: !state.telegramConfig.token || !state.telegramConfig.chatId
      })
    });
    
    const data = await response.json();
    if (data.success) {
      if (data.demo) {
        logToTerminal(`[Simulatore Telegram] Notifica push simulata spedita con successo!`, "system");
      } else {
        logToTerminal(`[Telegram Live] Notifica push reale inviata a ${state.telegramConfig.chatId}!`, "system");
      }
    }
  } catch (err) {
    console.error("[TELEGRAM] Errore spedizione push:", err);
    logToTerminal(`ATTENZIONE: Spedizione notifica Telegram fallita: ${err.message}`, "warning");
  }
}

// Aggiunge visivamente un messaggio nella finta chat di Telegram sull'iPhone mockup
function appendVirtualTelegramMessage(htmlContent, sender = 'system', imageUrl = "") {
  const virtualMessages = document.getElementById("telegram-virtual-messages");
  if (!virtualMessages) return;
  
  const bubble = document.createElement("div");
  bubble.className = `tg-message-bubble ${sender}`;
  
  let formattedContent = "";
  if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
    formattedContent += `<img src="${imageUrl}" style="width: 100%; border-radius: 8px; margin-bottom: 6px; border: 1px solid rgba(255,255,255,0.1); display: block;">`;
  }
  formattedContent += htmlContent;
  
  bubble.innerHTML = formattedContent;
  virtualMessages.appendChild(bubble);
  
  // Effetto vibrazione sonora soft se è un messaggio di sistema/push in arrivo
  if (sender === 'system') {
    playSoftTickSound();
  }
  
  // Scroll in basso
  setTimeout(() => {
    virtualMessages.scrollTop = virtualMessages.scrollHeight;
  }, 50);
}

// Un tick morbido per il finto smartphone
function playSoftTickSound() {
  if (!state.soundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, ctx.currentTime);
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch(e){}
}

