# The Subtext Programming Language

> This is a mix of explanations for the target audience of non-programmers and connections to existing theory for the experts. Reframe as “Subtext for Computer Scientists”: explicitly define the user conceptual model in terms of standard teminology.

> End-user/non-technical programming may still be out of reach - reframe goal as small-scale app dev? Programming in the long tail

Subtext is searching for the missing link between spreadsheets and programming. It is an interactive medium for data processing by people who don’t want to learn how to program.  For example, scientists who want to process data without becoming “data scientists”. Or people who want to build simple custom apps without learning to program. Spreadsheets primarily fill this role, but they have significant limitations. The goal of Subtext is to merge the power of programming with the simplicity of spreadsheets, without inheriting all the complexity of modern programming.  That said, there is indeed a programming language at the foundation of Subtext. This document specifies that language through examples as a way to solicit feedback from other researchers.

Subtext tries to be simple, transparent, and informal:
1. Simple — easy to learn and easy to use.
2. Transparent — the history of user interaction and program execution are visible in complete detail.
3. Informal — doesn’t require abstraction, premeditation, or mathematical/computational thinking.
Subtext rejects:
1. Low level, high performance, or large scale software — being extreme in any dimension.
2. Requiring knowledge of existing software technology and practices beyond using a browser.
3. Appealing to the tastes of professional programmers or computer scientists.

These goals require changing not just the programming language but the entire programming experience. Much of this experience is still just a vision — this document discusses the language design decisions we have made to enable that vision, but without being able to go into much detail about what the experience will actually be. Nevertheless we must say a few things up front. Many programming languages presume that the programming experience is a text editor. Subtext instead provides an interactive environment with structured editing offering high-level code transformations, and live execution. As such, a complete textual representation would need to be a serialization format not well suited to manual editing. We will defer these concerns by assuming that all of the examples in this document are compiled into a fresh Subtext workspace and not subsequently edited. Also note that the ASCII syntax presented herein may diverge significantly from what the developer sees on screen, where we can exploit graphics, typography, and layout. For example, the curly brackets around blocks may render as rectangular regions; comments and labels may render in the margins. But syntax still matters, as it is the most effective way to communicate the design of the language in papers, which are still the primary medium of research. Syntax is also highly effective for testing and bootstrapping. As such, we have tried to keep the syntax reasonably readable and credibly usable.

> Discussion of design alternatives will be placed in notes like this.

## Notable features

This section summarizes the notable programming language features of Subtext.

* The traditional terminology of programming languages and software development is rejected in favor of plain English. We continue to use traditional terminology in this section.
* Subtext specifies how to pronounce its syntax.
* Code and data are combined into an autonomous artifact called a workspace which provides reproducibility, collaboration, version control, and schema change. A workspace changes both through direct manipulation by users and executing code within the workspace.
* Everything is nestable: programs, databases, and workspaces can all be nested inside each other. A Subtext workspace is a tree.
* All inputs and sources of randomness are recorded in the workspace history to make it autonomous and reproducible.
* Subtext is both a PL and a DB: data is either persistent and transactional, or deterministically computed from such persistent data.
* What a user can do by direct manipulation of data and what code can do when executed are similar. The recorded history of user interactions and external inputs is in fact a program that can replay that history, or be used as raw material for Programming by Demonstration.  Conversely, a program can be understood as a script that a user could follow to perform the same operations. The language syntax and semantics have been designed to make these connections as direct as possible. For example, the syntax for replacing a value at a path within a tree, which looks like an assignment statement, is used to record user edits in the history.
* Functional and imperative semantics are combined in a novel way, via
  bidirectional functions. In the forward direction function are are strict,
  pure, and referentially transparent. But the backward direction offers a
  highly restricted form of imperative programming which has nice safety and
  composition properties. See (_Feedback_).
* Function execution is materialized as data, completely visible to the programmer using the same UI as for data. Materialized execution takes the LISP idea that _syntax is data_ and applies it to semantics: _execution is data_. Straight-line code is a record, loops are lists, and conditionals are discriminated unions. Calling is inlining.
* Materialized execution has an unconventional semantics: rather than seeing functions as _reducing to results_, they are seen as _expanding to traces_.
* One IF to rule them all: there is a single mechanism of conditionality: partial functions which either return a result or reject their input. Inspired by SNOBOL, this single mechanism provides conventional control structures, backtracking logic, pattern matching, assertions, and data invariants.
* Functions are not abstract entities, defined in one place then used in others. Instead functions, sometimes represented as formulas, compute a result from concrete inputs. Any such computation can be reused, with a conventional-looking call syntax, optionally replacing its input values. All functions are continuously executing on concrete input values. Functions can be edited live, immediately seeing the execution results, as in a spreadsheet.
* Calling a function is materialized as inlining a copy of it. Lexical closures fall out of the way that relative paths within a subtree are mapped through copies.
* Functions can _export_ extra results, which do not need to be deconstructed at the call site as in conventional approaches. The exports of a function typically form a record. Exports of conditional clauses are combined into a discriminated union. Exports of a loop are collected into a list.
* Subtext is statically (parametrically) typed, but types are not mentioned in the language nor error messages. Concrete values serve as witnesses of types.
* Lists are homogeneously typed. Lists of records serve as a table.
* Lists can be tracked by automatically assigning hidden unique IDs to their items. Tracking supports stable links into lists that act like database foreign keys with referential Integrity maintenance. Tracking also supports precise workspace versioning and merging.

### Intentionally excluded features

* Separate compilation
* Subtypes, interfaces, typeclasses (but maybe traits)
* First-class functions (generics are enough)
* The stack and the heap (and garbage collection)

## Introduction to workspaces

The artifact that Subtext mediates is called a _workspace_. It is somewhat like a spreadsheet (e.g. Excel) in that it presents both data and formulas in a visual metaphor that is easy to learn. It is somewhat like a notebook (e.g. Jupyter) in that it offers the full power of a programming language. These artifacts are characterized by their geometry: a notebook is a linear sequence of cells; a spreadsheet is a 2-dimensional grid of cells; A Subtext workspace is a tree of nested cells called _items_. There are many types of items, explained in the following:

- Items are a holder for a value of some type
- An item is either a _base value_, a _block_, or an _array_
- There are several kinds of base values: numbers, characters, times, images, etc. Base values do not contain any other items, and occupy the bottom of the workspace tree
- Blocks and arrays are assembled from other items, called their contents. They differ on how the contents are organized.
- A block contains a fixed set of items, like conventional records, structs, or objects. Each item has a fixed type of value. Often the items of a block are given unique names, but when used as intermediate computations they may be left anonymous. The top item of a workspace is a _head_ block. The _history_ of a workspace is a block containing heads.
- An array contains a variable number of items all of the same type in a linear order, like conventional lists. _Text_ is an array of _characters_. An array of blocks is called a _table_.

The tree structure of Subtext workspaces strikes a balance: they are more flexible and dynamic than the grid of a spreadsheet, yet simpler and more visualizable than the graph-structured data of imperative programming languages. They are somewhat like the tree-structured values of functional programming languages, except that:

- Items (called _inputs_) can be changed by the user and functions.
- Items (called _outputs_) are calculated by formulas from the state of other items in the workspace. They are automatically recalculated as those items change, but they cannot be directly changed themselves.
- Items (called _interfaces_) are calculated like outputs but can also be changed like inputs, with the changes feeding back to other items.
- The same structures are used to represent data and functions (as in LISP), but they also represent the execution of functions for inspection by the developer.
- There are cross-references within the tree. Cross-references can be dynamic only to the extent of selecting different items within a specific array — other than that, cross-references are static.

Subtext is statically typed, which conventionally means that the code and the types of values are fixed at _compile time_ and do not vary at _run time_. But there is no such thing as compile time in Subtext workspaces, which are always running and fully editable with their state stored persistently in a file. Subtext distinguishes between two kinds of changes: modifying data and editing the definitions of code and data. It is possible to lock a workspace so that only data modifications are allowed — this is called _user mode_. In user mode data changes are highly constrained: data types are fixed. For example a number can’t be changed into text, and a newly created item in an array will have the same type as all the others. Only certain kinds of errors can occur in user mode. In _programming mode_ anything can be changed, which can lead to various sorts of inconsistencies called _static errors_, corresponding to the errors a traditional compiler might report. Static errors are reported to the programmer as problems in the workspace to be resolved, but unlike compiled languages, the workspace continues to function outside the implicated parts.

Although Subtext is statically typed in the above sense, there is no mention of types in the language syntax or error messages, because concrete values serve as witnesses of their types (see _Types_).

## Base values
Subtext provides several kinds of values out of which a workspace is built:

- _Number_: double float using JavaScript syntax, and the special value `###` not equal to any other number (except itself)
- TODO: infinite precision rationals
- _Text_: JavaScript string literal using single quotes: `'hello'`
- _Character_: a unicode character, using a literal of the form `character'a'`
- `nil`, the unit value, useful in enumerations (see _Choices_)
- `anything`, the top value used to define generic functions (see _Types_)
- TODO: fancy text with fonts and formatting
- TODO: date-times and calendars
- TODO: media (MIME-typed blobs)

There is no basic Boolean value in Subtext. Instead there is a builtin choice (See _Choices_) that defines global constants `yes` and `no`.

> Of course a language for scientific computing must support units of measure. Except that the popular ones don’t! This is a solved problem, and we should add units as soon as we can.

## Blocks, formulas, and functions

One way a Subtext workspace is constructed is with a _block_ (the other is an _array_) . A block contains a fixed set of items with (optional) names. Blocks are defined in the syntax with curly brackets preceded by a keyword indicating the kind of block. Blocks are used for both data and functions. A common data block is the _record_, which is like a struct or object in other languages, and like a row in a relational databases. For example:
```
b: record {
  x: 0
  y: record {
    i: 0
    j: 1
    k: 2
  }
}
```
This record contains two items, one named `x` which has the value `0`, and one named `y`, whose value is a nested record with numeric items named `i` and `j` with values `0` and `1` respectively. The names of the items within a block must be different. When we _refer_ to nested items we use a _path_ like `b.y.i`.

The subtext UI offers two views of any item: as a single _line_ or as a multi-line _outline_. The above syntax example approximates what an outline looks like in the UI, except there are no curly brackets. An outline uses indentation to show nesting of blocks. The corresponding single-line representation looks like the following syntax, where brackets indicate nesting and semicolons separate items:
```
b: record {x: 0; y: record {i: 0; j: 1; k: 2}}
```
The UI lets you flip between line and outline presentations.

### Inputs and outputs
Every item is either an _input_ or _output_ (or an _interface_, to be discussed later in Feedback). For example,
```
record {
  x: 0
  y = x + 1
}
```
The item `x` is defined as an input by being followed with a colon, whereas `y` is defined as an output by being followed by an equals sign. As an input, `x` can be updated by the user or code.  As an outputs, `y` is not updatable — it is automatically computed from the value of `x`. Note that the UI will display the computed value of `y` on a line underneath it.

This is like a spreadsheet: cells containing a formula are outputs, and cells containing just values are inputs. But unlike a spreadsheet, input cells also have formulas (`0` in this example) which compute the _initial value_ of the cell. Unlike in spreadsheets, new items are often dynamically created, and so their inputs need to be given some initial value, which can be computed with a formula. In function blocks, the initial value of inputs serve as convenient default values. Input formulas execute once when the block is created, whereas output formulas execute whenever anything they depend on changes.

Note that the terms input and output mean different things in computational notebooks like Jupyter, where an input is a formula and the paired output is its value. Notebooks do not let the user directly edit a value as can be done with non-formula cells in a spreadsheet and input items in Subtext.

Subtext specifies how to pronounce its syntax. The above example syntax is pronounced “record of x as 0, y equal to x plus 1”. A `{` is pronounced “of”, `:` is pronounced “as”, and `=` is pronounced “equal to” or “equals”. Note that, unlike many programming languages, `=` means the same thing as in mathematics — the left and right sides have the same value. The ':' means the left hand side originally had the same value as the right-hand side.

> The distinction between `:` and `=` may be too subtle, but we haven’t come up with a better alternative.

