import { ipcRenderer as ipc } from "electron";

import { platform } from "os";
/* eslint import/no-extraneous-dependencies: ["error", {"peerDependencies": true}] */
import React, { useEffect, useState } from "react";
import ConfigObs from "./images/config_obs.png";
import Connected from "./images/connected.png";
import appStyles from "./stylesheets/sass/app.module.sass";

const io = require("socket.io-client");

/**
 * Simple check to see if the platform is windows if not then assume it is macOS since that is the
 * only other supported platform.
 */
const IS_WIN = platform() === "win32";

const App = (): React.ReactElement => {
  const [summonerName, setSummonerName]: any = useState("");
  const [apiKey, setApiKey]: any = useState("");
  const [isGameRunning, setIsGameRunning]: any = useState();
  const [socket, setSocket]: any = useState(null);

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
      console.log("New Game has Started");
      setIsGameRunning(true);
      setSummonerName(name);

      if (socket) {
        socket.emit("event:test", { type: "new_game", value: true });
      }
    });

    ipc.on("GIF_IT", (event, eventName) => {
      if (socket) {
        socket.emit("event:test", { type: "video", value: eventName });
      }
    });

    /**
     * If the LCU disconnects just change the variables back.
     */
    ipc.on("WAITING", () => {
      console.log("Waiting Game");
      setIsGameRunning(false);
      setSummonerName("");

      if (socket) {
        socket.emit("event:test", { type: "waiting_game", value: true });
      }
    });
  }, [socket]);

  function startSocket(token) {
    const currentSocket = io("https://realtime.streamelements.com", {
      transports: ["websocket"],
    });

    currentSocket.on("connect_error", (err) => {
      console.log("Socket Error", err);
      currentSocket.open();
    });

    function onConnect() {
      console.log("Successfully connected to the websocket");
      currentSocket.emit("authenticate", { method: "apikey", token });
    }

    function onDisconnect() {
      console.log("Disconnected from websocket");
      currentSocket.open();
    }

    function onAuthenticated(data) {
      currentSocket.emit("event:test", { type: "ping", value: "PING" });
    }

    currentSocket.on("connect", onConnect);
    currentSocket.on("disconnect", onDisconnect);
    currentSocket.on("authenticated", onAuthenticated);
    currentSocket.on("unauthorized", console.error);

    currentSocket.open();
    setSocket(currentSocket);
  }

  function onPingWidgetClick() {
    if (!socket) {
      startSocket(apiKey);
    } else {
      socket.emit("event:test", { type: "ping", value: "PING" });
    }
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

      <div>
        <div className={appStyles.main}>
          <p style={{ marginBottom: 0 }}>
            Please inform your <b>Overlay token</b>
          </p>
          <small
            style={{ display: "block", fontSize: "10px", marginBottom: 10 }}
          >
            https://streamelements.com/dashboard/account/channels
          </small>
          <div>
            <input
              type="text"
              value={apiKey}
              placeholder="eg. xxx99xx999x9x9x9x99x9x9xx9x99xx9x"
              onChange={(event) => setApiKey(event.target.value)}
              style={{ fontSize: "1.2em" }}
            />
          </div>
          <button
            type="button"
            onClick={onPingWidgetClick}
            className={appStyles.regular_button}
            style={{ marginTop: "10px" }}
          >
            Ping Widget
          </button>
        </div>

        <img
          className={appStyles.img_divisor}
          src={isGameRunning ? Connected : ConfigObs}
          alt="OBS BrowserSource Configuration"
        />

        <div className={appStyles.secondary}>
          <div
            className={appStyles.statePin}
            style={{ backgroundColor: isGameRunning ? "green" : "orange" }}
          >
            {" "}
          </div>
          {isGameRunning
            ? `Meme Ready ${summonerName}!`
            : "Waiting for game to start"}
        </div>

        <small className={appStyles.footnote}>
          Configure the video for each game event at the <b>Overlay Editor</b>.
        </small>
      </div>
    </>
  );
};

export default App;
