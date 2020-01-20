# The Subtext Programming Language

Subtext is searching for the missing link between spreadsheets and programming. It is an interactive medium for data processing by people who don’t want to learn how to program.  For example, scientists who want to process data without becoming “data scientists”. Or people who want to build simple custom apps without learning to program. Spreadsheets primarily fill this role, but they have significant limitations. The goal of Subtext is to merge the power of programming with the simplicity of spreadsheets, without inheriting all the complexity of modern programming.  That said, there is indeed a programming language at the foundation of Subtext. This article specifies that language through examples as a way to solicit feedback from other researchers.

Subtext tries to be simple, transparent, and informal:
1. Simple — easy to learn and easy to use.
2. Transparent — the history of user interaction and program execution are visible in complete detail.
3. Informal — doesn’t require abstraction, premeditation, or mathematical/computational thinking.
Subtext rejects:
1. Low level, high performance, or large scale software — being extreme in any dimension.
2. Requiring knowledge of existing software technology and practices beyond using a browser.
3. Appealing to the tastes of professional programmers or computer scientists.

These goals require changing not just the programming language but the entire programming experience. Much of this experience is still just a vision — this article discusses the language design decisions we have made to enable that vision, but without being able to go into much detail about what the experience will actually be. Nevertheless we must say a few things up front. Many programming languages presume that the programming experience is a text editor. Subtext instead provides an interactive environment with structured editing offering high-level code transformations, and live execution. As such, a complete textual representation would need to be a serialization format not well suited to manual editing. We will defer these concerns by assuming that all of the examples in this article are compiled into a fresh Subtext document and not subsequently edited. Also note that the ASCII syntax presented herein may diverge significantly from what the developer sees on screen, where we can exploit graphics, typography, and layout. For example, the curly brackets around blocks may render as rectangular regions; comments and labels may render in the margins. But syntax still matters, as it is the most effective way to communicate the design of the language in papers, which are still the primary medium of research. Syntax is also highly effective for testing and bootstrapping. As such, we have tried to keep the syntax reasonably readable and credibly usable.

> Discussion of design alternatives will be placed in notes like this.

## Notable features

This section summarizes the notable programming language features of Subtext which are discussed throughout the document.

* Code and data are combined into autonomous _documents_ that provide reproduceability, collaboration, version control, and schema change. Documents change both through direct manipulation by users and executing code within the document.
* Everything is nestable: programs, databases, and documents can all be nested inside each other. A Subtext document is a tree.
* All inputs and sources of randomness are recorded in the document history to make it autonomous and reproduceable.
* Subtext is both a PL and a DB: data is either persistent and transactional, or determinstically computed from such persistent data.
* There is a close relationship between what a user can do by direct manipulation of data and what code can do when executed. The recorded history of user interactions and external inputs is in fact code that can replay that history, or be used as raw material for Programming by Demonstration.  Conversely, code can be understood as scripts that a user could manually enact to perform the same operations. The language syntax and semantics have been designed to make these connections as close as possible. For example, the syntax for replacing a value at a path within a tree, which looks like an assignment statement, is used to record user edits in the history.
* Reified execution: code execution is materialized as data, visible both to the programmer and reflectively to the program itself. For example, the execution of a parser is itself an AST data structure.
* Reified execution takes the LISP idea that _syntax is data_ and applies it to semantics: _execution is data_. Straight-line code is a record, loops are lists, and conditionals are discriminated unions.
* Reified execution has an unconventional semantics: rather than seeing programs as _reducing to results_, they are seen as _expanding to traces_.
* One IF to rule them all: there is a single mechanism of conditionality: partial functions which either return a result or reject their input. Inspired by SNOBOL, this single mechanism provides conventional control structures, backtracking logic, pattern matching, assertions, and data invariants.
* Functions are not abstract entities. Instead the formula computing any field can be “called” and supplied with alternate subject and argument values to use. As a result all code is always executing on concrete input values. Code can be edited live, immediately seeing the execution results, as in a spreadsheet.
* Calling a function is essentially inlining a copy of it. Lexical closures fall out of the way that relative paths within a subtree are mapped through copies.
* A function argument has access to the static type of the parameter definition. For example this avoids the redundancy of `insertRow(new Row())` instead of just `insertRow()`. A function argument also has access to the default value of the parameter, which the function can compute dynamically based on the value of the subject and prior arguments.
* Functions can have extra result values, which do not need to be explicitly captured at the call site as in other approaches. Extra result values are provided by allowing access into the execution of the function itself, seen as a data structure. Sequential code is a record, loops are a list, and conditionals are a sum. In this way extra results inside a loop are automatically collected into a list, and extra results in a conditional are automatically combined into a sum.
* Hidden types: Subtext is statically typed, but types are not mentioned in the language nor error messages. Concrete values serve as witnesses of types.
* Parametric polymorphism (generics) are provided without exposing the concept of a type parameter.  Generics fall out almost for free from the ability to have dynamically defaulted parameters described above.
* There is one form of sequential data structure: the _list_, which when containing records serve as _tables_.
* Lists can be tracked by automatically assigning hidden unique IDs to their items. Tracked ists support _links_ which chose one or more items from a _target_ list. Links serve as foreign keys in databases. Tracked lists also allow precise document versioning and mergeing. 

### Intentionally excluded features

* Separate compilation
* Subtypes, interfaces, typeclasses (but maybe traits)
* First-class functions (generics are enough)
* The stack and the heap (and garbage collection)


## Documents

The artifact that Subtext mediates is called a _document_. It is somewhat like a spreadsheet (e.g. Excel) in that it presents both data and formulas in a visual metaphor that is easy to learn. It is somewhat like a notebook (e.g. Jupyter) in that it offers the full power of a programming language. These artifacts are characterized by their geometry: notebooks are a linear list of cells; spreadsheets are a 2-dimensional grid of cells; Subtext documents are a tree of cells.

- Subtext documents are built out of two things: data and formulas. There are a predefined set of types of data like numbers, text, and times. Formulas are built from a predefined set of _operations_ and _functions_ which process data.
- Documents are built up in two ways: _blocks_ and _lists_.
- A block is a fixed group of _fields_ holding data and formulas. Fields can be named. There are different kinds of blocks. A _record_ block gathers a set of fields to be handled as a group, similarly to _structs_ and _objects_ in other languages. The entire _document_ is a top-level block. A _choice_ block gathers a set of fields out of which exactly one must be chosen,  similarly to _variants_ ,  _sums types_, and\_discriminated unions\_  in other languages. There are several kinds of _code_ blocks similar to traditional PL control structures, with their fields corresponding to statements.
- Lists contain contain zero or more _items_ of the same type. When a list contains records it is called a _table_, and the items are called _rows_. 
- In analogy with spreadsheets, the “cells” of a Subtext document are the fields and the items. A tree structure is built up by nesting blocks and lists. A Subtext document is a whole tree.

The tree structure of Subtext documents strike a nice balance: they are more flexible and dynamic than the grid of a spreadsheet, yet simpler and more visualizable than the graph-structured data of imperative programming languages.

