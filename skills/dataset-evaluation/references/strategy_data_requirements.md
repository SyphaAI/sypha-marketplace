# Finetuning Strategy Data Requirements

**Critical** Nova models use a different set of formats from open weights models. Always consult the correct section based on the user's base model.

## Open Weights Models Data Format by Strategy (Llama, Qwen, GPT-OSS, etc.)

### SFT (Supervised Fine-Tuning)

**Required format:**

```jsonl
{
  "prompt": "",
  "completion": ""
}
```

**What it needs:**

- Input-output pairs
- A single "correct" response per input
- Uniform quality across all examples

### DPO (Direct Preference Optimization)

**Required format:**

```jsonl
{
  "prompt": "",
  "chosen": "",
  "rejected": ""
}
```

**What it needs:**

- An input paired with two responses: preferred (chosen) and dispreferred (rejected)
- A clear preference signal between the two responses
- Both responses should be plausible, with one being distinctly better
- Care taken to avoid unintentional length bias

### RLVR (Reinforcement Learning from Verifiable Rewards)

**Required format:**

```jsonl
{
  "data_source": "",
  "prompt": [
    {
      "content": "",
      "role": ""
    }
  ],
  "ability": "",
  "reward_model": {
    "ground_truth": "",
    "style": ""
  }
}
```

**What it needs:**

- User prompt
- Ground truth responses in the `reward_model.ground_truth` field (leave empty if the data does not include responses)

**How it works:**

1. The model generates a response for the input
2. Lambda receives the full user prompt plus reward model fields
3. Lambda computes a reward (using ground_truth when present in the verification logic)
4. The model trains to maximize the reward

### RLAIF (Reinforcement Learning from AI Feedback)

RLAIF shares the same base schema as RLVR. The `ability` and `reward_model.style` fields control which evaluator is selected.

**Base schema:**

```jsonl
{
  "data_source": "",
  "prompt": [
    {
      "role": "",
      "content": ""
    }
  ],
  "ability": "",
  "reward_model": {
    "style": "",
    "ground_truth": ""
  }
}
```

#### Built-in Evaluators

| `ability`          | `reward_model.style` | Use case                                             |
| ------------------ | -------------------- | ---------------------------------------------------- |
| `pairwise-judging` | `llmj`               | Compare two model responses and pick the better one  |
| `chain-of-thought` | `llmj-cot`           | Evaluate quality of step-by-step reasoning           |
| `faithfulness`     | `llmj-faithfulness`  | Check if response stays grounded in provided context |
| `summarization`    | `llmj-summarization` | Evaluate quality of a generated summary              |

**`pairwise-judging` — prompt must include both responses to compare; `ground_truth` is the preferred response index + reasoning.**

**`chain-of-thought` / `faithfulness` / `summarization` — prompt contains the task; `ground_truth` is the reference answer or source text.**

#### Custom Evaluator

Set `reward_model.style` to `llmj-custom` and provide a Jinja2 prompt template. The template receives `{{ prompt }}`, `{{ response }}`, and optional `{{ ground_truth }}` as variables. The LLM judge must return a JSON object containing a `score` field (0.0–1.0).

```jsonl
{
  "data_source": "",
  "prompt": [
    {
      "role": "user",
      "content": ""
    }
  ],
  "ability": "chain-of-thought",
  "reward_model": {
    "style": "llmj-custom",
    "ground_truth": ""
  }
}
```

The custom Jinja prompt is supplied separately at training time (not embedded in the dataset). It must direct the judge to return exactly: `{"score": <0.0-1.0>, ...}`.

---

## Nova Models Data Format by Strategy

### SFT (Supervised Fine-Tuning)

```jsonl
{
  "schemaVersion": "bedrock-conversation-2024",
  "system": [
    {
      "text": ""
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "text": ""
        }
      ]
    },
    {
      "role": "assistant",
      "content": [
        {
          "text": ""
        }
      ]
    }
  ]
}
```

### DPO (Direct Preference Optimization)

The format mirrors SFT for the first N-1 turns. The final assistant turn replaces regular `content` with `candidates` that include a `preferenceLabel`.

```jsonl
{
  "schemaVersion": "bedrock-conversation-2024",
  "system": [
    {
      "text": ""
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "text": ""
        }
      ]
    },
    {
      "role": "assistant",
      "candidates": [
        {
          "content": [
            {
              "text": ""
            }
          ],
          "preferenceLabel": "preferred"
        },
        {
          "content": [
            {
              "text": ""
            }
          ],
          "preferenceLabel": "non-preferred"
        }
      ]
    }
  ]
}
```

### RLVR

```jsonl
{
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "Hello!"
    }
  ],
  "reference_answer": {
    "answer": "49"
  }
}
```
