import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

interface Profile {
  gender?: string
  birthYear?: number
  conditions?: string[]
  medications?: { name: string; memo?: string }[]
}

interface IngredientContext {
  standardName: string
  amount: number | null
  unit: string
}

interface SupplementContext {
  productName: string
  confirmed: boolean
  ingredients: IngredientContext[]
}

interface ChatRequest {
  sessionId?: string
  message: string
  context: {
    profile: Profile
    supplements: SupplementContext[]
    report?: Record<string, unknown>
  }
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const MAX_TURNS = 20
/** 사용자별 1일 최대 메시지 수 */
const MAX_MESSAGES_PER_DAY = 50

function getServiceKey(): string {
  const projectKey = Deno.env.get('TT_NI_SERVICE_ROLE_KEY')
  if (projectKey) return projectKey
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  const secrets = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!secrets) throw new Error('TT_NI_SERVICE_ROLE_KEY, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_SECRET_KEYS is required')
  const parsed = JSON.parse(secrets) as Record<string, string>
  const first = Object.values(parsed)[0]
  if (!first) throw new Error('No Supabase secret key was found')
  return first
}

/**
 * 개인화된 AI 응답을 위한 시스템 프롬프트를 생성합니다.
 * 사용자 프로필(성별, 나이, 건강상태, 약물), 복용 중인 영양제, 분석 리포트를 포함하여
 * 컨텍스트 인식형 맞춤 응답이 가능하도록 구성합니다.
 */
function buildSystemPrompt(context: ChatRequest['context']): string {
  const { profile, supplements, report } = context

  let prompt = `당신은 영양제 및 건강 보조제에 관한 정보를 제공하는 AI 어시스턴트입니다. 사용자의 건강 프로필과 복용 중인 영양제 정보를 바탕으로 맞춤형 조언을 제공합니다.

[의료 면책 조항]
당신이 제공하는 모든 정보는 일반적인 건강 정보 목적으로만 제공되며, 전문적인 의학적 조언, 진단 또는 치료를 대체할 수 없습니다. 사용자는 항상 자격을 갖춘 의료 전문가와 상담해야 합니다. 특정 건강 상태나 약물에 대한 질문에는 특히 주의하고, 반드시 의사와 상담할 것을 권고하세요. 영양제 복용을 시작하거나 변경하기 전에도 반드시 의사 또는 약사와 상담해야 합니다.

`

  // 사용자 프로필
  const currentYear = new Date().getFullYear()
  const age = profile.birthYear ? currentYear - profile.birthYear : null
  prompt += `[사용자 프로필]`
  if (profile.gender) {
    const genderLabel = profile.gender === 'male' ? '남성' : profile.gender === 'female' ? '여성' : '기타'
    prompt += `\n- 성별: ${genderLabel}`
  }
  if (age !== null) {
    prompt += `\n- 나이: ${age}세`
  }
  if (profile.conditions && profile.conditions.length > 0) {
    prompt += `\n- 건강 상태: ${profile.conditions.join(', ')}`
  }
  if (profile.medications && profile.medications.length > 0) {
    const meds = profile.medications.map(m => m.memo ? `${m.name}(${m.memo})` : m.name).join(', ')
    prompt += `\n- 복용 중인 약물: ${meds}`
  }

  // 영양제 정보
  const confirmedSupplements = supplements.filter(s => s.confirmed)
  if (confirmedSupplements.length > 0) {
    prompt += `\n\n[현재 복용 중인 영양제]`
    for (const s of confirmedSupplements) {
      const ingredients = s.ingredients
        .filter(i => i.amount !== null)
        .map(i => `${i.standardName} ${i.amount}${i.unit}`)
        .join(', ')
      prompt += `\n- ${s.productName}${ingredients ? ` (${ingredients})` : ''}`
    }
  }

  // 분석 리포트
  if (report) {
    prompt += `\n\n[최신 영양 분석 리포트]`
    prompt += `\n${JSON.stringify(report)}`
  }

  prompt += `\n\n[응답 지침]
- 모든 응답은 한국어로 작성하세요.
- 사용자의 프로필(나이, 성별, 건강 상태, 복용 약물)과 현재 복용 중인 영양제 정보를 종합적으로 고려하여 맞춤형 답변을 제공하세요.
- 과학적 근거에 기반한 정보를 제공하되, 지나치게 단정적인 표현은 피하세요.
- 복용량, 영양소 간 상호작용, 부작용에 관한 질문에는 특히 신중하게 답변하고, 필요시 의사나 약사와의 상담을 항상 권고하세요.
- 영양제 조합이나 복용법에 대한 구체적인 권장사항은 일반적인 가이드라인 수준에서 제공하고, 개인의 건강 상태에 따라 다를 수 있음을 명시하세요.
- 위험 신호(과잉, 결핍, 약물 상호작용 가능성 등)가 발견되면 우선적으로 안내하세요.
- 답변은 명확하고 이해하기 쉽게 구성하되, 전문성을 유지하세요.
- 사용자가 특정 증상이나 질병에 대해 물어볼 경우, 자가 진단을 하지 않도록 주의하고 의료 전문가의 진료를 권유하세요.`

  return prompt
}

