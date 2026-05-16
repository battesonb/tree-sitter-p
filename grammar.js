/**
 * @file P is a state machine based programming language for formally modeling and specifying complex distributed systems.
 * @author Byron Batteson <byronbatteson@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "p",

  extras: ($) => [/\s/, $.line_comment, $.block_comment],

  word: ($) => $.identifier,

  conflicts: ($) => [
    // float literal: the optional leading int_literal conflicts with _primitive -> int_literal
    [$.float_literal, $._primitive],
    // identifier followed by '(' could be a fun_call_expr or just a _primitive
    [$.fun_call_expr, $._primitive],
  ],

  rules: {
    // -------------------------------------------------------------------------
    // Top level
    // -------------------------------------------------------------------------

    program: ($) => repeat($.top_decl),

    top_decl: ($) =>
      choice(
        $.type_def_decl,
        $.enum_type_def_decl,
        $.event_decl,
        $.event_set_decl,
        $.interface_decl,
        $.impl_machine_decl,
        $.spec_machine_decl,
        $.fun_decl,
        $.pure_decl,
        $.named_module_decl,
        $.test_decl,
        $.implementation_decl,
        $.global_param_decl,
        $.invariant_decl,
        $.invariant_group_decl,
        $.axiom_decl,
        $.assume_on_start_decl,
        $.proof_block_decl
      ),

    // -------------------------------------------------------------------------
    // Identifiers and literals
    // -------------------------------------------------------------------------

    identifier: (_) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    int_literal: (_) => /[0-9]+/,

    bool_literal: (_) => choice("true", "false"),

    null_literal: (_) => "null",

    string_literal: (_) => /"([^"\\]|\\.)*"/,

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    type: ($) =>
      choice(
        $.seq_type,
        $.set_type,
        $.map_type,
        $.tuple_type,
        $.named_tuple_type,
        $.primitive_type,
        $.named_type
      ),

    seq_type: ($) => seq("seq", "[", $.type, "]"),
    set_type: ($) => seq("set", "[", $.type, "]"),
    map_type: ($) =>
      seq("map", "[", field("key_type", $.type), ",", field("value_type", $.type), "]"),
    tuple_type: ($) =>
      seq("(", $.type, repeat(seq(",", $.type)), ")"),
    named_tuple_type: ($) => seq("(", $.iden_type_list, ")"),

    primitive_type: (_) =>
      choice("bool", "int", "float", "string", "event", "machine", "data", "any"),

    named_type: ($) => field("name", $.identifier),

    iden_type_list: ($) => seq($.iden_type, repeat(seq(",", $.iden_type))),
    iden_type: ($) =>
      seq(field("name", $.identifier), ":", $.type),

    fun_param_list: ($) => seq($.fun_param, repeat(seq(",", $.fun_param))),
    fun_param: ($) => seq(field("name", $.identifier), ":", $.type),

    // -------------------------------------------------------------------------
    // Declarations
    // -------------------------------------------------------------------------

    // TYPE foo ;
    // TYPE foo = type ;
    type_def_decl: ($) =>
      choice(
        seq("type", field("name", $.identifier), ";"),
        seq("type", field("name", $.identifier), "=", $.type, ";")
      ),

    // ENUM foo { ... }
    enum_type_def_decl: ($) =>
      seq(
        "enum",
        field("name", $.identifier),
        "{",
        choice($.enum_elem_list, $.numbered_enum_elem_list),
        "}"
      ),

    enum_elem_list: ($) => seq($.enum_elem, repeat(seq(",", $.enum_elem))),
    enum_elem: ($) => field("name", $.identifier),

    numbered_enum_elem_list: ($) =>
      seq($.numbered_enum_elem, repeat(seq(",", $.numbered_enum_elem))),
    numbered_enum_elem: ($) =>
      seq(field("name", $.identifier), "=", field("value", $.int_literal)),

    // EVENT foo : type ;
    event_decl: ($) =>
      seq("event", field("name", $.identifier), optional(seq(":", $.type)), ";"),

    // EVENTSET foo = { ... } ;
    event_set_decl: ($) =>
      seq(
        "eventset",
        field("name", $.identifier),
        "=",
        "{",
        $.event_set_literal,
        "}",
        ";"
      ),

    event_set_literal: ($) =>
      seq($.non_default_event, repeat(seq(",", $.non_default_event))),

    // INTERFACE foo(type) receives ... ;
    interface_decl: ($) =>
      seq(
        "interface",
        field("name", $.identifier),
        "(",
        optional($.type),
        ")",
        "receives",
        optional($.non_default_event_list),
        ";"
      ),

    // MACHINE foo receives/sends machineBody
    impl_machine_decl: ($) =>
      seq(
        "machine",
        field("name", $.identifier),
        repeat($.receives_sends),
        $.machine_body
      ),

    receives_sends: ($) =>
      choice(
        seq("receives", optional($.event_set_literal), ";"),
        seq("sends", optional($.event_set_literal), ";")
      ),

    // SPEC foo observes eventSet machineBody
    spec_machine_decl: ($) =>
      seq(
        "spec",
        field("name", $.identifier),
        "observes",
        $.event_set_literal,
        $.machine_body
      ),

    machine_body: ($) => seq("{", repeat($.machine_entry), "}"),
    machine_entry: ($) => choice($.var_decl, $.fun_decl, $.state_decl),

    var_decl: ($) => seq("var", $.iden_list, ":", $.type, ";"),

    iden_list: ($) =>
      seq($.identifier, repeat(seq(",", $.identifier))),

    // FUN declarations (3 alternatives)
    fun_decl: ($) =>
      choice($.foreign_fun_decl, $.p_fun_decl),

    // FUN foo(...) : type SEMI  (foreign)
    // FUN foo(...) : type CREATES iden SEMI  (foreign)
    // FUN foo(...) (RETURN (...))? requires* ensures* SEMI  (foreign with contracts)
    foreign_fun_decl: ($) =>
      seq(
        "fun",
        field("name", $.identifier),
        "(",
        optional($.fun_param_list),
        ")",
        choice(
          seq(
            optional(seq(":", $.type)),
            optional(seq("creates", field("interface", $.identifier))),
            ";"
          ),
          seq(
            optional(seq("return", "(", $.fun_param, ")", ";")),
            choice(
              seq(repeat1(seq("requires", $.expr, ";")), repeat(seq("ensures", $.expr, ";"))),
              seq(repeat(seq("requires", $.expr, ";")), repeat1(seq("ensures", $.expr, ";")))
            )
          )
        )
      ),

    // FUN foo(...) : type functionBody
    p_fun_decl: ($) =>
      seq(
        "fun",
        field("name", $.identifier),
        "(",
        optional($.fun_param_list),
        ")",
        optional(seq(":", $.type)),
        $.function_body
      ),

    // PURE foo(...) : type (= expr)? ;
    pure_decl: ($) =>
      seq(
        "pure",
        field("name", $.identifier),
        "(",
        optional($.fun_param_list),
        ")",
        ":",
        $.type,
        optional(seq("=", field("body", $.expr))),
        ";"
      ),

    // INVARIANT foo : expr ;
    invariant_decl: ($) =>
      seq("invariant", field("name", $.identifier), ":", field("body", $.expr), ";"),

    // LEMMA/THEOREM foo { invariant* }
    invariant_group_decl: ($) =>
      seq(
        choice(token(prec(1, "Lemma")), token(prec(1, "Theorem"))),
        field("name", $.identifier),
        "{",
        repeat($.invariant_decl),
        "}"
      ),

    // AXIOM expr ;
    axiom_decl: ($) => seq("axiom", field("body", $.expr), ";"),

    // init-condition expr ;
    assume_on_start_decl: ($) =>
      seq("init-condition", field("body", $.expr), ";"),

    // PROOF (name)? { proofBody }
    proof_block_decl: ($) =>
      seq(
        token(prec(1, "Proof")),
        optional(field("name", $.identifier)),
        "{",
        optional($.proof_body),
        "}"
      ),

    proof_body: ($) => repeat1($.proof_item),

    goals_all: (_) => "*",
    goals_default: (_) => "default",
    proof_item: ($) =>
      seq(
        "prove",
        choice(
          seq($.expr, repeat(seq(",", $.expr))),
          $.goals_all,
          $.goals_default
        ),
        optional(
          seq(
            "using",
            choice(
              seq($.expr, repeat(seq(",", $.expr))),
              "*"
            )
          )
        ),
        optional(
          seq("except", $.expr, repeat(seq(",", $.expr)))
        ),
        ";"
      ),

    // PARAM idenList : type ;
    global_param_decl: ($) =>
      seq("param", $.iden_list, ":", $.type, ";"),

    // -------------------------------------------------------------------------
    // States
    // -------------------------------------------------------------------------

    temperature_hot: (_) => "hot",
    temperature_cold: (_) => "cold",
    state_decl: ($) =>
      seq(
        optional("start"),
        optional(field("temperature", choice(
          $.temperature_hot,
          $.temperature_cold,
        ))),
        "state",
        field("name", $.identifier),
        "{",
        repeat($.state_body_item),
        "}"
      ),

    state_body_item: ($) =>
      choice(
        $.state_entry,
        $.state_exit,
        $.state_defer,
        $.state_ignore,
        $.on_event_do_action,
        $.on_event_goto_state
      ),

    state_entry: ($) =>
      seq(
        "entry",
        choice(
          $.anon_event_handler,
          seq(field("fun_name", $.identifier), ";")
        )
      ),

    state_exit: ($) =>
      seq(
        "exit",
        choice(
          $.no_param_anon_event_handler,
          seq(field("fun_name", $.identifier), ";")
        )
      ),

    state_defer: ($) =>
      seq("defer", $.non_default_event_list, ";"),

    state_ignore: ($) =>
      seq("ignore", $.non_default_event_list, ";"),

    on_event_do_action: ($) =>
      seq(
        "on",
        $.event_list,
        "do",
        choice(
          seq(field("fun_name", $.identifier), ";"),
          $.anon_event_handler
        )
      ),

    on_event_goto_state: ($) =>
      seq(
        "on",
        $.event_list,
        "goto",
        $.state_name,
        choice(
          ";",
          seq("with", $.anon_event_handler),
          seq("with", field("fun_name", $.identifier), ";")
        )
      ),

    non_default_event_list: ($) =>
      seq($.non_default_event, repeat(seq(",", $.non_default_event))),

    non_default_event: ($) => choice("halt", $.identifier),

    event_list: ($) => seq($.event_id, repeat(seq(",", $.event_id))),

    event_id: ($) => choice($.null_literal, "halt", $.identifier),

    state_name: ($) => field("state", $.identifier),

    // -------------------------------------------------------------------------
    // Function bodies and statements
    // -------------------------------------------------------------------------

    function_body: ($) => seq("{", repeat($.var_decl), repeat($.statement), "}"),

    statement: ($) =>
      choice(
        $.compound_stmt,
        $.assert_stmt,
        $.assume_stmt,
        $.print_stmt,
        $.return_stmt,
        $.break_stmt,
        $.continue_stmt,
        $.assign_stmt,
        $.insert_stmt,
        $.add_stmt,
        $.remove_stmt,
        $.while_stmt,
        $.foreach_stmt,
        $.if_stmt,
        $.ctor_stmt,
        $.fun_call_stmt,
        $.raise_stmt,
        $.send_stmt,
        $.announce_stmt,
        $.goto_stmt,
        $.receive_stmt,
        $.no_stmt
      ),

    compound_stmt: ($) => seq("{", repeat($.statement), "}"),

    assert_stmt: ($) =>
      seq("assert", field("assertion", $.expr), optional(seq(",", field("message", $.expr))), ";"),

    assume_stmt: ($) =>
      seq("assume", field("assumption", $.expr), optional(seq(",", field("message", $.expr))), ";"),

    print_stmt: ($) => seq("print", field("message", $.expr), ";"),

    return_stmt: ($) => seq("return", optional($.expr), ";"),

    break_stmt: (_) => seq("break", ";"),

    continue_stmt: (_) => seq("continue", ";"),

    assign_stmt: ($) => seq($.lvalue, "=", $.rvalue, ";"),

    insert_stmt: ($) =>
      seq($.lvalue, "+=", "(", $.expr, ",", $.rvalue, ")", ";"),

    add_stmt: ($) => seq($.lvalue, "+=", "(", $.rvalue, ")", ";"),

    remove_stmt: ($) => seq($.lvalue, "-=", $.expr, ";"),

    while_stmt: ($) => seq("while", "(", $.expr, ")", $.statement),

    foreach_stmt: ($) =>
      seq(
        "foreach",
        "(",
        field("item", $.identifier),
        "in",
        field("collection", $.expr),
        ")",
        repeat(seq("invariant", $.expr, ";")),
        $.statement
      ),

    if_stmt: ($) =>
      prec.right(seq(
        "if",
        "(",
        $.expr,
        ")",
        field("then_branch", $.statement),
        optional(seq("else", field("else_branch", $.statement)))
      )),

    ctor_stmt: ($) =>
      seq("new", $.identifier, "(", optional($.rvalue_list), ")", ";"),

    fun_call_stmt: ($) =>
      seq(field("fun", $.identifier), "(", optional($.rvalue_list), ")", ";"),

    raise_stmt: ($) =>
      seq("raise", $.expr, optional(seq(",", $.rvalue_list)), ";"),

    send_stmt: ($) =>
      seq(
        "send",
        field("machine", $.expr),
        ",",
        field("event", $.expr),
        optional(seq(",", $.rvalue_list)),
        ";"
      ),

    announce_stmt: ($) =>
      seq("announce", $.expr, optional(seq(",", $.rvalue_list)), ";"),

    goto_stmt: ($) =>
      seq("goto", $.state_name, optional(seq(",", $.rvalue_list)), ";"),

    receive_stmt: ($) =>
      seq("receive", "{", repeat1($.recv_case), "}"),

    no_stmt: (_) => ";",

    // -------------------------------------------------------------------------
    // Lvalues
    // -------------------------------------------------------------------------

    lvalue: ($) =>
      choice(
        $.var_lvalue,
        $.named_tuple_lvalue,
        $.tuple_lvalue,
        $.map_or_seq_lvalue
      ),

    var_lvalue: ($) => field("name", $.identifier),

    named_tuple_lvalue: ($) =>
      seq($.lvalue, ".", field("field", $.identifier)),

    tuple_lvalue: ($) =>
      seq($.lvalue, ".", field("field", $.int_literal)),

    map_or_seq_lvalue: ($) =>
      seq($.lvalue, "[", $.expr, "]"),

    // -------------------------------------------------------------------------
    // Event handlers
    // -------------------------------------------------------------------------

    recv_case: ($) =>
      seq("case", $.event_list, ":", $.anon_event_handler),

    anon_event_handler: ($) =>
      seq(optional(seq("(", $.fun_param, ")")), $.function_body),

    no_param_anon_event_handler: ($) => $.function_body,

    // -------------------------------------------------------------------------
    // Expressions
    //
    // Precedence (low → high, matching the ANTLR grammar order):
    //   LIFF < LTHEN < LOR < LAND < EQ/NE < relational/IN <
    //   ADD/SUB < MUL/DIV/MOD < unary < postfix/call < primary
    // -------------------------------------------------------------------------

    expr: ($) =>
      choice(
        $.primitive_expr,
        $.unnamed_tuple_expr,
        $.named_tuple_expr,
        $.paren_expr,
        $.named_tuple_access_expr,
        $.tuple_access_expr,
        $.test_expr,
        $.targets_expr,
        $.flying_expr,
        $.sent_expr,
        $.seq_access_expr,
        $.keyword_expr,
        $.ctor_expr,
        $.fun_call_expr,
        $.unary_expr,
        $.bin_expr,
        $.cast_expr,
        $.quant_expr,
        $.choose_expr,
        $.string_expr
      ),

    primitive_expr: ($) => $._primitive,

    unnamed_tuple_expr: ($) =>
      seq(
        "(",
        $.unnamed_tuple_body,
        ")"
      ),

    named_tuple_expr: ($) =>
      seq(
        "(",
        $.named_tuple_body,
        ")"
      ),

    paren_expr: ($) => seq("(", $.expr, ")"),

    named_tuple_access_expr: ($) =>
      prec.left(12, seq($.expr, ".", field("field", $.identifier))),

    tuple_access_expr: ($) =>
      prec.left(12, seq($.expr, ".", field("field", $.int_literal))),

    test_expr: ($) =>
      prec.left(11, seq(field("instance", $.expr), "is", field("kind", $.identifier))),

    targets_expr: ($) =>
      prec.left(11, seq(field("instance", $.expr), "targets", field("target", $.expr))),

    flying_expr: ($) => seq("inflight", field("instance", $.expr)),
    sent_expr: ($) => seq("sent", field("instance", $.expr)),

    seq_access_expr: ($) =>
      prec.left(12, seq(field("seq", $.expr), "[", field("index", $.expr), "]")),

    keyword_expr: ($) =>
      choice(
        seq(field("fun", choice("keys", "values", "sizeof")), "(", $.expr, ")"),
        seq(field("fun", "default"), "(", $.type, ")")
      ),

    ctor_expr: ($) =>
      seq("new", field("interface_name", $.identifier), "(", optional($.rvalue_list), ")"),

    fun_call_expr: ($) =>
      seq(field("fun", $.identifier), "(", optional($.rvalue_list), ")"),

    unary_expr: ($) =>
      prec.right(10, seq(field("op", choice("-", "!")), $.expr)),

    bin_expr: ($) =>
      choice(
        prec.left(9, seq(field("lhs", $.expr), field("op", choice("*", "/", "%")), field("rhs", $.expr))),
        prec.left(8, seq(field("lhs", $.expr), field("op", choice("+", "-")), field("rhs", $.expr))),
        prec.left(6, seq(field("lhs", $.expr), field("op", choice("<", ">", ">=", "<=", "in")), field("rhs", $.expr))),
        prec.left(5, seq(field("lhs", $.expr), field("op", choice("==", "!=")), field("rhs", $.expr))),
        prec.left(4, seq(field("lhs", $.expr), field("op", "&&"), field("rhs", $.expr))),
        prec.left(3, seq(field("lhs", $.expr), field("op", "||"), field("rhs", $.expr))),
        prec.left(2, seq(field("lhs", $.expr), field("op", "==>"), field("rhs", $.expr))),
        prec.left(1, seq(field("lhs", $.expr), field("op", "<==>"), field("rhs", $.expr)))
      ),

    cast_expr: ($) =>
      prec.left(7, seq($.expr, field("cast", choice("as", "to")), $.type)),

    quant_expr: ($) =>
      seq(
        field("quant", choice("forall", "exists")),
        optional(field("diff", "new")),
        "(",
        field("bound", $.fun_param_list),
        ")",
        "::",
        field("body", $.expr)
      ),

    choose_expr: ($) =>
      seq("choose", "(", optional($.expr), ")"),

    string_expr: ($) => $.formatted_string,

    formatted_string: ($) =>
      choice(
        $.string_literal,
        seq("format", "(", $.string_literal, optional(seq(",", $.rvalue_list)), ")")
      ),

    _primitive: ($) =>
      choice(
        $.identifier,
        $.float_literal,
        $.bool_literal,
        $.int_literal,
        $.null_literal,
        token(prec(1, "$$")),
        "$",
        "halt",
        "this"
      ),

    float_literal: ($) =>
      choice(
        seq(optional($.int_literal), ".", $.int_literal),
        seq("float", "(", field("base", $.int_literal), ",", field("exp", $.int_literal), ")")
      ),

    unnamed_tuple_body: ($) =>
      choice(
        seq($.rvalue, ","),
        seq($.rvalue, repeat1(seq(",", $.rvalue)))
      ),

    named_tuple_body: ($) =>
      choice(
        seq($.identifier, "=", $.rvalue, ","),
        seq($.identifier, "=", $.rvalue, repeat1(seq(",", $.identifier, "=", $.rvalue)))
      ),

    rvalue_list: ($) => seq($.rvalue, repeat(seq(",", $.rvalue))),
    rvalue: ($) => $.expr,

    // -------------------------------------------------------------------------
    // Module system
    // -------------------------------------------------------------------------

    named_module_decl: ($) =>
      seq("module", field("name", $.identifier), "=", $.mod_expr, ";"),

    mod_expr: ($) =>
      choice(
        $.paren_module_expr,
        $.primitive_module_expr,
        $.named_module,
        $.compose_module_expr,
        $.union_module_expr,
        $.hide_events_module_expr,
        $.hide_interfaces_module_expr,
        $.assert_module_expr,
        $.rename_module_expr,
        $.main_machine_module_expr
      ),

    paren_module_expr: ($) => seq("(", $.mod_expr, ")"),

    primitive_module_expr: ($) =>
      seq("{", $.bind_expr, repeat(seq(",", $.bind_expr)), "}"),

    named_module: ($) => $.identifier,

    compose_module_expr: ($) =>
      prec.left(seq("compose", $.mod_expr, repeat1(seq(",", $.mod_expr)))),

    union_module_expr: ($) =>
      prec.left(seq("union", $.mod_expr, repeat1(seq(",", $.mod_expr)))),

    hide_events_module_expr: ($) =>
      seq("hidee", $.non_default_event_list, "in", $.mod_expr),

    hide_interfaces_module_expr: ($) =>
      seq("hidei", $.iden_list, "in", $.mod_expr),

    assert_module_expr: ($) =>
      seq("assert", $.iden_list, "in", $.mod_expr),

    rename_module_expr: ($) =>
      seq("rename", field("old_name", $.identifier), "to", field("new_name", $.identifier), "in", $.mod_expr),

    main_machine_module_expr: ($) =>
      seq("main", field("main_machine", $.identifier), "in", $.mod_expr),

    bind_expr: ($) =>
      seq(field("m_name", $.identifier), optional(seq("->", field("i_name", $.identifier)))),

    // TEST declarations
    test_decl: ($) =>
      choice($.safety_test_decl, $.refinement_test_decl),

    safety_test_decl: ($) =>
      seq(
        "test",
        optional(seq("param", field("global_param", $.param))),
        optional(seq("assume", field("assume_expr", $.expr))),
        optional($.twise),
        field("test_name", $.identifier),
        "[", "main", "=", field("main_machine", $.identifier), "]",
        ":",
        $.mod_expr,
        ";"
      ),

    refinement_test_decl: ($) =>
      seq(
        "test",
        field("test_name", $.identifier),
        "[", "main", "=", field("main_machine", $.identifier), "]",
        ":",
        $.mod_expr,
        "refines",
        $.mod_expr,
        ";"
      ),

    implementation_decl: ($) =>
      seq(
        "implementation",
        field("impl_name", $.identifier),
        optional(seq("[", "main", "=", field("main_machine", $.identifier), "]")),
        ":",
        $.mod_expr,
        ";"
      ),

    twise: ($) =>
      choice(
        "pairwise",
        seq("(", $.int_literal, "wise", ")")
      ),

    param: ($) => seq("(", $.param_body, ")"),

    param_body: ($) =>
      seq(
        $.param_binding,
        repeat(seq(",", $.param_binding))
      ),

    param_binding: ($) =>
      seq(field("name", $.identifier), "in", field("value", $.seq_literal)),

    seq_literal: ($) => seq("[", $.seq_literal_body, "]"),

    seq_literal_body: ($) =>
      seq($.seq_primitive, repeat(seq(",", $.seq_primitive))),

    seq_primitive: ($) =>
      choice(
        $.bool_literal,
        $.int_literal,
        seq("-", $.int_literal)
      ),

    // -------------------------------------------------------------------------
    // Comments
    // -------------------------------------------------------------------------

    line_comment: (_) => token(seq("//", /.*/)),

    block_comment: (_) =>
      token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
  },
});
