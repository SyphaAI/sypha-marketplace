---
name: competitive-ads-extractor
description: >-
  Pulls and analyzes competitors' ads from ad libraries (Facebook, LinkedIn,
  etc.) to reveal which messaging, problems, and creative approaches are
  gaining traction. Helps inspire and strengthen your own ad campaigns.
metadata:
  category: business
  source:
    repository: 'https://github.com/ComposioHQ/awesome-claude-skills'
    path: competitive-ads-extractor
    commit: 92568c1edaff1bde5371154f036d959346c145a8
license: NOASSERTION
---

# Competitive Ads Extractor

This skill pulls your competitors' ads from ad libraries and analyzes what is performing well — the problems they highlight, the use cases they target, and the copy and creative that is resonating.

## When to Use This Skill

- Investigating competitor ad strategies
- Seeking inspiration for your own ads
- Mapping market positioning
- Spotting successful ad patterns
- Evaluating messaging effectiveness
- Uncovering new use cases or pain points
- Planning ad campaigns grounded in proven concepts

## What This Skill Does

1. **Extracts Ads**: Collects ads from Facebook Ad Library, LinkedIn, and other platforms
2. **Captures Screenshots**: Saves visual copies of every ad found
3. **Analyzes Messaging**: Surfaces problems, use cases, and value propositions
4. **Categorizes Ads**: Organizes by theme, audience, or format
5. **Identifies Patterns**: Surfaces recurring successful approaches
6. **Provides Insights**: Explains why specific ads are likely to perform well

## How to Use

### Basic Extraction

```
Extract all current ads from [Competitor Name] on Facebook Ad Library
```

```
Scrape ads from [Company] and analyze their messaging
```

### Specific Analysis

```
Get all ads from [Competitor] focusing on their messaging
about [specific problem]. What pain points are they highlighting?
```

### Competitive Set

```
Extract ads from these 5 competitors: [list].
Compare their approaches and tell me what's working.
```

### Specific Platform

```
Get LinkedIn ads from [Competitor] and analyze their
B2B positioning strategy
```

## Example

**User**: "Extract ads from Notion on Facebook Ad Library and tell me what messaging is working for them."

**Process**:
```
Accessing Facebook Ad Library...
Searching for: Notion
Found: 23 active ads

Extracting screenshots...
[████████████████████] 100%

Saved to: competitor-ads/notion/
- ad-001-collaboration.png
- ad-002-productivity.png
- ad-003-templates.png
...

Analyzing messaging...
```

**Output**:
```
# Notion Ad Analysis

## Overview
- Total Ads: 23 active
- Primary Themes: Productivity (35%), Collaboration (30%),
  Templates (20%), AI Features (15%)
- Ad Formats: Static images (60%), Video (40%)
- CTA Patterns: "Try for free", "Get started"

## Key Problems They're Highlighting

1. **Scattered Information** (8 ads)
   Copy: "Stop switching between 10 different tools"
   Why it works: Direct pain point many teams face

2. **Meeting Overload** (5 ads)
   Copy: "Replace unnecessary meetings with async updates"
   Why it works: Post-COVID remote work pain point

3. **Lost Documentation** (4 ads)
   Copy: "Never ask 'where is that doc?' again"
   Why it works: Universal workplace frustration

## Successful Creative Patterns

### Pattern 1: Before/After Split
- Shows chaotic tool landscape → Clean Notion workspace
- Used in 6 high-performing ads
- Visual metaphor is immediately clear

### Pattern 2: Feature Showcase
- GIF of actual product usage
- Shows specific feature in 5 seconds
- Used for new features (AI, templates)

### Pattern 3: Social Proof
- "Join 20M users" messaging
- Customer logos
- Used in 4 ads targeting enterprise

## Copy That's Working

Best Headlines:
1. "Your team's knowledge, finally in one place"
   → Benefit-focused, addresses pain directly

2. "The all-in-one workspace"
   → Clear positioning, broad appeal

3. "AI that actually helps you work"
   → Addresses AI skepticism, practical angle

Best Body Copy Patterns:
- Short sentences (under 10 words)
- Focus on outcomes not features
- Include specific numbers ("Cut meetings by 50%")

## Audience Targeting Insights

Based on ad variations:
- Startup founders: Solo productivity angle
- Team leads: Collaboration and alignment
- Enterprise: Security and compliance mentions
- Students: Free plan, templates, organization

## Recommendations for Your Ads

1. **Test the "tool sprawl" pain point**
   → Strong resonance based on their ad frequency

2. **Use product screenshots over abstract visuals**
   → All their top ads show actual UI

3. **Lead with the problem, not the solution**
   → "Tired of X?" performs better than "Introducing Y"

4. **Keep copy under 100 characters**
   → Their shortest ads seem most frequent

5. **Test before/after visual formats**
   → Proven pattern in their creative

## Files Saved
- All ads: ~/competitor-ads/notion/
- Analysis: ~/competitor-ads/notion/analysis.md
- Best performers: ~/competitor-ads/notion/top-10/
```