/**
 * 대화가 너무 길어지면 이전 대화를 OpenAI로 요약하여 컨텍스트를 압축합니다.
 * 최근 MAX_TURNS * 2개의 메시지만 보존하고, 이전 내용은 요약본으로 대체합니다.
 * 실패 시 이전 내용을 생략하는 폴백 방식을 사용합니다.
 */
async function compressHistory(
  openaiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<ChatMessage[]> {
  const conversationalMessages = messages.filter(m => m.role !== 'system')
  if (conversationalMessages.length <= MAX_TURNS * 2) return messages

  const systemMessages = messages.filter(m => m.role === 'system')
  const recentMessages = conversationalMessages.slice(-MAX_TURNS * 2)
  const oldMessages = conversationalMessages.slice(0, -MAX_TURNS * 2)

  if (oldMessages.length === 0) return messages

  const oldConversation = oldMessages
    .map(m => `${m.role === 'user' ? '사용자' : '어시스턴트'}: ${m.content}`)
    .join('\n\n')

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              '당신은 대화 내용을 요약하는 도우미입니다. 주어진 대화를 한국어로 간결하게 요약하세요. 주요 질문 주제, 사용자의 건강 관련 정보, 그리고 제공된 중요한 조언이나 경고 사항을 포함하세요.',
          },
          { role: 'user', content: `다음 대화 내용을 요약해주세요:\n\n${oldConversation}` },
        ],
        max_tokens: 1000,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!summaryResponse.ok) {
      console.error('Summary compression failed, falling back to truncation')
      const compressed: ChatMessage[] = [
        ...systemMessages,
        { role: 'system', content: '[이전 대화 내용이 생략되었습니다.]' },
        ...recentMessages,
      ]
      return compressed
    }

    const summaryData = (await summaryResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const summary =
      summaryData.choices?.[0]?.message?.content || '이전 대화 내용이 요약되었습니다.'

    const compressed: ChatMessage[] = [
      ...systemMessages,
      {
        role: 'system',
        content: `[이전 대화 요약]\n다음은 이전 대화 내용의 요약입니다. 맥락을 유지하면서 현재 대화를 이어가세요:\n${summary}`,
      },
      ...recentMessages,
    ]

    return compressed
  } catch (e) {
    console.error('Summary compression error:', e)
    const compressed: ChatMessage[] = [
      ...systemMessages,
      { role: 'system', content: '[이전 대화 내용이 생략되었습니다.]' },
      ...recentMessages,
    ]
    return compressed
  }
}

/**
 * 사용자의 1일 메시지 사용량을 확인하여 속도 제한을 적용합니다.
 * 하루 MAX_MESSAGES_PER_DAY개를 초과하면 429를 반환해야 합니다.
 */
