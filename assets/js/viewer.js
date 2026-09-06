window.App = window.App || {};

App.Viewer = (function () {
  const U = App.Utils;

  function encodeFilePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  function renderError(body, message) {
    body.appendChild(U.el('div', { class: 'viewer-error', text: message }));
  }

  function renderText(body, url) {
    body.appendChild(U.el('div', { class: 'viewer-loading', text: 'Cargando…' }));
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then((text) => {
        body.innerHTML = '';
        body.appendChild(U.el('pre', { class: 'viewer-text' }, text));
      })
      .catch((err) => {
        body.innerHTML = '';
        renderError(body, 'No se pudo cargar el archivo: ' + err.message);
      });
  }

  function renderOther(body, node, url) {
    body.appendChild(U.el('div', { class: 'viewer-other' }, [
      U.el('div', { class: 'viewer-other-icon', text: '📦' }),
      U.el('div', { class: 'viewer-other-name', text: node.name }),
      U.el('div', { class: 'viewer-other-hint', text: 'No hay una vista previa disponible para este tipo de archivo.' }),
      U.el('a', { class: 'viewer-other-link', href: url, target: '_blank', rel: 'noopener', text: 'Abrir / descargar' }),
    ]));
  }

  function renderBody(body, node, path) {
    const url = encodeFilePath(path);
    switch (node.kind) {
      case 'text': renderText(body, url); break;
      case 'pdf': body.appendChild(U.el('iframe', { class: 'viewer-pdf', src: url, title: node.name })); break;
      case 'image': body.appendChild(U.el('img', { class: 'viewer-image', src: url, alt: node.name })); break;
      case 'video': body.appendChild(U.el('video', { class: 'viewer-media', src: url, controls: 'controls' })); break;
      case 'audio': body.appendChild(U.el('audio', { class: 'viewer-media', src: url, controls: 'controls' })); break;
      case 'test': App.Quiz.render(body, url); break;
      default: renderOther(body, node, url); break;
    }
  }

  function open(node, path) {
    const key = 'file:' + path;
    const container = U.el('div', { class: 'viewer' });
    const header = U.el('div', { class: 'viewer-header' }, [
      U.el('span', { class: 'viewer-path', text: '/' + path }),
      U.el('span', { class: 'viewer-size', text: U.formatBytes(node.size || 0) }),
    ]);
    const body = U.el('div', { class: 'viewer-body' });
    container.append(header, body);
    renderBody(body, node, path);

    const tab = { id: U.uid('tab'), key, title: node.name, type: 'viewer', el: container, closable: true };
    App.Panes.openInViewer(tab);
  }

  return { open };
})();
