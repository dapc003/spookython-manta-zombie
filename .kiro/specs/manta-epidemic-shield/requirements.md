# Requirements Specification (Notación EARS) — `manta-epidemic-shield`

**Proyecto:** Operación Contención Manta — Simulador Epidemiológico Multicapa AWS  
**Metodología:** Spec-Driven Development (Kiro SDD) · Notación **EARS** (*Easy Approach to Requirements Syntax*)

---

## REQ-01: Determinismo Reproducible por Semilla y Firma FNV-1a
- **Tipo EARS:** *Ubiquitous & Event-Driven*
- **REQ-01.1:** El sistema **deberá** generar todas las secuencias pseudoaleatorias en el cliente mediante `mulberry32(seed)` sin invocar jamás `Math.random()`.
- **REQ-01.2:** **WHEN** el usuario ejecute una simulación con la misma semilla numérica (`seed: 2026` por defecto) y los mismos parámetros de escenario, **THE SYSTEM SHALL** producir exactamente los mismos promedios, rangos `[Mínimo - Máximo]`, curvas diarias y firma de verificación `HashFirma` (FNV-1a de 32 bits).

## REQ-02: Regla Estricta de Elegibilidad Vacunal
- **Tipo EARS:** *Ubiquitous & Unwanted Behavior*
- **REQ-02.1:** El motor epidemiológico **deberá** aplicar dosis de vacuna exclusivamente a población en estado `🟢 Sano / Susceptible (S)` no vacunada previamente.
- **REQ-02.2:** **IF** en un barrio la cantidad de dosis disponibles supera la población `🟢 Sana (S)` elegible, **THEN THE SYSTEM SHALL** acotar estrictamente las dosis aplicadas a los individuos `🟢 Sanos` elegibles, manteniendo `0` vacunas aplicadas a `🟡 Expuestos (E)`, `🔴 Infectados/Zombies (I)` o `🔵 Inmunes/Exorcizados (R)`.

## REQ-03: Cartografía Dual Geoespacial Real (Leaflet GPS) y Topológica (SVG)
- **Tipo EARS:** *Event-Driven & State-Driven*
- **REQ-03.1:** El sistema **deberá** ubicar los 8 nodos urbanos de Manta en sus coordenadas GPS exactas sobre un mapa oscuro de alta precisión (`Leaflet.js` + `CartoDB Dark Matter`):
  - Mercado de Tarqui `[-0.9538, -80.7082]`
  - Terminal Terrestre Luis Valdiviezo `[-0.9615, -80.6928]`
  - Centro de Manta / Municipio `[-0.9496, -80.7214]`
  - ULEAM (Campus Matriz) `[-0.9529, -80.7456]`
  - Playa El Murciélago `[-0.9418, -80.7319]`
  - Hospital Rodríguez Zambrano `[-0.9602, -80.7385]`
  - Los Esteros `[-0.9482, -80.7011]`
  - San Mateo `[-0.9885, -80.8092]`
- **REQ-03.2:** **WHEN** el usuario alterne el selector de vista entre `🛰️ Mapa Geoespacial Real (GPS Manta)` y `🕸️ Grafo Topológico de Red`, **THE SYSTEM SHALL** sincronizar inmediatamente la visualización activa con el día seleccionado (`Día 0` a `Día 60`).
- **REQ-03.3:** **WHILE** la animación temporal (`▶ Reproducir`) esté activa del `Día 0` al `Día 60`, **THE SYSTEM SHALL** actualizar día a día las rutas de conexión entre barrios, las ondas radiales de calor proporcionales a los infectados y los popups tácticos con desglose SEIR y dosis aplicadas.

## REQ-04: Calibración Científica en Vivo (Open-Meteo + Dataset Oficial INEC/MSP)
- **Tipo EARS:** *Event-Driven & Unwanted Behavior*
- **REQ-04.1:** **WHEN** el usuario cambie el interruptor superior entre `🧟 Modo: Plaga Zombie (Track B)` y `🦟 Modo Real: Epidemia Dengue Manta (Datos INEC/MSP)`, **THE SYSTEM SHALL** adaptar los parámetros clínicos, etiquetas epidemiológicas y matriz de movilidad según `infra/manta_inec_msp_dataset.json`.
- **REQ-04.2:** **WHEN** la interfaz cargue o el usuario pulse `🌡️ Calibrar β con Clima Real de Manta`, **THE SYSTEM SHALL** consultar en tiempo real la API de Open-Meteo (`latitude=-0.9677&longitude=-80.7089`), mostrar temperatura, humedad relativa y precipitación actuales de Manta, y recalibrar la tasa de transmisión $\beta$ mediante la curva térmica entomológica de Brière.
- **REQ-04.3:** **IF** la API externa de Open-Meteo no responde por falta de red, **THEN THE SYSTEM SHALL** emplear valores climatológicos costeros de respaldo para Manta sin interrumpir la simulación.