### Formulas
In the item definition `y = x + 1` the part to the right of the `=` is called a _formula_. A formula contains literal values like `1` and _references_ to items elsewhere in the workspace like `x` and `+`. They can _call_ functions, like `+`, which is the built-in function that adds numbers. Functions have one or more inputs and produce a result value. The function `+` is _called_ by first, making a copy of it, then changing its inputs to the values of `x` and `1`, and then taking its result as the value of `y`. The two references here are just names, but in general they can be paths (see Reference binding).

> In PL terminology, Subtext functions are pure, strict, and referentially transparent.

The formula `x + 1` uses so-called _infix notation_, where the function reference `+` is placed between the input values `x` and `1`. Many programming languages allow infix notation only as a special case for arithmetic operations like `+`, but in general use notation borrowed from mathematics: `function(formula1, formula2)` where the inputs to the program, possibly complex formulas, come afterwards in parentheses, in the proper order, separated by commas. Subtext always uses infix notation, but adds parentheses to allow complex formulas and more than two inputs, as follows:
```
formula1 function()
formula1 function literal
formula1 function reference
formula1 function(formula2)
formula1 function(formula2, .input3 := formula3)
```
Every function has at least one input. In a call the first input is the value of the formula to the left of the reference to the function. A function may have more than one input, but only the first input must be supplied in a call — the extra input items have an initial value that serves as a default. A call supplying only the first input puts empty parentheses `()` after the function reference. Conventional infix notation can be used when only the first and second inputs are used, and the second input is a literal or reference, as in `x + 1`. If the second input is instead a more complex formula it must be put in parentheses, for example in `x +(y * 2)`.

When a call supplies the third or later input of a function, shown in the last case above, the name of the input item is specified with the syntax `.input3 := formula3`, like the _keyword arguments_ in some languages. The design philosophy behind these conventions is that many programs have one or two inputs, and it is natural to read infix notation like an Object-Verb-Subject construct in English, not to mention the familiarity of infix notation in math. But when there are  more than two inputs, it is better to name their roles explicitly.

Formulas evaluate strictly left-to-right, which can violate the rules of arithmetic precedence. For example the formula `1 + 2 * 3` is equal to 6, not 7 as we have been taught. This becomes clearer if we use parentheses: `1 +(2) *(3)`. For that reason the UI will always fill in parentheses in program calls, but fade them out when they contains a single value, so that they still resemble the familiar parentheses-free infix notation, but hopefully still look different enough to break the expectations of arithmetic precedence. We retain the parentheses-free syntax because that is the expectation of this document’s audience of experienced programmers.

### `do` blocks
Formulas are used when an item is formatted as a line, but when we format it as an outline the formula is revealed as a `do` block. For example,
```
y = x + 1 * 2
// is equivalent to
y = do {
  x
  + 1
  * 2
}
```
Like all blocks, a `do` block is an array of items, which we call _statements_. In this example there are three statements, one per line, and they are output items whose value is calculated from their formula. Unlike in previous examples, these are anonymous outputs, lacking a name and the following `=`.

The first statement is just a reference to `x` but the last two statements are calls without a preceding input value: `+ 1` and `* 2`. In that case the value of the previous statement is used as the left input. We can see this as the value of statements flowing downward from the result of one formula into the start of the next formula. The result is the bottom value, which becomes the value of `y`. Note how this downward dataflow corresponds exactly to the rightward dataflow in the formula `x + 1 + 2`, with the result being the final value on the right. Thus data flows in formulas from left to right, and in outlined blocks from top to bottom. This matches the reading order of English prose.

A formula is a single-line representation of a `do` block, but it will only look like an array of infix calls when the `do` block follows the pattern shown above: an array of anonymous outputs with the first being a literal or reference and the following ones single calls without a  preceding value. Anything else will use the general notation for blocks in a line, with brackets and semicolons. For example, if we had named one of the items:
```
y = do {
  x
  incremented = + 1
  * 2
}
// is equivalent to
y = do {x; incremented = + 1; * 2}
```

There are two advantages of using outlines over single lines. First, a large outline can be more readable than a very long line. Secondly, the UI shows the values computed for each output on an extra line below them, as in computational notebooks like Jupyter. Thus outlining an item turns the formula into a nested “mini-notebook” showing every step of the computation.

> We might want to make vertical dataflow more explicit by using `that` at the beginning of formulas, as in:
```
y = do {
  x
  that + 1
  that * 2
}
```
> Or possibly `^`, figuratively pointing up at the value being used.
```
y = do {
  x
  ^ + 1
  ^ * 2
}
```
> The UI may add annotations indicating vertical dataflow, so we will defer elaborating the syntax until that is explored.

### Defining functions
A function is defined by a `do` block with input items. For example:
```
plus = do {
  x: 0
  y: 1
  x + y
}
```
When this function is called, as in `1 plus 2`, the value on the left, 1, becomes the value of the first input item, named `x`. The value 2 becomes the value of the second input item, named `y`, resulting in:
```
do {
  x: 1
  y: 2
  x + y
}
```
The value of the last item, 3, becomes the result of the call.

> (possible support for implicit inputs) We can abbreviate functions with just one input. For example:
> ```
> 0
> increment = with{+ 1}
> ```
> Here the 0 preceding the definition of `increment` serves as the default input value to the function. When `increment` is called, the previous value will be inserted as the first statement. This abbreviation is especially convenient with array functions, like `find`, that automatically supply a default previous value, saving the duplication of specifying it explicitly.

> There is another abbreviation for defining functions. For example,
> ```
> increment2 = 0 + 1
>
> ```
> can be called like the prior example. Note this is equivalent to:
> ```
> increment2 = do {
>   0
>   + 1
> }
> ```
> The first statement of the `do` block is not an input, but neither does it use the previous value as `increment` does. In this case, the first statement is treated as the input of the function. In other words, the input to a call of `increment2()` will replace the first value (0) of the formula

> Possibly this is too subtle, and it might be better to first refactor a formula to have an explicit input item that allows it to be called. For example `0 + 1` could be refactored into `do{in:0; + 1}` to make it callable.

> As a result of these abbreviations, every item is a function that can be called elsewhere. This design avoids premature abstraction. In most languages before code can be reused it must first be abstracted out into a separate definition, and replaced with a call to that definition. In Subtext every item’s definition can be reused elsewhere.

Note that, unlike other languages, a function is not a separate entity or value — it is always the formula defining an item, not the actual value of the item. In the prior example,
```
plus = do {
  x: 0
  y: 1
  x + y
}
```
the value of `plus` is just 1, the result of executing the function, not a special kind of value representing a function. When we call the program, as in `1 plus 1` what we are really doing is reusing the function that defines the value of `plus` with different inputs.

> In fact functions really are “first-class” values, but they are only used in the UI and planned meta-programming capabilities.

### Updating blocks

So far all of the examples have used arithmetic. But it is very common to work with blocks, particularly records,  as they are the rows of tables. Take the record:
```
x: record {
  name: ''
  age: 0
}
```
This block contains two input items: `name`, which is an initially empty text, and `age`, which is initially the number `0`.

The essential operations on a block are to read and update individual items. We read the items using paths, like `x.name` and `x.age`. To update an item we use the symbol `:=`, called an _update_.
```
x with{.name := 'Joe'}
```
This is pronounced “x with name updated to Joe”. The result is a record equal to the value of `x` except with the item `name` having it’s value updated to `'Joe'` (keeping the prior value of `age`). We used a `with` block to contain the update operation, which is like a `do` block except that it feeds the previous value into a list of operations, rather than starting with a value. The equivalent `do` block would be:
```
do{x; .name := 'Joe'}
```

> It would be possible to allow the syntax `x.name := 'Joe`. But that is dangerous. The lexical binding of the first name in the path establishes the context of the modification. Prefixing a name to resolve lexical shadowing would thus change the semantics.

We can chain multiple updates together:
```
x with{.name := 'Joe'; .age := 30}
```
Note how `.age :=  30` applies to the result of the previous update.

The `:=` operation passes the current value of the left hand side as an input to the expression on the right side. Thus for example `y = x with{.age := + 1}` will increment the value of the `age` field.

Updates can drill into nested records by using a dotted path to the left of the `:=`
```
x: record {
  name: ''
  age: 0
  address: record {
    street: ''
    city: ''
}
y = x with {
  .address.street := '12 Main St'
  .address.city := 'Springfield'}
```
Instead of useing dotted paths, we can equivalently nest `with` blocks:
```
y = x with {
  .address := with {
    .street := '12 Main St'
    .city := 'Springfield'}}
```

Updates cannot be done on output items (those defined with `=`), only inputs (defined with `:`) and interfaces (defined with `=|>` — see Feedback).

Recall that `:=` is also used when supplying the third or later inputs when calling a function. This is not a coincidence. For example:
```
ternary-function = do {
  input1: 0
  input2: 0
  input3: 0
  ...
}
x = 1 ternary-function(2, .input3 := 3)
```
The syntax `.input3 := 3` is actually an update on the `do` block of `ternary-function`. It changes the value of the `input3` input item to 3. The same thing happens with the second input, which is interpreted to mean `.input2 := 2`.

### Unused values

 Often  in `do` blocks values will flow downward from one item to the next, as in:
```
x = do {
  1
  + 2
}
```
This flow is interuppted when an formul starts with a value rather than a function call, as in:
```
x = do {
  1
  + 2 // unused value
  3
}
```
The `+ 2` item will be reported as an _unused value_ error.  However it is not an error if the item is named and referenced elsewhere, as in:
```
x = do {
  1
  i = + 2
  3 / i
}
```

### Local variables

Inside a block an output item can be used to name an intermediate computation and then reference it by name later. This is called a _local variable_ in some languages. As we have seen, it is common in `do` blocks for values to flow downward from one item to the next. Local variables can break this flow, so there is special output qualifier `let` that lets the previous value flow over it:
```
...
let foo = ... // compute something from previous value to be used later
// pass on value preceding the let statement
```
This avoids having to invent a name:
```
temp = ...
let foo = temp ...
temp ...
```
A `let` item is hidden from references outside the block. However it must be referenced by name within the block (or nested code blocks), otherwise it will be reported as an unused value error


### Exports

The result of a function is the value of the last item. However we often would like to get extra results from a function. For example, integral division would like to produce not only the integral ratio but also the fractional remainder as well. We allow extra values to be _exported_ from a function. For example:
```
integral-divide = do {
  numerator: 1
  divisor: 1
  ratio = numerator /(divisor) floor()
  export remainder = numerator -(ratio * divisor)
}
x = 5 integral-divide 3  // 1
y = x~remainder // 2
```

Skipping to the definition of `x`, we see that it calls the function `integral-divide` as follows:
1. A copy of the `do` block of `integral-divide` is made
2. Its input item `numerator` becomes `5`
3. Its input item `divisor` becomes `3`
4. The output item `ratio` is calculated to be 1 using the `floor` function to round-down the division
5. The remainder is exported with the name `remainder`
6. The `export` statement acts like a `let`, passing on the previous value, so `ratio` becomes the final result of the function.
7. After the call, the item `y` references `x~remainder`, which imports the export `remainder` produced in the computation of `x`. We pronounce `x~remainder` as “x import remainder”.

What is going on here is that `x~` imports the exported value of the function that computed the value of `x`. A `do` block exports a record containing the values of all the `export` statements. The export `remainder` can be accessed as `x~.remainder`, or `x~remainder` for short. We also could have equivalently said `y = ~remainder` to import the export of the previous item without naming it.

Note that in the example above, `x` is defined as `x = 5 integral-divide 3`, which is equivalent to the `do` block: `x = do {5; integral-divide 3}`. There are no `export` statements in this `do` block. In that case, if the last statement (the call to `integral-divide`) has an export then it is exported from the whole do-block. That allows us to say `x~remainder`. You can also declare a single value to be the export of the entire block explicitly with a statement `export ...` that does not name the result, and which is only allowed if there are no other `export` statements in the block. This when there are no `export` statements, there is an implicit `export ~` at the end of the block re-exporting the exports of the final statement.

### Reference binding

The syntax uses conventional _lexical binding_, but the UI will not be constrained by that, nor subject to lexical shadowing. References starting with `.`, `~`, `[]` or `that` are said to be  _dependent_ on the previous value.

> When the UI lets the developer make references that can’t be expressed lexically, we might want to automatically fix that by adding names to anonymous items and renaming shadowed items.

