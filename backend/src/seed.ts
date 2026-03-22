import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // Admin Rafael
  const adminHash = await bcrypt.hash('607652', 10)
  const admin = await prisma.user.upsert({
    where: { username: 'rafael' },
    update: { password: adminHash },
    create: {
      username: 'rafael',
      name: 'Rafael',
      password: adminHash,
      role: 'ADMIN',
      avatarColor: '#3b82f6',
    },
  })
  console.log(`✅ Admin: ${admin.username}`)

  // Tabela de preços — mercado Brasil 2024/2025
  const pricing = [
    // Hora-Máquina (pesquisa GRV/Usinagem Brasil 2024 · São Paulo)
    { key: 'RATE_CNC',       label: 'Hora CNC (Fresamento 3 Eixos)',  value: 185,   unit: 'R$/h' },
    { key: 'RATE_EDM',       label: 'Hora EDM (Eletroerosão)',        value: 130,   unit: 'R$/h' },
    { key: 'RATE_BENCH',     label: 'Hora Bancada / Ajustagem',       value: 95,    unit: 'R$/h' },
    { key: 'RATE_GRINDING',  label: 'Hora Retífica e Polimento',      value: 110,   unit: 'R$/h' },
    // Aços (Aços Nobre / GGD Metals / AÇOESPECIAL 2024)
    { key: 'STEEL_S1045',    label: 'Aço SAE 1045 (estrutural)',      value: 12.80, unit: 'R$/kg' },
    { key: 'STEEL_P20',      label: 'Aço P20 / XPM (cavidades)',      value: 42.00, unit: 'R$/kg' },
    { key: 'STEEL_H13',      label: 'Aço H13 (alta temperatura)',     value: 68.00, unit: 'R$/kg' },
    { key: 'STEEL_P20S',     label: 'Aço P20+S / 2316 (inox fácil)', value: 78.00, unit: 'R$/kg' },
    { key: 'STEEL_420SS',    label: 'Aço 420 Inox (espelho)',         value: 92.00, unit: 'R$/kg' },
    // Componentes Polimold
    { key: 'COMP_PINS',      label: 'Conjunto de Pinos Extratores',   value: 320,   unit: 'R$/jg' },
    { key: 'COMP_SPRINGS',   label: 'Conjunto de Molas-Guia',         value: 150,   unit: 'R$/jg' },
    { key: 'COMP_COLUMNS',   label: 'Conjunto Colunas + Buchas',      value: 420,   unit: 'R$/jg' },
    { key: 'COMP_BUSHING',   label: 'Bucha de Injeção Central',       value: 180,   unit: 'R$/un' },
    { key: 'COMP_LOCATING',  label: 'Anel de Centragem',              value: 85,    unit: 'R$/un' },
    // Câmara Quente (equivalente Synventive/Incoe 2024)
    { key: 'HR_NOZZLE',      label: 'Bico Câmara Quente (por unid.)', value: 2800,  unit: 'R$/un' },
    { key: 'HR_MANIFOLD',    label: 'Manifold Base + 1 Derivação',    value: 4500,  unit: 'R$/jg' },
    { key: 'HR_EXTRA_DROP',  label: 'Derivação Adicional (manifold)', value: 800,   unit: 'R$/un' },
    // Legado (compatibilidade com cálculos anteriores)
    { key: 'HOURLY_RATE',       label: 'Hora de Trabalho (legado)',   value: 185,   unit: 'R$/h' },
    { key: 'COMPONENT_PINS',    label: 'Pinos Extratores (legado)',   value: 320,   unit: 'R$/jg' },
    { key: 'COMPONENT_SPRINGS', label: 'Molas-Guia (legado)',         value: 150,   unit: 'R$/jg' },
    { key: 'COMPONENT_COLUMNS', label: 'Colunas e Buchas (legado)',   value: 420,   unit: 'R$/jg' },
    { key: 'COMPONENT_MANIFOLD', label: 'Manifold (legado)',          value: 4500,  unit: 'R$/jg' },
  ]

  for (const item of pricing) {
    await prisma.pricingTable.upsert({
      where: { key: item.key },
      update: {},
      create: item,
    })
  }
  console.log(`✅ Tabela de preços: ${pricing.length} itens`)

  console.log('\n🎉 Seed completo!')
  console.log('\nLogin:')
  console.log('  Usuário: rafael')
  console.log('  Senha:   607652')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
