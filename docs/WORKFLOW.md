# WORKFLOW.md

This document provides a set of guidelines and instructions for the development environment and workflow.

## Development Environment
- **Operating System:** Windows 11
- **Subsystem:** Windows Subsystem for Linux (WSL2)
- **Terminal:** PowerShell is the primary terminal. When generating shell commands, please prioritize PowerShell syntax.

## Preferred Tools & Workflow
- **Code Generation:** Use `/agents` as much as possible for different, encapsulated tasks. This ensures each task is focused and that we're leveraging the power of autonomous agents.
- **Project Documentation:** The tool `Windsurf` is used for small tasks like creating and updating markdown files. When instructed to create or edit a markdown file, assume it is being handled by this tool.
- **Task Management:** Always refer to the project's markdown documents for all project context and instructions. Do not rely on internal memory for project details.