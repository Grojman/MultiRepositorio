window.App = window.App || {};

App.Utils = (function () {
  function normalizePath(path) {
    const parts = String(path || '').split('/').filter(Boolean);
    const stack = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') { stack.pop(); continue; }
      stack.push(part);
    }
    return stack.join('/');
  }

  function joinPath(base, segment) {
    if (!segment) return base;
    if (segment.startsWith('/')) return normalizePath(segment);
    return normalizePath(base ? base + '/' + segment : segment);
  }

  function formatBytes(bytes) {
    const n0 = Number(bytes) || 0;
    if (n0 === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let n = n0;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      }
    }
    if (children != null) {
      for (const c of [].concat(children)) {
        if (c == null) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  function uid(prefix) {
    return `${prefix || 'id'}-${Math.random().toString(36).slice(2, 9)}`;
  }

  return { normalizePath, joinPath, formatBytes, el, uid };
})();
