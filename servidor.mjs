// Servidor del frontend de Convivir. Sin dependencias: solo Node.
//   - Sirve las páginas de public/ con URLs limpias (/inmuebles -> inmuebles.html).
//   - Pasa todo lo que empieza por /api al backend (BACKEND_URL). Así el navegador
//     ve un solo sitio: la cookie de sesión es del frontend y no hace falta CORS.
//
// Variables de entorno:
//   PORT         puerto donde escucha (3000 por defecto)
//   BACKEND_URL  dirección del backend (http://localhost:8080 por defecto)
//   CONFIAR_PROXY  true si hay un proxy o balanceador delante que pone las cabeceras X-Forwarded-*
import http from 'node:http'
import https from 'node:https'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PUERTO = Number(process.env.PORT) || 3000
const BACKEND = new URL(process.env.BACKEND_URL || 'http://localhost:8080')
const CONFIAR_PROXY = process.env.CONFIAR_PROXY === 'true'
const PUBLICO =path.join(path.dirname(fileURLToPath(import.meta.url)), 'public')

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

// Rutas que no tienen un archivo con su nombre.
const REESCRITURAS = [
  [/^\/$/, '/index.html'],
  [/^\/mis-vehiculos$/, '/vehiculos.html'],        // misma pantalla que /vehiculos
  [/^\/pasarela-simulada\/[^/]+$/, '/pasarela-simulada.html'], // /pasarela-simulada/<referencia>
]

// Cabeceras que no se reenvían entre conexiones (RFC 9110, sección 7.6.1).
const SALTO_A_SALTO = new Set(['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer'])

function haciaElBackend(pet, res) {
  const cliente = BACKEND.protocol === 'https:' ? https : http
  const cabeceras = {}
  for (const [nombre, valor] of Object.entries(pet.headers)) {
    if (!SALTO_A_SALTO.has(nombre) && nombre !== 'host') cabeceras[nombre] = valor
  }
  cabeceras.host = BACKEND.host
  // Las X-Forwarded-* que manda el cliente solo se creen si hay un proxy conocido delante (CONFIAR_PROXY=true).
  const proto = pet.socket.encrypted ? 'https' : 'http'
  cabeceras['x-forwarded-host'] = (CONFIAR_PROXY && pet.headers['x-forwarded-host']) || pet.headers.host || ''
  cabeceras['x-forwarded-proto'] = (CONFIAR_PROXY && pet.headers['x-forwarded-proto']) || proto
  cabeceras['x-forwarded-for'] = [CONFIAR_PROXY && pet.headers['x-forwarded-for'], pet.socket.remoteAddress].filter(Boolean).join(', ')

  const salida = cliente.request({
    protocol: BACKEND.protocol,
    hostname: BACKEND.hostname,
    port: BACKEND.port || (BACKEND.protocol === 'https:' ? 443 : 80),
    method: pet.method,
    path: pet.url,
    headers: cabeceras,
  }, (respuesta) => {
    const devueltas = {}
    for (const [nombre, valor] of Object.entries(respuesta.headers)) {
      if (SALTO_A_SALTO.has(nombre)) continue
      // La cookie queda a nombre del frontend: se quita el dominio del backend si lo trae.
      devueltas[nombre] = nombre === 'set-cookie' ? valor.map((c) => c.replace(/;\s*domain=[^;]*/i, '')) : valor
    }
    res.writeHead(respuesta.statusCode, devueltas)
    respuesta.pipe(res)
  })

  salida.on('error', (error) => {
    console.error(`[api] ${pet.method} ${pet.url}: ${error.message}`)
    if (res.headersSent) { res.destroy(); return }
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'No pudimos comunicarnos con el servidor de Convivir. Espera un momento y vuelve a intentarlo.' }))
  })
  // Si el navegador corta (cierra la pestaña, cancela una subida), se corta también hacia el backend.
  res.on('close', () => { if (!res.writableFinished) salida.destroy() })
  salida.setTimeout(120_000, () => salida.destroy(new Error('el backend no respondió en 2 minutos')))
  // El cuerpo pasa tal cual (JSON, formularios y archivos adjuntos).
  pet.pipe(salida)
}

async function archivo(ruta) {
  try {
    const info = await stat(ruta)
    return info.isFile() ? info : null
  } catch {
    return null
  }
}

async function estatico(pet, res) {
  if (pet.method !== 'GET' && pet.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' })
    res.end()
    return
  }
  let ruta
  try {
    ruta = decodeURIComponent(new URL(pet.url, 'http://x').pathname)
  } catch {
    res.writeHead(400)
    res.end()
    return
  }
  if (ruta.length > 1) ruta = ruta.replace(/\/+$/, '')
  for (const [patron, destino] of REESCRITURAS) {
    if (patron.test(ruta)) { ruta = destino; break }
  }

  // Primero el archivo tal cual (/css/app.css); si no existe, la página (/inmuebles -> inmuebles.html).
  const candidatos = path.extname(ruta) ? [ruta] : [ruta + '.html']
  let encontrado = null
  for (const candidato of candidatos) {
    const completo = path.join(PUBLICO, path.normalize(candidato))
    if (!completo.startsWith(PUBLICO + path.sep)) break // nada fuera de public/
    const info = await archivo(completo)
    if (info) { encontrado = { completo, info }; break }
  }

  let estado = 200
  if (!encontrado) {
    estado = 404
    const completo = path.join(PUBLICO, '404.html')
    encontrado = { completo, info: await archivo(completo) }
  }

  const extension = path.extname(encontrado.completo)
  res.writeHead(estado, {
    'content-type': TIPOS[extension] || 'application/octet-stream',
    'content-length': encontrado.info.size,
    // Las páginas se piden siempre de nuevo; estilos y scripts se guardan una hora.
    'cache-control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
  })
  if (pet.method === 'HEAD') { res.end(); return }
  createReadStream(encontrado.completo).pipe(res)
}

const servidor = http.createServer((pet, res) => {
  if (pet.url === '/api' || pet.url.startsWith('/api/') || pet.url.startsWith('/api?')) {
    haciaElBackend(pet, res)
  } else {
    estatico(pet, res).catch((error) => {
      console.error(`[web] ${pet.url}: ${error.message}`)
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
  }
})

servidor.listen(PUERTO, () => {
  console.log(`Convivir frontend en http://localhost:${PUERTO} (API: ${BACKEND.origin})`)
})
