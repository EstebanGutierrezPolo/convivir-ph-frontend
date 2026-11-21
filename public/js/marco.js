// Marco común de las pantallas con sesión. Reemplaza lo que antes hacían
// fragments.html y ModeloGlobal en el servidor (Thymeleaf):
//   - Pide la sesión al backend (GET /api/sesion) y la recuerda en el navegador.
//   - Pone en el <body> data-rol, data-admin y data-vigilante, que leen los
//     scripts de algunas pantallas.
//   - Arma el menú lateral con el menú que manda el backend para el rol.
//   - Si la pantalla no es del rol, lleva al inicio; si no hay sesión, al login.
// Se carga como primer elemento del <body>, antes que el script de la pantalla.
(function () {
  'use strict';

  var CLAVE = 'convivir-sesion';

  // Quién puede abrir cada pantalla. Es la misma tabla que tenía SecurityConfig
  // para las páginas; los datos los sigue protegiendo el backend en /api.
  var ADMIN = 'ADMINISTRADOR', CONSEJO = 'MIEMBRO_CONSEJO', VIGILANTE = 'VIGILANTE',
      PROPIETARIO = 'PROPIETARIO', ARRENDATARIO = 'ARRENDATARIO', RESIDENTE = 'RESIDENTE_AUTORIZADO';
  var PANTALLAS = {
    '/inmuebles': [ADMIN], '/historial-inmueble': [ADMIN], '/tipos-inmueble': [ADMIN],
    '/integrantes': [ADMIN], '/cuentas': [ADMIN], '/vinculaciones': [ADMIN], '/vehiculos': [ADMIN],
    '/parqueaderos': [ADMIN], '/historial-accesos': [ADMIN], '/obligaciones': [ADMIN], '/pagos': [ADMIN],
    '/reservas': [ADMIN], '/reportes': [ADMIN], '/notificaciones': [ADMIN], '/configuracion': [ADMIN],
    '/auditoria': [ADMIN, CONSEJO], '/cartera': [ADMIN, CONSEJO], '/gastos': [ADMIN, CONSEJO],
    '/recaudo': [CONSEJO],
    '/porteria': [VIGILANTE], '/control-vehicular': [VIGILANTE],
    '/mis-inmuebles': [PROPIETARIO, ARRENDATARIO, RESIDENTE],
    '/zonas-comunes': [PROPIETARIO, ARRENDATARIO, RESIDENTE],
    '/mis-notificaciones': [PROPIETARIO, ARRENDATARIO, RESIDENTE],
    '/visitas': [PROPIETARIO, ARRENDATARIO], '/autorizaciones': [PROPIETARIO, ARRENDATARIO],
    '/mis-vehiculos': [PROPIETARIO, ARRENDATARIO], '/mis-obligaciones': [PROPIETARIO, ARRENDATARIO],
    '/pasarela-simulada': [PROPIETARIO, ARRENDATARIO],
    '/mis-reportes': [PROPIETARIO, ARRENDATARIO, VIGILANTE]
  };

  var LOGO = '<span class="logo">'
    + '<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Convivir">'
    + '<rect width="48" height="48" rx="14" fill="#E3F1E4"/>'
    + '<path d="M9 24 24 11 39 24" stroke="#2F6B4F" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M24 23.4c-2.2-1.6-3.4-2.7-3.4-4a1.9 1.9 0 0 1 3.4-1.1 1.9 1.9 0 0 1 3.4 1.1c0 1.3-1.2 2.4-3.4 4z" fill="#F4B6A0"/>'
    + '<circle cx="18" cy="29" r="3.8" fill="#95D5B2"/><circle cx="30" cy="29" r="3.8" fill="#74C69D"/>'
    + '<path d="M11.5 40c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" stroke="#95D5B2" stroke-width="2.4" stroke-linecap="round"/>'
    + '<path d="M23.5 40c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" stroke="#74C69D" stroke-width="2.4" stroke-linecap="round"/>'
    + '</svg><span class="logo-texto">CONVIVIR</span></span>';

  var ICONOS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
    + '<symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></symbol>'
    + '<symbol id="i-building" viewBox="0 0 24 24"><rect x="5" y="3" width="10" height="18" rx="1.5"/><path d="M15 9h4v12h-4M8 7h4M8 11h4M8 15h4"/></symbol>'
    + '<symbol id="i-tag" viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/></symbol>'
    + '<symbol id="i-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/></symbol>'
    + '<symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5a3 3 0 0 1 0 6M18 14.8c1.7.7 3 2.4 3 5.2"/></symbol>'
    + '<symbol id="i-car" viewBox="0 0 24 24"><path d="M5 16v-5l2-5h10l2 5v5"/><path d="M3 16h18"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></symbol>'
    + '<symbol id="i-parking" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M10 17V8h3a2.5 2.5 0 0 1 0 5h-3"/></symbol>'
    + '<symbol id="i-door" viewBox="0 0 24 24"><path d="M6 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M4 21h16"/><circle cx="14" cy="12.5" r=".9"/></symbol>'
    + '<symbol id="i-receipt" viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></symbol>'
    + '<symbol id="i-card" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18M7 15h3"/></symbol>'
    + '<symbol id="i-wallet" viewBox="0 0 24 24"><path d="M4 7a2 2 0 0 1 2-2h12v4"/><rect x="4" y="7" width="17" height="13" rx="2.5"/><circle cx="16.5" cy="13.5" r="1"/></symbol>'
    + '<symbol id="i-coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.4.7-2.4 1.8 0 2.7 5 1.2 5 4 0 1.1-1.1 1.9-2.6 1.9-1.1 0-2-.4-2.6-1.2M12 6.5V8M12 16v1.5"/></symbol>'
    + '<symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></symbol>'
    + '<symbol id="i-flag" viewBox="0 0 24 24"><path d="M5 21V4M5 5h12l-2 4 2 4H5"/></symbol>'
    + '<symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/></symbol>'
    + '<symbol id="i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/></symbol>'
    + '<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></symbol>'
    + '<symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6"/></symbol>'
    + '<symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/></symbol>'
    + '<symbol id="i-clipboard" viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/></symbol>'
    + '<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>'
    + '<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>'
    + '<symbol id="i-logout" viewBox="0 0 24 24"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/></symbol>'
    + '<symbol id="i-dot" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/></symbol>'
    + '</defs></svg>';

  function leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE)); } catch (e) { return null; }
  }
  function guardar(sesion) {
    try { localStorage.setItem(CLAVE, JSON.stringify(sesion)); } catch (e) { /* sin almacenamiento */ }
  }
  function olvidar() {
    try { localStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ }
  }
  function irAlLogin() {
    olvidar();
    location.replace('/login?desde=' + encodeURIComponent(location.pathname + location.search));
  }
  function texto(valor) {
    var d = document.createElement('div');
    d.textContent = valor == null ? '' : String(valor);
    return d.innerHTML;
  }

  var ruta = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/+$/, '$1') || '/';

  function rolesDeLaPantalla() {
    for (var prefijo in PANTALLAS) {
      if (ruta === prefijo || ruta.indexOf(prefijo + '/') === 0) return PANTALLAS[prefijo];
    }
    return null; // Inicio, Mi cuenta: cualquier rol con sesión.
  }

  var sesion = leer();

  // Sin sesión recordada: se pregunta al backend antes de mostrar la pantalla.
  // Si el navegador no deja guardarla, se sigue con la de memoria (recargar daría un ciclo sin fin).
  if (!sesion || !sesion.rol) {
    document.documentElement.style.visibility = 'hidden';
    fetch('/api/sesion', { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('sin sesión'); return r.json(); })
      .then(function (s) {
        guardar(s);
        if (leer()) { location.reload(); return; }
        if (!iniciar(s, false)) return;
        var mostrar = function () {
          pintarMenu();
          rellenarDatos();
          document.documentElement.style.visibility = '';
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mostrar);
        else mostrar();
      })
      .catch(irAlLogin);
    return;
  }
  if (!iniciar(sesion, true)) return;

  /** Revisa el rol y deja la sesión en el body. Devuelve false si la pantalla no es del rol. */
  function iniciar(s, recordada) {
    sesion = s;
    var permitidos = rolesDeLaPantalla();
    if (permitidos && permitidos.indexOf(sesion.rol) < 0) {
      location.replace('/');
      return false;
    }
    // Lo que antes ponía Thymeleaf con th:attr.
    var cuerpo = document.body;
    cuerpo.setAttribute('data-rol', sesion.rolNombre);
    cuerpo.setAttribute('data-admin', String(!!sesion.admin));
    cuerpo.setAttribute('data-vigilante', String(!!sesion.vigilante));
    window.CONVIVIR = { sesion: sesion };
    if (recordada) {
      document.addEventListener('DOMContentLoaded', function () {
        pintarMenu();
        rellenarDatos();
      });
      revisarConElBackend();
    }
    return true;
  }

  function pintarMenu() {
    var aside = document.getElementById('sidebar');
    if (!aside) return;
    var items = (sesion.menu || []).map(function (item) {
      var activo = item.url === ruta ? ' activo' : '';
      return '<a href="' + texto(item.url) + '" class="item' + activo + '">'
        + '<span>' + texto(item.titulo) + '</span>'
        + '<svg class="ic"><use href="#i-' + texto(item.icono) + '"/></svg></a>';
    }).join('');
    aside.innerHTML = ICONOS
      + '<div class="sidebar-top"><a href="/" class="marca">' + LOGO + '</a>'
      + '<button type="button" class="menu-btn" id="menuBtn" aria-label="Abrir menú" aria-expanded="false">'
      + '<svg class="ic"><use href="#i-menu"/></svg></button></div>'
      + '<nav id="navPrincipal">' + items + '</nav>'
      + '<div class="perfil"><strong>' + texto(sesion.usuario) + '</strong><span>' + texto(sesion.rolNombre) + '</span>'
      + '<button type="button" class="btn-salir" id="btnSalir"><svg class="ic"><use href="#i-logout"/></svg> Cerrar sesión</button>'
      + '<a href="/privacidad" style="display:block;text-align:center;margin-top:10px;font-size:.8rem;color:var(--texto-suave)">Política de privacidad</a>'
      + '</div>';

    var boton = document.getElementById('menuBtn');
    boton.addEventListener('click', function () {
      var abierto = aside.classList.toggle('abierto');
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    });
    document.getElementById('btnSalir').addEventListener('click', function () {
      fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
        .finally(function () { olvidar(); location.replace('/login?logout'); });
    });
  }

  function rellenarDatos() {
    document.querySelectorAll('[data-sesion]').forEach(function (e) {
      e.textContent = sesion[e.getAttribute('data-sesion')] || '';
    });
    // Vehículos y Mis vehículos son la misma pantalla.
    document.querySelectorAll('[data-titulo-admin]').forEach(function (e) {
      e.textContent = e.getAttribute(sesion.admin ? 'data-titulo-admin' : 'data-titulo-otro');
      document.title = e.textContent + ' · Convivir';
    });
  }

  // Se confirma la sesión con el backend: si venció, al login; si cambió (otro rol, otro menú), se recarga.
  function revisarConElBackend() {
    fetch('/api/sesion', { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) { irAlLogin(); return null; }
      return r.ok ? r.json() : null;
    }).then(function (nueva) {
      if (nueva && JSON.stringify(nueva) !== JSON.stringify(sesion)) {
        guardar(nueva);
        location.reload();
      }
    }).catch(function () { /* sin red: se sigue con la sesión recordada */ });
  }
})();
