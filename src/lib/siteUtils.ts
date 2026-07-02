import { Site } from '../store/appStore';

/**
 * Checks if a site is the internal DCEL Office which should be excluded from operational views.
 */
export const isInternalSite = (site: { name: string; client?: string }) => {
  const name = site.name.toLowerCase().trim();
  const client = site.client?.toLowerCase().trim() || '';
  return name === 'office' || name === 'main office' || name === 'dcel office' || (client === 'dcel' && name === 'office');
};

/**
 * Filters out internal office sites from a list of sites.
 */
export const filterOperationalSites = <T extends { name: string; client?: string }>(sites: T[]): T[] => {
  return sites.filter(site => !isInternalSite(site));
};
