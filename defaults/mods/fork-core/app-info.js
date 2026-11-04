// The fork's appInfo(), feature-detected. Stock Herdr has no appInfo export: a named import of a missing export fails
// the whole module, so it is read off the namespace and stock gets null (no version line, nothing throws).
import * as herdr from "herdr";
import { versionLine } from "./sections-pure.js";

export function appVersion() {
  if (typeof herdr.appInfo !== "function") return null;
  try { return versionLine(herdr.appInfo()); } catch { return null; }
}
