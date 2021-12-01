import { platform } from "os";
import * as fs from "fs";
import { app, BrowserWindow, ipcMain as ipc, globalShortcut } from "electron";
import RiotConnector, {
  END_GAME,
  GAME_START,
  GIF_IT,
  READY_TO_RUMBLE
} from "./util/RiotConnector";
import express from "express";
import * as path from "path";

app.commandLine.appendSwitch("ignore-certificate-errors", "true");

/**
 * Check if is windows other wise assume is macOS since that is the
 * only other supported OS.
 */
const IS_WIN = platform() === "win32";
/**
 * Check if in development build.
 */
const IS_DEV: boolean = require.main.filename.indexOf("app.asar") === -1;

/**
 * New instance of the riot connector.
 */
const riotConnector = new RiotConnector();
const expressApp = express();

let mainWindow: BrowserWindow | null = null;
let windowLoaded = false;
let currentEvent = null;

/**
 * Create electron window.
 */
function createWindow() {
  const configRaw = fs.readFileSync(`${__dirname}/../config.json`, 'utf8');
  const config = JSON.parse(configRaw);

  mainWindow = new BrowserWindow({
    center: true,
    height: 490,
    minHeight: 490,
    show: IS_DEV,
    width: 360,
    minWidth: 360,
    frame: false,
    title: "League of Memes",
    backgroundColor: "#303030",
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      scrollBounce: true,
      devTools: IS_DEV,
    },
  });

  /**
   * If in dev then open devtools in a detached window.
   */
  if (IS_DEV) mainWindow.webContents.openDevTools({ mode: "detach" });

  /**
   * Remove default menu.
   */
  mainWindow.setMenu(null);

  /**
   * If in dev then since we use react it will spin up a dev server which runs on
   * localhost:3000 but if we're not in dev then just use the build location.
   */
  mainWindow
    .loadURL(IS_DEV ? "http://localhost:3000" : `file://${__dirname}/../index.html`)
    .catch((err) => {
      console.error(err);
      throw new Error("Error loading main page: " + err.message);
    });

  /**
   * Only show the window when the page has fully loaded.
   */
  mainWindow.webContents.on("did-finish-load", () => {
    windowLoaded = true;
    mainWindow?.show();
    riotConnector.start();
  });

  /**
   * When render process dies just kill the application when in dev
   */
  mainWindow.webContents.on("render-process-gone", () => {
    if (IS_DEV) {
      process.exit(0);
    }
  });

  /**
   * Just closing the window.
   */
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  /**
   * When the frontend fires the ready event send any data already at hand
   * or just send an empty string.
   */
  ipc.on("FRONTEND_READY", () => {
    mainWindow?.webContents.send("LOAD_CONFIG", config);
  });

  ipc.on("FRONTEND_TEST_GAME_START", () => {
    currentEvent = READY_TO_RUMBLE;
  });

  /**
   * When the league client connects check if swagger is already enabled if it is just send the
   * swagger json to the frontend to be generated, If not then prompt the user for permission
   * to end the users current league client session so that we can modify the system yaml.
   */
  riotConnector.on(GAME_START, async (summonerName) => {
    mainWindow?.webContents.send("NEW_GAME", summonerName);
  });

  riotConnector.on(END_GAME, async () => {
    mainWindow?.webContents.send("WAITING", {});
  });

  riotConnector.on(GIF_IT, async (event) => {
    currentEvent = event.name;
  });

  ipc.on("program_close", () => {
    mainWindow.close();
  });

  ipc.on("process_minmax", () => {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });

  ipc.on("process_fullscreen", () => {
    mainWindow.isFullScreen()
      ? mainWindow.setFullScreen(false)
      : mainWindow.setFullScreen(true);
  });

  ipc.on("process_min", () => {
    mainWindow.minimize();
  });

  expressApp.get( "/", ( req, res ) => {
    res.sendFile(path.join(`${__dirname}/../widget.html`));
  });

  expressApp.get( "/provide", ( req, res ) => {
    if (currentEvent && typeof config[currentEvent] !== 'undefined') {
        const currentConfiguredEvent = config[currentEvent];
        currentEvent = null;
        if (currentConfiguredEvent.clips.length > 0) {
          res.json(currentConfiguredEvent.clips[Math.floor(Math.random() * currentConfiguredEvent.clips.length)]);
          return;
        }
    }

    res.json({});
  });

  expressApp.listen(9990, () => {
    console.log(`server started at http://localhost:9990`);
  });
}

app.on("ready", () => {
  if (IS_DEV) {
    const ret = globalShortcut.register("CommandOrControl+B", () => {
      console.warn("Forcibly throwing error!");
      throw new Error("Debug force error throw");
    });

    if (!ret) {
      console.log("Failed registering force error shortcut");
    }

    // Check whether a shortcut is registered.
    console.log(globalShortcut.isRegistered("CommandOrControl+B"));
  }

  createWindow();
});

app.on("window-all-closed", () => {
  if (platform() !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (IS_WIN === null) {
    createWindow();
  }
});
