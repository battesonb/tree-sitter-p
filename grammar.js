/**
 * @file P is a state machine based programming language for formally modeling and specifying complex distributed systems.
 * @author Byron Batteson <byronbatteson@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "p",

  rules: {
    // TODO: add the actual grammar rules
    source_file: $ => "hello"
  }
});