async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ allowed: boolean; count: number }> {
  const today = new Date().toISOString().split('T')[0]

  const { count, error } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`)

  if (error) throw error
  return { allowed: (count ?? 0) < MAX_MESSAGES_PER_DAY, count: count ?? 0 }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: '인증 헤더가 필요합니다.' }, 401)

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return jsonResponse({ error: 'OPENAI_API_KEY가 설정되지 않았습니다. 서버 관리자에게 문의하세요.' }, 500)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!supabaseUrl) throw new Error('SUPABASE_URL is required')

    const model = Deno.env.get('OPENAI_CHAT_MODEL') ?? 'gpt-5-mini'

    const supabase = createClient(supabaseUrl, getServiceKey(), {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (userError || !userData.user) {
      return jsonResponse({ error: '유효하지 않은 사용자 세션입니다.' }, 401)
    }

    const body = (await req.json()) as ChatRequest
    const { sessionId, message, context } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return jsonResponse({ error: '메시지를 입력해주세요.' }, 400)
    }
    if (!context || !context.profile) {
      return jsonResponse({ error: '사용자 컨텍스트가 필요합니다.' }, 400)
    }

    // Rate limiting
    const { allowed } = await checkRateLimit(supabase, userData.user.id)
    if (!allowed) {
      return jsonResponse(
        {
          error: `일일 메시지 한도(${MAX_MESSAGES_PER_DAY}개)를 초과했습니다. 내일 다시 이용해주세요.`,
        },
        429
      )
    }

    // Upsert chat session
    let sessionIdToUse = sessionId
    if (!sessionIdToUse) {
      sessionIdToUse = crypto.randomUUID()
      await supabase.from('chat_sessions').insert({
        id: sessionIdToUse,
        user_id: userData.user.id,
        title: message.slice(0, 100),
      })
    } else {
      const { data: existingSession } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionIdToUse)
        .eq('user_id', userData.user.id)
        .single()

      if (!existingSession) {
        return jsonResponse({ error: '채팅 세션을 찾을 수 없습니다.' }, 404)
      }

      await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionIdToUse)
    }

    // Save user message
    await supabase.from('chat_messages').insert({
      session_id: sessionIdToUse,
      user_id: userData.user.id,
      role: 'user',
      content: message,
    })

    // Get full conversation history for this session
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionIdToUse)
      .order('created_at', { ascending: true })

    // Build messages array
    let messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(context) },
      ...(history || []).map((m) => ({
        role: m.role as ChatMessage['role'],
        content: m.content,
      })),
    ]

    // Compress history if needed
    messages = await compressHistory(openaiKey, model, messages)

    // Call OpenAI Chat Completions with streaming
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      return jsonResponse({ error: `AI 응답 생성 중 오류가 발생했습니다.` }, 502)
    }

    if (!openaiResponse.body) {
      return jsonResponse({ error: 'AI 응답 스트림을 열 수 없습니다.' }, 500)
    }

    const encoder = new TextEncoder()
    let assistantContent = ''

    const stream = new ReadableStream({
      async start(controller) {
        const reader = openaiResponse.body!.getReader()
        const decoder = new TextDecoder()
        let lineBuffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()

            if (done) break

            const text = decoder.decode(value, { stream: true })
            controller.enqueue(encoder.encode(text))

            lineBuffer += text
            const lines = lineBuffer.split('\n')
            lineBuffer = lines.pop() || ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              if (line.startsWith('data: [DONE]')) continue

              try {
                const json = JSON.parse(line.slice(6))
                const delta = json.choices?.[0]?.delta
                if (delta?.content) {
                  assistantContent += delta.content
                }
              } catch {
                // Ignore lines that can't be parsed
              }
            }
          }

          // Flush remaining buffer
          if (lineBuffer) {
            controller.enqueue(encoder.encode(lineBuffer))
          }
        } catch (e) {
          console.error('Stream read error:', e)
        } finally {
          // Save assistant message after stream completes
          if (assistantContent) {
            try {
              await supabase.from('chat_messages').insert({
                session_id: sessionIdToUse,
                user_id: userData.user.id,
                role: 'assistant',
                content: assistantContent,
              })
            } catch (e) {
              console.error('Failed to save assistant message:', e)
            }
          }

          try {
            controller.close()
          } catch {
            // Controller may already be closed
          }
        }
      },
    })

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat completion error:', error)
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : '채팅 처리 중 오류가 발생했습니다.',
      },
      500
    )
  }
})
