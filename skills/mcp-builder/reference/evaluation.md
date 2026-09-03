# MCP Server Evaluation Guide

## Overview

This document describes how to build thorough evaluations for MCP servers. Evaluations verify whether LLMs can reliably use your MCP server to answer realistic, complex questions using only the tools the server exposes.

---

## Quick Reference

### Evaluation Requirements
- Create 10 human-readable questions
- Questions must be READ-ONLY, INDEPENDENT, NON-DESTRUCTIVE
- Each question requires multiple tool calls (potentially dozens)
- Answers must be single, verifiable values
- Answers must be STABLE (won't change over time)

### Output Format
```xml
<evaluation>
   <qa_pair>
      <question>Your question here</question>
      <answer>Single verifiable answer</answer>
   </qa_pair>
</evaluation>
```

---

## Purpose of Evaluations

An MCP server's quality is NOT measured by how thoroughly or correctly it implements tools, but by how well those implementations (input/output schemas, docstrings/descriptions, functionality) allow LLMs — with no additional context and access ONLY to the MCP server — to answer realistic and challenging questions.

## Evaluation Overview

Produce 10 human-readable questions that can be answered using ONLY READ-ONLY, INDEPENDENT, NON-DESTRUCTIVE, and IDEMPOTENT operations. Each question should be:
- Realistic
- Clear and concise
- Unambiguous
- Complex, requiring potentially dozens of tool calls or steps
- Answerable with a single, verifiable value identified in advance

## Question Guidelines

### Core Requirements

1. **Questions MUST be independent**
   - Each question should NOT depend on the answer to any other question
   - Should not assume prior write operations from processing another question

2. **Questions MUST require ONLY NON-DESTRUCTIVE AND IDEMPOTENT tool use**
   - Should not instruct or require modifying state in order to reach the correct answer

3. **Questions must be REALISTIC, CLEAR, CONCISE, and COMPLEX**
   - Must require another LLM to invoke multiple (potentially dozens of) tools or steps to answer

### Complexity and Depth

4. **Questions must require deep exploration**
   - Consider multi-hop questions that involve multiple sub-questions and sequential tool calls
   - Each step should build on information discovered in earlier ones

5. **Questions may require extensive paging**
   - May necessitate paging through multiple result sets
   - May require querying older data (1-2 years out-of-date) to surface niche information
   - The questions must be DIFFICULT

6. **Questions must require deep understanding**
   - Rather than surface-level knowledge
   - May frame complex ideas as True/False questions requiring supporting evidence
   - May use multiple-choice format where the LLM must evaluate different hypotheses

7. **Questions must not be solvable with a straightforward keyword search**
   - Avoid including specific keywords from the target content
   - Use synonyms, related concepts, or paraphrases instead
   - Require multiple searches, analysis of several related items, extraction of context, then derivation of the answer

### Tool Testing

8. **Questions should stress-test tool return values**
   - May trigger tools that return large JSON objects or lists, potentially overwhelming the LLM
   - Should require understanding multiple modalities of data:
     - IDs and names
     - Timestamps and datetimes (months, days, years, seconds)
     - File IDs, names, extensions, and mimetypes
     - URLs, GIDs, etc.
   - Should probe whether tools return all useful forms of data

9. **Questions should MOSTLY reflect real human use cases**
   - The kinds of information retrieval tasks that HUMANS assisted by an LLM would actually care about

10. **Questions may require dozens of tool calls**
    - This challenges LLMs with limited context
    - Encourages MCP server tools to return only necessary information

11. **Include ambiguous questions**
    - May be ambiguous OR require difficult decisions about which tools to call
    - Force the LLM to potentially err or misinterpret
    - Ensure that despite AMBIGUITY, there remains A SINGLE VERIFIABLE ANSWER

### Stability

12. **Questions must be designed so the answer DOES NOT CHANGE**
    - Do not ask questions that rely on "current state" that is dynamic
    - For example, avoid counting:
      - Number of reactions to a post
      - Number of replies to a thread
      - Number of members in a channel

13. **DO NOT let the MCP server RESTRICT the kinds of questions you create**
    - Craft challenging and complex questions
    - Some may not be solvable with the available MCP server tools
    - Questions may require specific output formats (datetime vs. epoch time, JSON vs. MARKDOWN)
    - Questions may require dozens of tool calls to complete

## Answer Guidelines

### Verification

1. **Answers must be VERIFIABLE via direct string comparison**
   - If the answer can be expressed in multiple formats, clearly specify the required format in the QUESTION
   - Examples: "Use YYYY/MM/DD.", "Respond True or False.", "Answer A, B, C, or D and nothing else."
   - Answers should be a single VERIFIABLE value such as:
     - User ID, user name, display name, first name, last name
     - Channel ID, channel name
     - Message ID, string
     - URL, title
     - Numerical quantity
     - Timestamp, datetime
     - Boolean (for True/False questions)
     - Email address, phone number
     - File ID, file name, file extension
     - Multiple choice answer
   - Answers must not require special formatting or complex, structured output
   - Answers will be verified using DIRECT STRING COMPARISON

### Readability

2. **Answers should generally prefer HUMAN-READABLE formats**
   - Examples: names, first name, last name, datetime, file name, message string, URL, yes/no, true/false, a/b/c/d
   - Rather than opaque IDs (though IDs are acceptable)
   - The VAST MAJORITY of answers should be human-readable

### Stability

3. **Answers must be STABLE/STATIONARY**
   - Target older content (e.g., ended conversations, launched projects, resolved questions)
   - Base QUESTIONS on "closed" concepts that always yield the same answer
   - Questions may specify a fixed time window to shield against non-stationary answers
   - Rely on context that is UNLIKELY to change
   - Example: when looking for a paper name, be SPECIFIC enough that the answer cannot be confused with papers published later

4. **Answers must be CLEAR and UNAMBIGUOUS**
   - Questions must be constructed so there is exactly one clear answer
   - The answer must be derivable using the MCP server tools

### Diversity

5. **Answers must be DIVERSE**
   - Each answer should be a single VERIFIABLE value spanning diverse modalities and formats
   - User concept: user ID, user name, display name, first name, last name, email address, phone number
   - Channel concept: channel ID, channel name, channel topic
   - Message concept: message ID, message string, timestamp, month, day, year

6. **Answers must NOT be complex structures**
   - Not a list of values
   - Not a complex object
   - Not a list of IDs or strings
   - Not natural language text
   - UNLESS the answer can be straightforwardly verified using DIRECT STRING COMPARISON
   - And can be realistically reproduced
   - It should be unlikely that an LLM would return the same list in a different order or format

## Evaluation Process

### Step 1: Documentation Inspection

Review the target API documentation to understand:
- Available endpoints and functionality
- Where ambiguity exists, retrieve additional information from the web
- Parallelize this step AS MUCH AS POSSIBLE
- Ensure each subagent examines ONLY documentation from the file system or the web

### Step 2: Tool Inspection

Enumerate the tools available in the MCP server:
- Inspect the MCP server directly
- Study input/output schemas, docstrings, and descriptions
- WITHOUT invoking the tools themselves at this stage

### Step 3: Developing Understanding

Repeat steps 1 and 2 until you have a solid understanding:
- Iterate multiple times
- Consider the kinds of tasks you want to craft
- Refine your understanding progressively
- At NO stage should you READ the MCP server's implementation code
- Rely on intuition and documentation to develop reasonable, realistic, yet VERY challenging tasks

### Step 4: Read-Only Content Inspection

Once you understand the API and tools, USE the MCP server tools:
- Inspect content using READ-ONLY and NON-DESTRUCTIVE operations ONLY
- Goal: surface specific content (e.g., users, channels, messages, projects, tasks) to build realistic questions around
- Must NOT invoke any tools that alter state
- Must NOT read the MCP server's implementation code
- Parallelize this step using individual sub-agents pursuing independent explorations
- Ensure each subagent only performs READ-ONLY, NON-DESTRUCTIVE, and IDEMPOTENT operations
- BE CAREFUL: SOME TOOLS may return LARGE AMOUNTS OF DATA that could exhaust your CONTEXT
- Make INCREMENTAL, SMALL, AND TARGETED tool calls during exploration
- Use the `limit` parameter to cap results in all tool call requests (<10)
- Use pagination throughout

### Step 5: Task Generation

After reviewing the content, produce 10 human-readable questions:
- An LLM should be able to answer each one using the MCP server
- Follow all question and answer guidelines above

## Output Format

Each QA pair consists of a question and an answer. The output must be an XML file with this structure:

```xml
<evaluation>
   <qa_pair>
      <question>Find the project created in Q2 2024 with the highest number of completed tasks. What is the project name?</question>
      <answer>Website Redesign</answer>
   </qa_pair>
   <qa_pair>
      <question>Search for issues labeled as "bug" that were closed in March 2024. Which user closed the most issues? Provide their username.</question>
      <answer>sarah_dev</answer>
   </qa_pair>
   <qa_pair>
      <question>Look for pull requests that modified files in the /api directory and were merged between January 1 and January 31, 2024. How many different contributors worked on these PRs?</question>
      <answer>7</answer>
   </qa_pair>
   <qa_pair>
      <question>Find the repository with the most stars that was created before 2023. What is the repository name?</question>
      <answer>data-pipeline</answer>
   </qa_pair>
</evaluation>
```

## Evaluation Examples

### Good Questions

**Example 1: Multi-hop question requiring deep exploration (GitHub MCP)**
```xml
<qa_pair>
   <question>Find the repository that was archived in Q3 2023 and had previously been the most forked project in the organization. What was the primary programming language used in that repository?</question>
   <answer>Python</answer>
</qa_pair>
```

This question is effective because:
- Multiple searches are needed to locate archived repositories
- Identifying which had the most forks before archival requires additional analysis
- Examining repository details is necessary to determine the language
- The answer is a simple, verifiable value
- It is grounded in historical (closed) data that will not change

**Example 2: Requires understanding context without keyword matching (Project Management MCP)**
```xml
<qa_pair>
   <question>Locate the initiative focused on improving customer onboarding that was completed in late 2023. The project lead created a retrospective document after completion. What was the lead's role title at that time?</question>
   <answer>Product Manager</answer>
</qa_pair>
```

This question is effective because:
- It avoids using a specific project name ("initiative focused on improving customer onboarding")
- It requires finding completed projects within a particular timeframe
- The project lead and their role must be identified
- Context from retrospective documents must be interpreted
- The answer is human-readable and stable
- It is anchored in completed work that will not change

**Example 3: Complex aggregation requiring multiple steps (Issue Tracker MCP)**
```xml
<qa_pair>
   <question>Among all bugs reported in January 2024 that were marked as critical priority, which assignee resolved the highest percentage of their assigned bugs within 48 hours? Provide the assignee's username.</question>
   <answer>alex_eng</answer>
</qa_pair>
```

This question is effective because:
- Bugs must be filtered by date, priority, and status
- Results must be grouped by assignee and resolution rates calculated
- Timestamps must be interpreted to assess 48-hour windows
- Pagination is tested (potentially many bugs to process)
- The answer is a single username
- It is based on historical data from a defined time period

**Example 4: Requires synthesis across multiple data types (CRM MCP)**
```xml
<qa_pair>
   <question>Find the account that upgraded from the Starter to Enterprise plan in Q4 2023 and had the highest annual contract value. What industry does this account operate in?</question>
   <answer>Healthcare</answer>
</qa_pair>
```

This question is effective because:
- Subscription tier changes must be understood
- Upgrade events within a specific timeframe must be identified
- Contract values must be compared
- Account industry information must be retrieved
- The answer is simple and verifiable
- It is based on completed historical transactions

### Poor Questions

**Example 1: Answer changes over time**
```xml
<qa_pair>
   <question>How many open issues are currently assigned to the engineering team?</question>
   <answer>47</answer>
</qa_pair>
```

This question is problematic because:
- The answer shifts as issues are created, closed, or reassigned
- It is not based on stable/stationary data
- It depends on "current state" that is dynamic

**Example 2: Too easy with keyword search**
```xml
<qa_pair>
   <question>Find the pull request with title "Add authentication feature" and tell me who created it.</question>
   <answer>developer123</answer>
</qa_pair>
```

This question is problematic because:
- It is solvable with a straightforward keyword search using the exact title
- No deep exploration or understanding is required
- No synthesis or analysis is involved

**Example 3: Ambiguous answer format**
```xml
<qa_pair>
   <question>List all the repositories that have Python as their primary language.</question>
   <answer>repo1, repo2, repo3, data-pipeline, ml-tools</answer>
</qa_pair>
```

This question is problematic because:
- The answer is a list that can be returned in any order
- Direct string comparison is not reliable for verification
- The LLM may format results differently (JSON array, comma-separated, newline-separated)
- A better approach is to ask for a specific aggregate (count) or superlative (most stars)

## Verification Process

After creating evaluations:

1. **Examine the XML file** to understand the schema
2. **Load each task instruction** and, in parallel, use the MCP server and tools to determine the correct answer by attempting to solve the task YOURSELF
3. **Flag any operations** that require WRITE or DESTRUCTIVE actions
4. **Accumulate all CORRECT answers** and replace any incorrect entries in the document
5. **Remove any `<qa_pair>`** that require WRITE or DESTRUCTIVE operations

Parallelize the task-solving phase to avoid exhausting your context, then consolidate all answers and apply changes to the file at the end.

## Tips for Creating Quality Evaluations

1. **Think Hard and Plan Ahead** before drafting tasks
2. **Parallelize Where Opportunity Arises** to accelerate the process and manage context
3. **Focus on Realistic Use Cases** that humans would genuinely want to accomplish
4. **Create Challenging Questions** that push the limits of the MCP server's capabilities
5. **Ensure Stability** by grounding questions in historical data and closed concepts
6. **Verify Answers** by solving the questions yourself with the MCP server tools
7. **Iterate and Refine** based on what you discover during the process

---

# Running Evaluations

After creating your evaluation file, you can use the provided evaluation harness to test your MCP server.

## Setup

1. **Install Dependencies**

   ```bash
   pip install -r scripts/requirements.txt
   ```

   Or install manually:
   ```bash
   pip install anthropic mcp
   ```

2. **Set API Key**

   ```bash
   export ANTHROPIC_API_KEY=your_api_key_here
   ```

## Evaluation File Format

Evaluation files use XML format with `<qa_pair>` elements:

```xml
<evaluation>
   <qa_pair>
      <question>Find the project created in Q2 2024 with the highest number of completed tasks. What is the project name?</question>
      <answer>Website Redesign</answer>
   </qa_pair>
   <qa_pair>
      <question>Search for issues labeled as "bug" that were closed in March 2024. Which user closed the most issues? Provide their username.</question>
      <answer>sarah_dev</answer>
   </qa_pair>
</evaluation>
```

## Running Evaluations

The evaluation script (`scripts/evaluation.py`) supports three transport types:

**Important:**
- **stdio transport**: The evaluation script automatically launches and manages the MCP server process for you. Do not run the server manually.
- **sse/http transports**: You must start the MCP server separately before running the evaluation. The script connects to the already-running server at the specified URL.

### 1. Local STDIO Server

For locally-run MCP servers (script launches the server automatically):

```bash
python scripts/evaluation.py \
  -t stdio \
  -c python \
  -a my_mcp_server.py \
  evaluation.xml
```

With environment variables:
```bash
python scripts/evaluation.py \
  -t stdio \
  -c python \
  -a my_mcp_server.py \
  -e API_KEY=abc123 \
  -e DEBUG=true \
  evaluation.xml
```

### 2. Server-Sent Events (SSE)

For SSE-based MCP servers (you must start the server first):

```bash
python scripts/evaluation.py \
  -t sse \
  -u https://example.com/mcp \
  -H "Authorization: Bearer token123" \
  -H "X-Custom-Header: value" \
  evaluation.xml
```

### 3. HTTP (Streamable HTTP)

For HTTP-based MCP servers (you must start the server first):

```bash
python scripts/evaluation.py \
  -t http \
  -u https://example.com/mcp \
  -H "Authorization: Bearer token123" \
  evaluation.xml
```

## Command-Line Options

```
usage: evaluation.py [-h] [-t {stdio,sse,http}] [-m MODEL] [-c COMMAND]
                     [-a ARGS [ARGS ...]] [-e ENV [ENV ...]] [-u URL]
                     [-H HEADERS [HEADERS ...]] [-o OUTPUT]
                     eval_file

positional arguments:
  eval_file             Path to evaluation XML file

optional arguments:
  -h, --help            Show help message
  -t, --transport       Transport type: stdio, sse, or http (default: stdio)
  -m, --model           Claude model to use (default: claude-3-7-sonnet-20250219)
  -o, --output          Output file for report (default: print to stdout)

stdio options:
  -c, --command         Command to run MCP server (e.g., python, node)
  -a, --args            Arguments for the command (e.g., server.py)
  -e, --env             Environment variables in KEY=VALUE format

sse/http options:
  -u, --url             MCP server URL
  -H, --header          HTTP headers in 'Key: Value' format
```

## Output

The evaluation script generates a detailed report including:

- **Summary Statistics**:
  - Accuracy (correct/total)
  - Average task duration
  - Average tool calls per task
  - Total tool calls

- **Per-Task Results**:
  - Prompt and expected response
  - Actual response from the agent
  - Whether the answer was correct (✅/❌)
  - Duration and tool call details
  - Agent's summary of its approach
  - Agent's feedback on the tools

### Save Report to File

```bash
python scripts/evaluation.py \
  -t stdio \
  -c python \
  -a my_server.py \
  -o evaluation_report.md \
  evaluation.xml
```

## Complete Example Workflow

Here's a complete example of creating and running an evaluation:

1. **Create your evaluation file** (`my_evaluation.xml`):

```xml
<evaluation>
   <qa_pair>
      <question>Find the user who created the most issues in January 2024. What is their username?</question>
      <answer>alice_developer</answer>
   </qa_pair>
   <qa_pair>
      <question>Among all pull requests merged in Q1 2024, which repository had the highest number? Provide the repository name.</question>
      <answer>backend-api</answer>
   </qa_pair>
   <qa_pair>
      <question>Find the project that was completed in December 2023 and had the longest duration from start to finish. How many days did it take?</question>
      <answer>127</answer>
   </qa_pair>
</evaluation>
```

2. **Install dependencies**:

```bash
pip install -r scripts/requirements.txt
export ANTHROPIC_API_KEY=your_api_key
```

3. **Run evaluation**:

```bash
python scripts/evaluation.py \
  -t stdio \
  -c python \
  -a github_mcp_server.py \
  -e GITHUB_TOKEN=ghp_xxx \
  -o github_eval_report.md \
  my_evaluation.xml
```

4. **Review the report** in `github_eval_report.md` to:
   - See which questions passed/failed
   - Read the agent's feedback on your tools
   - Identify areas for improvement
   - Iterate on your MCP server design

## Troubleshooting

### Connection Errors

If you get connection errors:
- **STDIO**: Verify the command and arguments are correct
- **SSE/HTTP**: Check the URL is accessible and headers are correct
- Ensure any required API keys are set in environment variables or headers

### Low Accuracy

If many evaluations fail:
- Review the agent's feedback for each task
- Check if tool descriptions are clear and comprehensive
- Verify input parameters are well-documented
- Consider whether tools return too much or too little data
- Ensure error messages are actionable

### Timeout Issues

If tasks are timing out:
- Use a more capable model (e.g., `claude-3-7-sonnet-20250219`)
- Check if tools are returning too much data
- Verify pagination is working correctly
- Consider simplifying complex questions
