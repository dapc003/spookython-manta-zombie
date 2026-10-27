# 💰 Declaración Detallada de Costos Operativos en AWS — Operación Contención Manta

**Proyecto:** Operación Contención Manta (SpookyThon 2026 — Track B: *La Plaga Zombie*)  
**Región de Referencia:** `us-east-2` (US East — Ohio)  
**Arquitectura:** 100% Serverless y Efímera (`AWS Amplify Hosting` + `AWS Lambda Function URL Python 3.12` + `Amazon CloudWatch Logs` + `AWS Budgets`)

---

## 1. Declaración Oficial de Gasto Real durante el Hackathon

> **Gasto real incurrido durante la SpookyThon 2026: `$0.00 USD`**  
> La totalidad del desarrollo, pruebas de carga Monte Carlo, despliegue del endpoint serverless y hospedaje web estático se ejecutó dentro de la **Capa Gratuita de AWS (*AWS Free Tier*) / *Sandbox Credits***, auditada de forma continua desde el **Día 1** mediante una alerta activa en **AWS Budgets** configurada con un umbral estricto de **`$1.00 USD/mes`** (ver evidencia verificable en [`docs/budget.png`](budget.png): consumo real `0,00 US$`, varianza disponible `100,00%`).

---

## 2. Modelo Matemático de Costos Mensuales en AWS

El costo mensual total de operación $C_{\text{total}}$ de la plataforma está gobernado por la suma de sus cuatro servicios sin servidores ociosos (*zero idle cost*):

$$
C_{\text{total}} = C_{\text{Lambda}} + C_{\text{Amplify}} + C_{\text{CloudWatch}} + C_{\text{Budgets}}
$$

### 2.1. Fórmula de Cómputo Serverless en AWS Lambda (`x86_64`)

Sea $N$ el número de simulaciones mensuales, $M_{\text{MB}}$ la memoria asignada en MB y $t_{\text{s}}$ la duración media por invocación en segundos. El consumo mensual en $\text{GB-s}$ se define como:

$$
E_{\text{GB-s}} = N \times \left(\frac{M_{\text{MB}}}{1024}\right) \times t_{\text{s}}
$$

Aplicando las cuotas perpetuas de **AWS Free Tier** ($1{,}000{,}000$ solicitudes/mes y $400{,}000\text{ GB-s}$/mes) y las tarifas oficiales en `us-east-2` ($\text{USD } 0.20$ por millón de solicitudes y $\text{USD } 0.0000166667$ por $\text{GB-s}$; *Lambda Function URL* no tiene recargo fijo por hora):

$$
C_{\text{Lambda}} = \max\!\left(0,\; N - 1{,}000{,}000\right)\times \frac{0.20}{1{,}000{,}000} \;+\; \max\!\left(0,\; E_{\text{GB-s}} - 400{,}000\right)\times 0.0000166667
$$

### 2.2. Fórmula de Hosting Estático y CDN en AWS Amplify

Sean $B_{\text{min}}$ los minutos mensuales de compilación CI/CD, $D_{\text{GB}}$ los GB de transferencia saliente por HTTPS y $S_{\text{GB}}$ el almacenamiento en CDN (tarifas estándar tras Free Tier de 12 meses: $\text{USD } 0.01/\text{min}$, $\text{USD } 0.15/\text{GB}$ transferido y $\text{USD } 0.023/\text{GB}$ almacenado):

$$
C_{\text{Amplify}} = \max\!\left(0,\; B_{\text{min}} - 1{,}000\right)\times 0.01 \;+\; \max\!\left(0,\; D_{\text{GB}} - 15\right)\times 0.15 \;+\; \max\!\left(0,\; S_{\text{GB}} - 5\right)\times 0.023
$$

### 2.3. Fórmula de Observabilidad Privada en Amazon CloudWatch Logs

Sea $L_{\text{GB}}$ el volumen mensual de logs ingeridos ($\approx 0.35\text{ KB}$ por invocación para líneas `START`, `END` y `REPORT`), con una cuota perpetua gratuita (*Always Free*) de $5\text{ GB/mes}$ y tarifa excedente de $\text{USD } 0.50/\text{GB}$:

$$
C_{\text{CloudWatch}} = \max\!\left(0,\; L_{\text{GB}} - 5\right)\times 0.50
$$

---

## 3. Cálculo Paso a Paso: Escenario Estándar (`10,000` Simulaciones / Mes)

Parámetros operativos de referencia para el **COE Cantonal de Manta** y evaluación ciudadana/técnica:
- **Simulaciones mensuales ($N$):** `10,000` ejecuciones Monte Carlo/mes
- **Memoria AWS Lambda ($M_{\text{MB}}$):** `512 MB` (`0.5 GB`)
- **Duración promedio ($t_{\text{s}}$):** `500 ms` (`0.5 s`)
- **Peso del frontend estático comprimido (Brotli/Gzip):** `~65 KB` por sesión inicial (`~0.65 GB/mes` para 10,000 visitas; `2 min/mes` de despliegue)
- **Ingesta de logs en CloudWatch ($L_{\text{GB}}$):** $10{,}000 \times 0.35\text{ KB} \approx 3.5\text{ MB} \approx 0.0034\text{ GB/mes}$

### Sustitución Matemática Exacta:

1. **Consumo de cómputo en AWS Lambda:**

$$
E_{\text{GB-s}} = 10{,}000 \times \left(\frac{512}{1024}\right) \times 0.5 = 10{,}000 \times 0.5 \times 0.5 = 2{,}500\text{ GB-s / mes}
$$

