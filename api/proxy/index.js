// Función de la Static Web App: pasa todo /api/* al backend (BACKEND_URL, configuración de la app).
// Hace lo mismo que servidor.mjs en local. En el plan Free no hay "backend enlazado", y así el
// navegador sigue viendo un solo sitio: la cookie de sesión es del frontend y no hace falta CORS.

// Cabeceras que no se reenvían entre conexiones (RFC 9110, 7.6.1) o que fetch calcula solo.
const NO_REENVIAR = new Set(['host', 'connection', 'keep-alive', 'proxy-connection', 'transfer-encoding',
  'upgrade', 'te', 'trailer', 'content-length', 'accept-encoding'])
// fetch ya descomprime el cuerpo: estas cabeceras de la respuesta dejarían de ser ciertas.
const NO_DEVOLVER = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-length', 'content-encoding', 'set-cookie'])
const SIN_CUERPO = new Set(['GET', 'HEAD'])

// "JSESSIONID=abc; Path=/; HttpOnly; SameSite=Lax" -> cookie para context.res.cookies.
function leerCookie(linea) {
  const [par, ...atributos] = linea.split(';')
  const igual = par.indexOf('=')
  const cookie = { name: par.slice(0, igual).trim(), value: par.slice(igual + 1).trim() }
  for (const atributo of atributos) {
    const [clave, ...resto] = atributo.split('=')
    const valor = resto.join('=').trim()
    switch (clave.trim().toLowerCase()) {
      case 'path': cookie.path = valor; break
      case 'expires': cookie.expires = new Date(valor); break
      case 'max-age': cookie.maxAge = Number(valor); break
      case 'httponly': cookie.httpOnly = true; break
      case 'secure': cookie.secure = true; break
      case 'samesite': cookie.sameSite = valor.charAt(0).toUpperCase() + valor.slice(1).toLowerCase(); break
      // Domain se omite a propósito: la cookie queda a nombre del sitio del frontend.
    }
  }
  return cookie
}

module.exports = async function (context, req) {
  const backend = (process.env.BACKEND_URL || '').replace(/\/+$/, '')
  if (!backend) {
    context.res = { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' },
      body: { error: 'Falta configurar BACKEND_URL en la Static Web App.' } }
    return
  }

  const entrada = new URL(req.originalUrl || req.url, 'https://sitio.invalid')
  const cabeceras = {}
  for (const [nombre, valor] of Object.entries(req.headers || {})) {
    if (!NO_REENVIAR.has(nombre.toLowerCase())) cabeceras[nombre] = valor
  }
  cabeceras['x-forwarded-host'] = req.headers['x-forwarded-host'] || entrada.host
  cabeceras['x-forwarded-proto'] = 'https'

  const metodo = req.method.toUpperCase()
  const cuerpo = !SIN_CUERPO.has(metodo) && req.body && req.body.length ? req.body : undefined

  let respuesta
  try {
    respuesta = await fetch(backend + entrada.pathname + entrada.search, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo,
      redirect: 'manual',
      signal: AbortSignal.timeout(40_000), // la Static Web App corta las funciones a los 45 s
    })
  } catch (error) {
    context.log.error(`[api] ${metodo} ${entrada.pathname}: ${error.message}`)
    context.res = { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' },
      body: { error: 'No pudimos comunicarnos con el servidor de Convivir. Espera un momento y vuelve a intentarlo.' } }
    return
  }

  const devueltas = {}
  respuesta.headers.forEach((valor, nombre) => {
    if (!NO_DEVOLVER.has(nombre.toLowerCase())) devueltas[nombre] = valor
  })
  context.res = {
    status: respuesta.status,
    headers: devueltas,
    cookies: respuesta.headers.getSetCookie().map(leerCookie),
    body: Buffer.from(await respuesta.arrayBuffer()),
    isRaw: true,
  }
}
