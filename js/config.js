/*
  CONFIGURACIÓN DEL AULA
  Este es el único archivo que necesitas editar después de publicar el puente de Google Drive.
  Guía paso a paso: README.md
*/
window.AULA_CONFIG = {
  // URL de la aplicación web de Google Apps Script (termina en /exec).
  // Mientras esté vacía, el sitio funciona en "modo demostración" (nada se guarda en Drive).
  API_URL: "",

  // Imagen que se muestra dentro del celular en la sección de la app (ID del archivo de Drive).
  // Recomendado: además guarda la imagen como assets/app-screen.jpg (carga más rápido y no depende de Drive).
  APP_IMAGE_DRIVE_ID: "1gNvYhS1lIEeA9CRRvSBIG4X3AtsR3FB_",

  // Enlace de descarga del APK cuando exista (puede ser un enlace de Drive o de GitHub Releases).
  APK_URL: "https://script.google.com/macros/s/AKfycbzrSAIYkeI3HK_Lx-2qolTRq19SCdDWcTEghTnfZxQ65i4zsy8IxSjLs79IkUhI8GBKiw/exec",

  // Carpeta de Drive donde llegan las tareas (botón de acceso rápido para el docente).
  SUBMISSIONS_FOLDER_URL: "https://drive.google.com/drive/folders/16pwgFSuTzFqMfNjrVy7oX49egifq5Wki",

  // Carpeta de Drive donde se acumulan las actividades publicadas.
  PUBLISHED_FOLDER_URL: "https://drive.google.com/drive/folders/1WArxgWQyJphmNd-3fnZG6iUed6OEovuR",

  // Tamaño máximo por archivo, en MB.
  MAX_MB: 8
};
