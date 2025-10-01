# 7. AI Orchestration Architecture

## LangChain + LangGraph Integration Strategy

The AI system leverages **LangChain** for LLM integration and **LangGraph** for complex, stateful AI workflows. This provides a modular design where complex tasks like post-read reflection are managed as state machines.

## AI Model Selection Strategy

- **Gemini 1.5 Flash Usage**: For quick, low-cost tasks like intent classification, simple recommendations, and basic data extraction.
- **Gemini 1.5 Pro Usage**: For complex, high-reasoning tasks like post-read reflection analysis, metadata enrichment, and detailed report generation.

## AI Workflow Examples

### Mood-Based Recommendation (Simple)

```mermaid
graph LR
    A[User: "I want something uplifting"] --> B[Flash: Intent Detection]
    B --> C[Vector Search: Books DB]
    C --> D[Flash: Generate Recommendation]
    D --> E[Response to User]
```

### Post-Read Reflection (Complex LangGraph)

```mermaid
graph TD
    A[User: "Finished reading X"] --> B[Start Reflection Workflow]
    B --> C[Flash: Generate Initial Questions]
    C --> D[Gather User Responses]
    D --> E{More Questions?}
    E -->|Yes| C
    E -->|No| F[Pro: Deep Analysis]
    F --> G[Update Preference Model]
    G --> H[Pro: Generate AI Rating]
    H --> I[Store Results & Complete]
```