## REQ-05: Consola Anti-Brote Sorpresa, Cerco Perimetral Adaptativo y Auto-Optimizador
- **Tipo EARS:** *State-Driven & Event-Driven*
- **REQ-05.1:** **WHILE** el brote se origine dentro de un nodo central de alto grado (como *Mercado de Tarqui*) o la efectividad vacunal sea reducida, **THE SYSTEM SHALL** ejecutar la estrategia `"Escudo de Centralidad + Cerco Perimetral Adaptativo"`, aplicando fumigación (`$1,200`, `-40%` contagio local por `5 días`) y cerco sanitario (`$3,500`, `-75%` flujo vecino) en el foco origen mientras despliega un anillo perimetral de vacunación (`$15/dosis`) en los barrios vecinos sanos.
- **REQ-05.2:** **WHEN** el usuario pulse cualquiera de los controles de 1 clic (`🔥 Contagio ×2`, `💉 Mitad de Vacunas`, `🛒 Foco en Mercado de Tarqui`, `🧬 Variante Resistente (Vacuna 50%)`), **THE SYSTEM SHALL** ajustar los parámetros correspondientes y recalcular automáticamente las 3 estrategias y el Informe Ejecutivo para el Alcalde.
- **REQ-05.3:** **WHEN** el usuario pulse `🧠 Auto-Optimizar Presupuesto y Estrategia`, **THE SYSTEM SHALL** evaluar determinísticamente múltiples combinaciones operativas dentro del techo presupuestario activo y aplicar automáticamente la combinación que maximice el promedio de vidas salvadas.

## REQ-06: Backend AWS Multicapa (Fan-Out Paralelo, S3 Privado y DynamoDB)
- **Tipo EARS:** *Event-Driven & Unwanted Behavior*
- **REQ-06.1:** **WHEN** se ejecute en modo Cloud AWS Lambda con entre `50` y `500` corridas Monte Carlo, **THE SYSTEM SHALL** dividir el vector determinista de sub-semillas en `5` peticiones paralelas simultáneas (`Promise.all`) hacia `DEFAULT_LAMBDA_URL`, consolidar los resultados en orden estricto de corrida para obtener un resultado y `HashFirma` FNV-1a 100% idénticos, y mostrar `"⚡ Paralelismo Cloud AWS: 5 Workers Lambda concurrentes"`.
- **REQ-06.2:** **WHEN** AWS Lambda procese una solicitud, **THE SYSTEM SHALL** intentar leer la calibración desde el bucket privado S3 (`DATASET_BUCKET = spookython-manta-datos-2026`) y registrar la auditoría en la tabla Amazon DynamoDB `SpookyThonSimulations` (`SimulationId`, `Timestamp`, `Seed`, `Mode`, `SavedLivesMean`, `HashFirma`, `BudgetUsed`).
- **REQ-06.3:** **IF** la red falla en el cliente o los permisos IAM de S3/DynamoDB aún no están activos en Lambda, **THEN THE SYSTEM SHALL** degradar limpiamente mediante bloques `try/catch` y `try/except` hacia el dataset y motor de respaldo sin arrojar errores visibles.

## REQ-07: Seguridad Shift-Left e Infraestructura de Mínimo Privilegio
- **Tipo EARS:** *Ubiquitous*
- **REQ-07.1:** La plantilla IaC `infra/template.yaml` **deberá** definir cifrado KMS, bloqueo total de acceso público en S3 (`PublicAccessBlockConfiguration`), cifrado SSE/PITR en DynamoDB y políticas IAM restringidas por ARN bajo el principio de mínimo privilegio.
- **REQ-07.2:** El flujo `.github/workflows/checkov-security.yml` **deberá** auditar automáticamente `infra/` con **Checkov** en cada `push` o `pull_request`.
