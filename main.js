const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron/main');

const path = require('node:path');

// Global shortcut compatible with Linux
app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')

let mainWindow = null

const Store = require('electron-store')
const storage = new Store()

app.whenReady().then(() => {
    // ipcMain.handle('ping', () => 'pong')
    ipcMain.on('open-main-window', () => createMainWindow())

    ipcMain.handle('storage-get', (event, key) => storage.get(key))
    ipcMain.on('storage-set', (event, key, value) => storage.set(key, value))

    createBubble()

    // Mac
    // Open window if none are open
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createBubble()
        }
    })


    const isKeyRegistered = globalShortcut.register('CommandOrControl+Shift+0', () => {
        console.log('Panic shortcut triggered');
        createMainWindow()
    })

    if (!isKeyRegistered) {
        console.log('Shortcut registration failed...')
    }
})

app.on('will-quit', () => {
    globalShortcut.unregisterAll()
})

function createBubble() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    const bubble = new BrowserWindow({
        width: 70,
        height: 70,
        x: width - 100,
        y: height - 100,
        alwaysOnTop: true,      // floats above all other apps
        frame: false,           // no title bar or window chrome
        transparent: true,      // see-through background
        resizable: false,
        skipTaskbar: true,      // won't appear in taskbar
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    bubble.loadFile('bubble.html')
    bubble.webContents.openDevTools({ mode: 'detach' })
}

function createMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus()
        return
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    const limitingDimension = Math.min(width, height)

    mainWindow = new BrowserWindow({
        width: Math.round(limitingDimension * 0.8),
        height: Math.round(limitingDimension * 0.6),
        // frame: false,
        alwaysOnTop: true,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    mainWindow.loadFile('main.html') //{query: {page: 'home'}}) default page
    mainWindow.webContents.openDevTools()

}