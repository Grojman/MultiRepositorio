(function () {
  async function boot() {
    const workspace = document.getElementById('workspace');
    try {
      const res = await fetch('data/index.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      App.FS.load(data);
    } catch (err) {
      console.error('No se pudo cargar data/index.json. ¿Ejecutaste ./scan.sh y estás sirviendo el sitio por HTTP?', err);
      App.FS.load({ root: { name: 'root', type: 'dir', path: '', children: [] } });
    }
    App.Panes.init(workspace);
    const firstInput = workspace.querySelector('.cli-input');
    if (firstInput) firstInput.focus();
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
