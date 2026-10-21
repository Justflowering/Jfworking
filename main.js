const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const util = require('util');

const logFile = path.join(app.getPath('userData'), 'seomu_app.log');
const logStdout = fs.createWriteStream(logFile, { flags: 'a' });

function writeLog(level, ...args) {
    const timestamp = new Date().toISOString();
    const msg = util.format(...args);
    const logLine = `[${timestamp}] [${level}] ${msg}\n`;
    logStdout.write(logLine);
    process.stdout.write(logLine);
}

console.log = (...args) => writeLog('INFO', ...args);
console.error = (...args) => writeLog('ERROR', ...args);

app.commandLine.appendSwitch('log-level', '3');

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    dialog.showErrorBox('예기치 않은 오류 발생', `프로그램 실행 중 오류가 발생했습니다.\n\n${error.message}\n\n로그 파일 위치: ${logFile}`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    const allowedDomains = [
        'apis.data.go.kr', 
        'proud-leaf-6ad4.heets7539.workers.dev', 
        'kakaomobility.com', 
        'kakao.com'
    ];
    if (allowedDomains.some(domain => url.includes(domain))) {
        event.preventDefault();
        callback(true);
    } else {
        callback(false);
    }
});

function createWindow () {
    const win = new BrowserWindow({
        width: 1920,
        height: 1080,
        title: '지방공무원 서무도우미',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('index.html');
}

let store;

app.whenReady().then(async () => {
    try {
        const Store = (await import('electron-store')).default;
        store = new Store();
        console.log('📦 electron-store 데이터 저장 경로:', store.path);
    } catch (error) {
        console.error('electron-store 로드 실패:', error);
        dialog.showErrorBox('초기화 오류', 'electron-store 모듈을 찾을 수 없습니다.\n터미널에서 npm install 명령어를 실행해 패키지를 설치해주세요.');
    }
    createWindow();

    if (!app.isPackaged) {
        autoUpdater.forceDevUpdateConfig = true;
    }

    autoUpdater.on('checking-for-update', () => console.log('업데이트 확인 중...'));
    autoUpdater.on('update-available', (info) => console.log('새로운 업데이트 발견:', info.version));
    autoUpdater.on('update-not-available', () => console.log('현재 최신 버전입니다.'));
    autoUpdater.on('error', (err) => console.error('자동 업데이트 오류:', err));
    autoUpdater.on('download-progress', (progressObj) => console.log(`다운로드 진행률: ${Math.round(progressObj.percent)}%`));
    
    autoUpdater.on('update-downloaded', (info) => {
        console.log('업데이트 다운로드 완료. 설치 준비됨.');
        dialog.showMessageBox({
            type: 'info',
            title: '업데이트 완료',
            message: `새로운 버전(${info.version})이 다운로드되었습니다. 지금 프로그램을 재시작하여 적용하시겠습니까?`,
            buttons: ['지금 재시작', '나중에']
        }).then((result) => {
            if (result.response === 0) autoUpdater.quitAndInstall();
        });
    });

    autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('print-with-preview', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return new Promise((resolve) => {
        win.webContents.print(
            { silent: false, printBackground: true },
            (success) => resolve(success)
        );
    });
});

ipcMain.handle('open-print-window', async (event, htmlContent, printOptions = {}) => {
    const printWin = new BrowserWindow({
        width: 1600,
        height: 900,
        show: true,
        title: '인쇄 미리보기',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'print-window-preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    await printWin.loadFile(path.join(__dirname, 'print-window.html'));
    printWin.webContents.send('load-print-content', htmlContent);

    // [FIX] 중복 등록 및 메모리 누수 방지: printWin 컨텍스트 매핑
    const printHandler = (evt) => {
        if (BrowserWindow.fromWebContents(evt.sender) === printWin && !printWin.isDestroyed()) {
            printWin.webContents.print({
                silent: false,
                printBackground: true,
                landscape: printOptions.landscape === true,
                pageSize: 'A4'
            });
        }
    };

    ipcMain.on('do-print', printHandler);

    return new Promise((resolve) => {
        printWin.on('closed', () => {
            ipcMain.removeListener('do-print', printHandler);
            resolve(true);
        });
    });
});

ipcMain.on('store-get', (event, key) => {
    event.returnValue = store ? store.get(key) : null;
});

ipcMain.on('store-set', (event, key, value) => {
    if (store) store.set(key, value);
    event.returnValue = true;
});

ipcMain.on('store-delete', (event, key) => {
    if (store) store.delete(key);
    event.returnValue = true;
});

ipcMain.on('open-store-folder', () => {
    if (store) shell.showItemInFolder(store.path);
});

ipcMain.on('auto-backup', (event, fileName, data, isBase64 = false) => {
    try {
        const backupDir = path.join(app.getPath('userData'), 'backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
        const filePath = path.join(backupDir, fileName);
        
        if (isBase64) fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
        else fs.writeFileSync(filePath, data, 'utf8');
        
        event.returnValue = true;
    } catch (error) {
        console.error('백업 실패:', error);
        event.returnValue = false;
    }
});

ipcMain.handle('fetch-api', async (event, url, options = {}) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);
        
        const fetchOptions = { ...options, signal: controller.signal };
        delete fetchOptions.timeout;

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `API Request Failed: ${response.status} - ${errorText}` };
        }
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
});