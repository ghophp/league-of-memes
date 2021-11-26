import { ipcRenderer as ipc } from "electron";

import { platform } from "os";
import React, { useEffect, useState } from "react";

import appStyles from "./stylesheets/sass/app.module.sass";

/**
 * Simple check to see if the platform is windows if not then assume it is macOS since that is the
 * only other supported platform.
 */
const IS_WIN = platform() === "win32";

const App = (): React.ReactElement => {
  const [summonerName, setSummonerName]: any = useState("");
  const [isGameRunning, setIsGameRunning]: any = useState();

  /**
   * Things to be done on initial load like notifying the back that the front
   * has loaded and is ready to receive data
   */
  useEffect(() => {
    /**
     * Let the back know the front is ready
     */
    ipc.send("FRONTEND_READY", "");

    /**
     * Set a listener for when the LCU ever connects the front can ask for
     * permission to end the users session and set the state which is the swagger
     * json.
     */
    ipc.on("NEW_GAME", (event, name) => {
      console.log("Connected to league client!");
      setIsGameRunning(true);
      setSummonerName(name);
    });

    /**
     * If the LCU disconnects just change the variables back.
     */
    ipc.on("WAITING", () => {
      console.log("Waiting Game");
      setIsGameRunning(false);
      setSummonerName("");
    });
  }, []);

  function onTestClick() {
    ipc.send("FRONTEND_TEST_GAME_START", "");
  }

  return (
    <>
      <div
        className={IS_WIN ? appStyles.titlebar_win : appStyles.titlebar_macos}
        draggable={false}
      >
        <div className={appStyles.column}>
          {IS_WIN ? (
            <div className={appStyles.buttons_win}>
              <div className={appStyles.spacer} />
              <div
                className={appStyles.buttons_min}
                onClick={() => {
                  ipc.send("process_min", "");
                }}
              />
              <div
                className={appStyles.buttons_minmax}
                onClick={() => {
                  ipc.send("process_minmax", "");
                }}
              />
              <div
                className={appStyles.buttons_close}
                onClick={() => {
                  ipc.send("program_close", "");
                }}
              />
            </div>
          ) : (
            <div className={appStyles.buttons_mac}>
              <div
                className={appStyles.buttons_close}
                onClick={() => {
                  ipc.send("program_close", "");
                }}
              />
              <div
                className={appStyles.buttons_minmax}
                onClick={() => {
                  ipc.send("process_fullscreen", "");
                }}
              />
              <div
                className={appStyles.buttons_min}
                onClick={() => {
                  ipc.send("process_min", "");
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div className={appStyles.main}>
        {isGameRunning
          ? `We are ready to roll ${summonerName}!`
          : "Waiting for game to start"}
      </div>

      <hr className={appStyles.divisor} />

      <div className={appStyles.secondary}>
        <span>Add a BrowserSource to your OBS with the following URl:</span>
        <input type="text" readOnly value="http://localhost:9990" />
        <button type="button" onClick={onTestClick}>
          Test Game Start
        </button>
      </div>
    </>
  );
};

// TODO: finish the layout of this component

export default App;
