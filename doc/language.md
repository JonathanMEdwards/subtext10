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
* A function argument has access to the static type of the parameter definition. For example this avoids the redundancy of `insertRow(new Row(...))` instead of just `insertRow(do{:=...})`. A function argument also has access to the default value of the parameter, which the function can compute dynamically based on the value of the subject and prior arguments.
* Functions can have extra return values, which do not need to be explicitly captured at the call site as in other approaches.
* Hidden types: Subtext is statically typed, but types are not mentioned in the language nor error messages. Concrete values serve as witnesses of types.
* Parametric polymorphism (generics) are provided without exposing the concept of a type parameter.  Generics fall out almost for free from the ability to have dynamically defaulted parameters described above.
* There is one form of sequential data structure: the _list_, which when containing records serve as _tables_.
* Lists can be tracked by automatically assigning hidden unique IDs to their items. Tracked ists support _links_ which can chose one or more items from a _target_ list. Links serve as foreign keys in databases. They also replace conventional uses of pointers/references, allowing reads and writes to a dynamically chosen location. This opens the Pandora’s Box of aliasing and side-effects, but only within the statically-known target list. Future research will look at exploiting this constraint for precise side-effect analysis.
* Tracked lists allow precise document versioning and mergeing.

### Intentionally excluded features

* Separate compilation
* Subtypes, interfaces, typeclasses (but maybe traits)
* First-class functions (generics are enough)
* The stack and the heap (and garbage collection)


## Documents

The artifact that Subtext mediates is called a _document_. It is somewhat like a spreadsheet (e.g. Excel) in that it presents both data and formulas in a visual metaphor that is easy to learn. It is somewhat like a notebook (e.g. Jupyter) in that it offers the full power of a programming language. These artifacts are characterized by their geometry: notebooks are a linear list of cells; spreadsheets are a 2-dimensional grid of cells; Subtext documents are a tree of cells.

- Subtext documents are built out of two things: data and formulas. There are a predefined set of base types of data like numbers, strings, and times. Formulas are built from a predefined set of _operations_ and _functions_ which process data.
- Documents are built up in two ways: _blocks_ and _lists_.
- A block is a fixed group of _fields_ holding data and formulas. Fields can be named. There are different kinds of blocks. A _record_ block gathers a set of fields to be handled as a group, similarly to _structs_ and _objects_ in other languages. The entire _document_ is a top-level block. A _choice_ block gathers a set of fields out of which exactly one must be chosen,  similarly to _variants_ ,  _sums types_, and\_discriminated unions\_  in other languages. There are several kinds of _code_ blocks similar to traditional PL control structures, with their fields corresponding to statements.
- Lists contain contain zero or more _items_ of the same type. When a list contains records it is called a _table_, and the items are called _rows_. 
- In analogy with spreadsheets, the “cells” of a Subtext document are the fields and the items. A tree structure is built up by nesting blocks and lists. A Subtext document is a whole tree.

The tree structure of Subtext documents strike a nice balance: they are more flexible and dynamic than the grid of a spreadsheet, yet simpler and more visualizable than the graph-structured data of imperative programming languages.

Subtext is statically typed, which conventionally means that the code and the types of values are fixed at _compile time_ and do not vary at _run time_. But there is no such thing as compile time in Subtext documents, which are always running and fully editable with persistent state. Subtext distinguishes between two kinds of changes: modifying data and editing code or definitions. It is possible to lock a document so that only data modifications are allowed. Data modifications are highly constrained: data types are fixed (a number can’t be changed to a string), and changes are limited to data updates, choices, list insertions and deletions. Only certain kinds of errors can occur during data modification. In contrast, code editing can change anything, and can lead to various sorts of inconsistencies called _static errors_, corresponding to the errors a traditional compiler might report. Static errors are reported to the programmer as problems in the document to be resolved, but unlike compiled languages, the document continues to function outside the affected parts.

Although Subtext is statically typed in the above sense, there is no mention of types in the language syntax or error messages, because concrete values serve as witnesses of their types (see _Types_).

Nesting blocks and lists leads to a tree structure somewhat like those of statically typed FP languages, except that:
- They are mutable.
- The same structures are used to represent data and code (as in LISP), but they also represent the execution of code. We call this _reified execution_.
- Some parts of the tree can be dynamically computed from other parts via cross-references.
- A _link_ can dynamically select one or more items from a specific target list. Links are like foreign keys in a DB. Links are also like pointers in that you can “write through” them into the target list, but in a way compatible with pure functional semantics. See _Synchronized links_.
- Cross-references within the tree are static. Links can dynamically change which items they link to, but the list containing those items is known statically, which limits the damage they can do.

## Base values
Subtext provides a set of base values out of which documents can be built. The base values are:

- string: a JavaScript string literal using single quotes: `'hello'`
- number: double float using JavaScript syntax, and the special value `_number_` not equal to any other number.
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

