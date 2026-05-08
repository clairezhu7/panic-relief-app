const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    // ping: () => ipcRenderer.invoke('ping')
})

contextBridge.exposeInMainWorld('electronAPI', {
    openMainWindow: () => ipcRenderer.send('open-main-window'),
    navigate: (page) => {
        const music = document.querySelector('music')
        if (music) {
            music.pause()
            music.currentTime = 0
        }
        window.location.search = `?page=${page}`
    },
    storageGet: (key) => ipcRenderer.invoke('storage-get', key),
    storageSet: (key, value) => ipcRenderer.send('storage-set', key, value)
})