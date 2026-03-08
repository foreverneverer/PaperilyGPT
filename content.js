const SERVER_URL = 'https://gpt.paperily.cn'; // 服务器地址:115.190.53.120
const DEFAULT_API_BASE_URL = `${SERVER_URL}/api`;
const DEFAULT_WEB_BASE_URL = SERVER_URL;
const STORAGE_KEYS = {
  apiBaseUrl: 'paperily_api_base_url',
  webBaseUrl: 'paperily_web_base_url',
  token: 'paperily_token',
  user: 'paperily_user',
  tosEndpoint: 'paperily_tos_endpoint',
  tosBucket: 'paperily_tos_bucket'
};

// IndexedDB configuration
const DB_NAME = 'PaperilyDB';
const DB_VERSION = 1;
const STORES = {
  pdfTexts: 'pdfTexts',
  analysisResults: 'analysisResults',
  readingHistory: 'readingHistory'
};

// Configure marked options
if (typeof marked !== 'undefined') {
  marked.use({
    breaks: true,
    gfm: true
  });
}

function isPdfPage() {
  const protocol = String(window.location.protocol || '');
  if (protocol !== 'http:' && protocol !== 'https:') return false;

  const url = String(window.location.href || '');
  const path = String(window.location.pathname || '');

  if (document && typeof document.contentType === 'string') {
    if (document.contentType.toLowerCase().includes('pdf')) return true;
  }
  if (/\.pdf($|\?)/i.test(url) || /\.pdf$/i.test(path)) return true;
  if (/\/pdf\//i.test(url) || /\/pdf\//i.test(path)) return true;
  if (/\/epdf\//i.test(url) || /\/epdf\//i.test(path)) return true;

  // IEEE Xplore
  if (url.includes('ieeexplore.ieee.org/stamp/stamp.jsp')) return true;

  return false;
}

function ensureRoot() {
  if (document.getElementById('paperily-floating-panel')) return null;

  const panel = document.createElement('div');
  panel.id = 'paperily-floating-panel';

  const analyzeBtn = document.createElement('button');
  analyzeBtn.className = 'paperily-btn primary';
  analyzeBtn.textContent = '解析';
  analyzeBtn.id = 'paperily-analyze-btn';

  const loginBtn = document.createElement('button');
  loginBtn.className = 'paperily-btn';
  loginBtn.textContent = '登录';
  loginBtn.id = 'paperily-login-btn';

  const searchBtn = document.createElement('button');
  searchBtn.className = 'paperily-btn';
  searchBtn.textContent = '搜索';
  searchBtn.id = 'paperily-search-btn';
  searchBtn.addEventListener('click', showSearchModal);

  panel.appendChild(analyzeBtn);
  panel.appendChild(searchBtn);
  panel.appendChild(loginBtn);
  (document.body || document.documentElement).appendChild(panel);

  const toast = document.createElement('div');
  toast.id = 'paperily-toast';
  (document.body || document.documentElement).appendChild(toast);

  const backdrop = document.createElement('div');
  backdrop.id = 'paperily-modal-backdrop';
  backdrop.innerHTML = `
    <div id="paperily-modal">
      <div id="paperily-modal-header">
        <div id="paperily-modal-header-left">
          <div id="paperily-modal-title"></div>
          <div id="paperily-modal-header-actions-left"></div>
        </div>
        <div id="paperily-modal-header-right">
          <div id="paperily-modal-header-actions"></div>
          <button id="paperily-modal-close" aria-label="Close">×</button>
        </div>
      </div>
      <div id="paperily-modal-body"></div>
    </div>
  `;
  (document.body || document.documentElement).appendChild(backdrop);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  backdrop.querySelector('#paperily-modal-close').addEventListener('click', () => closeModal());

  return {
    panel,
    analyzeBtn,
    loginBtn,
    searchBtn
  };
}

/**
 * Show the search modal
 */
function showSearchModal() {
  const searchContainer = document.createElement('div');
  searchContainer.className = 'paperily-search-container';
  searchContainer.innerHTML = `
    <div class="search-box">
      <input type="text" id="pluginSearchInput" placeholder="请输入论文标题" required>
      <button id="pluginSearchBtn" class="search-btn">搜索</button>
    </div>

    <div class="results-container">
      <div class="results-top-row">
        <div class="result-panel">
          <h3>谷歌学术</h3>
          <div id="pluginGoogleScholarResult" class="result-content">
            <p class="placeholder">点击搜索按钮开始查找</p>
          </div>
        </div>

        <div class="result-panel">
          <h3>百度学术</h3>
          <div id="pluginBaiduScholarResult" class="result-content">
            <p class="placeholder">点击搜索按钮开始查找</p>
          </div>
        </div>
      </div>

      <div class="result-panel">
        <h3>共享资源</h3>
        <div id="pluginSharedResourceResult" class="result-content">
          <p class="placeholder">点击搜索按钮开始查找</p>
        </div>
      </div>
    </div>
  `;

  showModal('论文搜索', searchContainer);

  // Bind search events
  const pluginSearchInput = document.getElementById('pluginSearchInput');
  const pluginSearchBtn = document.getElementById('pluginSearchBtn');

  pluginSearchBtn.addEventListener('click', handlePluginSearch);
  pluginSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handlePluginSearch();
    }
  });
}

/**
 * Handle search in the plugin
 */
async function handlePluginSearch() {
  const pluginSearchInput = document.getElementById('pluginSearchInput');
  const pluginGoogleScholarResult = document.getElementById('pluginGoogleScholarResult');
  const pluginBaiduScholarResult = document.getElementById('pluginBaiduScholarResult');
  const pluginSharedResourceResult = document.getElementById('pluginSharedResourceResult');

  const keyword = pluginSearchInput.value.trim();
  if (!keyword) {
    showToast('请输入论文标题');
    return;
  }

  // Show loading status
  pluginGoogleScholarResult.innerHTML = '<p class="loading">搜索中...</p>';
  pluginBaiduScholarResult.innerHTML = '<p class="loading">搜索中...</p>';
  pluginSharedResourceResult.innerHTML = '<p class="loading">搜索中...</p>';

  // Update Google Scholar result
  const googleScholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(keyword)}`;
  pluginGoogleScholarResult.innerHTML = `
    <div class="result-item">
      <a href="${googleScholarUrl}" target="_blank" rel="noopener noreferrer">
        查看谷歌学术搜索结果
      </a>
    </div>
  `;

  // Update Baidu Scholar result
  const baiduScholarUrl = `https://xueshu.baidu.com/s?wd=${encodeURIComponent(keyword)}`;
  pluginBaiduScholarResult.innerHTML = `
    <div class="result-item">
      <a href="${baiduScholarUrl}" target="_blank" rel="noopener noreferrer">
        查看百度学术搜索结果
      </a>
    </div>
  `;

  // Search shared resources
  try {
    await searchPluginSharedResources(keyword);
  } catch (error) {
    console.error('查询共享资源失败:', error);
    pluginSharedResourceResult.innerHTML = '<p class="error">查询失败，请稍后重试</p>';
  }
}

/**
 * Search shared resources from backend in the plugin
 * @param {string} keyword - Search keyword
 */
async function searchPluginSharedResources(keyword) {
  const pluginSharedResourceResult = document.getElementById('pluginSharedResourceResult');
  const cfg = await storageGet([STORAGE_KEYS.apiBaseUrl]);
  const apiBaseUrl = cfg[STORAGE_KEYS.apiBaseUrl] || DEFAULT_API_BASE_URL;

  try {
    const response = await fetch(`${apiBaseUrl}/search-papers?keyword=${encodeURIComponent(keyword)}`);
    const data = await response.json();
    
    // Debug log: Full response data
    console.log('Search papers response data:', data);
    
    if (data.success && data.papers && data.papers.length > 0) {
      // Display matching papers
      let html = '';
      for (const paper of data.papers) {
        // Debug log: Paper data
        console.log('Paper data:', paper);
        
        // Check if paper.links and paper.links.pdf exist
        const hasPdfUrl = paper.links && paper.links.pdf;
        
        // Debug log: Link status
        console.log('Paper links status:', {
          title: paper.title,
          hasPdfUrl: hasPdfUrl,
          links: paper.links
        });
        
        // Get presigned URL for shared link
        let sharedLink = '';
        if (hasPdfUrl) {
          try {
            // Get presigned URL using apiFetch
            const { res: presignedResponse, data: presignedData } = await apiFetch('/tos/presigned-url', {
              method: 'POST',
              body: JSON.stringify({
                pdfUrl: paper.links.pdf,
                type: 'get',
                file_name: 'paper.pdf'
              })
            });
            if (presignedData.success && presignedData.data && presignedData.data.presignedUrl) {
              sharedLink = presignedData.data.presignedUrl;
            }
          } catch (error) {
            console.error('Error getting presigned URL:', error);
          }
        }
        
        html += `
          <div class="paper-item">
            <h4>${paper.title}</h4>
            <div class="paper-actions">
              ${hasPdfUrl ? `<a href="${paper.links.pdf}" class="action-btn view-btn" target="_blank">原文链接</a>` : `<span class="no-download">无原文链接</span>`}
              ${sharedLink ? `<a href="${sharedLink}" class="action-btn download-btn" target="_blank">共享链接</a>` : `<span class="no-download">无共享链接</span>`}
            </div>
          </div>
        `;
      }
      pluginSharedResourceResult.innerHTML = html;
    } else {
      // No matching papers found
      pluginSharedResourceResult.innerHTML = '<p class="no-result">暂未查到共享资源</p>';
    }
  } catch (error) {
    console.error('Search shared resources error:', error);
    throw error;
  }
}

function showToast(message) {
  const toast = document.getElementById('paperily-toast');
  if (!toast) return;
  toast.textContent = String(message || '');
  toast.style.display = 'block';
  
  // 移除之前的点击事件监听器（如果有）
  toast.onclick = null;
  
  // 添加新的点击事件监听器
  toast.onclick = function() {
    toast.style.display = 'none';
  };
}

