# Background Tasks

Execute tasks after the response has been returned to the client.

## Use Cases

- Sending email notifications
- Processing uploaded files
- Refreshing caches
- Recording analytics logs

## Basic Usage

```python
from fastapi import BackgroundTasks, FastAPI

app = FastAPI()

def write_notification(email: str, message: str = ""):
    with open("log.txt", mode="w") as email_file:
        content = f"notification for {email}: {message}"
        email_file.write(content)

@app.post("/send-notification/{email}")
async def send_notification(email: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(write_notification, email, message="some notification")
    return {"message": "Notification sent in the background"}
```

## Add Task Parameters

```python
background_tasks.add_task(
    function,       # Task function
    arg1,           # Positional args
    arg2,
    key1=value1,    # Keyword args
    key2=value2,
)
```

## Task Function Types

- Use `def` for I/O-bound tasks (file write, sync calls)
- Use `async def` for async operations (FastAPI handles both)

```python
# Sync task
def process_file(path: str):
    with open(path) as f:
        # process...

# Async task
async def call_external_api(url: str):
    async with httpx.AsyncClient() as client:
        await client.get(url)
```

## With Dependency Injection

```python
from typing import Annotated
from fastapi import BackgroundTasks, Depends, FastAPI

app = FastAPI()

def write_log(message: str):
    with open("log.txt", mode="a") as log:
        log.write(message)

def get_query(background_tasks: BackgroundTasks, q: str | None = None):
    if q:
        message = f"found query: {q}\n"
        background_tasks.add_task(write_log, message)
    return q

@app.post("/send-notification/{email}")
async def send_notification(
    email: str,
    background_tasks: BackgroundTasks,
    q: Annotated[str, Depends(get_query)]
):
    message = f"message to {email}\n"
    background_tasks.add_task(write_log, message)
    return {"message": "Message sent"}
```

All tasks queued from dependencies and path operations are collected and executed after the response is sent.

## Heavy Background Jobs

For demanding workloads, consider the following alternatives:

- **Celery** - Distributed task queue backed by RabbitMQ/Redis
- **Redis Queue (RQ)** - Lightweight Redis-based task queue
- **Dramatiq** - An alternative distributed task processor to Celery

Choose one of these when you require:

- Tasks spread across multiple processes or servers
- Automatic retries and failure handling
- Scheduled or periodic task execution
- Tracking of task results

## When to Use BackgroundTasks

Good for:

- Small, short-lived tasks
- Access to the same application variables and objects
- Scenarios where a dedicated worker process is unnecessary

Better handled by Celery when:

- Computations are long-running
- Work must be distributed across multiple workers or servers
- Retry logic is complex

## Import Note

```python
# Import BackgroundTasks (plural), not BackgroundTask
from fastapi import BackgroundTasks  # ✓
# NOT from starlette.background import BackgroundTask
```
