---
name: content-research-writer
description: >-
  Supports high-quality content writing through research, citations, hook
  improvement, outline iteration, and real-time section feedback. Turns your
  writing workflow from a solo effort into a collaborative partnership.
metadata:
  category: business
  source:
    repository: 'https://github.com/ComposioHQ/awesome-claude-skills'
    path: content-research-writer
    commit: 92568c1edaff1bde5371154f036d959346c145a8
license: NOASSERTION
---

# Content Research Writer

This skill serves as your writing partner, supporting you through the research, outlining, drafting, and refinement stages while preserving your unique voice and style.

## When to Use This Skill

- Writing blog posts, articles, or newsletters
- Creating educational content or tutorials
- Drafting thought leadership pieces
- Researching and writing case studies
- Producing technical documentation with sources
- Writing with proper citations and references
- Improving hooks and introductions
- Getting section-by-section feedback while writing

## What This Skill Does

1. **Collaborative Outlining**: Helps you organize ideas into well-structured outlines
2. **Research Assistance**: Locates relevant information and incorporates citations
3. **Hook Improvement**: Sharpens your opening so it captures reader attention
4. **Section Feedback**: Evaluates each section as you complete it
5. **Voice Preservation**: Keeps your writing style and tone consistent throughout
6. **Citation Management**: Inserts and formats references correctly
7. **Iterative Refinement**: Guides improvement across successive drafts

## How to Use

### Setup Your Writing Environment

Create a dedicated folder for your article:
```
mkdir ~/writing/my-article-title
cd ~/writing/my-article-title
```

Create your draft file:
```
touch article-draft.md
```

Open Sypha from this directory and start writing.

### Basic Workflow

1. **Start with an outline**:
```
Help me create an outline for an article about [topic]
```

2. **Research and add citations**:
```
Research [specific topic] and add citations to my outline
```

3. **Improve the hook**:
```
Here's my introduction. Help me make the hook more compelling.
```

4. **Get section feedback**:
```
I just finished the "Why This Matters" section. Review it and give feedback.
```

5. **Refine and polish**:
```
Review the full draft for flow, clarity, and consistency.
```

## Instructions

When a user requests writing assistance:

1. **Understand the Writing Project**

   Pose clarifying questions:
   - What's the topic and main argument?
   - Who's the target audience?
   - What's the desired length/format?
   - What's your goal? (educate, persuade, entertain, explain)
   - Any existing research or sources to include?
   - What's your writing style? (formal, conversational, technical)

2. **Collaborative Outlining**

   Assist in structuring the content:

   ```markdown
   # Article Outline: [Title]

   ## Hook
   - [Opening line/story/statistic]
   - [Why reader should care]

   ## Introduction
   - Context and background
   - Problem statement
   - What this article covers

   ## Main Sections

   ### Section 1: [Title]
   - Key point A
   - Key point B
   - Example/evidence
   - [Research needed: specific topic]

   ### Section 2: [Title]
   - Key point C
   - Key point D
   - Data/citation needed

   ### Section 3: [Title]
   - Key point E
   - Counter-arguments
   - Resolution

   ## Conclusion
   - Summary of main points
   - Call to action
   - Final thought

   ## Research To-Do
   - [ ] Find data on [topic]
   - [ ] Get examples of [concept]
   - [ ] Source citation for [claim]
   ```

   **Iterate on outline**:
   - Refine based on feedback
   - Ensure logical flow
   - Identify research gaps
   - Flag sections that need deeper investigation

3. **Conduct Research**

   When the user requests research on a topic:

   - Search for pertinent information
   - Locate credible sources
   - Extract key facts, quotes, and data
   - Add citations in the requested format

   Example output:
   ```markdown
   ## Research: AI Impact on Productivity

   Key Findings:

   1. **Productivity Gains**: Studies show 40% time savings for
      content creation tasks [1]

   2. **Adoption Rates**: 67% of knowledge workers use AI tools
      weekly [2]

   3. **Expert Quote**: "AI augments rather than replaces human
      creativity" - Dr. Jane Smith, MIT [3]

   Citations:
   [1] McKinsey Global Institute. (2024). "The Economic Potential
       of Generative AI"
   [2] Stack Overflow Developer Survey (2024)
   [3] Smith, J. (2024). MIT Technology Review interview

   Added to outline under Section 2.
   ```