**Inspired by:** Sumant Subrahmanya's use case from Lenny's Newsletter

## What You Can Learn

### Messaging Analysis
- Which problems they put front and center
- How they differentiate from competitors
- Value propositions that resonate with audiences
- Targeted audience segments

### Creative Patterns
- Visual styles that gain traction
- Relative performance of video versus static images
- Color palettes and branding choices
- Layout and composition patterns

### Copy Formulas
- Headline structures in use
- Call-to-action patterns
- Copy length and tone preferences
- Emotional triggers being leveraged

### Campaign Strategy
- Seasonal campaign tactics
- Product launch approaches
- Feature announcement strategies
- Retargeting patterns

## Best Practices

### Legal & Ethical
✓ Use findings for research and inspiration only
✓ Avoid copying ads verbatim
✓ Respect intellectual property rights
✓ Apply insights to inform original creative
✗ Do not plagiarize copy or appropriate designs

### Analysis Tips
1. **Look for patterns**: Which themes appear repeatedly?
2. **Track over time**: Archive ads monthly to observe how messaging evolves
3. **Test hypotheses**: Adapt winning patterns for your brand's context
4. **Segment by audience**: Craft distinct messages for different target groups
5. **Compare platforms**: LinkedIn and Facebook messaging often diverges significantly

## Advanced Features

### Trend Tracking
```
Compare [Competitor]'s ads from Q1 vs Q2.
What messaging has changed?
```

### Multi-Competitor Analysis
```
Extract ads from [Company A], [Company B], [Company C].
What are the common patterns? Where do they differ?
```

### Industry Benchmarks
```
Show me ad patterns across the top 10 project management
tools. What problems do they all focus on?
```

### Format Analysis
```
Analyze video ads vs static image ads from [Competitor].
Which gets more engagement? (if data available)
```

## Common Workflows

### Ad Campaign Planning
1. Collect competitor ads
2. Pinpoint successful patterns
3. Document gaps in their messaging
4. Generate unique angles
5. Draft test ad variations

### Positioning Research
1. Gather ads from 5 competitors
2. Chart their market positioning
3. Locate underserved angles
4. Develop differentiated messaging
5. Benchmark against their approaches

### Creative Inspiration
1. Retrieve ads grouped by theme
2. Examine visual patterns
3. Document color and layout trends
4. Adapt successful patterns for your brand
5. Produce original creative variations

## Tips for Success

1. **Regular Monitoring**: Review ads monthly to catch changes
2. **Broad Research**: Include adjacent competitors in your analysis
3. **Save Everything**: Build a growing reference library
4. **Test Insights**: Validate findings with your own experiments
5. **Track Performance**: A/B test concepts drawn from competitor ads
6. **Stay Original**: Draw inspiration, never copy directly
7. **Multiple Platforms**: Cross-compare Facebook, LinkedIn, TikTok, and others

## Output Formats

- **Screenshots**: All ads saved as images
- **Analysis Report**: Markdown summary of insights
- **Spreadsheet**: CSV with ad copy, CTAs, themes
- **Presentation**: Visual deck of top performers
- **Pattern Library**: Categorized by approach

## Related Use Cases

- Crafting stronger ad copy for your own campaigns
- Mapping market positioning across competitors
- Identifying content gaps in your current messaging
- Uncovering new use cases for your product
- Shaping product marketing strategy
- Generating ideas for social media content