> References could support “search paths” like `x…y` that look for a `y` item that is reachable via any path from `x`. Likewise `…y` would look for any path to `y` from any containing scope. In these examples it is an error if there is more than one path leading to `y`. A possible exception to this rule is when all the paths go through alternative cases of a choice or clauses of a conditional, and further that they lead to items of the same type. If not all of the cases or clauses are covered then the path must be conditionalized like `…y?`. This feature gives us a convenient way to extract alternative information from choices and conditionals. Search paths might be intolerably fragile in a textual language, but an IDE can automatically repair them. In fact the reference editor in the IDE will provide all reachable paths of the right type, offering “… completion” rather than just “. completion”.


## Conditionals

To make decisions, most languages use constructs like `if (boolean) then {…} else {…}`. Subtexct is different. Whenever a function (or formula) is evaluated, exactly one of the following things will happen:

1. The function crashes. A crash indicates a programming error, not a user error: some condition has arisen that ought to be impossible. A crash is reported to the workspace developer, including a snapshot of the workspace that can reproduce the crash. No changes are made to the workspace when an input event (including user actions) causes a crash. Sometimes crashes can be predicted ahead of time when formulas are being edited (for example type mismatches). These are called static errors and are presented to the developer as problems to be fixed. Unlike conventional compiler errors, static errors do not prevent the system from running, so long as the erroneous formula is not used.
2. The function is terminated before it completes because it has taken too long or used too many resources. See Termination.
3. The function completes successfully, producing a result value.
4. The function intentionally _rejects_ without producing a result. Rejection means the function refuses to handle the input values supplied to it. Rejection is inspired by [SNOBOL](https://en.wikipedia.org/wiki/SNOBOL), which calls it _failure_, as do many parsing DSLs. We call it rejection rather than failure to make clear it is intentional, not a programming error (a crash).

If a function may reject it is called _conditional_, a function that never rejects is called _unconditional_. The name of a conditional function has a question mark appended to it. For example, the equality function `=?` tests whether two values are equal, rejecting if they aren’t. It is called like this: `x =? y`. You can tell that a function is conditional by the presence of a `?` inside it, which indicates a point where it may reject.

By convention, comparison functions like `=?` and `<?` will result in their right-hand input value when they succeed,  so that they can be chained, as in `x <? y <? z`. But often conditionals are executed only to test whether they reject, and their result is not otherwise used. To help avoid programming mistakes, it is considered an error to produce a value that is not used. To indicate that a value is not intended to be used, an output item can start with `check`. That will also pass on the value of the previous item as with `let`. In most situations, conditional functions should be called in a `check` formula. For example:
```
// incorrect
do {
  x >? 0    // error: unused value
  x even?() // error: unused value
  x + 1
}

// correct
do {
  check x >? 0
  check even?()
  x + 1
}

// passing values through check
x do {
  check >? 0
  check even?()
  + 1
}

```

> An alternative to prefixing `check` (and `let`) is suffixing `\`.

> Maybe comparisons like `=?` and `>?` ought to return their input value not argument. Chaining is a special case, whereas cascading operations on the input is more frequent.

> Maybe a not-operator: `\=?` `\=!` that complements semantics: rejects or crashes on success, succeeds on a rejection and returns input value (another reason to make that normal semantics)

Only output items can be conditional, not input items, which would introduce problematic _null_ values. See _Blank values_ for further discussion of alternative techniques.

When a function rejects, what happens depends on the kind of block it is inside. Inside a `do` block (and other function blocks to be introduced later), rejection halts further execution, and causes the whole function block to reject. What happens next depends on the kind of block containing that block — if it is also a `do` block then the rejection continues to propagates into the containing block. This proceeds until the rejection reaches one of several kinds of block that handle rejections, for example the `try` block.  Rejection is like \_exception catching\_ in conventional languages, except that it is the single kind of exception supported, and it carries no extra information visible to the function.

A `try` block is a function that can respond to a rejection by doing something else — it fills the role of the ubiquitous _IF_ statement in conventional languages. Here is an example:
```Txt
polarity = do {
  n: 0
  try {
    check n <? 0
    'negative'
  } else {
    check n =? 0
    'zero'
  } else {
    'positive'
  }
}
x = 1 polarity() // = 'positive'
```

A `try` block contains `do` blocks called _clauses_, separated by the `else` keyword. The first clause is executed, and if it succeeds its result becomes the result of the entire `try` block, skipping all the other clauses. But if the first clause rejects, then the second clause will be executed, and if it succeeds it supplies the result of the `try` block and skips the rest. Successive clauses are executed until one succeeds. The results of all the clauses must be the same type of value, otherwise it is a static error (except maybe this isn’t an error for `check try`)

If none of the clauses succeeds the `try` block crashes. This is considered a programming error: a `try` block must exhaustively test all possible cases.  _In the future we will try to infer exhaustiveness statically, but for now it is a dynamic check._ To reject instead of crashing, the statement `else reject` can be placed at the end of the `try` block. For example:

```Txt
rgb? = do {
  color: ''
  try {
    color =? 'red
  } else {
    color =? 'green'
  } else {
    color =? 'blue'
  } else reject
}
'yellow' rgb?() // rejects
```
This function take text as input and tests whether it is red, green, or blue, rejecting otherwise. Note that because of the final `else reject` we know that the `rgb?` function is conditional, and so has a question mark, whereas the prior example `polarity` could not reject, and thus was unconditional.

A `try` block can take an input value on the left, and will pass it as the input to each of the clauses. Thus we could rewrite the above example as:
```Txt
rgb? = '' try {
  =? 'red
} else {
  =? 'green'
} else {
  =? 'blue'
} else reject

'yellow' rgb?() // rejects
```

An alternative kind of conditional is an `optionally` block:
```Txt
absolute-value = do {
  n: 0
  optionally {
    check n <? 0
    negate()
  }
}
```
The `optionally` block is like a `try` block, except that if none of the clauses succeed, the input value becomes the result (which must be the same type of value as the results of the clauses). An `optionally` block is a shorthand for adding an empty clause at the end of a `try` block, which acts like the identity function: `try {...} else {}`.

> `try {...} else reject` could be instead `try? {...}`. Likewise `optionally {...}` could be just `try {...}`. To crash on incompleteness, `try! {...}`. This design is more consistent with the way other conditional forms are handled, but it may be too subtle.

> We could generalize rejection to exceptions. A function could throw a specific type of error value when rejecting. We could add `on-error` clauses to `try`. But multiple errors in a block would need to be somehow unioned together. In OO this is done by subclassing Error. Zig has a special error enum that is implicitly defined across the whole-program. We aren’t ready yet to deal with polymorphism, so exceptions are deferred.


### Boolean operations
Subtext does not use Boolean Algebra like conventional languages do. The standard Boolean operations can be done with `try` blocks instead. Here is the recipe for writing boolean operations:
```
// a? OR b?
try {
  check a?
} else {
  check b?
} else reject

// a? AND b?
check a?
check b?

// not a?
not {a?}
```

The `not` block evaluates its contents, rejecting if they succeed, and succeeding if they reject (in which case the input value into the `not` is passed on).
Note that `not` is a block, as is `try`. Only blocks catch rejections.

> But it might be convenient to allow `not` and `assert` qualifiers, like `check`, capturing rejects in the statement’s formula without the need for extra curly brackets.

### Assertions and tests
The `assert` block converts a rejection into a crash. This is used to detect situations that should be impossible and which therefore indicate a programming error. For example
```Txt
assert {x =? y}
```
will crash if `x` and `y` are unequal.

An assertion can also be made by replacing any `?` with a `!`. The above example is equivalent to:
```Txt
check x =! y
```

A `test` block is used for unit tests:
```Txt
test {
  1 polarity() =? 'positive'
}
```
All `test` blocks in the workspace are executed after programmer edits that could affect them. If a rejection occurs inside the test block then it is treated as a static error, which is a problem for the programmer to resolve, but does not prevent the workspace from being used.


## Choices

A `choice` block defines a set of named input items called _options_, exactly one of which is _chosen_. The options can be different kinds of items, as in all blocks. Choices are called _discriminated unions_ and _sum types_ in conventional languages. Here is an example:
```Txt
expr: choice {
  literal?: 0
  plus?: record {
    left: expr
    right: expr
  }
}
```
The `expr` item can choose to be a `literal?` with a numeric value, or it can choose to be a `plus?`, with a value as a record containing items `left` and `right`, both of which are recursively another `expr` value. Choices always initially choose the first option (which can’t recurse so as to prevent infinitely deep values).

The names of the options have a question mark, because accessing them is conditional on their being chosen. For example `expr.literal?` will provide the numeric value of the `literal?` item if it is currently chosen by `expr`, but will reject if it isn’t chosen.

Choices are made with the _choice operation_ `#`. For example:
```Txt
a-literal = expr #literal(1)
```
This is pronounced “a-literal equals expr choosing literal of one”. The `#` expects a choice value on its left (`expr`) and to its right the name of an option without the question mark (`literal`), followed by a parenthesized formula resulting in a value for the option. The value can be just `()` to use the default value of the options (0 in the case of `literal`):
```Txt
a-literal = expr #literal()
```

Note that `#` always initializes the chosen option to its originally defined value, even if it was already chosen and had a different value. Likewise, the optional expression to the right of the option will be given a source value that is that initially defined value of the option. Thus for example `#literal(+ 1)` will always result in 1.

The fact that `#` expects a choice value means that the type of the choice can be inferred from the context. For example when a function argument is a choice:`background-color(#red())` will choose the initial value of the `red` option of a choice argument. This avoids the need in many languages to redundantly say something like `backgroundColor(Color.red)`.

### Enumerations
Sometimes there is no value of interest to associate with an option — we want it to indicate just that we made the choice. This is called an _enumeration_ in many languages. We use the special value `nil` in this case:
```Txt
color: choice {
  red?: nil
  blue?: nil
  green?: nil
}
```
The value `nil` is called a _unit value_ in some languages: it contains no information, and is the sole value within its datatype. As such `nil` options are chosen without supplying a value:
```Txt
color #red()
```

Traditional Boolean values are replaced by a choice defined as:
```Txt
no = choice {
  no?: nil
  yes?: nil}
yes = no #yes()
```
Thus, for example, if you define `x: no` then you could change it with `x := yes` and can test it with `x ==? yes` or just `x.yes?`.

In the UI, yes/no values are displayed with a checkbox or switch. There is an alternative form of Boolean choice defined with the options `off` and `on` which are displayed as a push button, and are typically used to trigger effects (see _Feedback_).

The function `flip()` will accept any binary choice and flip it’s chosen option.

> Maybe when a choice is input to a `try` we should force the clauses to test each option. Then we can easily statically detect exhaustiveness, and also automatically add cases when needed.

### Pattern matching

Languages with sum datatypes like `choice` often also provide specialized syntax for _pattern matching_. A `try` block combines with choices to provide pattern matching without additional syntax and semantics:
```Txt
eval-expr = do {
  x: expr
  try {
    x.literal?
  } else {
    x.plus?.left eval-expr() +(x.plus?.right eval-expr())
}
```

Here the first try clause accesses the `literal?` option. If it was chosen, its numeric value becomes the result. But if `plus?` was chosen, then the first clause will reject and the second will execute instead, recursively evaluating the `left` and `right` items of the `plus?` option and then adding them together. We get pattern matching “for free” because accessing an option makes the entire containing try clause conditional on that option having been chosen.




## Arrays and tables

So far we have discussed various kinds of blocks. The other way data is combined is with an  _array_. An array is an ordered set of zero or more items containing values of the same fixed type. A _text_ is an array of characters. A _table_ is an array of records, where each record is called a _row_, and each of the fields of the record is called a _column_. Every array defines a value, called it’s _template_, which defines the default value for newly created items. For example:
```
numbers: array {###}
customers: table {
  name: ''
  address: ''
}
```
The array `numbers` contain numbers, defaulting to the blank number `###`. The table definition `customers: table {...}` is equivalent to `customers: array {record {...}}`. The table contains columns `name` and `address` defaulting to the empty text. The template of an array is access by using empty square brackets, as in `numbers[]`.

The `&` function (pronounced “and”) is used to add items to an array. For example:
```
n = numbers & 1 & 2 & 3
c = customers &(with{.name := 'Joe', .address := 'Pleasantown, USA'})
```
The `&` function takes an array as it’s left input and an item value as its right input, resulting in an array equal to the input plus a new item with that value. The default value of the item is the array template. In a table it is often convenient to use a `with` block as above to update some of the columns and let the others default to their template values. A shorter way of doing `&(with{...})` is with the &-block: `&{...}`, making the last example equivalent to:
```
c = customers &{.name := 'Joe', .address := 'Pleasantown, USA'}
```

The `&&` function concatenates two arrays: `array1 && array2` is a copy of `array1` with all the items from `array2` added to its end. The two arrays must have the same template.

The items in an array are numbered starting at 1 for the first item. This number is called the item’s _index_. The number of items in an array (not counting the template) is provided by the `length()` function. An array is initially created empty.

An item in an array can be accessed using square brackets:
```
n = numbers & 1 & 2
check n[1] =? 1
check n[2] =? 2
```
The square brackets will cause a crash if an invalid index is supplied. To instead test that the index is valid, append a `?`:
```
check n[m]? =? 1
```

The first and last items can be accessed with `first?()` and `last?()`, which will reject if the array is empty. The function `only?()` will return the only item in the array or reject.

Items in an array can be updated by using square brackets on the left of a `:=` modification:
```
n = numbers & 1 & 2
test {
  m = n with{[1] := 3}
  check m[1] =? 3
  check m[2] =? 2
}
```
The square brackets can be part of a path to update individual fields of a row:
```
test {
  c = customers with{[1].name := 'Joe Jr.'}
  check c[1].name =? 'Joe Jr.'
}
```
The square brackets above will crash if the array index is invalid. Append a `?` to instead test whether the index is invalid: `check n[i]? =? 3`

We can delete an item in an array with the `delete?` function, which results in an array with that item removed, rejecting if the index is invalid:
```
array delete? i
```

Text is an array of characters with the space character as the template, so `''` is equivalent to `array{character' '}`.

### Columns
A column of a table is an array containing the contents of one of the record fields from each row. The columns of a table are accessed using `.` as if the table was a record containing the columns. For example:

```
t = do {
  table {
    name: ''
    amount: 0
  }
  & with{.name := 'joe', .amount := 100}
  & with{.name := 'jane', .amount := 200}
}

test {
  check t.amount[1] =? 100
  check t.amount sum() =? 300

  u = t with{[1].amount := 150}
  check u.amount sum() =? 300

  // replacing whole column
  v = t with{.amount := array{0} & 10 & 20}
  check v[1].amount =? 10
}
```
A column  can only be updated with an array of the same length as the table, otherwise it will crash. In a tracked tabled (see below) no insertions, deletion, or moves can have happened in the column.

When a table column is conditional, meaning the corresponding block item is a conditional output, then the column will skip all items where the item rejected.

### TODO: Sorted arrays

Normally, items are added to the end of an array. But an array can be defined as _sorted_, which means the items will be automatically kept in order of increasing value, or _reverse sorted_, which keeps then in order of decreasing value. Tables, whose items are blocks, use lexicographical (dictionary) ordering, where the first column is the most significant. Thus
```
customers: sorted table {
  name: ''
  address: ''
}
```
will order the rows alphabetically by name, and duplicate names by address. An array can be converted into one with the same items but sorted differently with the functions `sorted()` `reverse-sorted()` `unsorted()`.

When an array is not sorted, new items can be inserted at any position using:
```
array insert(item, at: i)
```
where 1 ≤ `i`  ≤ length + 1. The new item will then have the index `i`. An item already in the array can be moved using:
```
array move(i, at: j)
```
where 1 ≤ `j` ≤ length + 1.

Two arrays are considered equal by the `=?` function when they have the same number of items with equal values in the same order, and their templates are equal, and they are sorted and tracked the same. These constraints are necessary to preserve the property that calling a function with equal inputs produces equal results, specifically the `&` function creating new items.

> Maybe we need `currently=?` to compare ignoring the values of the templates and sorting/tracking, which only affect new insertions.


### TODO: Reordering arrays


### Searching

A `find?` block searches in an array:
```
joe = customers find? {.name =? 'Joe'}
```
The `find?` block is executed like a `do` repeatedly with items from the array as its input value, starting with the first item and continuing until it does not reject. The result is the first non-rejected item, with `~index` equal to the index. If all the items are rejected, the entire `find?` rejects (hence the suffix `?`). A `find!` block does the same thing, except it crashes if the find fails.

Note that in this example the block contains no input item — the input is referenced implicitly with `.name ...`. If we outline it in the UI we will see that one is created automatically to display the input value:
```
joe = do {
  customers
  find? {
    item: [] // inserted automatically
    .name =? 'Joe'
  }
}
```
The code is defined to input from the array template, and in each iteration that input item will become a successive item of the array. You can define the input item explicitly, so long as it refers to the template value as `[]`. _The UI will auto-insert these input items into search and loop blocks._

A `find-last?` does the same thing as `find?` except that it scans the table backwards. A `find-sole?` succeeds if there is exactly one match, and rejects if there are none or more than one.

### Iterating

A `for-all` block will evaluate a `do` block on each item of an array in order, resulting in an unsorted array of the results. The block cannot be conditional. This is like the _map_ function of functional programming languages.

A `such-that` block will remove from the source array any items which the following conditional block rejects. The result will be the same type as the source and maintain its sorting. This is like the _filter_ function of functional programming languages.

`all?` and `all!` are like `such-that` except that if one of the array items is rejected they will reject or crash respectively. `none?` and `none!` check that all of the items are rejected. Both `all` and `none` result in the source array if they succeed.

```
test {
  l = array{###} & 1 & 2 & 3

  // update each item with result of block on it
  l for-all{+ 1} =! (array{0} & 2 & 3 & 4)

  // filter out rejected items
  l such-that{check not=? 2} =! (array{0} & & 3)

  // check every item satisfies a condition
  check l all?{>? 0}

  // check no item satisfies a condition
  check l none?{<? 0}
}
```

> We could combine `for-all` and `such-that` into `for-those` that maps and filters at the same time. That initially seemed more elegant, and showed off a benefit of rejection semantics, but was taken out because 1) to filter you must be careful to map the items through unchanged, so the conditional tests need to be done with a `check`, and 2) if the template is rejected, which is normal in filters, we lose the ability to feedback creations


