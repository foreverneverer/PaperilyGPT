// IndexedDB configuration
const DB_NAME = 'PaperilyDB';
const DB_VERSION = 1;
const STORES = {
  analysisResults: 'analysisResults',
  readingHistory: 'readingHistory'
};

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.analysisResults)) {
        db.createObjectStore(STORES.analysisResults, { keyPath: 'pdfUrl' });
      }

      if (!db.objectStoreNames.contains(STORES.readingHistory)) {
        db.createObjectStore(STORES.readingHistory, { keyPath: 'pdfUrl' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}


async function getCachedAnalysis(pdfUrl) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.analysisResults], 'readonly');
    const store = transaction.objectStore(STORES.analysisResults);
    const request = store.get(pdfUrl);

    request.onsuccess = (event) => {
      resolve(event.target.result ? event.target.result.analysis : null);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function cacheAnalysis(pdfUrl, analysis) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.analysisResults], 'readwrite');
    const store = transaction.objectStore(STORES.analysisResults);
    const request = store.put({
      pdfUrl,
      analysis,
      timestamp: Date.now()
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function addToReadingHistory(pdfUrl, title) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.readingHistory], 'readwrite');
    const store = transaction.objectStore(STORES.readingHistory);
    const request = store.put({
      pdfUrl,
      title,
      timestamp: Date.now()
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getReadingHistory() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.readingHistory], 'readonly');
    const store = transaction.objectStore(STORES.readingHistory);
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve(event.target.result || []);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function deleteFromReadingHistory(pdfUrl) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.readingHistory], 'readwrite');
    const store = transaction.objectStore(STORES.readingHistory);
    const request = store.delete(pdfUrl);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * 清空所有IndexedDB缓存
 * @returns {Promise<void>} - 操作结果
 */
async function getCacheSize() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let totalSize = 0;
    const stores = Object.values(STORES);
    let storesProcessed = 0;

    // 获取每个存储对象的大小
    stores.forEach(storeName => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          // 估算每个对象的大小
          const itemSize = JSON.stringify(cursor.value).length;
          totalSize += itemSize;
          cursor.continue();
        } else {
          storesProcessed++;
          if (storesProcessed === stores.length) {
            resolve(totalSize);
          }
        }
      };

      request.onerror = (event) => {
        console.error(`获取存储 ${storeName} 大小失败:`, event.target.error);
        reject(event.target.error);
      };
    });
  });
}

async function clearAllCache() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    // 创建一个读写事务，包含所有存储对象
    const transaction = db.transaction(Object.values(STORES), 'readwrite');
    
    // 清空每个存储对象
    Object.values(STORES).forEach(storeName => {
      const store = transaction.objectStore(storeName);
      const clearRequest = store.clear();
      
      clearRequest.onerror = (event) => {
        console.error(`清空存储 ${storeName} 失败:`, event.target.error);
        reject(event.target.error);
      };
    });
    
    transaction.oncomplete = () => {
      console.log('所有IndexedDB缓存已清空');
      resolve();
    };
    
    transaction.onerror = () => {
      console.error('清空缓存事务失败:', transaction.error);
      reject(transaction.error);
    };
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // IndexedDB operations
  if (msg.action === 'addToReadingHistory') {
    addToReadingHistory(msg.data.pdfUrl, msg.data.title)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (msg.action === 'getReadingHistory') {
    getReadingHistory()
      .then(history => sendResponse({ success: true, data: history }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (msg.action === 'deleteFromReadingHistory') {
    deleteFromReadingHistory(msg.data.pdfUrl)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (msg.action === 'cacheAnalysis') {
    cacheAnalysis(msg.data.pdfUrl, msg.data.analysis)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (msg.action === 'getCachedAnalysis') {
    getCachedAnalysis(msg.data.pdfUrl)
      .then(analysis => sendResponse({ success: true, data: analysis }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } 
  // TOS operations
  else if (msg.type === 'tos_upload') {
    handleTosUpload(msg)
      .then(response => sendResponse({ success: true, ...response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (msg.type === 'tos_read') {
    handleTosRead(msg)
      .then(response => sendResponse({ success: true, ...response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } 
  // Clear cache operations
  else if (msg.type === 'clear_cache') {
    clearAllCache()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (msg.type === 'get_cache_size') {
    getCacheSize()
      .then(size => sendResponse({ success: true, data: size }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});


/**
 * 处理TOS上传请求
 * @param {Object} msg - 请求消息
 * @returns {Promise<Object>} - 响应结果
 */
async function handleTosUpload(msg) {
  const { url, pdfUrl, pdfBase64 } = msg;
  
  try {
    const options = {
      method: 'PUT',
      headers: {}
    };
    
    if (pdfBase64) {
      // 将base64数据转换为Blob
      const binaryString = atob(pdfBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      options.headers['Content-Type'] = 'application/pdf';
      options.headers['if-none-match'] = '*';
      options.body = blob;
      console.log('PDF Base64 Upload Request : ', pdfUrl, ', size:', blob.size, 'bytes');
    }

    const response = await fetch(url, options);
    
    // 检查上传是否成功
    if (!response.ok) {
      const responseText = await response.text();
      console.error('TOS上传失败响应:', response.status, responseText);
      throw new Error(`TOS上传失败: ${response.status} ${response.statusText}`);
    }
    
    console.log('TOS上传成功:', response.status);
    return { status: response.status };
  } catch (err) {
    console.error('Error handling TOS upload:', err);
    throw new Error('处理TOS上传失败: ' + err.message);
  }
}

/**
 * 处理TOS读取请求
 * @param {Object} msg - 请求消息
 * @returns {Promise<Object>} - 响应结果
 */
async function handleTosRead(msg) {
  const { url } = msg;
  
  try {
    const options = {
      method: 'GET',
      headers: {}
    };
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const text = await response.text();
      // 检查是否是 NoSuchKey 错误
      if (text.includes('NoSuchKey') || text.includes('The specified key does not exist')) {
        throw new Error('NoSuchKey: The specified key does not exist.');
      }
      throw new Error(`处理TOS读取失败: ${response.status} ${response.statusText} ${text}`);
    }
    
    const text = await response.text();
    return { text, status: response.status };
  } catch (err) {
    console.error('Error handling TOS read:', err);
    throw err;
  }
}


