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
  shellOpenPath: (path: string) => void;
  notify: (title: string, body: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
