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
export const MINIONS_READY = 'MINIONS_READY';
export const FIRST_BLOOD_MY_TEAM = 'FIRST_BLOOD_MY_TEAM';
export const FIRST_BLOOD_ENEMY_TEAM = 'FIRST_BLOOD_ENEMY_TEAM';
export const CHAMPION_KILL_MY_TEAM = 'CHAMPION_KILL_MY_TEAM';
export const CHAMPION_KILL_ENEMY_TEAM = 'CHAMPION_KILL_ENEMY_TEAM';
export const MULTI_KILL_MY_TEAM = 'MULTI_KILL_MY_TEAM';
export const MULTI_KILL_ENEMY_TEAM = 'MULTI_KILL_ENEMY_TEAM';
export const PENTA_KILL_MY_TEAM = 'PENTA_KILL_MY_TEAM';
export const PENTA_KILL_ENEMY_TEAM = 'PENTA_KILL_ENEMY_TEAM';
export const TURRET_MY_TEAM = 'TURRET_MY_TEAM';
export const TURRET_ENEMY_TEAM = 'TURRET_ENEMY_TEAM';
export const DRAGON_KILL_MY_TEAM = 'DRAGON_KILL_MY_TEAM';
export const DRAGON_KILL_ENEMY_TEAM = 'DRAGON_KILL_ENEMY_TEAM';
export const STOLE_DRAGON_MY_TEAM = 'STOLE_DRAGON_MY_TEAM';
export const STOLE_DRAGON_ENEMY_TEAM = 'STOLE_DRAGON_ENEMY_TEAM';
export const BARON_KILL_MY_TEAM = 'BARON_KILL_MY_TEAM';
export const BARON_KILL_ENEMY_TEAM = 'BARON_KILL_ENEMY_TEAM';
export const STOLE_BARON_MY_TEAM = 'STOLE_BARON_MY_TEAM';
export const STOLE_BARON_ENEMY_TEAM = 'STOLE_BARON_ENEMY_TEAM';
export const INHIB_KILL_MY_TEAM = 'INHIB_KILL_MY_TEAM';
export const INHIB_KILL_ENEMY_TEAM = 'INHIB_KILL_ENEMY_TEAM';
export const ACE_MY_TEAM = 'ACE_MY_TEAM';
export const ACE_ENEMY_TEAM = 'ACE_ENEMY_TEAM';

const EVENTS_WEIGHT = {
  READY_TO_RUMBLE: 0,
  MINIONS_READY: 0,
  FIRST_BLOOD_MY_TEAM: 10,
  FIRST_BLOOD_ENEMY_TEAM: 10,
  CHAMPION_KILL_MY_TEAM: 0,
  CHAMPION_KILL_ENEMY_TEAM: 0,
  MULTI_KILL_MY_TEAM: 20,
  MULTI_KILL_ENEMY_TEAM: 20,
  PENTA_KILL_MY_TEAM: 30,
  PENTA_KILL_ENEMY_TEAM: 30,
  TURRET_MY_TEAM: 0,
  TURRET_ENEMY_TEAM: 0,
  DRAGON_KILL_MY_TEAM: 30,
  DRAGON_KILL_ENEMY_TEAM: 30,
  STOLE_DRAGON_MY_TEAM: 40,
  STOLE_DRAGON_ENEMY_TEAM: 40,
  BARON_KILL_MY_TEAM: 30,
  BARON_KILL_ENEMY_TEAM: 30,
  STOLE_BARON_MY_TEAM: 40,
  STOLE_BARON_ENEMY_TEAM: 40,
  INHIB_KILL_MY_TEAM: 0,
  INHIB_KILL_ENEMY_TEAM: 0,
  ACE_MY_TEAM: 30,
  ACE_ENEMY_TEAM: 30,
};

