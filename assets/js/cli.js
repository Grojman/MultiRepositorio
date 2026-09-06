window.App = window.App || {};

App.CLI = (function () {
  const U = App.Utils;
  let counter = 0;

  const ICONS = { text: '📄', pdf: '📕', image: '🖼️', video: '🎬', audio: '🎵', test: '📝', other: '📦' };

  function iconFor(kind) { return ICONS[kind] || '📄'; }

  function quoteIfNeeded(name) {
    return /\s/.test(name) ? `"${name}"` : name;
  }

  function parseArgs(str) {
    const args = [];
    const re = /"([^"]*)"|(\S+)/g;
    let m;
    while ((m = re.exec(str))) args.push(m[1] !== undefined ? m[1] : m[2]);
    return args;
  }

  function createInstance() {
    const state = { cwd: '', history: [], histIndex: 0 };

    const el = U.el('div', { class: 'cli' });
    const scrollback = U.el('div', { class: 'cli-scrollback' });
    const inputLine = U.el('div', { class: 'cli-inputline' });
    const prompt = U.el('span', { class: 'cli-prompt' });
    const input = U.el('input', { class: 'cli-input', type: 'text', autocomplete: 'off', spellcheck: 'false' });
    inputLine.append(prompt, input);
    el.append(scrollback, inputLine);
    el.addEventListener('click', () => input.focus());

    function promptText() { return `carrera:/${state.cwd}$`; }
    function updatePrompt() { prompt.textContent = promptText(); }

    function printLine(text, cls) {
      scrollback.appendChild(U.el('div', { class: 'cli-line' + (cls ? ' ' + cls : '') }, text));
      el.scrollTop = el.scrollHeight;
    }

    function printNode(node) {
      scrollback.appendChild(node);
      el.scrollTop = el.scrollHeight;
    }

    function renderEntries(entries, targetOf) {
      const list = U.el('div', { class: 'cli-listing' });
      for (const entry of entries) {
        const isDir = entry.type === 'dir';
        const row = U.el('div', { class: 'cli-entry ' + (isDir ? 'cli-entry--dir' : 'cli-entry--file') });
        row.textContent = (isDir ? '📁' : iconFor(entry.kind)) + ' ' + (entry.__label || entry.name) + (isDir ? '/' : '');
        row.addEventListener('click', () => {
          const target = targetOf(entry);
          runCommand((isDir ? 'cd ' : 'abrir ') + quoteIfNeeded(target));
        });
        list.appendChild(row);
      }
      printNode(list);
    }

    function renderListing() {
      const entries = App.FS.listDir(state.cwd);
      if (!entries) { printLine('No se pudo listar el directorio.', 'cli-error'); return; }
      const withUp = state.cwd ? [{ type: 'dir', name: '..', __up: true }, ...entries] : entries;
      if (withUp.length === 0) { printLine('(vacío)', 'cli-dim'); return; }
      renderEntries(withUp, (entry) => (entry.__up ? '..' : entry.name));
    }

    function openTarget(args) {
      const target = args[0];
      if (!target) { printLine('Uso: abrir <archivo>', 'cli-error'); return; }
      const path = App.FS.resolve(state.cwd, target);
      const node = App.FS.getNode(path);
      if (!node) { printLine(`No existe: ${target}`, 'cli-error'); return; }
      if (node.type === 'dir') { printLine(`Es un directorio, usa "cd": ${target}`, 'cli-error'); return; }
      App.Viewer.open(node, path);
    }

    function doSearch(args) {
      const term = args.join(' ');
      if (!term) { printLine('Uso: buscar <texto>', 'cli-error'); return; }
      const results = App.FS.search(term, state.cwd);
      if (results.length === 0) { printLine('Sin resultados.', 'cli-dim'); return; }
      renderEntries(
        results.map((r) => ({ ...r.node, __label: r.path })),
        (entry) => '/' + entry.__label,
      );
    }

    function printTree() {
      function walk(node, prefix) {
        const children = node.children || [];
        children.forEach((c, i) => {
          const last = i === children.length - 1;
          printLine(prefix + (last ? '└── ' : '├── ') + c.name + (c.type === 'dir' ? '/' : ''), 'cli-dim');
          if (c.type === 'dir') walk(c, prefix + (last ? '    ' : '│   '));
        });
      }
      const node = App.FS.getNode(state.cwd);
      if (!node) { printLine('No se pudo leer el directorio.', 'cli-error'); return; }
      printLine('/' + state.cwd || '/');
      walk(node, '');
    }

    function printHelp() {
      printLine('Comandos disponibles:');
      [
        'ls                    - listar el contenido del directorio actual',
        'cd <carpeta>          - cambiar de directorio (.. para subir, / para la raíz)',
        'pwd                   - mostrar la ruta actual',
        'abrir <archivo>       - abrir un recurso en el visor (alias: cat, ver)',
        'buscar <texto>        - buscar archivos y carpetas (alias: find)',
        'tree                  - mostrar el árbol del directorio actual',
        'clear                 - limpiar la pantalla (alias: cls)',
        'ayuda                 - mostrar esta ayuda (alias: help)',
        '',
        'También puedes hacer clic directamente sobre cualquier carpeta o archivo listado.',
      ].forEach((l) => printLine(l, 'cli-dim'));
    }

    const COMMANDS = {
      ls: () => renderListing(),
      cd: (args) => {
        const target = args[0];
        const next = App.FS.resolve(state.cwd, target || '/');
        const node = App.FS.getNode(next);
        if (!node) { printLine(`No existe: ${target}`, 'cli-error'); return; }
        if (node.type !== 'dir') { printLine(`No es un directorio: ${target}`, 'cli-error'); return; }
        state.cwd = next;
        scrollback.innerHTML = '';
        updatePrompt();
        renderListing();
      },
      pwd: () => printLine('/' + state.cwd),
      abrir: openTarget,
      cat: openTarget,
      ver: openTarget,
      find: doSearch,
      buscar: doSearch,
      tree: printTree,
      clear: () => { scrollback.innerHTML = ''; },
      cls: () => { scrollback.innerHTML = ''; },
      help: printHelp,
      ayuda: printHelp,
    };

    function runCommand(raw) {
      const trimmed = raw.trim();
      printNode(U.el('div', { class: 'cli-line cli-echo' }, `${promptText()} ${raw}`));
      if (!trimmed) return;
      state.history.push(trimmed);
      state.histIndex = state.history.length;
      const [cmd, ...args] = parseArgs(trimmed);
      const handler = COMMANDS[cmd.toLowerCase()];
      if (!handler) { printLine(`Comando no encontrado: ${cmd}. Escribe "ayuda".`, 'cli-error'); return; }
      handler(args);
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = input.value;
        input.value = '';
        runCommand(val);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (state.histIndex > 0) {
          state.histIndex--;
          input.value = state.history[state.histIndex] || '';
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (state.histIndex < state.history.length) {
          state.histIndex++;
          input.value = state.history[state.histIndex] || '';
        }
      }
    });

    printLine('Bienvenido. Escribe "ayuda" para ver los comandos disponibles.', 'cli-dim');
    updatePrompt();
    renderListing();

    return { el, focus: () => input.focus(), runCommand };
  }

  function createFirst() {
    const inst = createInstance();
    counter++;
    return { id: U.uid('tab'), title: 'terminal', type: 'cli', el: inst.el, closable: true, __inst: inst };
  }

  function spawn(leaf) {
    const inst = createInstance();
    counter++;
    const tab = { id: U.uid('tab'), title: `terminal ${counter}`, type: 'cli', el: inst.el, closable: true, __inst: inst };
    App.Panes.addTabToLeaf(leaf, tab, true);
    App.Panes.render();
    inst.focus();
  }

  return { createInstance, createFirst, spawn };
})();
