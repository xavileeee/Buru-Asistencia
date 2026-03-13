# Buru-Asistencia 🏫

**Buru-Asistencia** es un sistema integral de solicitud de asistencia inmediata diseñado para el **IES Sáenz de Buruaga**. Su objetivo es permitir que los profesores soliciten ayuda directamente desde el aula de forma rápida y eficiente, enviando notificaciones en tiempo real a la sala de guardia, a la jefatura de estudios o al administrador informático (TIC).

## 📋 Descripción del Sistema

La aplicación actúa como un puente de comunicación crítica dentro del centro:
- **Desde las Aulas**: Los profesores completan un formulario sencillo indicando el aula e incidencia.
- **Hacia los Receptores**: La solicitud aparece instantáneamente en los paneles de monitorización correspondientes (Guardia o TIC), acompañada de avisos sonoros.
- **Interacción**: Los receptores disponen de un **botón para indicar que atienden la petición**, lo que actualiza el estado de la incidencia y notifica visualmente que la ayuda está en camino.
- **Gestión Centralizada**: Jefatura y Dirección pueden supervisar todas las incidencias y enviar avisos globales a todo el centro.

## 🔗 Endpoints y Vistas

La aplicación utiliza parámetros en la URL (`query parameters`) para determinar qué vista cargar. Al desplegarse como una Web App de Google, la URL base termina en `/exec`.

| Parámetro | Vista | Descripción |
| :--- | :--- | :--- |
| `(ninguno)` | **Formulario** | Para que los profesores envíen solicitudes de asistencia. |
| `?view=panel` | **Sala de Guardia** | Muestra incidencias de guardia. Incluye botón de "Atender". |
| `?view=tic` | **Soporte TIC** | Panel para el administrador informático. Muestra incidencias técnicas. |
| `?view=jefatura`| **Jefatura** | Panel de control total y gestión de todas las incidencias. |
| `?view=direccion`| **Dirección** | Interfaz para gestionar avisos globales y mensajes. |
<img width="371" height="495" alt="Image" src="https://github.com/user-attachments/assets/c3cd9988-17c0-4475-83d4-ae093d0150b5" />

<img width="371" height="300" alt="Image" src="https://github.com/user-attachments/assets/f8cb9eab-3e57-4c8b-86ab-8d2dc755bb66" />

<img width="1518" height="753" alt="Image" src="https://github.com/user-attachments/assets/add00e11-ae1c-44b8-b13f-011c69de4826" />

<img width="1111" height="496" alt="Image" src="https://github.com/user-attachments/assets/c095eb87-229e-4b60-9a96-17c238452519" />

<img width="1358" height="810" alt="Image" src="https://github.com/user-attachments/assets/490c3949-e9c3-4460-a209-f561093da8b7" />

<img width="810" height="594" alt="Image" src="https://github.com/user-attachments/assets/ffef972a-418a-46e1-a044-3750714c55b7" />


## 🚀 Despliegue (Deployment)

Para poner en marcha el sistema o actualizarlo:

### 1. Preparación y Login
Antes de nada, debes estar autenticado en tu cuenta de Google:
```bash
clasp login
```

### 2. Subida de Código
```bash
clasp push
```

### 3. Creación del Despliegue
- **Clasp**: `clasp deploy --description "Nueva Versión"`
- **Vía Web**: "Implementar" -> "Nueva implementación" -> "Aplicación web". Ejecutar como "Yo" y acceso para la "Organización".

### 4. Permisos Especiales
Es obligatorio activar la **Admin SDK API** en la sección de "Servicios" (+) del editor de Apps Script para que el sistema pueda identificar a los profesores.

## 🖥️ Hardware y Paneles Físicos (DEP)

El sistema está desplegado físicamente en varios puntos del centro mediante hardware adaptado:

