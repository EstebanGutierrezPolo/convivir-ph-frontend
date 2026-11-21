# CONVIVIR frontend

Pantallas de Convivir, la plataforma para la gestión y control de propiedades horizontales. Son páginas HTML con CSS y JavaScript sin frameworks, con el mismo estilo del proyecto original.

Los datos vienen del backend (`convivir-backend`, API REST en Spring Boot). Este proyecto trae un servidor pequeño en Node que:

- sirve las páginas de `public/` con direcciones limpias (`/inmuebles` abre `inmuebles.html`);
- pasa al backend todo lo que empieza por `/api`.

Así el navegador ve un solo sitio: la cookie de sesión es del frontend y no hace falta configurar CORS.

## Cómo ejecutarlo

Requisitos: **Node 20 o superior**. No hay dependencias que instalar.

1. Levanta el backend (por defecto queda en `http://localhost:8080`).
2. En esta carpeta:

```bash
npm start
```

3. Abre `http://localhost:3000`.

### Configuración

| Variable | Para qué sirve | Valor por defecto |
|---|---|---|
| `PORT` | Puerto del frontend | `3000` |
| `BACKEND_URL` | Dirección del backend | `http://localhost:8080` |
| `CONFIAR_PROXY` | `true` si hay un proxy o balanceador delante (por ejemplo, el de la plataforma donde se despliega) que pone las cabeceras `X-Forwarded-*` | `false` |

En PowerShell: `$env:BACKEND_URL = "http://localhost:8080"; npm start`.

### Con Docker

```bash
docker build -t convivir-frontend .
docker run -d --name convivir-frontend -p 3000:3000 -e BACKEND_URL=http://host.docker.internal:8080 convivir-frontend
```

Si el backend corre en otro contenedor de la misma red, `BACKEND_URL` es `http://<nombre del contenedor>:8080`.

## Despliegue en Azure

El frontend está en **Azure Static Web Apps** (`stw-convivir-frontend`, plan Free, grupo `rg-convivir`). Cada push a `main` lo despliega con GitHub Actions (`.github/workflows/azure-static-web-apps.yml`), que usa el secreto `AZURE_STATIC_WEB_APPS_API_TOKEN` del repositorio.

- `public/` se publica tal cual. `public/staticwebapp.config.json` da las direcciones limpias, las rutas especiales y la página 404.
- `api/proxy` es una función de la Static Web App que pasa `/api/*` al backend, igual que `servidor.mjs` en local. En el plan Free no hay backend enlazado, y así el navegador sigue viendo un solo sitio.
- La dirección del backend va en la configuración de la Static Web App, variable `BACKEND_URL`:

```bash
az staticwebapp appsettings set -n stw-convivir-frontend -g rg-convivir --setting-names BACKEND_URL=https://<backend>
```

## Cómo está armado

```
public/
├── css/          Estilos (app.css y convivir.css)
├── js/marco.js   Menú lateral, sesión y permisos de cada pantalla
├── *.html        Una página por pantalla
├── 404.html      Página no encontrada
└── staticwebapp.config.json   Rutas de la Static Web App
api/proxy/        Función de Azure que pasa /api al backend
servidor.mjs      Servidor local de páginas y paso de /api al backend
```

- **Sesión:** `login.html` envía el correo y la contraseña a `POST /api/login`. El backend responde con el usuario, el rol y el menú del rol, y el navegador lo recuerda para pintar el menú sin esperar.
- **Marco:** `js/marco.js` va al inicio de cada pantalla con sesión. Pinta el menú, cierra la sesión y lleva al inicio si la pantalla no es del rol. En segundo plano confirma la sesión con `GET /api/sesion`: si venció, lleva al login.
- **Permisos:** el marco solo evita abrir pantallas de otro rol. Quien protege los datos es el backend: cada ruta de `/api` revisa la sesión y el rol.

Rutas especiales del servidor:

| Ruta | Página |
|---|---|
| `/` | `index.html` |
| `/mis-vehiculos` | `vehiculos.html` (la misma pantalla de `/vehiculos`, con otro título) |
| `/pasarela-simulada/<referencia>` | `pasarela-simulada.html` |