Subtext is statically typed, which conventionally means that the code and the types of values are fixed at _compile time_ and do not vary at _run time_. But there is no such thing as compile time in Subtext documents, which are always running and fully editable with persistent state. Subtext distinguishes between two kinds of changes: modifying data and editing code or definitions. It is possible to lock a document so that only data modifications are allowed. Data modifications are highly constrained: data types are fixed (a number can’t be changed into text), and changes are limited to data updates, choices, list insertions and deletions. Only certain kinds of errors can occur during data modification. In contrast, code editing can change anything, and can lead to various sorts of inconsistencies called _static errors_, corresponding to the errors a traditional compiler might report. Static errors are reported to the programmer as problems in the document to be resolved, but unlike compiled languages, the document continues to function outside the affected parts.

Although Subtext is statically typed in the above sense, there is no mention of types in the language syntax or error messages, because concrete values serve as witnesses of their types (see _Types_).

Nesting blocks and lists leads to a tree structure somewhat like those of statically typed FP languages, except that:
- They are mutable.
- The same structures are used to represent data and code (as in LISP), but they also represent the execution of code. We call this _reified execution_.
- Some parts of the tree can be dynamically computed from other parts via cross-references.
- A _link_ can dynamically select one or more items from a specific target list. Links are like foreign keys in a DB. Links are also like pointers in that you can “write through” them into the target list, but in a way compatible with pure functional semantics. See _Synchronized links_.
- Cross-references within the tree are static. Links can dynamically change which items they link to, but the list containing those items is known statically, which limits the damage they can do.

## Base values
Subtext provides severl kinds of values out of which documents can be built:

- _number_: double float using JavaScript syntax, and the special value `_number_` not equal to any other number. 
- TODO: infinite precision rationals\_ - _text_: a JavaScript text literal using single quotes: `'hello'`
- TODO: fancy text with fonts and formatting
- `nil`, the unit value, useful in enumerations (see _Choices_)
- TODO: date-times
- TODO: media (MIME-typed blobs)

> Of course a language for scientific computing must support units of measure. Except that the most popular ones don’t! This is a solved problem, and we should add units as soon as we can.

## Blocks and fields

One way Subtext documents are constructed is with _blocks_ (the other is _listss_) . Blocks contain a fixed sequence of _fields_, which can be given names. Blocks are defined with curly brackets preceded by a keyword indicating the kind of block. The most basic kind of  block is a _record_. Records are like structs or objects in other languages, and rows in relational databases. For example:
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
This record defines two fields, one named `x` which has the value `0`, and one named `y`, whose value is a nested record with numeric fields named `i` and `j` with values `0` and `1` respectively. The names of the fields within a record must be different. Fields inside blocks are referenced from the outside using a dotted path like `b.y.j` pronounced “b dot y dot j”.

Fields can be separated across lines and indented as in the above example, or combined in a line separated by semicolons:
```
b: record {x: 0, y: record {i: 0; j: 1; k: 2}}
```
The UI lets you flip between these two formats.

A field is either a _datum_ or a _formula_. Every data field is defined with a name followed by a `:` followed by a formula. The formula determines the initial value of the field. A data field can be changed to a different value later by the user or code (but only to a value of the same type - to change the type the formula must be edited). We pronounce `x: 0` as “x is 0”.

The other kind of field is a _formula_, which uses `=` instead of `:`. Formulas are like the formulas in a spreadsheet. For example:
```
x: 0
y = x + 1
x + 2
```
The second line is pronounced “y equals x plus 1”. The field `y` will always be one greater than `x`, and will be recalculated if `x` changes. The third line is a formula field too, but without a name or the `=` symbol.

> The distinction between `:` and `=` may be too subtle. Possible alternatives are to `:` are:
> ```
> x = data 0
> x = init 0
> ```
> but that can get verbose:
> ```
> b = data record {
>   x = data 0
>   y = data record {
>     i = data 0
>     j = data 1
>     k = data 2
>   }
> }
> ```

### Expressions
In the formula `y = x + 1` the part to the right of the `=` is called an _expression_. This expression starts with the _value_ `x` followed by the _function call_ `+ 1`. An expression value can be either a literal like the number `1`, or a _reference_ to a field somewhere in the document, like `x`. References can be a _path_ of multiple names separated by `.`, as in `b.x`, pronounced “b dot x”, which refers to the `x` field of the block `b`. Other kinds of paths will be described later.

A function call starts with a reference to a function, in this case `+`, the built-in addition function. The function reference is followed by parentheses containing zero or more _arguments_ to the function. When there is only one argument and it is a value, the parenthese are optional: so `x + 1` is equivalent to `x +(1)`. All functions operate on the value to their left, which is called their _input_, and additionally zero or more arguments in parentheses to their right. So in `x + 1` and `x +(1)` the input to the `+` function is the value `x` and the single argument is the value `1`. There is no such thing as a function with no input. If a function call has no arguments it uses empty parethenses as in `x negate()`. Arguments can also be expressions, in which parentheses must be used, for example `x +(y * 2)`. If a function takes more than one argument it uses a “keyword” syntax for the extra arguments: `value fnc(arg1, .param := arg2)`. All arguments are optional, and will be given a default value if unspecified in the call.

Expressions executely strictly left-to-right, which can violate the expectations of arithmetic precedence. The expression `1 + 2 * 3` is equal to 6 not 7. This is clearer if parenthese are used: `1 +(2) *(3)`. For that reason, the UI will always fill in parentheses in function calls, but fade them out in the case of a single value argument, so that they still resemble the familiar parentheses-free form, but hopefully still look different enough to break the expectations of aratithmetic precedence. We retain the parentheses-free form in the syntax because that is the entrenched expectation of experienced programmers, who are the audience for the syntax.

> References will support “search paths” like `x…y` that look for a `y` field that is reachable via any path from `x`. Likewise `…y` would look for any path to `y` from any containing scope. In these examples it is an error if there is more than one path leading to `y`. A possible exception to this rule is when all the paths go through alternative cases of a choice or clauses of a conditional, and further that they lead to fields of the same type. If not all of the cases or clauses are covered then the path must be conditionalized like `…y?`. This feature gives us a convenient way to extract alternative information from choices and conditionals. Search paths might be intolerably fragile in a textual language, but an IDE can automatically repair them. In fact the reference editor in the IDE will provide all reachable paths of the right type, offering “… completion” rather than just “. completion”.

### Vertical dataflow
In the expression `y = x + 2 * 3` the result of the `+` operation flows rightward to be the input to the `*` function. Values can also flow vertically between fields, like this:
```
x
+ 2
y = * 3
```
We could rephrase that as:
```
x
+ 2
* 3
y = that
```
where `that` is a special expression that refers to the value of the previous field.

> We might want to make vertical dataflow more explicit by using `that` at the beginning of expressions, as in:
```
x
that + 2
y = that * 3
```
> Or possibly `^`, figuratively pointing up at the value being used.
```
x
^ + 2
y = ^ * 3
```
> The UI may annotate to indicate vertical dataflow, so we will defer elaborating the syntax until that is explored.

