# MCP Server Development Best Practices and Guidelines

## Overview

This document consolidates essential best practices and guidelines for building Model Context Protocol (MCP) servers. Topics covered include naming conventions, tool design, response formats, pagination, error handling, security, and compliance requirements.

---

## Quick Reference

### Server Naming
- **Python**: `{service}_mcp` (e.g., `slack_mcp`)
- **Node/TypeScript**: `{service}-mcp-server` (e.g., `slack-mcp-server`)

### Tool Naming
- Use snake_case with service prefix
- Format: `{service}_{action}_{resource}`
- Example: `slack_send_message`, `github_create_issue`

### Response Formats
- Support both JSON and Markdown formats
- JSON for programmatic processing
- Markdown for human readability

### Pagination
- Always respect `limit` parameter
- Return `has_more`, `next_offset`, `total_count`
- Default to 20-50 items

### Character Limits
- Set CHARACTER_LIMIT constant (typically 25,000)
- Truncate gracefully with clear messages
- Provide guidance on filtering

---

## Table of Contents
1. Server Naming Conventions
2. Tool Naming and Design
3. Response Format Guidelines
4. Pagination Best Practices
5. Character Limits and Truncation
6. Tool Development Best Practices
7. Transport Best Practices
8. Testing Requirements
9. OAuth and Security Best Practices
10. Resource Management Best Practices
11. Prompt Management Best Practices
12. Error Handling Standards
13. Documentation Requirements
14. Compliance and Monitoring

---

## 1. Server Naming Conventions

Apply the following standardized naming patterns for MCP servers:

**Python**: Use format `{service}_mcp` (lowercase with underscores)
- Examples: `slack_mcp`, `github_mcp`, `jira_mcp`, `stripe_mcp`

**Node/TypeScript**: Use format `{service}-mcp-server` (lowercase with hyphens)
- Examples: `slack-mcp-server`, `github-mcp-server`, `jira-mcp-server`

The name should be:
- General (not tied to specific features)
- Descriptive of the service/API being integrated
- Easy to infer from the task description
- Free of version numbers or dates

---

## 2. Tool Naming and Design

### Tool Naming Best Practices

1. **Use snake_case**: `search_users`, `create_project`, `get_channel_info`
2. **Include service prefix**: Your MCP server may be deployed alongside other MCP servers, so prefix tool names to prevent conflicts
   - Use `slack_send_message` instead of just `send_message`
   - Use `github_create_issue` instead of just `create_issue`
   - Use `asana_list_tasks` instead of just `list_tasks`
3. **Be action-oriented**: Begin names with verbs (get, list, search, create, etc.)
4. **Be specific**: Avoid generic names that could clash with tools from other servers
5. **Maintain consistency**: Apply consistent naming patterns throughout your server

### Tool Design Guidelines

- Tool descriptions must precisely and unambiguously describe functionality
- Descriptions must accurately reflect actual behavior
- Must not introduce confusion with tools from other MCP servers
- Should include tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
- Keep tool operations focused and atomic

---

## 3. Response Format Guidelines

All data-returning tools should support multiple output formats for flexibility:

### JSON Format (`response_format="json"`)
- Machine-readable structured data
- Include all available fields and metadata
- Consistent field names and types
- Appropriate for programmatic processing
- Use when LLMs need to process data further

### Markdown Format (`response_format="markdown"`, typically default)
- Human-readable formatted text
- Use headers, lists, and formatting for clarity
- Render timestamps in human-readable form (e.g., "2024-01-15 10:30:00 UTC" instead of epoch)
- Display names alongside IDs in parentheses (e.g., "@john.doe (U123456)")
- Omit verbose metadata (e.g., include only one profile image URL, not all sizes)
- Group related information logically
- Use when presenting information to users

---

## 4. Pagination Best Practices

For tools that enumerate resources:

