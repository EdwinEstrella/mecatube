import { useUpdates } from './useUpdates.js';

// Presentation for each updater state: label, tooltip, click action key and style flags
function describe(state) {
  switch (state.status) {
    case 'checking':
      return { label: 'Buscando…', title: 'Buscando actualizaciones', disabled: true };
    case 'available':
      return { label: `Actualizar a v${state.version}`, title: 'Descargar la nueva versión', action: 'download', highlight: true };
    case 'downloading':
      return { label: `Descargando… ${state.percent ?? 0} %`, title: 'Descargando la actualización', disabled: true, highlight: true };
    case 'downloaded':
      return { label: 'Reiniciar y actualizar', title: 'Cerrar la app e instalar la actualización', action: 'install', highlight: true };
    case 'none':
      return { label: 'Estás al día', title: 'Ya tienes la última versión', disabled: true };
    case 'error':
      return { label: 'Reintentar actualización', title: state.message || 'No se pudo comprobar las actualizaciones', action: 'check', error: true };
    case 'dev':
      return { label: 'Buscar actualizaciones', title: 'Solo disponible en la app instalada', disabled: true };
    default:
      return { label: 'Buscar actualizaciones', title: 'Buscar actualizaciones', action: 'check' };
  }
}

export default function UpdateButton() {
  const { state, check, download, install } = useUpdates();
  const view = describe(state);
  const actions = { check, download, install };
  const className = ['title-bar__update', view.highlight && 'title-bar__update--highlight', view.error && 'title-bar__update--error']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      title={view.title}
      disabled={view.disabled}
      onClick={() => actions[view.action]?.()}
    >
      {view.label}
    </button>
  );
}
