import { Site } from '../store/appStore';

/**
 * Checks if a site is the internal DCEL Office which should be excluded from operational views.
 */
export const isInternalSite = (site: { name: string; client?: string }) => {
  const name = site.name.toLowerCase();
  const client = site.client?.toLowerCase() || '';
  return (client === 'dcel' && name === 'office') || name === 'dcel office';
};

/**
 * Filters out internal office sites from a list of sites.
 */
export const filterOperationalSites = <T extends { name: string; client?: string }>(sites: T[]): T[] => {
  return sites.filter(site => !isInternalSite(site));
};