### Accumulating

An `accumulate` block is used to accumulate a result by scanning an array.
```
array{###} & 1 & 2
accumulate {
  item: []
  sum: 0
  item + sum
}
check =? 3
```
An `accumulate` block must define two input items. The block will be executed repeatedly, like a `for-all`, feeding items from the input array into the first input item. The first item (named `item` in this example) must be an input referencing the template value with `[]`. The second input (`sum`) acts as an accumulator. On the first call it defaults to the defined value (0). On the second and subsequent calls, `sum` becomes the result of the previous call. This example is equivalent to the built-in `sum()` function that sums an array of numbers. An `accumulate` is  like a conventional _fold_ function, except that the accumulator value is defaulted in the definition instead of being supplied explicitly by the caller (though that is still possible, for example `sum(100)` starts the accumulator at 100).

> If an item is rejected, should it be skipped, or stop the accumulation?

### Queries

A _query_ is a formula that calculates an array from one or more other other arrays. This includes the `for-all` and `such-that` functions, which operate on a single array. Queries get more complicated when we want to combine multiple tables.  For example, take these two tables:

```
customers: do{
  table{customer-id: ###, name: ''}
  &{.customer-id:= 1, .name := 'John'}
  &{.customer-id:= 2, .name := 'Jane}
}
orders: do{
  table{order-id: ###, customer-id: ###, item: ''}
  &{.order-id:= 1, .customer-id:= 1, .item := 'widget}
  &{.order-id:= 2, .customer-id:= 1, .item := 'fidget}
}
```

To see the orders for each customer,  we can use:
```
customers for-all{
  extend{their-orders = orders such-that{.customer-id =? customer-id}}
}
```

The new feature used here is the `extend`block, which takes a record (a `customer` row) and appends all the fields in a record definition to it (the single field `their-orders`). So this appends `their-orders` to each customer. The value of `their-orders` is a table containing all the orders for that customer, which is computed by `orders such-that{.customer-id =? customer-id}`.  Note in this expression the difference between `.customr-id` and `customer-id`. The former refers to the `customer-id` of an order supplied by the `such-that`. The latter refers to the `customer-id` of a customer supplied by the `for-all`. There is no `.` preceding the latter reference, because the `extend` gives all the extending fields direct access to the source fields being extended. technically speaking, extend is lexically scoped within the source record, similarly to the way OO languages extend classes.

The result of this query is equal to:
```
table{customer-id: ###, name: '', their-orders =
  table{order-id: ###, customer-id: ###, item: ''}
}
&{.customer-id:= 1, .name := 'John', their-orders :=
  &{.order-id:= 1, .customer-id:= 1, .item := 'widget}
  &{.order-id:= 2, .customer-id:= 1, .item := 'fidget}
}
&{.customer-id:= 2, .name := 'Jane}

```
> A screen shot or nested table layout would be much nicer

Note that this query does not use a _join_ as in a relational database. Joins multiply tables together to produce a table each of whose rows contains fields from the input tables in multiple possible combinations. This can get confusing because data gets duplicated throughout the result, but it is hard to see exactly what is a duplicate of what. Tracking these duplications is the subject of the theory of _Functional Dependencies_, which you don’t want to have to understand. Subtext takes a different approach, combining tables by nesting them inside each other, reducing the amount of duplication, and making the necessary duplication explicit. This also allows the results to be updated: see _Updatable Queries_.

The above example shows how to combine tables when they have fields that relate to each other, called a _foreign key_. Foreign keys often are found in data imported from external sources. For data defined inside a Subtext, there are better alternatives. See _Selections_ for a better alternative to foreign keys. Often the simplest solution is to just define nested tables, for example:

```
customers: table{
  customer-id: ###
  name: ''
  orders: table{
    order-id: ###
    item: ''}}
```
Here the orders of a customer are created inside the customer record. This explicitly defines the structure implied by the foreign keys, which needed to be computed by a query.

> Queries are a central research problem (especially making them updatable), but they may become a specialized advanced feature given selections and the ability to refactor foreign keys into selections


### Tracked arrays

An array can be _tracked_ by prefixing its definition with `tracked`, as in
```
tracked array{###}
tracked table{name: '', address: ''}
```

A tracked array automatically assigns a unique ID to each item when it is created. The ID is used to precisely track changes to the item. Such IDs are called _surrogate keys_ in databases. The tracking ID is hidden from the user and programmer. Tracking allows three important capabilities:

1. Relationships between tracked arrays can be established, similar to _foreign keys_ in relational databases, but without requiring that every item contain a unique and immutable key. See Links.
2. A tracked array can be versioned and merged, similar to version control systems like git, except more precisely. See Merging.
3. A query over tracked arrays can be updated, with the changes feeding back into the source arrays. This is called an _updatable view_ in databases. See Query update.

Tracked tables eliminate the need for the ubiquitous “id” fields in relational databases. The example used in the prior section on queries can be defined simply as:
```
customers: table{name: '', orders: tracked table{item: ''}}
```

Two tracked arrays are equal if their items are not only equal but also were created in the same relative order, including all items that were deleted. Tracked equality means that the arrays not only have the same current state but also the same history of inserts and deletes.

> Tracked arrays could offer sorting by creation time, and creation-time could be used to order duplicates in an array sorted by value.

> The IDs in a tracked array are implemented as monotonically increasing serial numbers within the array, as in an _auto-increment_ item in a relational database. The serial number is not exposed to the user or programmer, so that merging may automatically renumber items.

### Selections and links

Selections allow one or more items in a tracked array or table to be chosen by the user or a program. They replace the use of _pointers_ and _references_  and _sets_ in conventional programming languages. For example:

```
customers: tracked table{name: '', age: ###}
prime-customers: selection{customers}
top-customer: one selection{customers}
```

The field `prime-customers` can select 0 or more customers. The UI will show a selection as a list of customer names, with a drop-down arrow to present a menu of  customer names with check-boxes next to them to change the selection. The field `top-customer` is limited to selecting just one customer, so the UI will  instead use “radio buttons” that enforce this constraint. For more details on this and other selection constraints see _Selection constraints_.

When a selection is defined, as in `selection{customers}`, the curly brackets must contain a reference to an array. That array is called the selection’s _backing array_.  Two selections are equal if they have the same backing array and select the same items in it. The backing array of a selection can not be changed: it is fixed at compile time. Selections on different backing arrays are incompatible, so it is a static error to compare them or update one with the other.

