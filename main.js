const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron/main')

const path = require('node:path');

// Global shortcut compatible with Linux
app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')

const createWindow = () => {
    createBubble()
}

app.whenReady().then(() => {
    ipcMain.handle('ping', () => 'pong')
    createWindow()

    // Mac
    // Open window if none are open
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })

    const isKeyRegistered = globalShortcut.register('CommandOrControl+Shift+0', () => {
        console.log('Panic shortcut triggered');
    })

    if (!isKeyRegistered) {
        console.log('Shortcut registration failed...')
    }
})

app.on('will-quit', () => {
    globalShortcut.unregisterAll()
})

function createBubble() {
    const { screen } = require('electron')
    const { screenWidth, screenHeight } = screen.getPrimaryDisplay().workAreaSize

    const bubble = new BrowserWindow({
        width: Math.round(screenWidth * 0.05),
        height: Math.round(screenHeight * 0.05),
        alwaysOnTop: true,      // floats above all other apps
        frame: false,           // no title bar or window chrome
        transparent: true,      // see-through background
        resizable: false,
        skipTaskbar: true,      // won't appear in taskbar
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    bubble.loadFile('bubble.html')  // you'll create this file
}