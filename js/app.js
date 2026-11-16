(function () {
  "use strict";

  /* ================= Configuración y datos ================= */
  var CFG = Object.assign({ API_URL: "", APK_URL: "", APP_IMAGE_DRIVE_ID: "", SUBMISSIONS_FOLDER_URL: "", PUBLISHED_FOLDER_URL: "", MAX_MB: 8 }, window.AULA_CONFIG || {});
  var DEMO = !CFG.API_URL;

  var UNITS = [
    ["Investigamos noticias", "📰", "Periódico digital escolar", "Detectives de noticias"],
    ["Leemos narraciones", "📖", "Libro digital de aventuras interactivas", "Construyamos una aventura"],
    ["Inventamos acrósticos", "🌻", "Galería digital de acrósticos y poesía visual", "Palabras que se convierten en poesía"],
    ["Conozcamos los mitos", "🌙", "Museo digital de mitos salvadoreños", "Exploradores de mitos salvadoreños"],
    ["Dramatizamos historias", "🎭", "Festival digital de teatro escolar", "De lectores a guionistas"],
    ["Contamos leyendas", "🗺️", "Atlas digital de leyendas salvadoreñas", "Exploradores de leyendas y lugares misteriosos"],
    ["Leemos crónicas", "📝", "Revista digital de crónicas escolares", "De lectores a cronistas"],
    ["Escribimos reportajes", "🎙️", "Noticiero y revista digital estudiantil", "Jóvenes reporteros en acción"]
  ];
  var STAGES = [
    ["Activamos nuestros conocimientos", "Recupera lo que ya sabes. ¿Qué experiencias, ideas o lecturas puedes compartir sobre este tema?"],
    ["Una pregunta para despertar tu curiosidad", "Piensa en el reto: ¿qué te gustaría descubrir o resolver? Comparte tus primeras ideas."],
    ["Observamos y descubrimos", "Explora las imágenes, videos, lecturas o ejemplos que ha compartido tu docente. Identifica detalles importantes."],
    ["Trabajamos en equipo", "En parejas o tríos, conversen, investiguen y construyan una respuesta o producción propia."],
    ["Compartimos lo que creamos", "Presenta tus resultados, explica tus decisiones y escucha las ideas de tus compañeros."],
    ["Reflexionamos sobre lo aprendido", "¿Qué aprendiste? ¿Qué hiciste bien? ¿Qué puedes mejorar en tu próximo reto?"]
  ];
  var PUB_EXT = ["pdf", "doc", "docx", "png", "jpg", "jpeg"];
  var SUB_EXT = ["pdf", "png", "jpg", "jpeg"];
  var SESSION_KEY = "aulaDocenteClave";
  var DEMO_KEY = "aulaDemoActividades";

  /* ================= Utilidades ================= */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? esc(u) : ""; }
  function fmtDate(d) {
    if (!d) return "";
    var x = new Date(d + "T00:00:00");
    return isNaN(x) ? "" : x.toLocaleDateString("es-SV", { day: "numeric", month: "long", year: "numeric" });
  }
  function ext(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ""); return m ? m[1].toLowerCase() : ""; }
  function checkFile(file, allowed) {
    if (allowed.indexOf(ext(file.name)) === -1) {
      return "Este tipo de archivo no es válido. Usa: " + allowed.join(", ").toUpperCase() + ".";
    }
    if (file.size > CFG.MAX_MB * 1024 * 1024) return "El archivo pesa más de " + CFG.MAX_MB + " MB. Reduce su tamaño e inténtalo otra vez.";
    return "";
  }
  function toBase64(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(",")[1]); };
      r.onerror = function () { rej(new Error("No se pudo leer el archivo.")); };
      r.readAsDataURL(file);
    });
  }
  function setFeedback(el, msg, ok) {
    if (!el) return;
    el.textContent = msg;
    el.className = "feedback" + (msg ? (ok ? " ok" : " bad") : "");
  }
  function bindDropzone(input, label) {
    var box = $(".t", label), small = $("small", label), base = small.textContent;
    input.addEventListener("change", function () {
      small.textContent = input.files.length ? input.files[0].name : base;
    });
    return function reset() { small.textContent = base; };
  }

  /* ================= Comunicación con Google Drive (Apps Script) ================= */
  function request(url, opts) {
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () { throw new Error("El aula respondió algo inesperado. Inténtalo de nuevo en un momento."); });
    }, function () {
      throw new Error("No se pudo conectar con el aula. Revisa tu conexión e inténtalo de nuevo.");
    }).then(function (data) {
      if (!data.ok) { var e = new Error(data.error || "Ocurrió un error. Inténtalo de nuevo."); e.code = data.code; throw e; }
      return data;
    });
  }
  function post(action, payload) {
    // Content-Type por defecto (text/plain) evita el preflight CORS con Apps Script.
    return request(CFG.API_URL, { method: "POST", body: JSON.stringify(Object.assign({ action: action }, payload)) });
  }
  function demoGet() { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); } catch (e) { return []; } }
  function demoSet(v) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(v)); } catch (e) { /* sin espacio */ } }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var api = {
    list: function () {
      if (DEMO) return Promise.resolve(demoGet());
      return request(CFG.API_URL + "?action=list").then(function (d) { return d.activities || []; });
    },
    auth: function (pw) {
      if (DEMO) return pw === "123" ? Promise.resolve() : Promise.reject(new Error("La clave no es correcta."));
      return post("auth", { password: pw });
    },
    publish: function (p) {
      if (DEMO) {
        var list = demoGet();
        list.unshift({ id: "demo" + Date.now().toString(36), title: p.title, unit: Number(p.unit), due: p.due, objective: p.objective, instructions: p.instructions, resource: p.resource, attachment: p.file ? { name: p.file.name, url: "" } : null, created: new Date().toISOString() });
        demoSet(list);
        return wait(500);
      }
      return post("publish", p);
    },
    remove: function (pw, id) {
      if (DEMO) { demoSet(demoGet().filter(function (a) { return a.id !== id; })); return Promise.resolve(); }
      return post("delete", { password: pw, id: id });
    },
    submit: function (p) { return DEMO ? wait(700) : post("submit", p); }
  };

  /* ================= Interfaz común ================= */
  function setupNav() {
    var btn = $(".nav-toggle"), nav = $("#menu");
    if (!btn || !nav) return;
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open);
      btn.textContent = open ? "Cerrar" : "Menú";
    });
  }
  function renderUnits(sel) {
    var el = $(sel); if (!el) return;
    el.innerHTML = UNITS.map(function (u, i) {
      return '<a class="unit-card" href="actividad.html?unidad=' + (i + 1) + '"><span class="unit-emoji emo" aria-hidden="true">' + u[1] + '</span><small>Unidad ' + (i + 1) + '</small><b>' + esc(u[0]) + '</b><span class="prod">' + esc(u[2]) + '</span></a>';
    }).join("");
  }
  function activityCard(a, opt) {
    opt = opt || {};
    var u = UNITS[(a.unit || 1) - 1] || UNITS[0], links = "";
    if (safeUrl(a.resource)) links += '<a class="chip-link" href="' + safeUrl(a.resource) + '" target="_blank" rel="noopener">Abrir material</a>';
    if (a.attachment && safeUrl(a.attachment.url)) links += '<a class="chip-link" href="' + safeUrl(a.attachment.url) + '" target="_blank" rel="noopener">Ver archivo: ' + esc(a.attachment.name) + "</a>";
    else if (a.attachment && a.attachment.name) links += '<span class="tag">Archivo: ' + esc(a.attachment.name) + " (demostración)</span>";
    if (opt.submit) links += '<a class="chip-link strong" href="actividad.html?unidad=' + a.unit + "&actividad=" + encodeURIComponent(a.id) + '#entrega">Entregar tarea</a>';
    if (opt.remove) links += '<button type="button" class="btn btn-danger btn-small" data-remove="' + esc(a.id) + '">Eliminar</button>';
    return '<article class="act"><div class="act-top"><span class="tag"><span class="emo" aria-hidden="true">' + u[1] + "</span> Unidad " + a.unit + " · " + esc(u[0]) + "</span>" +
      (a.due ? '<span class="due">Entrega: ' + fmtDate(a.due) + "</span>" : "") + "</div><h3>" + esc(a.title) + "</h3>" +
      (a.objective ? '<p class="act-obj"><b>Objetivo:</b> ' + esc(a.objective) + "</p>" : "") +
      '<p class="act-ins">' + esc(a.instructions) + '</p><div class="act-links">' + links + "</div></article>";
  }
  function loadingMsg(el) { el.innerHTML = '<p class="empty">Cargando actividades…</p>'; }
  function errorMsg(el, e) { el.innerHTML = '<p class="empty error">' + esc(e.message) + "</p>"; }

  /* ================= Inicio ================= */
  function initHome() {
    var img = $("#app-shot");
    if (img) {
      var tries = 0, id = CFG.APP_IMAGE_DRIVE_ID;
      img.addEventListener("error", function () {
        tries++;
        if (tries === 1 && id) { img.src = "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w900"; }
        else { img.hidden = true; $("#app-fallback").hidden = false; }
      });
      if (img.complete && img.naturalWidth === 0) img.dispatchEvent(new Event("error"));
    }
    var apk = $("#apk-link");
    if (apk) {
      if (safeUrl(CFG.APK_URL)) { apk.href = CFG.APK_URL; apk.setAttribute("download", ""); }
      else apk.addEventListener("click", function (e) { e.preventDefault(); alert("La aplicación APK estará disponible cuando se publique la versión móvil."); });
    }
  }

  /* ================= Estudiante ================= */
  function initStudent() {
    renderUnits("#student-units");
    var box = $("#student-activity-list"), bar = $("#unit-filters"), items = [];
    var current = Number(new URLSearchParams(location.search).get("unidad")) || 0;
    function draw() {
      $$("button", bar).forEach(function (b) { b.setAttribute("aria-pressed", Number(b.dataset.u) === current); });
      var vis = items.filter(function (a) { return !current || a.unit === current; });
      box.innerHTML = vis.length ? '<div class="acts">' + vis.map(function (a) { return activityCard(a, { submit: true }); }).join("") + "</div>"
        : '<p class="empty">' + (current ? "Todavía no hay actividades en esta unidad." : "Cuando tu docente publique actividades, aparecerán aquí.") + "</p>";
    }
    bar.innerHTML = '<button type="button" data-u="0">Todas</button>' + UNITS.map(function (u, i) { return '<button type="button" data-u="' + (i + 1) + '">' + (i + 1) + ". " + esc(u[0]) + "</button>"; }).join("");
    bar.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) { current = Number(b.dataset.u); draw(); } });
    loadingMsg(box);
    api.list().then(function (l) { items = l; draw(); }, function (e) { errorMsg(box, e); });
  }

  /* ================= Unidades ================= */
  function initUnits() { renderUnits("#all-units"); }

  /* ================= Actividad de una unidad ================= */
  function initActivity() {
    var params = new URLSearchParams(location.search);
    var n = Math.max(1, Math.min(8, Number(params.get("unidad")) || 1)), u = UNITS[n - 1];
    document.title = u[3] + " | Aula Lectoescritora";
    $("#activity-unit").textContent = "Unidad " + n + " · " + u[0];
    $("#activity-title").textContent = u[3];
    $("#activity-intro").textContent = "Producto integrador: " + u[2] + ". Sigue la ruta de aprendizaje y comparte tu creación.";

    var stage = 0, prev = $("#previous-stage"), next = $("#next-stage");
    function update() {
      $("#stage-number").textContent = "Etapa " + (stage + 1) + " de 6";
      $("#stage-title").textContent = STAGES[stage][0];
      $("#stage-description").textContent = STAGES[stage][1];
      $("#stage-count").textContent = (stage + 1) + " de 6";
      $("#progress-fill").style.width = ((stage + 1) / 6 * 100) + "%";
      prev.disabled = stage === 0;
      next.textContent = stage === 5 ? "Volver a la primera etapa" : "Siguiente etapa";
    }
    prev.addEventListener("click", function () { stage = Math.max(0, stage - 1); update(); });
    next.addEventListener("click", function () { stage = stage === 5 ? 0 : stage + 1; update(); });
    update();

    // Actividades publicadas para esta unidad
    var box = $("#unit-activities"), select = $("#activity-select"), wanted = params.get("actividad");
    loadingMsg(box);
    api.list().then(function (all) {
      var items = all.filter(function (a) { return a.unit === n; });
      box.innerHTML = items.length ? '<div class="acts">' + items.map(function (a) { return activityCard(a); }).join("") + "</div>"
        : '<p class="empty">Tu docente todavía no ha publicado actividades en esta unidad.</p>';
      items.forEach(function (a) {
        var o = document.createElement("option");
        o.value = a.id; o.textContent = a.title; o.dataset.title = a.title;
        if (a.id === wanted) o.selected = true;
        select.appendChild(o);
      });
    }, function (e) { errorMsg(box, e); });

    // Entrega de tarea
    var form = $("#submit-form"), fileInput = $("#student-file"), fb = $("#submit-feedback"), btn = $("#submit-btn");
    var resetDrop = bindDropzone(fileInput, fileInput.closest(".dropzone"));
    if (DEMO) $("#demo-note").hidden = false;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setFeedback(fb, "");
      var f = fileInput.files[0];
      if (!f) return setFeedback(fb, "Elige el archivo de tu tarea (PDF o imagen).");
      var err = checkFile(f, SUB_EXT);
      if (err) return setFeedback(fb, err);
      btn.disabled = true; btn.textContent = "Subiendo tu tarea…";
      var opt = select.selectedOptions[0];
      toBase64(f).then(function (data) {
        return api.submit({ unit: n, student: form.elements.student.value.trim(), grade: form.elements.grade.value.trim(), activity: opt && opt.dataset.title ? opt.dataset.title : "", file: { name: f.name, data: data } });
      }).then(function () {
        setFeedback(fb, DEMO ? "Modo demostración: la tarea no se envió a Drive porque el aula aún no está conectada." : "¡Tarea enviada! Tu docente ya puede verla.", true);
        form.reset(); resetDrop();
      }).catch(function (er) { setFeedback(fb, er.message); })
        .then(function () { btn.disabled = false; btn.textContent = "Subir tarea"; });
    });
  }

  /* ================= Docente ================= */
  function initTeacher() {
    var gate = $("#gate"), app = $("#teacher-app"), gform = $("#gate-form"), gfb = $("#gate-feedback");
    var list = $("#published-list"), items = [], filter = 0;
    var pw = sessionStorage.getItem(SESSION_KEY) || "";
    if (DEMO) $("#demo-note").hidden = false;
    $("#link-submissions").href = safeUrl(CFG.SUBMISSIONS_FOLDER_URL) || "#";
    $("#link-published").href = safeUrl(CFG.PUBLISHED_FOLDER_URL) || "#";

    function unlock(p) {
      pw = p; sessionStorage.setItem(SESSION_KEY, p);
      gate.hidden = true; app.hidden = false; load();
    }
    function lock(msg) {
      pw = ""; sessionStorage.removeItem(SESSION_KEY);
      gate.hidden = false; app.hidden = true;
      if (msg) setFeedback(gfb, msg);
    }
    gform.addEventListener("submit", function (e) {
      e.preventDefault();
      var p = gform.elements.clave.value, b = $("button", gform);
      b.disabled = true; setFeedback(gfb, "");
      api.auth(p).then(function () { gform.reset(); unlock(p); }, function (er) { setFeedback(gfb, er.message); })
        .then(function () { b.disabled = false; });
    });
    $("#logout").addEventListener("click", function () { lock(""); });
    if (pw) api.auth(pw).then(function () { unlock(pw); }, function () { lock(""); });

    // Resumen por unidad
    var tu = $("#teacher-units");
    tu.innerHTML = UNITS.map(function (u, i) {
      return '<button type="button" data-u="' + (i + 1) + '"><span class="emo" aria-hidden="true" style="font-size:1.6rem">' + u[1] + '</span><span>' + (i + 1) + ". " + esc(u[0]) + '<small data-count="' + (i + 1) + '">0 actividades</small></span></button>';
    }).join("");
    tu.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      $("#unit-select").value = b.dataset.u;
      $("#crear").scrollIntoView({ behavior: "smooth" });
      $("#title").focus({ preventScroll: true });
    });

    // Filtro de la lista
    var bar = $("#teacher-filters");
    bar.innerHTML = '<button type="button" data-u="0">Todas</button>' + UNITS.map(function (u, i) { return '<button type="button" data-u="' + (i + 1) + '">Unidad ' + (i + 1) + "</button>"; }).join("");
    bar.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) { filter = Number(b.dataset.u); draw(); } });

    function draw() {
      $$("button", bar).forEach(function (b) { b.setAttribute("aria-pressed", Number(b.dataset.u) === filter); });
      $("#published-count").textContent = items.length + (items.length === 1 ? " publicación" : " publicaciones");
      $$("[data-count]", tu).forEach(function (s) {
        var c = items.filter(function (a) { return a.unit === Number(s.dataset.count); }).length;
        s.textContent = c + (c === 1 ? " actividad" : " actividades");
      });
      var vis = items.filter(function (a) { return !filter || a.unit === filter; });
      list.innerHTML = vis.length ? '<div class="acts">' + vis.map(function (a) { return activityCard(a, { remove: true }); }).join("") + "</div>"
        : '<p class="empty">' + (filter ? "No hay actividades en esta unidad. Usa el formulario para publicar la primera." : "Todavía no hay publicaciones. Crea tu primera actividad.") + "</p>";
    }
    function load() { loadingMsg(list); api.list().then(function (l) { items = l; draw(); }, function (e) { errorMsg(list, e); }); }

    list.addEventListener("click", function (e) {
      var b = e.target.closest("[data-remove]"); if (!b) return;
      if (!confirm("¿Eliminar esta actividad? Los alumnos dejarán de verla.")) return;
      b.disabled = true;
      api.remove(pw, b.dataset.remove).then(load, function (er) { b.disabled = false; alert(er.message); if (er.code === "auth") lock("Tu sesión terminó. Ingresa la clave de nuevo."); });
    });

    // Publicar
    var form = $("#activity-form"), fb = $("#form-feedback"), fileInput = $("#attachment"), btn = $("#publish-btn");
    var resetDrop = bindDropzone(fileInput, fileInput.closest(".dropzone"));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setFeedback(fb, "");
      var f = fileInput.files[0];
      if (f) { var err = checkFile(f, PUB_EXT); if (err) return setFeedback(fb, err); }
      btn.disabled = true; btn.textContent = "Publicando…";
      var p = { password: pw, title: form.elements.title.value.trim(), unit: form.elements.unit.value, due: form.elements.due.value, objective: form.elements.objective.value.trim(), instructions: form.elements.instructions.value.trim(), resource: form.elements.resource.value.trim() };
      (f ? toBase64(f).then(function (d) { p.file = { name: f.name, data: d }; }) : Promise.resolve())
        .then(function () { return api.publish(p); })
        .then(function () {
          setFeedback(fb, "Publicado: «" + p.title + "» ya está disponible para los alumnos.", true);
          form.reset(); resetDrop(); load();
        }, function (er) {
          setFeedback(fb, er.message);
          if (er.code === "auth") lock("Tu sesión terminó. Ingresa la clave de nuevo.");
        })
        .then(function () { btn.disabled = false; btn.textContent = "Publicar actividad"; });
    });
  }

  /* ================= Arranque ================= */
  document.addEventListener("DOMContentLoaded", function () {
    setupNav();
    var y = $("#year"); if (y) y.textContent = new Date().getFullYear();
    var page = document.body.dataset.page;
    if (page === "inicio") initHome();
    if (page === "unidades") initUnits();
    if (page === "estudiante") initStudent();
    if (page === "actividad") initActivity();
    if (page === "docente") initTeacher();
  });
})();
