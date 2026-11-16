/**
 * AULA LECTOESCRITORA — Puente con Google Drive
 *
 * Qué hace:
 *  - El docente publica actividades (con archivo opcional) → se guardan en PUBLISH_FOLDER_ID.
 *  - Los alumnos suben tareas (PDF o imagen)               → se guardan en SUBMIT_FOLDER_ID.
 *  - El sitio web lee la lista de actividades desde aquí.
 *
 * Instalación: ver README.md (sección "Conectar Google Drive").
 */

// ===== Carpetas de Drive =====
var PUBLISH_FOLDER_ID = '1WArxgWQyJphmNd-3fnZG6iUed6OEovuR'; // actividades publicadas
var SUBMIT_FOLDER_ID  = '16pwgFSuTzFqMfNjrVy7oX49egifq5Wki'; // tareas de los alumnos

// ===== Clave del panel docente =====
// Por defecto es 123. Para cambiarla sin tocar el código:
// Configuración del proyecto (engranaje) → Propiedades de la secuencia de comandos → TEACHER_PASSWORD
var DEFAULT_PASSWORD = '123';

var MAX_BYTES = 8 * 1024 * 1024; // 8 MB por archivo
var PUBLISH_EXT = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'];
var SUBMIT_EXT  = ['pdf', 'png', 'jpg', 'jpeg'];
var MIME = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};
var UNIT_NAMES = [
  'Investigamos noticias', 'Leemos narraciones', 'Inventamos acrósticos', 'Conozcamos los mitos',
  'Dramatizamos historias', 'Contamos leyendas', 'Leemos crónicas', 'Escribimos reportajes'
];
var CACHE_KEY = 'aula_actividades_v1';

/* ---------- Ejecuta esta función UNA vez para autorizar el acceso a Drive ---------- */
function autorizar() {
  DriveApp.getFolderById(PUBLISH_FOLDER_ID).getName();
  DriveApp.getFolderById(SUBMIT_FOLDER_ID).getName();
  Logger.log('Autorización correcta. Ya puedes implementar la aplicación web.');
}

/* ---------- Entradas web ---------- */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'ping';
    if (action === 'list') return json_({ ok: true, activities: listActivities_() });
    return json_({ ok: true, message: 'Aula Lectoescritora: conexión activa' });
  } catch (err) {
    return fail_('No se pudieron cargar las actividades. Inténtalo de nuevo.');
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var b = JSON.parse(e.postData.contents);
    switch (b.action) {
      case 'auth':
        requireAuth_(b.password);
        return json_({ ok: true });
      case 'publish':
        requireAuth_(b.password);
        lock.waitLock(20000);
        return json_({ ok: true, activity: publish_(b) });
      case 'delete':
        requireAuth_(b.password);
        lock.waitLock(20000);
        deleteActivity_(b.id);
        return json_({ ok: true });
      case 'submit':
        lock.waitLock(20000);
        submit_(b);
        return json_({ ok: true });
      default:
        return fail_('Acción no reconocida.');
    }
  } catch (err) {
    if (err && err.userMessage) return json_({ ok: false, error: err.userMessage, code: err.code || '' });
    return fail_('Ocurrió un error inesperado. Inténtalo de nuevo.');
  } finally {
    try { lock.releaseLock(); } catch (x) { /* sin bloqueo */ }
  }
}

/* ---------- Seguridad ---------- */
function requireAuth_(pw) {
  var real = PropertiesService.getScriptProperties().getProperty('TEACHER_PASSWORD') || DEFAULT_PASSWORD;
  if (String(pw || '') !== String(real)) throw userError_('La clave no es correcta.', 'auth');
}

