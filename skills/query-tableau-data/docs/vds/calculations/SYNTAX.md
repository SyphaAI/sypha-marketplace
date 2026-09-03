# Calculation syntax in detail

Refer to the sections below to understand the individual components of Tableau calculations and the formatting rules that make them work correctly.

## Function syntax

Functions are the core building blocks of a calculation and serve a wide range of purposes.

Each function in Tableau has its own required syntax. For example, the calculation below uses two functions, `LEN` and `LEFT`, along with several logical operators (`IF`, `THEN`, `ELSE`, `END`, and `>` ).

`IF LEN([Name])> 5 THEN LEFT([Name],5) ELSE [Name] END`

* `LEN` takes a single argument, such as `LEN([Name])` which returns the number of characters (that is, the length) for each value in the Name field.
* `LEFT` takes two arguments, a field and a number, such as `LEFT([Name], 5)` which returns the first five characters from each value in the Name field starting from the left.
* The logical operators `IF`, `THEN`, `ELSE`, and `END` work together to create a logical test.

This calculation checks the length of a name and, when it exceeds five characters, returns only the first five. Otherwise, it returns the full name.

In the calculation editor, functions are colored blue.

#### Using multiple functions in a calculation

A single calculation can include more than one function. For example:

`IF SUM([Sales]) != 0 THEN SUM([Profit]) / SUM([Sales]) END`

There are three functions in the calculation: IF, and two uses of SUM. The two SUM aggregations are separated with the division operator (/).

A function can also be nested inside another function. In the example above, `SUM([Sales])` is computed before the division because it is inside parentheses. For more information on why, see Parentheses.

### Field syntax

Fields can be referenced directly inside your calculations. A function's syntax typically indicates where a field should appear. For example: `SUM(expression)`.

Field names should be enclosed in brackets [ ] within a calculation when the field name includes a space or is not unique. For example, [Sales Categories].

The function you choose determines which field type is valid. For example, the SUM function accepts numeric fields but not date fields. For more information, see Understanding data types in calculations.

The fields you select also depend on what the calculation is meant to accomplish. For example, a profit ratio calculation draws on the Sales and Profit fields from your data source:

`SUM([Sales])/SUM([Profit])`

Fields are colored orange in Tableau calculations.

### Operator syntax

Building calculations requires familiarity with the operators Tableau supports. This section covers the basic operators available and the order (precedence) in which they are evaluated.

Operators are colored black in Tableau calculations.

#### + (addition)

The + operator performs addition on numbers and concatenation on strings. Applied to dates, it adds a specified number of days to a date.

For example:

* `7 + 3`
* `Profit + Sales`
* `'abc' + 'def' = 'abcdef'`
* `#April 15, 2024# + 15 = #April 30, 2024#`

#### – (subtraction)

The - operator performs subtraction on numbers and negation when applied to an expression. Applied to dates, it subtracts a number of days from a date. It can also be used to compute the number of days between two dates.

For example:

* `7 - 3`
* `Profit - Sales`
* `-(7+3) = -10`
* `#April 16, 2024# - 15 = #April 1, 2024#`
* `#April 15, 2024# - #April 8, 2024# = 7`

#### \* (multiplication)

The \* operator performs numeric multiplication.

For example: `5 * 4 = 20`

#### / (division)

The / operator performs numeric division.

For example: `20 / 4 = 5`

#### % (modulo)

The % operator returns the remainder from a division operation. Modulo can only operate on integers.

For example: `9 % 2 = 1`. (Because 2 goes into 9 four times with a remainder of 1.)

#### ==, =, >, <, >=, <=, !=, <> (comparisons)

These are the standard comparison operators available for use in expressions.

Their meanings are as follows:

* **==** or **=** (equal to)
* **>** (greater than)
* **<** (less than)
* **>=** (greater than or equal to)
* **<=** (less than or equal to)
* **!=** or **<>** (not equal to)

Each operator compares two numbers, dates, or strings and returns either TRUE, FALSE, or NULL.

#### ^ (power)

This symbol is equivalent to the POWER function. It raises a number to the specified power.

For example: `6^3 = 216`

#### AND

This is a logical operator. An expression or a boolean must appear on either side of it.

For example: `IIF(Profit=100 AND Sales =1000, "High", "Low")`