4. **Improve Hooks**

   When the user shares an introduction, analyze it and strengthen it:

   **Current Hook Analysis**:
   - What works: [positive elements]
   - What could be stronger: [areas for improvement]
   - Emotional impact: [current vs. potential]

   **Suggested Alternatives**:

   Option 1: [Bold statement]
   > [Example]
   *Why it works: [explanation]*

   Option 2: [Personal story]
   > [Example]
   *Why it works: [explanation]*

   Option 3: [Surprising data]
   > [Example]
   *Why it works: [explanation]*

   **Questions to evaluate the hook**:
   - Does it generate curiosity?
   - Does it promise value?
   - Is it specific enough?
   - Does it suit the intended audience?

5. **Provide Section-by-Section Feedback**

   As the user writes each section, review for:

   ```markdown
   # Feedback: [Section Name]

   ## What Works Well ✓
   - [Strength 1]
   - [Strength 2]
   - [Strength 3]

   ## Suggestions for Improvement

   ### Clarity
   - [Specific issue] → [Suggested fix]
   - [Complex sentence] → [Simpler alternative]

   ### Flow
   - [Transition issue] → [Better connection]
   - [Paragraph order] → [Suggested reordering]

   ### Evidence
   - [Claim needing support] → [Add citation or example]
   - [Generic statement] → [Make more specific]

   ### Style
   - [Tone inconsistency] → [Match your voice better]
   - [Word choice] → [Stronger alternative]

   ## Specific Line Edits

   Original:
   > [Exact quote from draft]

   Suggested:
   > [Improved version]

   Why: [Explanation]

   ## Questions to Consider
   - [Thought-provoking question 1]
   - [Thought-provoking question 2]

   Ready to move to next section!
   ```

6. **Preserve Writer's Voice**

   Key principles:

   - **Learn their style**: Study existing writing samples
   - **Suggest, don't replace**: Offer options rather than directives
   - **Match tone**: Formal, casual, technical, friendly
   - **Respect choices**: If they prefer their own version, support that decision
   - **Enhance, don't override**: Improve their writing without changing its character

   Check in periodically:
   - "Does this sound like you?"
   - "Is this the right tone?"
   - "Should I be more/less [formal/casual/technical]?"

7. **Citation Management**

   Handle references according to user preference:

   **Inline Citations**:
   ```markdown
   Studies show 40% productivity improvement (McKinsey, 2024).
   ```

   **Numbered References**:
   ```markdown
   Studies show 40% productivity improvement [1].

   [1] McKinsey Global Institute. (2024)...
   ```

   **Footnote Style**:
   ```markdown
   Studies show 40% productivity improvement^1

   ^1: McKinsey Global Institute. (2024)...
   ```

   Keep a running citations list:
   ```markdown
   ## References

   1. Author. (Year). "Title". Publication.
   2. Author. (Year). "Title". Publication.
   ...
   ```

8. **Final Review and Polish**

   When the draft is complete, deliver comprehensive feedback:

   ```markdown
   # Full Draft Review

   ## Overall Assessment

   **Strengths**:
   - [Major strength 1]
   - [Major strength 2]
   - [Major strength 3]

   **Impact**: [Overall effectiveness assessment]

   ## Structure & Flow
   - [Comments on organization]
   - [Transition quality]
   - [Pacing assessment]

   ## Content Quality
   - [Argument strength]
   - [Evidence sufficiency]
   - [Example effectiveness]

   ## Technical Quality
   - Grammar and mechanics: [assessment]
   - Consistency: [assessment]
   - Citations: [completeness check]

   ## Readability
   - Clarity score: [evaluation]
   - Sentence variety: [evaluation]
   - Paragraph length: [evaluation]

   ## Final Polish Suggestions

   1. **Introduction**: [Specific improvements]
   2. **Body**: [Specific improvements]
   3. **Conclusion**: [Specific improvements]
   4. **Title**: [Options if needed]

   ## Pre-Publish Checklist
   - [ ] All claims sourced
   - [ ] Citations formatted
   - [ ] Examples clear
   - [ ] Transitions smooth
   - [ ] Call to action present
   - [ ] Proofread for typos

   Ready to publish! 🚀
   ```

## Examples

### Example 1: Teresa Torres's Workflow

**User**: "I'm writing an article about continuous discovery. Help me create an outline."

**Process**:
1. Collaborates on outline structure
2. Identifies research needs
3. User begins writing the introduction
4. Reviews and strengthens the hook
5. User writes each section
6. Delivers feedback after each section
7. Conducts research and adds citations
8. Final review of the complete draft
9. Polish and prepare for publishing

**Result**: A well-researched, properly cited article written in Teresa's voice with solid structure and flow.

### Example 2: Research-Heavy Article

**User**: "I'm writing about AI's impact on product management. Help me find current data and examples."

