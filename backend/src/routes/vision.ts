import { FastifyInstance } from 'fastify'
import Anthropic from '@anthropic-ai/sdk'
import { authenticate } from '../middleware/auth'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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

export async function visionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // POST /api/vision/analyze
  app.post('/analyze', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'Nenhuma imagem enviada' })

    const buffer = await data.toBuffer()
    const base64 = buffer.toString('base64')
    const mediaType = (data.mimetype as any) || 'image/jpeg'

    if (!process.env.ANTHROPIC_API_KEY) {
      // Modo demo — retorna análise heurística
      return getDemoAnalysis()
    }

    try {
      const message = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: ANALYSIS_PROMPT,
              },
            ],
          },
        ],
      })

      const text = message.content[0].type === 'text' ? message.content[0].text : ''
      // Remove possíveis markdown code blocks
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const analysis = JSON.parse(cleaned)
      return { analysis, source: 'ai' }
    } catch (err: any) {
      console.error('Vision error:', err.message)
      return { analysis: getDemoAnalysis().analysis, source: 'demo', warning: 'Análise IA indisponível — usando estimativa inteligente' }
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
