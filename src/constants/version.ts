/**
 * App version constant - single source of truth
 * Import from package.json to avoid manual updates in multiple files
 */
import packageJson from '../../package.json';

export const APP_VERSION = (packageJson as any).version || '1.6.8';
