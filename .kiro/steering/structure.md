# Structure Steering — Organización del Repositorio y Contratos

## Árbol Oficial del Proyecto
```text
spookython-manta-zombie/
├── .github/
│   └── workflows/
│       └── checkov-security.yml          # Seguridad Shift-Left (Checkov IaC + Auditoría Determinista)
├── .kiro/
│   ├── hooks/
│   │   └── audit-determinism-and-safety.json  # Hook automático Kiro de integridad PRNG e IAM
│   ├── specs/
│   │   └── manta-epidemic-shield/
│   │       ├── requirements.md           # Requisitos formales en notación EARS
│   │       ├── design.md                 # Diseño arquitectónico, Fan-Out y modelo matemático
│   │       └── tasks.md                  # Plan de implementación trazable SDD
│   └── steering/
│       ├── product.md                    # Reglas de negocio, modos Zombie/Dengue y objetivos COE
│       ├── tech.md                       # Stack técnico AWS Multicapa, Leaflet y Open-Meteo
│       └── structure.md                  # Estructura de archivos y convenciones
├── docs/
│   ├── arquitectura.svg                  # Diagrama vectorial de arquitectura AWS
│   ├── arquitectura.drawio               # Fuente XML editable para diagrams.net
│   ├── budget.png                        # Evidencia de AWS Budgets activo desde el Día 1
│   └── costos.md                         # Modelo matemático de costos AWS ($0.00 Free Tier)
├── infra/
│   ├── lambda_simulador.py               # Motor AWS Lambda Python 3.12 (Fan-Out + S3 + DynamoDB)
│   ├── manta_inec_msp_dataset.json       # Dataset censal INEC, clínico MSP y matriz de movilidad
│   └── template.yaml                     # Plantilla AWS SAM / CloudFormation con mínimo privilegio
├── src/
│   ├── index.html                        # Interfaz principal, Mapa GPS Leaflet + SVG y paneles
│   ├── styles.css                        # Sistema visual oscuro responsivo + estilos CartoDB/UI
│   └── app.js                            # Motor local mulberry32, cliente Fan-Out AWS y Optimizador
└── README.md                             # Documentación maestra y guía de Prueba de Fuego
```

## Convenciones de Ingeniería
1. **Inmutabilidad del Endpoint por Defecto:** `DEFAULT_LAMBDA_URL` en `src/app.js` debe mantenerse apuntando a `"https://sw5fdgyzewlgqjttz2jhjkvaey0udlbt.lambda-url.us-east-2.on.aws/"`.
2. **Degradación Elegante (`Graceful Degradation`):** Ninguna llamada externa (`AWS Lambda`, `Amazon S3`, `Amazon DynamoDB`, `Open-Meteo`, `Leaflet CDN`, `Chart.js CDN`) puede bloquear la interfaz ni lanzar excepciones no controladas; todas poseen bloques `try/except` o `try/catch` con respaldo local determinista inmediato.
3. **Cero Secretos:** Prohibido almacenar claves AWS, tokens o credenciales en código o archivos de configuración.
