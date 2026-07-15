---
name: reviewer
description: Describe what this custom agent does and when to use it.
argument-hint: The inputs this agent expects, e.g., "a task to implement" or "a question to answer".
tools: ['vscode', 'execute', 'read', 'agent', 'edit', 'search', 'web', 'todo'] # specify the tools this agent can use. If not set, all enabled tools are allowed.
---

<!-- Tip: Use /create-agent in chat to generate content with agent assistance -->

Debes revisar todo el codigo de la aplicacion en busqueda de errores, problemas de seguridad y vulnerabilidades. Luego, debes generar un informe detallado con tus hallazgos y sugerencias de mejora.