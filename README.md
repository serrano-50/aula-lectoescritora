# Aula Lectoescritora

Plataforma web (GitHub Pages) para docentes y alumnos de Comunicación y Literatura.
Tema sepia, menú ampliado, panel docente con clave, publicación de actividades en las 8 unidades y entrega de tareas en Google Drive.

## Estructura
```
index.html · unidades.html · estudiante.html · actividad.html · docente.html · 404.html
css/styles.css          estilos (tema sepia)
js/config.js            ← único archivo que editas (URL del puente de Drive, APK, imagen)
js/app.js               lógica del sitio
apps-script/Code.gs     puente con Google Drive (se pega en Google Apps Script)
assets/                 favicon, imagen de la app (app-screen.jpg) y APK
```

## Cómo funciona
GitHub Pages solo aloja archivos estáticos y no puede escribir en Drive. Por eso `apps-script/Code.gs`
se publica como una pequeña aplicación web de Google (gratuita) que:
- guarda las actividades del docente en la carpeta **Actividades** de Drive (con una subcarpeta por unidad),
- guarda las tareas de los alumnos en la carpeta **Tareas** (subcarpeta por unidad),
- entrega la lista de actividades a la página de los estudiantes.

Las dos carpetas ya están configuradas en `Code.gs`. Tu cuenta de Google debe ser propietaria o editora de ambas.

## 1. Conectar Google Drive (una sola vez, ~5 minutos)
1. Entra a https://script.google.com con la cuenta dueña de las carpetas → **Nuevo proyecto**.
2. Borra el código de ejemplo y pega todo el contenido de `apps-script/Code.gs`. Guarda.
3. En la lista de funciones elige **autorizar** y pulsa **Ejecutar**. Acepta los permisos de Drive
   (si aparece "Google no ha verificado esta app": *Avanzado → Ir a (proyecto)*; es tu propio script).
4. **Implementar → Nueva implementación → tipo: Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
5. Copia la **URL de la aplicación web** (termina en `/exec`).
6. Abre `js/config.js` y pégala en `API_URL`. Guarda.

> Si más adelante cambias `Code.gs`, usa **Implementar → Administrar implementaciones → Editar → Nueva versión**; la URL no cambia.

## 2. Imagen del celular (página de inicio)
- Mejor opción: descarga la imagen de Drive y guárdala como `assets/app-screen.jpg`.
- Mientras tanto se usa la de Drive (`APP_IMAGE_DRIVE_ID` en `config.js`). Para eso el archivo debe estar compartido como
  **“Cualquier persona con el enlace”**.

## 3. Publicar en GitHub Pages
1. Crea un repositorio nuevo en GitHub y sube **todo el contenido** de esta carpeta (incluido `.nojekyll`).
2. **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save**.
3. En 1–2 minutos tendrás la URL `https://TU-USUARIO.github.io/NOMBRE-REPO/`. Compártela con alumnos.

## Uso
- **Docente:** `docente.html` → clave **123** → elige unidad → publica (título, instrucciones, enlace o archivo). Puede eliminar publicaciones y abrir las carpetas de Drive.
- **Alumnos:** `estudiante.html` ven las actividades y las filtran por unidad; en cada unidad tocan **Subir tarea** (PDF, JPG o PNG, máx. 8 MB).

## Cambiar la clave de 123
En Apps Script: ⚙ **Configuración del proyecto → Propiedades de la secuencia de comandos → Añadir propiedad**
`TEACHER_PASSWORD` = tu nueva clave. No hay que volver a implementar.

## Seguridad: lo que conviene saber
- La clave se **valida en el servidor** (Apps Script): sin ella nadie puede publicar ni eliminar actividades, aunque conozca la URL del puente.
- Es una clave simple; la clave **123** es fácil de adivinar. Se recomienda cambiarla.
- Cualquier persona con la URL del sitio puede *enviar* tareas (no hay cuentas de alumno). Si hay abuso, cambia la implementación del script o pide a los alumnos el nombre completo (ya es obligatorio).
- Los archivos adjuntos de las actividades quedan como “cualquiera con el enlace puede ver”, para que los alumnos los abran. Las tareas de los alumnos **no** se hacen públicas.

## Modo demostración
Si `API_URL` está vacío, el sitio funciona solo en el navegador (la clave es 123, lo publicado se guarda localmente y no se sube nada a Drive). Sirve para probar el diseño.
