# Query Parameters

Parameters supplied through the URL query string (`?key=value&key2=value2`).

## Basic Usage

```python
@app.get("/items/")
async def read_items(skip: int = 0, limit: int = 10):
    return items[skip : skip + limit]
```

URL: `http://127.0.0.1:8000/items/?skip=20&limit=5`

## Parameter Types

### Required Parameters

```python
@app.get("/items/{item_id}")
async def read_item(item_id: str, needy: str):
    return {"item_id": item_id, "needy": needy}
```

Parameters without a default are required; omitting them produces an error.

### Optional Parameters

```python
@app.get("/items/{item_id}")
async def read_item(item_id: str, q: str | None = None):
    if q:
        return {"item_id": item_id, "q": q}
    return {"item_id": item_id}
```

### Default Values

```python
@app.get("/items/")
async def read_items(skip: int = 0, limit: int = 10):
    return items[skip : skip + limit]
```

## Boolean Conversion

FastAPI automatically converts common truthy string values to `bool`:

```python
@app.get("/items/{item_id}")
async def read_item(item_id: str, short: bool = False):
    ...
```

All these evaluate to `True`:

- `?short=1`
- `?short=True`
- `?short=true`
- `?short=on`
- `?short=yes`

## Mixed Parameters

Path and query parameters can be freely combined:

```python
@app.get("/users/{user_id}/items/{item_id}")
async def read_user_item(
    user_id: int,           # path
    item_id: str,           # path
    q: str | None = None,   # query, optional
    short: bool = False     # query, default
):
    ...
```

FastAPI tells them apart by:

- **Path parameters**: Those declared inside the route path as `{param}`
- **Query parameters**: All other function parameters

## Common Patterns

### Pagination

```python
@app.get("/items/")
async def list_items(skip: int = 0, limit: int = 100):
    return db.query(Item).offset(skip).limit(limit).all()
```

### Filtering

```python
@app.get("/items/")
async def search_items(
    q: str | None = None,
    category: str | None = None,
    min_price: float | None = None
):
    ...
```

### Required + Optional Mix

```python
@app.get("/search/")
async def search(
    query: str,                    # required
    page: int = 1,                 # default
    per_page: int | None = None    # optional
):
    ...
```
