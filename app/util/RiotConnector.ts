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

/** CONTROL EVENTS **/
export const GAME_START = 'GAME_START';
export const END_GAME = 'END_GAME';
export const GIF_IT = 'GIF_IT';

/** GIF EVENTS **/
export const READY_TO_RUMBLE = 'READY_TO_RUMBLE';
export const FIRST_BLOOD = 'FIRST_BLOOD';
export const CHAMPION_KILL = 'CHAMPION_KILL';
export const CHAMPION_KILL_VICTIM = 'CHAMPION_KILL_VICTIM';
export const MULTI_KILL = 'MULTI_KILL';
export const PENTA_KILL = 'PENTA_KILL';
export const PENTA_KILL_ENEMY_TEAM = 'PENTA_KILL_ENEMY_TEAM';
export const DRAGON_KILL = 'DRAGON_KILL';
export const STOLE_DRAGON = 'STOLE_DRAGON';
export const STOLE_DRAGON_ENEMY_TEAM = 'STOLE_DRAGON_ENEMY_TEAM';
export const BARON_KILL = 'BARON_KILL';
export const STOLE_BARON = 'STOLE_BARON';
export const STOLE_BARON_ENEMY_TEAM = 'STOLE_BARON_ENEMY_TEAM';
export const ACE_MY_TEAM = 'ACE_MY_TEAM';
export const ACE_ENEMY_TEAM = 'ACE_ENEMY_TEAM';

const EVENTS_WEIGHT = {
  READY_TO_RUMBLE: 0,
  FIRST_BLOOD: 20,
  CHAMPION_KILL: 10,
  CHAMPION_KILL_VICTIM: 0,
  MULTI_KILL: 20,
  PENTA_KILL: 30,
  PENTA_KILL_ENEMY_TEAM: 30,
  DRAGON_KILL: 30,
  STOLE_DRAGON: 40,
  STOLE_DRAGON_ENEMY_TEAM: 40,
  BARON_KILL: 40,
  STOLE_BARON: 40,
  STOLE_BARON_ENEMY_TEAM: 40,
  ACE_MY_TEAM: 30,
  ACE_ENEMY_TEAM: 30,
};

/** LEAGUE EVENTS **/
const LEAGUE_GAME_START = 'GameStart';
const LEAGUE_FIRST_BLOOD = 'FirstBlood';
const LEAGUE_CHAMPION_KILL = 'ChampionKill';
const LEAGUE_MULTI_KILL = 'Multikill';
const LEAGUE_DRAGON_KILL = 'DragonKill';
const LEAGUE_BARON_KILL = 'BaronKill';
const LEAGUE_ACE = 'Ace';

const MAX_RETRY_ATTEMPTS = 5;

/**
 * Connector which allows us to check for the league and riot client.
 * @since 7.0.0
 */
export default class RiotConnector extends EventEmitter {
  status = WAITING_GAME_START;
  currentRetryCount = 0;
  currentGame = null;
  teams = null;
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
    setTimeout(this.startLoop.bind(this), 1000);
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

