# The Subtext Programming Language

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
* Code and data are combined into an autonomous artifact called a workspace which provides reproduceability, collaboration, version control, and schema change. A workspace changes both through direct manipulation by users and executing code within the workspace.
* Everything is nestable: programs, databases, and workspaces can all be nested inside each other. A Subtext workspace is a tree.
* All inputs and sources of randomness are recorded in the workspace history to make it autonomous and reproduceable.
* Subtext is both a PL and a DB: data is either persistent and transactional, or determinstically computed from such persistent data.
* What a user can do by direct manipulation of data and what code can do when executed are similar. The recorded history of user interactions and external inputs is in fact a program that can replay that history, or be used as raw material for Programming by Demonstration.  Conversely, a program can be understood as a script that a user could follow to perform the same operations. The language syntax and semantics have been designed to make these connections as direct as possible. For example, the syntax for replacing a value at a path within a tree, which looks like an assignment statement, is used to record user edits in the history.
* All code is strict, pure, and referentially transparent. Therefore programs are _functions_.
* Function execution is materialized as data, completely visible to the programmer using the same UI as for data. Materialized execution takes the LISP idea that _syntax is data_ and applies it to semantics: _execution is data_. Straight-line code is a record, loops are lists, and conditionals are discriminated unions. Calling is inlining.
* Materialized execution has an unconventional semantics: rather than seeing functions as _reducing to results_, they are seen as _expanding to traces_.
* One IF to rule them all: there is a single mechanism of conditionality: partial functions which either return a result or reject their input. Inspired by SNOBOL, this single mechanism provides conventional control structures, backtracking logic, pattern matching, assertions, and data invariants.
* Functions are not abstract entities, defined in one place then used in others. Instead functions, sometimes represented as formulas, compute a result from concrete inputs. Any such computation can be reused, with a conventional-looking call syntax, optionally replacing its input values. All functionms are continuously executing on concrete input values. Functions can be edited live, immediately seeing the execution results, as in a spreadsheet.
* Calling a function is materialized as inlining a copy of it. Lexical closures fall out of the way that relative paths within a subtree are mapped through copies.
* Functions can _export_ extra results, which do not need to be deconstructed at the call site as in conventional approaches. The exports of a function typically form a record. Exports of conditional clauses are combined into a discriminated union. Exports of a loop are collected into a list.
* Subtext is statically (parametrically) typed, but types are not mentioned in the language nor error messages. Concrete values serve as witnesses of types. 
* Lists are homogeneuoulyt typed. Lists of records serve as a table.
* Lists can be tracked by automatically assigning hidden unique IDs to their items. Tracking supports stable links into lists that act like database foreign keys with referential ingegrit maintenance. Tracking also supports precise workspace versioning and mergeing. 

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
- Items (called _outputs_) can be automatically derived from the state of other portions of the workspace as they change.
- The same structures are used to represent data and functions (as in LISP), but they also represent the execution of functions for inspection by the developer.
- There are cross-references within the tree. Cross-references can be dynamic only to the extent of selecting different items within a specific array — other than that, cross-references are static.

Subtext is statically typed, which conventionally means that the code and the types of values are fixed at _compile time_ and do not vary at _run time_. But there is no such thing as compile time in Subtext workspacess, which are always running and fully editable with their state stored persistently in a file. Subtext distinguishes between two kinds of changes: modifying data and editing the definitions of prgrams and data. It is possible to lock a workspace so that only data modifications are allowed — this is called _user mode_. In user mode data changes are highly constrained: data types are fixed. For example a number can’t be changed into text, and a newly created item in an array will have the same type as all the others. Only certain kinds of errors can occur in user mode. In _programming mode_ anything can be changed, which can lead to various sorts of inconsistencies called _static errors_, corresponding to the errors a traditional compiler might report. Static errors are reported to the programmer as problems in the workspace to be resolved, but unlike compiled languages, the workspace continues to function outside the implicated parts.

Although Subtext is statically typed in the above sense, there is no mention of types in the language syntax or error messages, because concrete values serve as witnesses of their types (see _Types_).


## Base values
Subtext provides several kinds of values out of which a workspace is built:

