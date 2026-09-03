# Request Body

Transmitting JSON data from a client to the API using Pydantic models.

## Basic Example

```python
from fastapi import FastAPI
from pydantic import BaseModel

class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None

app = FastAPI()

@app.post("/items/")
async def create_item(item: Item):
    return item
```

## Pydantic Model Rules

- Required fields have no default value
- Optional fields use `= None`
- Fields with defaults are declared as `= value`

Valid JSON for above model:

```json
{"name": "Foo", "price": 45.2}
{"name": "Foo", "description": "A thing", "price": 45.2, "tax": 3.5}
```

## What FastAPI Does Automatically

1. Parses the request body as JSON
2. Performs type coercion (e.g., string to int)
3. Validates the data structure against the model
4. Returns descriptive errors when data is invalid
5. Provides editor autocomplete for model attributes
6. Produces a JSON Schema for use in the OpenAPI docs

## Using the Model

```python
@app.post("/items/")
async def create_item(item: Item):
    item_dict = item.model_dump()  # Convert to dict
    if item.tax is not None:
        price_with_tax = item.price + item.tax
        item_dict.update({"price_with_tax": price_with_tax})
    return item_dict
```

## Combining Parameters

FastAPI infers parameter types automatically:

```python
@app.put("/items/{item_id}")
async def update_item(
    item_id: int,              # Path parameter
    item: Item,                # Request body (Pydantic model)
    q: str | None = None       # Query parameter
):
    return {"item_id": item_id, **item.model_dump(), "q": q}
```

How FastAPI identifies each type:

- Present in the route path → **path parameter**
- Typed as a Pydantic model → **request body**
- A simple scalar type (str, int, etc.) → **query parameter**

## HTTP Methods for Body

- `POST` - Create a resource (most common use case)
- `PUT` - Replace an existing resource
- `PATCH` - Apply a partial update
- `DELETE` - Remove a resource (body is rarely included)

⚠️ Sending a body with `GET` is discouraged as its behavior is undefined in the HTTP specification.