## Code blocks
Recall that record blocks can be seen either as a single line or as multiple lines with brackets and indentation. The same is true for formulas. Formulas are shown on a single line. But formulas are actually stored as a _do-block_, which is revealed when you choose to display the formula vertically, as in:
```
y = x + 1 * 2
// is equivalent to
y = do {
  x
  + 1
  * 2
}
```
which exploits the fact that data flows both horizontally and vertically. A do-block is an example of a _code block_. Code blocks, like all blocks, consists of a sequence of fields, either data or formulas. In this example there are three unnamed formulas: `x`, `+ 1`, `* 2`. Both of the function calls have no value to their left, which means that they take as input the value of the previous field. So the value of `x` is the input to `+ 1`, whose result is the input to `* 2`. Code blocks produce a result, which is the value of the last field, which becomes the value of `y`. Note that the top-down dataflow within the block corresponds exactly to the left-right dataflow within formulas.

A code block can take an input value on its left like a function call. We can refactor the above code into:
```
y = x do {
  + 1
  * 2
}
```
Here the value of `x` is the input to the do-block, and thus the input to the initial call `+ 1 `. 

Code blocks are more general than formulas because they can contain more kinds of field than formulas (not just values can function calls). Code blocks also grow much larger while still being readable. Another advantage is that the UI  shows the value of each field underneath it, as in computational notebooks like Jupyter. Thus any formula can be flipped into the vertical block view to see a “mini notebook” showing every step of its execution. This total visibility of execution is a primary goal of Subtext.

### Setting fields
So far all our examples have used arithmetic. But it is very common to work with records, especially as they are the rows of tables. Take the record:
```
x: record {
  name: ''
  number: 0
}
```
This record contains two data fields: `name` which is an initially empty text, and `number` which is initially the number `0`.

The essential operations on a record are to read and change individual fields. We read the fields using paths, like `x.name` and `x.number`. To change a field we use a _set operation_:
```
x.name := 'Joe'
```
We pronounce this “x dot name set to text Joe”. The result of a set operation is a record equal to the value of `x` except with the field `name` set to `'Joe'`. Note that the value of `x` is not changed as a result of this operation: a new and different record value is produced. We might give this new record a name, as in:
```
y = x.name := 'Joe'
```
We can chain multiple updates using a code block:
```
y = do{x.name := 'Joe'; .number := 2}
```
Note how `.number :=` applies to the result of the previous update. We could rephrase this as
```
y = x do{.name := 'Joe'; .number := 2}
```
Note that the following variant would be wrong:
```
y = do{x.name := 'Joe'; x.number := 2}
```
that code loses the update to `name` because the update to `number` goes back to the original value of x. This is reported as a _unused value_ static error.

Set operations can delve into nested record by using a dotted path to the left of the `:=`
```
x: record {
  name: ''
  number: 0
  address: record {
    street: ''
    city: ''
}
y = x do{.address.street := '12 Main St'; .address.city := 'Springville'}
```

Instead of using dotted paths, we can nest blocks:
```
y = x do{.address := do{.street := '12 Main St'; .city := 'Springville'}}
```
Note how the block is nested: `.address := do{.street := ...}`. Here `.address :=` passes the current value of `x.address` as the input to the do-block on its right, and then sets the `address` field to be the result. This is an example of _default inputs_. We saw earlier how operations in a do-block take their input from the previous field. Something similar happens with a `:=` — any operation on the right will by default input from the current value of the field named on the left. For example:
```
y = x.number := + 1
```
will increment the value of the `number` field. Default inputs are also supplied to function arguments, to be discussed later.

### Defining functions
A function is a code block that starts with data fields naming its input and arguments, for example:
```
plus = do {
  in: 0
  addend: 1
  in + addend
}
```
When this function is called, as in `1 plus 2`, the value on the left, 1, is set into the first data field, `in`. The argument 2 is set into the second field, `addend`, resulting in:
```
do {
  in: 1
  addend: 2
  in + addend
}
```
which produces the result 3.

Functions with more than one argument must name the extra arguments in the call, like this:
```
ternary-function = do {
  in: 0
  arg1: 0
  arg2: 0
  ...
}
x = 1 ternary-function(2, .arg2 := 3)
```
The rule is that the first defined argument is anonymous in the call. Note that named arguments use the same notation `:=` as a set operation. That is because they actually are set operations, overriding the data fields of the function. The first argument implicitly uses a set operation too: `.arg1 := 2`. Because arguments use set operations, we get defaul argument inputs. Thus for example `1 plus(+ 1)` will increment the default value of the argument (from 1 to 2), with a final result of 3. This is a contrived example, but we will see more useful cases later with choices and lists.

There difference between functions in Subtext and most other languages: functions are expressions, not values. Look at this function:
```
increment = do {
  in: 0
  in + 1
}
```
The value of the `increment` field is just 1, the result of executing the function on the default input and argument values. It is not a “function value”. We could have equivalently defined it as:
```
increment = 0 + 1
```
which is equivalent to
```
increment = do {
  0
  + 1
}
```
which is the same as the function without the `in:` label. The call `x increment()` takes the expression defining `increment` and sets its first value to the value of `x`. The result is exactly the same in all of the above alternative definitions of `increment`.

What this means is that any formula can be used as a no-argument function (taking just an input). In most languages, if we have a formula that we want to reuse elsewhere we must copy it out into a separate function definition, and supply a name for the input, and further we should abstract the original formula into a call to the new function. In Subtext we can instead just call the formula as a function. However if we want the function input to be other than the first value, or we want there to be arguments, then we need to use a do-block. But even then there is no need to abstract out a separate function definition. We can just expose the formula as a do-block, then edit it into the function-block we want, without defining a new field. The original field still gets the result of executing that function block on the default values as if it were a formula. This approach to functions is motivated by a major goal of Subtext: avoiding the need for premature abstraction.

> Possibly it is confusing to call formulas, and we should first refactor them into a function form. 
> ```
> increment = 0 + 1
> ```
> could be refactored into
> ```
> increment = do{in: 0; + 1}
> ```

> Formulas like `+ 1` have a hidden input field, which is revealed when expanded vertically
> ```
> do {
>   that
>   + 1
> }
> ```
> The hidden input field is used by the UI to show the input value in context. The input field is also needed to call the formula and substitute in the actual input value. We do not want to force the syntax to include these placeholder input fields, rather to just say:
> ```
> do {
>   + 1
> } 
> ```
> The compiler will generate an input field automatically for a code block unless:
> 1. the first field is a datum (function input), or
> 2. the first field is a formula starting with a literal or reference (not an operation), or
> 3. the first field is the formula `that`

### Local variables

Inside a code block formulas can be used to name intermediate computations and then reference them by name later. This is called a _local variable_ in some PLs, but in Subtext is it is just a normal named formula field. However it is common to chain statements, feeding the result of one into the input of the next. Local variables often break this flow, so there is special statement qualifier `let`:
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
Inside a record block, `let` will also hide visibility of the name from outside the block. 

### Extra results and formula values

The result of a function is the value of the last field. However we often would like to return extra results from a function. For example, integral division would like to return not only the integral ratio but the fractional remainder as well:
```
integral-divide = do {
  numerator: 1
  divisor: 1
  ratio = numerator /(divisor) floor()
  extra remainder = numerator -(ratio * divisor)
  ratio
}
x = 5 integral-divide 3  // 1
y = x~remainder // 2
```