2. **Evaluación contra la Capa Gratuita de AWS:**
   - **Solicitudes Lambda:** $10{,}000 \le 1{,}000{,}000$ (`1.00%` de la cuota Always Free) $\implies \mathbf{\text{USD } 0.00}$
   - **Cómputo Lambda:** $2{,}500\text{ GB-s} \le 400{,}000\text{ GB-s}$ (`0.625%` de la cuota Always Free) $\implies \mathbf{\text{USD } 0.00}$
   - **AWS Amplify Hosting:** $0.65\text{ GB} \le 15\text{ GB}$ (`4.33%` de la cuota Free Tier) y $2\text{ min} \le 1{,}000\text{ min}$ $\implies \mathbf{\text{USD } 0.00}$
   - **Amazon CloudWatch Logs:** $0.0034\text{ GB} \le 5\text{ GB}$ (`0.07%` de la cuota Always Free) $\implies \mathbf{\text{USD } 0.00}$
   - **AWS Budgets:** `1` presupuesto mensual estándar con alertas por correo $\implies \mathbf{\text{USD } 0.00}$

$$
C_{\text{total (Estándar con Free Tier)}} = 0.00 + 0.00 + 0.00 + 0.00 = \mathbf{\text{USD } 0.00 / \text{mes}}
$$

*(Nota de transparencia: Incluso si una cuenta empresarial ya hubiese agotado su Capa Gratuita de 12 meses, estas mismas 10,000 simulaciones costarían apenas $\text{USD } 0.002 + \text{USD } 0.0417 = \text{USD } 0.0437$ en Lambda + $\text{USD } 0.118$ en Amplify + $\text{USD } 0.002$ en CloudWatch = **`$0.16 USD/mes`**).*

---

## 4. Escenario de Tráfico Masivo / Emergencia Regional SIN Capa Gratuita (`~$1.25 USD/mes`)

Para demostrar la viabilidad financiera a escala real sin depender de ninguna subvención ni Capa Gratuita (*0% Free Tier*), proyectamos una **emergencia sanitaria provincial masiva** con **150,000 simulaciones Monte Carlo al mes** (`5,000` corridas diarias) y `3.6 GB/mes` de tráfico web servido por CDN:

- **AWS Lambda (`150,000` invocaciones × `0.5 GB` × `0.5 s` = `37,500 GB-s`):**

$$
C_{\text{Lambda (Sin Free Tier)}} = \left(150{,}000 \times \frac{0.20}{10^6}\right) + \left(37{,}500 \times 0.0000166667\right) = 0.0300 + 0.6250 = \text{USD } 0.6550
$$

- **AWS Amplify Hosting (`3.6 GB` transferencia CDN + `4 min` build CI/CD):**

$$
C_{\text{Amplify (Sin Free Tier)}} = \left(3.6 \times 0.15\right) + \left(4 \times 0.01\right) + 0.002 = 0.5400 + 0.0420 = \text{USD } 0.5820
$$

- **Amazon CloudWatch Logs (`0.05 GB` ingesta de trazas):**

$$
C_{\text{CloudWatch (Sin Free Tier)}} = 0.05 \times 0.50 = \text{USD } 0.0250
$$

- **Costo Total en Tráfico Masivo sin Capa Gratuita:**

$$
C_{\text{total (Tráfico Masivo)}} = 0.6550 + 0.5820 + 0.0250 = \text{USD } 1.2620 \approx \mathbf{\text{USD } 1.25 / \text{mes}}
$$

---

## 5. Tabla Comparativa Consolidada de Costos

| Servicio AWS | Métrica Mensual Base (`10k` sims) | Cuota Capa Gratuita AWS | Costo Estándar (Con Free Tier) | Escenario Masivo (`150k` sims, **Sin** Free Tier) | Gasto Real Hackathon |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **AWS Lambda + Function URL** | `10,000` req · `2,500 GB-s` (`512 MB`, `500 ms`) | `1M` req + `400,000 GB-s` (*Always Free*) | **`$0.00 USD`** | `$0.66 USD` | **`$0.00 USD`** |
| **AWS Amplify Hosting** | `~0.65 GB` CDN · `2 min` build | `15 GB` salida + `1,000 min` (*12m Free*) | **`$0.00 USD`** | `$0.58 USD` | **`$0.00 USD`** |
| **Amazon CloudWatch Logs** | `~0.0034 GB` logs privados | `5 GB` ingesta + `5 GB` archivo (*Always Free*) | **`$0.00 USD`** | `$0.03 USD` | **`$0.00 USD`** |
| **AWS Budgets** | `1` presupuesto activo Día 1 (`$1.00 USD`) | Presupuestos informativos estándar incluidos | **`$0.00 USD`** | `$0.00 USD` | **`$0.00 USD`** |
| **TOTAL MENSUAL** | **Operación 24/7 sin servidores ociosos** | **Cubierto al 100%** | **`$0.00 USD / mes`** | **`~$1.25 USD / mes`** | **`$0.00 USD`** |

---

## 6. Mecanismos de Protección Financiera Activos

1. **Alerta desde el Día 1 (`AWS Budgets`):** Presupuesto mensual fijado en **`$1.00 USD`** con notificación temprana para impedir cualquier cargo inesperado.
2. **Acotamiento Estricto de Cómputo (`parse_scenario_payload`):** En [`infra/lambda_simulador.py`](../infra/lambda_simulador.py), los parámetros recibidos por JSON se acotan servidor adentro (`runs <= 300`, `days <= 365`), evitando que peticiones malformadas consuman $\text{GB-s}$ excesivos.
3. **Cero Costo por Inactividad (*Scale-to-Zero*):** Al prescindir de instancias EC2, NAT Gateways, Application Load Balancers o bases de datos RDS aprovisionadas, cuando nadie ejecuta una simulación el costo por hora es exactamente **`$0.00 USD`**.
