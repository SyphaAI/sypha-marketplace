---
name: mcp-builder
description: >-
  Guide for building high-quality MCP (Model Context Protocol) servers that
  allow LLMs to interact with external services via well-designed tools.
  Use when constructing MCP servers to connect external APIs or services, whether
  in Python (FastMCP) or Node/TypeScript (MCP SDK).
metadata:
  category: development
  source:
    repository: 'https://github.com/ComposioHQ/awesome-claude-skills'
    path: mcp-builder
    license_path: mcp-builder/LICENSE.txt
    commit: 92568c1edaff1bde5371154f036d959346c145a8
---

# MCP Server Development Guide

## Overview

Use this skill to build high-quality MCP (Model Context Protocol) servers that allow LLMs to interact effectively with external services. An MCP server exposes tools through which LLMs can reach external services and APIs. Server quality is determined by how well those tools allow LLMs to complete real-world tasks.

---

# Process

## 🚀 High-Level Workflow

Building a high-quality MCP server consists of four main phases:

### Phase 1: Deep Research and Planning

#### 1.1 Understand Agent-Centric Design Principles

Before beginning implementation, study how to design tools specifically for AI agents by reviewing the principles below:

**Build for Workflows, Not Just API Endpoints:**
- Avoid simply wrapping existing API endpoints — build purposeful, high-impact workflow tools instead
- Combine related operations (e.g., `schedule_event` that both checks availability and creates the event)
- Focus on tools that complete entire tasks rather than individual API calls
- Think about which workflows agents will actually need to carry out

**Optimize for Limited Context:**
- Agents have constrained context windows — every token matters
- Return high-signal information rather than exhaustive data dumps
- Offer "concise" vs "detailed" response format options
- Prefer human-readable identifiers over technical codes (names over IDs) by default
- Treat the agent's context budget as a scarce resource

**Design Actionable Error Messages:**
- Error messages should steer agents toward correct usage patterns
- Offer concrete next steps: "Try using filter='active_only' to reduce results"
- Make errors instructive, not merely diagnostic
- Help agents learn correct tool usage through well-structured feedback

**Follow Natural Task Subdivisions:**
- Tool names should reflect how humans naturally think about tasks
- Group related tools under consistent prefixes for discoverability
- Structure tools around natural workflows rather than API layout

**Use Evaluation-Driven Development:**
- Establish realistic evaluation scenarios from the start
- Let agent feedback shape tool refinements
- Prototype quickly and iterate based on actual agent behavior

#### 1.3 Study MCP Protocol Documentation

**Fetch the latest MCP protocol documentation:**

Use WebFetch to load: `https://modelcontextprotocol.io/llms-full.txt`

This comprehensive document contains the complete MCP specification and guidelines.

#### 1.4 Study Framework Documentation

**Load and read the following reference files:**

- **MCP Best Practices**: [📋 View Best Practices](./reference/mcp_best_practices.md) - Core guidelines for all MCP servers

**For Python implementations, also load:**
- **Python SDK Documentation**: Use WebFetch to load `https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/a5271423128ac76cbd171adad40e225d1c755522/README.md`
- [🐍 Python Implementation Guide](./reference/python_mcp_server.md) - Python-specific best practices and examples

**For Node/TypeScript implementations, also load:**
- **TypeScript SDK Documentation**: Use WebFetch to load `https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/c59dc3aa1a633d27fbbe873f1a430483cf7440f8/README.md`
- [⚡ TypeScript Implementation Guide](./reference/node_mcp_server.md) - Node/TypeScript-specific best practices and examples

#### 1.5 Exhaustively Study API Documentation

When integrating a service, read through **ALL** available API documentation:
- Official API reference documentation
- Authentication and authorization requirements
- Rate limiting and pagination patterns
- Error responses and status codes
- Available endpoints and their parameters
- Data models and schemas

**Use web search and the WebFetch tool as needed to gather thorough coverage.**

#### 1.6 Create a Comprehensive Implementation Plan

Drawing on your research, produce a detailed plan covering:

**Tool Selection:**
- Enumerate the most valuable endpoints/operations to implement
- Prioritize tools that address the most common and critical use cases
- Consider how tools combine to support complex workflows

**Shared Utilities and Helpers:**
- Identify recurring API request patterns
- Plan pagination helpers
- Design filtering and formatting utilities
- Define error handling strategies