The formula `x` calls the function `integral-divide` as follows
1. The input field `numerator`of the function is set to `5`
2. The `divisor` field is set to `3`
3. The `ratio` is calculated to be 1 using the `floor` function to round-down the division
4. The extra result `remainder` is calculated by `extra remainder = ...`, calculated from `ratio` as 2. 
5. The `ratio` becomes the final result of the function. This line would not have been necessary is the previous line had been `let extra ...` which would pass through the  previous value of `ratio`.
6. The reference `y = x~remainder` accesses the extra result `remainder` which becomes the value of `y`. Equivalently, `y = ~remainder` would accesses the extra result of the previous field `x` without naming it.

What is going on here is that `x~` accesses the _formula value_ of the field `x`. Every formula can be accessed as a data value. The formula value of a do-block is a record containing all the `extra` fields of the block with their computed values. So `x~.remainder`, abbreviated to `x~remainder`, accesses the value of the `remainder` field of the do-block.

With extra results, function inputs and outputs become symmetric: they each have a single input and output value, zero or more named arguments, and zero or more named extra results.

## Conditionals

When an expression is evaluated, one of the following things will happen:

1. The expression crashes. A crash indicates a programming error, not a user error: some condition has arisen that ought to be impossible. The crash is recorded, but no changes are made to the document. Sometimes crashes can be predicted ahead of time when formulas are being edited (for example type mismatches). These are called static errors and are presented to the developer as problems to be fixed. However unlike conventional compiler errors, static errors do not prevent the system from running, so long as the erroneous formula is not used.
2. The expression is terminated before it completes because it has taken too long or used too many resources. It hasn’t been decided how to handle this yet.
3. The expression completes successfully, producing a value.
4. The expression intentionally _rejects_ without producing a value. Rejection means the expression refuses to handle the input values supplied to it. Rejection is inspired by [SNOBOL](https://en.wikipedia.org/wiki/SNOBOL), which calls it _failure_, as do many parsing DSLs. We call it rejection rather than failure to make clear it is an intentional occurence, not a programming error.

An expression that might reject is called _conditional_. The name of a conditional formula has a question mark appended to it. For example, the equality function `=?` tests whether two values are equal, rejecting if they aren’t. It is called like this: `x =? y`. You can tell that an expression is conditional by the presence of a `?` inside it, which indicates a place where it may reject.

By convention, comparison functions like `=?` and `<?` that succeed will result in their argument value,  so that they can be chained, as in `x <? y <? z`. Often conditionals are executed only to test whether they reject, and their result is not otherwise used. It is an error to produce a value that is not used. To indicate that a value is not intended to be used, an expression can start with `check`. That will also have pass on the value of the previous field. In most situations, conditional functions should be called in a `check` expression. For example:
```
// incorrect
do {
  x >? 0    // unused value
  x even?() // unused value
  x + 1
}

// correct
do {
  check x >? 0
  check even?()
  x + 1
}

// using value pass-through
x do {
  check >? 0
  check even?()
  + 1
}

```

> An alternative to prefixing `check` (and `let` and `extra`) is to suffix `\`.

Only formulas can be conditional, not data fields. See _Missing values_ for alternative techniques.

When a formula rejects, what happens depends on the kind of block it is inside. Inside a do-block or a function-block, rejection halts further evaluation of the block, and makes the whole block reject. What happens next depends on the kind of block containing that block — if it is also a do-block or function-block the rejection continues to propagates into the containing block. This proceeds until the rejection reaches one of several kinds of block that handle rejections, for example the _try-block_.  In this way rejection is like exception catching in conventional languages, except that it is the only kind of exception supported.

A try-block is a code block allows you to respond to a rejection by doing something else — it fills the role of the ubiquitous _IF_ statement in conventional languages. Here is an example:
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
A try-block contains a sequence of code blocks called _clauses_, separated by the `else` keyword. The first one will be evaluated, and if it succeeds its value becomes the value of the entire try-block, ignoring all the other clauses. But if the first clause rejects, then the second clause will be evaluated, and if it succeeds it supplies the value of the try-block and skips the rest. Successive clauses are evaluated until one succeeds.

If none of the clauses succeeds the try-block crashes. This is considered a programming error: a try-block must exhaustively test all possible cases.  _In the future we will try to infer exhaustiveness statically, but for now it is a dynamic check._ To allow none of the clauses to succeed, the statement `else reject` is placed at the end of the try-block. For example:

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
This function take text as input and tests whether it is red, green, or blue, rejecting otherwise. Note that because of the final `else reject` we know that the `rgb?` function is conditional, and so has a question mark, whereas `polarity` could not reject, and thus was unconditional.

Try-blocks can take an input value, and will pass it as the input to each of the clauses. Thus we could rewrite the above example as:
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

An alternative form of conditional is an optional-block:
```Txt
absolute-value = do {
  n: 0
  optionally {
    check n <? 0
    negate()
  }
}
```
The optionally-block is like a try-block, except that if none of the clauses succeed, the input value becomes the result. That requires that all the clauses must also result in the same type of value as the input. This is a shorthand for adding an empty clause at the end of a try-block, which acts like the identity function: `try {...} else {}`.

> `try {...} else reject` could be instead `try? {...}`. Likwise `optionally {...}` could be just `try {...}`. To crash on incompleteness, `try! {...}`. This design is more consistent with the way other conditional forms are handled, but we worry it is too subtle.

### Boolean operations
Subtext does not use Boolean values like conventional languages do for making decisions. The standard Boolean operations can be done with try-blocks instead. The `rgb?` function above was an example of a logical OR. Here is the recipe for writing boolean operations:
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

The `not{}` block evaluates its contents, rejecting if they succeed, and succeeding if they reject (in which case the input value of the block is passed on).
Note that `not{}` is a block, as is `try`. Only blocks catch rejections.

> But it might be convenient to allow `not` and `assert` statements, like `check`, except they capture rejects in the following expression without the need for brackets.

### Assertions and tests
The `assert{...}` block converts a rejection into a crash. This is used to detect situations that should be impossible and which therefore indicate a programming error. For example
```Txt
assert {x =? y}
```
will crash if `x` and `y` are unequal.

> We could also replace any `?` with a `!` to turn it into an assertion. This is more flexible, but we worry it is too subtle

Test blocks are used for unit tests:
```Txt
test {
  1 polarity() =? 'positive'
}
```
Test blocks execute after edits to formulas and definitions. If a rejection occurs inside the test block then it is treated as a static error, which is a problem for the programmer to resolve, but does not prevent the document from functioning.

Each test block executes inside a copy of the containing document where all data has been reset to its default state. The reset document is also the input to the test block. In this way tests are isolated and reproduceable, even if they explore changes to the document. For example:
```Txt
x: 0
y = x + 1
test {
  check .x =? 0
  .x := 2
  check .y =? 3
  check y =? 1 // default state of y
}
```

### TODO: Input rejection, transactions, and data constraints

## Choices
A _choice_ block defines a set of named data fields called _options_, exactly one of which is _chosen_. Choices are like discriminated unions and sum types in conventional languages. Here is an example:
```Txt
expr: choice {
  literal?: 0
  plus?: record {
    left: expr
    right: expr
  }
}
```
The `expr` field can choose to be a `literal?` with a numeric value, or it can choose to be a `plus?`, with a value as a record containing fields `left` and `right`, both of which are recursively another `expr` value. Choices always intially choose the first option (which can’t recurse so as to prevent infinitely deep values).

The names of the options have a question mark, because accessing them is conditional on their being chosen. For example `expr.literal?` will provide the numeric value of the `literal?` field if it is currently chosen by `expr`, but will reject if it isn’t chosen.

Choices are made with the _choice operation_ `|=`. For example:
```Txt
a-literal = expr |= literal 1
```
This pronounced “a-literal equals expr choosing literal one”. The `|=` expects a choice value on its left (here `expr`) and to its right the name of an option without the question mark (here `literal`), followed by an expression setting the value of that option. The expression can be left out, which will set the option to its default value (0 for `literal`):
```Txt
a-literal = expr |= literal
```
Note the similarity between the choice operation `|=` and the record set operation `:=`. As with `:=` we can use a do-block to nest choices:
```Txt
a-plus = expr |= plus do{left |= literal 2, right |= literal 2}
```

Sometimes there is no value of interest to associate with an option — we want it to indicate just that me made the choice. This is often called an _enumeration_ in other languages. We use the special value `nil` in this case:
```Txt
color: choice {
  red?: nil
  blue?: nil
  green?: nil
}
```
`nil` is what is called a _unit value_, which contains no information, so we can just default when choosing:
```Txt
red = color |= red
```

### Pattern matching

Languages with choice-like datatypes often also provide specialized syntax for _pattern matching_. Try-blocks combine with choices to provide pattern matching without extra syntax:
```Txt
eval-expr = function {
  x: expr
  try {
    x.literal?
  } else {
    x.plus?.left eval-expr() +(x.plus?.right eval-expr())
}
```

Here the first try clause accesses the `literal?` option. If it was chosen, its numeric value becomes the value of the function. But if `plus?` was chosen, then the first clause will reject and the second will execute instead, recursively evaluating the `left` abd `right` fields of the `plus?` option and then adding them together. We get the equivalent of pattern matching because accessing an option makes the entire containing try clause conditional on that option having been choosen.

### Conditional extra results

Recall that the formula value of a do-block, referenced with `name~`, is a record containing the extra results. The formula value of a try-block is a choice. The options of this choice correspond to the clauses of the try-block. Clauses can be named to give names to these options and access them.

For example, consider parsing text that might contain numeric digits or a qouted string, and wanting to convert it into either a number or a text. Here is one way:
```Txt
'123'
parse = try number? = {
  let extra value = ...? // produce number or reject
} else string? = {
  let extra value = ... // produce quoted string or reject
}
check '1' parse() ~number?.value =? 1
check '"foo"' parse() ~string.value =? 'foo'
```

Here the two clauses are named `number?` and `string?`. So `parse~` is a choice that looks like this:
```Txt
choice {
  number?: record{value: 0}
  string?: record{value: ''}
}
```

The formula value of a try-block is a choice because a try-block really _is_ a choice, just one that is computed rather than modified as data.


## Lists and tables

A _list_ contains a sequence of zero or more _items_ containing the same fixed type of value.  A _table_ is a list containing records. The items of a table are called _rows_ , and the fields of the record are called _columns_. Every list defines a value, called it’s _template_, which sets the default value for newly created items. For example:
```
numbers: list {0}
customers: table {
  name: ''
  address: ''
}
```
The list `numbers` contain numbers, defaulting to 0. The table definition `customers: table {...}` is equivalent to `customers: list {record {...}}`. The table contain columns `name` and `address` defaulting to the empty text. 

All lists are initially created as empty. Text is a list of characters with the space character as the template, so `'' =? list{space}`

The `&` function (pronounced “and”) is used to create items in a list. For example:
```
n = numbers & 1 & 2 & 3
c = customers & do{.name := 'Joe', .address := 'Pleasantown, USA'}
```
The `&` operator takes a list as it’s input and an item value as its argument, and results in a list equal to the input plus a new item. The default value of the argument to `&` is the template item, which provides a default value, so `&()` will create an item with the default value. In tables it is convenient to use a do-block as above to set some of the fields and let the others default.

The `&&` function concatenates lists: `list1 && list2` is a copy of `list1` with all the items from `list2` added to its end. The two lists must have the same type template.

The items in a list are numbered starting at 1 for the first item. This number is called the item’s _index_. The number of items (not counting the template) is called the list’s _length_, available with the `list length()` function. 

An item in a list can be accessed via its index using square brackets, as in:
```
n = numbers & 1 & 2
check n[1] =? 1
check n[2] =? 2
```

When an item is accessed, the `~index` extra result is set to the index value:
```
x = n[i]
check x~index =? i
```

The template of a list is accessed with `list[]`. The expression `list[i]` will crash if `i` is fractional or non-positive or larger than the length of the list. You can test if an index is valid with:
```
list at? i 
```
which returns the item if the index is valid (and the index in `~index`), or rejects otherwise. Functions `first?()` and `last?()` will return the first and last item repectively, rejecting if the list is empty. 

Items in a list can be updated individually by index:
```
n = numbers & 1 & 2
test {
  .n[1] := 3
  check .n[1] =? 3
  check .n[2] =? 2
}
```
Individual fields in a row can be updated similarly:
```
test {
  .customers[1].name := 'Joe Jr'
}

```
or equivalently using a do-block:
```
test {
  .customers[1] := do{.name := 'Joe Jr.'}
}
```

We can delete an item in a list with the `delete` function, which results in a list with that item removed (crashing if there is no such row):
```
list delete i
```

We can delete all items from a list with the `clear` function.
```
list clear() length() =? 0
```

### Columns
A column of a table is a list containing the contents of one field. The columns of a table are accessed as if they were fields of the table, for example:

```
t = table {
  name: ''
  amount: 0
} & do{.name := 'joe', .amount := 100} & do{.name := 'jane', .amount := 200}

test {
  check .t.amount[1] =? 100
  check .t.amount sum() =? 300

  .t.amount[1] := 150
  check .t.amount =? (clear() & 150 & 200)

  // replacing whole column
  .t.amount := (clear() & 150 & 200)
}
```
A column  can only be replaced with a list of the same length as the table, otherwise it will crash. In a tracked tabled (see below) no insertions, deletion, or moves can have happened in the column.

When a table field is a conditional formula, the corresponding column will skip all items where the formula rejects. 

### Sorted lists

Normally, new items are added to the end of a list. But a list can be defined as _sorted_, which means the items will be automatically kept in order of increasing value, or _reverse sorted_, which keeps then in order of decreasing value. Tables, whose items are records, use lexicographical ordering, where the first column is the most significant. Thus
```
customers: sorted table {
  name: ''
  address: ''
}
```
will order the rows alphabetically by name, and duplicate names by address.

When a list is not sorted, new items can be inserted anywhere into the list using:
```
list insert(item, at: i)
```
where 1 ≤ `i`  ≤ length + 1. The new item will then have the index `i`. An item already in the list can be moved using:
```
list move(i, at: j)
```
where 1 ≤ `j` ≤ length + 1.

Two lists are considered equal by the `=?` function when they have the same number of items with equal values in the same order. The `=?` function can only be used to compare lists with templates of the same type and the same kind of sorting (it is a static error otherwise). Lists can be converted between different sortings with the functions `sorted()` `reverse-sorted()` `unsorted()`. By requiring sorting compatibility for equality, we preserve the property that calling a function with equal inputs and arguments produces equal results, specifically the `&` function creating new items.

## Searching
A find-block searches in a list:
```
joe = customers find?{check .name =? 'Joe'}
```
The `find?` block is evaluated repeatedly with an item as its input value, starting with the first item and continuing until it does not reject. The result is that item, with `~index` set to the index. If all the items are rejected, the entire operation rejects. The `find-last?` block does the same thing except it scans the table backwards. The `find-only?` block suceeds if there is only match, and rejects if there are none or more than one. 

A useful special case is `list only?()`, resulting in the single item of the list, rejecting if the list has 0 or multiple items. Another is `find-unique?{...}` that finds all matches and rejects if there are none or they are not all equal.  

### Replacing and aggregating

A _for-each_ block will evaluate a code block on each item, resulting in an unsorted list with each row replaced with the result of the code block in the same order as the input. If an item is rejected, it is left out of the result. The `for-all?` block is like `for-each` except it rejects if the code block rejects on any item, otherwise resulting in the replaced table. The `for-none?` block does the opposite, rejecting if the code block accepts any item, otherwise resulting in the input list. For example:

```
test {
  l = list{0} & 1 & 2 & 3
  
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

An _aggregate function_ is used to accumulate a result by scanning a list.
```
list{0} & 1 & 2
aggregate {
  item: that
  sum: 0
  item + sum
}
check =? 3
```
An aggregate block takes as input a list. The code block must be a function with one argument. The function is called repeatedly with inputs from the items of the input list. In this example we called the input `item`, and define it from the default template value referenced as `that`. 
The function must have an argument (called `sum` here), which will act as an accumulator. On the first call it defaults to the defined value (0 here). On the second and subsequent calls, `sum` is set to the result of the previous call. This example is equivalent to the built-in `sum()` function that sums a list of numbers. If the function rejects an item then it will be skipped and the accumulator argument will be passed on to the next call. An aggregate function is  like a _fold_ function, except that the accumulator value is defaulted in the definition instead of being supplied explicitly by the caller (though that is still possible, for example `l sum(100)`).

## Tracked lists

A list can be defined to be _tracked_. Tracked lists automatically assign a unique ID to each item when it is created. The ID is used to precisely track changes to the item. Such IDs are called _surrogate keys_ in databases. The tracking ID is hidden from the user and programmer. Tracking allows two important features:

1. Relationships between tracked lists can be maintained, similar to relational databases, but without requiring that every item contain a unique and immutable key.
2. Tracked lists can be versioned and merged, similar to version control systems like git, except much more precisely. 

Two tracked lists are equal if their items are not only equal but also were created in the same relative order, including all items that were deleted. Tracked equality means that the lists not only have the same current state but also effectively the same history of changes.

> Tracked lists could offer sorting by creation time, and creation-time could be used to order duplicates in a list sorted by value.

> The IDs in tracked lists are implemented as monotonically increasing serial numbers within the list, as in an “auto-increment” field in a relational database. We are not exposing this because merging can renumber items (along with their selections).

### Links

Links are used to store references to items from outside the list. A common scenario is what relational databases call _foreign keys_, where rows in one table reference rows in another:

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

The `customer` field of `orders` rows is a _link_. Links designate a list they reference into (called the _target_), and a constraint on the number of linked items they permit. In this example, exactly one customer must be linked. The number of linked items can be constrained in several ways:
```
one in customers         // exactly 1 row
maybe one in customers   // 0 or 1 rows
some in customers        // 1 or more rows
maybe some in customers  // 0 or more rows
```

A link stores a subset of the IDs in its target list. Links are equal when their target lists are equal and they link the same items. A link is edited in the UI with something like a pick-list of the items in the target list (radio buttons for a singular link). Links can be modified with several functions that produce modified links:
```
l link i              // add link to item with index i in target
l unlink i            // unlink item with index i in target
l links? i            // rejects if target index i is not linked
l clear()             // unlink everything
l link-all list       // link all IDs from another list or link
l unlink-all list     // unlink all IDs from another list or link
l copy list           // clear and link-all
```

Links act in some ways as if they were a list containing the linked items in their order in the target list, for example they can be indexed with `[...]` and searched with `find?{...}`. But note the indexes used in those examples are the index within the links, not the index in the target list. We can access the underlying target list with:

```
l target()        // copy of the target list
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
Note that each link names the field within the opposite table that contains its reflection.

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
Links can target nested lists, linking to a path of IDs. Reflecting links can cross multiple layers of containing lists. Cardinality constraints are specified seperately for each level of nesting. 

### TODO: link updates and referential integrity

### Merging

Copies happen. Documents get shared as email attachments. Documents get imported into other documents. Inevitably, both the copy and the original change. Tracking allows such changes to be later sent to the other version without wiping out all the changes that have happened to it in the meantime. This is called _merging_. 

Two copies of a tracked list can be compared to see exactly how they have diverged. The IDs in tracked lists allow changes made to an item to be tracked despite any changes made to its value or location. Deletions and creations are also known exactly. Tracking provides more precise information than text-based version control systems like git. 

Changes made to one copy can be merged into the other. If changes are merged in both directions the two copies become equal again. Sometimes changes made to both copies are such that merging must lose some information, for example if the same field in the same item is changed to be two different numbers. Merging can be done using an automatic policy to resolve such conflicts, or human intervention can be requested, either immediately in the UI when performing the merge, or later by reifying such conflicts into the document itself (but without breaking the document as textual version-control does).

Merging can be done across copies of entire documents. Merging can also apply to documents included inside another document (see _include_ and _variant_). Merging applies to all tracked lists and links within a document. Non-tracked lists (including text) are treated as atomic values that change as a whole.

TODO: details.

## Parsing

It is common to need to find and operate on patterns in text. The traditional solutions involve specialized languages with radically different syntax and semantics, such as _regular expressions_ or _parser generators_. Subtext provides these capabilities without the need to learn a specialized sub-language.

A _selection_ is a list that has been divided into three parts, called _before_, _selected_, and _after_. Any of these parts can be empty. We can define a selection to be a list plus two indices `begin` and `end` where `1 ≤ begin ≤ end ≤ length + 1`. A selection is created from a list with
```
list selection(.begin := i, .end := j)
```
where the begin and end indexes default to 1.

Two selections are equal if they are equal as lists and have equal begin and end indexes. A selection is equal to a list if its begin and end indexes are both 1 and the after part is equal to the list. The UI displays a text selection with the selected part highlighted as in a text region selection. If the selection is empty, the UI displays it as a text cursor between two characters, or at the beginning or end. When a text selection is edited, changes to the cursor/selection state in the UI are saved.

Selections are useful when attempting to recognize various patterns in text (or any kind of list, but we focus on text in the following discussion). This process is called _matching_. The most basic matching function is `match?`, which will check that the front of the input text equals the argument text, rejecting otherwise. So:
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

Another useful matching function is `match-number?` which matches a numeric text and returns its numeric value as an extra result `value`. For example:
```
'123foo' 
match-number?()
check after() =? 'foo'
check ~value =? 123
```

When a matching function does not see the expected pattern in the input, it rejects. This means it is easy to use try-blocks to test for alternative patterns. Here is a classic example of matching a little languge of addition expressions:

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
Note how in this example, if one clause of the try-block rejects then the next one is evaluated using the original input selection, which is sometimes called _backtracking_.

### ASTs

Recall the `eval-expr` example that evaluated simple arithmetic expressions encoded as a recursive choice `expr`:
```Txt
expr: choice {
  literal?: 0
  plus?: record {
    left: expr
    right: expr
  }
}

eval-expr = function {
  x: expr
  try {
    x.literal?
  } else {
    x.plus?.left eval-expr() +(x.plus?.right eval-expr())
}
```

When we produce a recursive choice like `expr` while parsing text it is sometimes called an AST (Abstract Syntax Tree). Often that requires a lot of repetitive code in the parser to assemble the AST as it is being parsed. But using extra results, we can produce an AST just by adding extra result labels to the parsing code, as follows:

```Txt
'1+1' 
match-expr? = try literal? = {
  extra number = match-number?()
} else plus? = {
  extra left = match-expr?()
  match? '+'
  extra right = match-expr?()
} else reject

eval-expr = function {
  ast: match-expr~
  try {
    ast.literal?~number~value
  } else {
    ast.plus?~left~ eval-expr() + (ast.plus?~right~ eval-expr())
}

test {
  check '1+2' match-expr?()~ eval-expr() =? 3
}
```

The trick is that the formula value of a try-block is a choice, and so the formula value of a recursive try-block (like `match-expr`) is a recursive choice. So we can treat the formula value of the parse function itself as an AST. In `eval-expr`, `ast: match-expr~` says the input of the function must be a formula value of `match-expr`, which is a choice. We then pattern match on the AST: if it is a literal, the expression `ast.literal?~number~value` will pull out the value of the matched number. Likewise if it is an addition, the left and right expressions are pulled out, recursively evaluated, and then added.

Deep paths into formula values like `ast.literal?~number~value` can be complex. We expect that they will not be coded in the abstract, but instead generated in the UI by opening an execution of the formula and clicking on the desired value, which will add any needed labels and generate the correct path.


### Repeats

**split out repeating and then extra results in repeats **

Often we want to match a repeating pattern. Here is an example that matches a CSV (comma separated values) text:

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

This example uses a _repeat-block_, which is Subtext’s form of looping. Unlike traditional loop mechanisms, repeat-blocks are expressed as a _tail recursive_ function: The special call `continue?()` recursively calls the containing repeat block. Like any other call it takes an input value on the left, and arguments if they are defined. But it may only be used where its result will immediately become the result of the whole function (_tail position_).

Tail recursive functions are equivalent to loops, and repeat blocks are actually implemented that way, as a list of calls. In the UI they will be displayed as a list rather than the nesting used for normal function calls. However, unlike traditional loops, repeat blocks do not involve mutable variables — that is replaced by passing new input and argument values to the next iteration. We hypothesize that this is the best of both worlds: the simple iterative semantics of loops, with the clean value semantics of recursion.

The recursive call `continue?()` has a question mark because the repeat block can reject. An unconditional `continue()` would be used in an unconditional repeat.

> Maybe the `continue` call should default all arguments to their value in the current iteration, not the original definition. That would more closely emulate mutable loop variables, and allow forms like `continue(count := + 1)`.
> 
> Maybe `continue` should do an early exit to guarantee tail position and simplify conditional structure. 
> 
> When repeats are nested it may be useful to have continue specify a name of the block as in `continue foo-loop()`. 

> Perhaps a `visit` block that can be multiply-recursive, and collects the extra results in the order of execution, concatenating them as in a “flat map”. Combined with skipping of conditional extras, this allows arbitrary search algorithms to be easily written.

 
## Repeated extra results

When we parse a CSV we typically want to produce a list of the numeric values. We can do that by adding an extra result label to the code:

```
'1,2,3'
csv = repeat { 
  extra number = match-number?()
  optionally {
    match? ','
    continue?()
  }
}

check csv~number~value =? (list{0} & 1 & 2 & 3)
```

Recall that the formula value `~` of a do-block is a record, and the formula value of a try-block is a choice. The formula value of a repeat-block is a table, with each row being the formula value of the repeated code block. Thus `csv~` is the table of formula values of the code block, which contains one extra result `number` which is the result of the `match-number?()` call.  We can extract the column containing those results with `csv~number` and then extract the column containing the numeric value of the match with `csv~number~value`.

### Scanning

A scan-block can be used to search for a pattern in text. For example:
```
'foo123'
scan? {match-number?()}
check before() =? 'foo'
check selected() =? '123'
check ~value =? 123
```
A scan-block will repeatedly execute the enclosed block until it succeeds. At first the input text or selection is passed to the code in the block, and if it succeeds nothing further is done. But if it fails the block is reexecuted with a selection that skips one character (or item) in the input. This is done by moving the selected part to the before part, and then moving the first item of the after part to the before part. One character at a time is skipped this way until the match succeeds or the end of the text is hit (which causes a reject).

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
The `replace-selection` replaces the selected part of the input with the argument text. Note that replacing the selection does not affect subsequent matches, which work on the after-part, so replacement can be done “on the fly”. The `combined()` function at the end converts the final selection back into a plain text by concatenating the before, selected, and after parts.

## Missing values
Nulls are a perennial controversy in PL and DB design. The idea is to add a special value Null to all types of values in order to represent a “missing” or “unknown” value. Unfortunately Null adds complexity and more ways for code to break, or more language features to avoid breaking. FP languages avoid Null values by using Option wrappers (like Subtext choices), but at the cost of continually wrapping and unwrapping values.  NULL in SQL is an acknowledged disaster. We want to avoid this whole mess if possible.

We propose a simple solution for missing values that visualizes naturally in the UI:

1. There is a special number called `_number_` that corresponds to an empty numeric field in the UI. Numeric functions treat `_number_` as a special case, as Excel does with empty cells. Unlike IEEE NaN, `_number_` is equal to itself.
2. The empty text represents a missing text.
3. There are predefined missing values for each media type that serve as placeholders.
4. The missing value for a record is when all its data fields are missing.
5. The missing value for a list is when it is empty.
6. There is no predefined missing value for choices. However as their first option is the default, it can be defined to be something like `NA?: nil` to serve as a missing value if desired. Also see maybe-blocks below.

The `required` constraint (see _Constraints_) checks that a data field does not contain one of the above missing values.

Sometimes we really do need to have a special missing value. The _maybe_ block converts a conditional expression into a choice, like a conventional Option type. For example `maybe{x?}` produces the choice:
```Txt
choice {
  no?: nil
  yes?: x
}
```
where the the `no?` option is chosen if `x?` rejects, and the `yes?` option is chosen and set to the value of `x?` if it succeeds.

A maybe block is often useful in cases where we would like to set a data field with a conditional expression (which is illegal). For example we might want to use a conditional expression as a function argument so that, instead of rejecting the call, the function itself gets to decide what to do. Wrapping the conditional expression in a maybe block permits that.

## Types

Subtext has no syntax for describing types: programs only talk about values. All states are defined with a default value, so no type need be specified. For example in the definition `foo: _number_`, `_number_` is not the name of a type — it is just the name of the special missing number. Likewise error messages never talk about types — instead they point to a type mismatch between values at two code locations, additionally referencing the code locations where their types were defined.

We believe that type systems are an essential formalism for language theoreticians and designers, but that many language users would prefer to obtain their benefits without having to know about them and write about them.

Field names are nominal, which ironically means that their names are irrelevant (unlike structural systems where the spelling of a field’s name identifies it). Every time a field is defined a globally unique ID is assigned to it. There is a document-wide dictionary that maps these field IDs to their current names. Renaming a field just changes that dictionary entry. So the following two definitions look similar but define two different `a` fields.
```
x: data {a: 0}
y: data {a: 1}
check x not=? y	// type error!
```
If we want `x` and `y` to be the same type, we would say instead:
```
x: data {a: 0}
y: x do{a: 1}
check x not=? y
```
Here the use of `a` in the second line is “bound” to the ID of `a` defined in the first line.

We don’t have function types or higher-order values. Two values have the same type if they have the same data type and all embedded code is equal (modulo internal paths). Value equality requires type equality, so equal values are behaviorally equivalent, i.e. referentially transparent.

> TODO: To share common field definitions across different types of blocks we can use a traits-like mechanism that merges and restricts blocks. Defer until we have the need.

Generic (parametrically typed) functions are defined with the `generic{...}` code block. For example the `&` function to add rows to a table has the signature:

```
& ()= table of {} generic {
  assert $ table?()  // subject must be a table
  row: $ template()  // argument must be type of table template
}
table of 0 & 1      // this is OK
table of 0 & ''		// this will report a static type mismatch error
table of 0 & ()     // this uses the default template value of the subject
```

A generic function can be called with a subject of any type value. Every call of a generic function will recompute the argument default values based on the actual subject type and value. Arguments to the call are type-checked against those new defaults. Note that type checking is still static: every call to a generic function gets statically checked — types can not vary dynamically, only across different calls. In PL theoretic terms, generic functions are parametric in the type of the subject at each call site. It is notable that we acheive this without introducing an explicitly parametric type system with type variables like `<T>`, which is notoriously baffling to beginners. Yet unlike template meta-programming, we retain static type checking at call sites for understandable errors.

As a consequence of the above semantics, all functions (whether or not generic) have _dynamic defaults_. The expression defining the default value of an argument is recomputed from the actual value of the subject. If those default expressions make reference to locations outside the function, then their current value will be used.

## Semantics

In PL terms, code blocks are pure on the outside but imperative on the inside. While they can be seen as internally mutating locations within their subject, they have no effect on any state outside themselves. All they can do is return a changed subject value, which their caller may in turn use to mutate its own subject value.


The subject of a code block can be the entire document, and in fact the document history is exactly that: a record of all actions performed on the document, with the changing document state passed as the subject between commands. Every time a user performs an action a new command executing it is added to be end of the history block. The current state of the document is the final result of the history block. Changes to the document, which appear to be stateful global effects, are really local changes within the document history. So while code blocks have no external effects, we still see changes happening because we are living inside a code block.

> FIXME: Steve says above confusing. “code feels like you are mutating”. Make imperative code functional instead of vice-versa. Explain interaction model better.


### Determinism
Subtext is deterministic: every code block’s end value is purely a function of its input subject, arguments, and the prior state of the document. History is also deterministic, because it records all user actions and external inputs (including sources of randomness) that affect the state of the document. Thus the current and prior states of the document can be exactly reproduced by replaying history.

### Termination
Sometimes code takes too long to execute, or consumes too many internal resources.

> TBD. Simplest solution is that doc becomes read-only while reacting to an input, and then the results are shown atomically at completion. If computation takes too long the user can terminate it, which cancels the entire input action and leaves the document in its prior state. The input action remains in the history though and can be redone later if desired. Exceeding resource quotas (like stack size) would also terminate computation. However it would be nicer to be able to interrupt a long-running execution, observe it’s execution so far, and resume if desired.



# Appendix: Glossary

# Appendix: Syntax

```
Atom :=
	| '{}'				// unit value 'nothing'
	| Number
	| text
	| '_serial_'		// missing serial number

Number :=
	| // JavaScript number
	| '_number_'		// Special missing number

text := 		// single-quoted JavaScript text literal

Label := Name | Operator | Ordinal
Name := [a-z A-Z] ([a-z A-Z 0-9 _ \-]* [[a-z A-Z 0-9])? '?'?
// names can't be keywords
// underscore renders as space in UI
Ordinal := [1-9][0-9]*		// positional field access - internal use only
Operator := '+'|'-'|'*'|'/'|'=?'|'not=?'|'>?'|'>=?'|'<?'|'<=?'|'&'

Doc := Field*

Field := Statement Sep

Statement :=
	| Name ':' Qualifier* Expr				// state - 'name is'
	| Name '=' Qualifier* Expr				// formula - 'name equals'
	| Name '()=' Expr						// function - 'name of'
	| (Name '=')? Path? ':=' ContextExpr	// 'set to'
	| (Name '=')? Check Expr ('error' text)?
	| 'assert' ContextExpr
	| 'end'									// control containing repeat

Check := 'check' | 'not'

// field/argument seaparated by comma or new-line
Sep := ',' | '\n'

Qualifier :=
	| 'backwards'
	| 'key'
	| 'arranged'
	| 'positive'
	| 'non-positive'
	| 'negative'
	| 'non-negative'
	| 'non-zero'
	| 'required'

Expr := Value Op*
ContextExpr := Value? Op*

Value :=
	| Atom
	| Path
	| '$'					// subject of containing code block
	| '_'					// default subject: current value on LHS of :=
	| 'input'				// Input subject of containing expression?
	| 'data' Block
	| 'choice' Block
	| 'table' Block
	| 'table' 'of' Value
	| 'maybe'? ('one' | 'some') 'in' Path ('reflecting' Name)?

Block := '{' Field+ '}'

Op :=
	| Path (Value | Arguments)		// function call
	| Step*							// path following
	| Conditional
	| Control Block

Arguments := '(' Argument* ')' '~'?
Argument := (Label ':=')?  ContextExpr Sep

Control :=
	| 'do'
	| 'generic'
	| 'builtin'			// internal use only
	| 'generic-builtin'	// internal use only
	| 'optionally'
	| 'test'
	| 'find?'
	| 'find-last?'
	| 'find-only?'
	| 'for-each'
	| 'for-all?'
	| 'for-none?'
	| ('for' Value)? 'repeat'
	| 'selecting'

Conditional := 'try' FirstClause ElseClause* LastClause?
FirstClause := ( Name '=' )? Block
ElseClause := ( Name '=' )? 'else' Block
LastClause := ( Name '=' )? 'else' ( 'ok' | 'reject)

Path := Label? Step*
Step :=
	| '.' Label				// data
	| '~' Label				// associated result
	| '~'					// expression body
	| '^' Label				// metadata - internal use only
	| '[' ContextExpr ']'	// Index
```