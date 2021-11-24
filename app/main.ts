import { Agent } from "https";
import { platform } from "os";
import { app, BrowserWindow, ipcMain as ipc, globalShortcut } from "electron";
import { modifySystemYaml } from "./util";
import * as path from "path";
import axios from "axios";
import RiotConnector from "./util/RiotConnector";
import express from "express";

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
 * Root dir of app.
 */
const ROOT = `${__dirname}/app`;

/**
 * New instance of the riot connector.
 */
const riotconnector = new RiotConnector();

/**
 * Simple axios instance with disabled SSL to allow the self signed cert.
 */
const instance = axios.create({
  httpsAgent: new Agent({
    rejectUnauthorized: false,
  }),
});

const expressApp = express();

let mainWindow: BrowserWindow | null = null;
let windowLoaded = false;

let LCUData: any = null;

/**
 * Create electron window.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    center: true,
    height: 640,
    minHeight: 640,
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
    .loadURL(IS_DEV ? "http://localhost:3000" : `file://${ROOT}/index.html`)
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
    riotconnector.start();
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
  ipc.on("FEREADY", () => {
    mainWindow?.webContents.send("BEPRELOAD", "");
  });

  /**
   * When connected to the Riot Client start modification of the League clients
   * system.yml to enable swagger and to end the users current session.
   */
  riotconnector.on("riotclient", (leaguePath: any) => {
    if (!leaguePath) return;

    console.log(`Riotclient is open; corresponding league path: ${leaguePath}`);
    const systemYamlPath = path.join(leaguePath, "system.yaml");

    modifySystemYaml(systemYamlPath).catch((err) => {
      console.error(err);
      throw new Error("Error modifying system yaml: " + err.message);
    });
  });

  /**
   * When the league client connects check if swagger is already enabled if it is just send the
   * swagger json to the frontend to be generated, If not then prompt the user for permission
   * to end the users current league client session so that we can modify the system yaml.
   */
  riotconnector.on("leagueclient", async (data) => {
    console.log("initial lcu connect");
    LCUData = await data;
    const { username, password, address, port, protocol } = LCUData;

    /**
     * During the initial load of the client the backend server is not instantly ready
     * to serve requests so we check the connection first
     */
    let serverReady = false;
    let retries = 6; // reasonable amount of retries
    while (!serverReady && retries > 0) {
      await instance
        .get(`${protocol}://${username}:${password}@${address}:${port}/`)
        .catch((res) => {
          if (res.errno !== "ECONNREFUSED") {
            serverReady = true;
          } else {
            retries--;
          }
        });
    }

    if (!serverReady) {
      mainWindow?.webContents.send("PROMPTRETRY");
    } else {
      mainWindow?.webContents.send("LCUCONNECT", LCUData);
    }
  });

  /**
   * If the Riot connector disconnects just remove the old lcu data since it will most likely
   * be different the next time the lcu is brought back on.
   */
  riotconnector.on("disconnect", () => {
    LCUData = null;
    if (windowLoaded) {
      mainWindow?.webContents.send("LCUDISCONNECT");
    }
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
    res.send('Hello World!');
  } );

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
