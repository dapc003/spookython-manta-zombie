# 💰 Modelo de Costos AWS · Operación Contención Manta

> **Declaración de gasto real:** durante todo el hackathon SpookyThon 2026 el gasto acumulado en la cuenta AWS fue de **\$0.00 USD**, verificado con **AWS Budgets** activo desde el Día 1 (evidencia: [`budget.png`](budget.png)).

Este documento estima el costo mensual de la arquitectura serverless para una carga de **10,000 corridas (simulaciones Monte Carlo) por mes**, con las fórmulas visibles para que cualquiera pueda verificar los números.

---

## 1. Supuestos de carga

| Variable | Símbolo | Valor | Justificación |
| :--- | :---: | :---: | :--- |
| Simulaciones solicitadas por mes | $N_{sim}$ | `10,000` | Escenario de operación sostenida del COE cantonal + demos |
| Workers Lambda por simulación (Fan-Out) | $W$ | `5` | `Promise.all` con 5 invocaciones concurrentes |
| Invocación extra de auditoría (`record_audit`) | $A$ | `1` | Escritura del hash FNV-1a en DynamoDB |
| Memoria asignada a Lambda | $M$ | `512 MB = 0.5 GB` | `MemorySize: 512` en [`infra/template.yaml`](../infra/template.yaml) |
| Duración media por worker | $t_w$ | `0.8 s` | ~10 corridas × 3 estrategias × 60 días por worker |
| Duración media de auditoría | $t_a$ | `0.1 s` | Un `PutItem` + `Query` |
| Tamaño del dataset INEC/MSP en S3 | $D$ | `7.2 KB` | `manta_inec_msp_dataset.json` |
| Lecturas S3 (solo en *cold start*, dataset cacheado en memoria) | $G_{S3}$ | `≤ 2,000` | Caché global `_CACHED_DATASET` reutilizada en invocaciones calientes |
| Visitas al frontend por mes | $V$ | `2,000` | Jurado, autoridades y pruebas |
| Peso del frontend servido | $P$ | `≈ 0.27 MB` | `index.html` + `styles.css` + `app.js` (librerías vía CDN pública) |
| Log por invocación | $L$ | `≈ 1 KB` | Trazas de inicio/fin y métricas |

---

## 2. Cálculo por servicio

### 2.1 AWS Lambda (Fan-Out 5 workers + auditoría)

**Invocaciones:**

$$
R_{\lambda} = N_{sim} \times (W + A) = 10{,}000 \times (5 + 1) = 60{,}000 \ \text{solicitudes/mes}
$$

**Cómputo (GB-segundo):**

$$
C_{\lambda} = N_{sim} \cdot W \cdot t_w \cdot M + N_{sim} \cdot A \cdot t_a \cdot M
$$

$$
C_{\lambda} = 10{,}000 \cdot 5 \cdot 0.8 \cdot 0.5 + 10{,}000 \cdot 1 \cdot 0.1 \cdot 0.5 = 20{,}000 + 500 = 20{,}500 \ \text{GB-s}
$$

| Concepto | Uso | Capa gratuita mensual (permanente) | % consumido | Costo con Free Tier |
| :--- | :---: | :---: | :---: | :---: |
| Solicitudes | `60,000` | `1,000,000` | `6.0 %` | **\$0.00** |
| Cómputo | `20,500 GB-s` | `400,000 GB-s` | `5.1 %` | **\$0.00** |
| Function URL | incluida | sin cargo adicional | — | **\$0.00** |

*Referencia sin capa gratuita:* $60{,}000 \times \frac{\$0.20}{10^6} + 20{,}500 \times \$0.0000166667 = \$0.012 + \$0.342 = \$0.35$/mes.

### 2.2 Amazon S3 (bucket privado del dataset)

$$
\text{Almacenamiento} = 7.2\ \text{KB} \approx 0.0000072\ \text{GB} \qquad \text{GET} = G_{S3} \le 2{,}000
$$

| Concepto | Uso | Costo unitario | Costo |
| :--- | :---: | :---: | :---: |
| Almacenamiento Standard | `0.0000072 GB` | \$0.023 / GB-mes | \$0.0000002 |
| Solicitudes GET | `2,000` | \$0.0004 / 1,000 | \$0.0008 |
| **Total S3** | | | **\$0.00** (redondeado) |

### 2.3 Amazon DynamoDB (`SpookyThonSimulations`, On-Demand)

Cada simulación escribe **1 ítem < 1 KB** (1 WRU) y consulta el historial (lectura eventual ≤ 4 KB = 0.5 RRU):

$$
\text{WRU} = 10{,}000 \times 1 = 10{,}000 \qquad \text{RRU} = 10{,}000 \times 0.5 = 5{,}000
$$

$$
\text{Costo} = 10{,}000 \times \frac{\$0.625}{10^6} + 5{,}000 \times \frac{\$0.125}{10^6} = \$0.00625 + \$0.000625 \approx \$0.007
$$

| Concepto | Uso | Capa gratuita | Costo |
| :--- | :---: | :---: | :---: |
| Almacenamiento | `≈ 3 MB` (10k ítems × 300 B) | `25 GB` permanentes | **\$0.00** |
| Escrituras / lecturas On-Demand | `10k WRU / 5k RRU` | — | **≈ \$0.007** (menos de 1 centavo) |

