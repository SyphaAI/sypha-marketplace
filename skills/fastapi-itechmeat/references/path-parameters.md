# Path Parameters

Extracting dynamic values from URL paths.

## Basic Syntax

```python
@app.get("/items/{item_id}")
async def read_item(item_id):
    return {"item_id": item_id}
```

## Type Annotations

```python
@app.get("/items/{item_id}")
async def read_item(item_id: int):
    return {"item_id": item_id}
```

Benefits:

- **Data conversion**: Automatically converts "3" (string) to 3 (integer)
- **Data validation**: Returns a descriptive error for invalid values
- **Editor support**: Enables autocomplete and type checking
- **Auto documentation**: Parameter types are reflected in the OpenAPI docs

## Validation Error Response

```json
{
  "detail": [
    {
      "type": "int_parsing",
      "loc": ["path", "item_id"],
      "msg": "Input should be a valid integer",
      "input": "foo"
    }
  ]
}
```

## Order Matters

Static paths must always be declared ahead of parameterized paths:

```python
# ✅ Correct order
@app.get("/users/me")  # First - specific
async def read_user_me():
    return {"user_id": "current user"}

@app.get("/users/{user_id}")  # Second - generic
async def read_user(user_id: str):
    return {"user_id": user_id}
```

## Predefined Values with Enum

```python
from enum import Enum

class ModelName(str, Enum):
    alexnet = "alexnet"
    resnet = "resnet"
    lenet = "lenet"

@app.get("/models/{model_name}")
async def get_model(model_name: ModelName):
    if model_name is ModelName.alexnet:
        return {"model_name": model_name, "message": "Deep Learning"}
    return {"model_name": model_name}
```

Working with Enum values:

- Comparison: `model_name is ModelName.alexnet`
- Accessing the raw value: `model_name.value` → `"alexnet"`
- The JSON response contains the serialized string value

## Path Parameters Containing Paths

Use the `:path` converter to capture file paths within path parameters:

```python
@app.get("/files/{file_path:path}")
async def read_file(file_path: str):
    return {"file_path": file_path}
```

URL: `/files//home/user/file.txt` (note double slash)

## Supported Types

- `str`, `int`, `float`, `bool`
- `UUID`
- Custom types via Pydantic
