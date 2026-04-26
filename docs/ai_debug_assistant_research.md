---
title: AI Debug Assistant & Session Memory Research
scope: architectural proposal, AI integration
audience: [Product_Architect, Human Engineer]
---

# AI Debug Assistant with Session Memory Research

## 1. Concept Overview

The **AI Debug Assistant** aims to augment the traditional debugging experience by providing an LLM-powered assistant that is contextually aware of the current `DapSessionService` state.

**"Session Memory"** refers to the AI's ability to:
1. **Track Execution Flow**: Remember previous pause locations, variable values, and error states over time, rather than just observing a single snapshot.
2. **Contextual Continuity**: Maintain conversation history that is inherently linked to specific debug sessions or program crashes.
3. **Hypothesis Generation**: Analyze the sequence of state changes (e.g., how a variable mutated over 5 steps) to identify the root cause of complex logic errors or memory corruption.

## 2. Architectural Integration

To adhere to the core architectural axioms (Strict Three-Layer Pattern), the AI integration must be carefully designed:

### UI Layer (`@taro/ui-ai`)

- **AI Chat Panel**: A new component (potentially in a new Right Sidenav or a dedicated tab in the consolidated Left Sidenav) for conversation.
- **Inline Editor Lenses**: `ngx-monaco-editor-v2` integrations to show AI suggestions directly above function signatures or problematic lines.
- **Explain This**: Context menu actions in the Variables, Call Stack, and Memory views to instantly query the AI about specific states.

### Session Layer (`AiContextService`)

- Must observe the `DapSessionService` (`executionState$`, `threads$`, `variables$`) without mutating it directly.
- **State Checkpointing**: Automatically capture the Call Stack, local variables, and current source line upon every `stopped` event.
- **Memory Vectorization (Future)**: Compress and store session history (checkpoints) to allow the LLM to query past states efficiently.

### Transport Layer (`AiTransportService`)

- Decoupled from DAP WebSocket.
- Connects via REST/gRPC to the AI Provider (Local models via Ollama/LM Studio, or cloud providers).

## 3. DAP Protocol Hooks

The assistant requires deep integration with DAP events to build its session memory:
- `stopped`: Trigger automatic state capture. Retrieve `threads`, `stackTrace`, `scopes`, and `variables` to build the current context snapshot.
- `output`: Capture `stderr` or console logs to provide error context to the LLM.
- `evaluate`: Allow the AI to proactively evaluate expressions in the debuggee context to verify its own hypotheses.

## 4. Roadmap Alignment Proposal

Currently, the `future-roadmap.md` focuses heavily on core debugging primitives for v1.1 (Memory View, Non-Stop Mode, UI Standardization, Sidenav Consolidation).

**Recommendation:**
The AI Debug Assistant represents a massive architectural addition. It should be scheduled for **Milestone v2.0** or a dedicated **v1.5 (AI capabilities)** epic.

### Proposed Milestones

#### Phase 1: Foundation (v1.x)

- **WI-XX**: Implement `AiContextService` to passively observe and checkpoint DAP state changes.
- **WI-XY**: Add "Explain this Variable" and "Explain this Crash" context menus that generate static prompts for external copy-pasting.

#### Phase 2: Integration (v2.0)

- **WI-XZ**: Implement `AiTransportService` for local/remote LLM connections.
- **WI-XA**: Build the integrated AI Chat Panel UI within the debugger layout.
- **WI-XB**: Implement "Session Memory" allowing the LLM to query the history of state checkpoints.

## 5. Deep Dive: Debug Context Memory

To make the AI genuinely useful (not just a generic chatbot), it requires highly structured **Debug Context Memory**. This is categorized into three dimensions:

### A. Memory Dimensions

