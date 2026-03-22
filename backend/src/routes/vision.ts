import { FastifyInstance } from 'fastify'
import Anthropic from '@anthropic-ai/sdk'
import { authenticate } from '../middleware/auth'

const ANALYSIS_PROMPT = `Você é um engenheiro especialista em moldes de injeção plástica com 30 anos de experiência.

Analise a foto desta peça plástica e retorne um JSON com as seguintes informações (sem markdown, apenas o JSON puro):

{
  "productDescription": "descrição curta da peça",
  "productType": "tampa|conector|carcaça|frasco|peça_tecnica|outro",
  "complexity": "simples|media|complexa",
  "estimatedDimensions": {
    "x": number (largura em mm - estimativa),
    "y": number (comprimento em mm - estimativa),
    "z": number (altura em mm - estimativa)
  },
  "suggestedCavities": number (1,2,4,6,8,12,16,24,32),
  "injectionType": "camera_fria|camera_quente",
  "nozzleCount": number (quantos bicos se câmara quente, 0 se fria),
  "needsDrawers": boolean,
  "drawerCount": number,
  "suggestedSteel": "S1045|P20|H13",
  "suggestedPolish": "STANDARD|SEMI_GLOSS|MIRROR",
  "moldSeries": "Série 15|Série 20|Série 25|Série 30|Série 40|Série 50",
  "estimatedCycles": "100k|250k|500k|1M",
  "technicalNotes": ["nota1", "nota2"],
  "warnings": ["aviso se necessário"],
  "cavityLayout": "linear|h_layout|matrix",
  "referenceScale": "use o dedo ou objetos na foto como referência de escala"
}

Seja preciso e técnico. Estime as dimensões usando referências visuais (mão, caneta, papel, etc.) se visíveis na foto.`

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

export async function visionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // POST /api/vision/analyze
  app.post('/analyze', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    const buffer = await data.toBuffer()
    const mimeType = data.mimetype || 'image/jpeg'
    const isPdf = mimeType === 'application/pdf'

    if (!process.env.ANTHROPIC_API_KEY) {
      return getDemoAnalysis()
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    try {
      let messageContent: Anthropic.MessageParam['content']

      if (isPdf) {
        messageContent = [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: buffer.toString('base64'),
            },
          } as any,
          { type: 'text', text: ANALYSIS_PROMPT },
        ]
      } else {
        const mediaType = ALLOWED_IMAGE_TYPES.includes(mimeType as any)
          ? (mimeType as typeof ALLOWED_IMAGE_TYPES[number])
          : 'image/jpeg'

        messageContent = [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: buffer.toString('base64'),
            },
          },
          { type: 'text', text: ANALYSIS_PROMPT },
        ]
      }

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: messageContent }],
      })

      const text = message.content[0].type === 'text' ? message.content[0].text : ''
      let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const firstBrace = cleaned.indexOf('{')
      const lastBrace = cleaned.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1)
      }

      let analysis: any
      try {
        analysis = JSON.parse(cleaned)
      } catch (parseErr: any) {
        console.error('[vision] JSON parse error:', parseErr.message, '| raw:', text.slice(0, 300))
        return reply.status(503).send({
          error: 'Resposta da IA em formato inválido. Tente novamente.',
          code: 'PARSE_ERROR',
          detail: parseErr.message,
        })
      }

      return { analysis, source: isPdf ? 'ai_pdf' : 'ai' }
    } catch (err: any) {
      console.error('[vision] Anthropic error:', err?.message, err?.status)
      return reply.status(503).send({
        error: 'Análise IA indisponível. Tente novamente.',
        code: 'AI_UNAVAILABLE',
        detail: err?.message ?? String(err),
      })
    }
  })
}

function getDemoAnalysis() {
  return {
    source: 'demo',
    analysis: {
      productDescription: 'Peça plástica cilíndrica com flange superior',
      productType: 'tampa',
      complexity: 'simples',
      estimatedDimensions: { x: 32, y: 32, z: 28 },
      suggestedCavities: 12,
      injectionType: 'camera_fria',
      nozzleCount: 0,
      needsDrawers: false,
      drawerCount: 0,
      suggestedSteel: 'P20',
      suggestedPolish: 'SEMI_GLOSS',
      moldSeries: 'Série 40',
      estimatedCycles: '500k',
      technicalNotes: [
        'Peça simples sem ângulos de saída problemáticos',
        'Layout 12 cavidades balanceado recomendado',
        'Injeção central pelo ponto de fechamento',
      ],
      warnings: [],
      cavityLayout: 'matrix',
    },
  }
}