/** LEAGUE EVENTS **/
const LEAGUE_GAME_START = 'GameStart';
const LEAGUE_MINIONS = 'MinionsSpawning';
const LEAGUE_FIRST_BLOOD = 'FirstBlood';
const LEAGUE_CHAMPION_KILL = 'ChampionKill';
const LEAGUE_MULTI_KILL = 'Multikill';
const LEAGUE_TURRET_KILL = 'TurretKilled';
const LEAGUE_DRAGON_KILL = 'DragonKill';
const LEAGUE_BARON_KILL = 'BaronKill';
const LEAGUE_INHIB_KILL = 'InhibKilled';
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
      if (currentEvent.EventName === LEAGUE_MINIONS) {
        eventsToEmit.push({
          name: MINIONS_READY,
          meta: {}
        });
      }
      if (currentEvent.EventName === LEAGUE_FIRST_BLOOD) {
        if (this.isPlayerOnMyTeam(currentEvent.Recipient)) {
          eventsToEmit.push({
            name: FIRST_BLOOD_MY_TEAM,
            meta: {}
          });
        } else {
          eventsToEmit.push({
            name: FIRST_BLOOD_ENEMY_TEAM,
            meta: {}
          });
        }
      }
      if (currentEvent.EventName === LEAGUE_CHAMPION_KILL) {
        if (this.isPlayerOnMyTeam(currentEvent.KillerName)) {
          eventsToEmit.push({
            name: CHAMPION_KILL_MY_TEAM,
            meta: {}
          });
        } else {
          eventsToEmit.push({
            name: CHAMPION_KILL_ENEMY_TEAM,
            meta: {}
          });
        }
      }
      if (currentEvent.EventName === LEAGUE_MULTI_KILL) {
        if (currentEvent.KillStreak >= 5) {
          if (this.isPlayerOnMyTeam(currentEvent.KillerName)) {
            eventsToEmit.push({
              name: PENTA_KILL_MY_TEAM,
              meta: {}
            });
          } else {
            eventsToEmit.push({
              name: PENTA_KILL_ENEMY_TEAM,
              meta: {}
            });
          }
        } else {
          if (this.isPlayerOnMyTeam(currentEvent.KillerName)) {
            eventsToEmit.push({
              name: MULTI_KILL_MY_TEAM,
              meta: {}
            });
          } else {
            eventsToEmit.push({
              name: MULTI_KILL_ENEMY_TEAM,
              meta: {}
            });
          }
        }
      }
      if (currentEvent.EventName === LEAGUE_TURRET_KILL) {
        if (this.isPlayerOnMyTeam(currentEvent.KillerName)) {
          eventsToEmit.push({
            name: TURRET_MY_TEAM,
            meta: {}
          });
        } else {
          eventsToEmit.push({
            name: TURRET_ENEMY_TEAM,
            meta: {}
          });
        }
      }
      if (currentEvent.EventName === LEAGUE_DRAGON_KILL) {
        if (currentEvent.Stolen === 'False') {
          if (this.isPlayerOnMyTeam(currentEvent.KillerName)) {
            eventsToEmit.push({
              name: DRAGON_KILL_MY_TEAM,
              meta: {}
            });
          } else {
            eventsToEmit.push({
              name: DRAGON_KILL_ENEMY_TEAM,
              meta: {}
            });
          }
        } else {
          if (this.isPlayerOnMyTeam(currentEvent.KillerName)) {
            eventsToEmit.push({
              name: STOLE_DRAGON_MY_TEAM,
              meta: {}
            });
          } else {
            eventsToEmit.push({
              name: STOLE_DRAGON_ENEMY_TEAM,
              meta: {}
            });
          }
        }
      }
      if (currentEvent.EventName === LEAGUE_BARON_KILL) {
        if (currentEvent.Stolen === 'False') {
          if (this.isPlayerOnMyTeam(currentEvent.KillerName)) {
            eventsToEmit.push({
              name: BARON_KILL_MY_TEAM,
              meta: {}
            });
          } else {
            eventsToEmit.push({
              name: BARON_KILL_ENEMY_TEAM,
              meta: {}
            });
          }
        } else {
          if (this.isPlayerOnMyTeam(currentEvent.KillerName)) {
            eventsToEmit.push({
              name: STOLE_BARON_MY_TEAM,
              meta: {}
            });
          } else {
            eventsToEmit.push({
              name: STOLE_BARON_ENEMY_TEAM,
              meta: {}
            });
          }
        }
      }
      if (currentEvent.EventName === LEAGUE_INHIB_KILL) {
        if (this.isPlayerOnMyTeam(currentEvent.KillerName)) {
          eventsToEmit.push({
            name: INHIB_KILL_MY_TEAM,
            meta: {}
          });
        } else {
          eventsToEmit.push({
            name: INHIB_KILL_ENEMY_TEAM,
            meta: {}
          });
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
      if (aWeight < bWeight) {
        return -1;
      }
      if (aWeight > bWeight) {
        return 1;
      }
      return 0;
    });

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
