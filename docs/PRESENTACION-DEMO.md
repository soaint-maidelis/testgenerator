# Presentación de TestGenerator

## Cómo iniciar

Desde la raíz del proyecto ejecute:

```text
npm run testgenerator
```

El menú guía toda la demostración; no es necesario conocer otros comandos.

## Flujo recomendado

1. Seleccione **Historia de Usuario** y elija *Shopping cart*.
2. Revise los escenarios propuestos y apruebe *Cart counter is updated*.
3. Prepare la automatización y ejecute la prueba existente.
4. Muestre el reporte y la trazabilidad generados.
5. Seleccione **Simular un fallo** y confirme el registro en Trello cuando quiera demostrar la gestión real de incidencias.

También puede usar **Archivo Excel** o **Archivo JSON** para mostrar que distintas fuentes siguen el mismo proceso gobernado de revisión y automatización.

## Si SauceDemo no responde

Use el fallback local mediante la opción de demostración disponible para el equipo presentador. La aplicación local conserva el flujo determinista sin depender de Internet. Antes de la sesión puede verificarse con `npm run demo:local`.

## Cómo verificar Trello

Al confirmar el registro de una incidencia, TestGenerator muestra el enlace de la tarjeta creada en el tablero **TestGenerator - Demo QA**, lista **Detected**. Abra el enlace desde el menú o cópielo en el navegador. La tarjeta sintética debe mostrar claramente `SIMULATED_DEMO_FAILURE`.

Las credenciales permanecen únicamente en el archivo local `.env` ignorado por Git y nunca se muestran en la experiencia.
