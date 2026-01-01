import Color from "./color.js";

const logger = {
  info: (msg) =>
    console.log(Color.blue("● ●") + " " + Color.gray("Info  - ") + msg),
  ready: (msg) =>
    console.log(Color.green("● ●") + " " + Color.gray("Ready - ") + msg),
  warn: (msg) =>
    console.log(Color.yellow("● ●") + " " + Color.gray("Warn  - ") + msg),
  error: (msg) =>
    console.log(Color.red("● ●") + " " + Color.gray("Error - ") + msg),
  event: (msg) =>
    console.log(Color.cyan("● ●") + " " + Color.gray("Event - ") + msg),
  endpoint: (msg) =>
    console.log(Color.cyan("● ") + " " + Color.gray("Loaded: ") + msg),
};

export default logger;