Programs can change selections with the `select?` and `deselect?` functions, which take as input a selection and produce a selection that adds or removes the indicated item. Their argument is an index in the backing array, and they reject if that is an invalid. The `selecting` block is like a `such-that` block, except that it takes a selection as input and produces a selection on the same backing array selecting those items not rejected by the code block, for example:
```
selection{customers} selecting{.age >? 21}
```

Selections define several fields.

1. The `.selections` field contains an array of the selected items from the backing array, as in `prime-customers.selections`.
2. The `.at?` field is useful for single selections like `top-customer`, as it returns the single selected item, and rejects if there is not exactly one selected item.
3. The `.indexes` field is a sorted array of the indexes of the selected items in the backing array.
4. The `.backing` field is a copy of the backing array, so `prime-customers.backing` will be a copy of `customers`.
5. Note that `.selections`, `.at?` and `backing` are updatable (see _Updating selections_)

Selections are only for tracked arrays, so they can track the selected items through changes to the backing array. Modifying, inserting, or reordering items will not change which items are selected. Deleting an item from an array will remove it from all selections, but not affect the selections of other items.

When a selection is inside a table it allows each row of the table to pick one or more rows of some other table. This replaces the use of _primary keys_ and _foreign keys_ in relational databases to establish such relationships. Recall the example in _Queries_:
```
customers: table{customer-id: ###, name: ''}
orders: table{order-id: ###, customer-id: ###, item: ''}
```
 the keys can be replaced with a selection between tracked tables:
```
customers: tracked table{name: ''}
orders: tracked table{customer: selection{customers}, item: ''}
```

Often when there are relationships between tables we want to see them from both sides: not just the customer of an order, but also all the orders of a customer. Relational databases offer us queries to answer that question. Instead Subtext lets you define selections on both sides that mirror each other, called _links_. For example:

```
customers: tracked table{
  name: ''
  their-orders: link{orders via customer}}
orders: tracked table{
  customer: link{customers via their-orders}
  item: ''}
```

Links are selections that are defined in matching pairs as fields of tracked tables. Each defines the table and field of the other, and each link automatically mirrors the selections of the other. So for example, when the `their-orders` link selects a row of `orders`, the `customer` link will automatically select that customer. On the other hand, if the `customer` link in an order selects a customer, the `their-orders` field of the customer will select that order. Thus there is no need to do a query to find all the orders for a customer: it is provided as a table in `their-orders.selections`


#### TODO: selection constraints

Note that since `customer` has a `one` rule, selecting a different customer will de-select the previous customer, which in turn deselects the order from that customer’s `their-orders` link. … `complete`




## Feedback

Up to this point we have discussed workspaces that operate much like a spreadsheet. The user can directly edit the values of input items, and the output items will be recalculated from the changed input values. What we lack is any way for the workspace to makes changes to itself, or have any effect outside the workspace. Another way of stating this is that so far these workspaces are _purely functional_: the outputs are calculated from the inputs and nothing else happens. The standard way to escape this limitation is to allow programs to freely modify data anywhere at any time. But this freedom quickly leads to chaos. Making sure that the right things change at the right time becomes very complex and error-prone as programs evolve and combine. Professional programmers have developed many advanced techniques to live with this difficulty — however the goal of Subtext is to avoid needing such expertise.  Subtext instead offers a simpler and more restricted way to make changes, called _feedback_. Feedback has restrictions that limit the chaos, and make it easier to see and understand what is happening.

Feedback starts with a third type of item: in addition to inputs and outputs there are _interfaces_. Interfaces are like outputs in that their value is automatically calculated from a formula, but they are also like inputs in that they can be directly changed by the user (and by other interfaces, as we will see). The simplest example of an interface is a formula that can execute both backwards and forwards, as in this temperature converter:
```
c: 0
f =|> c * 1.8 + 32
```
Note that `=|>` is used to define `f` as an interface. This means the user can edit the value of `f` just like they can edit the input `c`. A change to `f` is run through the formula backwards to update the value of `c`. Updating `f` to 212 will change `c` to 100.

Not all formulas can execute backwards like this — we will discuss the limitations in a moment. When we can’t or don’t want to execute a formula backwards we can instead specify exactly how to handle updates with an `on-update` block. The previous example is equivalent to:
```
c: 0
f =|> c * 1.8 + 32 on-update{write - 32 / 1.8 -> c}
```
When the interface `f` is updated, the `on-update` block is evaluated instead of trying to run the formula backwards. The updated value of `f` is passed into the `on-update` block, which then executes a `write` statement, which can only be used inside `on-update` blocks. The `write` statement evaluates `- 32 / 1.8` starting with the updated value of `f`, and then updates `c` with the result.  Since the update formula is equivalent to running the output formula backwards, we get the same effect on `c`.

Note that an `on-update` block looks like a _callback_ in many conventional languages, but it is quite different because it is _static_: it is fixed in the definition of the formula and therefore known at compile time. There is no way to dynamically associate callbacks with interfaces at runtime.

Also note that a `write` looks like _pointer assignment_ in many conventional languages, but it is actually highly restricted in order to know at compile time what it does. Subtext does not have dynamic pointer values as in standard imperative languages. The target of a `write` is static: it must be a reference to a writable location that is fixed at compile time, allowing only variability of indexing within an array. Another way of stating this restriction is that the target of a write can only vary dynamically between array siblings and cousins within the worskspace tree. This restrtiction lets us know at compile time the possible effects of a write more precisely than with conventional pointers. There are additonal major restrictions on the effects of a write that will be explained below.

### Interfaces can be unstable

In both of the prior examples after the change to `f` has fed back into a change to `c`, a new value of `f` will be calculated from the new value of `c`. In these cases the new value of `f` is always the same as the value it was updated to. These are called _stable_ interfaces. But not all interfaces are stable. Some formulas are not stable (for example squaring a number), and even if the formula is stable, it may depend on other items which have also changed. An `on-update` block can easily cause instability by mangling the value, as in:

```
c: 0
f =|> c * 1.8 + 32 on-update{write 0 -> c}
```
which will react to any change to `f` by setting `c` to `0` which then makes `f` = 32. Now that is a pretty useless example. Here is a more useful unstable interface:

```
count: 0
button =|> off on-update{write count <- + 1}
```
The `button` interface is set to `off`, which is a builtin binary choice (the other option being `on`) that is represented in the UI as a push button. Clicking the button changes the value to `on`, which triggers the `on-update` block, which increments `count`. The `button` interface is unstable because oit always reverts back to `off`, making it a “push button” that pops back out when pressed.

### Change is unequal

In the button example above we used a value that can be either `off` or `on`, and changed it from `off` to `on` to “press” the button. What if we changed it from `off` to `off`, as in `write button <- #off()`? Nothing would happen — the write would be ignored. Changes must change a value, otherwise they are ignored. This is an important principle, because it lets us aggregate changes. For example:

```
customers table{name: '', phone: ''}
new-customer =|> off on-update{write customers <- &()}
```

When the `new-customer` button is pressed we create a new item in the `customers` table. The `&()` function takes the current state of the customer table and results in a new table containing a new customer. The `write` then replaces the old value of the entire table with this newer bigger one. But since none of the prior customers were changed, we can safely ignore all those writes, and just add the new customer to the existing table. In fact we know this at compile time, so we can avoid doing any equality comparisons at runtime, and optimize to just performing an insertion. This is more than just a performance issue, because `customers` might have been an interface that would trigger on-update blocks whenever a customer changes (what databases call an _update trigger_).

The benefit of this approach is that we don’t need a special language feature that lets us insert into a table like a write statement. Many languages offer two ways to do things: a _purely functional_ way like the `&` function that returns a whole new value, and a _mutable_ way that lets you change an existing value “in place” like JavaScript’s `Array.push()`. Subtext has the single `write` statement that lets you turn any functional change into a mutation, based on the fact that writes only pay attention to changes in values, which is helped by the language tracking what values can possibly have changed. From this perspective, mutating APIs are a premature optimization that a smart language can do automatically.

### Feedback is interactive

Our examples so far have all been triggered by user actions. In general, change comes from the world external to the workspace, in the form of user actions, incoming network packets, or clock ticks. _There will be one exception to this rule: free-running processes called tasks._  Subtext records all external events as changes to the value of an input or interface. Changes to an interface propagate to other interfaces and inputs either by executing formulas in reverse or `on-update` blocks. The entire process of responding to external changes, called _feedback_, is governed by a number of rules. One of these rules is that feedback is quick — you can not perform large computations during feedback, as that would make the workspace unresponsive. Another rule is that feedback is _transactional_ : if one of several kinds of error occurs (to be discussed later) then the workspace is left unchanged.

### Feedback is definite

Another rule of feedback is that `write` statements can not interfere with each other. When a write is made to some location in the workspace, no other writes can occur at that location during the current feedback transaction. Possibly interfering writes are detected at compile time, and not allowed to execute at all. For example, this is illegal:
```
button =|> off on-update{
  write count <- + 1
  write count <- * 2
}
```
If we want to make a sequence of changes like this we must instead chain the formulas into a single write statement like `write count <- + 1 * 2`.

A more interesting case is this:
```
button =|> off on-update{write count <- + 1}
button2 =|> off on-update{write count <- + 1}
ganged-button =|> off on-update{
  write button <- on
  write button2 <- on
}
```
Here `ganged-button` triggers both `button` and `button2`. But they both change `count`, so this is illegal. Note that it is fine to have multiple interfaces that might conflict — it is only an error to change them within the same feedback transaction, as `ganged-button` does. Accordingly the user interface only lets the user push one button at a time.

Writes to array items conflict as if they were writing to the same item. For example:

```
a: array{0} & 1 & 2
i: 1
j: 2
button =|> off on-update{
  write a[i] <- 0
  write a[j] <- 0
}
```
this is an error because there is no guarantee that `i` and `j` are different. Even if we changed it to `i = 1, j = 2` the language isn’t \_currently\_smart enough to know they are different. One solution would be to sequence the updates as in:
`write a <- with{[i] := 1, [j] := 2}`
which will overwrite the value of `[i]` if `i` = `j`.

Another solution is:
`write a <- merge!(with{[i] := 1}, with{[j] := 2}}`
which checks at runtime that there is no conflict, crashing if there is. You can instead use `merge?` to reject on a conflict. The `merge` functions do a three-way merge, combining the differences between the source value and the two argument values. The unqualified `merge` function (without `!` or `?`) uses the same conflict rules as `write`, guaranteeing at compiled time there is no conflict. There is also a `merge-over`function that lets the second argument overwrite the changes of the first. Note that the `merge` functions work on arbirarily large values, up to an entire workspace, and in fact that is how workspace versions are merged.

### Feedback goes backwards

Since writes can not conflict, an interface can only be triggered once per feedback transaction, and the set of writes between interfaces forms a directed acyclic graph. To guarantee this property a simple rule is enforced: writes must go backwards. Technically this means backwards in the pre-ordering of the workspace tree structure, but that equates to the simpler rule that writes must refer to something defined earlier in the textual definition of the workspace. So this is illegal:

```
button =|> off on-update{write count <- + 1} // forward write error
count: 0
```

> Theoretically we could allow forward writes so long as they statically form a DAG, but physically ordering them is much simpler to implement and explain, and the error messages are more actionable.

> It would be consistent to disallow forward references in formulas. However that would disallow mutually recursive functions, unless we add some special feature to support them.

Feedback starts with a single write to an interface, and can cascade backwards through other interfaces, finally resulting in a set of writes to inputs that not inside an interface or a code block. Such inputs are called  the _state_ of the workspace: they record the data values from which everything else in the workspace is derived.

### Feedback is oblivious

Feedback does not see the consequences of changes, only the state of the workspace at the beginning of the feedback transaction. For example:

```
button =|> off on-update{
  change: that
  assert{change.on?}
  assert{button.off?}
  let temp = count
  write count <- + 1
  assert{count =? temp}
}
```

The value of `change` must be `on`, because changes must change the current value and the only other possible value is `on`. But the `button` field still seen in its prior state `off`. Likewise the write to `count` doesn’t appear to have changed its value. This is because code running in an `on-update` block only sees the state of the workspace as it was at the beginning of the current feedback transaction. External inputs and internal writes are held separate until the succesful completion of the entire feedback. Until then, the only place these changes are visible is where they are passed as the input to an `on-update` block.