- **Always respect the `limit` parameter**: Never load all results when a limit has been specified
- **Implement pagination**: Use `offset` or cursor-based pagination
- **Return pagination metadata**: Include `has_more`, `next_offset`/`next_cursor`, `total_count`
- **Never load all results into memory**: This is especially critical for large datasets
- **Default to reasonable limits**: 20-50 items per page is typical
- **Include clear pagination info in responses**: Make it straightforward for LLMs to request additional data

Example pagination response structure:
```json
{
  "total": 150,
  "count": 20,
  "offset": 0,
  "items": [...],
  "has_more": true,
  "next_offset": 20
}
```

---

## 5. Character Limits and Truncation

To avoid overwhelming responses with excessive data:

- **Define CHARACTER_LIMIT constant**: Typically 25,000 characters, declared at module level
- **Check response size before returning**: Measure the final response length
- **Truncate gracefully with clear indicators**: Inform the LLM when data has been truncated
- **Provide guidance on filtering**: Suggest which parameters can be used to narrow results
- **Include truncation metadata**: Indicate what was truncated and how to retrieve more

Example truncation handling:
```python
CHARACTER_LIMIT = 25000

if len(result) > CHARACTER_LIMIT:
    truncated_data = data[:max(1, len(data) // 2)]
    response["truncated"] = True
    response["truncation_message"] = (
        f"Response truncated from {len(data)} to {len(truncated_data)} items. "
        f"Use 'offset' parameter or add filters to see more results."
    )
```

---

## 6. Transport Options

MCP servers support multiple transport mechanisms suited to different deployment scenarios:

### Stdio Transport

**Best for**: Command-line tools, local integrations, subprocess execution

**Characteristics**:
- Communication over standard input/output streams
- Simple setup with no network configuration required
- Runs as a subprocess of the client
- Well-suited for desktop applications and CLI tools

**Use when**:
- Building tools for local development environments
- Integrating with desktop MCP clients
- Creating command-line utilities
- Single-user, single-session scenarios

### HTTP Transport

**Best for**: Web services, remote access, multi-client scenarios

**Characteristics**:
- Request-response communication over HTTP
- Supports multiple simultaneous clients
- Can be deployed as a web service
- Requires network configuration and appropriate security measures

**Use when**:
- Serving multiple clients at once
- Deploying as a cloud service
- Integrating with web applications
- Scaling or load balancing is needed

### Server-Sent Events (SSE) Transport

**Best for**: Real-time updates, push notifications, streaming data

**Characteristics**:
- One-way server-to-client streaming over HTTP
- Delivers real-time updates without polling
- Maintains long-lived connections for continuous data flow
- Built on standard HTTP infrastructure

**Use when**:
- Clients require real-time data updates
- Implementing push notifications
- Streaming logs or monitoring data
- Delivering progressive results for long-running operations

### Transport Selection Criteria

| Criterion | Stdio | HTTP | SSE |
|-----------|-------|------|-----|
| **Deployment** | Local | Remote | Remote |
| **Clients** | Single | Multiple | Multiple |
| **Communication** | Bidirectional | Request-Response | Server-Push |
| **Complexity** | Low | Medium | Medium-High |
| **Real-time** | No | No | Yes |

---

## 7. Tool Development Best Practices

### General Guidelines
1. Tool names should be descriptive and action-oriented
2. Use parameter validation backed by detailed JSON schemas
3. Embed examples in tool descriptions
4. Apply thorough error handling and input validation
5. Use progress reporting for long-running operations
6. Keep tool operations focused and atomic
7. Document expected return value structures
8. Enforce appropriate timeouts
9. Apply rate limiting for resource-intensive operations
10. Log tool usage to support debugging and monitoring

### Security Considerations for Tools

#### Input Validation
- Validate all parameters against the schema
- Sanitize file paths and system commands
- Validate URLs and external identifiers
- Check parameter sizes and ranges
- Prevent command injection

#### Access Control
- Apply authentication where required
- Enforce appropriate authorization checks
- Audit tool usage
- Rate limit incoming requests
- Monitor for abuse patterns