function showModal(title, bodyNode, options = {}) {
  const backdrop = document.getElementById('paperily-modal-backdrop');
  const titleEl = document.getElementById('paperily-modal-title');
  const bodyEl = document.getElementById('paperily-modal-body');
  const actionsRightEl = document.getElementById('paperily-modal-header-actions');
  const actionsLeftEl = document.getElementById('paperily-modal-header-actions-left');
  if (!backdrop || !titleEl || !bodyEl) return;

  titleEl.textContent = String(title || '');
  bodyEl.replaceChildren();
  if (bodyNode) bodyEl.appendChild(bodyNode);
  if (actionsRightEl) {
    actionsRightEl.replaceChildren();
    if (options.headerActions) actionsRightEl.appendChild(options.headerActions);
    if (options.headerActionsRight) actionsRightEl.appendChild(options.headerActionsRight);
  }
  if (actionsLeftEl) {
    actionsLeftEl.replaceChildren();
    if (options.headerActionsLeft) actionsLeftEl.appendChild(options.headerActionsLeft);
  }
  backdrop.style.display = 'flex';
}

const modalStack = [];

function isModalOpen() {
  const backdrop = document.getElementById('paperily-modal-backdrop');
  return Boolean(backdrop && backdrop.style.display !== 'none' && backdrop.style.display !== '');
}

function snapshotModal() {
  const titleEl = document.getElementById('paperily-modal-title');
  const bodyEl = document.getElementById('paperily-modal-body');
  const actionsRightEl = document.getElementById('paperily-modal-header-actions');
  const actionsLeftEl = document.getElementById('paperily-modal-header-actions-left');
  if (!titleEl || !bodyEl) return null;

  const fragment = document.createDocumentFragment();
  while (bodyEl.firstChild) {
    fragment.appendChild(bodyEl.firstChild);
  }

  const actionsFragment = document.createDocumentFragment();
  if (actionsRightEl) {
    while (actionsRightEl.firstChild) {
      actionsFragment.appendChild(actionsRightEl.firstChild);
    }
  }

  const actionsLeftFragment = document.createDocumentFragment();
  if (actionsLeftEl) {
    while (actionsLeftEl.firstChild) {
      actionsLeftFragment.appendChild(actionsLeftEl.firstChild);
    }
  }

  return {
    title: titleEl.textContent || '',
    fragment,
    actionsFragment,
    actionsLeftFragment
  };
}

function pushModal(title, bodyNode, options) {
  if (isModalOpen()) {
    const snap = snapshotModal();
    if (snap) modalStack.push(snap);
  }
  showModal(title, bodyNode, options);
}

function restoreModal(snapshot) {
  const backdrop = document.getElementById('paperily-modal-backdrop');
  const titleEl = document.getElementById('paperily-modal-title');
  const bodyEl = document.getElementById('paperily-modal-body');
  const actionsRightEl = document.getElementById('paperily-modal-header-actions');
  const actionsLeftEl = document.getElementById('paperily-modal-header-actions-left');
  if (!backdrop || !titleEl || !bodyEl) return;

  titleEl.textContent = snapshot.title;
  bodyEl.replaceChildren();
  bodyEl.appendChild(snapshot.fragment);
  if (actionsRightEl) {
    actionsRightEl.replaceChildren();
    if (snapshot.actionsFragment) actionsRightEl.appendChild(snapshot.actionsFragment);
  }
  if (actionsLeftEl) {
    actionsLeftEl.replaceChildren();
    if (snapshot.actionsLeftFragment) actionsLeftEl.appendChild(snapshot.actionsLeftFragment);
  }
  backdrop.style.display = 'flex';
}

function closeModal() {
  if (modalStack.length > 0) {
    const prev = modalStack.pop();
    restoreModal(prev);
    return;
  }
  const backdrop = document.getElementById('paperily-modal-backdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function hideModal() {
  modalStack.length = 0;
  const backdrop = document.getElementById('paperily-modal-backdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.get(keys, (items) => {
        if (chrome.runtime.lastError) {
          // 检查是否是扩展上下文失效错误
          if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
            console.error('Extension context invalidated. Please refresh the page.');
            showToast('扩展上下文已失效，请刷新页面后重试');
          }
          reject(chrome.runtime.lastError);
        } else {
          resolve(items || {});
        }
      });
    } catch (error) {
      // 直接捕获扩展上下文失效错误
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.error('Extension context invalidated. Please refresh the page.');
        showToast('扩展上下文已失效，请刷新页面后重试');
      }
      reject(error);
    }
  });
}

function storageSet(items) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.set(items, () => {
        if (chrome.runtime.lastError) {
          // 检查是否是扩展上下文失效错误
          if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
            console.error('Extension context invalidated. Please refresh the page.');
            showToast('扩展上下文已失效，请刷新页面后重试');
          }
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    } catch (error) {
      // 直接捕获扩展上下文失效错误
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.error('Extension context invalidated. Please refresh the page.');
        showToast('扩展上下文已失效，请刷新页面后重试');
      }
      reject(error);
    }
  });
}

function authChanged() {
  window.dispatchEvent(new CustomEvent('paperily-auth-changed'));
}

async function sha256Hex(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


function inferTitleFromUrl(pdfUrl) {
  try {
    const u = new URL(pdfUrl);
    const last = u.pathname.split('/').filter(Boolean).pop() || pdfUrl;
    return decodeURIComponent(last);
  } catch {
    const parts = String(pdfUrl).split('/');
    return parts[parts.length - 1] || 'PDF';
  }
}

async function apiFetch(path, init = {}) {
  const cfg = await storageGet([STORAGE_KEYS.apiBaseUrl, STORAGE_KEYS.token]);
  const apiBaseUrl = cfg[STORAGE_KEYS.apiBaseUrl] || DEFAULT_API_BASE_URL;
  const token = cfg[STORAGE_KEYS.token] || '';

  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers
    });
    const data = await res.json().catch(() => null);

    return { res, data };
  } catch (error) {
    console.error('API fetch failed:', error);
    // 检查是否是证书错误
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      // 检查是否缺少端口号
      if (apiBaseUrl === 'https://localhost/api') {
        // 清除错误的API地址，使用默认地址
        await storageSet({ [STORAGE_KEYS.apiBaseUrl]: null });
        throw new Error('API地址配置错误，已重置为默认地址，请重试');
      }
      throw new Error('网络连接失败，请检查证书是否被信任或网络连接是否正常');
    }
    throw error;
  }
}

async function isAuthed() {
  const cfg = await storageGet([STORAGE_KEYS.token]);
  const token = cfg[STORAGE_KEYS.token];
  if (token) {
    const { res } = await apiFetch('/profile', { method: 'GET' });
    if (res.ok) return true;
  }
  return false;
}

/**
 * Update favorite button state based on current paper status
 * @param {HTMLElement} button - The favorite button element
 * @param {string} paperId - The paper ID
 * @param {string} title - The paper title
 * @param {string} url - The paper URL
 * @param {boolean} isAuthenticated - Whether user is authenticated
 */
async function updateFavoriteButton(button, paperId, title, url, isAuthenticated) {
  if (!button) return;
  
  try {
    if (isAuthenticated) {
      // Check if paper is already favorited
      const isFavorited = await isPaperFavorited(paperId);
      
      // Update button state
      button.className = 'paperily-favorite-btn paperily-comment-link';
      button.textContent = isFavorited ? '取消收藏' : '收藏';
      button.style.cursor = 'pointer';
      
      // Add or remove active class based on favorite status
      if (isFavorited) {
        button.classList.add('active');
        button.classList.add('danger');
      } else {
        button.classList.remove('active');
        button.classList.remove('danger');
      }
    } else {
      // Change to text style instead of button
      button.className = 'paperily-comment-link';
      button.innerHTML = '';
      
      // Create clickable login text
      const loginSpan = document.createElement('span');
      loginSpan.textContent = '登录';
      loginSpan.style.cursor = 'pointer';
      loginSpan.style.color = '#3498db';
      loginSpan.addEventListener('click', async () => {
        await ensureAuthInteractive({ preserveModal: true });
      });
      
      const restText = document.createTextNode('可以收藏');
      button.appendChild(loginSpan);
      button.appendChild(restText);
      button.style.cursor = 'pointer';
    }
  } catch (error) {
    console.error('Error updating favorite button:', error);
    button.className = 'paperily-favorite-btn paperily-comment-link';
    button.textContent = '收藏';
    button.style.cursor = 'pointer';
    button.classList.remove('active');
    button.classList.remove('danger');
  }
}

/**
 * Check if paper is favorited by current user
 * @param {string} paperId - The paper ID
 * @returns {Promise<boolean>} - True if paper is favorited
 */
async function isPaperFavorited(paperId) {
  if (!paperId) return false;
  
  try {
    // Get token from storage
    const cfg = await storageGet([STORAGE_KEYS.token]);
    const token = cfg[STORAGE_KEYS.token];
    
    if (!token) {
      return false;
    }
    
    // Check backend API
    const { res, data } = await apiFetch(`/papers/${encodeURIComponent(paperId)}/favorite`, {
      method: 'GET'
    });
    
    return res.ok && data && data.success && data.data.favorited;
  } catch (error) {
    console.error('Error checking favorite status:', error);
    return false;
  }
}

/**
 * Handle toggling favorite status
 * @param {HTMLElement} button - The favorite button element
 * @param {string} paperId - The paper ID
 * @param {string} title - The paper title
 * @param {string} url - The paper URL
 */
async function handleToggleFavorite(button, paperId, title, url) {
  if (!button || !paperId) return;
  
  let isOverLimit = false;
  
  try {
    // Check if user is authenticated
    const authed = await ensureAuthInteractive({ preserveModal: true });
    if (!authed) {
      return;
    }
    
    // Get current favorite status from server to ensure accuracy
    const currentFavoriteStatus = await isPaperFavorited(paperId);
    const isCurrentlyFavorited = currentFavoriteStatus;
    
    // Disable button during operation
    button.disabled = true;
    button.textContent = isCurrentlyFavorited ? '取消收藏中...' : '收藏中...';
    
    let response;
    if (isCurrentlyFavorited) {
      // Remove from favorites
      response = await apiFetch(`/papers/${encodeURIComponent(paperId)}/favorite`, {
        method: 'DELETE'
      });
    } else {
      // Add to favorites
      response = await apiFetch(`/papers/${encodeURIComponent(paperId)}/favorite`, {
        method: 'POST',
        body: JSON.stringify({ paper: { id: paperId, title: title, url: url, links: { pdf: url } } })
      });
    }
    
    const { res, data } = response;
    
    if (!res.ok || !data || !data.success) {
      throw new Error((data && (data.error || data.message)) || '操作失败');
    }
    
    // Update button state
    button.classList.toggle('active');
    button.classList.toggle('danger');
    button.textContent = isCurrentlyFavorited ? '收藏' : '取消收藏';
    
    showToast(isCurrentlyFavorited ? '取消收藏成功' : '收藏成功');
    
  } catch (error) {
    console.error('Error toggling favorite:', error);
    showToast(`操作失败: ${error.message}`);

    if (String(error.message || '').includes('收藏列表最多可保存')) {
      isOverLimit = true;
      button.classList.add('disabled');
      button.textContent = '收藏超限';
      button.disabled = true;
      return;
    }
    
    // Get the actual favorite status from server after error
    const actualStatus = await isPaperFavorited(paperId);
    button.textContent = actualStatus ? '取消收藏' : '收藏';
    if (actualStatus) {
      button.classList.add('active');
      button.classList.add('danger');
    } else {
      button.classList.remove('active');
      button.classList.remove('danger');
    }
  } finally {
    if (!isOverLimit) {
      button.disabled = false;
    }
  }
}

