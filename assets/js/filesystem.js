window.App = window.App || {};

App.FS = (function () {
  let tree = null;
  let byPath = new Map();

  function indexNode(node, path) {
    byPath.set(path, node);
    if (node.type === 'dir') {
      for (const child of node.children) {
        indexNode(child, path ? path + '/' + child.name : child.name);
      }
    }
  }

  function load(data) {
    tree = data.root;
    byPath = new Map();
    byPath.set('', tree);
    for (const child of tree.children) indexNode(child, child.name);
    return tree;
  }

  function getNode(path) {
    return byPath.get(App.Utils.normalizePath(path)) || null;
  }

  function listDir(path) {
    const node = getNode(path);
    if (!node || node.type !== 'dir') return null;
    return node.children.slice().sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, 'es');
    });
  }

  function resolve(currentPath, target) {
    if (!target || target === '.') return currentPath;
    if (target === '..') {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      return parts.join('/');
    }
    if (target === '/' || target === '~') return '';
    return App.Utils.joinPath(currentPath, target);
  }

  function search(term, fromPath) {
    const results = [];
    const lower = term.toLowerCase();
    function walk(node, path) {
      if (path && node.name.toLowerCase().includes(lower)) results.push({ path, node });
      if (node.type === 'dir') {
        for (const c of node.children) walk(c, path ? path + '/' + c.name : c.name);
      }
    }
    const start = getNode(fromPath) || tree;
    walk(start, fromPath || '');
    return results;
  }

  return {
    load,
    getNode,
    listDir,
    resolve,
    search,
    get root() { return tree; },
  };
})();
