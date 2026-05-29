/**
 * Amazon Price Radar - Backend Scraper & Gemini AI Proxy
 * Server Node.js Express per eseguire lo scraping reale dei prezzi, delle immagini,
 * delle recensioni degli utenti e per interfacciarsi con Google Gemini 1.5 Flash.
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Servizio file statici del frontend per abilitare l'installazione PWA locale
app.use(express.static(__dirname));

// ==========================================================================
// CARICAMENTO VARIABILI D'AMBIENTE (.env) NATIVO (Zero-Dependency)
// ==========================================================================
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (key && !key.startsWith('#')) {
          process.env[key] = value;
        }
      }
    });
    console.log('[SERVER] File .env caricato correttamente.');
  }
} catch (e) {
  console.warn('[SERVER] Errore nel caricamento del file .env:', e.message);
}

// Intestazioni realistiche per imitare un browser desktop ed evitare i blocchi anti-bot
const AXIOS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Device-Memory': '8',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

// Funzione di utilità per pulire e convertire le stringhe di prezzo in numeri decimali
function parsePrice(priceStr) {
  if (!priceStr) return null;
  
  let clean = priceStr.replace(/[^\d.,]/g, '').trim();
  if (!clean) return null;
  
  if (clean.includes('.') && clean.includes(',')) {
    if (clean.indexOf('.') < clean.indexOf(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    const parts = clean.split(',');
    if (parts.length === 2 && parts[1].length === 2) {
      clean = clean.replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  }
  
  const price = parseFloat(clean);
  return isNaN(price) ? null : price;
}

// ==========================================================================
// ENDPOINT 1: SCRAPING INFORMAZIONI PRODOTTO
// ==========================================================================
app.get('/api/scrape', async (req, res) => {
  const productUrl = req.query.url;

  if (!productUrl) {
    return res.status(400).json({ 
      success: false, 
      error: 'MISSING_URL', 
      message: 'Fornire un parametro URL valido es: ?url=https://...' 
    });
  }

  console.log(`[SCRAPER] Richiesta scraping info per: ${productUrl}`);

  try {
    const response = await axios.get(productUrl, {
      headers: AXIOS_HEADERS,
      timeout: 10000
    });

    const html = response.data;
    
    if (html.includes('captcha') || html.includes('Robot Check') || html.includes('amzn-captcha')) {
      console.warn('[SCRAPER] Blocco CAPTCHA rilevato!');
      return res.status(503).json({
        success: false,
        error: 'CAPTCHA_REQUIRED',
        message: 'Amazon ha richiesto una verifica CAPTCHA. Inserisci i dati del prodotto manualmente.'
      });
    }

    const $ = cheerio.load(html);

    // Titolo
    let title = $('#productTitle').text().trim();
    if (!title) title = $('#title').text().trim();
    if (!title) title = $('h1.a-size-large').text().trim();
    if (!title) title = $('meta[name="title"]').attr('content');
    
    if (title) {
      title = title.replace(/\s+/g, ' ');
    }

    // Prezzo
    let rawPrice = '';
    if (!rawPrice) rawPrice = $('span.a-price span.a-offscreen').first().text().trim();
    if (!rawPrice) rawPrice = $('span.priceToPay span.a-offscreen').text().trim();
    if (!rawPrice) rawPrice = $('#priceblock_ourprice').text().trim();
    if (!rawPrice) rawPrice = $('#priceblock_dealprice').text().trim();
    if (!rawPrice) rawPrice = $('span.a-color-price').first().text().trim();
    
    if (!rawPrice) {
      const whole = $('span.a-price-whole').first().text().trim();
      const fraction = $('span.a-price-fraction').first().text().trim();
      if (whole) {
        rawPrice = `${whole}${fraction ? ',' + fraction : ''}`;
      }
    }

    const price = parsePrice(rawPrice);

    // Immagine
    let imageUrl = '';
    const imgElement = $('#landingImage');
    
    if (imgElement.length > 0) {
      const dynamicImgAttr = imgElement.attr('data-a-dynamic-image');
      if (dynamicImgAttr) {
        try {
          const imagesObj = JSON.parse(dynamicImgAttr);
          const urls = Object.keys(imagesObj);
          if (urls.length > 0) {
            imageUrl = urls[urls.length - 1]; // Immagine a risoluzione più alta
          }
        } catch (e) {
          imageUrl = imgElement.attr('src');
        }
      } else {
        imageUrl = imgElement.attr('src');
      }
    }
    
    if (!imageUrl) imageUrl = $('#imgBlkFront').attr('src');
    if (!imageUrl) imageUrl = $('#ebooksImgBlkFront').attr('src');
    if (!imageUrl) imageUrl = $('#main-image-container img').first().attr('src');

    let asin = '';
    const asinMatch = productUrl.match(/\/dp\/([A-Z0-9]{10})/) || productUrl.match(/\/gp\/product\/([A-Z0-9]{10})/);
    if (asinMatch && asinMatch[1]) {
      asin = asinMatch[1];
    }

    if (!title && !price) {
      console.warn('[SCRAPER] Struttura pagina non riconosciuta o vuota.');
      return res.status(422).json({
        success: false,
        error: 'PARSING_FAILED',
        message: 'Impossibile estrarre i dati della pagina. La struttura potrebbe essere differente.'
      });
    }

    console.log(`[SCRAPER] Scraping riuscito! Titolo: "${title.substring(0, 30)}...", Prezzo: ${price}€`);

    res.json({
      success: true,
      asin: asin,
      title: title,
      price: price,
      imageUrl: imageUrl,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[SCRAPER] Errore durante lo scraping:', error.message);
    res.status(500).json({
      success: false,
      error: 'SCRAPE_ERROR',
      message: `Errore di connessione ad Amazon: ${error.message}`
    });
  }
});

// ==========================================================================
// ENDPOINT 2: ANALISI RECENSIONI REALI CON GEMINI
// ==========================================================================
app.post('/api/gemini/analyze', async (req, res) => {
  const { url, title, reviews: clientReviews } = req.body;
  
  // Rileva chiave API
  const headerApiKey = req.headers['x-gemini-key'];
  const apiKey = headerApiKey || process.env.GEMINI_API_KEY;

  console.log(`[GEMINI] Richiesta analisi recensioni per: "${title || 'Prodotto non specificato'}"`);

  // Se l'utente non ha una chiave API ed è attiva la demo, o se è esplicitamente richiesta la demo
  const isDemoMode = !apiKey || req.body.demo === true;

  if (isDemoMode) {
    console.log('[GEMINI] Esecuzione in MODALITÀ DEMO SIMULATA (nessuna chiave API rilevata o demo=true)');
    // Generiamo un fantastico report simulato personalizzato in base al titolo
    const mockReport = generateMockAnalysis(title || "Prodotto Tecnologico");
    // Simuliamo un ritardo di 1.5 secondi per dare l'effetto di calcolo
    await new Promise(resolve => setTimeout(resolve, 1500));
    return res.json({ success: true, demo: true, ...mockReport });
  }

  // Se siamo in modalità reale, procediamo con lo scraping delle recensioni (se non fornite dal client)
  let reviewsText = '';
  
  if (clientReviews && clientReviews.length > 0) {
    reviewsText = clientReviews.join('\n');
  } else if (url) {
    try {
      console.log(`[SCRAPER] Estrazione recensioni reali dall'URL...`);
      const response = await axios.get(url, { headers: AXIOS_HEADERS, timeout: 10000 });
      const $ = cheerio.load(response.data);
      
      const reviews = [];
      $('span[data-hook="review-body"]').each((i, el) => {
        const t = $(el).text().trim();
        if (t) reviews.push(t);
      });

      if (reviews.length === 0) {
        $('.review-text-content span').each((i, el) => {
          const t = $(el).text().trim();
          if (t) reviews.push(t);
        });
      }

      reviewsText = reviews.slice(0, 8).join('\n\n'); // prendi le prime 8 recensioni
      console.log(`[SCRAPER] Estratte ${reviews.length} recensioni reali da inoltrare a Gemini.`);
    } catch (err) {
      console.error('[SCRAPER] Impossibile estrarre recensioni da URL:', err.message);
      // fallback a demo se lo scraping fallisce
      const mockReport = generateMockAnalysis(title || "Prodotto Tecnologico");
      return res.json({ 
        success: true, 
        demo: true, 
        warning: 'Scraping recensioni fallito, caricati dati simulati.',
        ...mockReport 
      });
    }
  }

  if (!reviewsText) {
    reviewsText = "Nessuna recensione dettagliata trovata per questo prodotto. Gli acquirenti lasciano principalmente recensioni a 5 stelle elogiandone la spedizione rapida, la confezione integra e la corrispondenza alle immagini.";
  }

  // Costruisci il prompt per Gemini
  const prompt = `Sei un esperto analista di prodotti di consumo. Ti fornisco una serie di recensioni reali (o una sintesi di mercato) scritte dagli acquirenti su Amazon per il prodotto "${title || 'Prodotto'}".
  Analizza attentamente i sentimenti espressi ed estrai:
  1. Un verdetto sintetico e incisivo di massimo 20 parole (in italiano).
  2. I 4 punti di forza principali (PRO) più citati, sintetizzati in massimo 8 parole ciascuno.
  3. I 4 punti deboli o lamentele principali (CONTRO) più citati, sintetizzati in massimo 8 parole ciascuno.
  4. L'acquirente tipo ideale (TARGET) in massimo 10 parole.

  Fornisci la risposta ESCLUSIVAMENTE in formato JSON valido, senza blocchi di codice markdown (NON inserire \`\`\`json o \`\`\`), senza spazi o altro testo prima e dopo. Il formato JSON deve essere esattamente il seguente:
  {
    "verdict": "verdetto in italiano...",
    "pros": ["pro 1", "pro 2", "pro 3", "pro 4"],
    "cons": ["contro 1", "contro 2", "contro 3", "contro 4"],
    "target": "target in italiano..."
  }
  
  Recensioni da analizzare:
  ${reviewsText}`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    
    const response = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: prompt }] }]
    }, { headers: { 'Content-Type': 'application/json' } });

    let resultText = response.data.candidates[0].content.parts[0].text.trim();
    
    // Pulisci eventuale blocco di codice markdown se Gemini ignora le istruzioni
    if (resultText.startsWith('```')) {
      resultText = resultText.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
    }

    const report = JSON.parse(resultText);
    res.json({ success: true, demo: false, ...report });

  } catch (err) {
    console.error('[GEMINI] Errore chiamata API Gemini:', err.message);
    // Fallback automatico a demo in caso di quota superata, errore chiave o timeout
    const mockReport = generateMockAnalysis(title || "Prodotto Tecnologico");
    res.json({ 
      success: true, 
      demo: true, 
      warning: `Errore chiamata API Gemini (${err.message}). Caricati dati demo.`,
      ...mockReport 
    });
  }
});

// ==========================================================================
// ENDPOINT 3: CHATBOT ASSISTENTE ACQUISTI AI
// ==========================================================================
app.post('/api/gemini/chat', async (req, res) => {
  const { message, products } = req.body;
  
  const headerApiKey = req.headers['x-gemini-key'];
  const apiKey = headerApiKey || process.env.GEMINI_API_KEY;

  console.log(`[GEMINI] Messaggio chat ricevuto: "${message.substring(0, 30)}..."`);

  const isDemoMode = !apiKey || req.body.demo === true;

  if (isDemoMode) {
    console.log('[GEMINI] Risposta chat in MODALITÀ DEMO SIMULATA');
    const mockReply = generateMockChatReply(message, products);
    await new Promise(resolve => setTimeout(resolve, 1200));
    return res.json({ success: true, demo: true, reply: mockReply });
  }

  // Prompt con iniezione del contesto dei prodotti tracciati dall'utente
  const systemPrompt = `Sei "Radar Assistant", un assistente di acquisto personale intelligente, empatico ed esperto di mercati finanziari, tech e consumer.
  L'utente sta usando l'applicazione "Amazon Price Radar" per monitorare l'andamento dei prezzi di alcuni prodotti Amazon.
  Ti viene fornito l'elenco in tempo reale di TUTTI i prodotti tracciati dall'utente nel suo database locale, completo di prezzi correnti, storici, target, valutazioni ed andamento:
  
  ${JSON.stringify(products, null, 2)}
  
  Rispondi al messaggio dell'utente in italiano in modo sintetico, professionale, ma allo stesso tempo amichevole ed estremamente accattivante.
  Fornisci consigli d'acquisto strategici basati esclusivamente su questi dati reali dei prodotti. Ad esempio:
  - Fai notare se un prodotto è al minimo storico assoluto o ha uno sconto pazzesco rispetto all'originale.
  - Consiglia quale prodotto acquistare prioritariamente se l'utente ti chiede come ottimizzare il suo budget.
  - Se un utente ti chiede consigli su un prodotto, analizzane l'andamento storico (es. "il prezzo è stabile", "è in continuo calo, attendi", "ha un'alta volatilità").
  Usa la formattazione Markdown (liste, grassetto, tabelle) per rendere la risposta stupenda e leggibile dal browser.
  
  Messaggio dell'utente: "${message}"`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    
    const response = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: systemPrompt }] }]
    }, { headers: { 'Content-Type': 'application/json' } });

    const reply = response.data.candidates[0].content.parts[0].text;
    res.json({ success: true, demo: false, reply: reply });

  } catch (err) {
    console.error('[GEMINI] Errore chiamata chat Gemini:', err.message);
    const mockReply = generateMockChatReply(message, products) + "\n\n*(Nota: Risposta generata in Modalità Demo a causa di un errore di connessione con le API Gemini)*";
    res.json({ success: true, demo: true, reply: mockReply });
  }
});

// ==========================================================================
// UTILITY: GENERATORI MOCK PER LA MODALITÀ DEMO
// ==========================================================================

function generateMockAnalysis(title) {
  const t = title.toLowerCase();
  
  if (t.includes('iphone') || t.includes('apple')) {
    return {
      verdict: "Un concentrato di tecnologia superlativo, ma il prezzo elevato richiede di cogliere al volo gli sconti reali.",
      pros: [
        "Schermo OLED straordinario a 120Hz",
        "Fotocamera eccezionale in ogni condizione",
        "Materiali costruttivi in titanio robusti",
        "Autonomia migliorata e ricarica USB-C"
      ],
      cons: [
        "Prezzo di listino iniziale proibitivo",
        "Velocità di ricarica ancora limitata",
        "Surriscaldamento leggero sotto stress intenso",
        "Cavo di ricarica in confezione corto"
      ],
      target: "Professionisti e appassionati Apple che cercano prestazioni senza compromessi."
    };
  } else if (t.includes('playstation') || t.includes('ps5') || t.includes('gaming')) {
    return {
      verdict: "La console di riferimento per il gaming moderno, ora più compatta ma con le stesse identiche prestazioni eccellenti.",
      pros: [
        "Tempi di caricamento SSD fulminei",
        "Feedback aptico del controller DualSense",
        "Grafica 4K e Ray Tracing spettacolare",
        "Catalogo di giochi esclusivi eccezionale"
      ],
      cons: [
        "Dimensioni comunque generose nei mobili",
        "Spazio SSD effettivo limitato ad 825GB",
        "Prezzo dei giochi fisici in aumento",
        "Manca un abbonamento inclusivo stile Pass"
      ],
      target: "Giocatori appassionati ed esigenti che vogliono le migliori esclusive sul mercato."
    };
  } else if (t.includes('headphone') || t.includes('cuffie') || t.includes('sony') || t.includes('audio')) {
    return {
      verdict: "Re indiscusso della cancellazione attiva del rumore, confortevole e con un audio ricco e spaziale.",
      pros: [
        "Cancellazione del rumore attiva da riferimento",
        "Comfort eccezionale per sessioni prolungate",
        "Qualità audio bilanciata e bassi profondi",
        "Autonomia della batteria fino a 30 ore"
      ],
      cons: [
        "Design non ripiegabile rispetto al passato",
        "Sensore touch laterale a volte troppo sensibile",
        "Prezzo premium rispetto alla concorrenza",
        "Non completamente impermeabile all'acqua"
      ],
      target: "Pendolari, viaggiatori frequenti ed audiofili alla ricerca del silenzio perfetto."
    };
  } else {
    // Generico
    return {
      verdict: "Un acquisto solido ed equilibrato che si distingue per il rapporto qualità-prezzo conveniente nel lungo termine.",
      pros: [
        "Facilità di utilizzo immediata out-of-the-box",
        "Materiali solidi e design minimale elegante",
        "Ottimo supporto clienti e garanzia inclusa",
        "Consumi energetici e rumorosità minimi"
      ],
      cons: [
        "Mancano funzionalità smart avanzate",
        "Plastiche esterne leggermente economiche",
        "Manuale di istruzioni poco dettagliato",
        "Prezzo fluttuante in base alla disponibilità"
      ],
      target: "Utenti pratici alla ricerca di affidabilità senza fronzoli o costi eccessivi."
    };
  }
}

function generateMockChatReply(message, products = []) {
  const msg = message.toLowerCase();
  
  if (products.length === 0) {
    return `Ciao! Sono **Radar Assistant**. Attualmente non stai tracciando alcun prodotto. Aggiungine uno cliccando su **"Nuovo Prodotto"** in alto e incollando un link Amazon per farmi analizzare il tuo budget!`;
  }

  // Trova sconti e minimo storico
  const allTimeLows = [];
  const topDiscounts = [];

  products.forEach(p => {
    const historyPrices = p.history.map(h => h.price);
    const min = Math.min(...historyPrices);
    if (p.currentPrice <= min) {
      allTimeLows.push(p);
    }
    const discount = ((p.originalPrice - p.currentPrice) / p.originalPrice) * 100;
    topDiscounts.push({ prod: p, discount });
  });

  topDiscounts.sort((a, b) => b.discount - a.discount);

  if (msg.includes('miglior') || msg.includes('affar') || msg.includes('scont') || msg.includes('compra')) {
    let reply = `Ecco l'analisi dei **migliori affari attuali** nel tuo radar:\n\n`;
    
    if (allTimeLows.length > 0) {
      reply += `### 🎯 Prodotti al Minimo Storico (Acquisto Caldamente Consigliato):\n`;
      allTimeLows.forEach(p => {
        const discount = ((p.originalPrice - p.currentPrice) / p.originalPrice) * 100;
        reply += `- **${p.title}**: Oggi a soli **${p.currentPrice.toFixed(2)} €** (prezzo originale: ~~${p.originalPrice.toFixed(2)} €~~, sconto del **${discount.toFixed(0)}%**!). È il prezzo più basso mai registrato!\n`;
      });
      reply += `\n`;
    }

    reply += `### ⚡ Classifica degli Sconti:\n`;
    topDiscounts.slice(0, 3).forEach((item, index) => {
      reply += `${index + 1}. **${item.prod.title}** ➔ **-${item.discount.toFixed(0)}%** di sconto (Prezzo: **${item.prod.currentPrice.toFixed(2)} €**)\n`;
    });
    
    reply += `\n**Il mio verdetto**: Se devi fare un acquisto oggi, dai la priorità assoluta a **${topDiscounts[0].prod.title}**. Il taglio di prezzo è eccezionale e potresti non ritrovare questa offerta a breve!`;
    return reply;
  }
  
  if (msg.includes('budget') || msg.includes('consigli') || msg.includes('euro') || msg.includes('€')) {
    // Rileva se c'è un numero nel messaggio come budget
    const numbers = msg.match(/\d+/g);
    let budget = numbers ? parseInt(numbers[0]) : 500;
    
    let reply = `### 💰 Strategia di Allocazione Budget per **${budget} €**\n\n`;
    reply += `Ho esaminato i tuoi desideri e i prezzi reali di Amazon. Ecco come ti consiglio di spendere la cifra:\n\n`;
    
    let spent = 0;
    const purchases = [];
    
    // Prova ad aggiungere prima gli affari migliori sotto il budget
    const sortedByConvenience = [...topDiscounts].sort((a,b) => b.discount - a.discount);
    
    sortedByConvenience.forEach(item => {
      if (spent + item.prod.currentPrice <= budget) {
        spent += item.prod.currentPrice;
        purchases.push(item.prod);
      }
    });

    if (purchases.length > 0) {
      reply += `**Cosa acquistare subito con questo budget:**\n`;
      purchases.forEach(p => {
        reply += `- ✅ **${p.title}** (${p.currentPrice.toFixed(2)} €) ➔ *Consiglio AI: Acquistalo subito, è vicino al minimo!*\n`;
      });
      reply += `\n**Totale speso**: **${spent.toFixed(2)} €** su **${budget} €** (Risparmio residuo: **${(budget - spent).toFixed(2)} €**).\n\n`;
      
      const unpurchased = products.filter(p => !purchases.includes(p));
      if (unpurchased.length > 0) {
        reply += `**Cosa lasciare in lista d'attesa (da rimandare):**\n`;
        unpurchased.forEach(p => {
          reply += `- ⏳ **${p.title}** (${p.currentPrice.toFixed(2)} €) ➔ *Motivazione: Troppo costoso per questo budget o prezzo vicino ai massimi del periodo. Aspetta un calo al target di ${p.targetPrice.toFixed(2)} €.*\n`;
        });
      }
    } else {
      reply += `Purtroppo nessuno dei tuoi prodotti tracciati costa meno del tuo budget di **${budget} €**. Il prodotto più economico nel tuo radar è **${topDiscounts[topDiscounts.length - 1].prod.title}** a **${topDiscounts[topDiscounts.length - 1].prod.currentPrice.toFixed(2)} €**. Ti consiglio di raccogliere altri risparmi o attendere che il simulatore o il mercato forzino uno sconto consistente!`;
    }
    
    return reply;
  }

  // Risposta generica conversazionale di default intelligente
  return `Ciao! Sono il tuo **Radar Assistant AI**. Sono qui per aiutarti a ottimizzare i tuoi acquisti ed analizzare lo storico prezzi dei tuoi prodotti.

Al momento sto tracciando **${products.length} prodotti** nel tuo radar. 

Ecco alcune domande che puoi farmi:
*   *"Quali sono i migliori sconti o cali di prezzo oggi?"*
*   *"Ho un budget di 600€, cosa mi consigli di comprare?"*
*   *"Analizza l'andamento dei miei prodotti e dimmi cosa aspettare."*

Scrivi pure e ti aiuterò a risparmiare su Amazon! 🎯`;
}

// ==========================================================================
// 4. INTEGRAZIONE TELEGRAM BOT & NOTIFICHE PUSH
// ==========================================================================

let syncedProducts = [];
let botPollingActive = false;
let botPollingInterval = null;
let botOffset = 0;
let currentBotToken = process.env.TELEGRAM_BOT_TOKEN || "";
let currentChatId = process.env.TELEGRAM_CHAT_ID || "";

// Ferma il long-polling del bot
function stopTelegramPolling() {
  if (botPollingInterval) {
    clearInterval(botPollingInterval);
    botPollingInterval = null;
  }
  botPollingActive = false;
  console.log('[TELEGRAM] Long-polling terminato.');
}

// Avvia il long-polling per ricevere messaggi dal bot
async function startTelegramPolling(token) {
  if (!token) return;
  if (currentBotToken === token && botPollingActive) {
    return; // Polling già attivo per questo token
  }
  
  stopTelegramPolling();
  currentBotToken = token;
  botPollingActive = true;
  botOffset = 0;
  console.log(`[TELEGRAM] Avvio polling Telegram per il bot con token: ${token.substring(0, 8)}...`);

  // Eseguiamo il ciclo di polling ogni 3 secondi per evitare blocchi
  botPollingInterval = setInterval(async () => {
    if (!botPollingActive) return;
    try {
      const url = `https://api.telegram.org/bot${currentBotToken}/getUpdates?offset=${botOffset}&timeout=2`;
      const response = await axios.get(url, { timeout: 5000 });
      const updates = response.data.result || [];
      
      for (const update of updates) {
        botOffset = update.update_id + 1;
        if (update.message && update.message.text) {
          await handleTelegramMessage(update.message);
        }
      }
    } catch (err) {
      console.error('[TELEGRAM] Errore nel polling di Telegram:', err.message);
      if (err.response && (err.response.status === 401 || err.response.status === 404)) {
        console.warn('[TELEGRAM] Token non valido o inattivo. Polling disattivato.');
        stopTelegramPolling();
      }
    }
  }, 3000);
}

// Genera e invia il grafico dello storico prezzi tramite QuickChart
async function sendTelegramProductChart(chatId, prod) {
  try {
    const historyPrices = prod.history.map(h => h.price);
    const minPrice = Math.min(...historyPrices);
    const maxPrice = Math.max(...historyPrices);
    const currentPrice = prod.currentPrice;

    // Configurazione del grafico in formato Chart.js v2 per QuickChart (Tema Dark Premium)
    const chartConfig = {
      type: 'line',
      data: {
        labels: prod.history.map(h => {
          const parts = h.date.split('-');
          if (parts.length === 3) {
            const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
            return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]}`;
          }
          return h.date;
        }),
        datasets: [{
          label: 'Prezzo (€)',
          data: historyPrices,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.12)',
          fill: true,
          borderWidth: 3,
          pointRadius: 2,
          pointBackgroundColor: '#8b5cf6',
          lineTension: 0.35
        }]
      },
      options: {
        title: {
          display: true,
          text: prod.title.length > 35 ? prod.title.substring(0, 35) + '...' : prod.title,
          fontColor: '#ffffff',
          fontSize: 14,
          fontFamily: 'Inter'
        },
        legend: {
          display: false
        },
        scales: {
          xAxes: [{
            gridLines: {
              color: 'rgba(255, 255, 255, 0.05)',
              zeroLineColor: 'rgba(255, 255, 255, 0.08)'
            },
            ticks: {
              fontColor: '#9ca3af',
              fontSize: 10,
              maxTicksLimit: 8
            }
          }],
          yAxes: [{
            gridLines: {
              color: 'rgba(255, 255, 255, 0.05)',
              zeroLineColor: 'rgba(255, 255, 255, 0.08)'
            },
            ticks: {
              fontColor: '#9ca3af',
              fontSize: 10
            }
          }]
        }
      }
    };

    // Genera l'URL di QuickChart con sfondo coordinato
    const quickChartUrl = `https://quickchart.io/chart?bkg=%23070b13&w=500&h=300&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
    
    // Testo descrittivo del grafico
    const captionText = `📈 <b>STORICO PREZZI: ${prod.title}</b>\n\n` +
                        `• Categoria: <b>${prod.category}</b>\n` +
                        `• Prezzo Corrente: <b>${currentPrice.toFixed(2)} €</b>\n` +
                        `• Minimo Storico: <b>${minPrice.toFixed(2)} €</b>\n` +
                        `• Massimo Storico: <b>${maxPrice.toFixed(2)} €</b>\n` +
                        `• Target Alert impostato: <b>${prod.targetPrice.toFixed(2)} €</b>\n\n` +
                        `👉 <a href="${prod.url}">Vedi il prodotto su Amazon</a>`;

    const url = `https://api.telegram.org/bot${currentBotToken}/sendPhoto`;
    await axios.post(url, {
      chat_id: chatId,
      photo: quickChartUrl,
      caption: captionText,
      parse_mode: 'HTML'
    }, { timeout: 8000 });
    
    console.log(`[TELEGRAM] Grafico per "${prod.title}" inviato con successo a ${chatId}`);
  } catch (err) {
    console.error('[TELEGRAM] Errore nell\'invio del grafico a Telegram:', err.message);
    
    // Fallback: invio del testo semplice se il caricamento dell'immagine fallisce
    try {
      const urlText = `https://api.telegram.org/bot${currentBotToken}/sendMessage`;
      const fallbackText = `📊 <b>STORICO PREZZI: ${prod.title}</b>\n\n` +
                           `• Prezzo Corrente: <b>${prod.currentPrice.toFixed(2)} €</b>\n` +
                           `• Minimo Storico: <b>${Math.min(...prod.history.map(h => h.price)).toFixed(2)} €</b>\n` +
                           `• Massimo Storico: <b>${Math.max(...prod.history.map(h => h.price)).toFixed(2)} €</b>\n\n` +
                           `*(Impossibile generare il grafico visivo in questo momento)*`;
      await axios.post(urlText, {
        chat_id: chatId,
        text: fallbackText,
        parse_mode: 'HTML'
      });
    } catch (e) {
      console.error('[TELEGRAM] Fallback invio grafico fallito:', e.message);
    }
  }
}

// Gestore dei messaggi inviati al bot Telegram
async function handleTelegramMessage(msg) {
  const chatId = msg.chat.id;
  currentChatId = chatId.toString();
  const text = msg.text.trim();
  const username = msg.from.first_name || msg.from.username || "Utente";
  
  console.log(`[TELEGRAM] Comando ricevuto da ${username} (${chatId}): "${text}"`);
  
  let replyText = "";
  
  if (text.startsWith('/start')) {
    replyText = `⚡ <b>Benvenuto in Price Radar Assistant, ${username}!</b> ⚡\n\n` +
                `Riceverai notifiche live per cali di prezzo, minimi storici ed eventi Black Friday dei tuoi prodotti tracciati.\n\n` +
                `Ecco il tuo <b>Telegram Chat ID</b> personale da copiare ed inserire nella Web App:\n` +
                `👉 <code>${chatId}</code> 👈\n\n` +
                `Incollalo nel modulo di configurazione Telegram per collegare questo smartphone!\n\n` +
                `<b>Comandi utili:</b>\n` +
                `• /radar - Vedi tutti i prodotti tracciati\n` +
                `• /deals - Scopri le migliori offerte correnti\n` +
                `• /grafico - Vedi il grafico dello storico prezzi\n` +
                `• /help - Istruzioni di utilizzo`;
  } else if (text.startsWith('/radar')) {
    if (syncedProducts.length === 0) {
      replyText = `🧐 Non stai ancora tracciando alcun prodotto. Aggiungili prima nella Web App!`;
    } else {
      replyText = `📋 <b>PRODOTTI MONITORATI NEL RADAR:</b>\n\n`;
      syncedProducts.forEach((p, idx) => {
        const discount = ((p.originalPrice - p.currentPrice) / p.originalPrice) * 100;
        const discountText = discount > 0.5 ? ` (<b>-${discount.toFixed(0)}% Sconto</b>)` : '';
        const reached = p.currentPrice <= p.targetPrice ? '🎯 <b>TARGET RAGGIUNTO!</b>' : `⏳ Target: ${p.targetPrice.toFixed(2)} €`;
        
        replyText += `<b>${idx + 1}. ${p.title.substring(0, 30)}...</b>\n` +
                     `• Prezzo: <b>${p.currentPrice.toFixed(2)} €</b>${discountText}\n` +
                     `• ${reached}\n\n`;
      });
    }
  } else if (text.startsWith('/deals')) {
    if (syncedProducts.length === 0) {
      replyText = `🧐 Non ci sono prodotti tracciati per calcolare le offerte.`;
    } else {
      const sorted = [...syncedProducts]
        .map(p => ({ ...p, discount: ((p.originalPrice - p.currentPrice) / p.originalPrice) * 100 }))
        .sort((a, b) => b.discount - a.discount)
        .slice(0, 3);
      
      replyText = `🔥 <b>I 3 MIGLIORI CALI PREZZO ATTUALI:</b>\n\n`;
      sorted.forEach((item, idx) => {
        replyText += `⚡ <b>${idx + 1}. ${item.title.substring(0, 30)}...</b>\n` +
                     `• Sconto: <b>-${item.discount.toFixed(0)}%</b>\n` +
                     `• Prezzo: <b>${item.currentPrice.toFixed(2)} €</b> (invece di ~~${item.originalPrice.toFixed(2)} €~~)\n\n`;
      });
      replyText += `💡 <i>Consiglio: Procedi all'acquisto degli articoli al massimo ribasso!</i>`;
    }
  } else if (text.startsWith('/grafico')) {
    if (syncedProducts.length === 0) {
      replyText = `🧐 Non stai ancora tracciando alcun prodotto. Aggiungili prima nella Web App!`;
    } else {
      // Controlla se c'è un indice specifico come /grafico_1
      const match = text.match(/\/grafico_(\d+)/);
      if (match) {
        const index = parseInt(match[1]) - 1;
        if (index >= 0 && index < syncedProducts.length) {
          await sendTelegramProductChart(chatId, syncedProducts[index]);
          return;
        }
      }

      // Se c'è un solo prodotto, invia direttamente il grafico per quello!
      if (syncedProducts.length === 1) {
        await sendTelegramProductChart(chatId, syncedProducts[0]);
        return;
      }

      // Se ci sono più prodotti, invia un menu di scelta
      replyText = `📊 <b>SELEZIONA PRODOTTO DA ANALIZZARE:</b>\n\n` +
                  `Clicca su uno dei comandi seguenti per ricevere il grafico dello storico dei prezzi:\n\n`;
      
      syncedProducts.forEach((p, idx) => {
        replyText += `📈 /grafico_${idx + 1} - <b>${p.title.substring(0, 30)}...</b> (${p.currentPrice.toFixed(2)} €)\n`;
      });
    }
  } else if (text.startsWith('/help')) {
    replyText = `🤖 <b>Radar Assistant Bot - Aiuto</b>\n\n` +
                `Puoi inviarmi questi comandi dal tuo client Telegram per interrogare l'applicazione:\n\n` +
                `/radar - Elenco completo dei prodotti monitorati e prezzi correnti\n` +
                `/deals - Mostra i tre sconti più convenienti del momento\n` +
                `/grafico - Ricevi il grafico dell'andamento dei prezzi\n` +
                `/help - Mostra questo messaggio informativo`;
  } else {
    replyText = `🤖 <b>Radar Assistant Bot</b>\n\n` +
                `Ciao ${username}! Non riconosco questo comando.\n\n` +
                `Digita /help per vedere cosa posso fare!`;
  }

  try {
    const url = `https://api.telegram.org/bot${currentBotToken}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: replyText,
      parse_mode: 'HTML'
    });
  } catch (err) {
    console.error('[TELEGRAM] Impossibile rispondere al comando:', err.message);
  }
}

// Endpoint per sincronizzare la lista prodotti dal frontend
app.post('/api/telegram/sync', (req, res) => {
  const { products, chatId, token } = req.body;
  if (Array.isArray(products)) {
    syncedProducts = products;
    console.log(`[TELEGRAM] Prodotti sincronizzati col backend (${syncedProducts.length} articoli).`);
  }
  if (chatId) {
    currentChatId = chatId.toString();
  }
  if (token) {
    currentBotToken = token;
  }
  res.json({ success: true });
});

// Endpoint per inviare un messaggio Telegram push (reale o simulato)
app.post('/api/telegram/send', async (req, res) => {
  const { message, token, chatId, imageUrl } = req.body;
  
  const headerToken = req.headers['x-telegram-token'];
  const headerChatId = req.headers['x-telegram-chatid'];
  
  const activeToken = headerToken || token || process.env.TELEGRAM_BOT_TOKEN;
  const activeChatId = headerChatId || chatId || process.env.TELEGRAM_CHAT_ID;

  const isDemo = !activeToken || !activeChatId || req.body.demo === true;

  if (isDemo) {
    console.log('[TELEGRAM] Invio notifica in MODALITÀ DEMO SIMULATA');
    return res.json({ 
      success: true, 
      demo: true, 
      message: message, 
      imageUrl: imageUrl,
      timestamp: new Date().toISOString() 
    });
  }

  try {
    let hasPhoto = false;
    // Se c'è un'immagine reale, prova ad inviarla con sendPhoto
    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      try {
        const photoUrl = `https://api.telegram.org/bot${activeToken}/sendPhoto`;
        await axios.post(photoUrl, {
          chat_id: activeChatId,
          photo: imageUrl,
          caption: message,
          parse_mode: 'HTML'
        }, { timeout: 6000 });
        
        hasPhoto = true;
        console.log(`[TELEGRAM] Foto inviata con successo a ${activeChatId}`);
      } catch (photoErr) {
        console.warn('[TELEGRAM] Invio foto fallito, fallback a messaggio testuale:', photoErr.message);
      }
    }

    // Se non è stato possibile inviarla come foto, usa sendMessage normale
    if (!hasPhoto) {
      const textUrl = `https://api.telegram.org/bot${activeToken}/sendMessage`;
      await axios.post(textUrl, {
        chat_id: activeChatId,
        text: message,
        parse_mode: 'HTML'
      });
      console.log(`[TELEGRAM] Testo inviato con successo a ${activeChatId}`);
    }
    
    // Se stiamo usando il bot con successo, assicuriamoci che stia ascoltando i comandi in background
    startTelegramPolling(activeToken);

    res.json({ success: true, demo: false, hasPhoto: hasPhoto, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[TELEGRAM] Errore nell\'invio del messaggio a Telegram:', err.message);
    res.status(500).json({ 
      success: false, 
      error: 'SEND_ERROR', 
      message: `Errore chiamata API Telegram: ${err.message}` 
    });
  }
});

// Funzione per generare e inviare il Briefing Mattutino AI via Telegram
async function triggerAndSendMorningBriefing(token, chatId, products, apiKey = "") {
  if (!token || !chatId || !products || products.length === 0) {
    console.warn('[SCHEDULE] Dati insufficienti per il Morning Briefing:', { token: !!token, chatId: !!chatId, products: products ? products.length : 0 });
    return { success: false, error: 'MISSING_DATA' };
  }

  const activeKey = apiKey || process.env.GEMINI_API_KEY;
  const isDemo = !activeKey;

  let briefingText = "";

  if (isDemo) {
    console.log('[SCHEDULE] Generazione Morning Briefing in MODALITÀ DEMO SIMULATA');
    
    const lowestProds = products.filter(p => {
      const min = Math.min(...p.history.map(h => h.price));
      return p.currentPrice <= min;
    });

    briefingText = `🌅 <b>BUONGIORNO DAL TUO RADAR ASSISTANT!</b> 🌅\n\n` +
                   `Ecco il tuo briefing mattutino per ottimizzare i tuoi acquisti Amazon.\n\n` +
                   `📋 <b>STATO DEL TUO RADAR (Prodotti: ${products.length}):</b>\n`;
                   
    products.forEach((p, idx) => {
      const discount = ((p.originalPrice - p.currentPrice) / p.originalPrice) * 100;
      const discountText = discount > 0.5 ? ` (<b>-${discount.toFixed(0)}% Sconto</b>)` : '';
      briefingText += `• ${idx + 1}. <b>${p.title.substring(0, 24)}...</b>: <b>${p.currentPrice.toFixed(2)} €</b>${discountText}\n`;
    });

    briefingText += `\n🎯 <b>STATISTICHE E NOTIZIE DI OGGI:</b>\n`;
    if (lowestProds.length > 0) {
      briefingText += `🔥 Hai ben <b>${lowestProds.length} prodotti al minimo storico assoluto</b> oggi! Ti consiglio di fare un check rapido.\n`;
    } else {
      briefingText += `✨ I prezzi oggi sono stabili. Ottimo momento per attendere con pazienza.\n`;
    }

    briefingText += `\n🧠 <b>CONSIGLIO AI DEL MATTINO (Modalità Demo):</b>\n` +
                   `<i>"Ti suggerisco di tenere d'occhio il tuo prodotto principale. Il trend generale su Amazon è in leggera discesa per il fine settimana; mantieni attivi i tuoi target price e ti avviserò al primo crollo!"</i>\n\n` +
                   `🎯 Buona giornata e buon risparmio!`;
  } else {
    // Richiesta a Gemini reale
    const systemPrompt = `Sei "Radar Assistant", un personal shopper e consulente d'acquisto AI.
    Genera un BRIEFING MATTUTINO (Morning Briefing) in italiano per l'utente, basandoti sui suoi prodotti tracciati nel radar:
    ${JSON.stringify(products, null, 2)}
    
    Il briefing deve essere super accattivante, schematico ed elegante:
    1. Un saluto caloroso del mattino (es. "Buongiorno! 🌅").
    2. Un breve riepilogo dello stato dei prezzi in base al catalogo (es. quanti prodotti sono al minimo storico o quanti target sono raggiunti).
    3. Un breve consiglio strategico AI del giorno (massimo 45 parole, es: quale prodotto conviene acquistare subito perché è vicino ai minimi del periodo, e su quali attendere pazientemente).
    
    Usa elenchi puntati, grassetti ed emoji per renderlo fantastico su Telegram. Sii sintetico e professionale. Non utilizzare blocchi di codice markdown.`;

    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${activeKey}`;
      const response = await axios.post(geminiUrl, {
        contents: [{ parts: [{ text: systemPrompt }] }]
      }, { headers: { 'Content-Type': 'application/json' }, timeout: 12000 });

      briefingText = response.data.candidates[0].content.parts[0].text.trim();
    } catch (err) {
      console.error('[GEMINI] Errore chiamata API Gemini per briefing:', err.message);
      // Fallback a demo in caso di errore
      return await triggerAndSendMorningBriefing(token, chatId, products, "");
    }
  }

  // Spedisci a Telegram
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: briefingText,
      parse_mode: 'HTML'
    });
    console.log(`[SCHEDULE] Morning Briefing inviato con successo a ${chatId}`);
    return { success: true, demo: isDemo, text: briefingText };
  } catch (err) {
    console.error('[SCHEDULE] Errore invio Morning Briefing su Telegram:', err.message);
    return { success: false, error: 'SEND_ERROR', message: err.message };
  }
}

// Endpoint per generare ed inviare il Morning Briefing AI
app.post('/api/telegram/morning-briefing', async (req, res) => {
  const { products, token, chatId } = req.body;
  const headerApiKey = req.headers['x-gemini-key'];
  const apiKey = headerApiKey || process.env.GEMINI_API_KEY;

  const activeToken = token || currentBotToken || process.env.TELEGRAM_BOT_TOKEN;
  const activeChatId = chatId || currentChatId || process.env.TELEGRAM_CHAT_ID;

  if (!products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ success: false, error: 'MISSING_PRODUCTS', message: 'Nessun prodotto fornito per il briefing' });
  }

  console.log(`[TELEGRAM] Richiesta manuale di Morning Briefing per il Chat ID: ${activeChatId}`);

  const result = await triggerAndSendMorningBriefing(activeToken, activeChatId, products, apiKey);
  
  if (result.success) {
    res.json({ success: true, demo: result.demo, text: result.text });
  } else {
    res.status(500).json({ success: false, error: result.error, message: result.message });
  }
});

// Scheduler in background per invio giornaliero alle ore 08:00 (ora reale local time)
let lastMorningBriefingDate = "";

setInterval(async () => {
  if (!botPollingActive || !currentBotToken || !currentChatId || !syncedProducts || syncedProducts.length === 0) {
    return;
  }
  
  const now = new Date();
  const currentDateStr = now.toISOString().split('T')[0];
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Controlla se sono esattamente le 08:00 del mattino ed è un giorno nuovo
  if (currentHour === 8 && currentMinute === 0 && lastMorningBriefingDate !== currentDateStr) {
    lastMorningBriefingDate = currentDateStr;
    console.log(`[SCHEDULE] Avvio automatico Morning Briefing giornaliero alle 08:00 per il giorno ${currentDateStr}...`);
    
    try {
      await triggerAndSendMorningBriefing(currentBotToken, currentChatId, syncedProducts);
    } catch (err) {
      console.error('[SCHEDULE] Errore nell\'invio automatico del briefing:', err.message);
    }
  }
}, 30000); // Eseguiamo il controllo ogni 30 secondi


// Endpoint per configurare ed avviare il polling del bot
app.post('/api/telegram/config', (req, res) => {
  const { token } = req.body;
  if (token) {
    startTelegramPolling(token);
    res.json({ success: true, active: true });
  } else {
    stopTelegramPolling();
    res.json({ success: true, active: false });
  }
});

// Endpoint per rilevare automaticamente il Chat ID dell'utente interrogando getUpdates
app.get('/api/telegram/detect-chatid', async (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ success: false, error: 'MISSING_TOKEN' });
  }

  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates?limit=5`;
    const response = await axios.get(url, { timeout: 3000 });
    const updates = response.data.result || [];
    
    if (updates.length > 0) {
      // Filtra l'ultimo messaggio privato da un utente
      const lastUpdate = [...updates].reverse().find(up => up.message && up.message.chat && up.message.chat.type === 'private');
      if (lastUpdate) {
        const chatId = lastUpdate.message.chat.id;
        const firstName = lastUpdate.message.chat.first_name || lastUpdate.message.chat.username || "Utente";
        
        return res.json({
          success: true,
          found: true,
          chatId: chatId,
          name: firstName,
          text: lastUpdate.message.text
        });
      }
    }
    
    res.json({ success: true, found: false });
  } catch (err) {
    console.error('[TELEGRAM] Errore in detect-chatid:', err.message);
    res.status(500).json({ success: false, error: 'API_ERROR', message: err.message });
  }
});


// Avvia il server Express
app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🚀 AMAZON PRICE SCRAPER & GEMINI AI PROXY IN ESECUZIONE (PORTA ${PORT})`);
  console.log(`🔗 Scraper API: http://localhost:${PORT}/api/scrape?url=...`);
  console.log(`🧠 Gemini AI Chat API: http://localhost:${PORT}/api/gemini/chat`);
  console.log(`📢 Telegram Push API: http://localhost:${PORT}/api/telegram/send`);
  console.log(`================================================================`);
  
  // Avvia il bot Telegram se configurato in .env
  if (process.env.TELEGRAM_BOT_TOKEN) {
    startTelegramPolling(process.env.TELEGRAM_BOT_TOKEN);
  }
});
