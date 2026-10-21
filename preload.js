const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    printWithPreview: () => ipcRenderer.invoke('print-with-preview'),
    openPrintWindow: (htmlContent, options) => ipcRenderer.invoke('open-print-window', htmlContent, options),
    getStoreValue: (key) => ipcRenderer.sendSync('store-get', key),
    setStoreValue: (key, value) => ipcRenderer.sendSync('store-set', key, value),
    deleteStoreValue: (key) => ipcRenderer.sendSync('store-delete', key),
    openStoreFolder: () => ipcRenderer.send('open-store-folder'),
    autoBackup: (fileName, data, isBase64) => ipcRenderer.sendSync('auto-backup', fileName, data, isBase64),
    fetchApi: (url, options) => ipcRenderer.invoke('fetch-api', url, options)
});