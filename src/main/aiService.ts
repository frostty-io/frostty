import { AIGenerateCommandRequest, AIGenerateCommandResponse } from '../shared/ipc'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

function buildSystemMessage(shell: string, cwd: string): string {
  return `You are a shell command generator. Given a natural language description, generate the appropriate shell command.

Rules:
1. Output ONLY valid JSON: {"command": "your command here"}
2. Generate commands for the specified shell (${shell})
3. Use common Unix utilities and standard syntax
4. For dangerous operations (rm -rf, sudo), add safety flags when appropriate
5. If the request is unclear or impossible, set command to empty string
6. Never include explanations in the command itself
7. Consider the current working directory context

Current shell: ${shell}
Current directory: ${cwd}`
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenRouterRequest {
  model: string
  messages: OpenRouterMessage[]
  response_format?: { type: 'json_object' }
  temperature?: number
  max_tokens?: number
}

interface OpenRouterChoice {
  message: {
    content: string
  }
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[]
  error?: {
    message: string
    code?: string
  }
}

interface CommandResponse {
  command: string
}

export async function generateCommand(request: AIGenerateCommandRequest): Promise<AIGenerateCommandResponse> {
  const { instruction, shell, cwd, apiKey, model } = request

  if (!apiKey) {
    return {
      success: false,
      error: 'OpenRouter API key not configured. Please set it in Settings.'
    }
  }

  if (!instruction.trim()) {
    return {
      success: false,
      error: 'No instruction provided'
    }
  }

  const systemMessage = buildSystemMessage(shell, cwd)

  const requestBody: OpenRouterRequest = {
    model: model || 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: instruction }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 500
  }

  const AI_REQUEST_TIMEOUT_MS = 30_000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://doggo.sh',
        'X-Title': 'Doggo'
      },
      body: JSON.stringify(requestBody)
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `API request failed: ${response.status}`
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message
        }
      } catch {
        // Use default error message
      }
      return {
        success: false,
        error: errorMessage
      }
    }

    const data = await response.json() as OpenRouterResponse

    if (data.error) {
      return {
        success: false,
        error: data.error.message || 'Unknown API error'
      }
    }

    if (!data.choices || data.choices.length === 0) {
      return {
        success: false,
        error: 'No response from AI model'
      }
    }

    const content = data.choices[0].message.content

    // Parse the JSON response
    let parsed: CommandResponse
    try {
      parsed = JSON.parse(content) as CommandResponse
    } catch {
      // Try to extract command from non-JSON response
      // Sometimes models return markdown code blocks
      const codeBlockMatch = content.match(/```(?:bash|sh|zsh|fish)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        return {
          success: true,
          command: codeBlockMatch[1].trim()
        }
      }

      return {
        success: false,
        error: 'Failed to parse AI response as JSON'
      }
    }

    if (typeof parsed.command !== 'string') {
      return {
        success: false,
        error: 'Invalid response format: missing command field'
      }
    }

    return {
      success: true,
      command: parsed.command
    }
  } catch (error) {
    clearTimeout(timeoutId)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isAbort = error instanceof Error && error.name === 'AbortError'
    return {
      success: false,
      error: isAbort ? 'Request timed out' : `Network error: ${errorMessage}`
    }
  }
}
