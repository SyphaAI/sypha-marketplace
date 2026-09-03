# Middleware

Functions that intercept and process every request and response.

## How Middleware Works

1. Accept the incoming request
2. Run code prior to the route handler
3. Forward the request to the route
4. Obtain the response from the route
5. Run code after the route handler completes
6. Return the response to the caller

## Create Middleware

```python
import time
from fastapi import FastAPI, Request

app = FastAPI()

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = time.perf_counter() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response
```

## Middleware Function Parameters

- `request: Request` - The request being processed
- `call_next` - Callable that forwards the request to the route and returns the response

## Execution Order

Middleware is arranged in a stack where the last middleware added becomes the outermost layer:

```python
app.add_middleware(MiddlewareA)
app.add_middleware(MiddlewareB)
```

Execution:

- Request: B → A → route
- Response: route → A → B

## Common Patterns

### Request Logging

```python
@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"Request: {request.method} {request.url}")
    response = await call_next(request)
    print(f"Response: {response.status_code}")
    return response
```

### Authentication Check

```python
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.url.path.startswith("/protected"):
        auth = request.headers.get("Authorization")
        if not auth:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
    return await call_next(request)
```

### Exception Handling

```python
@app.middleware("http")
async def catch_exceptions(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})
```

## Built-in Middleware

### CORS

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### GZip Compression

```python
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)
```

### Trusted Host

```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["example.com", "*.example.com"]
)
```

### HTTPS Redirect

```python
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

app.add_middleware(HTTPSRedirectMiddleware)
```

## ASGI Middleware

You can use any ASGI-compatible middleware:

```python
from unicorn import UnicornMiddleware

# Simple wrapping (not recommended)
# new_app = UnicornMiddleware(app, some_config="value")

# Recommended: use add_middleware for proper error handling
app.add_middleware(UnicornMiddleware, some_config="rainbow")
```

### Third-Party ASGI Middleware

- ProxyHeadersMiddleware (uvicorn)
- MessagePack middleware
- See: [ASGI Awesome List](https://github.com/florimondmanca/awesome-asgi)

## Timing Notes

- Dependencies with `yield`: their exit code executes after middleware finishes
- Background tasks: these run only after all middleware has completed
- Use `time.perf_counter()` for high-precision timing instead of `time.time()`

## Custom Headers

- Custom headers should be prefixed with `X-`
- To make custom headers visible to browsers, list them in CORS `expose_headers`