See `AND` in Logical Functions for more information.

#### OR

This is a logical operator. An expression or a boolean must appear on either side of it.

For example: `IIF(Profit=100 OR Sales =1000, "High", "Low")`

See `OR` in Logical Functions for more information.

#### NOT

This is a logical operator. It can be used to negate another boolean or an expression. For example,

`IIF(NOT(Sales = Profit),"Not Equal","Equal")`

#### Other Operators

CASE, ELSE, ELSEIF, IF, THEN, WHEN, and END are also operators used for Logical Functions.

### Operator precedence

All operators in a calculation are evaluated in a defined order. For example, `2*1+2` equals 4, not 6, because multiplication is evaluated before addition (the \* operator always takes precedence over the + operator).

When two operators share the same precedence level, such as addition and subtraction (+ or -), they are evaluated from left to right.

Parentheses can override the default order of precedence. See the Parentheses section for more information.

| Precedence | Operator |
| --- | --- |
| 1 | – (negate) |
| 2 | ^ (power) |
| 3 | \*, /, % |
| 4 | +, – |
| 5 | ==, =, >, <, >=, <=, !=, <> |
| 6 | NOT |
| 7 | AND |
| 8 | OR |

#### Parentheses

Parentheses can be used as needed to force an order of precedence. Operators that appear within parentheses are evaluated before those outside of parentheses, starting from the innermost parentheses and moving outward.

For example, (1 + (2\*2+1)\*(3\*6/3) ) = 31 because the operators within the innermost parentheses are performed first. The calculation is calculated in the following order:

1. (2\*2+1) = 5
2. (3\*6/3) = 6
3. (1+ 5\*6) = 31

### Literal expression syntax

This section describes the correct syntax for literal expressions in Tableau calculations. A literal expression represents a constant value exactly as written. When using functions you will sometimes need literal expressions to supply numbers, strings, dates, and other fixed values.

For example, if a function expects a date input, you should type #May 1, 2005# rather than "May 1, 2005", which would be interpreted as a string. The `#` syntax is equivalent to using a date function to convert a string argument to a date (refer to Date Functions).

Tableau calculations support numeric, string, date, boolean, and null literals. Each type and its formatting rules are described below.

Literal expressions are colored black and gray in Tableau calculations.

#### Numeric Literals

A numeric literal is written as a plain number. To input the number one as a numeric literal, enter `1`. To input 0.25, enter `0.25`.

#### String Literals

A string literal can be written using either 'single quote' or "double quote" delimiters.

If your string contains a single or double quote, use the other quote type for the outer string delimiters.

For example, to input the string `"cat"` as a string literal, type `'"cat"'`. For `'cat'` type `"'cat'"`. To enter `She's my friend` as a string literal, use double quotes: `"She's my friend."`

#### Date Literals

> **VDS Note**: In VDS filter values and date comparisons, use RFC 3339 format strings (e.g., `"2020-01-15"`), not Tableau's `#date#` literal syntax. Tableau `#date#` syntax is used in Tableau Desktop calculations but is not valid in VDS API requests.

#### Boolean Literals

Boolean literals are written as either true or false. To input "true" as a boolean literal, enter `true`.

#### Null Literals

Null literals are written as Null. To input "Null" as a Null literal, enter `Null`.

### Add parameters to a calculation

Parameters are placeholder variables that can be inserted into calculations to replace constant values. When a parameter is used in a calculation, you can expose a parameter control in a view or dashboard so users can change the value dynamically.

For details, see [PARAMETERS.md](../PARAMETERS.md).

### Add comments to a calculation

You can annotate a calculation with comments to document it or explain its parts. Comments are not included in the computation of the calculation.

To add a comment to a calculation, type two forward slash (//) characters.

For example:

`SUM([Sales])/SUM([Profit]) //My calculation`

In this example, `//My calculation` is a comment.

A comment begins at the two forward slashes (//) and continues to the end of the line. To resume the calculation, start a new line.

A multi-line comment begins with a forward slash followed by an asterisk (/\*) and ends with an asterisk followed by a forward slash (\*/). For example:

```
SUM([Sales])/SUM([Profit])
/* This calculation is
used for profit ratio.
Do not edit */
```

Comments are colored gray in Tableau calculations.