**Output**:
```markdown
## Research Compiled

### Recent Data
- Gartner: 80% of PMs will use AI tools by 2025 [1]
- Survey: 45% report faster feature shipping [2]
- Case study: Airbnb's AI-assisted prioritization [3]

### Expert Quotes
- "AI amplifies PM judgment, not replaces it" - Marty Cagan
- [Additional quotes with citations]

### Real Examples
1. **Company A**: Used AI for user research synthesis
   - Result: 60% time savings
   - Source: [citation]

2. **Company B**: AI-powered roadmap analysis
   - Result: Better stakeholder alignment
   - Source: [citation]

All added to your outline with proper citations.
```

### Example 3: Hook Improvement

**User's Original Hook**:
> "Product management is changing because of AI. In this article, I'll discuss some ways AI affects product managers."

**Stronger Alternatives**:

**Option 1 (Data-driven)**:
> "Last month, I asked AI to analyze 500 customer interviews. It took 30 minutes instead of 3 weeks. Product management will never be the same."

**Option 2 (Question)**:
> "What if you could talk to every customer, read every review, and analyze every support ticket—all before your morning coffee?"

**Option 3 (Story)**:
> "Sarah spent two weeks building the wrong feature. Not because she didn't understand her users, but because she couldn't process the hundreds of interviews fast enough to spot the pattern."

### Example 4: Section Feedback

**User**: "Just finished my 'Common Mistakes' section. Thoughts?"

**Response**:
```markdown
# Feedback: Common Mistakes Section

## What Works Well ✓
- Strong examples (the Slack notification story)
- Clear structure (3 mistakes, clean layout)
- Practical advice for each mistake

## Suggestions

### Make It More Specific
Your second point says "Bad prioritization" but could be stronger:

Current:
> "Many teams prioritize badly by focusing on features instead of outcomes."

Suggested:
> "I've watched teams ship 14 features in a quarter yet move none of their key metrics. They prioritized activity over progress."

### Add Data
The third mistake would benefit from evidence:
> "[Add citation]: Studies show teams without regular user contact are 3x more likely to build unused features [needs source]"

### Flow Improvement
Consider reordering: Mistake 3 → Mistake 2 → Mistake 1
This builds from small to big impact.

Ready for the next section!
```

## Writing Workflows

### Blog Post Workflow
1. Build the outline together
2. Research key points
3. Write introduction → receive feedback
4. Write body sections → feedback on each
5. Write conclusion → final review
6. Polish and edit

### Newsletter Workflow
1. Explore hook ideas
2. Develop a quick outline (shorter format)
3. Draft in a single session
4. Review for clarity and links
5. Quick polish

### Technical Tutorial Workflow
1. Outline the steps
2. Write code examples
3. Add explanations
4. Test the instructions
5. Add a troubleshooting section
6. Final review for accuracy

### Thought Leadership Workflow
1. Brainstorm a distinctive angle
2. Survey existing perspectives
3. Develop your thesis
4. Write with a strong point of view
5. Add supporting evidence
6. Craft a compelling conclusion

## Pro Tips

1. **Work in VS Code**: More effective than web chat for long-form writing
2. **One section at a time**: Collect feedback incrementally
3. **Save research separately**: Maintain a research.md file
4. **Version your drafts**: article-v1.md, article-v2.md, etc.
5. **Read aloud**: Use feedback to identify awkward sentences
6. **Set deadlines**: "I want to finish the draft today"
7. **Take breaks**: Write, get feedback, pause, revise

## File Organization

Recommended structure for writing projects:

```
~/writing/article-name/
├── outline.md          # Your outline
├── research.md         # All research and citations
├── draft-v1.md         # First draft
├── draft-v2.md         # Revised draft
├── final.md            # Publication-ready
├── feedback.md         # Collected feedback
└── sources/            # Reference materials
    ├── study1.pdf
    └── article2.md
```

## Best Practices

### For Research
- Validate sources before citing them
- Prioritize recent data where possible
- Represent multiple perspectives
- Link directly to original sources

### For Feedback
- Be specific about what you need: "Is this too technical?"
- Raise your concerns: "I'm worried this section drags"
- Ask questions: "Does this flow logically?"
- Request alternatives: "What's another way to explain this?"

### For Voice
- Share samples of your existing writing
- Specify your tone preferences
- Call out good matches: "That sounds like me!"
- Flag mismatches: "Too formal for my style"

## Related Use Cases

- Creating social media posts from articles
- Adapting content for different audiences
- Writing email newsletters
- Drafting technical documentation
- Creating presentation content
- Writing case studies
- Developing course outlines