1. **Spatial Context (Current State)**: The immediate snapshot when execution pauses. Includes the current AST/source line, active thread ID, call stack frames, and the evaluated tree of local variables in the current scope.
2. **Temporal Context (Historical State)**: A sliding window (ring buffer) of the last N `stopped` events. This allows the AI to answer: *"How did `ptr` become null over the last 3 step-overs?"*
3. **Session Context (Global State)**: Environment metadata, launch configuration (`launch.json` equivalents), OS architecture, and cumulative `stdout`/`stderr` logs.

### B. Serialization & Token Management

LLMs have strict token limits. We cannot dump raw DAP JSON payloads directly into the prompt. The `AiContextMemoryService` must implement a **Context Serializer**:
- **Pruning**: Only serialize variables that are expanded in the UI or explicitly tracked/watched.
- **Diffing**: Instead of sending full snapshots every step, serialize state changes (e.g., `[Step 4] 'counter' mutated from 0 -> 1`).
- **Code Context**: Fetch surrounding code via the Monaco Editor model (`+/- 10 lines` around the active breakpoint) rather than sending the entire source file.

### C. Advanced Retrieval (Future)

For long-running sessions, a simple ring buffer will overflow context windows. We would eventually introduce a local **Vector Store (RAG)**. The debugger would embed each `stopped` snapshot, allowing the LLM to execute queries like: *"Find the last time `socket_fd` was > 0."*

## 6. Formal Verification Capabilities

Bridging dynamic debugging (DAP) with formal verification allows the AI Assistant to translate live debugger states into mathematical formal languages. This enables the Assistant to mathematically prove the presence of bugs, verify memory safety, and validate execution paths in C/C++ applications, moving beyond probabilistic text generation.

### Layer Responsibilities

The AI Assistant acts as a Formal Verification Bridge between the DAP state and mathematical solvers:

1. **Extraction Layer**: Pulls live runtime context (Memory, Variables, Registers) from the DAP session (`variablesRequest`, `readMemoryRequest`).
2. **Translation Layer**: Converts the raw C/C++ state into a formal language (e.g., SMT-LIB, Separation Logic).
3. **Solver Layer**: Feeds the formal script into a background theorem solver (e.g., Z3).
4. **Reporting Layer**: Interprets the mathematical proof and surfaces the exact root cause in the UI.

### Translation Contracts

#### Separation Logic (Heap Memory & Pointers)

- **Target Domain**: Memory safety, use-after-free, overlapping buffers.
- **Translation Contract**: Converts DAP `readMemoryRequest` buffers into Separation Logic assertions. `{ (p ↦ x) * (q ↦ y) }` verifies pointer `p` and `q` exist in strictly disjoint memory regions.

#### SMT-LIB v2 (Satisfiability Modulo Theories)

- **Target Domain**: Reachability, bounds checking, variable constraints.
- **Translation Contract**: Converts Call Stack and Variables into S-expressions for SMT solvers.

    ```lisp
    ;; Define state
    (declare-const array_index Int)
    (declare-const buffer_capacity Int)
    (assert (= buffer_capacity 256))
    
    ;; Assert paused state
    (assert (= array_index 300))
    
    ;; Define crash condition
    (assert (>= array_index buffer_capacity))
    
    ;; Prove satisfiability
    (check-sat)
    ```

#### Linear Temporal Logic (LTL)

- **Target Domain**: Multi-threaded behavior, race conditions, deadlocks.
- **Translation Contract**: Maps DAP `thread` and `step` events to temporal operators. For example, validating `G (mutex_acquired → F mutex_released)`.

#### Hoare Logic

- **Target Domain**: Function preconditions and postconditions.
- **Translation Contract**: Evaluates runtime variables against preconditions (`{ x > 0 }`).

### Constraints & Exclusions

- **Execution Time**: Formal verification tasks must run asynchronously and not block the main DAP UI thread.
- **Exclusions**: This integration does not cover modifying the source code directly; it is solely focused on state proof generation. It does not replace standard step-debugging for users who prefer manual inspection.

---
*Please review this research. If the conceptual boundaries and roadmap alignment are acceptable, we can proceed to formally define the Work Items and Feature Group.*
