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

  // Tabela de preços
  const pricing = [
    { key: 'HOURLY_RATE',        label: 'Valor Hora de Trabalho', value: 150,   unit: 'R$/h' },
    { key: 'STEEL_S1045',        label: 'Aço 1045',               value: 11.35, unit: 'R$/kg' },
    { key: 'STEEL_P20',          label: 'Aço P20',                value: 38.0,  unit: 'R$/kg' },
    { key: 'STEEL_H13',          label: 'Aço H13 (Injetora)',     value: 65.0,  unit: 'R$/kg' },
    { key: 'COMPONENT_PINS',     label: 'Conjunto de Pinos',      value: 280,   unit: 'R$/jg' },
    { key: 'COMPONENT_SPRINGS',  label: 'Conjunto de Molas',      value: 120,   unit: 'R$/jg' },
    { key: 'COMPONENT_COLUMNS',  label: 'Conjunto de Colunas',    value: 350,   unit: 'R$/jg' },
    { key: 'COMPONENT_MANIFOLD', label: 'Manifold Câmara Quente', value: 2800,  unit: 'R$/un' },
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