**Input/Output Design:**
- Specify input validation models (Pydantic for Python, Zod for TypeScript)
- Design consistent response formats (e.g., JSON or Markdown) with configurable detail levels (e.g., Detailed or Concise)
- Account for large-scale usage (thousands of users/resources)
- Establish character limits and truncation strategies (e.g., 25,000 tokens)

**Error Handling Strategy:**
- Plan graceful failure modes
- Write clear, actionable, LLM-friendly natural language error messages that prompt further action
- Account for rate limiting and timeout scenarios
- Handle authentication and authorization errors

---

### Phase 2: Implementation

With a comprehensive plan in hand, proceed with implementation following language-specific best practices.

#### 2.1 Set Up Project Structure

**For Python:**
- Create a single `.py` file or organize into modules for larger implementations (see [🐍 Python Guide](./reference/python_mcp_server.md))
- Use the MCP Python SDK for tool registration
- Define Pydantic models for input validation

**For Node/TypeScript:**
- Set up the appropriate project structure (see [⚡ TypeScript Guide](./reference/node_mcp_server.md))
- Configure `package.json` and `tsconfig.json`
- Use the MCP TypeScript SDK
- Define Zod schemas for input validation

#### 2.2 Implement Core Infrastructure First

**Build shared utilities before implementing individual tools:**
- API request helper functions
- Error handling utilities
- Response formatting functions (JSON and Markdown)
- Pagination helpers
- Authentication/token management

#### 2.3 Implement Tools Systematically

For each tool in the plan:

**Define Input Schema:**
- Use Pydantic (Python) or Zod (TypeScript) for validation
- Apply appropriate constraints (min/max length, regex patterns, min/max values, ranges)
- Supply clear, descriptive field descriptions
- Include varied examples within field descriptions

**Write Comprehensive Docstrings/Descriptions:**
- A one-line summary of what the tool does
- A detailed explanation of its purpose and behavior
- Explicit parameter types with examples
- A complete return type schema
- Usage examples (when to use, when not to use)
- Error handling documentation describing how to proceed for specific errors

**Implement Tool Logic:**
- Leverage shared utilities to eliminate code duplication
- Follow async/await patterns for all I/O operations
- Apply proper error handling
- Support multiple response formats (JSON and Markdown)
- Honor pagination parameters
- Enforce character limits and truncate responses appropriately

**Add Tool Annotations:**
- `readOnlyHint`: true (for read-only operations)
- `destructiveHint`: false (for non-destructive operations)
- `idempotentHint`: true (if repeated calls produce the same effect)
- `openWorldHint`: true (if interacting with external systems)

#### 2.4 Follow Language-Specific Best Practices

**Load the appropriate language guide at this point:**

**For Python: Load [🐍 Python Implementation Guide](./reference/python_mcp_server.md) and verify the following:**
- MCP Python SDK used with correct tool registration
- Pydantic v2 models with `model_config`
- Type hints applied throughout
- Async/await used for all I/O operations
- Imports organized properly
- Module-level constants defined (CHARACTER_LIMIT, API_BASE_URL)

**For Node/TypeScript: Load [⚡ TypeScript Implementation Guide](./reference/node_mcp_server.md) and verify the following:**
- `server.registerTool` used correctly
- Zod schemas include `.strict()`
- TypeScript strict mode is enabled
- No `any` types — use proper types instead
- Explicit Promise<T> return types declared
- Build process configured (`npm run build`)

---

### Phase 3: Review and Refine

Once initial implementation is complete:

#### 3.1 Code Quality Review

Review the code for the following quality indicators:
- **DRY Principle**: No code duplicated across tools
- **Composability**: Shared logic extracted into functions
- **Consistency**: Similar operations return similar formats
- **Error Handling**: All external calls have error handling in place
- **Type Safety**: Full type coverage (Python type hints, TypeScript types)
- **Documentation**: Every tool has thorough docstrings/descriptions

#### 3.2 Test and Build

**Important:** MCP servers are long-running processes that block waiting for requests over stdio/stdin or sse/http. Running them directly in your main process (e.g., `python server.py` or `node dist/index.js`) will cause your process to hang indefinitely.

**Safe approaches for testing the server:**
- Use the evaluation harness (see Phase 4) — this is the recommended approach
- Run the server in tmux to isolate it from your main process
- Apply a timeout during testing: `timeout 5s python server.py`

