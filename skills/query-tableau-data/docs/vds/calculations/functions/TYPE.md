# Type Conversion

## Why use type conversion functions

Type conversion functions let you change a field from one data type to another — an operation known as "casting." For instance, if date information is stored in a string field, that field cannot be used in date calculations until it is cast to the date data type.

For example, to use a string-formatted date field with DATEDIFF, a type conversion is required:

`DATEDIFF('day', [Date Field], DATE([String Date Field]) )`

Omitting the DATE function would result in the error: "DATEDIFF is being called with (string, date, string)".

> **VDS Note**: VDS does not support datetime output — use `DATE` not `DATETIME`. Functions that produce datetime (`DATETIME`, `MAKEDATETIME`, `MAKETIME`) are not supported. Spatial constructors (`MAKELINE`, `MAKEPOINT`) are also not supported.

---

## Type conversion functions available in VDS

### DATE

|  |  |
| --- | --- |
| Syntax | `DATE(expression)` |
| Output | Date |
| Definition | Returns a date given a number, string, or date expression. |
| Example | ``` DATE([Employee Start Date]) ```  ``` DATE("September 22, 2018") ```  ``` DATE("9/22/2018") ``` |
| Notes | Unlike DATEPARSE, no format pattern is required — DATE automatically identifies many standard date formats. If the input is not recognized, use DATEPARSE and specify the format explicitly. MAKEDATE is a related function, but it requires separate numeric inputs for year, month, and day. |

### FLOAT

|  |  |
| --- | --- |
| Syntax | `FLOAT(expression)` |
| Output | Floating point number (decimal) |
| Definition | Casts its argument as a floating point number. |
| Example | ``` FLOAT(3) = 3.000 ``` |
| Notes | See also INT which returns an integer. |

### INT

|  |  |
| --- | --- |
| Syntax | `INT(expression)` |
| Output | Integer |
| Definition | Casts its argument as an integer. For expressions, this function truncates results to the closest integer toward zero. |
| Example | ``` INT(8/3) = 2 ```  ``` INT(-9.7) = -9 ``` |
| Notes | When converting a string to an integer, the value is first converted to a float and then rounded to the nearest integer.  See also FLOAT which returns a decimal. See also ROUND, CEILING, and FLOOR. |

### MAKEDATE

|  |  |
| --- | --- |
| Syntax | `MAKEDATE(year, month, day)` |
| Output | Date |
| Definition | Returns a date value built from the provided numeric year, month, and day components. |
| Example | ``` MAKEDATE(1986,3,25) = #1986-03-25# ```   Invalid inputs are automatically adjusted to a valid date — for example, MAKEDATE(2020,4,31) yields May 1, 2020 rather than raising an error for a non-existent April 31st. |
| Notes | Supported for Tableau Data Extracts. Verify availability before using with other data sources.  MAKEDATE expects numeric arguments for each date component. If your data is a string that represents a date, use the DATE function instead. DATE automatically handles many standard date formats; if it does not recognize the input, use DATEPARSE. |

### STR

|  |  |
| --- | --- |
| Syntax | `STR(expression)` |
| Output | String |
| Definition | Casts its argument as a string. |
| Example | ``` STR([ID]) ``` |

---

## Cast Boolean expressions

A Boolean value can be cast to an integer, float, or string type, but cannot be cast to a date.

* `True` maps to 1, 1.0, or "1"
* `False` maps to 0, 0.0, or "0"
* `Unknown` maps to `Null`
