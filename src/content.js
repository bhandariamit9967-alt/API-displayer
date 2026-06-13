

(function () {
  if (window.__figmaRoastLoaded) return;
  window.__figmaRoastLoaded = true;

  let activeComments = [];
  let panelVisible = false;
  let panel = null;
  let toastQueue = [];



  function createPanel() {
    const div = document.createElement('div');
    div.id = 'figma-roast-panel';
    div.innerHTML = `
      <div class="frp-header">
        <div class="frp-title">
          <span class="frp-icon">💬</span>
          <span>FigmaRoast</span>
        </div>
        <div class="frp-header-actions">
          <button class="frp-btn-text" id="frp-resolve-all">Resolve All</button>
          <button class="frp-btn-text frp-danger" id="frp-clear-all">Clear</button>
          <button class="frp-close" id="frp-close">✕</button>
        </div>
      </div>
      <div class="frp-stats">
        <div class="frp-stat"><span id="frp-open-count">0</span><small>Open</small></div>
        <div class="frp-divider"></div>
        <div class="frp-stat"><span id="frp-resolved-count">0</span><small>Resolved</small></div>
        <div class="frp-divider"></div>
        <div class="frp-stat"><span id="frp-total-count">0</span><small>Total</small></div>
      </div>
      <div class="frp-filters">
        <button class="frp-filter active" data-filter="all">All</button>
        <button class="frp-filter" data-filter="panic">🔴 Panic</button>
        <button class="frp-filter" data-filter="change">🔵 Change</button>
        <button class="frp-filter" data-filter="nitpick">🟡 Nitpick</button>
        <button class="frp-filter" data-filter="resolved">✓ Done</button>
      </div>
      <div class="frp-list" id="frp-list">
        <div class="frp-empty">No feedback yet.<br/>Generate some from the extension popup!</div>
      </div>
    `;

    document.body.appendChild(div);
    panel = div;

    makeDraggable(div);

    
    div.querySelector('#frp-close').addEventListener('click', () => {
      div.style.display = 'none';
      panelVisible = false;
    });

    
    div.querySelector('#frp-resolve-all').addEventListener('click', () => {
      activeComments.forEach(c => { if (!c.dismissed) c.resolved = true; });
      saveAndRender();
      showToast('All comments marked as resolved ✓');
    });

    
    div.querySelector('#frp-clear-all').addEventListener('click', () => {
      activeComments = [];
      saveAndRender();
      showToast('All comments cleared');
    });

    
    let currentFilter = 'all';
    div.querySelectorAll('.frp-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        div.querySelectorAll('.frp-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderList(currentFilter);
      });
    });

    return div;
  }

  function renderList(filter = 'all') {
    const list = document.getElementById('frp-list');
    if (!list) return;

    const visible = activeComments.filter(c => {
      if (c.dismissed) return false;
      if (filter === 'all') return !c.dismissed;
      if (filter === 'resolved') return c.resolved;
      if (filter === 'panic' || filter === 'change' || filter === 'nitpick') {
        return c.severity === filter && !c.resolved;
      }
      return true;
    });

    
    const open = activeComments.filter(c => !c.resolved && !c.dismissed).length;
    const resolved = activeComments.filter(c => c.resolved && !c.dismissed).length;
    document.getElementById('frp-open-count').textContent = open;
    document.getElementById('frp-resolved-count').textContent = resolved;
    document.getElementById('frp-total-count').textContent = activeComments.filter(c => !c.dismissed).length;

    if (visible.length === 0) {
      list.innerHTML = `<div class="frp-empty">${
        filter !== 'all'
          ? `No ${filter} feedback here.`
          : 'No active feedback. Generate some!'
      }</div>`;
      return;
    }

    list.innerHTML = '';

    
    const sorted = [...visible].sort((a, b) => {
      const sevOrder = { panic: 0, change: 1, nitpick: 2 };
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
      return (sevOrder[a.severity] || 2) - (sevOrder[b.severity] || 2);
    });

    sorted.forEach(c => {
      const card = document.createElement('div');
      card.className = `frp-card frp-sev-${c.severity} ${c.resolved ? 'frp-resolved' : ''}`;
      card.dataset.id = c.id;

      const SEV_LABELS = { nitpick: '🟡 Nitpick', change: '🔵 Change Req', panic: '🔴 PANIC' };
      const CAT_LABELS = {
        logo: 'Logo', color: 'Color', copy: 'Copy', layout: 'Layout',
        whitespace: 'Space', branding: 'Brand', nephew: 'Nephew™',
        competitor: 'Competitor', scope: 'Scope', font: 'Font',
        mobile: 'Mobile', vibe: 'Vibe'
      };

      card.innerHTML = `
        <div class="frp-card-header">
          <span class="frp-sev-tag frp-sev-${c.severity}">${c.resolved ? '✓ Resolved' : SEV_LABELS[c.severity]}</span>
          <span class="frp-cat-tag">${CAT_LABELS[c.category] || c.category}</span>
        </div>
        <div class="frp-card-text">${c.text}</div>
        <div class="frp-card-actions">
          ${!c.resolved ? `<button class="frp-action-btn frp-resolve" data-id="${c.id}">✓ Mark Addressed</button>` : ''}
          <button class="frp-action-btn frp-dismiss" data-id="${c.id}">✕ Dismiss</button>
        </div>
      `;

      if (!c.resolved) {
        card.querySelector('.frp-resolve')?.addEventListener('click', () => {
          const idx = activeComments.findIndex(x => x.id === c.id);
          if (idx !== -1) activeComments[idx].resolved = true;
          saveAndRender();
          showToast('Comment marked as resolved ✓');
          
          chrome.storage.local.get(['figmaroast_comments'], (result) => {
            const all = result.figmaroast_comments || [];
            const i = all.findIndex(x => x.id === c.id);
            if (i !== -1) { all[i].resolved = true; chrome.storage.local.set({ figmaroast_comments: all }); }
          });
        });
      }

      card.querySelector('.frp-dismiss').addEventListener('click', () => {
        const idx = activeComments.findIndex(x => x.id === c.id);
        if (idx !== -1) activeComments[idx].dismissed = true;
        saveAndRender();
        showToast('Comment dismissed');
        chrome.storage.local.get(['figmaroast_comments'], (result) => {
          const all = result.figmaroast_comments || [];
          const i = all.findIndex(x => x.id === c.id);
          if (i !== -1) { all[i].dismissed = true; chrome.storage.local.set({ figmaroast_comments: all }); }
        });
      });

      list.appendChild(card);
    });
  }

  function saveAndRender() {
    renderList(getCurrentFilter());
    chrome.storage.local.set({ figmaroast_comments: activeComments });
  }

  function getCurrentFilter() {
    const active = document.querySelector('.frp-filter.active');
    return active ? active.dataset.filter : 'all';
  }


  function showToast(msg, duration = 2500) {
    const toast = document.createElement('div');
    toast.className = 'frp-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('frp-toast-show'));
    setTimeout(() => {
      toast.classList.remove('frp-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  
  
  

  function injectCommentBubbles(comments) {
    comments.forEach((comment, idx) => {
      setTimeout(() => {
        createBubble(comment);
      }, idx * 180);
    });
  }

  function createBubble(comment) {
    const existing = document.getElementById(`frp-bubble-${comment.id}`);
    if (existing) existing.remove();

    const bubble = document.createElement('div');
    bubble.id = `frp-bubble-${comment.id}`;
    bubble.className = `frp-bubble frp-bubble-${comment.severity}`;

    const SEV_ICONS = { nitpick: '🟡', change: '🔵', panic: '🔴' };

    bubble.innerHTML = `
      <div class="frp-bubble-header">
        <span class="frp-bubble-icon">${SEV_ICONS[comment.severity]}</span>
        <span class="frp-bubble-label">${comment.severity.toUpperCase()}</span>
        <button class="frp-bubble-close" data-id="${comment.id}">✕</button>
      </div>
      <div class="frp-bubble-text">${comment.text}</div>
      <div class="frp-bubble-actions">
        <button class="frp-bubble-btn frp-bubble-resolve" data-id="${comment.id}">✓ Done</button>
        <button class="frp-bubble-btn frp-bubble-dismiss" data-id="${comment.id}">✕ Skip</button>
      </div>
    `;

    
    const margin = 120;
    const x = margin + Math.random() * (window.innerWidth - margin * 3 - 280);
    const y = margin + Math.random() * (window.innerHeight - margin * 3 - 160);
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;

    document.body.appendChild(bubble);
    makeDraggable(bubble);

    requestAnimationFrame(() => bubble.classList.add('frp-bubble-show'));

    bubble.querySelector('.frp-bubble-close').addEventListener('click', () => {
      bubble.classList.remove('frp-bubble-show');
      setTimeout(() => bubble.remove(), 300);
    });

    bubble.querySelector('.frp-bubble-resolve').addEventListener('click', () => {
      const idx = activeComments.findIndex(c => c.id === comment.id);
      if (idx !== -1) activeComments[idx].resolved = true;
      saveAndRender();
      showToast('Comment marked as resolved ✓');
      bubble.classList.add('frp-bubble-resolved');
      setTimeout(() => {
        bubble.classList.remove('frp-bubble-show');
        setTimeout(() => bubble.remove(), 300);
      }, 800);
    });

    bubble.querySelector('.frp-bubble-dismiss').addEventListener('click', () => {
      const idx = activeComments.findIndex(c => c.id === comment.id);
      if (idx !== -1) activeComments[idx].dismissed = true;
      saveAndRender();
      bubble.classList.remove('frp-bubble-show');
      setTimeout(() => bubble.remove(), 300);
    });
  }

  

  function createFAB() {
    const fab = document.createElement('button');
    fab.id = 'figma-roast-fab';
    fab.innerHTML = `<span>💬</span><span class="fab-label">FigmaRoast</span>`;
    document.body.appendChild(fab);

    fab.addEventListener('click', () => {
      if (!panel) createPanel();
      panelVisible = !panelVisible;
      panel.style.display = panelVisible ? 'flex' : 'none';
      if (panelVisible) renderList('all');
    });
  }


  function makeDraggable(el) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    el.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      el.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = `${startLeft + dx}px`;
      el.style.top  = `${startTop + dy}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) { isDragging = false; el.style.cursor = ''; }
    });
  }

  

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'injectComments') {
      activeComments.push(...msg.comments);
      if (!panel) createPanel();
      panel.style.display = 'flex';
      panelVisible = true;
      renderList('all');
      injectCommentBubbles(msg.comments);
      showToast(`💬 ${msg.comments.length} client feedback injected!`);
    } else if (msg.action === 'updateComment') {
      const idx = activeComments.findIndex(c => c.id === msg.id);
      if (idx !== -1) {
        if (msg.state === 'resolved') activeComments[idx].resolved = true;
        if (msg.state === 'dismissed') activeComments[idx].dismissed = true;
        saveAndRender();
      }
    } else if (msg.action === 'resolveAll') {
      activeComments.forEach(c => { if (!c.dismissed) c.resolved = true; });
      saveAndRender();
    } else if (msg.action === 'clearAll') {
      activeComments = [];
      
      document.querySelectorAll('.frp-bubble').forEach(b => b.remove());
      saveAndRender();
    }
  });

  
  chrome.storage.local.get(['figmaroast_comments'], (result) => {
    if (result.figmaroast_comments?.length) {
      activeComments = result.figmaroast_comments;
    }
  });

  
  createFAB();
})();