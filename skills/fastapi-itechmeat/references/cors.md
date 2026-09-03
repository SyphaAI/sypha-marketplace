# CORS (Cross-Origin Resource Sharing)

Allow cross-origin requests from a frontend to a backend.

## What is Origin?

An origin is the combination of protocol + domain + port.

These are all different origins:

- `http://localhost` (port 80)
- `http://localhost:8080` (port 8080)
- `https://localhost` (HTTPS)

## Basic CORS Setup

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:8080",
    "https://myapp.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Configuration Options

| Parameter            | Default   | Description                                          |
| -------------------- | --------- | ---------------------------------------------------- |
| `allow_origins`      | `[]`      | List of allowed origins                              |
| `allow_origin_regex` | `None`    | Regex for origins (e.g., `https://.*\.example\.org`) |
| `allow_methods`      | `["GET"]` | Allowed HTTP methods                                 |
| `allow_headers`      | `[]`      | Allowed request headers                              |
| `allow_credentials`  | `False`   | Allow cookies/auth headers                           |
| `expose_headers`     | `[]`      | Headers visible to browser                           |
| `max_age`            | `600`     | Preflight cache time (seconds)                       |

## Common Configurations

### Development (Allow All)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

⚠️ Can't use `["*"]` with `allow_credentials=True`

### Production (Specific Origins)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://myapp.com",
        "https://www.myapp.com",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### Regex Pattern

```python
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.myapp\.com",
)
```

## How CORS Works

### Preflight Requests

- The browser sends an `OPTIONS` request first
- It includes `Origin` and `Access-Control-Request-Method` headers
- The backend responds with the permitted origins and methods
- The browser then sends the actual request

### Simple Requests

- GET, HEAD, and POST with standard headers
- No preflight is required
- The backend appends CORS headers to the response

## Credentials Warning

When `allow_credentials=True`:

- Wildcard `["*"]` cannot be used for origins, methods, or headers
- All allowed values must be enumerated explicitly

```python
# ❌ Invalid
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,  # Conflict!
)

# ✅ Valid
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://myapp.com"],
    allow_credentials=True,
)
```

## Debugging CORS

Inspect the browser console for:

- Missing `Access-Control-Allow-Origin` header
- An origin that is not on the allowed list
- A method that is not permitted
- Credential-related conflicts

Use the browser DevTools Network tab to examine preflight requests in detail.