Fields can be separated across lines and indented as in the above example, or combined in a line separated by commas:
```
b: record {x: 0, y: record {i: 0, j: 1, k: 2}}
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
```
x = data 0
x = init 0
```
> but that can get verbose:
```
b = data record {
  x = data 0
  y = data record {
    i = data 0
    j = data 1
    k = data 2
  }
}
```

## Expressions
In the formula `y = x + 1` the part to the right of the `=` is called an _expression_. This expression starts with the _value_ `x` followed by the _function call_ `+ 1`. An expression value can be either a literal like the number `1`, or a _reference_ to a field somewhere in the document, like `x`. References can be a _path_ of multiple names separated by `.`, as in `b.x`, pronounced “b dot x”, which refers to the `x` field of the block `b`. Other kinds of paths will be described later.

A function call starts with a reference to a function, in this case `+`, the built-in addition function. The function reference is followed by parentheses containing zero or more _arguments_ to the function. When there is only one argument and it is a value, the parenthese are optional: so `x + 1` is equivalent to `x +(1)`. All functions operate on the value to their left, which is called their _input_, and additionally zero or more arguments in parentheses to their right. So in `x + 1` and `x +(1)` the input to the `+` function is the value `x` and the single argument is the value `1`. There is no such thing as a function with no input. If a function call has no arguments it uses empty parethenses as in `x negate()`. Arguments can also be expressions, in which parentheses must be used, for example `x +(y * 2)`. If a function takes more than one argument it uses a “keyword” syntax for the extra arguments: `value fnc(arg1, param := arg2)`. All arguments are optional, and will be given a default value if unspecified in the call.

Expressions executely strictly left-to-right, which can violate the expectations of arithmetic precedence. The expression `1 + 2 * 3` is equal to 6 not 7. This is clearer if parenthese are used: `1 +(2) *(3)`. For that reason, the UI will always fill in parentheses in function calls, but fade them out in the case of a single value argument, so that they still resemble the familiar parentheses-free form, but hopefully still look different enough to break the expectations of aratithmetic precedence. We retain the parentheses-free form in the syntax because that is the entrenched expectation of experienced programmers, who are the audience for the syntax.

> References will support “search paths” like `x…y` that look for a `y` field that is reachable via any path from `x`. Likewise `…y` would look for any path to `y` from any containing scope. In these examples it is an error if there is more than one path leading to `y`. A possible exception to this rule is when all the paths go through alternative cases of a choice or clauses of a conditional, and further that they lead to fields of the same type. If not all of the cases or clauses are covered then the path must be conditionalized like `…y?`. This feature gives us a convenient way to extract alternative information from choices and conditionals. Search paths might be intolerably fragile in a textual language, but an IDE can automatically repair them. In fact the reference editor in the IDE will provide all reachable paths of the right type, offering “… completion” rather than just “. completion”.

## Do blocks
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
A do-block, like all blocks, consists of a sequence of fields. In this example there are three anonymous formula fields: `x`, `+ 1`, `* 2`. Both of the function calls have no value to their left, which means that they take as input the value of the previous field. So the value of `x` is the input to `+ 1`, whose result is the input to `* 2`. The value of the last field is the value of the entire block, which becomes the value of `y`. This top-down dataflow corresponds exactly to the left-right dataflow of formulas.

Do-blocks can take inputs too. We can refactor the above code into:
```
y = x do {
  + 1
  * 2
}
```
Here the value of `x` is the input to the do-block, and thus the input to the initial call `+(1)`. This form will become useful when we introduce further kinds of blocks.

> We might want to make the implicit top-down dataflow more explicit by using a special value `that`, as in:
```
y = do {
  x
  that + 1
  that * 2
}
```
> Or possibly `.`
```
y = do {
  x
  . + 1
  . * 2
}
```

Do-blocks have a number of advantages over formulas. For one, they can grow much larger while still being readable. Another advantage is that the UI  shows the value of each formula underneath it, as in computational notebooks like Jupyter. Thus any formula can be flipped into the vertical block view to see a “mini notebook” showing every step of its execution. This total visibility of execution is a primary goal of Subtext.

## Setting fields
So far all our examples have used arithmetic. But it is very common to work with records, especially as they are the rows of tables. Take the record:
```
x: record {
  name: ''
  number: 0
}
```
This record contains two data fields: `name` which is an initially empty string, and `number` which is initially the number `0`.

The essential operations on a record are to read and change individual fields. We read the fields using paths, like `x.name` and `x.number`. To change a field we use a _set operation_:
```
x with{name:= 'Joe'}
```
We pronounce this “x with name set to string Joe”. The result of a set operation is
a record equal to the value of `x` except with the field `name` set to `'Joe'`, which is
```
record{ name: 'Joe', number: 0}
```
Note that the value of `x` is not changed as a result of this operation: a new and different record value is produced. We might give this new record a name, as in:
```
y = x with{name := 'Joe'}
```
We can update multiple fields at once:
```
y = x with{name := 'Joe', number := 2}
```

If we display the above formula as a do-block we see:
```
y = do {
  x
  name := 'Joe'
  number := 2
}
```
Here the set operation `name := 'Joe'` takes as its input record the value of the previous field, which is the value `x`. The Joe-named record that results becomes the input to `number := 2`, whose results becomes the value of `y`

Note that the `with{}` syntax disappeared in the do-block. That is because with-blocks don’t really exist: they are used in a formula to show fields that don’t meet the usual expectations of a formula, specifically anything besides a simple value or function call. With-blocks allow formulas to represent anything that can go into a do-block.

Set operations can “drill” into nested record by using a dotted path to the left of the `:=`
```
x: record {
  name: ''
  number: 0
  address: record {
    street: ''
    city: ''
}
y = x with{address.street := '12 Main St', address.city := 'Springville'}
```

Instead of using dotted paths, we can nest with-blocks:
```
y = x with{address := with{street := '12 Main St', city := 'Springville'}}
```
Note how the with-block is nested: `address := with{street...}`. We saw earlier that the with-block expects an input record value on its left, which it then modifies. Here `address :=` passes the current value of `x.address` as the input to the with-block on its right, and then sets the `address` field to be the result. This example demonstrates a general feature of Subtext: _default inputs_. We saw earlier how operations in a do-block take their input from the previous field. Something similar happens with a `:=` — any operation on the right will by default input from the current value of the field named on the left. For example:
```
y = x with{number := + 1}
```
will increment the value of the `number` field. Default inputs are also supplied to function arguments, which will be discussed later.

## Defining functions
A function can be defined with a function-block, for example:
```
plus = function {
  in: 0
  addend: 1
  in + addend
}
```
A function-block is like a do-block, except that it starts with one or more data fields naming the input and arguments to the function. When this function is called, as in `1 plus 2`, the value on the left, 1, is set into the first data field, `in`. The argument 2 is set into the second field, `addend`, resulting in:
```
function {
  in: 1
  addend: 2
  in + addend
}
```
which produces the result 3.

Functions with more than one argument must name the extra arguments in the call, like this:
```
ternary-function = function{
  in: 0
  arg1: 0
  arg2: 0
  ...
}
x = 1 ternary-function(2, arg2 := 3)
```
The rule is that the first defined argument is anonymous in the call. Note that named arguments use the same notation `:=` as a set operation. That is because they actually are set operations, overriding the data fields of the function. The first argument implicitly uses a set operation too: `arg1 := 2`. Because arguments use set operations, we get defaul argument inputs. Thus for example `1 plus(+ 1)` will increment the default value of the argument (from 1 to 2), with a final result of 3. This is a contrived example, but we will see more useful cases later with choices and lists.

There is one big difference between functions in Subtext and other languages: they are expressions, not values. Look at this function:
```
increment = function {
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
The call `x increment()` takes the expression defining `increment` and sets its first value to the value of `x`. The result is exactly the same in all of the above alternative definitions of `increment`.

What this means is that any formula can be used as a no-argument function (taking just an input). In most languages, if we have a formula that we want to reuse elsewhere we must copy it out into a separate function definition, and supply a name for the input, and further we should abstract the original formula into a call to the new function. In Subtext we can instead just call the formula as a function. However if we want the function input to be other than the first value, or we want there to be arguments, then we need to use a function-block. But even then there is no need to abstract out a separate function definition. We can just expose the formula as a do-block, then edit it into the function-block we want, without defining a new field. The original field still gets the result of executing that function block on the default values as if it were a formula. This approach to functions is motivated by a major goal of Subtext: avoiding the need for premature abstraction.

## Extra results

The result of a function is the value of the last field. However we often would like to return extra results from a function. For example, integral division would like to return not only the integral ratio but the fractional remainder as well:
```
integral-divide = function {
  numerator: 1
  divisor: 1
  ratio = numerator /(divisor) floor()
  extra{remainder = numerator -(ratio * divisor)}
}
x = 5 integral-divide 3  // 1
y = x~remainder // 2
```

The formula `x` calls the function `integral-divide` as follows
1. The input field `numerator`of the function is set to `5`
2. The `divisor` field is set to `3`
3. The `ratio` is calculated to be 1 using the `floor` function to round-down the division
4. An _extra result_ named `remainder` is defined and calculated to be 2 based on `ratio`
5. The extra-block passes through the ratio, which as the last value in the function becomes the value of `x`
6. The reference `x~remainder` accesses the extra result `remainder` which becomes the value of `y`. Equivalently, `y = ~remainder` accesses the extra result of the previous field.

A function can have multiple extra results, each with a different name, defined as 
```
extra{result1 = ..., result2 = ..., ...}
```
You can access the record containing all the extra results with a reference like `x~`, and just `~` for the extra results record from the previous field.

If an extra block is not the last field of a function, then the extra results of the last field are passed on as the extra results of the function. The `floor()` function actually does return an extra result called `remainder` containing the fractional part of its input. So in this case we didn’t need to use the extra block. If you don’t want to return extra values from the last field, you can add `extra{}` to the end.

With the addition of extra results, function inputs and outputs become symmetric: they each have a single input and output value, zero or more named arguments, and zero or more named extra results.

## Conditionals

When an expression is evaluated, one of the following things will happen:

1. The expression crashes. A crash indicates a programming error, not a user error: some condition has arisen that ought to be impossible. The crash is recorded, but no changes are made to the document. Sometimes crashes can be predicted ahead of time when formulas are being edited (for example type mismatches). These are called static errors and are presented to the developer as problems to be fixed. However unlike conventional compiler errors, static errors do not prevent the system from running, so long as the erroneous formula is not used.
2. The expression is terminated before it completes because it has taken too long or used too many resources. It hasn’t been decided how to handle this yet.
3. The expression completes successfully, producing a value.
4. The expression intentionally _rejects_ without producing a value. Rejection means the expression refuses to handle the input values supplied to it. Rejection is inspired by [SNOBOL](https://en.wikipedia.org/wiki/SNOBOL), which calls it _failure_, as do many parsing DSLs. We call it rejection rather than failure to make clear it is an intentional occurence, not a programming error.

An expression that might reject is called _conditional_. The name of a conditional formula has a question mark appended to it. For example, the equality function `=?` tests whether two values are equal, rejecting if they aren’t. It is called like this: `x =? y`. You can tell that an expression is conditional by the presence of a `?` inside it, which indicates a place where it may reject.

Only formulas can be conditional, not data fields. See _Missing values_ for alternative techniques.

When a formula rejects, what happens depends on the kind of block it is inside. Inside a do-block or a function-block, rejection halts further evaluation of the block, and makes the whole block reject. What happens next depends on the kind of block containing that block — if it is also a do-block or function-block the rejection continues to propagates into the containing block. This proceeds until the rejection reaches one of several kinds of block that handle rejections, for exampe the _try-block_.  In this way rejection is like exception catching in conventional languages, except that it is the only kind of exception supported.

A try-block allows you to respond to a rejection by doing something else — it fills the role of the ubiquitous _if_ statement in conventional languages. Here is an example:
```Txt
polarity = function {
  n: 0
  try {
    n <? 0
    'negative'
  } else {
    n =? 0
    'zero'
  } else {
    'positive'
  }
}
x = 1 polarity() // = 'positive'
```
A try-block contains a sequence of blocks called _clauses_, separated by the `else` keyword. Try clauses are do-blocks. The first one will be evaluated, and if it succeeds its value becomes the value of the entire try-block, ignoring all the other clauses. But if the first clause rejects, then the second clause will be evaluated, and if it succeeds it supplies the value of the try-block and skips the rest. Successive clauses are evaluated until one succeeds.

If none of the clauses succeeds the try-block crashes. This is considered a programming error: a try-block must exhaustively test all possible cases.  _In the future we will try to infer exhaustiveness statically, but for now it is a dynamic check._ To allow none of the clauses to succeed, the statement `else reject` is placed at the end of the try-block. For example:

```Txt
rgb? = function {
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
This function take a string as input and tests whether it is red, green, or blue, rejecting otherwise. Note that because of the final `else reject` we know that the `rgb?` function is conditional, and so has a question mark, whereas `polarity` could not reject, and thus was unconditional.

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
> It is unclear whether this abbreviated form is useful, or confusing and should be disallowed.

### Boolean operations
Subtext does not use Boolean values like conventional languages do for making decisions. The standard Boolean operations can be done with try-blocks instead. The `rgb?` function above was an example of a logical OR. Here is the recipe for writing boolean operations:
```Txt
// a? OR b?
try {
  a?
} else {
  b?
} else reject

// a? AND b?
a?
b?

// not a?
not? {a?}
```

The `not?{}` block evaluates its contents, rejecting if they succeed, and succeeding if they reject (in which case the input value of the block is passed on).

By convention, comparison functions like `=?` and `<?` that succeed will result in their input value,  so that they can be inserted anywhere in a formula without changing the computation. To guarantee this behavior, any expression can be passed to the `check` function, which will result in its input if the expression succeeds, so these are equivalent: 
```Txt
x >? 0 even?() + 1
x check(>? 0) check(even?()) + 1
```
To emulate cascaded comparions like “x \< y \< z” do `x <?(y <? z)`.

Note that `not?{}` is a block, but `check()` is a function. Only blocks can catch rejections — a reject in the argument of a function call skips calling the function altogether.

### Assertions and tests
The `assert{...}` block converts a rejection into a crash. This is used to detect situations that should be impossible and which therefore indicate a programming error. For example
```Txt
assert {x =? y}
```
will crash if `x` and `y` are unequal.

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
  .x =? 0
  .x := 2
  .y =? 3
  y =? 1 // default state of y
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
Note the similarity between the choice operation `|=` and the record set operation `:=`. As with `:=` we can use a with-block to nest choices:
```Txt
a-plus = expr |= plus with{left |= literal 2, right |= literal 2}
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

Try blocks can define extra results that are choices assembled from each clause. For example:
```Txt
rgb = function {
  color: ''
  try {
    color =? 'red
    extra{color |= red}
  } else {
    color =? 'green'
    extra{color |= green}
  } else {
    color =? 'blue'
    extra{color |= blue}
  }
}
x = 'red' rgb()
x~color.red?
not?{x~color.green?}
```

The extra blocks in each try clause define the extra result `color` to be a choice with three options: `red`, `green`, and `blue`. Those options could have been given values by putting an expression following the option name inside the extra block, but as that wasn’t done the values default to `nil`, making `color` an enumeration.  Defining extra options in this way avoided the need to previously define a color enumeration — it gets defined automatically by combining all the options from the try clauses.

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

## Lists and tables

A _list_ contains a sequence of zero or more _items_ containing the same fixed type of value.  A _table_ is a list containing records. The items of a table are called _rows_ , and the fields of the record are called _columns_. Every list defines a value, called it’s _template_, which sets the default value for newly created items. For example:
```
numbers: list {0}
customers: table {
  name: ''
  address: ''
}
```
The list `numbers` contain numbers, defaulting to 0. The table definition `customers: table {...}` is equivalent to `customers: list {record {...}}`. The table contain columns `name` and `address` defaulting to the empty string. 

All lists are initially created as empty. A string is a list of characters with the space character as the template, so `'' =? list{space}`

The `&` function (pronounced “and”) is used to create items in a list. For example:
```
n = numbers & 1 & 2 & 3
c = customers & with{name:= 'Joe', address:= 'Pleasantown, USA'}
```
The `&` operator takes a list as it’s input and an item value as its argument, and results in a list equal to the input plus a new item. The default value of the argument to `&` is the template item, which provides a default value, so `&()` will create an item with the default value. In tables it is convenient to use a with-block as above to set some of the fields and let the others default.

The `&&` function concatenates lists: `list1 && list2` is a copy of `list1` with all the items from `list2` added to its end. The two lists must have the same type template.

The items in a list are numbered starting at 1 for the first item. This number is called the item’s _index_. The number of items (not counting the template) is called the list’s _length_, available with the `list length()` function. 

An item in a list can be accessed via its index using square brackets, as in:
```
n = numbers & 1 & 2
n[1] =? 1
n[2] =? 2
n length() =? 2
```

The template of a list is accessed with `list[]`. The expression `list[i]` will crash if `i` is fractional or non-positive or larger than the length of the list. You can test if an index is valid with:
```
list contains? index 
```
You can conditionalize list indexing with:
```
list[contains? index]
```
which works because the default value inside the brackets is the list itself, which becomes the input to the `contains?` function, which if successful results in the valid index. 

Items in a list can be updated individually by index:
```
n = numbers & 1 & 2
test {
  .n[1] := 3
  .n[1] =? 3
  .n[2] =? 2
}
```
Individual fields in a row can be updated similarly:
```
test {
  .customers[1].name := 'Joe Jr'
}

```
or equivalently using a with-block:
```
test {
  .customers[1] := with{name := 'Joe Jr.'}
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
} & with{name:= 'joe', amount:= 100} & with{name:= 'jane', amount:= 200}

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
where `i` must be \>=1 and \<= length + 1. The new item will then have the index `i`. An item already in the list can be moved using:
```
list move(i, at: j)
```
where `j` must be \>=1 and \<= length + 1.

Two lists are considered equal by the `=?` function when they have the same number of items with equal values in the same order. The `=?` function can only be used to compare lists with templates of the same type and the same kind of sorting (it is a static error otherwise). Lists can be converted between different sortings with the functions `sorted()` `reverse-sorted()` `unsorted()`. By requiring sorting compatibility for equality, we preserve the property that calling a function with equal inputs and arguments produces equal results, specifically the `&` function creating new items.

## Searching
A find-block searches in a list:
```
joe-index = customers find?{.name =? 'Joe'}
```
The `find?` block is evaluated repeatedly with an item as its input value, starting with the first item and continuing until it does not reject. The result is the index of that item. If all the items are rejected, the entire operation rejects. The `find-last?` block does the same thing except it scans the table backwards. The `find-only?` block produces the index of the only match, and rejects if there are none or more than one. Inside a find-block, the special reference `@index` will evaluate to the index of the current item.

It can be convenient to use a find-block as an index expression, which works because the default value of the index is the list itself
```
joe = customers[find?{.name =? 'Joe'}]
```

A useful special case is `list only?()`, resulting in the single item of the list, rejecting if the list has 0 or multiple items.

> recast to return items, with `~index` extra result
> return results - except predicates change default result unless wrapped in check
> `find-unique?` that returns result of block, so long as all matches return same value  
> 
### Replacing and combining

A _for-each_ block will evaluate a do-block on each item, resulting in an unsorted list with each row replaced with the result of the code block in the same order as the input. If an item is rejected, it is left out of the result. The `for-all?` block is like `for-each` except it rejects if the code block rejects on any item, otherwise resulting in the replaced table. The `for-none?` block does the opposite, rejecting if the code block accepts any item, otherwise resulting in the input list. For example:

```
test {
  l = list{0} & 1 & 2 & 3
  
  // replace each item with result of block on it (like functional map)
  l for-each {+ 1} =? (clear() & 2 & 3 & 4)
  
  // delete items on rejects (like functional filter)
  l for-each {not=? 2} =? (clear() & & 3)
  
  // replace and delete together
  l for-each {not=? 2, + 1} =? (clear() & 1 & 3)

  // check every item satisfies a condition
  l for-all? {>? 0}
  
  // check no item satisfies a condition
  l for-none? {<? 0}
}
```

A _combine_ block is used to calculate a single result from scanning a list.
```
l = list{0} & 1 & 2 & 3
l combine {
  item: that
  sum: 0
  item + sum
}
=? 6
```
A combine-block must be a function with an input and one argument. The function wil be called repeatedly with inputs from the items of the input list. The function input in this example is called `item` (which is defined as an item of the list by default). The argument `sum` to the function acts as an accumulator. On the first call it defaults to the defined value 0. On the second and subsequent calls, `sum` is set to the result of the previous call. This example is equivalent to the built-in `sum()` function that sums a numeric list. If the function rejects an item then it will be skipped and the accumulator argument will be passed on to the next call. A combine-block is similar to a “fold” in functional languages. 

## Tracked lists

A list can be defined to be _tracked_. Tracked lists automatically assign a unique ID to each item when it is created. The ID is used to precisely track changes to the item. Such IDs are called _surrogate keys_ in databases. The tracking ID is hidden from the user and programmer. Tracking allows two important features:

1. Relationships between tracked lists can be maintained, similar to relational databases, but without requiring that every item contain a unique and immutable key.
2. Tracked lists can be versioned and merged, similar to version control systems like git, except much more precisely. 

Two tracked lists are equal if their items are not only equal but also were created in the same relative order, including all items that were deleted. Tracked equality means that the lists not only have the same current state but also effectively the same history of changes.

> Tracked lists could offer sorting by creation time, and creation-time could be used to order duplicates in a list sorted by value.

> The IDs in tracked lists are implemented as monotonically increasing serial numbers within the list, as in an “auto-increment” field in a relational database. We are not exposing this because merging can renumber items (along with their selections).

### Links

Links are used to store references to items from outside the list. A common scenario is what relational databases call “foreign keys”, where rows in one table reference rows in another:

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

A link records a subset of the IDs in its target list. A link is edited in the UI with something like a pick list of the items in the target list. Links can be modified with several functions that produce modified selections
```
l := link i              // link item with index i in target
l := unlink i            // unlink item with index i in target
l links? i               // rejects if target index i is not linked
l := clear()             // unlink everything
l := link-all list       // link all IDs from another list or link
l := unlink-all list     // unlink all IDs from another list or link
l := copy list           // clear and link-all
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

### Synchronized links
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
  .customers := & with{name := 'joe'} & with{name := 'jane'}

  // Joe is a special customer
  joe = customers first?()
  .special-customers := link joe

  // write through link
  .special-customers[joe].address := 'Main St'
  .customers[joe].address =? 'Main St'

  // cascading delete
  .customers delete joe
  .special-customers length() =? 0

  // insert into target table via link
  .special-customers & with{name := 'john'}
  .customers[last?()].name =? 'john'
}

```

Synchronization takes place when a set statement (`:=`) executes on a context containing the affected tables and links, as in the `database` record in the above example. Changes made to copies of the links or tables have no side-effects until they are assigned back into a sufficiently broad context. The ability to do this is a major motivation for tracked tables.

> This is the essence of Subtext’s solution to unifying functional and imperative semantics, which we believe is novel. This will also be the basis of more general “action-at-a-distance” features like change triggers and updateable views.

### TODO: invalid links
Links can have the wrong number of linked items through several causes:
1. The user edits the link in the UI
2. Code computes a link
3. Deleting an item in the target list deletes all links to it
4. Creating a new item containing a link, which defaults to empty
The basic idea is to distinguish data and formula contexts. Invalid links in a formula will crash. Invalid links in a data field are considered a constraint violation, which prevents committing them to the document state until they are corrected manually.

### TODO: Nested links
Links can target nested lists, linking to a path of IDs. Reflecting links can cross multiple layers of containing lists. Cardinality constraints are specified seperately for each level of nesting. 

### Merging

Copies happen. Documents get shared as email attachments. Documents get imported into other documents. Inevitably, both the copy and the original change. Tracking allows such changes to be later sent to the other version without wiping out all the changes that have happened to it in the meantime. This is called _merging_. 

Two copies of a tracked list can be compared to see exactly how they have diverged. The IDs in tracked lists allow changes made to an item to be tracked despite any changes made to its value or location. Deletions and creations are also known exactly. Tracking provides more precise information than text-based version control systems like git. 

Changes made to one copy can be merged into the other. If changes are merged in both directions the two copies become equal again. Sometimes changes made to both copies are such that merging must lose some information, for example if the same field in the same item is changed to be two different numbers. Merging can be done using an automatic policy to resolve such conflicts, or human intervention can be requested, either immediately in the UI when performing the merge, or later by reifying such conflicts into the document itself (but without breaking the document as textual version-control does).

Merging can be done across copies of entire documents. Merging can also apply to documents included inside another document (see _include_ and _variant_). Merging applies to all tracked lists and links within a document. Non-tracked lists are treated as atomic values, like strings, that change as a whole.

TODO: details.

## Parsing

It is common to need to find and operate on patterns in strings. The traditional solutions involve specialized languages with radically different syntax and semantics, such as _regular expressions_ or _parser generators_. Subtext provides these capabilities without the need to learn a specialized sub-language.

A _selection_ is a list that has been divided into three parts, called _before_, _selected_, and _after_. Any of these parts can be empty. We can define a selection to be a list plus two indices `begin` and `end` where `1 ≤ begin ≤ end ≤ length + 1`. A selection is created from a list with
```
list selection(begin:= i, end:= j)
```
where the begin and end indexes default to 1.

Two selections are equal if they are equal as lists and have equal begin and end indexes. A selection is equal to a list if its begin and end indexes are both 1 and the after part is equal to the list. The UI displays a string selection with the selected part highlighted as in a text region selection. If the selection is empty, the UI displays it as a text cursor between two characters, or at the beginning or end. When a string selection is edited, changes to the cursor/selection state are saved.

selections are useful when attempting to recognize various patterns in a string (or any kind of list, but we focus on strings in the following). This process is called _matching_. The most basic matching function is `match?`, which will check that the front of the input string equals the argument string, rejecting otherwise. So:
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
The input to a matching function can be a string or a selection in a string — if it is a selection then matching is done against the **after** part. In that way a sequence of matches will look for a sequence of patterns:
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

Another useful matching function is `match-number?` which matches a numeric string and returns its numeric value as an extra result `number`. For example:
```Txt
'123foo' match-number?()
check after() =? 'foo'
check ~number =? 123
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

The above example will match simple expression adding numbers, but how would we perform the indicated addition? The simplest way is to mimick the way that the `match-number?` function produces the extra result `~number`, as follows:

```
match-expr? = '' try {
  match-number?()
  extra{~value = ~number}
} else {
  match '('
  left = match-expr?()
  match? '+'
  right = match-expr?()
  extra{~value = left~value + right~value}
} else reject

'(2+2)' match-expr?() ~value =? 4
```

Commonly a more general solution is used: producing an AST (Abstract Syntax Tree) during the match, and then interpreting it later in various ways. We have already seen an example of an AST for these expressions — it is the `eval-expr` example of recursive choices, recalled here:
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

We can produce an `expr` as an extra result of `match-expr?` called `~AST` by adding two lines of code:
```
match-expr? = '1+1' try {
  match-number?()
  extra{~AST = expr |= literal ~number}
} else {
  left-expr = match-expr?()
  match? '+'
  right-expr = match-expr?()
  extra{~AST = expr |= plus with{left: left-expr~AST, right: right-expr~AST}}
} else reject

`2+2` match-expr?() ~AST eval-expr() =? 4
```

The first extra block
```
  extra{~AST = expr |= literal ~number}
```
set the extra result `AST` to be an `expr` choice choosing the `literal` option with the value from the `number` extra result of the prior `match-number?` call. The second extra block
```
  extra{~AST = expr |= plus with{left: left~AST, right: right~AST}}
```
is more complicated. It chooses the `plus` option, and sets the `left` and `right` fields of its record value to be the corresponding `AST` results from the recursive parses of the syntax to the left and right of the plus sign. The last line
```
'2+2' match-expr?() ~AST eval-expr() =? 4
```
matches the string `2+2`, pulls out the AST result and inputs it to `eval-expr` to get the final result 4.

We can simplify the above solution by eliminating the definition of `expr`,  instead defining it implicitly inside `match-expr?` and then redefining `eval-expr` to take it as input. We use the ability for the extra blocks inside try-clauses to asemble a choice rather than using one defined previoously.

```
match-expr? = '1+1' try {
  match-number?()
  extra{~AST |= literal ~number}
} else {
  left-expr = match-expr?()
  match? '+'
  right-expr = match-expr?()
  extra{~AST |= plus record{left: left-expr~AST, right: right-expr~AST}}
} else reject

eval-expr = function {
  x: match-expr?~AST
  try {
    x.literal?
  } else {
    x.plus?.left eval-expr() +(x.plus?.right eval-expr())
}

'2+2' match-expr?() ~AST eval-expr() =? 4
```


### Repeated matching
Often we want to match a repeating pattern, and produce an extra result which is a list. Subtext uses recursion to do unbounded looping. Here is an example that matches a CSV string into a list of numbers:

```
csv? = function {
  string: '1,2,3'
  numbers: list {0}
  try {
    string =? ''
    extra(~numbers = numbers)
  } else {
    string match-number?()
    match? ','
    csv?(numbers & ~number)
  } else reject
}
csv?~numbers =? (clear() & 1 & 2 & 3)
```

This is an example of _tail recursion_: the recursive call to `csv?` only occurs where its result(s) will be immediately become the result of the whole function. The UI will display the execution of tail-recursive calls as a linear list of calls rather than the stack of nested calls that it is in reality. 

> We hypothesize that visualizing tail recursion as if it were a loop will provide the conceptual simplicity of looping without having to add any extra language syntax or semantics, while still allowing for non-tail calls to be visualized as nested executions.

To make recursion simpler and clearer, there is a special form for making recursive calls: `repeat`. In the above example, the following calls are all equivalent:
```
csv?(numbers & ~number)
repeat?(numbers & ~number)
repeat?(& ~number)
```
A `repeat` can be used inside a function or any do-block (`repeat?` if the block is conditional). It will make a recursive call to the containing do-block or function, but with all the arguments defaulting to their value in the current call, not their defined values as in a normal call. Thus in this example the `numbers` argument becomes just `& ~number` to append to the list that was passed in.

### Scanning

A scan-block can be used to search for a pattern in a string. For example:
```
string = 'foo123'
string scan {match-number?()}
check selected() =? '123'
check ~number =? 123
```
A scan-block will repeatedly execute the enclosed block until it succeeds. At first the input string or selection is passed to the code in the block, and if it succeeds nothing further is done. But if it fails the block is reexecuted with a selection that skips one character (or item) in the input. This is done by moving the selected part to the before part, and then moving the first item of the after part to the before part. One character at a time is skipped this way until the match succeeds or the end of the string is hit (which results in selecting the end of the string).

### Replacing

You can replace matched portions of strings as follows:
```
'Some Millenials attacking other Millenials' scan {
  match? 'Millenial'
  replace-selection 'snake-people'
  repeat()
} 
combined() =? 'Some snake-people attacking other snake-people'
```
The `replace-selection` replaces the selected part of the input with the argument string. Note that replacing the selection does not affect subsequent matches, which work on the after-part, so replacement can be done “on the fly”. The `combined()` function at the end converts the final selection back into a plain string by concatenating the before, selected, and after parts.

## Missing values
Nulls are a perennial controversy in PL and DB design. The idea is to add a special value Null to all types of values in order to represent a “missing” or “unknown” value. Unfortunately Null adds complexity and more ways for code to break, or more language features to avoid breaking. FP languages avoid Null values by using Option wrappers (like Subtext choices), but at the cost of continually wrapping and unwrapping values.  NULL in SQL is an acknowledged disaster. We want to avoid this whole mess if possible.

We propose a simple solution for missing values that visualizes naturally in the UI:

1. There is a special number called `_number_` that corresponds to an empty numeric field in the UI. Numeric functions treat `_number_` as a special case, as Excel does with empty cells. Unlike IEEE NaN, `_number_` is equal to itself.
2. The empty string represents a missing string.
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

Field names are nominal, which ironically means that their names are irrelevant (unlike structural systems where the spelling of a field’s name identifies it). Every time a field is defined a globally unique ID is assigned to it. There is a document-wide dictionary that maps these field IDs to their current name strings. Renaming a field just changes that dictionary entry. So the following two definitions look similar but define two different `a` fields.
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

# scraps

## Semantics

In PL terms, code blocks are pure on the outside but imperative on the inside. While they can be seen as internally mutating locations within their subject, they have no effect on any state outside themselves. All they can do is return a changed subject value, which their caller may in turn use to mutate its own subject value.


The subject of a code block can be the entire document, and in fact the document history is exactly that: a record of all actions performed on the document, with the changing document state passed as the subject between commands. Every time a user performs an action a new command executing it is added to be end of the history block. The current state of the document is the final result of the history block. Changes to the document, which appear to be stateful global effects, are really local changes within the document history. So while code blocks have no external effects, we still see changes happening because we are living inside a code block.

> FIXME: Steve says above confusing. “code feels like you are mutating”. Make imperative code functional instead of vice-versa. Explain interaction model better.


### Determinism
Subtext is deterministic: every code block’s end value is purely a function of its input subject, arguments, and the prior state of the document. History is also deterministic, because it records all user actions and external inputs (including sources of randomness) that affect the state of the document. Thus the current and prior states of the document can be exactly reproduced by replaying history.

### Termination
Sometimes code takes too long to execute, or consumes too many internal resources.

> TBD. Simplest solution is that doc becomes read-only while reacting to an input, and then the results are shown atomically at completion. If computation takes too long the user can terminate it, which cancels the entire input action and leaves the document in its prior state. The input action remains in the history though and can be redone later if desired. Exceeding resource quotas (like stack size) would also terminate computation. However it would be nicer to be able to interrupt a long-running execution, observe it’s execution so far, and resume if desired.


# Appendix: code introspection
The key research goal of Subtext 9 was exploiting the reified execution model at runtime. The motivating example is a simple recursive descent parser which could be reflected on to get an AST for free. This works, but is hard to explain, involving higher-order values. A more conventional solution is the _extra results_ mechanism which now replaces the reflective approach. Below is the previous discussion of the reflectve approach.

## Associated results

The result of a function is the value of the last field. However we often would like to return extra results from a function. For example, integral division would like to return not only the integral ratio but the fractional remainder as well:
```
integral-divide = function {
  numerator: 1
  divisor: 1
  ratio = numerator /(divisor) floor()
  remainder = numerator -(ratio * divisor)
  ratio
}
x = 5 integral-divide 3  // 1
```

The formula `x` calls the function `integral-divide` as follows
1. The input field `numerator`of the function is set to `5`
2. The `divisor` field is set to `3`
3. The `ratio` is calculated to be 1 using the `floor` function to round-down the division
4. The `remainder` field is calculated to be 2 based on `ratio`
5. The ratio is the last value in the function, so it becomes the value of `x`

We can access the remainder from this calculation with:
```
y = x~remainder
```
The reference `x~remainder` is pronounced “x’s remainder”. What this does is to reference the block defining x’s expression, and extract the `remainder` field from it. We will see more examples of associated results when we discuss parsing, including the ability to treat an entire expression or function call as a value.

## Parsing

The most basic parsing function is `match?`, which takes a string argument and matches that against the front of the input string, returning the remainder if it is present, or rejecting otherwise. For example, the following function matches either `'foo'` or `'bar'`:

```
foobar? = function {
  in: ''
  try {
    match? 'foo'
   } else {
    match? 'bar'
   } else reject

test {
  'foo123' foobar?() =? '123'
  'bar123' foobar?() =? '123'
  not?{'123' foobar?()}
}
```

Parsing alternative patterns like in this example requires backtracking, which we get from the way rejection discards changes to the subject value. Thus we can use normal conditional and looping constructs to do backtracking parsing.

Another useful parsing function is `match-number?` which matches a numeric string and returns its numeric value as an associated result `number`. For example:

```
test {
  x? = '123foo' match-number?()
  x? =? 'foo'
  x?~number =? 123
}
```

Here is an example of parsing a simple numeric expression like the `expr` example earlier:
```
match-expr? = '1+1' try {
  match-number?()
} else {
  match-expr?()
  match? '+'
  match-expr?()
} else reject
```

This works, but in order to write an interpreter for this syntax we need to construct an AST like the `expr` datatype defined earlier. It can require a lot of boilerplate code to construct an AST during parsing, which is why many parsing DSLs add special semantics to do this automaticlly. Instead we can use the code itself as the AST by adding names to the try clauses and extracting associated results, as follows:

```Txt
match-expr? = '1+1' try
literal? = {
  match-number?()
} else
plus? = {
  left? = match-expr?()
  match? '+'
  right? = match-expr?()
} else reject

eval-expr = function {
  expr: match-expr~
  try {
    expr~literal?~number
  } else {
    expr~plus?~left?~ eval-expr() + (expr~plus?~right?~ eval-expr())
}

test {
  check '1+2' match-expr?()~ eval-expr() =? 3
}
```

In the above we labeled the try clauses with `literal?` and `plus?`. We also labeled the recursive calls to `match-expr?` with `left =` and `right =`. The `eval-expr` function takes the formula of `match-expr` as its input. It accesses the try clauses labeled `literal?` and `plus?` as if they were fields of a choice. In fact a try block is essentially a choice block that is dynamically computed, with exactly one choice per clause.

The `test` block matches and evaluates `1+2`. The function call `match-expr()~` ends with a `~`, indicating that the formula of the call is used rather than it’s result, which is then passed into the call to `eval-expr()`.

The novel feature here is that parsing code serves as its own AST by just adding labels, which is made possible by the way Subtext materializes code execution. We will return to parsing later, showing how to parse repeated sequences after we describe tables.



# Appendix: Glossary

# Appendix: Syntax

```
Atom :=
	| '{}'				// unit value 'nothing'
	| Number
	| String
	| '_serial_'		// missing serial number

Number :=
	| // JavaScript number
	| '_number_'		// Special missing number

String := 		// single-quoted JavaScript string literal

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
	| (Name '=')? Check Expr ('error' String)?
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