window.App = window.App || {};

// Gestor genérico de paneles: un árbol binario de Split/Leaf que soporta
// pestañas arrastrables (mover, dividir en cualquier dirección, cerrar).
App.Panes = (function () {
  const U = App.Utils;
  let container = null;
  let root = null;
  let dragging = null;

  function makeLeaf(role) {
    return { type: 'leaf', id: U.uid('leaf'), tabs: [], activeId: null, role: role || null };
  }

  function findLeaf(node, id) {
    if (!node) return null;
    if (node.type === 'leaf') return node.id === id ? node : null;
    for (const c of node.children) {
      const r = findLeaf(c, id);
      if (r) return r;
    }
    return null;
  }

  function findLeafByRole(role, node) {
    node = node || root;
    if (node.type === 'leaf') return node.role === role ? node : null;
    for (const c of node.children) {
      const r = findLeafByRole(role, c);
      if (r) return r;
    }
    return null;
  }

  function findFirstLeaf(node) {
    node = node || root;
    if (node.type === 'leaf') return node;
    return findFirstLeaf(node.children[0]);
  }

  function findTabByKey(key, node) {
    node = node || root;
    if (node.type === 'leaf') {
      const t = node.tabs.find((t) => t.key === key);
      return t ? { tab: t, leaf: node } : null;
    }
    for (const c of node.children) {
      const r = findTabByKey(key, c);
      if (r) return r;
    }
    return null;
  }

  function findParentSplit(node, childId) {
    if (node.type === 'split') {
      for (let i = 0; i < node.children.length; i++) {
        if (node.children[i].id === childId) return { parent: node, index: i };
        const found = findParentSplit(node.children[i], childId);
        if (found) return found;
      }
    }
    return null;
  }

  function replaceNode(targetId, newNode) {
    if (root.id === targetId) { root = newNode; return; }
    const info = findParentSplit(root, targetId);
    if (info) info.parent.children[info.index] = newNode;
  }

  function addTabToLeaf(leaf, tab, activate) {
    leaf.tabs.push(tab);
    if (activate !== false) leaf.activeId = tab.id;
  }

  function cleanupEmptyLeaf(leaf) {
    if (leaf.tabs.length > 0) return;
    if (root.id === leaf.id) return; // se mantiene como estado vacío
    const info = findParentSplit(root, leaf.id);
    if (!info) return;
    const sibling = info.parent.children[info.index === 0 ? 1 : 0];
    replaceNode(info.parent.id, sibling);
  }

  function closeTab(leafId, tabId) {
    const leaf = findLeaf(root, leafId);
    if (!leaf) return;
    const idx = leaf.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    const [tab] = leaf.tabs.splice(idx, 1);
    if (tab.el && tab.el.parentNode) tab.el.remove();
    if (leaf.activeId === tabId) {
      leaf.activeId = leaf.tabs.length ? leaf.tabs[Math.max(0, idx - 1)].id : null;
    }
    cleanupEmptyLeaf(leaf);
    render();
  }

  function openInViewer(tab) {
    if (tab.key) {
      const existing = findTabByKey(tab.key);
      if (existing) {
        existing.leaf.activeId = existing.tab.id;
        if (tab.el && tab.el.parentNode) tab.el.remove(); // descartamos el duplicado recién creado
        render();
        return;
      }
    }
    let viewerLeaf = findLeafByRole('viewer');
    if (!viewerLeaf) {
      const anchor = findFirstLeaf();
      if (!anchor.role) anchor.role = 'cli';
      viewerLeaf = makeLeaf('viewer');
      const splitNode = {
        type: 'split', id: U.uid('split'), direction: 'row',
        children: [anchor, viewerLeaf], sizes: [42, 58],
      };
      replaceNode(anchor.id, splitNode);
    }
    addTabToLeaf(viewerLeaf, tab, true);
    render();
  }

  // ---- Render ----

  function render() {
    container.innerHTML = '';
    container.appendChild(renderNode(root));
  }

  function renderNode(node) {
    if (node.type === 'leaf') return renderLeaf(node);
    const wrap = U.el('div', { class: `pane-split pane-split--${node.direction}` });
    const p1 = renderNode(node.children[0]);
    const divider = U.el('div', { class: 'pane-divider' });
    const p2 = renderNode(node.children[1]);
    p1.style.flex = `0 0 ${node.sizes[0]}%`;
    p2.style.flex = `0 0 ${node.sizes[1]}%`;
    wrap.append(p1, divider, p2);
    wireDivider(divider, node, wrap);
    return wrap;
  }

  function renderLeaf(leaf) {
    const wrap = U.el('div', { class: 'pane-leaf' });
    wrap.dataset.leafId = leaf.id;

    const tabStrip = U.el('div', { class: 'pane-tabstrip' });
    for (const tab of leaf.tabs) {
      const tabEl = U.el('div', {
        class: 'pane-tab' + (tab.id === leaf.activeId ? ' active' : ''),
      }, [
        U.el('span', { class: 'pane-tab-title', text: tab.title }),
        U.el('button', {
          class: 'pane-tab-close', text: '×', title: 'Cerrar',
          onclick: (e) => { e.stopPropagation(); closeTab(leaf.id, tab.id); },
        }),
      ]);
      tabEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('.pane-tab-close')) return;
        startDrag(e, leaf.id, tab.id);
      });
      tabEl.addEventListener('click', () => { leaf.activeId = tab.id; render(); });
      tabStrip.appendChild(tabEl);
    }
    tabStrip.appendChild(U.el('button', {
      class: 'pane-tab-add', text: '+', title: 'Nueva terminal',
      onclick: () => App.CLI.spawn(leaf),
    }));

    const body = U.el('div', { class: 'pane-body' });
    if (leaf.tabs.length === 0) {
      body.appendChild(U.el('div', { class: 'pane-empty' }, [
        U.el('span', { text: 'Panel vacío' }),
        U.el('button', { class: 'quiz-btn', text: 'Abrir terminal', onclick: () => App.CLI.spawn(leaf) }),
      ]));
    } else {
      for (const tab of leaf.tabs) {
        tab.el.style.display = tab.id === leaf.activeId ? '' : 'none';
        body.appendChild(tab.el);
      }
    }

    wrap.append(tabStrip, body);
    return wrap;
  }

  // ---- Resize de divisores ----

  function wireDivider(divider, splitNode, wrapEl) {
    divider.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const rect = wrapEl.getBoundingClientRect();
      const isRow = splitNode.direction === 'row';
      function onMove(ev) {
        const pos = isRow ? (ev.clientX - rect.left) / rect.width : (ev.clientY - rect.top) / rect.height;
        const pct = Math.min(85, Math.max(15, pos * 100));
        splitNode.sizes = [pct, 100 - pct];
        const p1 = wrapEl.children[0];
        const p2 = wrapEl.children[2];
        p1.style.flex = `0 0 ${pct}%`;
        p2.style.flex = `0 0 ${100 - pct}%`;
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ---- Arrastrar pestañas ----

  function startDrag(e, leafId, tabId) {
    e.preventDefault();
    const leaf = findLeaf(root, leafId);
    const tab = leaf.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const ghost = U.el('div', { class: 'pane-ghost-tab', text: tab.title });
    document.body.appendChild(ghost);
    dragging = { leafId, tabId, ghost, dropZone: null };
    positionGhost(e);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function positionGhost(e) {
    dragging.ghost.style.left = (e.clientX + 10) + 'px';
    dragging.ghost.style.top = (e.clientY + 10) + 'px';
  }

  function onDragMove(e) {
    positionGhost(e);
    updateDropTarget(e);
  }

  function leafElementAtPoint(x, y) {
    const at = document.elementFromPoint(x, y);
    return at ? at.closest('.pane-leaf') : null;
  }

  function clearDropIndicators() {
    document.querySelectorAll('.pane-dropzone').forEach((n) => n.remove());
  }

  function updateDropTarget(e) {
    clearDropIndicators();
    const leafEl = leafElementAtPoint(e.clientX, e.clientY);
    if (!leafEl) { dragging.dropZone = null; return; }
    const leafId = leafEl.dataset.leafId;
    const rect = leafEl.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const EDGE = 0.25;
    let zone = 'center';
    if (relX < EDGE) zone = 'left';
    else if (relX > 1 - EDGE) zone = 'right';
    else if (relY < EDGE) zone = 'top';
    else if (relY > 1 - EDGE) zone = 'bottom';
    dragging.dropZone = { leafId, zone };
    showDropIndicator(leafEl, zone);
  }

  function showDropIndicator(leafEl, zone) {
    const rects = {
      left: { left: '0', top: '0', width: '50%', height: '100%' },
      right: { left: '50%', top: '0', width: '50%', height: '100%' },
      top: { left: '0', top: '0', width: '100%', height: '50%' },
      bottom: { left: '0', top: '50%', width: '100%', height: '50%' },
      center: { left: '0', top: '0', width: '100%', height: '100%' },
    };
    const overlay = U.el('div', { class: 'pane-dropzone' });
    Object.assign(overlay.style, rects[zone]);
    leafEl.appendChild(overlay);
  }

  function onDragEnd() {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    clearDropIndicators();
    dragging.ghost.remove();
    const { leafId: srcLeafId, tabId, dropZone } = dragging;
    dragging = null;
    if (!dropZone) return;
    performDrop(srcLeafId, tabId, dropZone.leafId, dropZone.zone);
  }

  function performDrop(srcLeafId, tabId, dstLeafId, zone) {
    const srcLeaf = findLeaf(root, srcLeafId);
    const tabIdx = srcLeaf.tabs.findIndex((t) => t.id === tabId);
    if (tabIdx === -1) return;
    const [tab] = srcLeaf.tabs.splice(tabIdx, 1);
    if (srcLeaf.activeId === tabId) {
      srcLeaf.activeId = srcLeaf.tabs.length ? srcLeaf.tabs[Math.max(0, tabIdx - 1)].id : null;
    }

    if (zone === 'center' && dstLeafId === srcLeafId) {
      srcLeaf.tabs.splice(tabIdx, 0, tab);
      srcLeaf.activeId = tab.id;
      render();
      return;
    }

    if (zone === 'center') {
      const dstLeaf = findLeaf(root, dstLeafId);
      dstLeaf.tabs.push(tab);
      dstLeaf.activeId = tab.id;
    } else {
      const dstLeaf = findLeaf(root, dstLeafId);
      const newLeaf = makeLeaf(dstLeaf.role);
      newLeaf.tabs = [tab];
      newLeaf.activeId = tab.id;
      const direction = (zone === 'left' || zone === 'right') ? 'row' : 'column';
      const putFirst = (zone === 'left' || zone === 'top');
      const splitNode = {
        type: 'split', id: U.uid('split'), direction,
        children: putFirst ? [newLeaf, dstLeaf] : [dstLeaf, newLeaf],
        sizes: [50, 50],
      };
      replaceNode(dstLeaf.id, splitNode);
    }

    cleanupEmptyLeaf(srcLeaf);
    render();
  }

  // ---- API pública ----

  function init(containerEl) {
    container = containerEl;
    const cliTab = App.CLI.createFirst();
    root = makeLeaf('cli');
    addTabToLeaf(root, cliTab, true);
    render();
  }

  return { init, render, addTabToLeaf, openInViewer, closeTab };
})();