#### Error Handling
- Do not expose internal errors to clients
- Log security-relevant errors server-side
- Handle timeouts appropriately
- Release resources after errors
- Validate return values

### Tool Annotations
- Supply readOnlyHint and destructiveHint annotations
- Note that annotations are hints, not security guarantees
- Clients must not base security-critical decisions solely on annotations

---

## 8. Transport Best Practices

### General Transport Guidelines
1. Manage the connection lifecycle correctly
2. Apply thorough error handling
3. Use appropriate timeout values
4. Implement connection state management
5. Release resources on disconnection

### Security Best Practices for Transport
- Address security considerations around DNS rebinding attacks
- Implement proper authentication mechanisms
- Validate message formats before processing
- Handle malformed messages gracefully

### Stdio Transport Specific
- Local MCP servers must NOT write logs to stdout (this interferes with the protocol)
- Direct all log output to stderr
- Handle standard I/O streams correctly

---

## 9. Testing Requirements

A thorough testing strategy must address:

### Functional Testing
- Confirm correct execution with both valid and invalid inputs

### Integration Testing
- Validate behavior when interacting with external systems

### Security Testing
- Check authentication, input sanitization, and rate limiting

### Performance Testing
- Evaluate behavior under load and verify timeout handling

### Error Handling
- Confirm that errors are reported correctly and resources are cleaned up

---

## 10. OAuth and Security Best Practices

### Authentication and Authorization

MCP servers that connect to external services must implement proper authentication:

**OAuth 2.1 Implementation:**
- Use secure OAuth 2.1 backed by certificates from recognized authorities
- Validate access tokens before processing any request
- Accept only tokens explicitly issued for your server
- Reject tokens lacking proper audience claims
- Never forward tokens received from MCP clients

**API Key Management:**
- Store API keys in environment variables, not in source code
- Validate keys at server startup
- Provide clear error messages when authentication fails
- Use secure transmission channels for sensitive credentials

### Input Validation and Security

**Always validate inputs:**
- Sanitize file paths to guard against directory traversal
- Validate URLs and external identifiers
- Check parameter sizes and ranges
- Prevent command injection in system calls
- Apply schema validation (Pydantic/Zod) to all inputs

**Error handling security:**
- Do not expose internal errors to clients
- Log security-relevant errors on the server side
- Provide helpful but non-revealing error messages
- Release resources after errors occur

### Privacy and Data Protection

**Data collection principles:**
- Collect only the data strictly necessary for the functionality provided
- Do not collect extraneous conversation data
- Do not collect PII unless the tool's purpose explicitly requires it
- Clearly communicate what data is accessed

**Data transmission:**
- Do not send data to servers outside your organization without disclosure
- Use secure transmission (HTTPS) for all network communication
- Validate certificates when connecting to external services

---

## 11. Resource Management Best Practices

1. Expose only the resources that are genuinely needed
2. Use clear, descriptive names for roots
3. Enforce resource boundaries correctly
4. Respect client control over resources
5. Use model-controlled primitives (tools) for automatic data exposure

---

## 12. Prompt Management Best Practices

- Clients should display proposed prompts to users
- Users should be able to modify or decline prompts
- Clients should present completions to users
- Users should be able to modify or decline completions
- Account for costs when using sampling

---

## 13. Error Handling Standards

- Use standard JSON-RPC error codes
- Report tool errors inside result objects (not at the protocol level)
- Supply helpful, specific error messages
- Do not expose internal implementation details
- Release resources appropriately when errors occur

---

## 14. Documentation Requirements

- Document all tools and capabilities clearly
- Include working examples (at least 3 per major feature)
- Document security considerations
- Specify required permissions and access levels
- Document rate limits and performance characteristics

---

## 15. Compliance and Monitoring

- Implement logging to support debugging and monitoring
- Track tool usage patterns
- Watch for signs of potential abuse
- Maintain audit trails for security-relevant operations
- Be ready for ongoing compliance reviews