function showLoginModal({ preserveModal } = {}) {
  return new Promise((resolve) => {
    const wrapper = document.createElement('div');

    let mode = 'login';
    const state = {
      username: '',
      email: '',
      password: ''
    };

    function createField({ label, type, id, value, onInput }) {
      const field = document.createElement('div');
      field.className = 'paperily-field';
      field.innerHTML = `
        <div class="paperily-label">${label}</div>
        <input class="paperily-input" type="${type}" id="${id}" />
      `;
      const input = field.querySelector('input');
      input.value = value;
      input.placeholder = id;
      input.addEventListener('input', (e) => onInput(e.target.value));
      return field;
    }

    async function doLogin(loginBtn) {
      const email = wrapper.querySelector('#paperily-login-email')?.value?.trim() || '';
      const password = wrapper.querySelector('#paperily-login-password')?.value || '';

      state.email = email;
      state.password = password;

      if (!email || !password) {
        showToast('请输入邮箱和密码');
        return;
      }

      loginBtn.disabled = true;
      loginBtn.textContent = '登录中...';
      try {
        const { res, data } = await apiFetch('/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (!res.ok || !data || !data.success) {
          throw new Error((data && (data.error || data.message)) || '登录失败');
        }
        const token = data.data && data.data.token;
        if (!token) {
          throw new Error('登录返回缺少token');
        }
        await storageSet({
          [STORAGE_KEYS.token]: token,
          [STORAGE_KEYS.user]: data.data
        });
        authChanged();
        closeModal();
        showToast('登录成功');
        resolve(true);
      } catch (e) {
        showToast(e && e.message ? e.message : '登录失败');
        loginBtn.disabled = false;
        loginBtn.textContent = '登录';
      }
    }

    async function doRegister(registerBtn) {
      const username = wrapper.querySelector('#paperily-register-username')?.value?.trim() || '';
      const email = wrapper.querySelector('#paperily-register-email')?.value?.trim() || '';
      const password = wrapper.querySelector('#paperily-register-password')?.value || '';

      state.username = username;
      state.email = email;
      state.password = password;

      if (!username || !email || !password) {
        showToast('请输入用户名、邮箱和密码');
        return;
      }

      registerBtn.disabled = true;
      registerBtn.textContent = '注册中...';
      try {
        const { res, data } = await apiFetch('/users/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });
        if (!res.ok || !data || !data.success) {
          throw new Error((data && (data.error || data.message)) || '注册失败');
        }

        showToast('注册成功，请登录');
        mode = 'login';
        render();
      } catch (e) {
        showToast(e && e.message ? e.message : '注册失败');
        registerBtn.disabled = false;
        registerBtn.textContent = '注册';
      }
    }

    function render() {
      wrapper.replaceChildren();

      if (mode === 'register') {
        wrapper.appendChild(createField({
          label: '用户名',
          type: 'text',
          id: 'paperily-register-username',
          value: state.username,
          onInput: (v) => { state.username = v; }
        }));

        wrapper.appendChild(createField({
          label: '邮箱',
          type: 'email',
          id: 'paperily-register-email',
          value: state.email,
          onInput: (v) => { state.email = v; }
        }));

        wrapper.appendChild(createField({
          label: '密码',
          type: 'password',
          id: 'paperily-register-password',
          value: state.password,
          onInput: (v) => { state.password = v; }
        }));

        const footer = document.createElement('div');
        footer.className = 'paperily-actions';
        footer.style.justifyContent = 'space-between';

        const switchBtn = document.createElement('button');
        switchBtn.className = 'paperily-link-btn';
        switchBtn.textContent = '已有账号？去登录';

        const right = document.createElement('div');
        right.style.display = 'flex';
        right.style.gap = '10px';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'paperily-btn';
        cancelBtn.textContent = '取消';

        const registerBtn = document.createElement('button');
        registerBtn.className = 'paperily-btn primary';
        registerBtn.textContent = '注册';

        switchBtn.addEventListener('click', () => {
          mode = 'login';
          render();
        });

        cancelBtn.addEventListener('click', () => {
          closeModal();
          resolve(false);
        });

        registerBtn.addEventListener('click', async () => {
          await doRegister(registerBtn);
        });

        right.appendChild(cancelBtn);
        right.appendChild(registerBtn);
        footer.appendChild(switchBtn);
        footer.appendChild(right);
        wrapper.appendChild(footer);

        return;
      }

      wrapper.appendChild(createField({
        label: '邮箱',
        type: 'email',
        id: 'paperily-login-email',
        value: state.email,
        onInput: (v) => { state.email = v; }
      }));

      wrapper.appendChild(createField({
        label: '密码',
        type: 'password',
        id: 'paperily-login-password',
        value: state.password,
        onInput: (v) => { state.password = v; }
      }));

      const footer = document.createElement('div');
      footer.className = 'paperily-actions';
      footer.style.justifyContent = 'space-between';

      const switchBtn = document.createElement('button');
      switchBtn.className = 'paperily-link-btn';
      switchBtn.textContent = '没有账号？去注册';

      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.gap = '10px';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'paperily-btn';
      cancelBtn.textContent = '取消';

      const loginBtn = document.createElement('button');
      loginBtn.className = 'paperily-btn primary';
      loginBtn.textContent = '登录';

      switchBtn.addEventListener('click', () => {
        mode = 'register';
        render();
      });

      cancelBtn.addEventListener('click', () => {
        closeModal();
        resolve(false);
      });

      loginBtn.addEventListener('click', async () => {
        await doLogin(loginBtn);
      });

      right.appendChild(cancelBtn);
      right.appendChild(loginBtn);
      footer.appendChild(switchBtn);
      footer.appendChild(right);
      wrapper.appendChild(footer);
    }

    render();

    if (preserveModal && isModalOpen()) {
      pushModal('登录 Paperily', wrapper);
    } else {
      showModal('登录 Paperily', wrapper);
    }
  });
}

async function ensureAuthInteractive({ preserveModal } = {}) {
  if (await isAuthed()) return true;
  showToast('请先登录');
  const ok = await showLoginModal({ preserveModal });
  return Boolean(ok);
}

function formatDate(dateString) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}



