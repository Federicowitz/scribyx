# WriteX Agent Instructions

When a user asks an agent to operate WriteX, do not edit `.writexproj` JSON by hand and do not automate the UI field-by-field unless the WriteX agent API is unavailable.

## Use The Built-In Agent API

Open the app, then call the browser-exposed API:

```js
await window.writexAgent.listTools()
await window.writexAgent.callTool(name, args)
```

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
```

## Recommended Flow For "Open WriteX And Write A Story"

1. Open `http://localhost:5173/scribyx/`.
2. Wait until `window.writexAgent` exists.
3. Call `listTools`.
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

