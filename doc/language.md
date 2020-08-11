# The Subtext Programming Language

> End-user programming may still be out of reach - reframe goal as small-scale application programming?

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
* All code is strict, pure, and referentially transparent. Therefore programs are _functions_.
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

- _Number_: double float using JavaScript syntax, and the special value `number` not equal to any other number (except itself)
- TODO: infinite precision rationals
- _Text_: JavaScript string literal using single quotes: `'hello'`
- _Character_: a unicode character, using a literal of the form `character'a'`
- _Boolean_: either `true` or `false`
- `nil`, the unit value, useful in enumerations (see _Choices_)
- `anything`, the top value used to define generic functions (see _Types_)
- TODO: fancy text with fonts and formatting
- TODO: date-times and calendars
- TODO: media (MIME-typed blobs)

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
  telephone: 0
}
```
This block contains two input items: `name`, which is an initially empty text, and `telephone`, which is initially the number `0`.

The essential operations on a block are to read and update individual items. We read the items using paths, like `x.name` and `x.number`. To update an item we use the symbol `:=`, called an\_update\_.
```
x with{.name := 'Joe'}
```
This is pronounced “x with name updated to Joe”. The result is a record equal to the value of `x` except with the item `name` having it’s value updated to `'Joe'` (keeping the prior value of `telephone`). We used a `with` block to contain the update operation, which is like a `do` block except that it feeds the previous value into a list of operations, rather than starting with a value. The equivalent `do` block would be:
```
do{x; .name := 'Joe'}
```

> It would be possible to allow the syntax `x.name := 'Joe`. But that is dangerous. The lexical binding of the first name in the path establishes the context of the modification. Prefixing a name to resolve lexical shadowing would thus change the semantics.

We can chain multiple updates together:
```
x with{.name := 'Joe'; .telephone := 2}
```
Note how `.telephone :=` applies to the result of the previous update.

The `:=` operation passes the current value of the left hand side as an input to the expression on the right side. Thus for example `y = x with{.telephone := + 1}` will increment the value of the `telephone` field.

Updates can drill into nested records by using a dotted path to the left of the `:=`
```
x: record {
  name: ''
  telephone: 0
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

Only output items can be conditional, not input items, which would introduce problematic _null_ values. See _Missing values_ for further discussion of alternative techniques.

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

A `choice` block defines a set of named input items called _options_, exactly one of which is _chosen_. The options can be different kinds of items, as in all blocks. Choices are like _discriminated unions_ and _sum types_ in conventional languages. Here is an example:
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
a-literal = expr #literal 1
```
This pronounced “a-literal equals expr choosing literal one”. The `#` expects a choice value on its left (`expr`) and to its right the name of an option without the question mark (`literal`), followed by a formula resulting in a value for the option. The right hand formula can be left out, which will change the option to its default value (0 in the case of `literal`):
```Txt
a-literal = expr #literal
```

The choice operation `#` is similar to the update operation `:=`, except that it doesn’t require a dependent path on the left (one starting with `.`). However `#` can also be used with a dependent path, which is useful when chaining nested choices:
```Txt
a-plus = expr #plus with{.left #literal 2; .right #literal 2}
```
Note how, like a `:=`, the result of `.left #literal 2` is the containing `plus` term, not the `left` term. That allows chaining the subsequent `.right #literal 2` statement.

Note that `#` always initializes the chosen option to its originally defined value, even if it was already chose and had a different value. Likewise, the optional expression to the right of the option will be given a previous value that is the initially defined value of the option. Thus for example `# literal + 1` will always result in 1. This is useful when function arguments are choices, for example `f(#red)` will choose the initial value of the `red` option of a choice argument.

Sometimes there is no value of interest to associate with an option — we want it to indicate just that we made the choice. This is called an _enumeration_ in many languages. We use the special value `nil` in this case:
```Txt
color: choice {
  red?: nil
  blue?: nil
  green?: nil
}
```
The value `nil` is called a _unit value_ in some languages: it contains no information, and is the sole value within its datatype. As such `nil` options can be chosen without supplying a value:
```Txt
color #red
```

