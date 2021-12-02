/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": false}] */
import { ipcRenderer as ipc } from "electron";

import { platform } from "os";
import React, { useEffect, useState } from "react";
import useDynamicRefs from "./ref";

import ConfigObs from "./images/config_obs.png";
import Connected from "./images/connected.png";
import Remove from "./images/remove.png";
import appStyles from "./stylesheets/sass/app.module.sass";

/**
 * Simple check to see if the platform is windows if not then assume it is macOS since that is the
 * only other supported platform.
 */
const IS_WIN = platform() === "win32";

const App = (): React.ReactElement => {
  const [summonerName, setSummonerName]: any = useState("");
  const [config, setConfig]: any = useState({});
  const [isGameRunning, setIsGameRunning]: any = useState();
  const [isConfigurationMode, setIsConfigurationMode]: any = useState();
  const [getRef, setRef] = useDynamicRefs();

  /**
   * Prepare the config with clips as objects
   * @param loadedConfig
   */
  function prepareConfig(loadedConfig) {
    const copyConfig = { ...loadedConfig };
    Object.keys(copyConfig).forEach(function (key) {
      copyConfig[key].clips = copyConfig[key].clips.map(function (
        value,
        index
      ) {
        return {
          id: `${key}[${index}]`,
          url: value,
        };
      });
    });
    return copyConfig;
  }

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

    ipc.on("LOAD_CONFIG", (event, loadedConfig) => {
      setIsGameRunning(false);
      setSummonerName("");
      setConfig(prepareConfig(loadedConfig));
    });

    ipc.on("CONFIG_SAVED", (event, savedConfig) => {
      setConfig(prepareConfig(savedConfig));
      setIsConfigurationMode(false);
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

  function onConfigureEvents() {
    setIsConfigurationMode(true);
  }

  function isValidHttpUrl(string) {
    let url;

    try {
      url = new URL(string);
    } catch (_) {
      return false;
    }

    return url.protocol === "http:" || url.protocol === "https:";
  }

  function onSaveConfig(event) {
    const preparedConfig = {};

    Object.keys(config).forEach(function (key) {
      if (typeof preparedConfig[key] === "undefined") {
        preparedConfig[key] = { ...config[key] };
      }

      /**
       * Transform the config back to clips as string
       */
      preparedConfig[key].clips.forEach(function (clip, index) {
        const inputValue = getRef(clip.id).current?.value;
        const oldValue = preparedConfig[key].clips[index].url;

        if (inputValue !== oldValue) {
          if (isValidHttpUrl(inputValue)) {
            preparedConfig[key].clips[index] = inputValue;
          } else {
            preparedConfig[key].clips[index] = "";
          }
        } else {
          preparedConfig[key].clips[index] = oldValue;
        }
      });

      preparedConfig[key].clips = preparedConfig[key].clips.filter(function (
        v
      ) {
        return v !== "";
      });
    });

    ipc.send("FRONTEND_SAVE_CONFIG", preparedConfig);
    event.preventDefault();
  }

  function onAddClipClick(key) {
    const copyConfig = { ...config };
    copyConfig[key].clips.push({
      id: `${key}[${copyConfig[key].clips.length}]`,
      url: "",
    });
    setConfig(copyConfig);
  }

  function onRemoveClip(key, index) {
    const copyConfig = { ...config };
    copyConfig[key].clips.splice(index, 1);
    setConfig(copyConfig);
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

      {!isConfigurationMode && (
        <div>
          <div className={appStyles.main}>
            <p>Add the following BrowserSource URL to your OBS:</p>
            <div>
              <input type="text" readOnly value="http://localhost:9990/" />
            </div>
            <p>Once the source is added, use the button bellow to test:</p>
            <button
              type="button"
              onClick={onTestClick}
              className={appStyles.regular_button}
            >
              Test Event
            </button>
            <button
              type="button"
              style={{ marginLeft: 10 }}
              onClick={onConfigureEvents}
              className={appStyles.regular_button}
            >
              Configure
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
              ? `Game being Monitored for Summoner: ${summonerName}`
              : "Waiting for game to start"}
          </div>
        </div>
      )}

      {isConfigurationMode && (
        <form className={appStyles.config_wrapper} onSubmit={onSaveConfig}>
          <p style={{ fontSize: 12, marginBottom: 20 }}>
            We expect mp4 video URLs. You can add more than one clip to be
            triggered per event, we will randomly pick one.
          </p>
          {Object.keys(config).map(function (key) {
            return (
              <div
                className={appStyles.config_item_wrapper}
                key={config[key].event_name}
              >
                <div className={appStyles.config_item_title_wrapper}>
                  <span className={appStyles.config_item_title}>
                    {config[key].event_label}
                  </span>
                  <span className={appStyles.config_item_subtitle}>
                    {config[key].event_description}
                  </span>
                </div>
                <div className={appStyles.config_item_add}>
                  <button
                    type="button"
                    className={appStyles.small_button}
                    onClick={() => onAddClipClick(key)}
                  >
                    Add Clip
                  </button>
                </div>
                {config[key].clips.length > 0 && (
                  <ul className={appStyles.config_item_clip_list}>
                    {config[key].clips.map(function (clip, index) {
                      return (
                        <li key={clip.id}>
                          <input
                            name={clip.id}
                            className={appStyles.config_item_input}
                            type="text"
                            defaultValue={clip.url}
                            placeholder="Your mp4 video URL"
                            ref={setRef(clip.id)}
                          />
                          <button
                            type="button"
                            onClick={() => onRemoveClip(key, index)}
                            className={appStyles.img_button}
                          >
                            <img src={Remove} width={16} alt="Remove Clip" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
          <div style={{ textAlign: "center", paddingBottom: 10 }}>
            <button type="submit" className={appStyles.regular_button}>
              Save
            </button>
          </div>
        </form>
      )}
    </>
  );
};

// TODO: finish the layout of this component

export default App;