- _number_: double float using JavaScript syntax, and the special value `_number_` not equal to any other number (except itself)
- TODO: infinite precision rationals
- _text_: JavaScript string literal using single quotes: `'hello'`
- _character_: a unicode character
- `nil`, the unit value, useful in enumerations (see _Choices_)
- `anything`, the top value used to define generic functions (see _Types_)
- TODO: fancy text with fonts and formating
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
Every item is either an input or output. For example,
```
record {
  x: 0
  y = x + 1
}
```
The item `x` is defined as an input by being followed with a colon, whereas `y` is defined as an output by being followed by an equals sign. The item `x` can be modified by the user or a function.  But the item `y` is read-only — it is automatically computed from the value of `x` whenever it changes. Note that the UI will display the computed value of `y` on a line underneath it.

This is like a spreadsheet: cells containing a formula are outputs, and cells containing just values are inputs. But unlike a spreadsheet, input cells also have formulas (`0` in this example) which compute the _initial value_ of the cell. Unlike in spreadsheets, new items are often dynamically created, and so their inputs need to be given some initial value, which can be computed with a formula. In function blocks, the initial value of inputs serve as convenient default values. Input formulas execute once when the block is created, whereas output formulas execute whenever anything they depend on changes.

Note that the terms input and output mean different things in computational notebooks like Jupyter, where an input is a formula and the paired output is its value. Notebooks do not let the user directly edit a value as can be done with non-formula cells in a spreadsheet and input items in Subtext.

Subtext specifies how to pronounce its syntax. The above example syntax is pronounced “record of, x as 0, y equals x plus 1”. A `{` is pronounced “of”, `:` is pronounced “as”, and `=` is pronounced “equals”. Note that, unlike imany programming languages, `=` means the same thing as in mathematics — the left and right sides have the same value. The ':' means the left hand side originally had the same value as the right-hand side.

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
Every function has at least one input. In a call the first input is the value of the formula to the left of the reference to the function. A function may have more than one input, but only the first input must be supplied in a call — the extra input items have an initial value that serves as a default. A call supplying only the first input puts empty parentheses `()` after the function reference. Conventional infix notation can be used when only the first and second inputs are used, and the second input is a literal or reference, as in `x + 1`. If the second input is instead a more complex formula then it is put in parentheses, for example in `x +(y * 2)`. 

When a call supplies the third or later input of a function, shown in the last case above, the name of the input item is specified with the syntax `.input3 := formula3`, like the _keyword arguments_ in some languages. The design philosophy behind these conventions is that many programs have one or two inputs, and it is natural to read infix notation like an Object-Verb-Subject construct in English, not to mention the familiarity of infix notation in math. But when there are  more than two inputs, it is better to name their roles explicitly.

Formulas executely strictly left-to-right, which can violate the rules of arithmetic precedence. For example the formula `1 + 2 * 3` is equal to 6, not 7 as we have been taught. This becoes clearer if we use parentheses: `1 +(2) *(3)`. For that reason the UI will always fill in parentheses in program calls, but fade them out when they contains a single value, so that they still resemble the familiar parentheses-free infix notation, but hopefully still look different enough to break the expectations of arithmetic precedence. We retain the parentheses-free syntax because that is the expectation of this document’s audience of experienced programmers.

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

The first statement is just a reference to `x` but the last two statements are calls without a preceding input value: `+ 1` and `* 2`. In that case the value of the previous statement is used as the left input. We can see this as the value of statements flowing downward from the result of one formula into the start of the next formula. The result is the bottom value, which becomes the value of `y`. Note how this downward dataflow corresponds exactly to the rightward dataflow in the formula `x + 1 + 2`, with the result being the final value on the right. Thus data flows in formulas from left to right, and in outlined blocks from top to bottom. This matchs the reading order of English prose. 

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

> (possibole support for implicit inputs) We can abbreviate functions with just one input. For example:
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

Note that, unlike other languages, a function is not a separate entity or value — it is always the formula defininig an item, not the actual value of the item. In the prior example, 
```
plus = do {
  x: 0
  y: 1
  x + y
}
```
the value of `plus` is just 1, the result of executing the function, not a special kind of value representing a function. When we call the program, as in `1 plus 1` what we are really doing is reusing the function that defines the value of `plus` with different inputs. 

> In fact programs really are “first-class” values, but they are only used in the UI and planned metaprogramming capabilities.

