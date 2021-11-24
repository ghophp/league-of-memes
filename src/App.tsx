import * as Sentry from "@sentry/react";

import { ipcRenderer as ipc } from "electron";

import { platform } from "os";
import React, { useEffect, useState } from "react";
import Logo from "./images/logo.png";
import Loading from "./Loading";

import appstyles from "./stylesheets/sass/app.module.sass";

/**
 * Simple check to see if the platform is windows if not then assume it is macOS since that is the
 * only other supported platform.
 */
const IS_WIN = platform() === "win32";

const App = (): React.ReactElement => {
  const [status, setStatus]: any = useState(
    "Waiting for League of Legends Client"
  );
  const [credentials, setCredentials]: any = useState();

  useEffect(() => {
    Sentry.init({
      dsn: "https://b0ef34ececf64e1ea0a26f3b082bb71f@o1076901.ingest.sentry.io/6079236",
    });
  }, []);

  useEffect(() => {
    console.log(`Credentials are`);
    console.log(credentials);
  }, [credentials]);

  /**
   * Things to be done on initial load like notifying the back that the front
   * has loaded and is ready to receive data
   */
  useEffect(() => {
    /**
     * Let the back know the front is ready
     */
    ipc.send("FEREADY", "");

    /**
     * Set a listener for when the LCU ever connects the front can ask for
     * permission to end the users session and set the state which is the swagger
     * json.
     */
    ipc.on("LCUCONNECT", (event, creds) => {
      console.log("Connected to league client!");
      setStatus("Connected to league client!");
      console.log(`credentials_pass: ${JSON.stringify(creds)}`);
      setCredentials(creds);
    });

    /**
     * If the LCU disconnects just change the variables back.
     */
    ipc.on("LCUDISCONNECT", () => {
      console.log("League client disconnected; attempting to reconnect");
      setStatus("League client disconnected; attempting to reconnect");
      setCredentials(null);
    });
  }, []);

  return (
    <>
      <div
        className={IS_WIN ? appstyles.titlebar_win : appstyles.titlebar_macos}
        draggable={false}
      >
        <div className={appstyles.column}>
          {IS_WIN ? (
            <div className={appstyles.buttons_win}>
              <div className={appstyles.spacer} />
              <div
                className={appstyles.buttons_min}
                onClick={() => {
                  ipc.send("process_min", "");
                }}
              />
              <div
                className={appstyles.buttons_minmax}
                onClick={() => {
                  ipc.send("process_minmax", "");
                }}
              />
              <div
                className={appstyles.buttons_close}
                onClick={() => {
                  ipc.send("program_close", "");
                }}
              />
            </div>
          ) : (
            <div className={appstyles.buttons_mac}>
              <div
                className={appstyles.buttons_close}
                onClick={() => {
                  ipc.send("program_close", "");
                }}
              />
              <div
                className={appstyles.buttons_minmax}
                onClick={() => {
                  ipc.send("process_fullscreen", "");
                }}
              />
              <div
                className={appstyles.buttons_min}
                onClick={() => {
                  ipc.send("process_min", "");
                }}
              />
            </div>
          )}
        </div>
        <div className={appstyles.deadzone} />
        <div className={appstyles.column}>
          {IS_WIN && (
            <div className={appstyles.logo}>
              <img src={Logo} alt="" /> League of Memes
            </div>
          )}
        </div>
      </div>

      {credentials ? (
        <div className={appstyles.swaggercontainer}>
          League of Legends Client Connected
        </div>
      ) : (
        <Loading message={status} />
      )}
    </>
  );
};

export default App;
