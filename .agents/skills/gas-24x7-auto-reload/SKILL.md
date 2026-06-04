---
name: Auto-Reload 24/7 en Google Apps Script
description: Patrón de rediseño para solventar la congelación de aplicaciones web GAS que operan ininterrumpidamente, usando un parámetro ?version= para forzar la recarga sin caché.
---

# Auto-Reload ininterrumpido en GAS (24/7)

## 📌 El Problema (Síntoma de pantalla o Kioscos congelados)
Las aplicaciones web construidas en Google Apps Script (Hojas de cálculo, etc.) que se dejan abiertas semanas encendidas en un monitor (como un Kiosco o panel de notificaciones) a menudo dejan de mostrar datos nuevos y se "congelan".

La causa es que las sesiones activas en navegadores **expiran por seguridad** al pasar varias horas o días, anulando subrepticiamente las credenciales que posibilitan el éxito de `google.script.run`. Al fallar, si no se manejan de manera preventiva en un `withFailureHandler`, los bucles que usan `setInterval` o `setTimeout` se interrumpen permanentemente, deteniendo la conexión entre el frontend y el backend silenciosamente.

## 🛠️ La Solución en esta Skill
Es necesario forzar un "Hard Reset" (redirección) automático hacia la propia página cuando se den fallos consecutivos continuados usando el parámetro **version** generado por tiempo. De esta forma la URL varía, ignorará y romperá la caché de Apps Script y obligará al navegador kiosco a establecer una nueva sesión Google con normalidad.

### Pasos
1. Obtener la variable original de `ScriptApp.getService().getUrl()` para evitar bloqueos por CORS entre servidores locales o iframes.
2. Contar `fallosConsecutivos` para no molestar por una caída de WiFi momentánea de un par de segundos, pero hacerlo reactivo ante fallos críticos (+3 caídas seguidas de sesión).
3. Redirigir el marco principal `window.top.location` al URL real, adjuntando la variable `?version=` con `Date.now()` para destruir la inercia de memoria y caché.

### Plantilla Recomendada de Implementación
Inserta un flujo similar a este en la Vista Front HTML donde realizas el bucle o "Polling":

```html
<script>
  // Importante: Inyectar del backend al script el URL real del proxy
  const appUrl = "<?= ScriptApp.getService().getUrl() ?>";
  const vistaActual = "panel_principal"; // Parámetro o ruta deseada opcional
  let fallosConsecutivos = 0; 
  const POLL_MS = 5000;

  function bucleTick() {
      google.script.run
        .withSuccessHandler(function(response) {
            fallosConsecutivos = 0; // Se reposta la bandera
            // [ --- TU LÓGICA DE DIBUJADO DE LA APP AQUÍ --- ]

            // Volver a llamar tras procesar correctamente
            setTimeout(bucleTick, POLL_MS);
        })
        .withFailureHandler(function(error) {
            fallosConsecutivos++;
            
            // Evaluamos si el token GAS ha explotado (intentos críticos)
            if (fallosConsecutivos >= 3) {
                 // RESET CACHE BUST: Refresco íntegro con timestamp único para omitir proxies
                 // Ojo al queryParam version=...
                 window.top.location.href = appUrl + "?view=" + vistaActual + "&version=" + Date.now();
            } else {
                 // Retraso de cortesía para reintentos normales de conexión suave
                 setTimeout(bucleTick, POLL_MS + 3000);
            }
        })
        .funcionDelBackendGoogleScript(); 
  }

  // Inicializar 
  document.addEventListener('DOMContentLoaded', bucleTick);
</script>
```

Con implementar esta arquitectura en todo panel autogestionado en la web, el proyecto quedará blindado de congelamiento y nunca abandonará el "refresco eterno" sin importar expiraciones de token por parte de Google.
