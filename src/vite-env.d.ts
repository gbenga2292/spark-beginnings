/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}

interface ElectronAPI {
  getVersion: () => Promise<string>;
  checkForUpdates: () => void;
  showMenu: (menuId: string, x: number, y: number) => void;
  windowHideToTray: () => void;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  updateMenuPrivileges: (privs: any) => void;
  platform: string;
  isElectron: boolean;
  openPathDialog: (opts: any) => Promise<string | null>;
  savePathDialog: (opts: any) => Promise<string | null>;
  writeFile: (filePath: string, content: any, encoding?: string) => Promise<boolean>;
  fsExists: (path: string) => Promise<boolean>;
  fsMkdir: (path: string) => Promise<boolean>;
  shellOpenPath: (path: string) => void;
  notify: (title: string, body: string) => void;
  checkNasStatus: (path: string) => Promise<{ status: 'online' | 'auth-required' | 'offline'; error?: string }>;
  authenticateNas: (path: string, user: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  startUpdateCheck: (source: 'nas' | 'web') => void;
  quitAndInstall: () => void;
  onOpenUpdateModal: (callback: () => void) => () => void;
  onUpdateStatus: (callback: (status: any) => void) => () => void;
  backupSupabaseDatabase: (opts: any) => Promise<any>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
