# Bigger Applications - Multiple Files

Organize large FastAPI applications into modules using APIRouter.

## Project Structure

```
app/
├── __init__.py
├── main.py              # Main FastAPI app
├── dependencies.py      # Shared dependencies
├── routers/
│   ├── __init__.py
│   ├── users.py        # User routes
│   └── items.py        # Item routes
└── internal/
    ├── __init__.py
    └── admin.py        # Admin routes (shared)
```

## APIRouter

Define self-contained routers that behave like miniature FastAPI applications:

```python
# routers/users.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/users/", tags=["users"])
async def read_users():
    return [{"username": "Rick"}, {"username": "Morty"}]

@router.get("/users/{username}", tags=["users"])
async def read_user(username: str):
    return {"username": username}
```

## Router with Prefix and Dependencies

Attach shared settings to every route in a router:

```python
# routers/items.py
from fastapi import APIRouter, Depends, HTTPException
from ..dependencies import get_token_header

router = APIRouter(
    prefix="/items",               # All routes start with /items
    tags=["items"],               # OpenAPI tag
    dependencies=[Depends(get_token_header)],  # Auth for all routes
    responses={404: {"description": "Not found"}},
)

@router.get("/")
async def read_items():
    return fake_items_db

@router.get("/{item_id}")
async def read_item(item_id: str):
    if item_id not in fake_items_db:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"item_id": item_id}
```

## Router Lifecycle Hooks (v0.128.6)

`APIRouter` now supports startup and shutdown hooks (corrected in 0.128.6):

```python
from fastapi import APIRouter

async def connect_db():
    ...

async def close_db():
    ...

router = APIRouter(
    on_startup=[connect_db],
    on_shutdown=[close_db],
)
```

## Shared Dependencies

```python
# dependencies.py
from typing import Annotated
from fastapi import Header, HTTPException

async def get_token_header(x_token: Annotated[str, Header()]):
    if x_token != "fake-super-secret-token":
        raise HTTPException(status_code=400, detail="X-Token header invalid")

async def get_query_token(token: str):
    if token != "jessica":
        raise HTTPException(status_code=400, detail="No token provided")
```

## Main App

Register routers with the main application:

```python
# main.py
from fastapi import Depends, FastAPI
from .dependencies import get_query_token, get_token_header
from .internal import admin
from .routers import items, users

app = FastAPI(dependencies=[Depends(get_query_token)])  # Global dependency

# Include routers
app.include_router(users.router)
app.include_router(items.router)

# Include with custom prefix/dependencies
app.include_router(
    admin.router,
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_token_header)],
    responses={418: {"description": "I'm a teapot"}},
)

@app.get("/")
async def root():
    return {"message": "Hello Bigger Applications!"}
```

## Relative Imports

```python
# From routers/items.py, import from parent package
from ..dependencies import get_token_header  # app/dependencies.py
```

- Single dot `.` = current package
- Double dots `..` = parent package
- Triple dots `...` = grandparent package (rarely required)

## Include Router in Router

```python
# Nest routers before registering with the main app
router.include_router(other_router)
```

## Multiple Prefixes for Same Router

```python
# Mount the same router at different paths (e.g., /api/v1 and /api/latest)
app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router, prefix="/api/latest")
```

## Key Points

- `APIRouter` behaves like a mini `FastAPI` class and accepts the same parameters
- `prefix` must not end with `/`
- Router-level dependencies execute before per-decorator dependencies
- Path operations are "cloned" into the app (not mounted), so they appear in the OpenAPI schema
- Performance: router registration occurs at startup and takes microseconds
