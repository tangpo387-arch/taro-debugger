---
title: Project Code Style Guide
scope: code-style, linting, typescript, angular
audience: [Lead_Engineer, Quality_Control_Reviewer]
trigger: always_on
applies_to: ["*.ts", "*.scss", "*.html"]
description: Coding standards for taro-debugger-frontend source files (*.ts, *.scss, *.html).
---

# Project Code Style Guide

<guide_overview>
This document defines the development standards for the `taro-debugger-frontend` project, aiming to maintain code consistency, readability, and modern Angular best practices.

> **Scope**: Source files only (`*.ts`, `*.scss`, `*.html`). Markdown documents (`*.md`) are governed by the `doc-authoring` skill.
</guide_overview>

<naming_conventions>

## 1. Naming Conventions

### File Naming

* **File Name Format**: Always use `kebab-case`.
* **Suffix Conventions**:
  * Component: `*.component.ts`
  * Service: `*.service.ts`
  * Pipe: `*.pipe.ts`
  * Directive: `*.directive.ts`
  * Module/Config: `*.config.ts`, `*.routes.ts`
  * Unit Test: `*.spec.ts`
  * Type Definition: `*.types.ts`

### Class and Variable Naming

* **Classes/Interfaces**: Use `PascalCase` (e.g., `DebuggerComponent`, `DapSessionService`).
* **Variables and Methods**: Use `camelCase` (e.g., `executionState`, `ngOnInit()`, `startSession()`).
* **Constants**: Use `UPPER_SNAKE_CASE` (e.g., `DEFAULT_TIMEOUT`).
* **Observable Variables**: Suffix with `$` (e.g., `connectionStatus$`, `executionState$`).
</naming_conventions>

<angular_standards>

## 2. Angular Development Standards

### Component Structure

* **Standalone Components**: This project uses Angular 21+ **Standalone Components**. Do not use `NgModule` to declare components.
* **External Templates and Styles**: Component templates (`.html`) and styles (`.scss` or `.css`) must be kept separate from the `.ts` file.
* **Dependency Injection (DI)**: Prefer the modern `inject()` function over constructor injection.

    ```typescript
    private readonly configService = inject(DapConfigService);
    private readonly router = inject(Router);
    ```

</angular_standards>

<typescript_standards>

## 3. TypeScript Standards

### Strong Typing

* **Explicit Declarations**: Public properties and methods must explicitly declare their return types or data types.
* **Access Modifiers**: Always use explicit `public`, `private`, and `protected` modifiers. Injected services should default to `private readonly`.

### Asynchronous Handling

* **Async/Await**: For sequential async logic (e.g., the DAP handshake flow), prefer `async/await`.
* **RxJS**: For event streams (e.g., DAP event listeners) or state broadcasting, use `Observable`.
* **Conversion**: To convert an Observable to a Promise, use `firstValueFrom`.
</typescript_standards>

<language_and_documentation>

## 4. Language & Documentation

* **Global Language Policy**:
  * All **code comments**, **JSDoc**, and **UI display text** (text in templates) must be written in **US English**.
  * Chinese content is forbidden in `*.ts`, `*.scss`, and `*.html` files.
* **Comment Standards**:
  * **Logic Explanation**: Use **US English** for complex logic descriptions to facilitate understanding by international team members.
  * **JSDoc**: Use **English JSDoc** for public method and interface descriptions.
* **Code Section Dividers**: For longer services or components, use a clear separator to delineate logical blocks:

    ```typescript
    // ── Session Event Handling ─────────────────────────────────────────
    ```

</language_and_documentation>

<formatting_rules>

## 5. Formatting

* **Indentation**: 2 spaces.
* **Quotes**: Single quotes `'` (TypeScript/JavaScript), double quotes `"` (HTML).
* **Semicolons**: Required `;`.
* **Import Order**:
    1. Angular core and built-in modules (`@angular/*`)
    2. Third-party libraries (RxJS, Angular Material)
    3. Local project files
</formatting_rules>