async function run() {
  if (!isPdfPage()) return;

  const ui = ensureRoot();
  if (!ui) return;

  const pdfUrl = window.location.href;
  const hash = await sha256Hex(pdfUrl);
  const paperId = `url_${hash}`;

  let cachedAnalysis = '';
  let cachedTitle = '';
  let favoriteState = null;
  let currentUsername = '';

  async function getWebBaseUrl() {
    const cfg = await storageGet([STORAGE_KEYS.webBaseUrl]);
    return cfg[STORAGE_KEYS.webBaseUrl] || DEFAULT_WEB_BASE_URL;
  }

  function getUserInitial(username) {
    const u = String(username || '').trim();
    if (!u) return 'U';
    return u.charAt(0).toUpperCase();
  }

  async function updateLoginButton() {
    const cfg = await storageGet([STORAGE_KEYS.token, STORAGE_KEYS.user]);
    const token = cfg[STORAGE_KEYS.token] || '';
    const user = cfg[STORAGE_KEYS.user] || null;

    if (!token) {
      currentUsername = '';
      ui.loginBtn.textContent = '登录';
      return;
    }

    const { res, data } = await apiFetch('/profile', { method: 'GET' });
    if (res.ok && data && data.success && data.data && data.data.username) {
      currentUsername = String(data.data.username || '');
      ui.loginBtn.textContent = getUserInitial(currentUsername);
      await storageSet({ [STORAGE_KEYS.user]: { ...user, ...data.data } });
      return;
    }

    await storageSet({
      [STORAGE_KEYS.token]: '',
      [STORAGE_KEYS.user]: null
    });
    currentUsername = '';
    ui.loginBtn.textContent = '登录';
  }

  function applyFavoriteButtonUi(btn) {
    if (!btn) return;
    if (favoriteState) {
      btn.textContent = '取消收藏';
      btn.classList.add('danger');
    } else {
      btn.textContent = '收藏';
      btn.classList.remove('danger');
    }
  }

  async function refreshFavoriteState() {
    const authed = await isAuthed();
    if (!authed) {
      favoriteState = null;
      return;
    }
    const { res, data } = await apiFetch(`/papers/${encodeURIComponent(paperId)}/favorite`, { method: 'GET' });
    if (res.ok && data && data.success) {
      favoriteState = Boolean(data.data && data.data.favorited);
    } else {
      favoriteState = null;
    }
  }

  // IndexedDB helper functions
  // IndexedDB operations (via background script)


  async function getCachedAnalysis(pdfUrl) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'getCachedAnalysis',
        data: { pdfUrl }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  async function cacheAnalysis(pdfUrl, analysis) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'cacheAnalysis',
        data: { pdfUrl, analysis }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  async function addToReadingHistory(pdfUrl, title) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'addToReadingHistory',
        data: { pdfUrl, title }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  async function getReadingHistory() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'getReadingHistory',
        data: {}
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  async function deleteFromReadingHistory(pdfUrl) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'deleteFromReadingHistory',
        data: { pdfUrl }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  // TOS upload functions
  async function getTosConfig() {
    const cfg = await storageGet([STORAGE_KEYS.tosEndpoint, STORAGE_KEYS.tosBucket]);
    return {
      endpoint: cfg[STORAGE_KEYS.tosEndpoint] || 'https://tos-s3-cn-beijing.volces.com',
      bucket: cfg[STORAGE_KEYS.tosBucket] || 'paperily'
    };
  }

  // 上传PDF文件到TOS
  async function uploadPdfToTos(pdfUrl, presignedUrl) {
    let pdfUrlToUpload = pdfUrl;
    try {
      // 特殊处理 IEEE Xplore: 页面是 HTML 包装器，PDF 在 iframe 中
      if (pdfUrl.includes('ieeexplore.ieee.org/stamp/stamp.jsp')) {
        try {
          const iframes = document.getElementsByTagName('iframe');
          for (const iframe of iframes) {
            if (iframe.src && iframe.src.includes('.pdf')) {
              console.log('检测到 IEEE Xplore，重定向 PDF URL 到 iframe:', iframe.src);
              pdfUrlToUpload = iframe.src;
              break;
            }
          }
        } catch (e) {
          console.warn('尝试解析 IEEE iframe 失败:', e);
        }
      }
      
      // 特殊处理 ACM: 页面是 HTML 包装器，PDF链接需要重定向
      if (pdfUrl.includes('dl.acm.org/doi/epdf/')) {
        try {
          // 将 /epdf/ 替换为 /pdf/ 以获取正确的PDF链接
          const pdfUrlToUpload = pdfUrl.replace('/doi/epdf/', '/doi/pdf/');
          console.log('将 ACM epdf URL 替换为 pdf URL:', pdfUrlToUpload);
        } catch (e) {
          console.warn('尝试处理 ACM 页面失败:', e);
        }
      }

      // 尝试从当前网页的PDF内存数据中获取PDF
      let pdfBlob = null;

      try {
        // 检查是否有内置的PDFViewerApplication（Chrome PDF查看器）
        if (window.PDFViewerApplication && window.PDFViewerApplication.pdfDocument) {
          console.log('尝试从Chrome PDF查看器获取PDF内存数据...');
          const pdfData = await window.PDFViewerApplication.pdfDocument.getData();
          pdfBlob = new Blob([pdfData], { type: 'application/pdf' });
          console.log('成功获取PDF内存数据');
        } else {
          console.log('Chrome PDF查看器不可用，将尝试直接从页面下载PDF...');
          // 尝试直接从页面下载PDF，利用当前页面的认证信息
          try {
            const response = await fetch(pdfUrl, {
              credentials: 'include',
              headers: {
                'Accept': 'application/pdf'
              },
              mode: 'same-origin' // 使用same-origin模式以确保认证信息被正确传递
            });
            
            if (response.ok) {
              pdfBlob = await response.blob();
              console.log('成功直接从页面下载PDF，大小:', pdfBlob.size, 'bytes');
            } else {
              console.log('直接下载PDF失败，将回退到background下载:', response.status);
            }
          } catch (downloadError) {
            console.error('直接下载PDF失败:', downloadError);
          }
        }
      } catch (error) {
        console.error('从PDF查看器获取内存数据失败:', error);
      }

      // 验证是否为PDF文件
      if (pdfBlob) {
        // 检查文件类型
        if (!pdfBlob.type.includes('pdf')) {
          throw new Error('下载的文件不是PDF文件');
        }
        
        // 检查文件大小
        if (pdfBlob.size > 100 * 1024 * 1024) {
          throw new Error('PDF文件过大(超过100MB)，无法解析');
        }
        
        // 检查文件头是否为PDF
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const header = new TextDecoder().decode(uint8Array.subarray(0, 4));
        if (header !== '%PDF') {
          throw new Error('下载的文件不是有效的PDF文件');
        }
        
        console.log('PDF文件验证通过');
      } else {
        // 如果没有内存数据，上传失败
        console.error('没有PDF内存数据，无法上传');
        throw new Error('没有PDF内存数据，无法上传');
      }

      // Use the provided presignedUrl

      // 上传PDF到TOS
      let uploadResult;
      try {
        // 将pdfBlob转换为base64
        const reader = new FileReader();
        const base64Data = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(pdfBlob);
        });
        console.log('成功将PDF数据转换为base64');
        
        // 发送消息时传递base64数据
        uploadResult = await chrome.runtime.sendMessage({
          type: 'tos_upload',
          url: presignedUrl,
          pdfUrl: pdfUrlToUpload,
          pdfBase64: base64Data // 使用base64传递
        });
      } catch (error) {
        // 检查是否是扩展上下文失效错误
        if (error.message && error.message.includes('Extension context invalidated')) {
          console.error('Extension context invalidated. Please refresh the page.');
          showToast('扩展上下文已失效，请刷新页面后重试');
        }
        throw error;
      }

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || '上传PDF到TOS失败');
      }

      console.log('PDF成功上传到TOS');
      return pdfUrl;
    } catch (error) {
      console.error('上传PDF到TOS失败:', error);
      throw error;
    }
  }

  // 从TOS读取PDF分析结果
  async function readFromTos(tosUrl) {
    try {
      let readResult;
      try {
        readResult = await chrome.runtime.sendMessage({
          type: 'tos_read',
          url: tosUrl
        });
      } catch (error) {
        // 检查是否是扩展上下文失效错误
        if (error.message && error.message.includes('Extension context invalidated')) {
          console.error('Extension context invalidated. Please refresh the page.');
          showToast('扩展上下文已失效，请刷新页面后重试');
        }
        throw error;
      }

      if (!readResult.success) {
        // 检查是否为 NoSuchKey 错误
        if (readResult.error && (readResult.error.includes('NoSuchKey') || readResult.error.includes('The specified key does not exist'))) {
          // 对于 NoSuchKey 错误，返回 null 表示不存在
          return null;
        }
        throw new Error(readResult.error || '从TOS读取失败');
      }

      return readResult.text;
    } catch (error) {
      console.error('从TOS读取失败:', error);
      // 检查错误信息中是否包含 NoSuchKey
      if (error.message && (error.message.includes('NoSuchKey') || error.message.includes('The specified key does not exist'))) {
        // 对于 NoSuchKey 错误，返回 null 表示不存在
        return null;
      }
      throw error;
    }
  }



  async function analyze() {
    // Check authentication first
    const authed = await ensureAuthInteractive({ preserveModal: true });
    if (!authed) return;

    await updateLoginButton();
    
    ui.analyzeBtn.disabled = true;
    
    let pdfUrl;
    try {
      // Get PDF URL
      pdfUrl = window.location.href;

      // Convert arXiv abstract page URL to PDF URL if needed
      if (pdfUrl.includes('arxiv.org/abs/')) {
        pdfUrl = pdfUrl.replace('/abs/', '/pdf/') + '.pdf';
      }

      // Validate PDF URL
      if (!pdfUrl || pdfUrl === 'undefined' || pdfUrl.includes('undefined')) {
        throw new Error('无效的PDF URL');
      }

      // Add to reading history immediately when analyze button is clicked
      const initialTitle = inferTitleFromUrl(pdfUrl);
      try {
        await addToReadingHistory(pdfUrl, initialTitle);
      } catch (error) {
        console.error('Error adding to reading history immediately:', error);
      }

      // 1. First try to get analysis from IndexedDB cache
      let analysisResult = await getCachedAnalysis(pdfUrl);

      if (analysisResult) {
        console.log('Found analysis in IndexedDB cache');
        cachedAnalysis = analysisResult;
      } else {
        // 2. Get GET presigned URL from TOS
        console.log('Getting GET presigned URL from TOS...');
        const { res: getPresignedRes, data: getPresignedData } = await apiFetch('/tos/presigned-url', {
          method: 'POST',
          body: JSON.stringify({ pdfUrl, type: 'get', file_name: 'gpt.txt' })
        });

        if (!getPresignedRes.ok || !getPresignedData || !getPresignedData.success) {
          throw new Error((getPresignedData && (getPresignedData.error || getPresignedData.message)) || '获取GET预签名URL失败');
        }

        const { presignedUrl: getPresignedUrl, exists: getExists } = getPresignedData.data;

        // 3. Try to read from TOS only if analysis exists
        if (getExists) {
          console.log('Reading analysis result from TOS...');
          ui.analyzeBtn.textContent = '解析中...';
          const analysisText = await readFromTos(getPresignedUrl);
          if (analysisText) {
            analysisResult = analysisText;
            cachedAnalysis = analysisResult;
            await cacheAnalysis(pdfUrl, cachedAnalysis);
            console.log('Analysis found in TOS and cached');
          }
        }

        // 4. If analysis not found in TOS, upload and analyze PDF
        if (!analysisResult) {
          // 清理PDF URL中的逗号
          let cleanPdfUrl = pdfUrl.replace(/,$/, '');
          
          // Get PUT presigned URL
          console.log('Getting PUT presigned URL for PDF upload...');
          const { res: putPresignedRes, data: putPresignedData } = await apiFetch('/tos/presigned-url', {
            method: 'POST',
            body: JSON.stringify({ pdfUrl: cleanPdfUrl, type: 'put', file_name: 'paper.pdf'})
          });

          if (!putPresignedRes.ok || !putPresignedData || !putPresignedData.success) {
            throw new Error((putPresignedData && (putPresignedData.error || putPresignedData.message)) || '获取PUT预签名URL失败');
          }

          const { presignedUrl: putPresignedUrl, exists: putExists } = putPresignedData.data;

          // Upload PDF to TOS only if PDF doesn't exist yet
          if (!putExists) {
            ui.analyzeBtn.textContent = '上传中...';
            console.log('Uploading PDF to TOS...');
            // 上传PDF并获取实际的PDF URL
            const actualPdfUrl = await uploadPdfToTos(cleanPdfUrl, putPresignedUrl);
            // 如果获取到了实际的PDF URL，更新cleanPdfUrl
            if (actualPdfUrl) {
              cleanPdfUrl = actualPdfUrl;
              console.log('更新PDF URL为:', cleanPdfUrl);
            }
          } else {
            console.log('PDF already exists in TOS, skipping upload');
          }

          // Call analyzeTOS API to process the PDF
          ui.analyzeBtn.textContent = '解析中...';
          console.log('Calling analyzeTOS API...');
          const { res: analyzeRes, data: analyzeData } = await apiFetch('/analyzeTOS', {
            method: 'POST',
            body: JSON.stringify({ pdfUrl: cleanPdfUrl })
          });

          if (!analyzeRes.ok || !analyzeData || !analyzeData.success) {
            throw new Error((analyzeData && (analyzeData.error || analyzeData.message)) || '解析失败');
          }

          // Read analysis result from TOS
          console.log('Reading analysis result from TOS after analysis...');
          const analysisTextAfter = await readFromTos(getPresignedUrl);
          if (!analysisTextAfter) {
            throw new Error('分析完成后未能在TOS中找到结果');
          }
          analysisResult = analysisTextAfter;
          cachedAnalysis = analysisResult;
          
          // Cache the analysis result to IndexedDB
          await cacheAnalysis(cleanPdfUrl, cachedAnalysis);
          console.log('Analysis completed and cached');
          
          // 更新pdfUrl为清理后的版本，用于后续操作
          pdfUrl = cleanPdfUrl;
        }
      }

      // 4. Display the analysis result
      if (cachedAnalysis) {
        // Clean up the title and remove prefix
        const rawTitle = cachedAnalysis.split('\n')[0]?.trim() || '';
        cachedTitle = rawTitle
          .replace(/^[#\s]+/, '') // Remove leading hash and spaces
          .replace(/^论文题目[:：]\s*/, '') // Remove "论文题目:" prefix
          .trim() || inferTitleFromUrl(pdfUrl);
        
        // Add to reading history with the correct title from analysis
        try {
          await addToReadingHistory(pdfUrl, cachedTitle);
        } catch (error) {
          console.error('Error adding to reading history:', error);
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'paperily-analyze-modal';

        const md = document.createElement('div');
        md.className = 'paperily-markdown';
        
        // Use marked to parse markdown
        if (typeof marked !== 'undefined') {
          // Remove the first line (title) from the displayed content to avoid duplication
          // Also handle cases where there might be empty lines after the title
          let contentToRender = cachedAnalysis.trim();
          const firstLineBreak = contentToRender.indexOf('\n');
          if (firstLineBreak !== -1) {
             contentToRender = contentToRender.substring(firstLineBreak + 1).trim();
          } else {
             contentToRender = ''; // Only title exists
          }
          
          // Pre-process content to preserve LaTeX backslashes from marked.js parsing
          // marked.js consumes backslashes, so \( becomes ( which breaks KaTeX detection
          // We double escape them so \\( becomes \( after marked processing
          contentToRender = contentToRender
            .replace(/\\\(/g, '\\\\(')
            .replace(/\\\)/g, '\\\\)')
            .replace(/\\\[/g, '\\\\[')
            .replace(/\\\]/g, '\\\\]');

          md.innerHTML = marked.parse(contentToRender);
          
          // Post-process for tables to add wrapper
          md.querySelectorAll('table').forEach(table => {
            const wrapper = document.createElement('div');
            wrapper.className = 'paperily-table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
          });

          // Render Math with KaTeX
          if (typeof renderMathInElement !== 'undefined') {
            renderMathInElement(md, {
              delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false},
                {left: '\\[', right: '\\]', display: true}
              ],
              throwOnError: false,
              output: 'html'
            });
          }
        } else {
          // Fallback if marked is not loaded for some reason
          md.textContent = cachedAnalysis;
          console.error('marked library not found');
        }

        wrapper.appendChild(md);

        const divider = document.createElement('div');
        divider.className = 'paperily-divider';
        wrapper.appendChild(divider);

        const favoriteBtn = document.createElement('span');
        favoriteBtn.className = 'paperily-comment-link';

        const commentsTitle = document.createElement('div');
        commentsTitle.className = 'paperily-section-title';
        commentsTitle.textContent = '评论区';
        wrapper.appendChild(commentsTitle);

        const formField = document.createElement('div');
        formField.className = 'paperily-field';
        formField.innerHTML = `
            <textarea class="paperily-textarea" placeholder="写下你的评论..."></textarea>
          `;
        formField.style.marginBottom = '0px';
        formField.style.gap = '0px';

        const submitRow = document.createElement('div');
        submitRow.className = 'paperily-actions';
        submitRow.style.marginTop = '0';
        submitRow.style.paddingTop = '0';
        submitRow.style.borderTop = 'none';
        
        // Check authentication status first
        const isAuthenticated = await isAuthed();
        
        // Create submit element based on authentication status
        let submitElement;
        if (isAuthenticated) {
          // Authenticated - show button
          submitElement = document.createElement('button');
          submitElement.className = 'paperily-btn primary';
          submitElement.textContent = '发表评论';
        } else {
          // Not authenticated - show text with clickable login
          submitElement = document.createElement('span');
          submitElement.className = 'paperily-comment-link';
          submitElement.style.cursor = 'pointer';
          
          const loginSpan = document.createElement('span');
          loginSpan.textContent = '登录';
          loginSpan.style.cursor = 'pointer';
          loginSpan.style.color = '#3498db';
          loginSpan.addEventListener('click', async () => {
            await ensureAuthInteractive({ preserveModal: true });
          });
          
          const restText = document.createTextNode('可以讨论');
          
          submitElement.appendChild(loginSpan);
          submitElement.appendChild(restText);
        }
        
        submitRow.appendChild(submitElement);

        const commentsSection = document.createElement('div');
        commentsSection.className = 'paperily-comments';

        const textarea = formField.querySelector('textarea');

        // 调整元素顺序：评论区标题 -> 评论内容标签和输入框 -> 发表评论按钮 -> 评论列表
        wrapper.appendChild(formField);
        wrapper.appendChild(submitRow);
        wrapper.appendChild(commentsSection);

        let cachedComments = [];
        const expandedCommentIds = new Set();

        async function fetchComments() {
          const { res, data } = await apiFetch(`/papers/${encodeURIComponent(paperId)}/comments`, { method: 'GET' });
          if (!res.ok || !data || !data.success) return [];
          return Array.isArray(data.data) ? data.data : [];
        }

        function countAllReplies(replies) {
          if (!replies || replies.length === 0) return 0;
          let count = replies.length;
          replies.forEach((r) => {
            if (r.replies && r.replies.length) {
              count += countAllReplies(r.replies);
            }
          });
          return count;
        }

        function flattenReplies(replies) {
          let out = [];
          (replies || []).forEach((r) => {
            out.push(r);
            if (r.replies && r.replies.length) {
              out = out.concat(flattenReplies(r.replies));
            }
          });
          return out;
        }

        function renderCommentItem(comment, depth = 0) {
          const item = document.createElement('div');
          item.className = `paperily-comment-item${depth ? ` paperily-indent-${depth}` : ''}`;

          const header = document.createElement('div');
          header.className = 'paperily-comment-header';
          header.style.display = 'flex';
          header.style.justifyContent = 'space-between';
          header.style.alignItems = 'flex-start';

          const left = document.createElement('div');
          left.style.display = 'flex';
          left.style.flexDirection = 'column';
          left.style.flexGrow = 1;

          const userEl = document.createElement('div');
          userEl.className = 'paperily-comment-user';
          if (comment.parent_username) {
            userEl.textContent = `${comment.username || '匿名用户'} 回复 ${comment.parent_username}`;
          } else {
            userEl.textContent = comment.username || '匿名用户';
          }

          const dateEl = document.createElement('div');
          dateEl.className = 'paperily-comment-date';
          dateEl.textContent = formatDate(comment.created_at);

          left.appendChild(userEl);
          left.appendChild(dateEl);

          const right = document.createElement('div');
          right.style.display = 'flex';
          right.style.gap = '10px';
          right.style.alignItems = 'center';

          // 仅在depth=0时显示展开按钮（只有评论可以展开回复，回复的回复不显示展开按钮）
          const repliesCount = countAllReplies(comment.replies);
          if (repliesCount > 0 && depth === 0) {
            const toggleBtn = document.createElement('span');
          toggleBtn.className = 'paperily-comment-link';
          const expanded = expandedCommentIds.has(comment.id);
          toggleBtn.textContent = expanded ? `收起（${repliesCount}条回复）` : `展开（${repliesCount}条回复）`;
          toggleBtn.style.cursor = 'pointer';
          toggleBtn.addEventListener('click', async () => {
            if (expandedCommentIds.has(comment.id)) {
              expandedCommentIds.delete(comment.id);
            } else {
              expandedCommentIds.add(comment.id);
            }
            // 重新渲染所有评论，实现平铺显示
            cachedComments = await fetchComments();
            renderComments();
          });
          right.appendChild(toggleBtn);
          }

          const replyBtn = document.createElement('span');
          replyBtn.className = 'paperily-comment-link';
          replyBtn.textContent = '回复';
          replyBtn.style.cursor = 'pointer';
          right.appendChild(replyBtn);

          header.appendChild(left);
          header.appendChild(right);

          const contentEl = document.createElement('div');
          contentEl.className = 'paperily-comment-content';
          // 回复内容中只显示内容，不显示用户名前缀
          contentEl.textContent = comment.content || '';

          // 创建回复表单
          const replyForm = document.createElement('div');
          replyForm.className = 'paperily-reply-form';
          replyForm.style.display = 'none';
          replyForm.innerHTML = `
            <div class="paperily-field">
              <div class="paperily-label">回复内容</div>
              <textarea class="paperily-textarea" rows="3" placeholder="回复..."></textarea>
            </div>
            <div class="paperily-actions">
              <button class="paperily-btn">取消</button>
              <button class="paperily-btn primary">发送</button>
            </div>
          `;

          const cancelBtn = replyForm.querySelector('.paperily-btn');
          const sendBtn = replyForm.querySelector('.paperily-btn.primary');
          const textarea = replyForm.querySelector('textarea');

          // 取消按钮点击事件
          cancelBtn.addEventListener('click', () => {
            replyForm.style.display = 'none';
            if (textarea) textarea.value = '';
          });

          // 回复按钮点击事件
          replyBtn.addEventListener('click', async () => {
            const authed = await ensureAuthInteractive({ preserveModal: true });
            if (!authed) return;
            replyForm.style.display = 'block';
            if (textarea) textarea.focus();
          });

          // 发送按钮点击事件
          sendBtn.addEventListener('click', async () => {
            const content = textarea?.value?.trim() || '';
            if (!content) {
              showToast('请输入回复内容');
              return;
            }

            const threadId = comment.parent_id ? comment.parent_id : comment.id;
            const authed = await ensureAuthInteractive({ preserveModal: true });
            if (!authed) return;

            sendBtn.disabled = true;
            sendBtn.textContent = '发送中...';
            try {
              const { res, data } = await apiFetch(`/papers/${encodeURIComponent(paperId)}/comments`, {
                method: 'POST',
                body: JSON.stringify({
                  content,
                  parent_id: comment.id
                })
              });
              if (!res.ok || !data || !data.success) {
                throw new Error((data && (data.error || data.message)) || '回复失败');
              }
              replyForm.style.display = 'none';
              if (textarea) textarea.value = '';
              // 将threadId添加到展开列表中，确保新发送的回复默认展开
              if (threadId != null) {
                expandedCommentIds.add(threadId);
              }
              // 重新加载评论
              cachedComments = await fetchComments();
              renderComments();
              showToast('回复成功');
            } catch (e) {
              showToast(e && e.message ? e.message : '回复失败');
            } finally {
              sendBtn.disabled = false;
              sendBtn.textContent = '发送';
            }
          });

          item.appendChild(header);
          item.appendChild(contentEl);
          item.appendChild(replyForm);
          return item;
        }

        // Only add click event for submit button if user is authenticated
        if (isAuthenticated) {
          submitElement.addEventListener('click', async () => {
            const content = textarea.value.trim();
            if (!content) return;

            submitElement.disabled = true;
            submitElement.textContent = '发布中...';
            try {
              const { res, data } = await apiFetch(`/papers/${encodeURIComponent(paperId)}/comments`, { 
                method: 'POST',
                body: JSON.stringify({ content })
              });
              if (!res.ok || !data || !data.success) {
                throw new Error((data && (data.error || data.message)) || '评论失败');
              }
              textarea.value = '';
              cachedComments = await fetchComments();
              renderComments();
            } catch (error) {
              showToast('评论失败: ' + error.message);
            } finally {
              submitElement.disabled = false;
              submitElement.textContent = '发表评论';
            }
          });
        }

        async function renderComments() {
          commentsSection.innerHTML = '';
          // 将评论分为自己的评论和他人的评论
          const ownComments = cachedComments.filter(comment => comment.username === currentUsername);
          const otherComments = cachedComments.filter(comment => comment.username !== currentUsername);

          // 自己的评论按创建时间降序排序（最新的在最上面）
          ownComments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          // 他人的评论按原规则排序
          otherComments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

          // 合并所有评论
          const sortedComments = [...ownComments, ...otherComments];

          // 嵌套渲染所有评论和展开的回复，支持缩进层级
          sortedComments.forEach((comment) => {
            commentsSection.appendChild(renderCommentItem(comment, 0));
            // 如果评论被展开，渲染其所有回复（嵌套显示）
            if (expandedCommentIds.has(comment.id) && comment.replies && comment.replies.length) {
              // 递归渲染嵌套回复，传递depth参数
              function renderNestedReplies(replies, depth = 1) {
                // 将回复分为自己的回复和他人的回复
                const ownReplies = replies.filter(reply => reply.username === currentUsername);
                const otherReplies = replies.filter(reply => reply.username !== currentUsername);
                
                // 自己的回复按创建时间降序排序（最新的在最上面）
                ownReplies.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                // 他人的回复按创建时间降序排序
                otherReplies.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                
                // 合并回复数组，自己的回复在前，他人的回复在后
                const sortedReplies = [...ownReplies, ...otherReplies];
                
                sortedReplies.forEach((reply) => {
                  commentsSection.appendChild(renderCommentItem(reply, 1)); // 所有回复统一使用depth=1缩进
                  if (reply.replies && reply.replies.length) {
                    renderNestedReplies(reply.replies, 1); // 回复的回复也使用depth=1
                  }
                });
              }
              renderNestedReplies(comment.replies);
            }
          });
        }

        cachedComments = await fetchComments();
        renderComments();

        // Create and show the modal
        showModal(cachedTitle, wrapper, {
          width: '80%',
          maxWidth: '1200px',
          height: '80vh',
          headerActionsRight: favoriteBtn
        });

        // Update favorite button state
        await updateFavoriteButton(favoriteBtn, paperId, cachedTitle, pdfUrl, isAuthenticated);

        // Add click event for favorite button
        favoriteBtn.addEventListener('click', async () => {
          await handleToggleFavorite(favoriteBtn, paperId, cachedTitle, pdfUrl);
        });

        // Update UI with analysis summary
        ui.analyzeBtn.textContent = '已解析';
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      if (error.message && error.message.includes('PDF文件过大')) {
        alert(error.message);
      } else {
        showToast(error.message);
      }
      cachedAnalysis = '';
    } finally {
      ui.analyzeBtn.disabled = false;
      ui.analyzeBtn.textContent = '解析';
    }
  }

  async function toggleFavorite(targetBtn) {
    if (targetBtn) targetBtn.disabled = true;
    const authed = await ensureAuthInteractive({ preserveModal: true });
    if (!authed) {
      if (targetBtn) targetBtn.disabled = false;
      return;
    }

    await updateLoginButton();

    try {
      if (favoriteState == null) {
        await refreshFavoriteState();
      }

      const title = cachedTitle || inferTitleFromUrl(pdfUrl);
      const paper = {
        id: paperId,
        title,
        links: { pdf: pdfUrl },
        type: 'url'
      };

      if (favoriteState) {
        const { res, data } = await apiFetch(`/papers/${encodeURIComponent(paperId)}/favorite`, { method: 'DELETE' });
        if (!res.ok) {
          throw new Error((data && (data.error || data.message)) || '取消收藏失败');
        }
        favoriteState = false;
        showToast('已取消收藏');
      } else {
        const { res, data } = await apiFetch(`/papers/${encodeURIComponent(paperId)}/favorite`, {
          method: 'POST',
          body: JSON.stringify({ paper })
        });
        if (!res.ok || !data || !data.success) {
          throw new Error((data && (data.error || data.message)) || '收藏失败');
        }
        favoriteState = true;
        showToast('已收藏');
      }
    } catch (e) {
      showToast(e && e.message ? e.message : '操作失败');
    } finally {
      await refreshFavoriteState();
      applyFavoriteButtonUi(targetBtn);
      if (targetBtn) targetBtn.disabled = false;
    }
  }
  
  async function comment() {
    const wrapper = document.createElement('div');
    const title = cachedTitle || inferTitleFromUrl(pdfUrl);

    let cachedComments = [];
    const expandedCommentIds = new Set();

    const formField = document.createElement('div');
    formField.className = 'paperily-field';
    formField.innerHTML = `
      <textarea class="paperily-textarea" id="paperily-comment-content" placeholder="写下你的评论..."></textarea>
    `;
    formField.style.marginBottom = '2px';

    const actions = document.createElement('div');
    actions.className = 'paperily-actions';
    actions.style.marginTop = '0';
    actions.style.borderTop = 'none';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'paperily-btn';
    closeBtn.textContent = '关闭';

    // Create submit element based on authentication status
    let submitBtn;
    const isAuthenticated = await isAuthed();
    
    if (isAuthenticated) {
      // Authenticated - show button
      submitBtn = document.createElement('button');
      submitBtn.className = 'paperily-btn primary';
      submitBtn.textContent = '发表评论';
    } else {
      // Not authenticated - show text with clickable login
      submitBtn = document.createElement('span');
      submitBtn.className = 'paperily-comment-link';
      submitBtn.style.cursor = 'pointer';
      
      const loginSpan = document.createElement('span');
      loginSpan.textContent = '登录';
      loginSpan.style.cursor = 'pointer';
      loginSpan.style.color = '#3498db';
      loginSpan.addEventListener('click', async () => {
        await ensureAuthInteractive({ preserveModal: false });
      });
      
      const restText = document.createTextNode('可以讨论');
      
      submitBtn.appendChild(loginSpan);
      submitBtn.appendChild(restText);
    }

    actions.appendChild(closeBtn);
    actions.appendChild(submitBtn);

    const commentsSection = document.createElement('div');
    commentsSection.className = 'paperily-comments';
    commentsSection.id = 'paperily-comments-section';

    // 调整元素顺序：评论内容标签和输入框 -> 发表评论按钮 -> 评论列表
    wrapper.appendChild(formField);
    wrapper.appendChild(actions);
    wrapper.appendChild(commentsSection);

    closeBtn.addEventListener('click', () => hideModal());

    async function fetchComments() {
      const { res, data } = await apiFetch(`/papers/${encodeURIComponent(paperId)}/comments`, { method: 'GET' });
      if (!res.ok || !data || !data.success) {
        return [];
      }
      return Array.isArray(data.data) ? data.data : [];
    }

    function countAllReplies(replies) {
      if (!replies || replies.length === 0) return 0;
      let count = replies.length;
      replies.forEach((r) => {
        if (r.replies && r.replies.length) {
          count += countAllReplies(r.replies);
        }
      });
      return count;
    }

    function flattenReplies(replies) {
      let out = [];
      (replies || []).forEach((r) => {
        out.push(r);
        if (r.replies && r.replies.length) {
          out = out.concat(flattenReplies(r.replies));
        }
      });
      return out;
    }

    function renderCommentItem(comment, depth = 0) {
      const item = document.createElement('div');
      item.className = `paperily-comment-item${depth ? ` paperily-indent-${depth}` : ''}`;

      const header = document.createElement('div');
      header.className = 'paperily-comment-header';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.flexDirection = 'column';
      left.style.flexGrow = 1;

      const userEl = document.createElement('div');
      userEl.className = 'paperily-comment-user';
      if (comment.parent_username) {
        userEl.textContent = `${comment.username || '匿名用户'} 回复 ${comment.parent_username}`;
      } else {
        userEl.textContent = comment.username || '匿名用户';
      }

      const dateEl = document.createElement('div');
      dateEl.className = 'paperily-comment-date';
      dateEl.textContent = formatDate(comment.created_at);

      left.appendChild(userEl);
      left.appendChild(dateEl);

      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.gap = '10px';
      right.style.alignItems = 'center';

      const replyBtn = document.createElement('span');
      replyBtn.className = 'paperily-comment-link';
      replyBtn.textContent = '回复';
      right.appendChild(replyBtn);

      // 仅在depth=0时显示展开按钮（只有评论可以展开回复，回复的回复不显示展开按钮）
      const repliesCount = countAllReplies(comment.replies);
      if (repliesCount > 0 && depth === 0) {
        const toggleBtn = document.createElement('span');
        toggleBtn.className = 'paperily-comment-link';
        const expanded = expandedCommentIds.has(comment.id);
        toggleBtn.textContent = expanded ? `收起（${repliesCount}条回复）` : `展开（${repliesCount}条回复）`;
        toggleBtn.addEventListener('click', () => {
          if (expandedCommentIds.has(comment.id)) {
            expandedCommentIds.delete(comment.id);
          } else {
            expandedCommentIds.add(comment.id);
          }
          renderComments(cachedComments);
        });
        right.appendChild(toggleBtn);
      }

      header.appendChild(left);
      header.appendChild(right);

      const contentEl = document.createElement('div');
      contentEl.className = 'paperily-comment-content';
      // 回复内容中只显示内容，不显示用户名前缀
      contentEl.textContent = comment.content || '';

      const actionsRow = document.createElement('div');
      actionsRow.className = 'paperily-comment-actions';
      // 清空actionsRow，因为按钮已经移到header中
      actionsRow.innerHTML = '';

      const replyForm = document.createElement('div');
      replyForm.className = 'paperily-reply-form';
      replyForm.style.display = 'none';
      replyForm.innerHTML = `
        <div class="paperily-field">
          <div class="paperily-label">回复内容</div>
          <textarea class="paperily-textarea" rows="3" placeholder="回复..." ></textarea>
        </div>
        <div class="paperily-actions">
          <button class="paperily-btn">取消</button>
          <button class="paperily-btn primary">发送</button>
        </div>
      `;

      const cancelBtn = replyForm.querySelector('.paperily-btn');
      const sendBtn = replyForm.querySelector('.paperily-btn.primary');
      const textarea = replyForm.querySelector('textarea');

      cancelBtn.addEventListener('click', () => {
        replyForm.style.display = 'none';
        if (textarea) textarea.value = '';
      });

      replyBtn.addEventListener('click', async () => {
        const authed = await ensureAuthInteractive({ preserveModal: true });
        if (!authed) return;
        replyForm.style.display = 'block';
        if (textarea) textarea.focus();
      });

      sendBtn.addEventListener('click', async () => {
        const content = textarea?.value?.trim() || '';
        if (!content) {
          showToast('请输入回复内容');
          return;
        }

        const threadId = comment.parent_id ? comment.parent_id : comment.id;
        const authed = await ensureAuthInteractive({ preserveModal: true });
        if (!authed) return;

        sendBtn.disabled = true;
        sendBtn.textContent = '发送中...';
        try {
          const paper = {
            id: paperId,
            title,
            links: { pdf: pdfUrl },
            type: 'url'
          };
          const { res, data } = await apiFetch(`/papers/${encodeURIComponent(paperId)}/comments`, {
            method: 'POST',
            body: JSON.stringify({
              content,
              parent_id: comment.id,
              paper
            })
          });
          if (!res.ok || !data || !data.success) {
            throw new Error((data && (data.error || data.message)) || '回复失败');
          }
          replyForm.style.display = 'none';
          if (textarea) textarea.value = '';
          if (threadId != null) {
            expandedCommentIds.add(threadId);
          }
          await loadAndRenderComments();
          showToast('回复成功');
        } catch (e) {
          showToast(e && e.message ? e.message : '回复失败');
        } finally {
          sendBtn.disabled = false;
          sendBtn.textContent = '发送';
        }
      });

      item.appendChild(header);
      item.appendChild(contentEl);
      item.appendChild(replyForm);
      return item;
    }

    function renderComments(comments) {
      commentsSection.replaceChildren();
      if (!comments.length) {
        return;
      }

      // 将评论分为自己的评论和他人的评论
      const ownComments = comments.filter(comment => comment.username === currentUsername);
      const otherComments = comments.filter(comment => comment.username !== currentUsername);

      // 自己的评论按创建时间降序排序（最新的在最上面）
      ownComments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      // 他人的评论按原规则排序
      otherComments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // 合并并渲染所有评论
      const sortedComments = [...ownComments, ...otherComments];

      sortedComments.forEach((c) => {
        commentsSection.appendChild(renderCommentItem(c, 0));
        const expanded = expandedCommentIds.has(c.id);
        if (expanded && c.replies && c.replies.length) {
          // 渲染嵌套回复，使用固定depth=1
          function renderNestedReplies(replies, depth = 1) {
            // 将回复分为自己的回复和他人的回复
            const ownReplies = replies.filter(reply => reply.username === currentUsername);
            const otherReplies = replies.filter(reply => reply.username !== currentUsername);
            
            // 自己的回复按创建时间降序排序（最新的在最上面）
            ownReplies.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            // 他人的回复按创建时间降序排序
            otherReplies.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            // 合并回复数组，自己的回复在前，他人的回复在后
            const sortedReplies = [...ownReplies, ...otherReplies];
            
            sortedReplies.forEach((reply) => {
              commentsSection.appendChild(renderCommentItem(reply, 1)); // 所有回复统一使用depth=1缩进
              if (reply.replies && reply.replies.length) {
                renderNestedReplies(reply.replies, 1); // 回复的回复也使用depth=1
              }
            });
          }
          renderNestedReplies(c.replies);
        }
      });
    }

    async function loadAndRenderComments() {
      cachedComments = await fetchComments();
      // 默认展开只有1条回复的评论（包括嵌套回复）
      function checkAndExpandComments(comments) {
        comments.forEach(comment => {
          const repliesCount = countAllReplies(comment.replies);
          if (repliesCount === 1) {
            expandedCommentIds.add(comment.id);
          }
          // 递归检查嵌套回复
          if (comment.replies && comment.replies.length > 0) {
            checkAndExpandComments(comment.replies);
          }
        });
      }
      checkAndExpandComments(cachedComments);
      renderComments(cachedComments);
    }

    submitBtn.addEventListener('click', async () => {
      const content = wrapper.querySelector('#paperily-comment-content')?.value?.trim() || '';
      if (!content) {
        showToast('请输入评论内容');
        return;
      }

      const authed = await ensureAuthInteractive({ preserveModal: true });
      if (!authed) return;

      submitBtn.disabled = true;
      submitBtn.textContent = '发表中...';
      try {
        const paper = {
          id: paperId,
          title,
          links: { pdf: pdfUrl },
          type: 'url'
        };
        const { res, data } = await apiFetch(`/papers/${encodeURIComponent(paperId)}/comments`, {
          method: 'POST',
          body: JSON.stringify({
            content,
            paper
          })
        });
        if (!res.ok || !data || !data.success) {
          throw new Error((data && (data.error || data.message)) || '评论失败');
        }
        wrapper.querySelector('#paperily-comment-content').value = '';
        await loadAndRenderComments();
        showToast('评论成功');
      } catch (e) {
        showToast(e && e.message ? e.message : '评论失败');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '发表评论';
      }
    });

    showModal('评论', wrapper);
    if (!(await isAuthed())) {
      showToast('登录后可评论/回复');
    }
    await loadAndRenderComments();
  }

  async function openUserPanel() {
    const authed = await ensureAuthInteractive({ preserveModal: false });
    if (!authed) return;

    await updateLoginButton();
    const username = currentUsername || '用户';

    const wrapper = document.createElement('div');
    wrapper.className = 'paperily-user-panel';

    // Reading History Section
    const historySection = document.createElement('div');
    const historyTitleRow = document.createElement('div');
    historyTitleRow.className = 'paperily-section-title-row';
    historyTitleRow.innerHTML = `
      <div class="paperily-section-title">阅读历史</div>
    `;
    const historyList = document.createElement('div');
    historyList.className = 'paperily-list';
    historySection.appendChild(historyTitleRow);
    historySection.appendChild(historyList);

    // Favorites Section
    const favoritesSection = document.createElement('div');
    const favoritesTitleRow = document.createElement('div');
    favoritesTitleRow.className = 'paperily-section-title-row';
    favoritesTitleRow.innerHTML = `
      <div class="paperily-section-title">收藏夹</div>
    `;
    const favoritesList = document.createElement('div');
    favoritesList.className = 'paperily-list';
    favoritesSection.appendChild(favoritesTitleRow);
    favoritesSection.appendChild(favoritesList);

    // Comments Section
    const commentsSection = document.createElement('div');
    const commentsTitleRow = document.createElement('div');
    commentsTitleRow.className = 'paperily-section-title-row';
    commentsTitleRow.innerHTML = `
      <div class="paperily-section-title">评论列表</div>
    `;
    const commentsList = document.createElement('div');
    commentsList.className = 'paperily-list';
    commentsSection.appendChild(commentsTitleRow);
    commentsSection.appendChild(commentsList);

    // Add sections to wrapper
    wrapper.appendChild(historySection);
    wrapper.appendChild(favoritesSection);
    wrapper.appendChild(commentsSection);

    function setEmpty(listEl, text) {
      listEl.replaceChildren();
      const empty = document.createElement('div');
      empty.className = 'paperily-empty';
      empty.textContent = text;
      listEl.appendChild(empty);
    }

    function renderLinkItem({ title, meta, onOpen, actions = [] }) {
      const row = document.createElement('div');
      row.className = 'paperily-list-item';

      const btn = document.createElement('button');
      btn.className = 'paperily-list-link';
      btn.textContent = title || '';
      btn.addEventListener('click', onOpen);

      const metaEl = document.createElement('div');
      metaEl.className = 'paperily-list-meta';
      metaEl.textContent = meta || '';

      const right = document.createElement('div');
      right.className = 'paperily-list-right';
      if (meta) right.appendChild(metaEl);

      actions.forEach((a) => {
        const actionBtn = document.createElement('button');
        actionBtn.className = `paperily-link-btn${a.danger ? ' danger' : ''}`;
        actionBtn.textContent = a.label;
        actionBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await a.onClick();
        });
        right.appendChild(actionBtn);
      });

      row.appendChild(btn);
      row.appendChild(right);
      return row;
    }

    // Pagination state
    const pagination = {
      history: { page: 0, itemsPerPage: 5, hasMore: true },
      favorites: { page: 0, itemsPerPage: 5, hasMore: true },
      comments: { page: 0, itemsPerPage: 5, hasMore: true }
    };

    // Function to render items with pagination
    function renderItemsWithPagination(listEl, items, renderFn, storeKey) {
      listEl.replaceChildren();
      if (items.length === 0) {
        setEmpty(listEl, storeKey === 'history' ? '暂无阅读历史' : storeKey === 'favorites' ? '暂无收藏' : '暂无评论');
        return;
      }

      const page = pagination[storeKey].page;
      const itemsPerPage = pagination[storeKey].itemsPerPage;
      const startIndex = page * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const itemsToShow = items.slice(startIndex, endIndex);

      itemsToShow.forEach(item => listEl.appendChild(renderFn(item)));

      // Create pagination container
      const paginationContainer = document.createElement('div');
      paginationContainer.style.textAlign = 'right';
      paginationContainer.style.marginTop = '10px';

      // Show previous page button if not on first page
      if (page > 0) {
        const prevBtn = document.createElement('span');
        prevBtn.className = 'paperily-pagination-link';
        prevBtn.textContent = '上一页';
        prevBtn.style.marginRight = '10px';
        prevBtn.addEventListener('click', () => {
          pagination[storeKey].page--;
          load();
        });
        paginationContainer.appendChild(prevBtn);
      }

      // Show next page button if there are more items
      if (endIndex < items.length) {
        const nextBtn = document.createElement('span');
        nextBtn.className = 'paperily-pagination-link';
        nextBtn.textContent = '下一页';
        nextBtn.addEventListener('click', () => {
          pagination[storeKey].page++;
          load();
        });
        paginationContainer.appendChild(nextBtn);
      }

      // Only add pagination container if we have either prev or next button
      if (paginationContainer.children.length > 0) {
        listEl.appendChild(paginationContainer);
      }
    }

    async function load() {
      try {
        // Load reading history from IndexedDB
        const historyItems = await getReadingHistory();
        // Sort by timestamp (newest first)
        const sortedHistory = historyItems.sort((a, b) => b.timestamp - a.timestamp);

        // Load favorites and comments from API
        const [{ res: favRes, data: favData }, { res: comRes, data: comData }] = await Promise.all([
          apiFetch('/favorites', { method: 'GET' }),
          apiFetch('/commented-papers', { method: 'GET' })
        ]);

        // Render reading history
        renderItemsWithPagination(historyList, sortedHistory, (item) => {
          return renderLinkItem({
            title: item.title,
            meta: formatDate(item.timestamp),
            onOpen: () => {
              window.open(item.pdfUrl, '_blank');
            },
            actions: [
              {
                label: '删除',
                danger: true,
                onClick: async () => {
                  await deleteFromReadingHistory(item.pdfUrl);
                  await load();
                  showToast('已删除阅读记录');
                }
              }
            ]
          });
        }, 'history');

        // Render favorites with pagination
        if (!favRes.ok || !favData || !favData.success) {
          setEmpty(favoritesList, '收藏加载失败');
        } else {
          const favorites = Array.isArray(favData.data) ? favData.data : [];
          renderItemsWithPagination(favoritesList, favorites, (f) => {
            const pdf = f.paper_links && f.paper_links.pdf ? String(f.paper_links.pdf) : '';
            const paperIdToRemove = f.paper_id ? String(f.paper_id) : '';
            return renderLinkItem({
              title: f.paper_title,
              meta: '',
              onOpen: () => {
                if (pdf) {
                  window.open(pdf, '_blank');
                } else {
                  showToast('缺少PDF链接');
                }
              },
              actions: [
                {
                  label: '取消收藏',
                  danger: true,
                  onClick: async () => {
                    if (!paperIdToRemove) {
                      showToast('缺少paperId');
                      return;
                    }
                    const { res, data } = await apiFetch(`/papers/${encodeURIComponent(paperIdToRemove)}/favorite`, { method: 'DELETE' });
                    if (!res.ok) {
                      showToast((data && (data.error || data.message)) || '取消收藏失败');
                      return;
                    }
                    await refreshFavoriteState();
                    await load();
                    showToast('已取消收藏');
                  }
                }
              ]
            });
          }, 'favorites');
        }

        // Render comments with pagination
        if (!comRes.ok || !comData || !comData.success) {
          setEmpty(commentsList, '评论加载失败');
        } else {
          const papers = Array.isArray(comData.data) ? comData.data : [];
          renderItemsWithPagination(commentsList, papers, (p) => {
            const pdf = p.paper_links && p.paper_links.pdf ? String(p.paper_links.pdf) : '';
            const meta = formatDate(p.last_commented_at);
            return renderLinkItem({
              title: p.paper_title,
              meta,
              onOpen: () => {
                if (pdf) {
                  window.open(pdf, '_blank');
                } else {
                  showToast('缺少PDF链接');
                }
              }
            });
          }, 'comments');
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setEmpty(historyList, '阅读历史加载失败');
        setEmpty(favoritesList, '收藏加载失败');
        setEmpty(commentsList, '评论加载失败');
      }
    }

    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'paperily-link-btn danger';
    logoutBtn.textContent = '登出';
    logoutBtn.addEventListener('click', async () => {
      await storageSet({
        [STORAGE_KEYS.token]: '',
        [STORAGE_KEYS.user]: null
      });
      authChanged();
      hideModal();
      await updateLoginButton();
      showToast('已登出');
    });

    // 添加缓存大小显示
    const cacheSizeSpan = document.createElement('span');
    cacheSizeSpan.style.marginRight = '10px';
    cacheSizeSpan.style.fontSize = '12px';
    cacheSizeSpan.style.color = '#666';
    
    // 获取缓存大小的函数
    async function updateCacheSize() {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'get_cache_size'
        });
        
        if (response && response.success) {
          const size = response.data;
          cacheSizeSpan.textContent = `缓存大小: ${formatFileSize(size)}`;
        } else {
          cacheSizeSpan.textContent = '缓存大小: 未知';
        }
      } catch (error) {
        console.error('获取缓存大小失败:', error);
        cacheSizeSpan.textContent = '缓存大小: 未知';
      }
    }
    
    // 文件大小格式化函数
    function formatFileSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // 添加清空缓存按钮
    const clearCacheBtn = document.createElement('button');
    clearCacheBtn.className = 'paperily-link-btn';
    clearCacheBtn.textContent = '清空缓存';
    clearCacheBtn.addEventListener('click', async () => {
      // 显示确认框
      if (confirm('确定要清空所有缓存吗？此操作不可恢复。')) {
        try {
          // 向扩展发送消息，清空IndexedDB缓存
          const response = await chrome.runtime.sendMessage({
            type: 'clear_cache'
          });
          
          if (response && response.success) {
            showToast('缓存已清空');
            // 更新缓存大小显示
            await updateCacheSize();
          } else {
            throw new Error(response.error || '清空缓存失败');
          }
        } catch (error) {
          console.error('清空缓存失败:', error);
          showToast('清空缓存失败');
        }
      }
    });
    
    // 初始加载缓存大小
    updateCacheSize();

    const headerActions = document.createElement('div');
    headerActions.style.display = 'flex';
    headerActions.style.alignItems = 'center';
    headerActions.style.gap = '10px';
    headerActions.appendChild(cacheSizeSpan);
    headerActions.appendChild(clearCacheBtn);
    headerActions.appendChild(logoutBtn);

    showModal(username, wrapper, { headerActions });
    setEmpty(favoritesList, '加载中...');
    setEmpty(commentsList, '加载中...');
    await load();
  }

  function setActiveButton(activeBtn) {
    [ui.analyzeBtn, ui.loginBtn, ui.searchBtn].forEach((btn) => {
      btn.classList.toggle('primary', btn === activeBtn);
    });
  }

  ui.analyzeBtn.addEventListener('click', async () => {
    setActiveButton(ui.analyzeBtn);
    await analyze();
  });
  ui.loginBtn.addEventListener('click', async () => {
    setActiveButton(ui.loginBtn);
    const authed = await ensureAuthInteractive({ preserveModal: false });
    if (!authed) return;
    await updateLoginButton();
    await openUserPanel();
  });
  ui.searchBtn.addEventListener('click', () => {
    setActiveButton(ui.searchBtn);
    showSearchModal();
  });

  await refreshFavoriteState();
  await updateLoginButton();

  // Function to update buttons in the current modal when auth status changes
  async function updateModalButtons() {
    const backdrop = document.getElementById('paperily-modal-backdrop');
    if (!backdrop || backdrop.style.display === 'none' || backdrop.style.display === '') {
      return; // No modal open
    }

    const isAuthenticated = await isAuthed();
    
    // Update favorite button
    const favoriteBtn = document.querySelector('#paperily-modal-header-actions .paperily-comment-link, #paperily-modal-header-actions .paperily-favorite-btn');
    if (favoriteBtn) {
      const modalTitle = document.getElementById('paperily-modal-title');
      const title = modalTitle ? modalTitle.textContent : '';
      await updateFavoriteButton(favoriteBtn, paperId, title, window.location.href, isAuthenticated);
    }
    
    // Update comment submit button
    // 更精确地查找评论按钮，包括所有可能的父元素结构
    const commentSubmitBtn = document.querySelector('#paperily-modal-body .paperily-comment-link, #paperily-modal-body .paperily-btn.primary, #paperily-modal-body .paperily-submit-row .paperily-comment-link, #paperily-modal-body .paperily-submit-row .paperily-btn.primary');
    
    if (commentSubmitBtn) {
      // 检查按钮是否是我们需要更新的（包含评论相关文本）
      const btnText = commentSubmitBtn.textContent.trim();
      if (btnText.includes('发表评论') || btnText.includes('登录可以讨论')) {
        // 查找文本输入框，可能在按钮的兄弟元素或父元素的兄弟元素中
        const formField = document.querySelector('#paperily-modal-body .paperily-field textarea, #paperily-modal-body textarea');
        
        if (formField) {
          // Recreate the submit button based on new auth status
          const parent = commentSubmitBtn.parentNode;
          if (parent) {
            parent.removeChild(commentSubmitBtn);
            
            let newSubmitBtn;
            if (isAuthenticated) {
              // Authenticated - show button
              newSubmitBtn = document.createElement('button');
              newSubmitBtn.className = 'paperily-btn primary';
              newSubmitBtn.textContent = '发表评论';
              newSubmitBtn.addEventListener('click', async () => {
                const content = formField.value.trim();
                if (content) {
                  await apiFetch(`/papers/${encodeURIComponent(paperId)}/comments`, {
                    method: 'POST',
                    body: JSON.stringify({ content })
                  });
                }
              });
            } else {
              // Not authenticated - show text with clickable login
              newSubmitBtn = document.createElement('span');
              newSubmitBtn.className = 'paperily-comment-link';
              newSubmitBtn.style.cursor = 'pointer';
              
              const loginSpan = document.createElement('span');
              loginSpan.textContent = '登录';
              loginSpan.style.cursor = 'pointer';
              loginSpan.style.color = '#3498db';
              loginSpan.addEventListener('click', async () => {
                await ensureAuthInteractive({ preserveModal: true });
              });
              
              const restText = document.createTextNode('可以讨论');
              
              newSubmitBtn.appendChild(loginSpan);
              newSubmitBtn.appendChild(restText);
            }
            
            parent.appendChild(newSubmitBtn);
          }
        }
      }
    }
  }



  window.addEventListener('paperily-auth-changed', async () => {
    await refreshFavoriteState();
    await updateLoginButton();
    await updateModalButtons();
  });
}

// 执行主函数并处理可能的扩展上下文失效错误
(async () => {
  try {
    await run();
  } catch (error) {
    // 检查是否是扩展上下文失效错误
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.error('Extension context invalidated. Please refresh the page.');
      showToast('扩展上下文已失效，请刷新页面后重试');
    } else {
      console.error('Unexpected error in extension:', error);
    }
  }
})();