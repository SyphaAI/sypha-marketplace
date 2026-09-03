---
name: lead-research-assistant
description: >-
  Finds high-quality leads for your product or service by analyzing your
  business, researching target companies, and delivering actionable outreach
  strategies. Ideal for sales, business development, and marketing
  professionals.
metadata:
  category: business
  source:
    repository: 'https://github.com/ComposioHQ/awesome-claude-skills'
    path: lead-research-assistant
    commit: 92568c1edaff1bde5371154f036d959346c145a8
license: NOASSERTION
---

# Lead Research Assistant

This skill helps you find and qualify potential leads by analyzing your product or service, defining your ideal customer profile, and surfacing actionable outreach strategies.

## When to Use This Skill

- Finding potential customers or clients for your product or service
- Compiling a list of companies to approach for partnerships
- Identifying target accounts for sales outreach
- Researching companies that fit your ideal customer profile
- Preparing for business development activities

## What This Skill Does

1. **Understands Your Business**: Analyzes your product or service, its value proposition, and target market
2. **Identifies Target Companies**: Locates companies that match your ideal customer profile using criteria such as:
   - Industry and sector
   - Company size and location
   - Technology stack and tooling
   - Growth stage and funding status
   - Pain points your product addresses
3. **Prioritizes Leads**: Scores and ranks companies by fit and relevance
4. **Provides Contact Strategies**: Recommends how to approach each lead with tailored messaging
5. **Enriches Data**: Collects contextual information about decision-makers and company background

## How to Use

### Basic Usage

Describe your product or service and what you are looking for:

```
I'm building [product description]. Find me 10 companies in [location/industry]
that would be good leads for this.
```

### With Your Codebase

For more accurate results, run this from your product's source code directory:

```
Look at what I'm building in this repository and identify the top 10 companies
in [location/industry] that would benefit from this product.
```

### Advanced Usage

For more precise research, supply a detailed customer profile:

```
My product: [description]
Ideal customer profile:
- Industry: [industry]
- Company size: [size range]
- Location: [location]
- Current pain points: [pain points]
- Technologies they use: [tech stack]

Find me 20 qualified leads with contact strategies for each.
```

## Instructions

When a user requests lead research:

1. **Understand the Product/Service**
   - If running from a code directory, analyze the codebase to grasp what the product does
   - Ask clarifying questions about the value proposition
   - Identify key features and benefits
   - Understand which problems the product solves

2. **Define the Ideal Customer Profile**
   - Determine target industries and sectors
   - Identify appropriate company size ranges
   - Account for geographic preferences
   - Clarify the relevant pain points
   - Note any technology requirements

3. **Research and Identify Leads**
   - Search for companies that match the defined criteria
   - Look for buying signals (job postings, tech stack, recent news)
   - Factor in growth indicators (funding rounds, expansion, hiring activity)
   - Identify companies offering complementary products or services
   - Check for signs of budget availability

4. **Prioritize and Score**
   - Assign a fit score (1–10) to each lead
   - Weight factors such as:
     - Alignment with the ICP
     - Signals of immediate need
     - Budget availability
     - Competitive landscape
     - Timing indicators

5. **Provide Actionable Output**

   For each lead, include:
   - **Company Name** and website
   - **Why They're a Good Fit**: Specific reasons grounded in their business context
   - **Priority Score**: 1–10 with a brief explanation
   - **Decision Maker**: Role or title to target (e.g., "VP of Engineering")
   - **Contact Strategy**: Personalized outreach suggestions
   - **Value Proposition**: How the product addresses their specific challenge
   - **Conversation Starters**: Concrete topics to raise in initial outreach
   - **LinkedIn URL**: If available, for direct connection

6. **Format the Output**

   Present results in a clear, scannable format:

   ```markdown
   # Lead Research Results

   ## Summary
   - Total leads found: [X]
   - High priority (8-10): [X]
   - Medium priority (5-7): [X]
   - Average fit score: [X]

   ---

   ## Lead 1: [Company Name]

   **Website**: [URL]
   **Priority Score**: [X/10]
   **Industry**: [Industry]
   **Size**: [Employee count/revenue range]

   **Why They're a Good Fit**:
   [2-3 specific reasons based on their business]

   **Target Decision Maker**: [Role/Title]
   **LinkedIn**: [URL if available]

   **Value Proposition for Them**:
   [Specific benefit for this company]

   **Outreach Strategy**:
   [Personalized approach - mention specific pain points, recent company news, or relevant context]

   **Conversation Starters**:
   - [Specific point 1]
   - [Specific point 2]

   ---

   [Repeat for each lead]
   ```

7. **Offer Next Steps**
   - Suggest exporting results to a CSV for CRM import
   - Offer to draft personalized outreach messages
   - Recommend a prioritization order based on timing
   - Propose deeper follow-up research on the top leads

## Examples

### Example 1: From Lenny's Newsletter

**User**: "I'm building a tool that masks sensitive data in AI coding assistant queries. Find potential leads."

**Output**: Produces a prioritized list of companies that:
- Use AI coding assistants (Copilot, Cursor, etc.)
- Handle sensitive data (fintech, healthcare, legal)
- Show evidence in GitHub repos of using coding agents
- May have inadvertently exposed sensitive data in code
- Includes LinkedIn URLs for relevant decision-makers

### Example 2: Local Business

**User**: "I run a consulting practice for remote team productivity. Find me 10 companies in the Bay Area that recently went remote."

**Output**: Surfaces companies that:
- Have recently posted remote job listings
- Announced remote-first or distributed work policies
- Are actively building distributed teams
- Exhibit signs of remote work challenges
- Includes a personalized outreach strategy for each

## Tips for Best Results

- **Be specific** about your product and what makes it distinctive
- **Run from your codebase** when applicable to supply automatic context
- **Provide context** about your ideal customer profile upfront
- **Specify constraints** such as industry, location, or company size
- **Request follow-up** research on the most promising leads for deeper insights

## Related Use Cases

- Drafting personalized outreach emails once leads are identified
- Building a CRM-ready CSV of qualified prospects
- Researching individual companies in depth
- Analyzing competitor customer bases
- Identifying partnership opportunities
