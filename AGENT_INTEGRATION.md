# WriteX Agent Integration

WriteX exposes a browser-side tool API for external agents.

Agents should not create `.writexproj` files by hand. They should open the running app, inspect the tool list, and call tools through the dispatcher:

```js
await window.writexAgent.listTools()
await window.writexAgent.callTool('createChapter', {
  title: 'Capitolo 1',
  body: 'Anna entra nella serra.'
})
```

## Runtime Contract

- Browser global: `window.writexAgent`
- Tool discovery: `window.writexAgent.listTools()`
- Single dispatcher: `window.writexAgent.callTool(name, args)`
- Message bridge: `window.postMessage({ type: 'writex-agent-call', id, name, args }, window.location.origin)`
- DOM event bridge: `window.dispatchEvent(new CustomEvent('writex-agent-call', { detail: { id, name, args } }))`
- URL hash bridge: `#writex-agent=<encoded JSON { id, name, args }>`
- Result channel: listen for `writex-agent-result` or read `window.writexAgentLastResult`
- Storage: IndexedDB document `NarrativeDB.documents.main-workspace`
- Export format: `.writexproj`

The static manifest is available at:

```txt
/writex-agent-tool.json
```

With the Vite base path used by this app, the local URL is usually:

```txt
http://localhost:5173/scribyx/writex-agent-tool.json
```

When prompting a generic coding/browser agent, explicitly mention the bridge:

```txt
Apri http://localhost:5173/scribyx/. Non scrivere nel DOM manualmente: usa window.writexAgent.listTools() e window.writexAgent.callTool(name,args) per creare capitoli, entita, link e commit.
```

The runtime source of truth is still `listTools()`, because it is shipped with the same code that executes the operations.

## Browser Bridges

The direct global is simplest when the agent can execute JavaScript in the page:

```js
await window.writexAgent.callTool('getProject', {})
```

For agents that communicate by page messages:

```js
window.addEventListener('writex-agent-result', event => {
  console.log(event.detail)
})

window.postMessage({
  type: 'writex-agent-call',
  id: 'cmd-1',
  name: 'createChapter',
  args: {
    title: 'Capitolo 1',
    body: 'Anna entra nella serra.',
  },
}, window.location.origin)
```

For simple URL-driven calls:

```js
const command = {
  id: 'cmd-2',
  name: 'commitGlobal',
  args: { label: 'Bozza completa' },
}

location.hash = 'writex-agent=' + encodeURIComponent(JSON.stringify(command))
```

The page publishes the result on `writex-agent-result` and stores the last result in `window.writexAgentLastResult`.

## Recommended Agent Flow

1. Open the WriteX app in a browser.
2. Call `listTools()` and read `description`, `whenToUse`, and `parameters`.
3. Call `getProject` before edits to resolve ids.
4. Create or update content through tools like `createChapter`, `createEntity`, `linkText`, `createGraphSnapshot`, `addGraphNode`, and `addGraphEdge`.
5. Create chapter commits with `commitChapter`.
6. Create project commits with `commitGlobal`.
7. Call `exportProject` only when the final `.writexproj` payload is needed.

## Example

```js
const tools = await window.writexAgent.listTools()
console.table(tools.data.map(tool => ({
  name: tool.name,
  when: tool.whenToUse,
})))

await window.writexAgent.callTool('setTitle', {
  title: 'La serra di vetro',
})

const chapter = await window.writexAgent.callTool('createChapter', {
  title: 'La porta chiusa',
  body: 'Anna trova una porta coperta di edera.',
})

const entity = await window.writexAgent.callTool('createEntity', {
  categoryId: 'cat-chars',
  name: 'Anna',
  avatar: 'An',
  desc: 'Una ragazza attenta ai dettagli.',
})

await window.writexAgent.callTool('linkText', {
  text: 'Anna',
  chapterId: chapter.data.id,
  entityIds: [entity.data.id],
})

await window.writexAgent.callTool('commitChapter', {
  chapterId: chapter.data.id,
  label: 'Prima bozza',
})

await window.writexAgent.callTool('commitGlobal', {
  label: 'Setup storia',
})

const exported = await window.writexAgent.callTool('exportProject', {})
```
