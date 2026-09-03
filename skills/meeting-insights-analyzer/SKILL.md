---
name: meeting-insights-analyzer
description: >-
  Processes meeting transcripts and recordings to surface behavioral patterns,
  communication insights, and actionable feedback. Detects conflict avoidance,
  filler word usage, conversation dominance, and missed listening opportunities.
  Ideal for professionals who want to strengthen their communication and
  leadership capabilities.
metadata:
  category: business
  source:
    repository: 'https://github.com/ComposioHQ/awesome-claude-skills'
    path: meeting-insights-analyzer
    commit: 92568c1edaff1bde5371154f036d959346c145a8
license: NOASSERTION
---

# Meeting Insights Analyzer

This skill converts your meeting transcripts into actionable insights about your communication patterns, supporting your growth as a more effective communicator and leader.

## When to Use This Skill

- Examining your communication patterns across multiple meetings
- Receiving feedback on your leadership and facilitation style
- Pinpointing when you avoid difficult conversations
- Understanding your speaking habits and filler word usage
- Monitoring progress in communication skills over time
- Building concrete examples for performance reviews
- Providing coaching to team members on their communication style

## What This Skill Does

1. **Pattern Recognition**: Spots recurring behaviors across meetings, including:
   - Conflict avoidance and indirect communication
   - Speaking ratios and turn-taking dynamics
   - Question-asking versus statement-making patterns
   - Indicators of active listening
   - Decision-making approaches

2. **Communication Analysis**: Assesses communication effectiveness across:
   - Clarity and directness
   - Filler word and hedging language usage
   - Tone and sentiment patterns
   - Meeting control and facilitation quality

3. **Actionable Feedback**: Delivers specific, timestamped examples covering:
   - What occurred
   - Why it matters
   - How to improve

4. **Trend Tracking**: Compares patterns across time when multiple meetings are analyzed

## How to Use

### Basic Setup

1. Download your meeting transcripts into a folder (e.g., `~/meetings/`)
2. Open that folder in Sypha
3. Request the analysis you need

### Quick Start Examples

```
Analyze all meetings in this folder and tell me when I avoided conflict.
```

```
Look at my meetings from the past month and identify my communication patterns.
```

```
Compare my facilitation style between these two meeting folders.
```

### Advanced Analysis

```
Analyze all transcripts in this folder and:
1. Identify when I interrupted others
2. Calculate my speaking ratio
3. Find moments I avoided giving direct feedback
4. Track my use of filler words
5. Show examples of good active listening
```

## Instructions

When a user requests meeting analysis:

1. **Discover Available Data**
   - Scan the folder for transcript files (.txt, .md, .vtt, .srt, .docx)
   - Verify whether files include speaker labels and timestamps
   - Establish the date range covered by the meetings
   - Identify the user's name or identifier within the transcripts

2. **Clarify Analysis Goals**

   If not specified, ask what the user wants to learn about:
   - Specific behaviors (conflict avoidance, interruptions, filler words)
   - Communication effectiveness (clarity, directness, listening)
   - Meeting facilitation skills
   - Speaking patterns and ratios
   - Areas with the most room for growth

3. **Analyze Patterns**

   For each requested insight:

   **Conflict Avoidance**:
   - Watch for hedging language ("maybe", "kind of", "I think")
   - Indirect phrasing where direct requests would be more effective
   - Subject changes when tension surfaces
   - Non-committal agreement ("yeah, but...")
   - Failure to address obvious problems

   **Speaking Ratios**:
   - Compute the percentage of meeting time spent speaking
   - Count interruptions both made and received by the user
   - Measure average speaking turn length
   - Track the ratio of questions to statements

   **Filler Words**:
   - Tally occurrences of "um", "uh", "like", "you know", "actually", etc.
   - Record frequency per minute or per speaking turn
   - Note circumstances where filler words spike (nervousness, uncertainty)

   **Active Listening**:
   - Questions that reference earlier points made by others
   - Paraphrasing or summarizing others' ideas
   - Building on contributions from other participants
   - Asking clarifying questions

   **Leadership & Facilitation**:
   - Decision-making style (directive versus collaborative)
   - How disagreements are navigated
   - Whether quieter participants are brought into the conversation
   - Time management and agenda adherence
   - Clarity of follow-ups and action items

4. **Provide Specific Examples**

   For each identified pattern, include:

   ```markdown
   ### [Pattern Name]

   **Finding**: [One-sentence summary of the pattern]

   **Frequency**: [X times across Y meetings]

   **Examples**:

   1. **[Meeting Name/Date]** - [Timestamp]

      **What Happened**:
      > [Actual quote from transcript]

      **Why This Matters**:
      [Explanation of the impact or missed opportunity]

      **Better Approach**:
      [Specific alternative phrasing or behavior]

   [Repeat for 2-3 strongest examples]
   ```