### Block modification
So far all of the examples have used arithmetic. But it is very common to work with blocks, particularly records,  as they are the rows of tables. Take the record:
```
x: record {
  name: ''
  number: 0
}
```
This block contains two input items: `name`, which is an initially empty text, and `number`, which is initially the number `0`.

The essential operations on a block are to read and change individual items. We read the items using paths, like `x.name` and `x.number`. To change an item we use a _change operation_ with the special operator `:=`
```
x with{.name := 'Joe'}
```
This is pronounced “x with name becoming Joe”. The result of this operation is a record equal to the value of `x` except with the item `name` changed to `'Joe'`, while keeping the prior value of `number`. We used a `with` block to contain the change operation, which is like a `do` block except that it feeds the previous value into an array of operations, rather than starting with a value. The equivalent `do` block would be:
```
do{x; .name := 'Joe'}
```

We can chain multiple changes together:
```
x with{.name := 'Joe'; .number := 2}
```
Note how `.number :=` applies to the result of the previous change.

Change operations can delve into nested blocks by using a dotted path to the left of the `:=`
```
x: record {
  name: ''
  number: 0
  address: record {
    street: ''
    city: ''
}
y = x with{.address.street := '12 Main St'; .address.city := 'Springville'}
```

Instead of using dotted paths, we can nest `do` blocks:
```
y = x with{.address := with{.street := '12 Main St'; .city := 'Springville'}}
```
Note how the block is nested: `.address := with{.street := ...}`. Here `.address :=` passes the current value of `x.address` as the input to the `with` block on its right, and then changes the `address` item to be the result. This is an example of _default inputs_. We saw earlier how calls can take an input from the previous item. The change operation `:=` works similarly — any formula on the right will by default input from the current value of the item named on the left. Thus for example:

```
y = x with{.number := + 1}
```
will increment the value of the `number` item. Note how this looks like an _assignment statement_ in an imperative language, which modifies values “in place”. Subtext only modifies by creating new values, so in the above example `x` is not changed. Some functional languages force you to rebuild such new values “bottom up”. The Subtext `:=` operation does that automatically, copying an entire tree-structured value with one subtree replaced. Defaulting of inputs allows a `:=` to extract the current value at a path and transform it.

Change operations can only be done on input items, those defined with `:`, not outputs defined with '='.

Recall that `:=` is also used when supplying the third or later inputs when calling a function. This is not a cooincidence. For example:
```
ternary-function = do {
  input1: 0
  input2: 0
  input3: 0
  ...
}
x = 1 ternary-function(2, .input3 := 3)
```
The syntax `.input3 := 3` is actually a change operation on the `do` block of `ternary-function`. It changes the value of the `input3` input item to 3. The same thing happens with the second input, which is interpreted to mean `.input2 := 2`.

### Local variables

Inside a block an ouput item can be used to name an intermediate computation and then reference it by name later. This is called a _local variable_ in some languages. As we have seen, it is common in `do` blocks for values to flow downward from one item to the next. Local variables can break this flow, so there is special output qualifier `let` that lets the previous value flow “around” it:
```
...
let foo = ... // compute something from previous value for later
// input from value preceding the let statement 
```
This avoids having to invent a name:
```
temp = ...
let foo = temp ...
temp ... 
```
A `let` item is also hidden from references outside the block.

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
5. The remainder is exported with the name`remainder`
6. The `export` statement acts like a `let`, passing on the previous value, so `ratio` becomes the final result of the function. 
7. After the call, the item `y` references `x~remainder`, which imports the export `remainder` produced in the computation of `x`. We pronounce `x~remainder` as “x import remainder”.

What is going on here is that `x~` imports the exported value of the function that computed the value of `x`. A `do` block exports a record containing the values of all the `export` statements. The export `remainder` can be accessed as `x~.remainder`, or `x~remainder` for short. We also could have equivalently said `y = ~remainder` to import the export of the previous item without naming it.

Note that in the example above, `x` is defined as `x = 5 integral-divide 3`, which is equivalent to the `do` block: `x = do {5; integral-divide 3}`. There are no `export` statements in this `do` block. In that case, if the last statement (the call to `integral-divide`) has an export then it is exported from the whole do-block. That allows us to say `x~remainder`. You can also declare a single value to be the export of the entire block explicitly with a statement `export ...` that does not name the result, and which is only allowed if there are no other `export` statements in the block. This when there are no `export` statements, there is an implicit `export ~` at the end of the block re-exporting the exports of the final statement.