> [!NOTE]
> El modo **On-Demand** factura fracciones de centavo (≈ \$0.007/mes) que se absorben con los créditos de la capa gratuita. Si se requiere estrictamente \$0.00, basta con cambiar a modo **Provisioned (5 WCU / 5 RCU)**, que cae dentro de las 25 WCU/RCU gratuitas permanentes y soporta holgadamente 10,000 escrituras al mes (≈ 0.004 escrituras/segundo promedio).

### 2.4 Amazon CloudWatch Logs

$$
\text{Ingesta} = R_{\lambda} \times L = 60{,}000 \times 1\ \text{KB} \approx 0.06\ \text{GB/mes}
$$

| Concepto | Uso | Capa gratuita | Costo |
| :--- | :---: | :---: | :---: |
| Ingesta + almacenamiento de logs | `0.06 GB` | `5 GB/mes` | **\$0.00** |
| Métricas estándar de Lambda | incluidas | gratuitas | **\$0.00** |

### 2.5 AWS Amplify Hosting

$$
\text{Transferencia} = V \times P = 2{,}000 \times 0.27\ \text{MB} = 540\ \text{MB} \approx 0.54\ \text{GB/mes}
$$

| Concepto | Uso | Capa gratuita | Costo |
| :--- | :---: | :---: | :---: |
| Datos servidos (CDN) | `0.54 GB` | `15 GB/mes` | **\$0.00** |
| Almacenamiento de artefactos | `< 1 MB` | `5 GB` | **\$0.00** |
| Minutos de build | `0` (HTML/CSS/JS sin build) | `1,000 min/mes` | **\$0.00** |

### 2.6 Servicios de gobernanza

| Servicio | Uso | Costo |
| :--- | :--- | :---: |
| AWS Budgets | 1 presupuesto con alerta de costo (los 2 primeros son gratuitos) | **\$0.00** |
| IAM (roles de mínimo privilegio) | Sin cargo | **\$0.00** |
| Transferencia de datos de salida (respuestas JSON Lambda) | `≈ 3 GB/mes` vs. `100 GB/mes` gratuitos | **\$0.00** |

---

## 3. Resumen mensual (10,000 corridas/mes)

| Servicio | Uso mensual | Con AWS Free Tier | Sin Free Tier (referencia) |
| :--- | :--- | :---: | :---: |
| AWS Amplify Hosting | 0.54 GB servidos | **\$0.00** | \$0.08 |
| AWS Lambda (Fan-Out) | 60,000 solicitudes · 20,500 GB-s | **\$0.00** | \$0.35 |
| Amazon S3 (privado) | 7.2 KB · ≤ 2,000 GET | **\$0.00** | \$0.001 |
| Amazon DynamoDB | 10k WRU · 5k RRU · 3 MB | **\$0.00**\* | \$0.007 |
| Amazon CloudWatch Logs | 0.06 GB | **\$0.00** | \$0.03 |
| AWS Budgets | 1 alerta | **\$0.00** | \$0.00 |
| **TOTAL** | | **\$0.00 / mes** | **≈ \$0.47 / mes** |

\* Con modo Provisioned 5/5 o absorbido por créditos de la capa gratuita (ver nota 2.3).

$$
\text{Costo total con Free Tier} = \$0.00 \qquad\qquad \text{Costo por simulación sin Free Tier} = \frac{\$0.47}{10{,}000} \approx \$0.000047
$$

---

## 4. Consideraciones honestas

1. **Perfil endurecido del template SAM:** [`infra/template.yaml`](../infra/template.yaml) define una **clave KMS administrada por el cliente** (con rotación) para cifrar S3, DynamoDB y la cola DLQ. Una CMK cuesta **\$1.00/mes** + \$0.03 por cada 10,000 solicitudes de API. Para mantener \$0.00, se pueden usar claves administradas por AWS (SSE-S3 / clave propiedad de AWS en DynamoDB), que no tienen costo.
2. **Retención de logs:** el template fija `RetentionInDays: 365`. Con 0.06 GB/mes el almacenamiento acumulado anual (~0.7 GB) sigue dentro de los 5 GB gratuitos.
3. **Capa gratuita de AWS:** desde julio de 2025 las cuentas nuevas reciben créditos en lugar de algunas capas gratuitas de 12 meses (p. ej. S3). Los límites permanentes de Lambda (1M solicitudes / 400k GB-s), DynamoDB (25 GB) y CloudWatch (5 GB) siguen vigentes. Los centavos residuales de S3 y DynamoDB se cubren con esos créditos.
4. **Protección contra Denial-of-Wallet:** `ReservedConcurrentExecutions: 25`, timeout de 20 s y validación de entradas en el servidor (`runs ≤ 500`, `days ≤ 365`, `budget ≤ 2,000,000`) ponen un techo físico al gasto incluso ante abuso del endpoint público.

---

## 5. Gasto real del hackathon

| Periodo | Servicios utilizados | Gasto facturado |
| :--- | :--- | :---: |
| SpookyThon 2026 (desarrollo + pruebas + demo) | Amplify, Lambda, S3, DynamoDB, CloudWatch, Budgets | **\$0.00 USD** |

Evidencia: alerta de **AWS Budgets** configurada desde el Día 1 → [`docs/budget.png`](budget.png).
