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
- Serverless project share bridge: `#writex-project=<encoded WriteX project payload>`
- Result channel: listen for `writex-agent-result` or read `window.writexAgentLastResult`
- DOM result channel: read JSON from `#writex-agent-result`
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
Apri http://localhost:5173/scribyx/. Leggi link[rel="agent-tools"]. Se window.writexAgent e visibile, usa window.writexAgent.callTool(name,args). Se window.writexAgent risulta undefined, e normale in contesti isolati: usa #writex-agent=<JSON encoded> e leggi JSON da #writex-agent-result. Non scrivere nel DOM o nell'editor manualmente salvo fallback estremo.
```

The runtime source of truth is still `listTools()`, because it is shipped with the same code that executes the operations.

## Browser Bridges

## First-Time Agent Protocol

Generic browser agents should not assume that `page.evaluate()` runs in the same JavaScript world as the app. The direct global can be invisible even when the bridge is correctly installed.

Use this order:

1. Read the static manifest from `link[rel="agent-tools"]`.
2. Open the app page.
3. Try direct `window.writexAgent` only as a capability check.
4. If direct access is unavailable, send commands by navigating to `#writex-agent=<encoded JSON>`.
5. Wait for `#writex-agent-result`.
6. Parse `document.querySelector('#writex-agent-result').textContent`.
7. Avoid UI/contenteditable automation unless the agent API is unavailable.

Minimal smoke test:

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

Read:

```js
JSON.parse(document.querySelector('#writex-agent-result')?.textContent ?? 'null')
```

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
It also writes the same result as JSON into `#writex-agent-result`, which is useful for browser agents that execute JavaScript in an isolated context and cannot reliably see page globals.

## Serverless Share Links

For sharing a story without a server, create a link that stores the exported project in the URL hash. The hash fragment stays in the browser and is not sent to the web host.

```js
const share = await window.writexAgent.callTool('createShareLink', {})
console.log(share.data.url)
```

When another person opens that URL, WriteX reads `#writex-project=...`, imports the embedded project into that browser's local IndexedDB, and publishes the result through `writex-agent-result`.

Very large projects can produce very long URLs. Some browsers, chats, or email clients may truncate them.

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
const share = await window.writexAgent.callTool('createShareLink', {})
```
