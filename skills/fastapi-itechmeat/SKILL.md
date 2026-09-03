---
name: fastapi-itechmeat
description: >-
  FastAPI Python framework. Covers REST APIs, validation, dependencies,
  security. Use when constructing Python web APIs with FastAPI, defining Pydantic
  models, applying dependency injection, or configuring OAuth2/JWT
  authentication. Keywords: FastAPI, Pydantic, async, OAuth2, JWT, REST API.
metadata:
  version: 0.136.3
  release_date: '2026-05-23'
  category: development
  source:
    repository: 'https://github.com/itechmeat/llm-code'
    path: skills/fastapi
    license_path: LICENSE
    commit: 0ebb36c887c350d9d52c389503386bb781112ad8
---

# FastAPI

This skill offers thorough guidance for developing APIs with FastAPI.

## Quick Navigation

| Topic              | Reference                           |
| ------------------ | ----------------------------------- |
| Getting started    | `references/first-steps.md`         |
| Path parameters    | `references/path-parameters.md`     |
| Query parameters   | `references/query-parameters.md`    |
| Request body       | `references/request-body.md`        |
| Validation         | `references/validation.md`          |
| Body advanced      | `references/body-advanced.md`       |
| Cookies/Headers    | `references/cookies-headers.md`     |
| Pydantic models    | `references/models.md`              |
| Forms/Files        | `references/forms-files.md`         |
| Error handling     | `references/error-handling.md`      |
| Path config        | `references/path-config.md`         |
| Dependencies       | `references/dependencies.md`        |
| Security           | `references/security.md`            |
| Middleware         | `references/middleware.md`          |
| CORS               | `references/cors.md`                |
| Database           | `references/sql-databases.md`       |
| Project structure  | `references/bigger-applications.md` |
| Background tasks   | `references/background-tasks.md`    |
| Metadata/Docs      | `references/metadata-docs.md`       |
| Testing            | `references/testing.md`             |
| Advanced responses | `references/responses-advanced.md`  |
| WebSockets         | `references/websockets.md`          |
| Templates          | `references/templates.md`           |
| Settings/Env vars  | `references/settings.md`            |
| Lifespan events    | `references/lifespan.md`            |
| OpenAPI advanced   | `references/openapi-advanced.md`    |

## When to Use

- Building REST APIs with Python
- Defining endpoints with automatic validation
- Setting up OAuth2/JWT authentication
- Working with Pydantic models
- Applying dependency injection
- Configuring CORS and middleware
- Handling file uploads and forms
- Testing API endpoints

## Installation

Requires Python 3.10+. Install with `pip install "fastapi[standard]"` for the full distribution (includes uvicorn) or `pip install fastapi` for a minimal install. Add `python-multipart` to support forms and file uploads.

## Release Highlights (0.133.0 → 0.136.1)

- **0.134.0:** added streaming JSON Lines and streaming binary data support via `yield`.
- **0.135.0:** introduced first-class Server-Sent Events (SSE) support (`EventSourceResponse`).
- **0.135.1:** stability fix for `TaskGroup` usage in the request async exit stack.
- **0.136.1:** FastAPI refreshes its Pydantic v2 code to eliminate deprecations and upgrades Starlette to `1.0.0`.

## Patch Notes (0.136.2 → 0.136.3)

- SSE responses now apply stricter validation to event fields, causing malformed `ServerSentEvent` payloads to fail early rather than silently emitting invalid frames.
- Header parameters no longer accept underscore-named incoming headers when `convert_underscores=True` (the default). If a client genuinely sends underscore headers, declare `Header(convert_underscores=False)` and confirm that your proxy chain preserves them.

## Quick Start

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}
```

Run: `fastapi dev main.py`

## Core Patterns

### Type-Safe Parameters

```python
from typing import Annotated
from fastapi import Path, Query

@app.get("/items/{item_id}")
def read_item(
    item_id: Annotated[int, Path(ge=1)],
    q: Annotated[str | None, Query(max_length=50)] = None
):
    return {"item_id": item_id, "q": q}
```

### Request Body with Validation

```python
from pydantic import BaseModel, Field

class Item(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    price: float = Field(gt=0)

@app.post("/items/", response_model=Item)
def create_item(item: Item):
    return item
```

### Dependencies

```python
from fastapi import Depends

async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/users/")
def list_users(db: Annotated[Session, Depends(get_db)]):
    return db.query(User).all()
```

### Authentication

```python
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
    return decode_token(token)

@app.get("/users/me")
def read_me(user: Annotated[User, Depends(get_current_user)]):
    return user
```

## API Documentation

- Swagger UI: `/docs`
- ReDoc: `/redoc`
- OpenAPI: `/openapi.json`

## Best Practices

- Prefer `Annotated[Type, ...]` for parameter declarations
- Define Pydantic models for both request and response shapes
- Use `response_model` to filter and shape output
- Set `status_code` to return correct HTTP status codes
- Apply `tags` to keep the API organized
- Declare `dependencies` at the router or app level for authentication

## Prohibitions

- ❌ Return raw database models (use response models instead)
- ❌ Store passwords in plain text (use bcrypt/passlib)
- ❌ Combine `Body` with `Form`/`File` in the same endpoint
- ❌ Perform synchronous blocking I/O inside async endpoints
- ❌ Bypass HTTPException for error handling

## Links

- [Documentation](https://fastapi.tiangolo.com/)
- [Releases](https://github.com/fastapi/fastapi/releases)
- [GitHub](https://github.com/fastapi/fastapi)
- [PyPI](https://pypi.org/project/fastapi/)
