/** ====== CONFIGURACIÓN ====== **/
const SS_ID = '1yaesbEmAvS_cqURVBqHvz2733umekViIDz-f4rfs1CM';
const NOMBRE_HOJA_INCIDENCIAS = 'Incidencias';
const NOMBRE_HOJA_MENSAJES = 'Mensajes';
const TZ = 'Europe/Madrid';

/** ==============================================
    SISTEMA DE CACHÉ (VELOCIDAD EXTREMA)
    ============================================== **/

// --- CACHÉ DE INCIDENCIAS ---
function getIncidenciasCheadas() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("CACHE_INCIDENCIAS");
  if (cached != null) return JSON.parse(cached);
  return actualizarCacheIncidencias();
}

function actualizarCacheIncidencias() {
  try {
    const ss = SpreadsheetApp.openById(SS_ID);
    const sh = ss.getSheetByName(NOMBRE_HOJA_INCIDENCIAS);
    const lastRow = sh.getLastRow();
    let items = [];

    // CAMBIO: Ahora leemos 11 columnas (A hasta K) para incluir la CATEGORÍA
    if (lastRow >= 2) {
      const data = sh.getRange(2, 1, lastRow - 1, 11).getValues();
      items = data
        .filter(r => String(r[8]).trim().toUpperCase() === 'PENDIENTE')
        .map(r => ({
          ts: r[0],
          hora: r[0] ? Utilities.formatDate(new Date(r[0]), TZ, "HH:mm") : "00:00",
          profesor: String(r[3]),
          aula: String(r[5]),
          observaciones: String(r[6]),
          tipo: String(r[7]).toUpperCase(),
          estado: String(r[8]).toUpperCase(),
          id: String(r[9]),
          categoria: String(r[10] || 'GUARDIA').toUpperCase() // Columna K: GUARDIA o TIC
        }));
    }
    const resultado = { items: items.reverse() };
    CacheService.getScriptCache().put("CACHE_INCIDENCIAS", JSON.stringify(resultado), 21600);
    return resultado;
  } catch (e) { return { items: [] }; }
}

// --- CACHÉ DE MENSAJES ---
function getMensajesCheados() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("CACHE_MENSAJES");
  if (cached != null) return JSON.parse(cached);
  return actualizarCacheMensajes();
}

function actualizarCacheMensajes() {
  try {
    const ss = SpreadsheetApp.openById(SS_ID);
    const sh = ss.getSheetByName(NOMBRE_HOJA_MENSAJES);
    let items = [];

    if (sh && sh.getLastRow() >= 2) {
      const data = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
      items = data.map(r => ({
        id: String(r[0]),
        ts: r[1],
        autor: String(r[2]),
        texto: String(r[3]),
        inicio: r[4],
        fin: r[5],
        periodoDesde: String(r[6]),
        periodoHasta: String(r[7]),
        ts_str: r[1] ? Utilities.formatDate(new Date(r[1]), TZ, "dd/MM HH:mm") : ""
      })).reverse();
    }

    CacheService.getScriptCache().put("CACHE_MENSAJES", JSON.stringify(items), 21600);
    return items;
  } catch (e) { return []; }
}


/** ====== FUNCIÓN DE ENTRADA (ROUTER) ====== **/

function doGet(e) {
  try {
    const view = (e && e.parameter && e.parameter.view) ? e.parameter.view : 'form';
    let archivo = 'formulario_asistencia';

    if (view === 'panel') archivo = 'panel';      // Panel de Guardia (TV)
    if (view === 'tic') archivo = 'panel_tic';    // Panel TIC (Tu monitor)
    if (view === 'jefatura') archivo = 'panel_jefatura'; // Panel de Jefatura
    if (view === 'direccion') archivo = 'panel_direccion';

    return HtmlService.createTemplateFromFile(archivo).evaluate()
      .setTitle('Buru-Guardia - IES Sáenz de Buruaga')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    return HtmlService.createHtmlOutput("<h1>Error de Carga</h1><p>" + err.toString() + "</p>");
  }
}

function obtenerNombreCompleto(email) {
  if (!email) return "Profesor";
  try {
    const user = AdminDirectory.Users.get(email);
    return user.name.fullName || email.split('@')[0];
  } catch (e) {
    const prefijo = email.split('@')[0];
    return prefijo.charAt(0).toUpperCase() + prefijo.slice(1);
  }
}

/** ====== GESTIÓN DE INCIDENCIAS (CON CACHÉ) ====== **/

function registrarIncidencia(datos) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.openById(SS_ID);
    const sh = ss.getSheetByName(NOMBRE_HOJA_INCIDENCIAS);
    const d = new Date();
    const email = Session.getActiveUser().getEmail();
    const id = 'A-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // CAMBIO: Si no viene categoría, asumimos GUARDIA.
    const categoria = datos.categoria || 'GUARDIA';

    // Escribimos 11 columnas (La K es la categoría)
    sh.appendRow([
      d.getTime(),
      Utilities.formatDate(d, TZ, 'yyyy-MM-dd'),
      Utilities.formatDate(d, TZ, 'HH:mm:ss'),
      obtenerNombreCompleto(email),
      email,
      datos.aula || "N/A",
      datos.observaciones || "",
      datos.tipo || "NORMAL",
      'PENDIENTE',
      id,
      categoria
    ]);

    actualizarCacheIncidencias(); // ACTUALIZA RAM
    return { ok: true, id: id };
  } catch (e) { return { ok: false, msg: e.toString() }; }
  finally { lock.releaseLock(); }
}

