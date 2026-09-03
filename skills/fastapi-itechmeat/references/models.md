````markdown
# Pydantic Models

Response models, multiple model patterns, and data transformation.

## Return Type Annotation

```python
from pydantic import BaseModel

class Item(BaseModel):
    name: str
    price: float
    tags: list[str] = []

@app.post("/items/")
async def create_item(item: Item) -> Item:
    return item

@app.get("/items/")
async def read_items() -> list[Item]:
    return [Item(name="Foo", price=42.0)]
```

FastAPI leverages the return type annotation to:

- Validate outgoing data
- Generate a JSON Schema in OpenAPI
- Filter the output data before sending

## response_model Parameter

Use this when the return type diverges from the actual response sent to the client:

```python
class UserIn(BaseModel):
    username: str
    password: str  # Don't expose!
    email: str

class UserOut(BaseModel):
    username: str
    email: str

@app.post("/user/", response_model=UserOut)
async def create_user(user: UserIn):
    return user  # Password filtered out automatically
```

## Multiple Models Pattern

Use distinct model variants to represent different stages or contexts:

```python
from pydantic import BaseModel, EmailStr

# Base model (shared fields)
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str | None = None

# Input model
class UserIn(UserBase):
    password: str

# Output model (no password)
class UserOut(UserBase):
    pass

# Database model
class UserInDB(UserBase):
    hashed_password: str

@app.post("/user/", response_model=UserOut)
async def create_user(user_in: UserIn):
    hashed = hash_password(user_in.password)
    user_db = UserInDB(**user_in.model_dump(), hashed_password=hashed)
    return user_db
```

## Model Conversion

```python
# Convert to dict
user_dict = user_in.model_dump()

# Create model with extra fields
UserInDB(**user_in.model_dump(), hashed_password=hashed)

# Partial copy with updates
updated = stored_model.model_copy(update=update_data)
```

`0.136.1` note:

- FastAPI updated its Pydantic v2 integration to eliminate deprecated patterns. In application code, use the current Pydantic v2 methods such as `model_dump()` / `model_copy()` and avoid reintroducing deprecated v1-style helpers in new code.

## Response Filtering Options

```python
# Exclude unset values
@app.get("/items/{id}", response_model=Item, response_model_exclude_unset=True)

# Include only specific fields
@app.get("/items/{id}/name", response_model=Item, response_model_include={"name"})

# Exclude specific fields
@app.get("/items/{id}/public", response_model=Item, response_model_exclude={"tax"})

# Exclude defaults/None
response_model_exclude_defaults=True
response_model_exclude_none=True
```

## Union Types (Multiple Response Types)

```python
from typing import Union

class CarItem(BaseModel):
    type: str = "car"
    description: str

class PlaneItem(BaseModel):
    type: str = "plane"
    size: int
    description: str

@app.get("/items/{item_id}", response_model=Union[PlaneItem, CarItem])
async def read_item(item_id: str):
    return items[item_id]
```

⚠️ Always list the more specific type first: `Union[PlaneItem, CarItem]`

## List and Dict Responses

```python
# List of models
@app.get("/items/", response_model=list[Item])
async def read_items():
    return items

# Arbitrary dict
@app.get("/weights/", response_model=dict[str, float])
async def read_weights():
    return {"foo": 2.3, "bar": 3.4}
```

## Return Response Directly

```python
from fastapi.responses import JSONResponse, RedirectResponse

@app.get("/portal")
async def get_portal(teleport: bool = False):
    if teleport:
        return RedirectResponse(url="https://example.com")
    return JSONResponse(content={"message": "Here"})

# Disable response model validation
@app.get("/portal", response_model=None)
async def get_portal():
    return {"message": "No validation"}
```

## CRUD Model Pattern

```python
class ItemBase(BaseModel):
    name: str
    description: str | None = None

class ItemCreate(ItemBase):
    pass

class ItemUpdate(BaseModel):
    name: str | None = None
    description: str | None = None

class ItemInDB(ItemBase):
    id: int
    owner_id: int

class ItemResponse(ItemInDB):
    pass
```

## Partial Updates (PATCH)

```python
@app.patch("/items/{item_id}")
async def update_item(item_id: int, item: ItemUpdate):
    stored = items[item_id]
    update_data = item.model_dump(exclude_unset=True)  # Only sent fields
    updated = stored.model_copy(update=update_data)
    items[item_id] = updated
    return updated
```

Key: `exclude_unset=True` restricts the output to only those fields the client explicitly provided.

## Prohibitions

- ❌ Never store plaintext passwords in models
- ❌ Never return input models that contain sensitive data
- ❌ Do not use `PlaneItem | CarItem` syntax in response_model; use `Union[]` instead
````
