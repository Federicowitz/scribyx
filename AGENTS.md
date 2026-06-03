# WriteX Agent Instructions

When a user asks an agent to operate WriteX, do not edit `.writexproj` JSON by hand and do not automate the UI field-by-field unless the WriteX agent API is unavailable.

## Use The Built-In Agent API

Open the app, then use the built-in agent API. If the browser can see page globals, direct calls are fine:

```js
await window.writexAgent.listTools()
await window.writexAgent.callTool(name, args)
```

If `window.writexAgent` is `undefined` in browser automation, do not switch to UI editing. Some automation tools run JavaScript in an isolated world. Use the hash bridge and read the DOM result instead.

The static manifest is available from the running app:

```txt
/scribyx/writex-agent-tool.json
```

Source files:

```txt
src/agentApi.ts
src/agentToolDefinitions.ts
public/writex-agent-tool.json
AGENT_INTEGRATION.md
```

## Browser Bridge Options

Recommended first-time protocol for Playwright/DOM agents:

1. Open `http://localhost:5173/scribyx/`.
2. Read the manifest from `link[rel="agent-tools"]` or `/scribyx/writex-agent-tool.json`.
3. Try `window.writexAgent` only as a quick capability check.
4. If it is unavailable, use `#writex-agent=...` commands and read `#writex-agent-result`.
5. Do not automate the visible editor/contenteditable UI unless both bridges fail.

Direct call:

```js
await window.writexAgent.callTool('createChapter', {
  title: 'Capitolo 1',
  body: 'Testo del capitolo.',
})
```

PostMessage bridge:

```js
window.postMessage({
  type: 'writex-agent-call',
  id: 'cmd-1',
  name: 'createChapter',
  args: {
    title: 'Capitolo 1',
    body: 'Testo del capitolo.',
  },
}, window.location.origin)
```

DOM event bridge:

```js
window.dispatchEvent(new CustomEvent('writex-agent-call', {
  detail: {
    id: 'cmd-1',
    name: 'createChapter',
    args: {
      title: 'Capitolo 1',
      body: 'Testo del capitolo.',
    },
  },
}))
```

URL hash bridge:

```js
location.hash = 'writex-agent=' + encodeURIComponent(JSON.stringify({
  id: 'cmd-1',
  name: 'commitGlobal',
  args: { label: 'Bozza completa' },
}))
```

Results are published through:

```js
window.addEventListener('writex-agent-result', event => console.log(event.detail))
window.writexAgentLastResult
JSON.parse(document.querySelector('#writex-agent-result')?.textContent ?? 'null')
```

If the browser automation environment cannot see `window.writexAgent` directly, use the URL hash bridge instead of editing UI fields:

```js
const call = {
  type: 'writex-agent-call',
  id: 'cmd-1',
  name: 'createChapter',
  args: { title: 'Capitolo 1', body: 'Testo del capitolo.' },
}

location.hash = 'writex-agent=' + encodeURIComponent(JSON.stringify(call))
```

Then read the result from the DOM:

```js
JSON.parse(document.querySelector('#writex-agent-result')?.textContent ?? 'null')
```

Non-destructive smoke test for a new agent:

```js
const call = {
  type: 'writex-agent-call',
  id: 'smoke-get-project-1',
  name: 'getProject',
  args: {},
}

location.href = 'http://localhost:5173/scribyx/#writex-agent=' +
  encodeURIComponent(JSON.stringify(call))
```

Expected result:

```js
const result = JSON.parse(document.querySelector('#writex-agent-result')?.textContent ?? 'null')
result?.type === 'writex-agent-result' &&
  result.id === 'smoke-get-project-1' &&
  result.ok === true &&
  result.result?.ok === true
```

## Recommended Flow For "Open WriteX And Write A Story"

1. Open `http://localhost:5173/scribyx/`.
2. Select a working bridge: direct `window.writexAgent` if visible, otherwise hash bridge plus `#writex-agent-result`.
3. Call `listTools` through that bridge.
4. Call `setTitle`.
5. Call `createChapter` for each chapter.
6. Call `getProject` to resolve chapter ids and existing category ids.
7. Call `createEntity` for characters, places, or objects.
8. Call `linkText` to connect exact text fragments to entities.
9. Call `commitChapter` for each chapter.
10. Call `commitGlobal`.
11. Call `exportProject` if the user asks for an exported payload.

Example:

```js
await window.writexAgent.callTool('setTitle', { title: 'La chiave sotto il ponte' })

const c1 = await window.writexAgent.callTool('createChapter', {
  title: 'Il ponte',
  body: 'Mara e Nico trovano una chiave arrugginita sotto il ponte vecchio.',
})

const mara = await window.writexAgent.callTool('createEntity', {
  categoryId: 'cat-chars',
  name: 'Mara',
  avatar: 'Ma',
})

await window.writexAgent.callTool('linkText', {
  text: 'Mara',
  chapterId: c1.data.id,
  entityIds: [mara.data.id],
})

await window.writexAgent.callTool('commitChapter', {
  chapterId: c1.data.id,
  label: 'Prima bozza',
})

await window.writexAgent.callTool('commitGlobal', {
  label: 'Storia iniziale',
})
```
