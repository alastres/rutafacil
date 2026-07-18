# Diseño: Mejora de Usabilidad para Punto de Retorno

Este documento detalla la propuesta de mejora visual y de redacción para el menú y formulario de **Punto de Retorno**, enfocándose en reducir texto, mejorar la guía visual y añadir iconos SVG, manteniendo la potencia de la selección manual sobre el mapa.

## Cambios Propuestos

### 1. Panel de Puntos Guardados (`ReturnPointSheet.tsx`)
- **Visuales e Iconos**:
  - Añadir el icono `PinIcon` (SVG de chincheta) al lado de cada punto guardado en la lista.
  - Si un punto es el actualmente activo en la ruta en curso:
    - Resaltar su borde con el color verde de destino (`var(--senal-verde)`).
    - Añadir un pequeño icono `CheckIcon` (SVG de check verde) al lado de su nombre para indicar que es la selección actual.
- **Reducción de texto y botones**:
  - Mensaje de lista vacía: Cambiar de *"Todavía no hay puntos de retorno guardados"* a *"No hay puntos guardados"*.
  - Botón **Quitar de esta ruta**: Añadir un icono de papelera/remover (`TrashIcon`) y darle un estilo de borde rojo de advertencia (`btn--danger-outline` o similar).
  - Botón **Nuevo punto**: Añadir un icono `PlusIcon` y un estilo más prominente.

### 2. Formulario de Creación/Edición (`ReturnPointForm.tsx`)
Simplificaremos la interfaz para evitar que se vea congestionada y para dar retroalimentación inmediata sobre la ubicación seleccionada.

- **Campos y Etiquetas**:
  - Campo **Nombre**: Input simple con placeholder *"Ej. Bodega, Depósito"* para prescindir de explicaciones extra.
  - Sección **Ubicación** simplificada con dos estados visuales claros:
    - **Estado A: Sin ubicación definida**:
      - Un campo de entrada tipo texto con el placeholder *"Pegar enlace o coordenadas"*.
      - Al escribir o pegar directamente en este campo, se autodetectará e intentará resolver la ubicación de inmediato (sin necesidad de pulsar un botón de confirmación adicional).
      - Junto a este campo, dos botones de acción con iconos:
        - Botón con `PasteIcon` para leer del portapapeles directamente.
        - Botón con `MapIcon` y texto *"Tocar mapa"* para lanzar el selector manual sobre el mapa.
    - **Estado B: Ubicación definida (Éxito)**:
      - Ocultar el input de texto y los botones de acción para despejar el formulario.
      - Mostrar una tarjeta o tarjeta compacta con un icono `CheckIcon` verde, el texto *"Ubicación fijada"* y las coordenadas obtenidas (ej: `5.85000, -55.20000`).
      - Mostrar un pequeño botón de aspa (`CloseIcon`) para borrar/cambiar la ubicación y volver al Estado A si se requiere.
- **Acciones del Formulario**:
  - Botones **Cancelar** y **Guardar** alineados horizontalmente en la parte inferior, usando estilos estandarizados.

## Plan de Verificación

### Pruebas Automatizadas
- Compilación del proyecto: `npm run build`
- Pruebas unitarias: `npm test`

### Pruebas Manuales
- Abrir la ventana en el navegador.
- Probar la creación de un punto de retorno pegando un enlace y tocando el mapa.
- Verificar que la lista muestre iconos y resalte el punto activo correctamente.