- **Sala de Profesores (Panel Informativo)**: Se utiliza una **Raspberry Pi 2B** conectada por HDMI a una televisión. El sistema corre un Linux en modo Kiosco que apunta localmente a `http://172.23.60.2/buru-guardia-sala.html` (servidor Apache del centro), el cual realiza la redirección automática al panel de guardia de Google.
- **Terminales de Aula (DEP)**: Se han reutilizado dispositivos **DEP antiguos** (pantallas táctiles todo-en-uno). Al igual que la Raspberry, cargan un Linux en modo Kiosco al arrancar que apunta al endpoint de envío de incidencias a través del servidor Apache local.
- **Soportes 3D**: En la carpeta `Panel DEP/` se encuentran los ficheros **.3mf** listos para imprimir en 3D los soportes de pared diseñados específicamente para estos terminales.

## 🌐 Servidor Intermedio y Redirecciones

En el IES Sáenz de Buruaga, para facilitar el acceso a los terminales y no depender de las URLs largas y cambiantes de Google, se utiliza un sistema de redirección mediante el servidor Apache principal.

- **Ventaja**: Google genera una URL nueva con cada implementación (`ID de implementación`). En lugar de ir físicamente a cada terminal (Raspberry o DEP) a cambiar la URL en su configuración de Kiosco, solo necesitamos actualizar los archivos HTML en el servidor central.
- **Ubicación en Servidor**: Los archivos se alojan en `/var/www/html` del servidor del centro.
- **Archivos Locales**: Tienes una copia en la carpeta `redirecciones/`.
- **Procedimiento**: Cada vez que hagas un nuevo despliegue en Google Apps Script, actualiza la constante `url_destino` en estos ficheros HTML. Los terminales, al apuntar siempre a la IP del servidor local, recibirán la nueva dirección automáticamente.

### 🔥 Truco para evitar la Caché
Si tras actualizar los archivos HTML notas que los Kioscos siguen cargando la versión antigua (problemas de caché del navegador en modo kiosco), puedes forzar la actualización de la siguiente manera:

- Al modificar la `url_destino` en el HTML de redirección, añade un parámetro aleatorio al final de la URL de Google, por ejemplo:
  `const url_destino = "https://script.google.com/.../exec?v=" + Math.random();`
- Esto hará que el navegador del terminal interprete que es una dirección nueva y descarte cualquier versión en caché, cargando siempre el código más reciente.

## ⚙️ Configuración Inicial

Para que este proyecto funcione en tu propio centro, debes realizar los siguientes ajustes:

### 1. Google Sheets como Base de Datos
1. Crea una nueva Hoja de Cálculo de Google.
2. Crea tres pestañas con los nombres exactos: `Incidencias`, `Mensajes` y `Archivo_Incidencias`.
3. Copia el **ID de la hoja de cálculo** (está en la URL entre `/d/` y `/edit`).
4. Abre `Codigo.js` y sustituye el valor de la constante `SS_ID`:
   ```javascript
   const SS_ID = 'TU_ID_DE_AQUÍ';
   ```

### 2. Estructura de Columnas
Asegúrate de que las cabeceras de tus hojas sigan este orden (opcional pero recomendado):
- **Incidencias**: Timestamp, Fecha, Hora, Nombre, Email, Aula, Observaciones, Tipo, Estado, ID, Categoría.

### 3. Activar Servicios de Google
En el editor de Google Apps Script, ve a la sección de **Servicios (+)** y añade:
- **Admin SDK API**: Necesario para que la función `obtenerNombreCompleto()` pueda traducir el email del profesor a su nombre real.

## 🛠️ Tecnologías y Desarrollo

- **Motor**: Google Apps Script (GAS) con integración de `CacheService` para velocidad extrema.
- **Frontend**: HTML5, CSS (Vanilla), JavaScript (Vanilla).
- **Notificaciones**: Integración de audio mediante archivos HTML inyectados (`sonidos.html`).
- **Gestión Local**: Desarrollado y sincronizado mediante [clasp](https://github.com/google/clasp).

---
*Mantenido por el equipo del IES Sáenz de Buruaga.*

---
*Desarrollado para la comunidad educativa del IES Sáenz de Buruaga.*
