import { EventEmitter } from "events";
import {Agent} from "https";
import axios from "axios";

/**
 * Simple axios instance with disabled SSL to allow the self signed cert.
 */
const instance = axios.create({
  httpsAgent: new Agent({
    rejectUnauthorized: false,
  }),
});

/** STATES **/
const WAITING_GAME_START = 'WAITING_GAME_START';
const IN_GAME = 'IN_GAME';
const RETRYING_GAME_CONNECTION = 'RETRYING_GAME_CONNECTION';

/** EVENTS **/
export const GAME_START = 'GAME_START';
export const END_GAME = 'END_GAME';
export const READY_TO_RUMBLE = 'READY_TO_RUMBLE';

/** LEAGUE EVENTS **/
const LEAGUE_GAME_START = 'GameStart';

const MAX_RETRY_ATTEMPTS = 5;

/**
 * Connector which allows us to check for the league and riot client.
 * @since 7.0.0
 */
export default class RiotConnector extends EventEmitter {
  status = WAITING_GAME_START;
  currentRetryCount = 0;
  currentGame = null;
  currentEventIndex = 0;

  /**
   * Connector which allows us to check for the league and riot client.
   * @since 7.0.0
   */
  constructor() {
    super();
  }

  /**
   * This method will call endLoop in all cases
   */
  startLoop() {
    instance
      .get(
        `https://127.0.0.1:2999/liveclientdata/allgamedata`
      )
      .then((res) => {
        this.processGameData(res.data);
        this.endLoop();
      })
      .catch((err) => {
        this.processErrorTalkingToGame(err);
        this.endLoop();
      });
  }

  /**
   * This method will recall startLoop until isRunning is false
   */
  endLoop() {
    this.startLoop();
  }

  processGameData(data) {
    this.status = IN_GAME;
    this.currentRetryCount = 0;

    if (!this.currentGame) {
      this.gameStarted(data);
    } else {
      this.processEvents(data.events.Events);
    }
  }

  // TODO: duplicated events at the moment
  // TODO: add more events
  processEvents(events) {
    for (let x = this.currentEventIndex; x < events.length; x++) {
      const currentEvent = events[this.currentEventIndex];
      console.log('should process', currentEvent);
      if (currentEvent.EventName === LEAGUE_GAME_START) {
        this.emit(READY_TO_RUMBLE, {});
      }
    }

    this.currentEventIndex = events.length;
  }

  processErrorTalkingToGame(err) {
    if (this.status === WAITING_GAME_START) {
      return;
    }

    if (this.status === IN_GAME) {
      this.status = RETRYING_GAME_CONNECTION;
      this.currentRetryCount = 0;
    }

    if (this.status === RETRYING_GAME_CONNECTION) {
      this.currentRetryCount++;
    }

    if (this.currentRetryCount > MAX_RETRY_ATTEMPTS) {
      this.gameEnded();
    }
  }

  gameStarted(data) {
    this.status = IN_GAME;
    this.currentGame = data;
    this.emit(GAME_START, data.activePlayer.summonerName);
  }

  gameEnded() {
    this.status = WAITING_GAME_START;
    this.currentGame = null;
    this.currentEventIndex = 0;
    this.emit(END_GAME, '');
  }

  /**
   * Start the watchers.
   */
  start() {
    this.startLoop();
  }
}