---

## Summary

These best practices constitute comprehensive guidance for building secure, efficient, and compliant MCP servers that integrate well within the ecosystem. Developers should follow these guidelines to ensure their MCP servers meet the standards required for inclusion in the MCP directory and deliver a safe, dependable experience to users.


----------


# Tools

> Enable LLMs to perform actions through your server

Tools are a foundational primitive in the Model Context Protocol (MCP) that allow servers to expose executable functionality to clients. Through tools, LLMs can interact with external systems, run computations, and carry out actions in the real world.

<Note>
  Tools are designed to be **model-controlled**, meaning that tools are exposed from servers to clients with the intention of the AI model being able to automatically invoke them (with a human in the loop to grant approval).
</Note>

## Overview

MCP tools let servers expose callable functions that clients invoke and LLMs use to take action. Key aspects of tools include:

* **Discovery**: Clients obtain a list of available tools by sending a `tools/list` request
* **Invocation**: Tools are called via the `tools/call` request, where servers execute the requested operation and return results
* **Flexibility**: Tools can range from simple calculations to complex API interactions

Like [resources](/docs/concepts/resources), tools are identified by unique names and may include descriptions to guide their usage. Unlike resources, however, tools represent dynamic operations that can alter state or interact with external systems.

## Tool definition structure

Each tool is specified using the following structure:

```typescript
{
  name: string;          // Unique identifier for the tool
  description?: string;  // Human-readable description
  inputSchema: {         // JSON Schema for the tool's parameters
    type: "object",
    properties: { ... }  // Tool-specific parameters
  },
  annotations?: {        // Optional hints about tool behavior
    title?: string;      // Human-readable title for the tool
    readOnlyHint?: boolean;    // If true, the tool does not modify its environment
    destructiveHint?: boolean; // If true, the tool may perform destructive updates
    idempotentHint?: boolean;  // If true, repeated calls with same args have no additional effect
    openWorldHint?: boolean;   // If true, tool interacts with external entities
  }
}
```

## Implementing tools

The following example shows how to implement a basic tool in an MCP server:

<Tabs>
  <Tab title="TypeScript">
    ```typescript
    const server = new Server({
      name: "example-server",
      version: "1.0.0"
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Define available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [{
          name: "calculate_sum",
          description: "Add two numbers together",
          inputSchema: {
            type: "object",
            properties: {
              a: { type: "number" },
              b: { type: "number" }
            },
            required: ["a", "b"]
          }
        }]
      };
    });

    // Handle tool execution
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === "calculate_sum") {
        const { a, b } = request.params.arguments;
        return {
          content: [
            {
              type: "text",
              text: String(a + b)
            }
          ]
        };
      }
      throw new Error("Tool not found");
    });
    ```
  </Tab>

  <Tab title="Python">
    ```python
    app = Server("example-server")

    @app.list_tools()
    async def list_tools() -> list[types.Tool]:
        return [
            types.Tool(
                name="calculate_sum",
                description="Add two numbers together",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "a": {"type": "number"},
                        "b": {"type": "number"}
                    },
                    "required": ["a", "b"]
                }
            )
        ]

    @app.call_tool()
    async def call_tool(
        name: str,
        arguments: dict
    ) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
        if name == "calculate_sum":
            a = arguments["a"]
            b = arguments["b"]
            result = a + b
            return [types.TextContent(type="text", text=str(result))]
        raise ValueError(f"Tool not found: {name}")
    ```
  </Tab>
</Tabs>

## Example tool patterns

The following examples illustrate categories of tools a server might expose:

### System operations

Tools that operate on the local system:

```typescript
{
  name: "execute_command",
  description: "Run a shell command",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string" },
      args: { type: "array", items: { type: "string" } }
    }
  }
}
```

### API integrations

Tools that wrap external API endpoints:

```typescript
{
  name: "github_create_issue",
  description: "Create a GitHub issue",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      body: { type: "string" },
      labels: { type: "array", items: { type: "string" } }
    }
  }
}
```