  processEvents(events) {
    let eventsToEmit = [];
    for (let x = this.currentEventIndex; x < events.length; x++) {
      const currentEvent = events[x];
      if (currentEvent.EventName === LEAGUE_GAME_START) {
        eventsToEmit.push({
          name: READY_TO_RUMBLE,
          meta: {}
        });
      }
      if (currentEvent.EventName === LEAGUE_FIRST_BLOOD && this.isMe(currentEvent.Recipient)) {
        eventsToEmit.push({
          name: FIRST_BLOOD,
          meta: {}
        });
      }
      if (currentEvent.EventName === LEAGUE_CHAMPION_KILL) {
        if (this.isMe(currentEvent.KillerName)) {
          eventsToEmit.push({
            name: CHAMPION_KILL,
            meta: {}
          });
        } else if (this.isMe(currentEvent.VictimName)) {
          eventsToEmit.push({
            name: CHAMPION_KILL_VICTIM,
            meta: {}
          });
        }
      }
      if (currentEvent.EventName === LEAGUE_MULTI_KILL) {
        if (currentEvent.KillStreak >= 5) {
          if (this.isMe(currentEvent.KillerName)) {
            eventsToEmit.push({
              name: PENTA_KILL,
              meta: {}
            });
          } else if (!this.isPlayerOnMyTeam(currentEvent.KillerName)) {
            eventsToEmit.push({
              name: PENTA_KILL_ENEMY_TEAM,
              meta: {}
            });
          }
        } else if (this.isMe(currentEvent.KillerName)) {
          eventsToEmit.push({
            name: MULTI_KILL,
            meta: {}
          });
        }
      }
      if (currentEvent.EventName === LEAGUE_DRAGON_KILL) {
        if (!this.isPlayerOnMyTeam(currentEvent.KillerName)) {
          if (this.isMeAmongAssisters(currentEvent.Assisters || [])) {
            eventsToEmit.push({
              name: STOLE_DRAGON_ENEMY_TEAM,
              meta: {}
            });
          }
        } else {
          if (this.isMe(currentEvent.KillerName) || this.isMeAmongAssisters(currentEvent.Assisters || [])) {
            if (currentEvent.Stolen === 'False') {
              eventsToEmit.push({
                name: DRAGON_KILL,
                meta: {}
              });
            } else {
              eventsToEmit.push({
                name: STOLE_DRAGON,
                meta: {}
              });
            }
          }
        }
      }
      if (currentEvent.EventName === LEAGUE_BARON_KILL) {
        if (!this.isPlayerOnMyTeam(currentEvent.KillerName)) {
          if (this.isMeAmongAssisters(currentEvent.Assisters || [])) {
            eventsToEmit.push({
              name: STOLE_BARON_ENEMY_TEAM,
              meta: {}
            });
          }
        } else {
          if (this.isMe(currentEvent.KillerName) || this.isMeAmongAssisters(currentEvent.Assisters || [])) {
            if (currentEvent.Stolen === 'False') {
              eventsToEmit.push({
                name: BARON_KILL,
                meta: {}
              });
            } else {
              eventsToEmit.push({
                name: STOLE_BARON,
                meta: {}
              });
            }
          }
        }
      }
      if (currentEvent.EventName === LEAGUE_ACE) {
        if (this.isMyTeam(currentEvent.AcingTeam.toLowerCase())) {
          eventsToEmit.push({
            name: ACE_MY_TEAM,
            meta: {}
          });
        } else {
          eventsToEmit.push({
            name: ACE_ENEMY_TEAM,
            meta: {}
          });
        }
      }
    }

    eventsToEmit.sort((a, b) => {
      const aWeight = EVENTS_WEIGHT[a.name];
      const bWeight = EVENTS_WEIGHT[b.name];
      if (aWeight > bWeight) {
        return -1;
      }
      if (aWeight < bWeight) {
        return 1;
      }
      return 0;
    });

    console.log('Got events to emit: ', eventsToEmit);

    if (eventsToEmit.length > 0) {
      this.emit(GIF_IT, eventsToEmit[0]);
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
    this.teams = this.prepareTeams(data.activePlayer.summonerName, data.allPlayers);

    console.log('Game Started', this.currentGame);
    console.log('Teams', this.teams);

    this.emit(GAME_START, data.activePlayer.summonerName);
  }

  gameEnded() {
    this.status = WAITING_GAME_START;
    this.currentGame = null;
    this.currentEventIndex = 0;
    this.emit(END_GAME, '');
  }

  prepareTeams(summonerName, allPlayers) {
    let teams = {
      'chaos': {},
      'order': {},
      'my_team': ''
    };

    for (let x = 0; x < allPlayers.length; x++) {
      const currentChamp = allPlayers[x];
      teams[currentChamp.team.toLowerCase()][currentChamp.summonerName] = true;
      if (currentChamp.summonerName === summonerName) {
        teams['my_team'] = currentChamp.team.toLowerCase();
      }
    }

    return teams;
  }

  getPlayerTeam(summonerName) {
    if (typeof this.teams['chaos'][summonerName] !== 'undefined') {
      return 'chaos';
    } else {
      return 'order';
    }
  }

  isPlayerOnMyTeam(summonerName) {
    return this.teams['my_team'] === this.getPlayerTeam(summonerName);
  }

  isMe(summonerName) {
    return summonerName === this.currentGame.activePlayer.summonerName;
  }

  isMeAmongAssisters(assisters) {
    for (let x = 0; x < assisters.length; x++) {
      if (assisters[x] === this.currentGame.activePlayer.summonerName) {
        return true;
      }
    }
    return false;
  }

  isMyTeam(team) {
    return this.teams['my_team'] === team;
  }

  /**
   * Start the watchers.
   */
  start() {
    this.startLoop();
  }
}
