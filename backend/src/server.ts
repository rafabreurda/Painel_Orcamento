import { buildApp } from './app'

const app = buildApp()
const PORT = Number(process.env.PORT) || 3001

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`\n🚀 NeuroFlux Mold API → http://localhost:${PORT}`)
})
