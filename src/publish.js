import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "./utils.js";

const LOGS_DIR = "./logs";
const LATEST_PATH = path.join(LOGS_DIR, "ta.latest.json");
const LATEST_TMP = LATEST_PATH + ".tmp";
const STREAM_PATH = path.join(LOGS_DIR, "ta.stream.ndjson");

let dirReady = false;

/**
 * Atomically writes `logs/ta.latest.json` and appends one line to
 * `logs/ta.stream.ndjson`.
 *
 * @param {object} snapshot — TA score payload (plain object, no circular refs)
 */
export function publishTaSnapshot(snapshot) {
  if (!dirReady) {
    ensureDir(LOGS_DIR);
    dirReady = true;
  }

  const json = JSON.stringify(snapshot);

  // Atomic write: tmp → rename so readers never see a partial file
  try {
    fs.writeFileSync(LATEST_TMP, json + "\n", "utf8");
    fs.renameSync(LATEST_TMP, LATEST_PATH);
  } catch {
    // ignore — best effort
  }

  // Append NDJSON line
  try {
    fs.appendFileSync(STREAM_PATH, json + "\n", "utf8");
  } catch {
    // ignore — best effort
  }
}
