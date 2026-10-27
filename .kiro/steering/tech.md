# Technology Steering — Arquitectura Cloud AWS Multicapa y Stack Técnico

## Frontend (Cliente Web Estático Público con HTTPS)
- **Hospedaje:** AWS Amplify Hosting con CDN CloudFront integrado y TLS 1.3 (cero buckets S3 públicos expuestos).
- **Stack Base:** HTML5 semántico (`src/index.html`), CSS3 con variables tácticas de alto contraste (`src/styles.css`) y JavaScript ES2022 modular sin bundlers pesados (`src/app.js`).
- **Cartografía Dual Sincronizada (Día 0 a Día 60):**
  - **🛰️ Mapa Geoespacial Real:** `Leaflet.js 1.9.4` + teselas vectoriales oscuras **CartoDB Dark Matter**, ondas de calor radiales proporcionales a la carga infecciosa diaria, polilíneas viales dinámicas y popups tácticos sobre las coordenadas GPS exactas de los 8 nodos de Manta.
  - **🕸️ Grafo Topológico de Red:** Renderizador vectorial SVG nativo de alta velocidad.
- **Visualización Científica:** `Chart.js 4.4.4` con renderizador Canvas 2D de respaldo integrado.
- **Telemetría Climática en Tiempo Real:** API abierta **Open-Meteo** (`temperature_2m`, `relative_humidity_2m`, `precipitation` en Manta `-0.9677, -80.7089`) acoplada a la curva térmica entomológica de Brière.

## Backend Serverless Multicapa en AWS (`us-east-2`)
- **Endpoint Activo por Defecto:** `DEFAULT_LAMBDA_URL = "https://sw5fdgyzewlgqjttz2jhjkvaey0udlbt.lambda-url.us-east-2.on.aws/"`
- **Cómputo y Fan-Out Paralelo:** **AWS Lambda (Python 3.12, 512 MB RAM)** invocada en paralelo desde el cliente mediante `Promise.all` (5 Workers concurrentes para corridas entre `50` y `500`), particionando determinísticamente el vector de sub-semillas `deriveSubSeeds(seed, runs)` y reconstruyendo el Hash FNV-1a exacto.
- **Datos Privados:** **Amazon S3** (`DATASET_BUCKET = spookython-manta-datos-2026`) con `PublicAccessBlock` total y cifrado KMS para almacenar `manta_inec_msp_dataset.json`, con fallback automático en memoria (`try/except`).
- **Auditoría Inmutable:** **Amazon DynamoDB** (`SpookyThonSimulations`, modo `PAY_PER_REQUEST`, cifrado SSE-KMS y PITR habilitado) almacenando `SimulationId`, `Timestamp`, `Seed`, `Mode`, `SavedLivesMean`, `HashFirma` y `BudgetUsed`.
- **Observabilidad y Gobernanza:** **Amazon CloudWatch Logs** cifrados y **AWS Budgets** activo desde el Día 1 (`$1.00 USD/mes`, gasto real `$0.00 USD`).

## Desarrollo Guiado por Especificaciones (SDD) y Seguridad Shift-Left
- **Especificaciones Kiro:** Notación **EARS** en `.kiro/specs/manta-epidemic-shield/`.
- **Infraestructura como Código (IaC):** AWS SAM / CloudFormation en `infra/template.yaml`.
- **Seguridad Shift-Left CI/CD:** Escaneo estático automatizado con **Checkov** en `.github/workflows/checkov-security.yml` en cada `push` y `pull_request`.