/* ---------- Actividades ---------- */
function publish_(b) {
  var title = clean_(b.title, 120);
  var instructions = String(b.instructions || '').trim().slice(0, 4000);
  var unit = parseInt(b.unit, 10);
  if (!title) throw userError_('Escribe el título de la actividad.');
  if (!instructions) throw userError_('Escribe las instrucciones de la actividad.');
  if (!(unit >= 1 && unit <= 8)) throw userError_('Elige una unidad entre la 1 y la 8.');
  var resource = String(b.resource || '').trim();
  if (resource && !/^https?:\/\//i.test(resource)) throw userError_('El enlace del material debe comenzar con https://');
  var due = /^\d{4}-\d{2}-\d{2}$/.test(b.due || '') ? b.due : '';

  var id = Utilities.getUuid().replace(/-/g, '').slice(0, 14);
  var activity = {
    id: id, title: title, unit: unit, due: due,
    objective: String(b.objective || '').trim().slice(0, 400),
    instructions: instructions, resource: resource.slice(0, 500),
    attachment: null, created: new Date().toISOString()
  };

  var root = DriveApp.getFolderById(PUBLISH_FOLDER_ID);
  if (b.file && b.file.data) {
    var saved = saveFile_(getSub_(root, unitFolderName_(unit)), b.file, PUBLISH_EXT);
    try { saved.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (x) { /* política del dominio */ }
    activity.attachment = { name: saved.getName(), url: saved.getUrl(), id: saved.getId() };
  }
  root.createFile('act_' + id + '.json', JSON.stringify(activity), MimeType.PLAIN_TEXT);
  CacheService.getScriptCache().remove(CACHE_KEY);
  return activity;
}

function listActivities_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(CACHE_KEY);
  if (hit) return JSON.parse(hit);

  var out = [], files = DriveApp.getFolderById(PUBLISH_FOLDER_ID).getFiles();
  while (files.hasNext()) {
    var f = files.next(), name = f.getName();
    if (name.indexOf('act_') !== 0 || !/\.json$/.test(name)) continue;
    try { out.push(JSON.parse(f.getBlob().getDataAsString())); } catch (x) { /* archivo dañado: se omite */ }
  }
  out.sort(function (a, b) { return a.created < b.created ? 1 : -1; });
  try { cache.put(CACHE_KEY, JSON.stringify(out), 60); } catch (x) { /* demasiado grande para caché */ }
  return out;
}

function deleteActivity_(id) {
  if (!/^[a-z0-9]{6,20}$/.test(String(id || ''))) throw userError_('Actividad no válida.');
  var root = DriveApp.getFolderById(PUBLISH_FOLDER_ID);
  var files = root.getFilesByName('act_' + id + '.json');
  if (!files.hasNext()) throw userError_('La actividad ya no existe.');
  var f = files.next();
  try {
    var a = JSON.parse(f.getBlob().getDataAsString());
    if (a.attachment && a.attachment.id) DriveApp.getFileById(a.attachment.id).setTrashed(true);
  } catch (x) { /* sin adjunto */ }
  f.setTrashed(true);
  CacheService.getScriptCache().remove(CACHE_KEY);
}

/* ---------- Tareas de alumnos ---------- */
function submit_(b) {
  var unit = parseInt(b.unit, 10);
  var student = clean_(b.student, 80);
  if (!student) throw userError_('Escribe tu nombre completo.');
  if (!(unit >= 1 && unit <= 8)) throw userError_('Unidad no válida.');
  if (!b.file || !b.file.data) throw userError_('Elige el archivo de tu tarea.');

  var grade = clean_(b.grade, 40), activity = clean_(b.activity, 80);
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
  var e = fileExt_(b.file.name);
  var parts = [student, grade, activity || 'Tarea de la unidad', stamp].filter(String);
  var target = getSub_(DriveApp.getFolderById(SUBMIT_FOLDER_ID), unitFolderName_(unit));
  saveFile_(target, { name: parts.join(' - ') + '.' + e, data: b.file.data }, SUBMIT_EXT);
}

/* ---------- Auxiliares ---------- */
function saveFile_(folder, file, allowed) {
  var e = fileExt_(file.name);
  if (allowed.indexOf(e) === -1) throw userError_('Tipo de archivo no permitido. Usa: ' + allowed.join(', ').toUpperCase() + '.');
  if (String(file.data).length * 0.75 > MAX_BYTES) throw userError_('El archivo supera los ' + (MAX_BYTES / 1048576) + ' MB.');
  var base = clean_(String(file.name).replace(/\.[^.]+$/, ''), 110) || 'archivo';
  var bytes = Utilities.base64Decode(file.data);
  var blob = Utilities.newBlob(bytes, MIME[e], base + '.' + e);
  return folder.createFile(blob);
}
function unitFolderName_(n) { return 'Unidad ' + n + ' - ' + UNIT_NAMES[n - 1]; }
function getSub_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function fileExt_(name) { var m = /\.([A-Za-z0-9]+)$/.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; }
function clean_(s, max) {
  return String(s || '').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function userError_(msg, code) { return { userMessage: msg, code: code || '' }; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fail_(m) { return json_({ ok: false, error: m }); }
