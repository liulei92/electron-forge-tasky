const electron = require('electron')
const path = require('path')

const { app, BrowserWindow, ipcMain, Tray, Menu, screen, dialog } = electron
const { autoUpdater } = require('electron-updater')
const iconPath = path.join(__dirname, './src/img/icon.png')

let mainWindow // 主进程
let tray // 系统托盘 借助Tray实现
let remindWindow // 提醒进程

// Electron会在初始化完成并且准备好创建浏览器窗口时调用这个方法
// 部分 API 在 ready 事件触发后才能使用。
// app.whenReady().then(createWindow);

//当所有窗口都被关闭后退出
app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  // if (process.platform !== 'darwin') {
  //   app.quit();
  // }
});

app.on('activate', () => {
  // 在macOS上，当单击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  // if (BrowserWindow.getAllWindows().length === 0) {
  //   createWindow();
  // }
})

app.on('ready', () => {
  //检查更新
  checkUpdate()


  mainWindow = new BrowserWindow({
    frame: false, // 创建无边框窗口
    resizable: false,
    width: 800,
    height: 600,
    icon: iconPath,
    webPreferences:{
      backgroundThrottling: false,
      // 访问Node.js API
      nodeIntegration:true,
      contextIsolation: false
      // preload: path.join(__dirname, './preload.js')
    }
  })
  console.log(mainWindow);

  mainWindow.loadURL(`file://${__dirname}/src/main.html`)
  mainWindow.removeMenu() // 移除菜单，若不进行此操作，可使用ctrl+shift+i打开开发者工具
  // 打开开发者工具
  // mainWindow.webContents.openDevTools()

  // 系统托盘图标
  tray = new Tray(iconPath) // 实例化一个tray对象，构造函数的唯一参数是需要在托盘中显示的图标url
  tray.setToolTip('Tasky') // 鼠标移到托盘中应用程序的图标上时，显示的文本
  // 点击图标的响应事件，这里是切换主窗口的显示和隐藏
  tray.on('click', () => {
    if(mainWindow.isVisible()){
      mainWindow.hide()
    }else{
      mainWindow.show()
    }
  })
  // 右键点击图标时，出现的菜单，通过Menu.buildFromTemplate定制，这里只包含退出程序的选项。
  // 只支持 platform darwin,win32
  tray.on('right-click', () => {
    const menuConfig = Menu.buildFromTemplate([
      {
        label: 'Quit',
        click: () => app.quit()
      }
    ])
    tray.popUpContextMenu(menuConfig)
  })

})

// 主进程通过ipcMain接收消息(来自渲染进程中的ipcRenderer)
ipcMain.on('mainWindow:close', () => {
  mainWindow.hide()
})

ipcMain.on('remindWindow:close', () => {
  remindWindow.close()
})

ipcMain.on('setTaskTimer', (event, time, task) => {
  const now = new Date()
  const date = new Date()
  date.setHours(time.slice(0,2), time.slice(3),0)
  const timeout = date.getTime() - now.getTime()
  setTimeout(() => {
    createRemindWindow(task)
  }, timeout)
})
// 创建子进程
function createRemindWindow (task) {
  if(remindWindow) remindWindow.close()
  // 创建提醒窗口
  remindWindow = new BrowserWindow({
    height: 450,
    width: 360,
    resizable: false,
    frame: false,
    icon: iconPath,
    show: false,
    webPreferences:{
      nodeIntegration: true,
      contextIsolation: false,
      // preload: path.join(__dirname, './preload.js')
    }
  })
  remindWindow.removeMenu()
  // 获取屏幕尺寸
  const size = screen.getPrimaryDisplay().workAreaSize
  console.log(screen.getPrimaryDisplay());
  // 获取托盘位置的y坐标（windows在右下角，Mac在右上角）
  const { y } = tray.getBounds()
  // 获取窗口的宽高
  const { height, width } = remindWindow.getBounds()
  // 计算窗口的y坐标
  const yPosition = process.platform === 'darwin' ? y : y - height
  // setBounds设置窗口的位置
  remindWindow.setBounds({
    x: size.width - width, // x坐标为屏幕宽度 - 窗口宽度
    y: yPosition,
    height,
    width 
  })
  // 当有多个应用时，提醒窗口始终处于最上层
  remindWindow.setAlwaysOnTop(true)
  remindWindow.loadURL(`file://${__dirname}/src/remind.html`)
  remindWindow.show()
  // 主进程发送消息给渲染进程
  remindWindow.webContents.send('setTask', task)
  remindWindow.on('closed', () => { remindWindow = null })
  setTimeout( () => {
    remindWindow && remindWindow.close()
  }, 50 * 1000)
}

function checkUpdate(){
  if(process.platform == 'darwin'){
    autoUpdater.setFeedURL('http://127.0.0.1:9005/darwin')
  }else{
    autoUpdater.setFeedURL('http://127.0.0.1:9005/win32')
  }
  autoUpdater.checkForUpdates()
  autoUpdater.on('error', (err) => {
    console.log(err)
  })
  autoUpdater.on('update-available', () => {
    console.log('found new version')
  })
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: '应用更新',
      message: '发现新版本，是否更新？',
      buttons: ['是', '否']
    }).then((buttonIndex) => {
      if(buttonIndex.response == 0) {
        autoUpdater.quitAndInstall()
        app.quit()
      }
    })
  })
}
