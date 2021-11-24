import * as Sentry from "@sentry/electron";

console.log("Initializing Sentry");
Sentry.init({
  dsn: "https://b0ef34ececf64e1ea0a26f3b082bb71f@o1076901.ingest.sentry.io/6079236",
});

console.log("Starting league-of-memes");
import "./main";
