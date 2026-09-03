# Error Handling

Send HTTP error responses to clients with appropriate status codes.

## HTTPException

```python
from fastapi import FastAPI, HTTPException

app = FastAPI()

@app.get("/items/{item_id}")
async def read_item(item_id: str):
    if item_id not in items:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"item": items[item_id]}
```

Key points:

- Use `raise`, not `return` — this terminates the request immediately
- `detail` accepts any JSON-serializable value (str, dict, list)

## Response Format

```json
{
  "detail": "Item not found"
}
```

## Custom Headers

```python
raise HTTPException(
    status_code=404,
    detail="Item not found",
    headers={"X-Error": "Custom header value"}
)
```

## Custom Exception Handler

```python
from fastapi import Request
from fastapi.responses import JSONResponse

class UnicornException(Exception):
    def __init__(self, name: str):
        self.name = name

@app.exception_handler(UnicornException)
async def unicorn_exception_handler(request: Request, exc: UnicornException):
    return JSONResponse(
        status_code=418,
        content={"message": f"Oops! {exc.name} did something wrong"}
    )

@app.get("/unicorns/{name}")
async def read_unicorn(name: str):
    if name == "yolo":
        raise UnicornException(name=name)
    return {"unicorn_name": name}
```

## Override Validation Errors

```python
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body}
    )

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return PlainTextResponse(str(exc.detail), status_code=exc.status_code)
```

## Reuse Default Handlers

```python
from fastapi.exception_handlers import (
    http_exception_handler,
    request_validation_exception_handler,
)

@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request, exc):
    print(f"HTTP error: {repr(exc)}")  # Log it
    return await http_exception_handler(request, exc)  # Delegate to default
```

## Common Status Codes

| Code | Meaning        | Use Case           |
| ---- | -------------- | ------------------ |
| 400  | Bad Request    | Invalid input      |
| 401  | Unauthorized   | Missing auth       |
| 403  | Forbidden      | No permission      |
| 404  | Not Found      | Resource missing   |
| 409  | Conflict       | Duplicate resource |
| 422  | Unprocessable  | Validation failed  |
| 500  | Internal Error | Server bug         |

## FastAPI vs Starlette HTTPException

- FastAPI's `HTTPException` accepts any JSON-serializable `detail` value
- Starlette's variant only accepts strings
- Register handlers for the Starlette version to intercept all HTTP exceptions:

```python
from starlette.exceptions import HTTPException as StarletteHTTPException
```
