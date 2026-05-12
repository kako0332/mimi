import { BrowserWindow } from 'electron'
import { createServer, IncomingMessage, ServerResponse } from 'http'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number
  method: string
  params?: any
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: any
  error?: { code: number; message: string }
}

const MCP_TOOLS = [
  {
    name: 'set_expression',
    description: 'Set the pet expression',
    inputSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          enum: ['idle', 'happy', 'talking', 'sad', 'thinking', 'sleeping'],
          description: 'The expression to set'
        }
      },
      required: ['expression']
    }
  },
  {
    name: 'show_notification',
    description: 'Show a notification on the pet',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Notification title' },
        message: { type: 'string', description: 'Notification message' }
      },
      required: ['message']
    }
  },
  {
    name: 'display_message',
    description: 'Display a chat message from the pet (proactive message)',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The message to display' }
      },
      required: ['content']
    }
  },
  {
    name: 'change_theme',
    description: 'Change the pet skin color',
    inputSchema: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          enum: ['blue', 'pink', 'green', 'purple'],
          description: 'Theme color'
        }
      },
      required: ['theme']
    }
  }
]

let server: ReturnType<typeof createServer> | null = null
let mainWindow: BrowserWindow | null = null

function sendToRenderer(channel: string, data: any): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // SSE endpoint for MCP transport
  if (req.method === 'GET' && req.url === '/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    const endpoint = `http://localhost:${MCP_PORT}/message`
    res.write(`data: ${JSON.stringify({ type: 'endpoint', endpoint })}\n\n`)
    // Keep alive
    const keepAlive = setInterval(() => res.write(':keepalive\n\n'), 30000)
    req.on('close', () => clearInterval(keepAlive))
    return
  }

  // JSON-RPC message endpoint
  if (req.method === 'POST' && req.url === '/message') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const request: JsonRpcRequest = JSON.parse(body)
        const response = handleJsonRpc(request)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(response))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end()
}

const MCP_PORT = 3100

function handleJsonRpc(request: JsonRpcRequest): JsonRpcResponse {
  const { id, method, params } = request

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'mimi-pet', version: '0.3.0' }
        }
      }

    case 'notifications/initialized':
      return { jsonrpc: '2.0', id: id ?? null, result: {} }

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: { tools: MCP_TOOLS }
      }

    case 'tools/call':
      return handleToolCall(id ?? null, params)

    case 'ping':
      return { jsonrpc: '2.0', id: id ?? null, result: {} }

    default:
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32601, message: `Method not found: ${method}` }
      }
  }
}

function handleToolCall(id: string | number | null, params: any): JsonRpcResponse {
  const toolName = params?.name
  const args = params?.arguments || {}

  switch (toolName) {
    case 'set_expression':
      sendToRenderer('mcp:set-expression', { expression: args.expression })
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: `Expression set to ${args.expression}` }] }
      }

    case 'show_notification':
      sendToRenderer('mcp:notification', { title: args.title || 'Mimi', message: args.message })
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: 'Notification shown' }] }
      }

    case 'display_message':
      sendToRenderer('mcp:message', { content: args.content })
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: 'Message displayed' }] }
      }

    case 'change_theme':
      sendToRenderer('mcp:change-theme', { theme: args.theme })
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: `Theme changed to ${args.theme}` }] }
      }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: `Unknown tool: ${toolName}` }
      }
  }
}

export function startMcpServer(window: BrowserWindow): void {
  mainWindow = window
  if (server) return

  server = createServer(handleRequest)
  server.listen(MCP_PORT, () => {
    console.log(`MCP server listening on http://localhost:${MCP_PORT}`)
  })
  server.on('error', (err: any) => {
    if (err.code !== 'EADDRINUSE') {
      console.error('MCP server error:', err)
    }
  })
}

export function stopMcpServer(): void {
  if (server) {
    server.close()
    server = null
  }
}
