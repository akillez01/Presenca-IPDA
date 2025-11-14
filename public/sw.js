/**
 * Service Worker para Sistema de Presença IPDA
 * Implementa cache offline e sincronização de dados
 */

const CACHE_NAME = 'ipda-presence-v1.0.0';
const STATIC_CACHE_NAME = 'ipda-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'ipda-dynamic-v1.0.0';
const API_CACHE_NAME = 'ipda-api-v1.0.0';

// Recursos estáticos para cache
const STATIC_ASSETS = [
  '/',
  '/presencadecadastrados',
  '/reports',
  '/admin/monitoring',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Estratégias de cache
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
};

// Configurações de TTL (Time To Live) em milliseconds
const CACHE_TTL = {
  STATIC: 30 * 24 * 60 * 60 * 1000, // 30 dias
  API: 5 * 60 * 1000, // 5 minutos
  DYNAMIC: 24 * 60 * 60 * 1000 // 24 horas
};

// Store para sincronização offline
let offlineDataStore = [];
let syncInProgress = false;

/**
 * Instalação do Service Worker
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  
  event.waitUntil(
    Promise.all([
      // Cache recursos estáticos
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('[SW] Cachando recursos estáticos');
        return cache.addAll(STATIC_ASSETS);
      }),
      
      // Configurar IndexedDB para dados offline
      initOfflineDB()
    ]).then(() => {
      console.log('[SW] Service Worker instalado com sucesso');
      return self.skipWaiting();
    })
  );
});

/**
 * Ativação do Service Worker
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker...');
  
  event.waitUntil(
    Promise.all([
      // Limpar caches antigos
      cleanOldCaches(),
      
      // Tomar controle de todas as abas
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Service Worker ativado com sucesso');
    })
  );
});

/**
 * Interceptação de requests
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requests de chrome-extension e outros protocolos
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Estratégia baseada no tipo de recurso
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isPageRequest(request)) {
    event.respondWith(handlePageRequest(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

/**
 * Sincronização em background
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Evento de sincronização:', event.tag);
  
  if (event.tag === 'background-sync-attendance') {
    event.waitUntil(syncOfflineData());
  } else if (event.tag === 'background-sync-reports') {
    event.waitUntil(syncReportsData());
  }
});

/**
 * Mensagens do cliente
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_ATTENDANCE_DATA':
      cacheAttendanceData(data);
      break;
      
    case 'GET_OFFLINE_DATA':
      getOfflineData().then(data => {
        event.ports[0].postMessage({ type: 'OFFLINE_DATA', data });
      });
      break;
      
    case 'FORCE_SYNC':
      syncOfflineData().then(() => {
        event.ports[0].postMessage({ type: 'SYNC_COMPLETE' });
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
      break;
  }
});

/**
 * Push notifications
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: data.data,
    actions: [
      {
        action: 'view',
        title: 'Ver Detalhes',
        icon: '/icons/action-view.png'
      },
      {
        action: 'dismiss',
        title: 'Dispensar',
        icon: '/icons/action-dismiss.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// === FUNÇÕES AUXILIARES ===

/**
 * Identifica se é um recurso estático
 */
function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/);
}

/**
 * Identifica se é uma requisição de API
 */
function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/') || 
         url.hostname.includes('firestore.googleapis.com') ||
         url.hostname.includes('firebase.googleapis.com');
}

/**
 * Identifica se é uma requisição de página
 */
function isPageRequest(request) {
  return request.mode === 'navigate';
}

/**
 * Manipula recursos estáticos com cache-first
 */
async function handleStaticAsset(request) {
  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, CACHE_TTL.STATIC)) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Erro ao buscar recurso estático:', error);
    const cache = await caches.open(STATIC_CACHE_NAME);
    return cache.match(request) || new Response('Recurso não disponível offline', { status: 503 });
  }
}

/**
 * Manipula requisições de API com network-first e fallback offline
 */