> Maybe when a choice is input to a `try` we should force the clauses to test each option. Then we can easily statically detect exhaustiveness, and also automatically add cases when needed.

### Pattern matching

Languages with datatypes like  a choice often also provide specialized syntax for _pattern matching_. A `try` block combines with choices to provide pattern matching without additional syntax and semantics:
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
numbers: array {0}
customers: table {
  name: ''
  address: ''
}
```
The array `numbers` contain numbers, defaulting to 0. The table definition `customers: table {...}` is equivalent to `customers: array {record {...}}`. The table contains columns `name` and `address` defaulting to the empty text. The template of an array is access by using empty square brackets, as in `numbers[]`.

The `&` function (pronounced “and”) is used to add items to an array. For example:
```
n = numbers & 1 & 2 & 3
c = customers &(with{.name := 'Joe', .address := 'Pleasantown, USA'})
```
The `&` function takes an array as it’s left input and an item value as its right input, resulting in an array equal to the input plus a new item with that value. The default value of the item is the array template. In a table it is often convenient to use a `with` block as above to update some of the columns and let the others default to their template values.

The `followed-by` function concatenates two arrays: `array1 followed-by array2` is a copy of `array1` with all the items from `array2` added to its end. The two array must have the same type template.

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

The first and last items can be accessed with `first?()` and `last?()`, which will reject if the array is empty. The function `sole?()` will return the only item in the array or reject.

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

### Sorted arrays

Normally, items are added to the end of an array. But an array can be defined as _sorted_, which means the items will be automatically kept in order of increasing value, or _reverse sorted_, which keeps then in order of decreasing value. Tables, whose items are blocks, use lexicographical ordering, where the first column is the most significant. Thus
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

A `for-all` block will evaluate a `do` block on each item of an array in order, resulting in an unsorted array of the results. The block cannot be conditional. This is like the traditional 'map’ combinator. A `for-all?` or `for-all!` takes a conditional block and either checks or asserts that every item is accepted. A `query` will transform only the items accepted by a (possibly) conditional block. This is like a combination of the traditional 'map' and 'filter’ combinators. A `for-none?` block rejects if the code block accepts any item, otherwise resulting in the input array. For example:

```
test {
  l = array{0} & 1 & 2 & 3

  // update each item with result of block on it
  check l for-all{+ 1} =? (array{0} & 2 & 3 & 4)

  // filter out rejected items
  check l query{check not=? 2} =? (array{0} & & 3)

  // filter and update together
  check l query{check not=? 2; + 1} =? (array{0} & 1 & 3)

  // check every item satisfies a condition
  check l for-all?{>? 0}

  // check no item satisfies a condition
  check l for-none?{<? 0}
}
```

### Accumulating

An `accumulate` block is used to accumulate a result by scanning an array.
```
array{0} & 1 & 2
accumulate {
  item: []
  sum: 0
  item + sum
}
check =? 3
```
An `accumulate` block must define two input items. The block will be executed repeatedly, like a `for-all`, feeding items from the input array into the first input item. The first item (named `item` in this example) must be an input referencing the template value with `[]`. The second input (`sum`) acts as an accumulator. On the first call it defaults to the defined value (0). On the second and subsequent calls, `sum` becomes the result of the previous call. This example is equivalent to the built-in `sum()` function that sums an array of numbers. An `accumulate` is  like a conventional _fold_ function, except that the accumulator value is defaulted in the definition instead of being supplied explicitly by the caller (though that is still possible, for example `sum(100)` starts the accumulator at 100).

> If an item is rejected, should it be skipped, or stop the accumulation?



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

An `on-update` block looks somewhat like a _callback_ in many conventional languages, but it is quite different because it is _static_: it is written into the definition of the formula and therefore known at compile time. There is no way to dynamically associate callbacks with interfaces at runtime. Another differencec is that there are severe constraints on what can be done inside an `on-update` block, as we will proceed to explain.

### Interfaces can be unstable

In both of the prior examples after the change to `f` has fed back into a change to `c`, a new value of `f` will be calculated from the new value of `c`. In these cases the new value of `f` is always the same as the value it was updated to. These are called _stable_ interfaces. But not all interfaces are stable. Some formulas are not stable (for example squaring a number), and even if the formula is stable, it may depend on other items which have also changed. An `on-update` block can easily cause instability by mangling the value, as in:

```
c: 0
f =|> c * 1.8 + 32 on-update{write 0 -> c}
```
which will react to any change to `f` by setting `c` to `0` which then makes `f` = 32. Now that is a pretty useless example. Here is a more useful unstable interface:

```
count: 0
button =|> false on-update{write count <- + 1}
```
The `button` interface is a boolean value set to false. Boolean values are represented in the UI as clickable buttons. Clicking the button changes the value from false to true, and also executes the `on-update` block, which increments `count`. The `button` interface is unstable because oit always reverts back to `false`, making it a “push button” that pops back out when pressed. 

### Change is unequal

In the button example above we used a boolean value that can be either true or false, and changed it from false to true to “press” the button. What if we changed it from false to false, as in `write button <- false`? Nothing would happen — the write would be ignored. Changes must change a value, otherwise they are ignored. This is an important principle, because it lets us aggregate changes. For example:

```
customers table{name: '', phone: ''}
new-customer =|> false on-update{write customers <- &()}
```

When the `new-customer` button is pressed we create a new item in the `customers` table. The `&()` function takes the current state of the customer table and results in a new table containing a new customer. The `write` then replaces the old value of the entire table with this newer bigger one. But since none of the prior customers were changed, we can safely ignore all those writes, and just add the new customer to the existing table. In fact we know this at compile time, so we can avoid doing any equality comparisons at runtime, and optimize to just performing an insertion. This is more than just a performance issue, because `customers` might have been an interface that would trigger on-update blocks whenever a customer changes (what databases call an _update trigger_).

The benefit of this approach is that we don’t need a special language feature that lets us insert into a table like a write statement. Many languages offer two ways to do things: a _purely functional_ way like the `&` function that returns a whole new value, and a _mutable_ way that lets you change an existing value “in place” like JavaScript’s `Array.push()`. Subtext has the single `write` statement that lets you turn any functional change into a mutation, based on the fact that writes only pay attention to changes in values, which is helped by the language tracking what values can possibly have changed. From this perspective, mutating APIs are a premature optimization that a smart language can do automatically.

### Feedback is responsive

Our examples so far have all been triggered by user actions. In general, change comes from the world external to the workspace, in the form of user actions, incoming network packets, or clock ticks. _There will be one exception to this rule: free-running processes called tasks._  Subtext records all external events as changes to the value of an input or interface. Changes to an interface propagate to other interfaces and inputs either by executing formulas in reverse or `on-update` blocks. The entire process of responding to external changes, called _feedback_, is governed by a number of rules. One of these rules is that feedback is quick — you can not perform large computations during feedback, as that would make the workspace unresponsive. Another rule is that feedback is _transactional_ : if one of several kinds of error occurs (to be discussed later) then the workspace is left unchanged. 

### Feedback is definite

Another rule of feedback is that `write` statements can not interfere with each other. When a write is made to some location in the workspace, no other writes can occur at that location during the current feedback transaction. Possibly interfering writes are detected at compile time, and not allowed to execute at all. For example, this is illegal:
```
button =|> false on-update{
  write count <- + 1
  write count <- * 2
}
```
If we want to make a sequence of changes like this we must instead chain the formulas into a single write statement like `write count <- + 1 * 2`. 

A more interesting case is this:
```
button =|> false on-update{write count <- + 1}
button2 =|> false on-update{write count <- + 1}
ganged-button =|> false on-update{
  write button <- true
  write button2 <- true
}
```
Here `ganged-button` triggers both `button` and `button2`. But they both change `count`, so this is illegal. Note that it is fine to have multiple interfaces that might conflict — it is only an error to change them within the same feedback transaction, as `ganged-button` does. Accordingly the user interface only lets the user push one button at a time.

Writes to array items conflict as if they were writing to the same item. For example:

```
a: array{0} & 1 & 2
i: 1
j: 2
button =|> false on-update{
  write a[i] <- 0
  write a[j] <- 0
}
```
this is an error because there is no guarantee that `i` and `j` are different. Even if we changed it to `i = 1, j = 2` the language isn’t _currently_smart enough to know they are different. One solution would be to sequence the updates as in:
`write a <- with{[i] := 1, [j] := 2}`
which will overwrite the value of `[i]` if `i` = `j`.

Another solution is:
`write a <- merge!(with{[i] := 1}, with{[j] := 2}}`
which checks at runtime that there is no conflict, crashing if there is. You can instead use `merge?` to reject on a conflict. The `merge` functions do a three-way merge, combining the differences between the source value and the two argument values. The unqualified `merge` function (without `!` or `?`) uses the same conflict rules as `write`, guaranteeing at compiled time there is no conflict. There is also a `merge-over`function that lets the second argument overwrite the changes of the first. Note that the `merge` functions work on arbirarily large values, up to an entire workspace, and in fact that is how workspace versions are merged.

### Feedback goes backwards

Since writes can not conflict, an interface can only be triggered once per feedback transaction, and the set of writes between interfaces forms a directed acyclic graph. To guarantee this property a simple rule is enforced: writes must go backwards. Technically this means backwards in the pre-ordering of the workspace tree structure, but that equates to the simpler rule that writes must refer to something defined earlier in the textual definition of the workspace. So this is illegal:

```
button =|> false on-update{write count <- + 1} // forward write error
count: 0
```

_Theoretically we could allow forward writes so long as they statically form a DAG, but physically ordering them is much simpler to implement and explain, and the error messages are more actionable_

### Feedback is oblivious

Feedback does not see the consequences of changes. For example:

```
button =|> false on-update{
  change: that
  assert{change =? true}
  assert{button =? false}
  let temp = count
  write count <- + 1
  assert{count =? temp}
}
```

The value of `change` must be true, because changes must change the current value and the only other possible value is true. But the `button` field still is false. Likewise the write to `count` doesn’t appear to have changed its value. This is because code running in an `on-update` block only sees the state of the workspace as it was at the beginning of the current feedback transaction. External inputs and internal writes are held separate until the succesful completion of the entire feedback. Until then, the only place these changes are visible is where they are passed as the input to an `on-update` block.

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

Updatable functions allways write to their source (except for a few exceptions). They treat their other arguments as read-only, and use their values prior to the feedback transaction. So feedback proceeds through a formula from bottom-up and right-to-left, the reverse of its execution order. Indeed one of the reasons for choosing chained infix operations in Subtext was that it defines a clear reverse order of execution. 

`try` blocks execute in reverse following the same rules. A write to the result of a try block is written to the result of the clause that produced it: the first satisfied clause. The choice made by a try clause remains frozen in its state prior to the feedback transaction, the same as all the formulas inside it.

There is one case where reverse execution is not strictly linear: the update operator `:=`. For example:
```
s: 'foo'
r: record{
  x: ''
  y: 0
}
t =|> r with {.x := s} 
```
Any change made to the interface `t` will get written to the update expression `.x := s`. Say the user modified the field `t.x` to be `'bar'`. Then `'bar'` will get written back to `s`. But if the user had modified `t.y` the change will pass through to `r.x`. Thus `:=` can switch changes in two directions.

### Internal feedback

Feedback is designed to handle external input, so we have been using examples of user actions to trigger changes. Recall the counter example:
```
count: 0
button =|> false on-update{write count <- + 1}
```
When the user clicks on the button the value true is writren to the field`button`, triggering the feedback process. This is actually implemented with code like this:

```
current-workspace = record {
  count: 0
  button =|> false on-update{write count <- + 1}
}
changed-workspace = current-workspace with{.button := true}
```

Here is the magic trick: feedback is a feature of the `:=` update operation. Normally we use `:=` to override input fields as data state or as arguments to a function. But when `:=` writes to an interface field, it internally runs a complete feedback transaction. At the end of the transaction, the final set of writes to input fields determine the final result of the update. 

Because all interactions between a workspace and the external world are encoded as value changes, we get universal testability. The `test` block make this convenient by passing the initial state of the containing workspace into a code block, and reports a test failure if the block rejects. For example:

```
count: 0
button =|> false on-update{write count <- + 1}
test {
  .button := true
  check .count =? 1
  check .button =? false
  .button := true
  check .count =? 2
}
```

There is an important safety restriction on internal feedback: it must stay internal. In other words, writes can’t escape. For example, this is illegal:
```
count: 0
sub-state = record {
  button =|> false on-update{write count <- + 1}
}
new-state = sub-state with{ .button := true}
```

Here the internal write to the `button` interface attempts to write `c`, which is outside the source of the update operation `sub-state`. This is a compile-time error. 

> Note that it might be possible to allow escaping writes by holding them pending inside the result of the update, allowing it to be executed later. You could say `write sub-state <- new-state` to execute those pending writes. This is theoretically interesting but it is not yet clear how useful it would be.



query interfaces (updatable views)
updatable block?
feeedback errors and transactions



# Appendix: TODO


## Relational data and queries

Subtext lets you work with relational data without learning SQL or understanding what a join is. A Subtext workspace already is a database, in the sense that it persists even after you turn off the computer. Traditional programming languages are concerned only with data in memory, and so must access persistent data stored externally in a database using completely different syntax and semantics. Consider this simple example database:

```
orders: table {
  id: ###
  customer: ''
}
order-lines: table {
  order-id: ###
  product: ''
  quantity: 1
}
```

This database contains a table of orders, each with a unique id number. Orders can include multiple products, which are recorded in the order-lines table. A common question to ask this database is to list the order-lines in a given order. This would normally require a query called a _join_. Subtext avoids this kind of query by defining _links_.

### `in` links

The fields `order-id` and `product-id` in `order-lines` are called _foreign keys_ in a relational database. This means their value refers to a matching value in the _primary key_ field of a table, which in this case are the `id` fields in `products` and `orders`. In Subtext we call foreign keys an `in` link and define them like this:

```
order-lines: table {
  order: in orders
  product: ''
  quantity: 1
}
```

The definition `order: in orders` says that the `order` field must contain a value that is present in the first field of the `orders` table in exactly one row.  If the value of `order` does not meet that constraint it is flagged in the UI as an invalid value. _It may also prevent a transaction from being committed — See Constraints_.

The UI will display an `in` link using a “combo box” control that can edits it by opening a view of the `orders` table and allowing one row to be picked with a checkbox. The UI will also provide an affordance in the table header that allows the `order` column to expand to show the entire corresponding record from the `orders` table.

Code can “follow” an `in` link with the metadata reference `.order^lookup?`. The metadata field `^lookup?` contains the corresponding record from the `orders` table. Thus for example the customer name could be accesses as `.order^lookup?.customer`. If the `order` is invalid, meaning there are no or multiple matching orders, then the access is rejected, signified  by the question mark in `^lookup?`. As usual the constraint can be asserted by using `^lookup!`.

> Note that for simplicity we require that the primary key be the first field, which is the standard convention. We also require that multiple-field “compound keys” be defined as a record in the first field.

### `from` links

To find all the `order-lines` in an order, we want to follow the link “backwards”. This is done by defining a `from` link on the opposite side of the `in` link, as follows:

```
orders: table {
  id: ###
  customer: ''
  order-lines = from order-lines.order
}
order-lines: table {
  order: in orders
  product: ''
  quantity: 1
}
```

The `from` link is defined inside the `orders` table as `order-lines = from order-line.order`. Following `from` must be a reference to a field of a table that defines an `in` link which points back to the containing table (`orders`). The value of the `order-lines` field in an order is a table of all the `order-lines` rows for that order. Note that Subtext allows fields of a table to be tables themselves, which is disallowed in relational databases. The benefit is there is no longer any need to write a query to find the order-lines in each order: they are automatically shown inside the `order-lines` field of each order.

Every `from` link must match an `in` link, but `in` links do not require a matching `from` link. However it will likely be good practice to pair them up. The UI will offer to create the matching `from` link for an `in` link, and may do so automatically.

### Nested tables

The preceding example is typical in relational databases, but is a bit silly in Subtext. Since Subtext allows nested tables, the most natural thing is to just nest order-lines inside orders:

```
orders: table {
  id: ###
  customer: ''
  lines: table {
    product: ''
    quantity: 1
  }
}
```

The UI will provide refactorings that convert between this and the previous linked form.

The `id` field might also be dispensed with by using a _tracked_ table instead (See Tracking):

```
orders: tracked table {
  customer: ''
  lines: table {
    product: ''
    quantity: 1
  }
}
```

### Advanced queries

Links eliminate many simple queries, but there can still be a need for queries in more complex cases. Let’s return to the original example and avoid using links to see how relational-style queries can be done. Here is the database again:

```
orders: table {
  id: ###
  customer: ''
}
order-lines: table {
  order-id: ###
  product: ''
  quantity: 1
}
```

To find the `order-lines` in an order we can use a `query` block (see Iterating):
```
order-lines query{.order-id =? order.id}
```

That formula will produce a table containing all the `order-line` rows for the order `order`. This is the equality constraint at the heart of  the _join_ operation in a relational query. However relational joins are typically expressed not just as doing a lookup for one order, but doing it for all of them at once, and combining the results into a big table where the order information gets duplicated for each order-line. While that may be appealing from a theoretical perspective, we feel that is not typically how people or programs prefer to see the information. Nevertheless if that is what you want, you can still do it in Subtext, which we will walk through in several steps:

```
orders for-all{
  order: []
  order-lines query{.order-id =? order.id}
}
```
This formula produces a table that updates each row of the `orders` table with a table of the corresponding `order-lines` rows. But that discards information from the orders table. So instead we can add a field to each order containing the order-lines:
```
orders for-all{
  order: []
  extend{
    lines = order-lines query{.order-id =? order.id}
  }
}
```
The `extend` block expects a record as its input, and adds all the fields defined inside its block to the end of that record. In this case we get a table that looks like this:
```
table{
  id: ###
  customer: ''
  lines: table{
    order-id: ###
    product: ''
    quantity: 1
  }
}
```
Note that this is equivalent to what we got by adding the `from` link to `orders`. We computed the same result using a `for-all`, `query`, and `extend`. But this is still not quite a relational join, because it contains nested tables. We can flatten out the nesting with an `ungroup()`:
```
orders for-all{
  order: []
  extend{
    order-lines query{.order-id =? order.id}
  }
}
ungroup()
```

The `ungroup()` function takes a table as input, and looks for the first field that is a nested table. It then updates that field with all the fields of its contained table. So in this case it produces the table:
```
table{
  id: ###
  customer: ''
  order-id: ###
  product: ''
  quantity: 1
}
```
The `ungroup()` function replaces each row of the input table with multiple rows of the expanded table, one per row of the nested table. The other fields outside the nested table are duplicated across all these rows. If the nested table (containing the query match) is empty, then the input row is skipped. That is exactly what an _inner join_ does in a relational query. Other kinds of joins can be produced by alternative forms of ungroup. The reason we call this `ungroup` instead of `join` is first, we think it is much more explanatory term, and second, it actually is the inverse of the `group()` function that will create a nested table to eliminate duplication in other columns.

We have seen above how joins can be done in Subtext through several operations. Those fond of SQL might criticize this as verbose and complex. We stand with those not fond of SQL, finding it an overly abstract and mathematical language that forces everything into the Procrustean Bed of normalized relations. We think nested tables are actually more friendly for both humans and programs.


## Parsing

It is common to need to find and operate on patterns in text. The traditional solutions involve specialized languages with radically different syntax and semantics, such as _regular expressions_ or _parser generators_. Subtext provides these capabilities without the need to learn a specialized sub-language.

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

## Repeated exports

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

## Missing values

_Null values_ are a perennial controversy in PL and DB design. The idea is to add a special value Null to all types of values in order to represent a “missing” or “unknown” value. Unfortunately Null adds complexity and more ways for code to break, or more language features to avoid breaking. FP languages avoid Null values by using Option wrappers (like Subtext choices), but at the cost of continually wrapping and unwrapping values.  NULL in SQL is a widely acknowledged disaster. We want to avoid this whole mess if possible.

We propose a simple solution for missing values that visualizes naturally in the UI:

1. There is a special number called `number` that corresponds to an empty numeric item in the UI. Numeric functions treat `number` as a special case, as Excel does with empty cells. Unlike IEEE NaN, `number` is equal to itself.
2. There are predefined missing values for each media type that serve as placeholders.
3. The missing value of a block has all its input items missing.
4. The missing value of a text or array or table is empty.
5. The missing value of a character is the space character.
6. The missing value of a boolean is `false`
7. There is no predefined missing value for choices. However as their first option is the default, it can be defined to be something like `NA?: nil` to serve as a missing value if desired. Also see `maybe` blocks below.

The `required` constraint (see _Constraints_) checks that an input item does not contain one of the above missing values.

Sometimes we really do need to have a special missing value. The `maybe` block converts a conditional formula into a choice, like a conventional Option type. For example `maybe{x?}` produces the choice:
```Txt
choice {
  no?: nil
  yes?: x
}
```
where the the `no?` option is chosen if `x?` rejects, and the `yes?` option is chosen and changed to the value of `x?` if it succeeds.

A `maybe` block is often useful in cases where we would like to change an input item with a conditional formula (which is illegal). For example we might want to use a conditional formula as a function input so that, instead of rejecting the call, the function itself gets to decide what to do. Wrapping the conditional formula in a `maybe` block permits that.

## Types

Subtext has no syntax for describing types: it only talks about values. Function inputs are defined with a default value, so no type needs be specified. For example in the definition `foo: number`, `number` is not the name of a type — it is just the special missing number value. Likewise error messages never talk about types — instead they point to a mismatch between values at two code locations, additionally referencing the code locations where they were defined.

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
required     // not missing (see Missing Values)
```

