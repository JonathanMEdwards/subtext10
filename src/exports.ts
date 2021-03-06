/**
 * @module exports
 *
 * This module controls module loading order to break cycles
 * Thanks to https://medium.com/visual-development/how-to-fix-nasty-circular-dependency-issues-once-and-for-all-in-javascript-typescript-a04c987cf0de
 *
 * Doesn't work with create-react-app's webpack config
 *
 * There are also reports that webpack tree-shaking breaks this
 */
export * from "./util";
export * from "./tokenize";
export * from "./parser";
export * from "./path";
export * from "./item";
export * from "./value";
export * from "./base";
export * from "./reference";
export * from "./container";
export * from "./block";
export * from "./metadata";
export * from "./head";
export * from "./history";
export * from "./code";
export * from "./try";
export * from "./choice";
export * from "./workspace";
import { Workspace } from "./workspace";
export * from "./builtins";
import { builtinDefinitions } from "./builtins";
import { arrayBuiltinDefinitions } from "./array";
export * from "./array";
export { edit } from "./edit";

/** builtin workspace to be included into other workspaces */
export const builtinWorkspace = Workspace.compile(
  builtinDefinitions + arrayBuiltinDefinitions,
  false
);