### Reverse execution
Recall the reversible temperature convertor:

```
c: 0
f =|> c * 1.8 + 32
```

When an interface does not have an `on-update` block then changes to the interface are pushed backwards thgrough its formula. We can see this better by reformulating the example as:
```
c: 0
f =|> do {
  c
  * 1.8
  + 32
}
```
A change to `f` will be written first to the bottom expression `+ 32` which calls the `+` function. Many functions like `+` are updatable, meaning that you can write a changed value to their result and they will emit a write to their source. The `+` function is equivalent to:
```
plus = do{
  source: 0
  and: 0
  source + and
  on-update {
    change: that
    write source <- change - and
  }
}
```
Note that this simply does the inverse of addition, which is subtraction. In the case of the call `plus 32` what happens is that the changed value has 32 subtracted from it and is written back to the source of the call. The source of the call is the previous statement in the original formula: `* 1.8` which will likewise divide the value by `1.8` and write it to the previous statement, which is a reference to `c`, which writes the change to `c`.

Updatable functions always write back to their source (except for a few special cases to be noted). Updatable functions treat their other arguments as read-only, and see their values as of the start of the feedback transaction. So feedback proceeds through a formula from bottom-up and right-to-left, the reverse of its execution order. Indeed one of the reasons for choosing chained infix operations in Subtext was that it defines a clear reverse order of execution.

> example where this breaks: `x * x`. In futuer this will be a static error. Show reversible `square` function.

A `try` block executes in reverse following the same rules. A write to the result of a try block is written to the result of the clause that produced it: the first satisfied clause. The choice made by a try clause remains frozen in its state prior to the feedback transaction, the same as all the formulas inside it.

There is one important case where reverse execution is not strictly linear: the update operator `:=`. For example:
```
s: 'foo'
r: record{
  x: ''
  y: 0
}
t =|> r with {.x := s}
```
Any change made to the interface `t` will feedback into the update expression `.x := s`. Say the user modified the field `t.x` to be `'bar'`. Then `'bar'` will get written back to `s`, where it came from. But if the user had modified `t.y` the change will pass through to `r.x`, where it came from. Thus `:=` can feedback changes in two directions.

### Updating selections and links

Selections and link provide views of their backing array in the fields `.backing`, `.selections`, and `.at?`, containing respectively the entire backing array, an array of the selected backing items, and the single selected backing item. All three of these views can be updated, with the updates feeding back into the backing array.

Links are mirrored pairs of selections between tables: updating a link on one side will update links on the other side.

### Updatable queries
Queries are arrays constructed with the `for-all` and `such-that` functions. Queries on tracked arrays can be updated, with the changes feeding back into the source arrays. Databases call this an _updatable view_. Queries on untracked arrays are not updatable.

The `such-that` function removes some items from the source array. The items that make it through into the result can be updated, with the updates feeding back into the original items in the source array. Likewise items in the result can be created and deleted, feeding back into the same operations on the source array. Note `such-that` is not stable: an item might be changed in a way that removes it from the result afterwards.

The `for-all` function produces an array whose items are the result of applying a code block to each source item. Updates to the result items are feed back through the same code block instances that derived them. These code blocks respond to changes as described above: if there is an `on-update` block it will be executed, otherwise the code block is executed in reverse. Either way, a change can only feedback to the source item — any attempt to write outside of it is a static error. Deleting an item in the result of a `for-all` just deletes the corresponding item in the source. A `for-all` is stable if its code block is stable.

Creating an item in the result of a `for-all` is a little more complicated: an item is created in the source array and a new instance of the code block is executed on it. If the result of this code block is different from the new item in the result, then the change is feed back through the code block as described above to change the new source item appropriately. _TODO: example_

Updating queries that combine multiple tables has been a long-standing quandry, known as the _view update problem_. Subtext sidesteps many of the difficulties of view update by nesting tables rather than joining them. The example presented from the _Queries_ section can be made updatable by tracking the tables and defining ther results of the `for-all` and `such-that` as interfaces with `=|>` instead of `=` :

```
customers: tracked table{customer-id: 0, name: ''}

orders: tracked table{order-id: 0, customer-id: 0, item: ''}

query =|> customers for-all{
  extend{their-orders =|> orders such-that{.customer-id =? customer-id}}
}
```

Now `query` can be updated as if it was an input table, with the changes sent back to the `customers` and `orders` tables. Remember that it is not possible for changes outside the source to leak from a `for-all` — so how do changes escape to the `orders` table? The trick here is the way the `extend` block works: the definition of the `their-orders` field becomes part of the result records. Any changes inside the `their-orders` field in the results will get fed back directly through that definition, containing a `such-that` and then onward to `orders`. These changes get rerouted into `orders` before the `for-all` gets a chance to see them. Only the change to the fields inherited from `customers` feed back into the `for-all` and hence to `customers` without breaking the rules.


### Registering local state in code

So far all updates have eventually fed back to global input fields, that is, input fields defined at the top of the workspace, or input fields contained within such top-level inputs. There are cases where this is inconvienent, particularly when constructing views or “user interfaces” that are adaptable. For example, we might want to hide the value of a password unless a button is pressed to reveal it. Pressing the button would have to change an input field that determines whether or not to show the password. We could implement that like this:

```
hidden-password: hidden 'foo'
reveal: hidden no
password = try {
  check reveal.yes?
  hidden-password
} else {
  ''
}
show-password =|> off on-update {write reveal <- yes}
```

Note the `hidden` qualifier on `hidden-password` and `reveal`, which hides those fields when in user mode, so that the user only sees the `password` field and `show-password` button. For more on constructing user views see _User Interfaces_

