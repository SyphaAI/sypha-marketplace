# First Steps

Fundamental concepts for building a minimal FastAPI application.

## Minimal Application

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}
```

## Key Components

### 1. FastAPI Instance

- `app = FastAPI()` instantiates the main application
- This object is the entry point for all API functionality
- FastAPI extends Starlette, so all Starlette features are available

### 2. Path Operation Decorator

- `@app.get("/")` registers a route handler
- All HTTP methods are supported:
  - `@app.get()` - retrieve data
  - `@app.post()` - create data
  - `@app.put()` - replace data
  - `@app.delete()` - remove data
  - `@app.patch()`, `@app.options()`, `@app.head()`, `@app.trace()`

### 3. Path Operation Function

- Can be declared as `async def` or a regular `def`
- May return a dict, list, str, int, or a Pydantic model
- JSON serialization is handled automatically

## Running the Server

```bash
fastapi dev main.py
```

The server starts at `http://127.0.0.1:8000`

## Auto-Generated Documentation

| URL             | Documentation            |
| --------------- | ------------------------ |
| `/docs`         | Swagger UI (interactive) |
| `/redoc`        | ReDoc (alternative)      |
| `/openapi.json` | Raw OpenAPI schema       |

## OpenAPI Integration

- FastAPI generates an OpenAPI 3.1.0 schema automatically
- The schema covers paths, parameters, and request/response models
- It drives the interactive documentation UI
- It can be used to generate client SDKs

## Terminology

| Term           | Meaning                                            |
| -------------- | -------------------------------------------------- |
| Path           | URL endpoint (e.g., `/items/foo`)                  |
| Operation      | HTTP method (GET, POST, etc.)                      |
| Path Operation | Combination of path + method                       |
| Schema         | Data structure definition (OpenAPI or JSON Schema) |
