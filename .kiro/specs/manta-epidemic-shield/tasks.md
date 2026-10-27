# Implementation Tasks (SDD Traceability) — `manta-epidemic-shield`

- [x] **TASK-01 (REQ-04):** Crear dataset censal y clínico oficial `infra/manta_inec_msp_dataset.json` con coordenadas GPS exactas de los 8 barrios de Manta, densidades INEC 2022, índices entomológicos *Aedes* MSP y matriz de movilidad $8 \times 8$.
- [x] **TASK-02 (REQ-01, REQ-02, REQ-05, REQ-06):** Actualizar `infra/lambda_simulador.py` con:
  - Estrategia `"Escudo de Centralidad + Cerco Perimetral Adaptativo"` y auditoría `0` violaciones a no-sanos.
  - Soporte de particionamiento Fan-Out (`subSeeds`, `workerIndex`, `totalWorkers`, `shardRaw`).
  - Integración resiliente `boto3` (`try/except`) con Amazon S3 privado (`DATASET_BUCKET`) y Amazon DynamoDB (`SpookyThonSimulations`).
  - Calibración climática en vivo vía Open-Meteo (`action: "weather"` y curva térmica de Brière).
- [x] **TASK-03 (REQ-03):** Integrar `Leaflet.js` + `CartoDB Dark Matter` en `src/index.html`, `src/styles.css` y `src/app.js` con selector de vista en vivo (`🛰️ Mapa Geoespacial Real` ↔ `🕸️ Grafo Topológico`), rutas entre barrios, ondas de calor animadas del Día 0 al Día 60 y popups tácticos SEIR.
- [x] **TASK-04 (REQ-04):** Agregar en la interfaz superior el interruptor `🧟 Modo: Plaga Zombie (Track B)` ↔ `🦟 Modo Real: Epidemia Dengue Manta (Datos INEC/MSP)`, el widget climático en tiempo real de Manta con botón `🌡️ Calibrar β con Clima Real de Manta` y el acordeón desplegable `"📖 Sustento Matemático y Origen de los Datos (INEC / MSP)"`.
- [x] **TASK-05 (REQ-05):** Construir la barra destacada `"🎃 Respuesta Rápida al Brote Sorpresa del Jurado"` (`🔥 Contagio ×2`, `💉 Mitad de Vacunas`, `🛒 Foco en Mercado de Tarqui`, `🧬 Variante Resistente (Vacuna 50%)`) y el motor `🧠 Auto-Optimizar Presupuesto y Estrategia` conectado al Informe Ejecutivo del Alcalde.
- [x] **TASK-06 (REQ-06):** Implementar en `src/app.js` el coordinador Fan-Out Serverless de 5 Workers concurrentes (`Promise.all`) hacia `DEFAULT_LAMBDA_URL` para corridas de `50` a `500`, preservando el Hash FNV-1a exacto, y renderizar la tabla `"🛡️ Historial de Auditoría Inmutable en Amazon DynamoDB"`.
- [x] **TASK-07 (REQ-07):** Definir la infraestructura segura de mínimo privilegio en `infra/template.yaml` (AWS SAM / CloudFormation), el hook de auditoría `.kiro/hooks/audit-determinism-and-safety.json` y el pipeline CI/CD Shift-Left `.github/workflows/checkov-security.yml`.