### Data processing

Tools that transform or process data:

```typescript
{
  name: "analyze_csv",
  description: "Analyze a CSV file",
  inputSchema: {
    type: "object",
    properties: {
      filepath: { type: "string" },
      operations: {
        type: "array",
        items: {
          enum: ["sum", "average", "count"]
        }
      }
    }
  }
}
```

## Best practices

When building tools:

1. Provide clear, descriptive names and descriptions
2. Use detailed JSON Schema definitions for parameters
3. Include examples in tool descriptions to show the model how to use them
4. Apply proper error handling and input validation
5. Report progress for long-running operations
6. Keep tool operations focused and atomic
7. Document expected return value structures
8. Enforce appropriate timeouts
9. Apply rate limiting for resource-intensive operations
10. Log tool usage to aid debugging and monitoring

### Tool name conflicts

MCP client applications and MCP server proxies may encounter tool name conflicts when assembling their own tool lists. For example, two connected MCP servers `web1` and `web2` might both expose a tool named `search_web`.

Applications can disambiguate tools using one of the following strategies (among others; this is not an exhaustive list):

* Prepending a unique, user-defined server name to the tool name, e.g. `web1___search_web` and `web2___search_web`. This approach works well when users have already provided unique server names in a configuration file.
* Prepending a randomly generated prefix to the tool name, e.g. `jrwxs___search_web` and `6cq52___search_web`. This approach suits server proxies where user-defined unique names are unavailable.
* Using the server URI as a prefix for the tool name, e.g. `web1.example.com:search_web` and `web2.example.com:search_web`. This is appropriate when working with remote MCP servers.

Note that the server-provided name from the initialization handshake is not guaranteed to be unique and is generally unsuitable for disambiguation.

## Security considerations

When exposing tools:

### Input validation

* Validate all parameters against the schema
* Sanitize file paths and system commands
* Validate URLs and external identifiers
* Check parameter sizes and ranges
* Prevent command injection

### Access control

* Apply authentication where required
* Enforce appropriate authorization checks
* Audit tool usage
* Rate limit incoming requests
* Monitor for abuse patterns

### Error handling

* Do not expose internal errors to clients
* Log security-relevant errors
* Handle timeouts appropriately
* Release resources after errors occur
* Validate return values

## Tool discovery and updates

MCP supports dynamic tool discovery:

1. Clients can list available tools at any time
2. Servers can inform clients of tool changes using `notifications/tools/list_changed`
3. Tools can be added or removed at runtime
4. Tool definitions can be updated (though this should be done with care)

## Error handling

Tool errors should be reported inside the result object, not as MCP protocol-level errors. This allows the LLM to observe and potentially recover from the error. When a tool encounters an error:

1. Set `isError` to `true` in the result
2. Include error details in the `content` array

The following example shows correct error handling for tools:

<Tabs>
  <Tab title="TypeScript">
    ```typescript
    try {
      // Tool operation
      const result = performOperation();
      return {
        content: [
          {
            type: "text",
            text: `Operation successful: ${result}`
          }
        ]
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`
          }
        ]
      };
    }
    ```
  </Tab>

  <Tab title="Python">
    ```python
    try:
        # Tool operation
        result = perform_operation()
        return types.CallToolResult(
            content=[
                types.TextContent(
                    type="text",
                    text=f"Operation successful: {result}"
                )
            ]
        )
    except Exception as error:
        return types.CallToolResult(
            isError=True,
            content=[
                types.TextContent(
                    type="text",
                    text=f"Error: {str(error)}"
                )
            ]
        )
    ```
  </Tab>
</Tabs>

This approach lets the LLM detect that an error occurred and potentially take corrective action or escalate to a human.

## Tool annotations

Tool annotations supply additional metadata about a tool's behavior, helping clients understand how to present and manage tools. These annotations are hints that characterize the nature and impact of a tool, but must not be relied upon for security decisions.

### Purpose of tool annotations

Tool annotations serve several key purposes:

1. Supply UX-specific information without affecting model context
2. Help clients categorize and surface tools appropriately
3. Communicate a tool's potential side effects
4. Support the design of intuitive interfaces for tool approval

### Available tool annotations

The MCP specification defines the following tool annotations:

| Annotation        | Type    | Default | Description                                                                                                                          |
| ----------------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `title`           | string  | -       | A human-readable title for the tool, useful for UI display                                                                           |
| `readOnlyHint`    | boolean | false   | If true, indicates the tool does not modify its environment                                                                          |
| `destructiveHint` | boolean | true    | If true, the tool may perform destructive updates (only meaningful when `readOnlyHint` is false)                                     |
| `idempotentHint`  | boolean | false   | If true, calling the tool repeatedly with the same arguments has no additional effect (only meaningful when `readOnlyHint` is false) |
| `openWorldHint`   | boolean | true    | If true, the tool may interact with an "open world" of external entities                                                             |

### Example usage

The following examples show how to define tools with annotations across different scenarios:

```typescript
// A read-only search tool
{
  name: "web_search",
  description: "Search the web for information",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" }
    },
    required: ["query"]
  },
  annotations: {
    title: "Web Search",
    readOnlyHint: true,
    openWorldHint: true
  }
}

// A destructive file deletion tool
{
  name: "delete_file",
  description: "Delete a file from the filesystem",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string" }
    },
    required: ["path"]
  },
  annotations: {
    title: "Delete File",
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false
  }
}

// A non-destructive database record creation tool
{
  name: "create_record",
  description: "Create a new record in the database",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string" },
      data: { type: "object" }
    },
    required: ["table", "data"]
  },
  annotations: {
    title: "Create Database Record",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
}
```

### Incorporating annotations in server implementation

<Tabs>
  <Tab title="TypeScript">
    ```typescript
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [{
          name: "calculate_sum",
          description: "Add two numbers together",
          inputSchema: {
            type: "object",
            properties: {
              a: { type: "number" },
              b: { type: "number" }
            },
            required: ["a", "b"]
          },
          annotations: {
            title: "Calculate Sum",
            readOnlyHint: true,
            openWorldHint: false
          }
        }]
      };
    });
    ```
  </Tab>

  <Tab title="Python">
    ```python
    from mcp.server.fastmcp import FastMCP

    mcp = FastMCP("example-server")

    @mcp.tool(
        annotations={
            "title": "Calculate Sum",
            "readOnlyHint": True,
            "openWorldHint": False
        }
    )
    async def calculate_sum(a: float, b: float) -> str:
        """Add two numbers together.

        Args:
            a: First number to add
            b: Second number to add
        """
        result = a + b
        return str(result)
    ```
  </Tab>
</Tabs>

### Best practices for tool annotations

1. **Be accurate about side effects**: Clearly state whether a tool alters its environment and whether those changes are destructive.

2. **Use descriptive titles**: Choose human-friendly titles that unambiguously convey the tool's purpose.

3. **Indicate idempotency correctly**: Only mark a tool as idempotent when repeated calls with the same arguments genuinely produce no additional effect.

4. **Set appropriate open/closed world hints**: Specify whether a tool interacts with a closed system (such as a database) or an open system (such as the web).

5. **Remember annotations are hints**: All ToolAnnotations properties are hints and are not guaranteed to accurately describe actual tool behavior. Clients must never base security-critical decisions solely on annotations.

## Testing tools

A thorough testing strategy for MCP tools should address:

* **Functional testing**: Confirm tools execute correctly with valid inputs and handle invalid inputs as expected
* **Integration testing**: Verify tool interaction with external systems using both real and mocked dependencies
* **Security testing**: Check authentication, authorization, input sanitization, and rate limiting
* **Performance testing**: Assess behavior under load, timeout handling, and resource cleanup
* **Error handling**: Verify that tools report errors correctly through the MCP protocol and release resources appropriately