**For Python:**
- Verify Python syntax: `python -m py_compile your_server.py`
- Confirm imports work correctly by reviewing the file
- To test manually: Run the server in tmux, then run the evaluation harness in the main process
- Alternatively, use the evaluation harness directly (it manages the server for stdio transport)

**For Node/TypeScript:**
- Run `npm run build` and confirm it completes without errors
- Verify that dist/index.js is created
- To test manually: Run the server in tmux, then run the evaluation harness in the main process
- Alternatively, use the evaluation harness directly (it manages the server for stdio transport)

#### 3.3 Use Quality Checklist

Verify implementation quality by loading the checklist from the appropriate language guide:
- Python: see "Quality Checklist" in [🐍 Python Guide](./reference/python_mcp_server.md)
- Node/TypeScript: see "Quality Checklist" in [⚡ TypeScript Guide](./reference/node_mcp_server.md)

---

### Phase 4: Create Evaluations

After the MCP server is implemented, build comprehensive evaluations to validate its effectiveness.

**Load [✅ Evaluation Guide](./reference/evaluation.md) for complete evaluation guidelines.**

#### 4.1 Understand Evaluation Purpose

Evaluations verify whether LLMs can reliably use your MCP server to answer realistic, complex questions.

#### 4.2 Create 10 Evaluation Questions

To develop effective evaluations, follow the process outlined in the evaluation guide:

1. **Tool Inspection**: Enumerate available tools and understand their capabilities
2. **Content Exploration**: Use READ-ONLY operations to survey available data
3. **Question Generation**: Produce 10 complex, realistic questions
4. **Answer Verification**: Work through each question yourself to confirm the answers

#### 4.3 Evaluation Requirements

Each question must be:
- **Independent**: Not reliant on any other question's answer
- **Read-only**: Solvable using only non-destructive operations
- **Complex**: Requiring multiple tool calls and deep exploration
- **Realistic**: Grounded in real use cases that humans would care about
- **Verifiable**: Has a single, clear answer checkable via string comparison
- **Stable**: The answer will not change over time

#### 4.4 Output Format

Create an XML file with this structure:

```xml
<evaluation>
  <qa_pair>
    <question>Find discussions about AI model launches with animal codenames. One model needed a specific safety designation that uses the format ASL-X. What number X was being determined for the model named after a spotted wild cat?</question>
    <answer>3</answer>
  </qa_pair>
<!-- More qa_pairs... -->
</evaluation>
```

---

# Reference Files

## 📚 Documentation Library

Load these resources as needed throughout development:

### Core MCP Documentation (Load First)
- **MCP Protocol**: Fetch from `https://modelcontextprotocol.io/llms-full.txt` - Complete MCP specification
- [📋 MCP Best Practices](./reference/mcp_best_practices.md) - Universal MCP guidelines covering:
  - Server and tool naming conventions
  - Response format guidelines (JSON vs Markdown)
  - Pagination best practices
  - Character limits and truncation strategies
  - Tool development guidelines
  - Security and error handling standards

### SDK Documentation (Load During Phase 1/2)
- **Python SDK**: Fetch from `https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/a5271423128ac76cbd171adad40e225d1c755522/README.md`
- **TypeScript SDK**: Fetch from `https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/c59dc3aa1a633d27fbbe873f1a430483cf7440f8/README.md`

### Language-Specific Implementation Guides (Load During Phase 2)
- [🐍 Python Implementation Guide](./reference/python_mcp_server.md) - Complete Python/FastMCP guide covering:
  - Server initialization patterns
  - Pydantic model examples
  - Tool registration with `@mcp.tool`
  - Complete working examples
  - Quality checklist

- [⚡ TypeScript Implementation Guide](./reference/node_mcp_server.md) - Complete TypeScript guide covering:
  - Project structure
  - Zod schema patterns
  - Tool registration with `server.registerTool`
  - Complete working examples
  - Quality checklist

### Evaluation Guide (Load During Phase 4)
- [✅ Evaluation Guide](./reference/evaluation.md) - Complete evaluation creation guide covering:
  - Question creation guidelines
  - Answer verification strategies
  - XML format specifications
  - Example questions and answers
  - Running an evaluation with the provided scripts