5. **Synthesize Insights**

   Once all patterns have been analyzed, deliver:

   ```markdown
   # Meeting Insights Summary

   **Analysis Period**: [Date range]
   **Meetings Analyzed**: [X meetings]
   **Total Duration**: [X hours]

   ## Key Patterns Identified

   ### 1. [Primary Pattern]
   - **Observed**: [What you saw]
   - **Impact**: [Why it matters]
   - **Recommendation**: [How to improve]

   ### 2. [Second Pattern]
   [Same structure]

   ## Communication Strengths

   1. [Strength 1 with example]
   2. [Strength 2 with example]
   3. [Strength 3 with example]

   ## Growth Opportunities

   1. **[Area 1]**: [Specific, actionable advice]
   2. **[Area 2]**: [Specific, actionable advice]
   3. **[Area 3]**: [Specific, actionable advice]

   ## Speaking Statistics

   - Average speaking time: [X% of meeting]
   - Questions asked: [X per meeting average]
   - Filler words: [X per minute]
   - Interruptions: [X given / Y received per meeting]

   ## Next Steps

   [3-5 concrete actions to improve communication]
   ```

6. **Offer Follow-Up Options**
   - Continue tracking the same metrics in future meetings
   - Conduct a deeper examination of particular meetings or patterns
   - Benchmark results against industry norms
   - Build a personal communication development plan
   - Produce a summary suitable for performance reviews

## Examples

### Example 1: Conflict Avoidance Analysis (Inspired by Dan Shipper)

**User**: "I download all of my meeting recordings and put them in a folder. Show me every time I subtly avoided conflict."

**Output**:
```markdown
# Conflict Avoidance Patterns

Found 23 instances across 15 meetings where you used indirect
communication or avoided addressing tensions directly.

## Pattern: Hedging on Critical Feedback

**Frequency**: 8 times across 7 meetings

**Example 1: 1:1 with Sarah** - 00:14:32

**What Happened**:
> "So, I was thinking... maybe we could, like, potentially
> consider looking at the timeline again? I mean, if you
> think that makes sense. But whatever you think is best!"

**Why This Matters**:
You needed to address that Sarah's project was behind schedule,
but the hedging language ("maybe", "potentially", "if you think")
and the deflection at the end ("whatever you think") made it easy
for her to miss the urgency.

**Better Approach**:
"Sarah, the project is two weeks behind schedule. We need to
discuss what's blocking progress and create a new timeline
today."

[Additional examples...]

## Recommendations

1. **Name the issue directly** in the first sentence
2. **Remove hedging words** like "maybe," "kind of," "sort of"
3. **Ask specific questions** instead of hinting
4. **Schedule difficult conversations** instead of raising them casually
```

### Example 2: Leadership Facilitation

**User**: "Analyze my team meetings and tell me about my facilitation style."

**Output**: Delivers insights on:
- Your share of speaking time versus your team members (60% vs. 40%)
- Whether you lean toward asking questions or making statements (3:1 ratio)
- How you manage disagreements (a tendency to resolve them too hastily)
- Which participants speak least and whether you draw them into the discussion
- Examples of effective and missed facilitation moments

### Example 3: Personal Development Tracking

**User**: "Compare my meetings from Q1 vs. Q2 to see if I've improved my listening skills."

**Output**: Produces a comparative analysis that shows:
- Reduction in interruptions (8 per meeting → 3 per meeting)
- Growth in clarifying questions asked (2 → 7 per meeting)
- Progress in building on others' contributions
- Concrete examples illustrating the change
- Areas that still require improvement

## Setup Tips

### Getting Meeting Transcripts

**From Granola** (free with Lenny's newsletter subscription):
- Granola automatically transcribes your meetings
- Export transcripts to a folder: [Instructions on how]
- Direct Sypha to that folder

**From Zoom**:
- Enable cloud recording with transcription turned on
- Download VTT or SRT files after each meeting
- Save them to a dedicated folder

**From Google Meet**:
- Use Google Docs auto-transcription
- Save the transcript documents to a folder
- Download as .txt files or grant Sypha access directly

**From Fireflies.ai, Otter.ai, etc.**:
- Bulk-export your transcripts
- Save them to a local folder
- Run your analysis against that folder

### Best Practices

1. **Consistent naming**: Follow the `YYYY-MM-DD - Meeting Name.txt` format
2. **Regular analysis**: Review results monthly or quarterly to spot trends
3. **Specific queries**: Query one behavior at a time to get deeper results
4. **Privacy**: Keep sensitive meeting data stored locally
5. **Action-oriented**: Concentrate on a single improvement area at a time

## Common Analysis Requests

- "When do I avoid difficult conversations?"
- "How often do I interrupt others?"
- "What's my speaking vs. listening ratio?"
- "Do I ask good questions?"
- "How do I handle disagreement?"
- "Am I inclusive of all voices?"
- "Do I use too many filler words?"
- "How clear are my action items?"
- "Do I stay on agenda or get sidetracked?"
- "How has my communication changed over time?"

## Related Use Cases

- Assembling a personal development plan based on the insights
- Compiling performance review materials backed by concrete examples
- Coaching direct reports on their communication habits
- Reviewing customer calls to identify sales or support patterns
- Examining negotiation tactics and their outcomes