### TODO: Reference binding

The syntax uses conventional _lexical binding_, but the UI will not be constrained by that, nor subject to lexical shadowing. References starting with `.`, `~` or `that` are _dependent_ on the previous value.

> When the UI lets the developer make references that can’t be expressed lexically, we might want to automatically fix that by adding names to anonymous items and renaming shadowed items.

> References could support “search paths” like `x…y` that look for a `y` item that is reachable via any path from `x`. Likewise `…y` would look for any path to `y` from any containing scope. In these examples it is an error if there is more than one path leading to `y`. A possible exception to this rule is when all the paths go through alternative cases of a choice or clauses of a conditional, and further that they lead to items of the same type. If not all of the cases or clauses are covered then the path must be conditionalized like `…y?`. This feature gives us a convenient way to extract alternative information from choices and conditionals. Search paths might be intolerably fragile in a textual language, but an IDE can automatically repair them. In fact the reference editor in the IDE will provide all reachable paths of the right type, offering “… completion” rather than just “. completion”.

## Conditionals

When a function executes (including formulas), exactly one of the following things will happen:

1. The function crashes. A crash indicates a programming error, not a user error: some condition has arisen that ought to be impossible. A crash is reported to the workspace developer, including a snapshot of the workspace that can reproduce the crash. No changes are made to the workspace when an input event (including user actions) causes a crash. Sometimes crashes can be predicted ahead of time when formulas are being edited (for example type mismatches). These are called static errors and are presented to the developer as problems to be fixed. Unlike conventional compiler errors, static errors do not prevent the system from running, so long as the erroneous formula is not used.
2. The function is terminated before it completes because it has taken too long or used too many resources.
3. The function completes successfully, producing results.
4. The function intentionally _rejects_ without producing a result. Rejection means the function refuses to handle the input values supplied to it. Rejection is inspired by [SNOBOL](https://en.wikipedia.org/wiki/SNOBOL), which calls it _failure_, as do many parsing DSLs. We call it rejection rather than failure to make clear it is an intentional occurence, not a programming error (a crash).

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

> An alternative to prefixing `check` (and `let`) is to suffix `\`.

Only output items can be conditional, not input items, which would introduce problematic _null_ values. See _Missing values_ for further discussion of alternative techniques.

When a function rejects, what happens depends on the kind of block it is inside. Inside a `do` block (and other function blocks to be introduced later), rejection halts further execution, and causes the whole function block to reject. What happens next depends on the kind of block containing that block — if it is also a `do` block then the rejection continues to propagates into the containing block. This proceeds until the rejection reaches one of several kinds of block that handle rejections, for example the `try` block.  Rejection is like _exception catching_ in conventional languages, except that it is the single kind of exception supported, and it carries no extra information visible to the function.

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
All `test` blocks in the workspace are executed after programmer edits that could affect them (after all edits in the prototype implementation). If a rejection occurs inside the test block then it is treated as a static error, which is a problem for the programmer to resolve, but does not prevent the workspace from being used.

Each `test` block executes inside a copy of the workspace where all input items have been reset to their initial state. This reset workspace is also the input value to the `test` block. That way tests are isolated and reproduceable, even if they explore changes to the workspace. For example:
```Txt
x: 0
y = x + 1
test {
  check .x =? 0
  .x := 2
  check .y =? 3 // check modified state of y
  check y =? 1 // check initial state of y
}
```

### TODO: Termination

Sometimes a function takes too long to execute, or consumes too many internal resources.

> Simplest solution is that doc becomes read-only while reacting to an input, and then the results are shown atomically at completion. If computation takes too long the user can terminate it, which cancels the entire input action and leaves the workspace in its prior state. The input action remains in the history though and can be redone later if desired. Exceeding resource quotas (like stack size) would terminate computation automatically. This is the state of the art for computational notebooks.

> However it would be nicer to be able to interrupt a long-running execution, observe it’s execution so far, and resume if desired. That should probably wait for an implementation of incremental execution.

### TODO: Input event rejection, transactions, and constraints

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
The `expr` item can choose to be a `literal?` with a numeric value, or it can choose to be a `plus?`, with a value as a record containing items `left` and `right`, both of which are recursively another `expr` value. Choices always intially choose the first option (which can’t recurse so as to prevent infinitely deep values).

The names of the options have a question mark, because accessing them is conditional on their being chosen. For example `expr.literal?` will provide the numeric value of the `literal?` item if it is currently chosen by `expr`, but will reject if it isn’t chosen.

Choices are made with the _choice operation_ `|=`. For example:
```Txt
a-literal = expr |= literal 1
```
This pronounced “a-literal equals expr choosing literal one”. The `|=` expects a choice value on its left (`expr`) and to its right the name of an option without the question mark (`literal`), followed by a formula resulting in a value for the option. The right hand formula can be left out, which will change the option to its default value (0 for `literal`):
```Txt
a-literal = expr |= literal
```

The choice operation `|=` is similar to the change operation `:=`, except that it doesn’t require a dependent path on the left (one starting with `.`). However `|=` can also be used with a dependent path, which is useful when chaining nested choices:
```Txt
a-plus = expr |= plus with{.left |= literal 2; .right |= literal 2}
```
Note how, like a `:=`, the result of `.left |= literal 2` is the containing `plus` term, not the `left` term. That allows chaining the subsequent `.right |= literal 2` statement.

Note that `|=` always initializes the chosen option to its orginally defined value, even if it was already chose and had a different value. Likewise, the optional expression to the right of the option will be given a previous value that is the initially defined value of the option. Thus for example `|= literal + 1` will always result in 1. This is useful when function arguments are choices, for example `f(|= red)` will choose the initial value of the `red` option of a choice argument.

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
color |= red
```

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

Here the first try clause accesses the `literal?` option. If it was chosen, its numeric value becomes the result. But if `plus?` was chosen, then the first clause will reject and the second will execute instead, recursively evaluating the `left` and `right` items of the `plus?` option and then adding them together. We get pattern matching “for free” because accessing an option makes the entire containing try clause conditional on that option having been choosen.

## Arrays and tables

So far we have discussed various kinds of blocks. The other way data is combined is with an  _array_. An array is an ordered set of zero or more items containing values of the same fixed type. A _text_ is an array of characters. A _table_ is an array of records, where each record is called a _row_, and each of the fields of the record is called a _column_. Every array defines a value, called it’s _template_, which defines the default value for newly created items. For example:
```
numbers: array {0}
customers: table {
  name: ''
  address: ''
}
```
The array `numbers` contain numbers, defaulting to 0. The table definition `customers: table {...}` is equivalent to `customers: array {record {...}}`. The table contains columns `name` and `address` defaulting to the empty text. 

An array is initially created empty. Text is an array of characters with the space character as the template, so `'' =? array{\ }`

The `&` function (pronounced “and”) is used to add items to an array. For example:
```
n = numbers & 1 & 2 & 3
c = customers & with{.name := 'Joe', .address := 'Pleasantown, USA'}
```
The `&` function takes an array as it’s left input and an item value as its right input, resulting in an array equal to the input plus a new item with that value. The default value of the item is the template of the seqence. In a table it is often convenient to use a `with` block as above to change some of the columns and let the others default to their template values.

The `followed-by` function concatenates two arrays: `array1 followed-by array2` is a copy of `array1` with all the items from `array2` added to its end. The two array must have the same type template.

The items in an array are numbered starting at 1 for the first item. This number is called the item’s _index_. The number of items in an array (not counting the template) is called its _length_, available by calling the `length()` function. 

An item in an array can be accessed via its index using square brackets, as in:
```
n = numbers & 1 & 2
check n[1] =? 1
check n[2] =? 2
```

When an item is accessed, the index value is exported as `~index`:
```
x = n[i]
check x~index =? i
```

The template of an array is accessed with `array[]`. The formula `array[i]` will crash if `i` is fractional or non-positive or larger than the length of the array. You can test if an index is valid with:
```
array at? i 
```
which returns the item if the index is valid (and the index in `~index`), or rejects otherwise. The functions `first?()` and `last?()` will return the first and last item repectively, rejecting if the array is empty. 

Items in an array can be updated individually by index by using square brackets to the left of `:=`:
```
n = numbers & 1 & 2
test {
  .n[1] := 3
  check .n[1] =? 3
  check .n[2] =? 2
}
```
Individual items in a row can be updated similarly:
```
test {
  .customers[1].name := 'Joe Jr'
}

```
or equivalently using a `with` block:
```
test {
  .customers[1] := with{.name := 'Joe Jr.'}
}
```

We can delete an item in an array with the `delete` function, which results in an array with that item removed (crashing if there is no such row):
```
array delete i
```

We can delete all items from an array with the `clear` function.
```
array clear() length() =? 0
```

### Columns
A column of a table is an array containing the contents of one of the block items from each row. The columns of a table are accessed using `.` as if the table was a block containing the columns. For example:

```
t = do {
  table {
    name: ''
    amount: 0
  }
  & do{.name := 'joe', .amount := 100}
  & do{.name := 'jane', .amount := 200}
}

test {
  check .t.amount[1] =? 100
  check .t.amount sum() =? 300

  .t.amount[1] := 150
  check .t.amount =? (clear() & 150 & 200)

  // replacing whole column
  .t.amount := (clear() & 150 & 200)
}
```
A column  can only be replaced with an array of the same length as the table, otherwise it will crash. In a tracked tabled (see below) no insertions, deletion, or moves can have happened in the column.

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

## Searching

A `find` block searches in an array:
```
joe = customers find? {check .name =? 'Joe'}
```
The `find?` block is executed like a `do` repeatedly with items from the array as its input value, starting with the first item and continuing until it does not reject. The result is the first non-rejected item, with `~index` equal to the index. If all the items are rejected, the entire `find?` rejects (hence the suffix `?`).

Note that in this example the function block contains no input item — the input is referenced implicitly with `.name ...`. If we outline it in the UI we will see that one is created automatically to display the input value:
```
joe = do {
  customers 
  find? {
    input: customers[] // inserted automatically
    check .name =? 'Joe'
  }
}
```
The code is defined to input from the array template, and in each iteration that input item will become a successive item of the array.

A `find-last?` does the same thing as `find?` except that it scans the table backwards. A `find-only?` succeeds if there is exactly one match, and rejects if there are none or more than one. A useful special case is `array sole?()`, resulting in the single item of the array, rejecting if the array has 0 or multiple items. Another is `find-unique?{...}` that finds all matches and rejects if there are none or they are not all equal.  

### Replacing and aggregating

A `for-each` block will evaluate a `do` block on each item of an array in order, resulting in an unsorted array with items containing the results in the same order. If an item is rejected, it is left out of the result. The `for-all?` block is like `for-each` except it rejects if the code block rejects on any item, otherwise resulting in the replaced table. The `for-none?` block does the opposite, rejecting if the code block accepts any item, otherwise resulting in the input array. For example:

```
test {
  l = array{0} & 1 & 2 & 3
  
  // replace each item with result of block on it (like functional map)
  check l for-each {+ 1} =? (clear() & 2 & 3 & 4)
  
  // delete items on rejects (like functional filter)
  check l for-each {check not=? 2} =? (clear() & & 3)
  
  // replace and delete together
  check l for-each {check not=? 2, + 1} =? (clear() & 1 & 3)

  // check every item satisfies a condition
  check l for-all? {check >? 0}
  
  // check no item satisfies a condition
  check l for-none? {check <? 0}
}
```

An `aggregate` block is used to accumulate a result by scanning an array.
```
array{0} & 1 & 2
aggregate {
  item: that
  sum: 0
  item + sum
}
check =? 3
```
An aggregate block must define two input items. The block will be executed repeatedly, like a `for-each`, feeding items from the input array into the first input item. In this example we called the first input `item`, and define it from the default template value referenced as `that`. 
The second input (`sum`) acts as an accumulator. On the first call it defaults to the defined value (0). On the second and subsequent calls, `sum` becomes the result of the previous call. This example is equivalent to the built-in `sum()` function that sums an array of numbers. If the function rejects an item then it will be skipped and the accumulator value will be passed on to the next call. An `aggregate` is  like a conventional _fold_ function, except that the accumulator value is defaulted in the definition instead of being supplied explicitly by the caller (though that is still possible, for example `s sum(100)`).

## Tracked and untracked arrays

An array is defined to be either _tracked_ or _untracked_. Tracking is the default. A tracked array automatically assigns a unique ID to each item when it is created. The ID is used to precisely track changes to the item. Such IDs are called _surrogate keys_ in databases. The tracking ID is hidden from the user and programmer. Tracking allows two important capabilities:

1. Relationships between tracked arrays can be maintained, similar to relational databases, but without requiring that every item contain a unique and immutable key (see Links)
2. Tracked arrays can be versioned and merged, similar to version control systems like git, except more precisely. 

Two tracked arrays are equal if their items are not only equal but also were created in the same relative order, including all items that were deleted. Tracked equality means that the array not only have the same current state but also effectively the same history of changes.

Text is an an untracked array of characters. Two texts are equal if they have the same characters in the same order, regardless of their change histories.

> Tracked arrays could offer sorting by creation time, and creation-time could be used to order duplicates in an array sorted by value.

> The IDs in a tracked array are implemented as monotonically increasing serial numbers within the array, as in an “auto-increment” item in a relational database. We are not exposing this because merging may renumber items.

### Links

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

### Reflected links
When a link is used inside a row of a table, it is often useful to have a _reflected_ link in each row of the target table that is its inverse. When a row in the source links to a row in the target, the target will link back to it, and vice-versa. In data modelling this is called a _relationship_. For example:
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


### TODO: Nested links
Links can target nested arrays, linking to a path of IDs. Reflecting links can cross multiple layers of containing arrays. Cardinality constraints are specified seperately for each level of nesting. 

### TODO: link updates and referential integrity

### Merging

Copies happen. Workspaces get shared as email attachments. Workspaces get incorporated into other workspaces. Inevitably both the copy and the original change. Tracking allows such changes to be later sent to the other version without wiping out all the changes that have happened to it in the meantime. This is called _merging_. 

Two copies of a tracked array can be compared to see exactly how they have diverged. The IDs in a tracked array allow changes made to an item to be tracked despite any changes made to its value or location. Deletions and creations are also known exactly. Tracking provides more precise information than text-based version control systems like git. 

Changes made to one copy can be merged into the other. If changes are merged in both directions the two copies become equal again. Sometimes changes made to both copies are such that merging must lose some information, for example if the same item in the same item is changed to be two different numbers. Merging can be done using an automatic policy to resolve such conflicts, or human intervention can be requested, either immediately in the UI when performing the merge, or later by reifying such conflicts into the workspace itself (but without breaking the workspace as textual version-control does).

Merging can be done across copies of entire workspaces. Merging can also apply to workspaces included inside another workspace (see _include_ and _variant_). Merging applies to all tracked arrays and links within a workspace. Non-tracked arrays (like text) are treated like base values that change as a whole.

TODO: details.

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

Another useful matching function is `match-number?` which matches a numeric text and exports its numeric value as `~value`. For example:
```
'123foo' 
match-number?()
check after() =? 'foo'
check ~value =? 123
```

When a matching function does not see the expected pattern in the input, it rejects. This means it is easy to use `try` blocks to test for alternative patterns. Here is a classic textbook example of matching a little languge of addition formulas:

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
'Some Millenials attacking other Millenials' 
repeat {
  optionally {
    scan? {match? 'Millenial'}
    replace-selection 'snake-people'
    continue()
  }
}
combined() =? 'Some snake-people attacking other snake-people'
```
The `replace-selection` replaces the selected part of the left-hand input with the right-hand text. Note that replacing the selection does not affect subsequent matches, which work on the after-part, so replacement can be done “on the fly”. The `combined()` call at the end converts the final selection back into a plain text by concatenating the before, selected, and after parts.

## Missing values
_Nulls_ are a perennial controversy in PL and DB design. The idea is to add a special value Null to all types of values in order to represent a “missing” or “unknown” value. Unfortunately Null adds complexity and more ways for code to break, or more language features to avoid breaking. FP languages avoid Null values by using Option wrappers (like Subtext choices), but at the cost of continually wrapping and unwrapping values.  NULL in SQL is a widely acknowledged disaster. We want to avoid this whole mess if possible.

We propose a simple solution for missing values that visualizes naturally in the UI:

1. There is a special number called `_number_` that corresponds to an empty numeric item in the UI. Numeric functions treat `_number_` as a special case, as Excel does with empty cells. Unlike IEEE NaN, `_number_` is equal to itself.
2. The empty text represents a missing text.
3. There are predefined missing values for each media type that serve as placeholders.
4. The missing value for a block has all its input items missing.
5. The missing value for an array is empty.
6. There is no predefined missing value for choices. However as their first option is the default, it can be defined to be something like `NA?: nil` to serve as a missing value if desired. Also see `maybe` blocks below.

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

Subtext has no syntax for describing types: functions only talk about values. All inputs are defined with a default value, so no type needs be specified. For example in the definition `foo: _number_`, `_number_` is not the name of a type — it is just the name of the special missing number. Likewise error messages never talk about types — instead they point to a type mismatch between values at two code locations, additionally referencing the code locations where their types were defined.

We believe that type systems are an essential formalism for language theoreticians and designers, but that many language users would prefer to obtain their benefits without having to know about them and write about them.

_FIXME: simpler: names are nominal, everything else is structural_
In PL theory terms, Subtext mixes aspects of structural and nominal type systems. It is structural in that `x = array{0}` and `y = array{1}` have the same type. It is nominal in that `x = record {a: 0}` and `y = record {a: 0}` have different types. Every time a block item is defined a globally unique ID is assigned to it. There is a workspace-wide dictionary that maps these item IDs to their current names. Renaming a block item just changes that dictionary entry. Type equality requires that block item IDs be equal, not that their names are currently spelled the same.

> TODO: To share item IDs across different types of blocks we can use a traits-like mechanism that merges and restricts blocks. Deferred until we have the need.

Subtext doesn’t have function types or higher-order values. Two values have the same type if they have the same data type and all embedded code is equal (modulo internal paths). Value equality requires type equality, so equal values are behaviorally equivalent, i.e. referentially transparent.

Generic (parametrically typed) functions are defined with inputs using the special top value `anything`. For example the `&` function to add items to an array has the signature:

```
& = do {
  input: array {anything}    // input must be an array
  item: input[]              // item must match array template
}
array{0} & 1      // this will insert 1
array{0} & ''	   // this will report a type mismatch static error
array{0} &()      // this will insert 0
```

A generic function is one with an input containing `anything`. The function can be called with any input value where the `anything` occurs. Every call of a generic function will recompute the input default values based on the actual input values before becoming the value from the call. Inputs to the call are type-checked against those new defaults. Note that type checking is still static: every call to a generic function gets statically checked — types can not vary dynamically, only across different call-sites. It is notable that we acheive parametric types without introducing an explicitly parametric type system with type variables like `<T>`, which are notoriously baffling to beginners. Yet unlike template meta-programming, we retain static type checking at call sites for comprehensible errors.

# Appendix: Glossary

# Appendix: Syntax

```
Workspace = Body

Body :=
	| Item 
	| Item? (';' | '\n') Body?

Item :=
	| GuardedName ':' Formula				// input
	| Dataflow? (GuardedName '=')? Formula	// output

GuardedName := Name ('?' | '!')?
Name := Word | Operator
Word := [a-z A-Z] ([a-z A-Z 0-9 _ \-]* [[a-z A-Z 0-9])? // can't be keyword
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
	| string			// single-quoted JS string literal
	| number			// JS number literal
	| '_number_'		// Special missing number
	| 'nil'				// unit value
	| 'anything'		// generic value

Block := '{' Body '}'

Op :=
	| Path Arguments				// function call
	| 'continue' Arguments			// tail call
	| RelPath ':=' Formula			// change 
	| RelPath '|=' Name Formula?	// choose
	| RelPath						// follow
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
	| 'not?'
	| 'test'
	| 'assert`
	| 'find?'
	| 'find-last?'
	| 'find-only?'
	| 'find-unique?'
	| 'for-each'
	| 'for-all?'
	| 'for-none?'
	| 'repeat'
	| 'scan'
	| 'aggregate'

Path := GuardedName? RelPath
RelPath := step*
Step :=
	| '.' GuardedName			// data
	| '~' GuardedName?			// import
	| '^' GuardedName?			// metadata - internal use only
	| '[' Formula? ']'			// Index
```