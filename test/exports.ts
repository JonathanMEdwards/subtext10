import { Workspace } from "../src/exports";

// constants for dump of boolean choices
export const no = { no: null }
export const yes = { yes: null }
export const off = { off: null }
export const on = { on: null }

/** Compile a workspace from source */
export function compile(source: string) {
  return Workspace.compile(source);
}

/** Compile and dump at a location to plain JS object */
export function expectDump(source: string, at = '') {
  return expect(compile(source).dumpAt(at));
}

/** Test compiler exceptions */
export function expectCompiling(source: string) {
  return expect(() => compile(source));
}

/** Test array of static errors */
export function expectErrors(source: string) {
  return expect(compile(source).editErrorMessages);
}