## Tracked arrays

An array is defined to be either _tracked_ or _untracked_. Untracked is the default. _Is this right?_
A tracked array automatically assigns a unique ID to each item when it is created. The ID is used to precisely track changes to the item. Such IDs are called _surrogate keys_ in databases. The tracking ID is hidden from the user and programmer. Tracking allows two important capabilities:

1. Relationships between tracked arrays can be maintained, similar to relational databases, but without requiring that every item contain a unique and immutable key (see Links)
2. Tracked arrays can be versioned and merged, similar to version control systems like git, except more precisely.

Two tracked arrays are equal if their items are not only equal but also were created in the same relative order, including all items that were deleted. Tracked equality means that the array not only have the same current state but also effectively the same history of changes.

Text is an an untracked array of characters. Two texts are equal if they have the same characters in the same order, regardless of their change histories.

> Tracked arrays could offer sorting by creation time, and creation-time could be used to order duplicates in an array sorted by value.

> The IDs in a tracked array are implemented as monotonically increasing serial numbers within the array, as in an “auto-increment” item in a relational database. We are not exposing this because merging may renumber items.

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
	| 'array' Block
	| 'table' Block

BaseValue :=
	| string				// single-quoted JS string literal
	| 'character' string	// character literal
	| number				// JS number literal
	| '###'			// Special missing number
	| 'true' | 'false'		// Booleans
	| 'nil'					// unit value
	| 'anything'			// generic value

Block := '{' Body '}'

Op :=
	| Path Arguments				// function call
	| 'continue' Arguments			// tail call
	| RelPath ':=' Formula			// update
	| RelPath '#' Name Formula?		// choose
	| 'write' Formula? '->' Path	// write
	| 'write' Path '<-' Formula		// updating write
	| RelPath						// navigate
	| Conditional
	| Control Block
	| 'include' Name
	| 'builtin' Name

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