But what if we have more than one hidden password? For each of them we would need to define a corresponding `reveal` field to remember the state of whether or not it is being shown. What if we had an array of such passwords? We would need to define an array of such states, and every time a password is created or deleted we would need to correspondingly adjust the array to keep them consistent. This is a common problem in user interface programming — see for example [React state hooks](https://reactjs.org/docs/hooks-state.html).

To handle this sort of problem, Subtext provides another kind of input field: a _registered field_. A registered field (register for short) can record state inside a formula. Here is how we would handle the prior example:

```
hidden-password: hidden 'foo'
password-view = do {
  reveal: register no
  record {
    password = try {
      check reveal.yes?
      hidden-password
    } else {
      ''
    }
	show-password =|> off on-update {write reveal <- yes}
  }
}
```

The `password-view` field computes a record with two fields: `password` conditonally revealing the password, and the `show-password` button to reveal it. Pushing that button will set the `reveal` field to `yes`, revealing the password, like in the previous implemenation. The key difference is that now the `reveal-password` field is defined inside the `do` block as a `register`.  Normally an input field in a `do` block is initialized every time it executes, but declaring it to be a register changes this: instead the value is remembered from the last time the code block executed. Registers thus provide _local state within code_.

Registers are particularly useful when producing views of arrays. Assuming we have an array of passwords, we can produce an array of password-revealing views like this:

```
passwords: tracked array{''}
view = passwords for-all {
  password:[]
  reveal: register no
  record {
    password = try {
      check reveal.yes?
      password
    } else {
      ''
    }
    show-password =|> off on-update {write reveal <- yes}
  }
}
```

In this example `view` becomes a table containing a row for each password, with a field conditionally revealing the password, and a field containing a button that reveals it. The revealment state of each password is remembered in the `reveal` registers, which live inside the `for-all` iterations.

What happens if we delete a password? Registers remember the state they were in when the code last executed. But this code is being repeatedly executed by the `for-all`. Because `passwords` is a tracked array, the iterations of the `for-all` are correspondingly tracked. So each register will remember its state from the previous iteration with the same tracking ID. Thus deleting passwords will not affect the reveal state registered for the other passwords. Likewise reordering passwords will not mix up the reveal states.

Similarly, creating a new password will not affect the registered reveal states for the other passwords. The `reveal` register for the new password will be initialized to `no` because it had not executed before.

> If `passwords` was untracked then the registers would be remembered based on the order of the passwords, so deleting would shift the later states down. We might want to outlaw untracked registers unless we find some use for them.

> Use text truncation example instead



### Internal feedback

Feedback is designed to handle external input, so we have been using examples of user actions to trigger changes. Recall the counter example:
```
count: 0
button =|> off on-update{write count <- + 1}
```
When the user clicks on the button the value `yes` is written to the field`button`, triggering the feedback process. This is actually implemented with code like this:

```
current = record {
  count: 0
  button =|> off on-update{write count <- + 1}
}
changed = current with{.button := on}
```

Here is the magic trick: feedback is a feature of the `:=` update operation. Normally we use `:=` to override input fields as data state or as arguments to a function. But when `:=` writes to an interface field, it internally runs a complete feedback transaction. At the end of the transaction, the final set of writes to input fields determine the final result of the update.

> TODO: useful as escape to allow writes to overwrite

Because all interactions between a workspace and the external world are encoded as value changes, we get universal testability. The `test` block make this convenient by passing the initial state of the containing workspace into a code block, and reports a test failure if the block rejects. For example:

```
count: 0
button =|> off on-update{write count <- + 1}
test {
  .button := on
  check .count =? 1
  check .button.off?
  .button := on
  check .count =? 2
}
```

> Note breaks lens laws

There is an important safety restriction on internal feedback: it must stay internal. In other words, writes can’t escape. For example, this is illegal:
```
count: 0
sub-state = record {
  button =|> off on-update{write count <- + 1}
}
new-state = sub-state with{ .button := on}
```

Here the internal write to the `button` interface attempts to write `c`, which is outside the source of the update operation `sub-state`. This is a compile-time error.

> Note that it might be possible to allow escaping writes. Possibly by holding them pending inside the result of the update, allowing them to be propagated with a later write. Or using a lens (maybe called a “jig”) to carry context of writes along.

Because feedback can’t escape, Subtext is technically a pure functional language. I/O is simulated by writing a top-level code block, called a _history_, that starts with the initial definition of the workspace, followed by a sequence of update operations producing modified versions of the workspace reacting to inputs. The current state of the workspace is the final result of the history block. Now every functional language use some magic trick like this to encode I/O. What is different about Subtext is that the way input is handled offers some of the freedom of naive imperative programming, where you can write through a reference to change some global state, rather than having to pipe, deconstruct, and reconstruct global states throughout the program. But unlike naive imperative programming, and some of its emulations in functional languages, you don’t need to worry about carefuly ordering writes (performed deep in code thst may be in hidden from you) so that they do not wipe each other out, or reveal partial intermediate states. Subtext restricts the targets of writes and enforces a static ordering on them that avoids these notorious pitfalls.



query interfaces (updatable views)
updatable block?
feeedback errors and transactions


# Appendix: FAQs

## why are you reinventing the wheel?
Because the standard wheels are square.
Everywhere you look in the world of programming, from the grandest architectures to the tiniest details, is riddled with design mistakes, anachronisms, and historical accidents. Essentially we have never fixed or thrown anything away, and just added extra layers to workaround the defects.
Subtext is an experiment to see how much we can simplify programming by starting with a clean slate.

## why ignore equal changes?
make update semantics equivalent to diffing
“difference without a distinction” is troubling
easy to aggregate changes in values
e.g. insert() is a function, not a special operation
easy to abstract sets of changes into a function
Don’t need to have distinct functional and imperative versions of operation
otherwise need to introduce delta-types into language semantics
with implicit coercion to basis type
Think this is simplist solution, but worth exploring design with first-class deltas

## why tracking instead of unique immutable keys?
Adding the same key in two versions can’t be merged
The UI can’t insert a new item without first knowing at least its key
A program can’t insert a new item without first generating a key, and the insertion could fail if the key is already taken. Alternatively, implicitly updating the record with an existing key changes the semantics of insertion in subtle ways.
The user can never edit a key, which breaks normal expecations. People change their names. This is case where the needs of the softeware force the user to adapt.
Handles auto-numbering while guranteeing safe merging of inserts
Friendly to user to be able to change keys and allow them to be duplicates.
Things have the same names in the real world all the time. Names also change.
See Airtable
Supports declarative links instead of foreign keys and referential integrity maintenance
Supports accurate diffing and merging in the presence of manual reordering for things like document formats where there are no natural keys
Spreadsheets and data science libraries (data frames) aren’t hung up on keys
Pushing this fundamental data model issue onto the application programmer is an enormous cop-out

## how can you abandon the proven relational model?
Has no built-in notions of order or nesting, which are unbiquitous in the programming and UI worlds.
It’s over-specialized and unusable. Optimized for read-only queries, and theoretical concisions, and implementability.
Joins duplicate data, hiding the underlying relationships (which then have to be expressed in the mathematics of functional dependencies, which aren’t explicitly supported in any DBs).
We believe joins are confusing to non-mathematical users, and hypothesize that nesting will be easier to understand.
Not having to learn the relational model and SQL is one of the major benefits of Subtext.

## Will Subtext be open source?
I hope not. Open source works best for software used by other programmers, because that is how the contributors get their cred. But the economics of startups conflict with the goal of liberating software development. Perhaps a hybrid form like a Public Benefit Corp or a Coop offers a workable middle way.



# Appendix: TODO



# Parsing

It is common to need to find and operate on patterns in text. The traditional solutions involve specialized languages with radically different syntax and semantics, such as _regular expressions_ or _parser generators_. Subtext provides these capabilities without the need to learn a specialized sub-language.

TODO: rename selection -\> range. before/covered/after

A _selection_ is an array that has been divided into three parts, called _before_, _selected_, and _after_. Any of these parts can be empty. We can think of a selection as an array plus two indices `begin` and `end` where `1 ≤ begin ≤ end ≤ length + 1`. A selection is created from an array with
```
array selection(.begin := i, .end := j)
```
where the begin and end indexes default to 1.

Two selections are equal if they are equal as arrays and have equal begin and end indexes. A selection is equal to an array if its begin and end indexes are both 1 and the after part is equal to the array. The UI displays a text selection with the selected part highlighted as in a text region selection. If the selection is empty, the UI displays it as a text cursor between two characters, or at the beginning or end. When a text selection is edited, changes to the cursor/selection state in the UI are saved.

Selections are useful when attempting to recognize various patterns in text (or any kind of array, but we focus on text in the following discussion). This process is called _matching_. The most basic matching function is `match?`, which will check that the front of the input text equals the second input text, rejecting otherwise. So:
```
'foobar' match? 'foo'
not{'foobar' match? 'bar'}
```
All matching functions result in selecting the matched portion of the input, so:
```
'foobar' match? 'foo'
check selected() =? 'foo'
check after() =? 'bar'
```
The input to a matching function can be text or a selection in a text — if it is a selection then matching is done against the **after** part. In that way a sequence of matches will look for a sequence of patterns:
```
'foobar' match? 'foo'
check selected() =? 'foo'
match? 'bar'
check selected() =? 'bar'
```
Sometimes when matching sequential patterns like this we want to combine the entire matched region into the resulting selection, like this:
```
'foobar' select {
  match? 'foo'
  check selected() =? 'foo'
  match? 'bar'
  check selected() =? 'bar'
}
check selected() =? 'foobar'
```

Another useful matching function is `match-number?` which matches a numeric text and exports the numeric value as `~value`. For example:
```
'123foo'
match-number?()
check after() =? 'foo'
check ~value =? 123
```

When a matching function does not see the expected pattern in the input, it rejects. This means it is easy to use `try` blocks to test for alternative patterns. Here is a classic textbook example of matching a little language of addition formulas:

```
match-expr? = '' try {
  match-number?()
} else {
  match '('
  match-expr?()
  match? '+'
  match-expr?()
} else reject

'1' match-expr?()
'(1+2)' match-expr?()
'(1+(2+3))' match-expr?()
not{'1+2' match-expr?()}
```
Note how in this example, if one clause of the `try` block rejects then the next one is evaluated using the original input selection, which is sometimes called _backtracking_.

### Syntax trees

Recall the `eval-expr` example that evaluated simple arithmetic formulas encoded as a recursive choice `expr`:
```Txt
expr: choice {
  literal?: 0
  plus?: record {
    left: expr
    right: expr
  }
}

eval-expr = do {
  x: expr
  try {
    x.literal?
  } else {
    x.plus?.left eval-expr() +(x.plus?.right eval-expr())
}
```

When we produce a recursive choice like `expr` while parsing text it is sometimes called an AST (Abstract Syntax Tree). Often that requires a lot of repetitive code in the parser to assemble the AST as it is being parsed. We can produce an AST just by exporting from the parsing code, as follows:

```Txt
'1+1'
match-expr? = try literal? = {
  match-number?()
  export ~value
} else plus? = {
  match-expr?()
  export(match-expr~) left = ~
  match? '+'
  match-expr?()
  export(match-expr~) right = ~
} else reject

eval-expr = do {
  ast: match-expr~
  try {
    ast.literal?
  } else {
    ast.plus?.left eval-expr() + (ast.plus?.right eval-expr())
}

test {
  check '1+2' match-expr?()~ eval-expr() =? 3
}
```

The export of a `try` block is a choice, and the export of a recursive `try` block is a recursive choice. So the export of `match-expr` is an AST. The clauses of the `try` block are labeled `literal?` and `plus?` like in the `expr` choice. Completing the correspondence, the matched number is returned as the export of the `literal?` clause, and the left and right ASTs are exported with corresponding names from the `plus?` clause. Note that the recursive exports of the left and right ASTs uses `export(match-expr~)` - the parenthesized reference to `match-expr~` tells the export to define a recursive type. _We should be able to infer this._

The export of `match-expr` matches the earlier definition of `expr`.  In `eval-expr`, `ast: match-expr~` says the input of the function must be the export of `match-expr`. The rest of the code is identical to `eval-expr`.

### Repeats

Often we want to match a repeating pattern. Here is an example that matches a CSV (Comma Separated Values) text:

```
'1,2,3foo'
repeat {
  match-number?()
  optionally {
    match? ','
    continue?()
  }
}
check =? 'foo'
```

This example uses a `repeat` block, which is Subtext’s form of looping. Unlike traditional loop mechanisms, `repeat` blocks are expressed as a _tail recursive_ function: The special call `continue?()` recursively calls the containing repeat block. Like any other call it takes an input value on the left, and optionally other inputs on the right. But it may only be used where its result will immediately become the result of the whole function (_tail position_).

A tail recursive function is equivalent to a loop, and a repeat block is actually implemented that way, as an array of calls. In the UI they will be displayed as an array rather than the nested inlining used for normal function calls. Unlike a traditional loop, a repeat block does not involve mutable variables — that is replaced by passing new input values to the next iteration. We hypothesize that this is the best of both worlds: the simple iterative semantics of loops, with the clean value semantics of recursion.

The recursive call `continue?()` has a question mark because the repeat block can reject. An unconditional `continue()` would be used in an unconditional repeat.

> Maybe the `continue` call should default secondary inputs to their value in the current iteration, not the original definition. That would more closely emulate mutable loop variables, and allow uses like `continue(count := + 1)`.

> Maybe `continue` should do an early exit to guarantee tail position and simplify conditional logic.
>
> When repeats are nested it may be useful to have continue specify a name of the block as in `continue foo-loop()`.

> Perhaps a `visit` block that can be multiply-recursive, and collects the exports in order of execution, concatenating them as in a “flat map”. Combined with skipping of conditional exports, this allows arbitrary search algorithms to be easily written.

### Repeated exports

When we parse a CSV we typically want to produce an array of the numeric values. We can do that by adding an export:

```
'1,2,3'
csv = repeat {
  match-number?()
  export ~value
  optionally {
    match? ','
    continue?()
  }
}

check csv~ =? (array{0} & 1 & 2 & 3)
```

Recall that the export of a `do` block is a record, and the export of a `try` block is a choice. The export of a `repeat` block is an array, with each item containing the export of an iteration of the block. The statement `export ~value` exports the numeric value from the prior call to `match-number?()`. So the export of the entire `repeat` is an array of matched numbers.

### Scanning

A `scan?` block can be used to search for a pattern in text. For example:
```
'foo123'
scan? {match-number?()}
check before() =? 'foo'
check selected() =? '123'
check ~value =? 123
```
A `scan?` block repeatedly executes. At first the input text or selection is passed into the block, and if it succeeds nothing further is done. But if it fails the block is re-executed with a selection that skips one character (item) in the input. This is done by moving the selected part to the before part, and then moving the first item of the after part to the before part. One character at a time is skipped this way until the match succeeds or the end of the text is hit (which causes a reject).

Scanning can be combined with replacing text:
```
'Some Millennials attacking other Millennials'
repeat {
  optionally {
    scan? {match? 'Millennial'}
    replace-selection 'snake-people'
    continue()
  }
}
combined() =? 'Some snake-people attacking other snake-people'
```
The `replace-selection` replaces the selected part of the left-hand input with the right-hand text. Note that replacing the selection does not affect subsequent matches, which work on the after-part, so replacement can be done “on the fly”. The `combined()` call at the end converts the final selection back into a plain text by concatenating the before, selected, and after parts.

## Blank values

_Null values_ are a perennial controversy in PL and DB design. The idea is to add a special value Null to all types of values in order to represent a “missing” or “unknown” value. Unfortunately Null adds complexity and more ways for code to break, or more language features to avoid breaking. FP languages avoid Null values by using Option wrappers (like Subtext choices), but at the cost of continually wrapping and unwrapping values.  NULL in SQL is a widely acknowledged disaster. We want to avoid this whole mess if possible.

Subtext designates a _blank_ value for each type. These are naturally visualized in the UI with blank fields or empty arrays. Here are all the blank values:

1. There is a special blank number called `###` that corresponds to an empty numeric item in the UI. Numeric functions treat `###` as a special case, as Excel does with empty cells. Unlike IEEE NaN, `###` is equal to itself.
2. There are predefined blank values for each media type that serve as placeholders.
3. A block is blank when all its input fields are blank.
4. A text or array or table is blank when it is empty.
5. The blank character is the space character.
6. `nil` is blank
7. A choice is blank when it is choosing the first option, and that is also blank. Also see `maybe` blocks below.

The `required` constraint (see _Constraints_) checks that an input item is not blank.

Sometimes we really do need to have an extra value like NULL to designate a value is missing or unknown. The `maybe` block converts a conditional formula into a choice, like a conventional Option type. For example `maybe{x?}` produces the choice:
```Txt
choice {
  no?: nil
  yes?: x
}
```
where the the `no?` option is chosen if `x?` rejects, and the `yes?` option is chosen and changed to the value of `x?` if it succeeds.

A `maybe` block is often useful in cases where we would like to change an input item with a conditional formula (which is illegal). For example we might want to use a conditional formula as a function input so that, instead of rejecting the call, the function itself gets to decide what to do. Wrapping the conditional formula in a `maybe` block permits that.

## Types

Subtext has no syntax for describing types: it only talks about values. Function inputs are defined with a default value, so no type needs be specified. Likewise error messages never talk about types — instead they point to a mismatch between values at two code locations, additionally referencing the code locations where they were defined.

We believe that type systems are an essential formalism for language theoreticians and designers, but that many language users would prefer to obtain their benefits without having to know about them and write about them.

_FIXME: simpler: names are nominal, everything else is structural. Field names can be nominal because we can bind them contextually, even in constructors, because of argument defaults. _

In PL theory terms, Subtext mixes aspects of structural and nominal type systems. It is structural in that `x = array{0}` and `y = array{1}` have the same type. It is nominal in that `x = record {a: 0}` and `y = record {a: 0}` have different types. Every time a block item is defined a globally unique ID is assigned to it. There is a workspace-wide dictionary that maps these item IDs to their current names. Renaming a block item just changes that dictionary entry. Type equality requires that block item IDs be equal, not that their names are currently spelled the same.

> Consequence: syntax can’t always write down every type, e.g as argument type to a function taking a type that is “anonymously” generated elsewhere. The FieldIDs of names need to be referenced somehow. However that isn’t a problem in live code, which can just use FieldIDs defined elsewhere. Is this an example where liveness has major design impact on language: simplifying the type system? This is an obscure situation. Want a better example.

> TODO: To share item IDs across different types of blocks we can use a traits-like mechanism that merges and restricts blocks. Deferred until we have the need.

Subtext doesn’t have function types or higher-order values. Two values have the same type if they have the same data type and all embedded code is equal (modulo internal paths). Value equality requires type equality, so equal values are behaviorally equivalent, i.e. referentially transparent.

Generic (parametrically typed) functions are defined with inputs using the special top value `anything`. For example the `&` function to add items to an array has the definition:

```
& = do {
  input: array{anything}    // input must be an array of some kind
  item: input[]             // item must match array template
  builtin &                 // execute builtin function
}
array{0} & 1      // this will insert 1
array{0} & ''	  // this will report a type mismatch static error
array{0} &()      // this will insert 0
```

A generic function is one with an input containing `anything`. The function can be called with any input value where the `anything` occurs. Every call of a generic function will recompute the input default values based on the actual input values before becoming the value from the call. Inputs to the call are type-checked against those new defaults. Note that type checking is still static: every call to a generic function gets statically checked — types can not vary dynamically, only across different call-sites. It is notable that we obtain parametric types without introducing an explicitly parametric type system with type variables like `<T>`, which are notoriously baffling to beginners. Yet unlike template meta-programming, we retain static type checking at call sites for comprehensible errors.

## Termination

Sometimes a function takes too long to execute, or consumes too many internal resources.

> Simplest solution is that doc becomes read-only while reacting to an input, and then the results are shown atomically at completion. If computation takes too long the user can terminate it, which cancels the entire input action and leaves the workspace in its prior state. The input action remains in the history though and can be redone later if desired. Exceeding resource quotas (like stack size) would terminate computation automatically. This is the state of the art for computational notebooks.

> However it would be nicer to be able to interrupt a long-running execution, observe it’s execution so far, and resume if desired. That should probably wait for an implementation of incremental execution.

## Input rejects, transactions, and data constraints

Rejections are like conventional exceptions: they “bubble-up” through blocks, giving each containing block a chance to “catch” them, based on the kind of block. We have seen that rejections are caught by `try`, `not`, `assert`, and `test` blocks. But what happens when a rejection isn’t caught and bubbles up all the way? To explain this we need to describe how documents  change.

Every document has a _history-block_, which is a special kind of do-block. The initial value of the history-block is the initial value of the document itself when it was first created. Every time a user does something to the document (or a function is triggered by an incoming network request), a formula is appended to the history that computes a new version of the document. The current state of the document is the last value in the history document. If a history formula rejects it means that the requested change is not possible, and the previous document value is passed along unchanged. Input actions are essentially executed in a transaction that discards the changes on rejection. User-written blocks can duplicate this behavior with the `guard{}` block, which passes on the value of the block if it succeeds, otherwise passing on the prior value. The history block catches rejects by implicitly wrapping every action in a `guard`.

There is one other way that rejects can bubble up without being caught. That is when a formula in a record is recomputed as a result of a change to other fields it references. How this is treated depends on whether the formula is inside a record or document block.

Document blocks are special records used at top of every document, including documents that are meant to be included in other documents as modules or libraries. Rejected formulas at the top level of a document are permitted and not considered to be an error. For example you might define a conditional function in a library - whether its default execution is a rejection does not matter. Likewise we often use top level formulas in a document as a sort of REPL to explore values, and rejection is a normal occurrence.

Conditional formulas inside record blocks are treated differently: they are considered to be _constraints_ on the state of the record, with a rejection indicating the record is in an invalid state. For example:
```Txt
customer: record {
  name: ""
  age: 0
  age >=? 21
}
```
Customers must be at least 21. However it would be very inconvenient to treat failed constraints as an error as soon as they occur, because sometimes complex constraints can be transiently invalid while multiple data fields are changed. Therefore failed constraints are treated as errors only when they occur inside a (possibly nested) data field of a document. In other words, failed constraints are an error inside the persistent state of the document, but not when they are local values inside computations. Failed data constraints do not cause user actions to fail. Instead they mark the document as in an invalid state, and prevent the document from being published to others (unless explicitly forced by the user). Normally the user is expected to resolve failed data constraints manually. Changes triggered by incoming network requests will be checked more strictly: a broken constraint will cause the request to be cancelled with an error.

There are a set of predefined qualifiers on state fields that impose useful constraints on their value. For example:
```Txt
age: positive 1
```
constrains `age` to be positive. The predefined constraints are:
```Txt
positive     // >? 0
negative     // <? 0
non-negative // >=? 0
non-zero     // not=? 0
required     // not blank (see Blank Values)
```

## Tracked links

Links are used to store user-modifiable references to items from outside the array. A common scenario is what relational databases call _foreign keys_, where rows in one table reference rows in another:

```
customers: tracked table {
  name: ''
  address: ''
}
orders: tracked table {
  item: ''
  customer: one in customers
}
```

The `customer` item of `orders` rows is a _link_. Links designate an array they reference into (called the _target_), and a constraint on the number of linked items they permit. In this example, exactly one customer must be linked. The number of linked items can be constrained in several ways:
```
one in customers         // exactly 1 item
maybe one in customers   // 0 or 1 items
some in customers        // 1 or more items
maybe some in customers  // 0 or more items
```

A link records a subset of the IDs in its target array. Links are equal when their target array are equal and they link the same items. A link is edited in the UI with something like a pick-list of the items in the target array (and radio buttons for a singular link). Links can be modified with several functions that produce modified links:
```
l link i                  // add link to item with index i in target
l unlink i                // unlink item with index i in target
l links? i                // rejects if target index i is not linked
l clear()                 // unlink everything
l link-all array          // link all IDs from another array or link
l unlink-all array        // unlink all IDs from another array or link
l copy array              // clear and link-all
```

Links act in some ways as if they were a sub-array containing the linked items in their order in the target array, for example they can be indexed with `[...]` and searched with `find?{...}`. But note the indexes used in those examples are the index within the links, not the index in the target array. We can access the underlying target array with:

```
l target()        // copy of the target array
l target-index i  // converts index within links to index in target
```

## Reflected links

When a link is used inside a row of a table, it is often useful to have a _reflected_ link in each row of the target table that is its inverse. When a row in the source links to a row in the target, the target will link back to it, and vice-versa. In data modeling this is called a _relationship_. For example:
```
customers: tracked table {
  name: ''
  address: ''
  orders: maybe some in orders reflecting customer
}
orders: tracked table {
  item: ''
  customer: one in customers reflecting orders
}
```
Note that each link names the item within the opposite table that contains its reflection.

Reflected links can also be declared as _unique_, _complete_, or _paired_, corresponding to injective (into), surjective (onto), and bijective (1-1) mappings.

Note that while the above example is familiar from relational databases, in Subtext it would be simpler to just nest orders inside customers:
```
customers: table {
  name: ''
  address: ''
  orders: table {
    item: ''
  }
}
```

## Nested links

Links can target nested arrays, linking to a path of IDs. Reflecting links can cross multiple layers of containing arrays. Cardinality constraints are specified separately for each level of nesting.

## Synchronized links
If a link and its target list are both defined as data in the same structure, then they will be kept in sync through changes to either. Likewise for reflected links. For example:

```
database: record {
  customers: tracked table {
    name: ''
    address: ''
  }
  special-customers: some in customers
}
database do {
  .customers := & with{.name := 'joe'} & with{.name := 'jane'}

  // Jane is a special customer
  .special-customers := link customers[2]

  // write through link
  .special-customers[1].address := 'Main St'
  check .customers[2].address =? 'Main St'

  // cascading delete
  .customers delete 1
  check .special-customers length() =? 0

  // insert into target table via link
  .special-customers & with{.name := 'john'}
  check .customers last?() .name =? 'john'
}

```

Synchronization takes place when a set statement (`:=`) executes on a context containing the affected tables and links, as in the `database` record in the above example. Changes made to copies of the links or tables have no side-effects until they are assigned back into a sufficiently broad context. _This feature is a sneak peek at the planned semantics of updatable views and bidirectional formulas._

## Invalid links
Links can have the wrong number of linked items through several causes:
1. The user edits the link in the UI
2. Code computes a link
3. Deleting an item in the target list deletes all links to it
4. Creating a new item containing a link, which defaults to empty
The basic idea is to distinguish data and formula contexts. Invalid links in a formula will crash. Invalid links in a data field are considered a constraint violation, which prevents committing them to the document state until they are corrected manually.

## Merging

Copies happen. Workspaces get shared as email attachments. Workspaces get incorporated into other workspaces. Inevitably both the copy and the original change. Tracking allows such changes to be later sent to the other version without wiping out all the changes that have happened to it in the meantime. This is called _merging_.

Two copies of a tracked array can be compared to see exactly how they have diverged. The IDs in a tracked array allow changes made to an item to be tracked despite any changes made to its value or location. Deletions and creations are also known exactly. Tracking provides more precise information than text-based version control systems like git.

Changes made to one copy can be merged into the other. If changes are merged in both directions the two copies become equal again. Sometimes changes made to both copies are such that merging must lose some information, for example if the same item in the same item is changed to be two different numbers. Merging can be done using an automatic policy to resolve such conflicts, or human intervention can be requested, either immediately in the UI when performing the merge, or later by reifying such conflicts into the workspace itself (but without breaking the workspace as textual version-control does).

Merging can be done across copies of entire workspaces. Merging can also apply to workspaces included inside another workspace (see _include_ and _variant_). Merging applies to all tracked arrays and links within a workspace. Non-tracked arrays (like text) are treated like base values that change as a whole.

# Appendix: Glossary

# Appendix: Syntax

```
Workspace = Body

Body :=
	| Item
	| Item? (';' | '\n') Body?

Item :=
	| GuardedName ':' Formula					// input
	| Dataflow? (GuardedName '=')? Formula		// output
	| GuardedName '=|>' Formula					// interface
	| GuardedName ':' 'register' Formula		// register

GuardedName := Name ('?' | '!')?
Name := Word | Operator
Word := [a-z A-Z] ([a-z A-Z 0-9 & _ \-]* [[a-z A-Z 0-9])? // can't be keyword
Operator := '+'|'-'|'*'|'/'|'='|'not='|'>'|'>='|'<'|'<='|'&'|'&&'

Dataflow := 'check' | 'let' | 'export'

Formula := Value? Op*

Value :=
	| BaseValue
	| Path
	| 'that'				// preceding value
	| 'record' Block
	| 'choice' Block
	| 'maybe' Block
	| ArrayKind* 'array' Block
	| ArrayKind* 'table' Block
	| 'select' (Path | 'any' 'array' Block | 'any 'table' Block)

ArrayKind :=
	| 'tracked'
	| 'sorted'

BaseValue :=
	| string				// single-quoted JS string literal
	| 'character' string	// character literal
	| number				// JS number literal
	| '###'					// Special blank number
	| 'nil'					// unit value
	| 'anything'			// generic value

Block := '{' Body '}'

Op :=
	| Path Arguments				// function call
	| 'continue' Arguments			// tail call
	| RelPath ':=' Formula			// update
	| '#' Name '(' Formula? ')'		// choose
	| 'write' Formula? '->' Path	// write
	| 'write' Path '<-' Formula		// updating write
	| RelPath						// navigate
	| Conditional
	| Control Block
	| 'include' Name
	| 'builtin' Name
    | '&' Block						// &(with{})
	| RelPath UnaryEdit
	| RelPath BinaryEdit (Value | RelPath)
	| RelPath FieldCreate '{'  Name '::' (Value | RelPath) '}'

UnaryEdit :=
	| '::delete' | '::nochange'
	| '::wrap-record' | '::wrap-array' | '::unwrap'
BinaryEdit :=
	| '::replace' | '::convert'
	| '::move' | '::move-insert' | '::move-append'
FieldCreate :=
	| '::insert' | '::append'

Arguments :=
	| Value
	| '(' Formula ')'
	| '(' (Formula ArgSep)? KeywordArg (ArgSep KeywordArg)* ')'
ArgSep := ',' | '\n'
KeywordArg := '.' Name ':=' Formula

Conditional := ('try' | 'optionally') FirstClause ElseClause* LastClause?
FirstClause := ( Name '?' '=' )? Block
ElseClause := ( Name '?' '=' )? 'else' Block
LastClause := 'else' 'reject'

Control :=
	| 'do'
	| 'with'
	| 'on-update'
	| 'updatable'
	...fill in from Parse.matchCode()

Path := GuardedName? RelPath
RelPath := step*
Step :=
	| '.' GuardedName			// data
	| '~' GuardedName?			// import
	| '^' GuardedName?			// metadata - internal use only
	| '[' Formula? ']' '?'?		// Index
```