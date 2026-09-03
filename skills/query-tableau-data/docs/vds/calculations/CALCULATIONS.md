# Calculations in Tableau

This article covers how to build and format calculations in Tableau. It outlines the fundamental components of calculations and details the correct syntax for each one.

## Folder Contents

| File | Description |
| --- | --- |
| [SYNTAX.md](./SYNTAX.md) | Detailed syntax reference for all calculation components — functions, fields, operators, literals, parameters, and comments |
| [TYPES.md](./TYPES.md) | Overview of data types supported in calculations and how to use them correctly with functions |
| [LEVEL_OF_DETAIL.md](./LEVEL_OF_DETAIL.md) | Reference for Level of Detail (LOD) expressions — FIXED, INCLUDE, and EXCLUDE — and when to use each |
| [TABLE_CALCULATIONS.md](./TABLE_CALCULATIONS.md) | Guide to table calculations: transformations applied to local query results such as running totals, rankings, and percentages |
| [BEST_PRACTICES.md](./BEST_PRACTICES.md) | Tips and guidelines for writing efficient calculations and avoiding common performance pitfalls |
| [functions/FUNCTIONS.md](./functions/FUNCTIONS.md) | Index and reference for all built-in VDS functions organized by category |

> **Important**: `Level of Detail Expressions`, `Table Calculations` and `Functions` are your most powerful primitives for calculations. In particular, `Functions` allow you to leverage powerful built-in operations in the Tableau calculations language.

## Why use calculations?

Calculations enable you to generate new data derived from what already exists in your data source, and to run computations against that data. This makes it possible to carry out sophisticated analyses and add fields to your data source independently and in real time.

## When to use calculations?

The initial challenge when learning calculations in Tableau is recognizing when you actually need one. There are numerous reasons to reach for a calculation. A few examples:

* To segment data
* To convert the data type of a field, such as converting a string to a date.
* To aggregate data
* To filter results
* To calculate ratios

Typical situations where calculations are useful include:

* The data required for your analysis does not exist in your data source.

  For example, if your data source contains Sales and Profit fields but you need cost, you can *create* a Cost field using a formula like the following.

  `[Sales] - [Profit]`

* You need to transform values within your query.

  For example, you might want to compute the year-over-year change in profit.

* You want to quickly categorize data.

  For example, you might want to label records in your query as profitable or nonprofitable. You can build a calculated field using a calculation such as:

  ```
  IF SUM([Profit]) > 0
  THEN "Profitable"
  ELSE "Nonprofitable"
  END
  ```

---

## Calculation building blocks

Every Tableau calculation is made up of four fundamental components:

* **Functions**: Statements that transform the values or members of a field.
  + Functions take *arguments* — specific pieces of input. Depending on the function, arguments may be fields, literals, parameters, or nested functions.
* **Fields**: Dimensions or measures from your data source.
* **Operators**: Symbols that represent an operation.
* **Literal expressions**: Fixed constant values coded directly into the calculation, such as "High" or 1,500.

Not every calculation requires all four components. Calculations may also include:

* **Parameters**: Placeholder variables that substitute for constant values in a calculation.
  For more information on parameters, see Create Parameters.
* **Comments**: Annotations about a calculation or its parts that are excluded from the calculation's output.

For details on how to use and format each of these components, refer to the sections below.

### Example calculation explained

Consider the following calculation, which adds 14 days to a date ([Initial Visit]). This kind of calculation is handy for automatically identifying the date of a two-week follow-up appointment.

`DATEADD('day', 14, [Initial Visit])`

Breaking down the components of this calculation:

* Function: `DATEADD`, which requires three arguments.
  + date\_part ('day')
  + interval (14)
  + date ([Initial Visit]).
* Field: [Initial Visit]
* Operators: n/a
* Literal expressions:

+ String literal: 'day'
+ Numeric literal: 14

In this example, the hardcoded constant 14 could be replaced with a parameter, giving users the ability to choose how many days ahead to schedule a follow-up appointment.

```
DATEADD('day', [How many days out?], [Initial Visit])
```

## At a glance: calculation syntax

|  |  |  |
| --- | --- | --- |
| **Components** | **Syntax** | **Example** |
| **Functions** | See [FUNCTIONS.md](./functions/FUNCTIONS.md) for an index of all supported functions in VDS | `SUM(expression)` |
| **Fields** | A field in a calculation is often surrounded by brackets [ ].  See Field syntax for more information. | `[Category]` |
| **Operators** | `+`, `-`, `*`, `/`, `%`, `==`, `=`, `>`, `<`, `>=`, `<=`, `!=`, `<>`, `^`, `AND`, `OR`, `NOT`, `( )`.  See Operator syntax for information on the types of operators you can use in Tableau calculation and the order they are performed in a formula. | `[Price]*(1-[discount])` |
| **Literal expressions** | Numeric literals are written as numbers.  String literals are written with quotation marks.  Date literals are written with the # symbol.  Boolean literals are written as either true or false.  Null literals are written as null.  See Literal expression syntax for more information. | `1.3567`  `"Unprofitable"`  `#August 22, 2005#`  `true`  `Null` |
| **Parameters** | A parameter in a calculation is surrounded by brackets [ ], like a field. See Create Parameters for more information. | `[Bin Size]` |
| **Comments** | To enter a comment in a calculation, type two forward slashes //. See Add comments to a calculation for more information.  Multi-line comments can be added by typing /\* to start the comment and \*/ to end it. | `SUM([Sales]) / SUM([Profit])`  `/*John's calculation`  `To be used for profit ratio`  `Do not edit*/` |

> _Note_: For more detailed syntax descriptions see [SYNTAX.md](./SYNTAX.md) and [TYPES.md](./TYPES.md).

---

### Related Documentation

- [FIELDS.md](../FIELDS.md) — how to include calculations and table calculations in a query field
- [FILTERS.md](../FILTERS.md) — using calculated filter fields
- [PARAMETERS.md](../PARAMETERS.md) — overriding parameters referenced in calculations
- [LIMITATIONS.md](../LIMITATIONS.md) — unsupported calculation functions and categories
