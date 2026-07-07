# 💅 Verocenter - Salón de Manicura Premium & Estética

Este proyecto contiene un sitio web premium e interactivo para **Verocenter**, diseñado con un sistema de reserva por WhatsApp, animaciones 3D al deslizar, reproducción de videos en gran formato y un panel de administración independiente.

## 🚀 Características
1. **Marca Verocenter**: Identidad visual llamativa con logotipo estilizado en degradado dorado y tipografía de lujo.
2. **Diseño de Gran Formato Multimedia**: 
   - `bg-hero.mp4` se reproduce en pantalla completa en el fondo del Hero con texto súper legible en un contenedor de cristal flotante.
   - `indexvid.webp` y `servicios.webp` actúan como fondos inmersivos en las secciones "Nosotros" y "Servicios" con capas y textos contrastados encima.
   - `promo.mp4` se reproduce en un banner de gran formato inmersivo para mostrar el salón.
3. **Movimiento 3D en Scroll**: Todos los bloques y tarjetas principales rotan y aparecen con un efecto 3D fluido conforme el usuario desliza la página (`scroll-3d`).
4. **Carta de Servicios Oficial**: Estructura mejorada según los precios reales de Verónica (Acrílicos, Soft Gel, Permanente, Hombres, Adicionales y Retiros), permitiendo a los usuarios reservar sub-servicios específicos directamente.
5. **Arquitectura Separada**:
   - **`index.html` (Cliente)**: Sitio web público, limpio y elegante, sin controles de administración visibles.
   - **`admin.html` (Administrador)**: Panel de control oculto para que Verónica configure su teléfono, edite la plantilla de mensaje de WhatsApp, pruebe simulaciones y visualice payloads JSON de auditoría. Ambos comparten configuración local a través de `localStorage`.

## 📁 Archivos del Proyecto
* [index.html](file:///C:/Users/xavi/Downloads/manicure-salon/index.html): Página principal del cliente.
* [admin.html](file:///C:/Users/xavi/Downloads/manicure-salon/admin.html): Panel de control administrativo privado.
* [styles.css](file:///C:/Users/xavi/Downloads/manicure-salon/styles.css): Hoja de estilos con variables, efectos de vidrio, animaciones y compatibilidad móvil.
* [app.js](file:///C:/Users/xavi/Downloads/manicure-salon/app.js): Lógica unificada para el comportamiento interactivo de reservas, scroll 3D y guardias de administrador.

## 🛠️ Cómo abrir en VS Code
1. Abre **Visual Studio Code**.
2. Ve a `Archivo` -> `Abrir carpeta...` (o `Open Folder...`).
3. Selecciona la ruta: `C:\Users\xavi\Downloads\manicure-salon`.
4. Si posees **Live Server**, ejecuta `index.html` para el cliente y `admin.html` para la configuración técnica de Vero.
