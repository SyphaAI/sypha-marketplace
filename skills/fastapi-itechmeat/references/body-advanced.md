# Body - Advanced Topics

Advanced patterns for working with request bodies.

## Multiple Body Parameters

Using multiple Pydantic models produces JSON keys named after each parameter:

```python
from fastapi import FastAPI
from pydantic import BaseModel

class Item(BaseModel):
    name: str
    price: float

class User(BaseModel):
    username: str
    full_name: str | None = None

@app.put("/items/{item_id}")
async def update_item(item_id: int, item: Item, user: User):
    return {"item_id": item_id, "item": item, "user": user}
```

Expected body:

```json
{
  "item": { "name": "Foo", "price": 42.0 },
  "user": { "username": "dave", "full_name": "Dave Grohl" }
}
```

## Singular Values in Body

Use `Body()` to include non-model scalar values in the request body:

```python
from typing import Annotated
from fastapi import Body

@app.put("/items/{item_id}")
async def update_item(
    item_id: int,
    item: Item,
    user: User,
    importance: Annotated[int, Body()]
):
    return {"item_id": item_id, "importance": importance}
```

Expected body:

```json
{
    "item": {...},
    "user": {...},
    "importance": 5
}
```

## Embed Single Body Parameter

Force key-wrapping when there is only one model parameter:

```python
@app.put("/items/{item_id}")
async def update_item(
    item_id: int,
    item: Annotated[Item, Body(embed=True)]
):
    return {"item_id": item_id, "item": item}
```

With `embed=True`:

```json
{ "item": { "name": "Foo", "price": 42.0 } }
```

Without `embed=True`:

```json
{ "name": "Foo", "price": 42.0 }
```

## Field Validation

Apply Pydantic's `Field` to constrain model attributes:

```python
from pydantic import BaseModel, Field

class Item(BaseModel):
    name: str
    description: str | None = Field(
        default=None,
        title="The description of the item",
        max_length=300
    )
    price: float = Field(gt=0, description="Must be greater than zero")
    tax: float | None = None
```

`Field` parameters: same as `Query`, `Path`, `Body`.

## Nested Models

Reference Pydantic models as field types inside other models:

```python
from pydantic import BaseModel, HttpUrl

class Image(BaseModel):
    url: HttpUrl  # Validated URL
    name: str

class Item(BaseModel):
    name: str
    price: float
    images: list[Image] | None = None
```

## Special Types

- `set[str]` - Deduplicated set of unique items
- `list[str]` - Ordered list
- `dict[int, float]` - Keys are coerced from JSON strings to integers
- `HttpUrl` - Validated URL string
- `EmailStr` - Validated email address (requires `pydantic[email]`)

## Bodies of Pure Lists

```python
@app.post("/images/multiple/")
async def create_multiple_images(images: list[Image]):
    return images
```

## Arbitrary Dict Bodies

```python
@app.post("/index-weights/")
async def create_index_weights(weights: dict[int, float]):
    return weights
```

JSON keys arrive as strings and are coerced to `int`.

## Extra Data Types

| Type                 | Request/Response Format |
| -------------------- | ----------------------- |
| `UUID`               | String                  |
| `datetime.datetime`  | ISO 8601 string         |
| `datetime.date`      | ISO 8601 string         |
| `datetime.time`      | ISO 8601 string         |
| `datetime.timedelta` | Float (total seconds)   |
| `bytes`              | String (binary format)  |
| `Decimal`            | Float                   |
| `frozenset`          | List (unique items)     |

```python
from datetime import datetime, timedelta
from uuid import UUID

@app.put("/items/{item_id}")
async def read_items(
    item_id: UUID,
    start_datetime: Annotated[datetime, Body()],
    process_after: Annotated[timedelta, Body()],
):
    start_process = start_datetime + process_after
    return {"item_id": item_id, "start_process": start_process}
```
