# Design System Form Factor Considerations

For the AI-assisted design system, the form factor decision depends on:

| Factor     | Skill                           | MCP Server                      | Dedicated Agent           |
|------------|---------------------------------|---------------------------------|---------------------------|
| Invocation | Auto-activated by context       | Explicit tool calls             | Autonomous task execution |
| State      | Stateless per invocation        | Can maintain session state      | Persistent memory/goals   |
| Scope      | File generation, pattern lookup | Tool execution, resource access | Multi-step workflows      |
| Control    | Claude Code orchestrates        | Host app orchestrates           | Agent self-orchestrates   |
| Like       | Current design-system           | Current workbench MCP           | HuggingFace TinyAgent     |

## Questions to Clarify Form Factor

1. **Autonomy level**: Should it scaffold files on request (skill), or autonomously iterate on designs based on feedback (agent)?

2. **Statefulness**: Does it need to remember previous design decisions across sessions (agent) or work fresh each time (skill/MCP)?

3. **Multi-step workflows**: Simple "generate token file" (skill/MCP) vs "analyze design system, propose improvements, implement changes" (agent)?

4. **External integrations**: Does it need to call external APIs (Figma, design tools)? MCP servers excel at this.

## HuggingFace TinyAgent Pattern

A dedicated agent makes sense if you want:
- Goal-directed behavior ("build a complete design system for this app")
- Iterative refinement with feedback loops
- Memory of design decisions and constraints
- Autonomous exploration of the codebase