async function handleAPIRequest(request) {
  try {
    // Tentar rede primeiro
    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
  } catch (error) {
    console.log('[SW] Network falhou, buscando no cache:', request.url);
    
    // Fallback para cache
    const cache = await caches.open(API_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Se for POST/PUT/DELETE e estiver offline, armazenar para sync
    if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
      await storeOfflineRequest(request);
      return new Response(JSON.stringify({ 
        success: true, 
        offline: true,
        message: 'Dados salvos offline. Serão sincronizados quando voltar online.' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      error: 'Dados não disponíveis offline' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Manipula requisições de páginas com stale-while-revalidate
 */
async function handlePageRequest(request) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    // Servir cache imediatamente se disponível
    const responsePromise = cachedResponse || fetch(request);
    
    // Revalidar em background
    const networkPromise = fetch(request).then(response => {
      if (response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    }).catch(() => cachedResponse);
    
    return cachedResponse ? responsePromise : networkPromise;
  } catch (error) {
    console.error('[SW] Erro ao carregar página:', error);
    
    // Fallback para página offline
    const cache = await caches.open(STATIC_CACHE_NAME);
    return cache.match('/') || new Response('Aplicação offline', { 
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

/**
 * Manipula outras requisições dinâmicas
 */
async function handleDynamicRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    return cachedResponse || new Response('Conteúdo não disponível offline', { 
      status: 503 
    });
  }
}

/**
 * Verifica se uma resposta em cache expirou
 */
function isExpired(response, ttl) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return true;
  
  const date = new Date(dateHeader);
  return Date.now() - date.getTime() > ttl;
}

/**
 * Limpa caches antigos
 */
async function cleanOldCaches() {
  const cacheWhitelist = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME, API_CACHE_NAME];
  const cacheNames = await caches.keys();
  
  return Promise.all(
    cacheNames.map(cacheName => {
      if (!cacheWhitelist.includes(cacheName)) {
        console.log('[SW] Removendo cache antigo:', cacheName);
        return caches.delete(cacheName);
      }
    })
  );
}

/**
 * Armazena requisição offline para sincronização posterior
 */
async function storeOfflineRequest(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: Date.now()
    };
    
    offlineDataStore.push(requestData);
    
    // Armazenar no IndexedDB
    const db = await openOfflineDB();
    const transaction = db.transaction(['requests'], 'readwrite');
    const store = transaction.objectStore('requests');
    await store.add(requestData);
    
    console.log('[SW] Requisição armazenada para sync offline:', request.url);
  } catch (error) {
    console.error('[SW] Erro ao armazenar requisição offline:', error);
  }
}

/**
 * Sincroniza dados offline quando a conexão retorna
 */
async function syncOfflineData() {
  if (syncInProgress) return;
  
  syncInProgress = true;
  console.log('[SW] Iniciando sincronização de dados offline...');
  
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['requests'], 'readonly');
    const store = transaction.objectStore('requests');
    const requests = await store.getAll();
    
    for (const requestData of requests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (response.ok) {
          // Remover da store offline após sucesso
          const deleteTransaction = db.transaction(['requests'], 'readwrite');
          const deleteStore = deleteTransaction.objectStore('requests');
          await deleteStore.delete(requestData.timestamp);
          
          console.log('[SW] Sincronizado com sucesso:', requestData.url);
        }
      } catch (error) {
        console.error('[SW] Erro ao sincronizar:', requestData.url, error);
      }
    }
    
    // Notificar clientes sobre sincronização completa
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETE' });
    });
    
  } catch (error) {
    console.error('[SW] Erro na sincronização:', error);
  } finally {
    syncInProgress = false;
  }
}

/**
 * Sincroniza dados de relatórios
 */
async function syncReportsData() {
  console.log('[SW] Sincronizando dados de relatórios...');
  
  try {
    // Implementar sincronização específica de relatórios
    const response = await fetch('/api/reports/sync');
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put('/api/reports', response.clone());
    }
  } catch (error) {
    console.error('[SW] Erro ao sincronizar relatórios:', error);
  }
}

/**
 * Inicializa IndexedDB para dados offline
 */
async function initOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('IPDAOfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store para requisições offline
      if (!db.objectStoreNames.contains('requests')) {
        const requestStore = db.createObjectStore('requests', { keyPath: 'timestamp' });
        requestStore.createIndex('url', 'url', { unique: false });
        requestStore.createIndex('method', 'method', { unique: false });
      }
      
      // Store para dados de presença offline
      if (!db.objectStoreNames.contains('attendance')) {
        const attendanceStore = db.createObjectStore('attendance', { keyPath: 'id' });
        attendanceStore.createIndex('timestamp', 'timestamp', { unique: false });
        attendanceStore.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

/**
 * Abre conexão com IndexedDB
 */
async function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('IPDAOfflineDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Cache dados de presença
 */
async function cacheAttendanceData(data) {
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['attendance'], 'readwrite');
    const store = transaction.objectStore('attendance');
    
    for (const record of data) {
      await store.put(record);
    }
    
    console.log('[SW] Dados de presença cacheados:', data.length, 'registros');
  } catch (error) {
    console.error('[SW] Erro ao cachear dados de presença:', error);
  }
}

/**
 * Recupera dados offline
 */
async function getOfflineData() {
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['attendance'], 'readonly');
    const store = transaction.objectStore('attendance');
    return await store.getAll();
  } catch (error) {
    console.error('[SW] Erro ao recuperar dados offline:', error);
    return [];
  }
}

/**
 * Limpa todos os caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(cacheNames.map(name => caches.delete(name)));
}