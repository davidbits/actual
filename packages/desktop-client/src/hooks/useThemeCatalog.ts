import catalog from '#data/customThemeCatalog';
import type { CatalogTheme } from '#style/customThemes';

const data: CatalogTheme[] = catalog.map(theme => {
  const { mode } = theme;
  if (mode !== 'light' && mode !== 'dark') {
    throw new Error('Invalid theme catalog mode');
  }
  return { ...theme, mode };
});

// Theme discovery uses the catalog shipped with this fork, including offline.
export function useThemeCatalog() {
  return { data, isLoading: false, error: null };
}