// Para el Panel de GUARDIA: Filtramos para que NO salgan las de TIC
function listarPendientesSimple() {
  const data = getIncidenciasCheadas();
  const filtrados = data.items.filter(i => i.categoria !== 'TIC');
  return { items: filtrados };
}

// NUEVO: Para tu Panel TIC: Filtramos SOLO las de TIC
function listarPendientesTIC() {
  const data = getIncidenciasCheadas();
  const filtrados = data.items.filter(i => i.categoria === 'TIC');
  return { items: filtrados };
}

function marcarAtendida(id) {
  try {
    const ss = SpreadsheetApp.openById(SS_ID);
    const sh = ss.getSheetByName(NOMBRE_HOJA_INCIDENCIAS);
    const data = sh.getRange(2, 10, sh.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        sh.getRange(i + 2, 9).setValue('ATENDIDA');
        actualizarCacheIncidencias(); // ACTUALIZA RAM
        return { ok: true };
      }
    }
  } catch (e) { return { ok: false }; }
}

function checkEstadoIncidencia(id) {
  const cachedData = getIncidenciasCheadas();
  const incidencia = cachedData.items.find(it => it.id === id);

  if (incidencia) {
    return { estado: 'PENDIENTE', total: cachedData.items.length };
  } else {
    return { estado: 'ATENDIDA', total: 0 };
  }
}

function contarPendientesGlobales() {
  const data = getIncidenciasCheadas();
  // Solo contamos las de guardia para el badge del profesor
  return data.items.filter(i => i.categoria !== 'TIC').length;
}

/** ====== GESTIÓN DE MENSAJES DIRECCIÓN ====== **/
// (Esta parte se mantiene idéntica a tu fichero original)

function guardarMensajeDireccion(datos) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SS_ID);
    let sh = ss.getSheetByName(NOMBRE_HOJA_MENSAJES);
    if (!sh) sh = ss.insertSheet(NOMBRE_HOJA_MENSAJES);
    const email = Session.getActiveUser().getEmail();
    const id = 'M-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    sh.appendRow([id, new Date(), obtenerNombreCompleto(email), datos.texto, datos.inicio, datos.fin, datos.periodoDesde, datos.periodoHasta]);
    actualizarCacheMensajes();
    return { ok: true };
  } catch (e) { return { ok: false }; }
  finally { lock.releaseLock(); }
}

function listarAvisosActivos() {
  const allMsgs = getMensajesCheados();
  const now = new Date();
  return allMsgs.filter(m => {
    const start = new Date(m.inicio);
    const end = new Date(m.fin);
    return now >= start && now <= end;
  }).map(r => ({ id: r.id, autor: r.autor, texto: r.texto, ts_str: r.ts_str }));
}

function listarMensajesAdmin() { return getMensajesCheados(); }

function borrarMensajeDireccion(id) {
  try {
    const ss = SpreadsheetApp.openById(SS_ID);
    const sh = ss.getSheetByName(NOMBRE_HOJA_MENSAJES);
    const data = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        sh.deleteRow(i + 2);
        actualizarCacheMensajes();
        return true;
      }
    }
  } catch (e) { return false; }
}

/** ====== LIMPIEZA AUTOMÁTICA ====== **/
function mantenimientoDiario() {
  try {
    const ss = SpreadsheetApp.openById(SS_ID);
    const shInc = ss.getSheetByName(NOMBRE_HOJA_INCIDENCIAS);
    let shArc = ss.getSheetByName("Archivo_Incidencias");
    if (!shArc) {
      shArc = ss.insertSheet("Archivo_Incidencias");
      // Añadimos Categoría a la cabecera
      shArc.appendRow(["TS", "Fecha", "Hora", "Nombre", "Email", "Aula", "Obs", "Tipo", "Estado", "ID", "Categoria"]);
    }
    const lastRow = shInc.getLastRow();
    if (lastRow < 2) return;

    // CAMBIO: Leemos 11 columnas para mover también la categoría
    const data = shInc.getRange(2, 1, lastRow - 1, 11).getValues();

    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i];
      if (String(row[8]).trim().toUpperCase() === 'ATENDIDA') {
        shArc.appendRow(row);
        shInc.deleteRow(i + 2);
      }
    }
    console.log("Mantenimiento finalizado.");
    actualizarCacheIncidencias();
  } catch (e) { console.error("Error: " + e); }
}

/** ====== CANCELAR INCIDENCIA ====== **/
function cancelarIncidencia(id) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SS_ID);
    const sh = ss.getSheetByName(NOMBRE_HOJA_INCIDENCIAS);
    const data = sh.getRange(2, 10, sh.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        sh.getRange(i + 2, 9).setValue('CANCELADA');
        actualizarCacheIncidencias();
        return { ok: true };
      }
    }
    return { ok: false, msg: "No encontrada" };
  } catch (e) { return { ok: false, msg: e.toString() }; }
  finally { lock.releaseLock(); }
}

// Para el Panel de JEFATURA (Devuelve todo para filtrar en el cliente)
function listarTodoJefatura() {
  const data = getIncidenciasCheadas();
  return { items: data.items };
}

/**
 * Función auxiliar para incluir archivos HTML dentro de otros.
 * Es necesaria para que funcione <?!= include('...'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
// v1.0.1 - Sincronizado localmente con README actualizado
