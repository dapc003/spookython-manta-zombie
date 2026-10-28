# 🧟‍♂️🛡️ Operación Contención Manta — Simulador Epidemiológico SEIR + Monte Carlo en AWS (SpookyThon 2026 · Track B)

> 🚀 **ENLACE OFICIAL DE PRODUCCIÓN (AWS AMPLIFY HOSTING):**  
> # 🌐 [https://prod.d1yapm4cwo9o63.amplifyapp.com/](https://prod.d1yapm4cwo9o63.amplifyapp.com/)  
> 
> ⚡ **Endpoint Serverless Activo (AWS Lambda Function URL · `us-east-2`):**  
> `https://sw5fdgyzewlgqjttz2jhjkvaey0udlbt.lambda-url.us-east-2.on.aws/`

> **Centro de Comando Epidemiológico y Presupuestario en Tiempo Real para el COE Cantonal y la Alcaldía de Manta (Manabí, Ecuador).**  
> Modela, audita y optimiza la contención de un brote infeccioso sobre la red geoespacial real de **8 nodos estratégicos y 100,000 habitantes de Manta**, combinando **simulaciones estocásticas SEIR + Monte Carlo 100% deterministas por semilla (`mulberry32`)**, **paralelismo serverless Fan-Out en AWS Lambda (5 Workers concurrentes)**, **calibración climática en vivo (Open-Meteo)**, **Auto-Optimizador Presupuestario IA** y **registro inmutable de auditoría en Amazon DynamoDB**.

---

## 📌 1. Resumen Ejecutivo

Durante una emergencia sanitaria real, el Alcalde y el Comité de Operaciones de Emergencia (COE) enfrentan tres restricciones críticas simultáneas: **presupuesto municipal limitado**, **capacidad logística diaria acotada** (cadena de frío y cuadrillas de campo) e **incertidumbre biológica** (variantes con escape vacunal o escasez de dosis). Repartir vacunas o brigadas al azar diluye los recursos y permite que los grandes nodos conectores (*Mercado de Tarqui*, *Terminal Terrestre*, *Centro de Manta*) disparen la transmisión hacia toda la ciudad.

**Operación Contención Manta** resuelve este problema integrando ciencia de datos epidemiológicos, optimización presupuestaria e infraestructura cloud resiliente:

### 🧠 1.1. Auto-Optimizador Presupuestario IA (100% Dinámico por Umbrales)
Con un solo clic en **`🧠 Auto-Optimizar Presupuesto y Estrategia`**, el motor evalúa carteras candidatas mediante simulaciones Monte Carlo con **Números Aleatorios Comunes (*Common Random Numbers*)** y selecciona dinámicamente el portafolio óptimo según la disponibilidad física de biológicos, su efectividad clínica y el techo presupuestario:

| Régimen Detectado en Inputs | Condición de Disparo | Portafolio Ganador Recomendado | Acción Presupuestaria y Táctica |
| :--- | :--- | :--- | :--- |
| **🟢 Stock Alto de Vacunas** | $\text{Stock} > 15{,}000\text{ dosis}$ y $\text{Efectividad} \ge 60\%$ | **"Vacunación Masiva y Escudo de Centralidad"** | Prioriza la inversión en biológicos (`$15/dosis`) acelerando la entrega diaria sobre los hubs de mayor grado de conexión exclusivamente en población `🟢 Sana (S)`. |
| **🟡 Stock Medio de Vacunas** | $5{,}000 \le \text{Stock} \le 15{,}000\text{ dosis}$ y $\text{Efectividad} \ge 60\%$ | **"Estrategia Mixta: Vacunación Focalizada + Fumigación"** | Equilibra el presupuesto entre dosis dirigidas a los barrios puente colindantes al foco y brigadas de fumigación (`$1,200/operativo`, `-40%` contagio local por 5 días). |
| **🔴 Stock Bajo o Baja Efectividad** | $\text{Stock} < 5{,}000\text{ dosis}$ **o** $\text{Efectividad} < 60\%$ | **"Fumigación + Cerco Sanitario Estricto (Sin Biológico)"** | Suspende el gasto en vacunas (`$0` en dosis para evitar desperdicio) y concentra los fondos en **Cercos Sanitarios Selectivos** (`$3,500`, `-75%` flujo inter-barrial) + **Fumigación Intensiva**. |

### 📄 1.2. Informe Ejecutivo Automático para el Alcalde de Manta
Cada simulación traduce instantáneamente las matrices estocásticas en un **briefing directivo en lenguaje claro y sin tecnicismos** (listo para copiar al portapapeles con 1 clic), estructurado en 4 bloques accionables:
1. **⏱️ Barrios a Intervenir en las Primeras 48 Horas:** Identificación exacta del epicentro y de los nodos puente a blindar de inmediato.
2. **💰 Distribución Óptima del Presupuesto:** Desglose auditado en dólares para Cercos Sanitarios (`$3,500`), Brigadas de Fumigación (`$1,200`) y Dosis de Vacuna (`$15`, verificando `100%` de aplicación en población sana).
3. **🛟 Vidas Salvadas `[Rango Mínimo - Máximo]`:** Comparativa directa frente a *No Hacer Nada* y frente a *Repartir Recursos al Azar*.
4. **🧭 Justificación del Cerco Perimetral Adaptativo:** Explicación ejecutiva de por qué encapsular el foco y vacunar el anillo vecino salva decenas de miles de ciudadanos adicionales con el mismo presupuesto.

### 🛰️ 1.3. Gemelo Geoespacial Dual (Leaflet GIS con Pantalla Completa + Modo Zombie / Dengue Real)
- **Interruptor Científico en Vivo:** Alterna en caliente entre **🧟 Modo: Plaga Zombie (Track B)** y **🦟 Modo Real: Epidemia Dengue Manta (Datos INEC/MSP)**.
- **Mapa Geoespacial Real de Manta (Leaflet.js + Esri ArcGIS):** Ubica los 8 nodos en sus coordenadas GPS reales sobre Manta con selector entre **Mapa Táctico Oscuro de Calles** y **Vista Satelital Híbrida**, ondas de calor dinámicas del Día 0 al Día 60, reencuadre automático (`ResizeObserver` + `fitBounds`) y botón nativo **`🖥️ Pantalla Completa`** (`requestFullscreen()` / `exitFullscreen()` con `map.invalidateSize()`).

---

## 🏗️ 2. Arquitectura Cloud Serverless en AWS (Zonas Públicas y Privadas)

![Diagrama de Arquitectura Final](docs/arquitectura.svg)

📄 **Archivo fuente editable del diagrama (diagrams.net / draw.io):** [`docs/arquitectura.drawio`](docs/arquitectura.drawio)

### Desglose de Zonas de Seguridad y Flujo de Datos

| Zona / Capa | Servicio / Componente | Clasificación | Función Técnica en Producción |
| :--- | :--- | :---: | :--- |
| **1. Zona Pública** | **Navegador del Usuario / Jurado** (`Leaflet GIS Fullscreen` + `Chart.js` + `Auto-Optimizador IA`) | `🌐 PÚBLICO` | Interfaz centro de comando (*Glassmorphism & Mobile-First*). Dispara Fan-Out paralelo con `Promise.all` y posee motor local `mulberry32(seed)` de respaldo instantáneo. |
| **1. Zona Pública** | **AWS Amplify Hosting** (`HTTPS / TLS 1.3`) | `🌐 PÚBLICO` | CDN global administrada que sirve `src/index.html`, `src/styles.css` y `src/app.js` sin exponer buckets S3 públicos. |
| **1. Zona Pública** | **Open-Meteo Weather API** (`Timeout 3500ms`) | `🌐 EXTERNO` | Telemetría meteorológica real de Manta (Temperatura, Humedad, Precipitación) para calibrar $\beta$ mediante la curva térmica de Brière, con *Fallback Offline* automático (`26.0 °C`, `78% HR`). |
| **2. Cómputo Serverless** | **AWS Lambda Function URL** (`Python 3.12` · `512 MB`) | `🌐 URL HTTPS` / `🔒 RUNTIME AISLADO` | Ejecuta [`infra/lambda_simulador.py`](infra/lambda_simulador.py). En corridas de `50–500` iteraciones opera en modo **Fan-Out paralelo de 5 Workers concurrentes**, reduciendo tiempos de cómputo en `~5x`. |
| **3. Zona Privada** | **Amazon S3 Bucket Privado** (`spookython-manta-datos-2026`) | `🔒 PRIVADO` | Aloja [`infra/manta_inec_msp_dataset.json`](infra/manta_inec_msp_dataset.json) con `BlockPublicAccess` total (`BlockPublicAcls`, `BlockPublicPolicy`, `IgnorePublicAcls`, `RestrictPublicBuckets`) y cifrado `SSE-KMS`. |
| **3. Zona Privada** | **Amazon DynamoDB** (`SpookyThonSimulations`) | `🔒 PRIVADO` | Registro inmutable de auditoría de corridas (`SimulationId`, `Timestamp`, `Seed`, `Mode`, `SavedLivesMean`, `HashFirma`, `BudgetUsed`) con `Point-in-Time Recovery (PITR)` y cifrado KMS. |
| **3. Zona Privada** | **Amazon CloudWatch Logs + AWS Budgets** | `🔒 PRIVADO` | Observabilidad de invocaciones Lambda (`RetentionInDays: 365`) y gobernanza financiera con alerta de costo en **`$0.00 USD`** desde el Día 1. |
| **4. CI/CD & SDD** | **Kiro Specs (`.kiro/`) + GitHub Actions + Checkov** | `🛡️ SHIFT-LEFT` | Desarrollo guiado por especificaciones EARS y auditoría automatizada de seguridad IaC sobre [`infra/template.yaml`](infra/template.yaml) en cada `push` / `pull_request`. |

---

## 💰 3. Gobernanza Financiera y Presupuesto en AWS (`$0.00 USD` Real)

Desde el **Día 1** se configuró el presupuesto con alertas en **AWS Budgets** para garantizar control estricto de costos. El gasto real facturado durante todo el desarrollo, pruebas de carga y demostración del hackathon fue de **`$0.00 USD`**.

![Captura de AWS Budgets](docs/budget.png)

- **Estimación mensual para `10,000` simulaciones completas (`60,000` invocaciones Lambda en Fan-Out 5x):**
  - **Con Capa Gratuita de AWS (*AWS Free Tier*):** **`$0.00 USD / mes`** (`6.0%` de la cuota gratuita de solicitudes Lambda y `5.1%` de los `400,000 GB-s` gratuitos).
  - **Sin Capa Gratuita (referencia teórica):** **`~$0.47 USD / mes`** (`$0.000047 USD` por simulación).
- 📊 Consulta todas las fórmulas matemáticas detalladas servicio por servicio en **[`docs/costos.md`](docs/costos.md)**.

---

## 🧬 4. Supuestos Científicos: Red GPS de Manta (INEC 2022 + MSP Manabí + Open-Meteo)

### 4.1. Los 8 Nodos Estratégicos del Cantón Manta ([`infra/manta_inec_msp_dataset.json`](infra/manta_inec_msp_dataset.json))
La red modela una cohorte urbana de **`100,000` habitantes** ponderada proporcionalmente a partir del **VIII Censo de Población y VII de Vivienda (INEC 2022, población cantonal `271,145` hab.)** y los índices entomológicos de *Aedes aegypti* de la **Coordinación Zonal 4 del Ministerio de Salud Pública (MSP Manabí)**:

| # | Barrio / Nodo de Manta | Coordenadas GPS Reales (`Lat, Lng`) | Cohorte Simulada ($N_i$) | Ref. Parroquial INEC 2022 | Índice Breteau MSP ($IB_i$) | Grado Vial | Conexiones Directas (13 Rutas Urbanas) |
| :-: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `0` | **Mercado de Tarqui** | `[-0.9538, -80.7082]` | `15,000` | `42,850` | `18.4` | `4` | Centro (`2`), Los Esteros (`6`), Terminal (`1`), Hospital (`5`) |
| `1` | **Terminal Terrestre Luis Valdiviezo** | `[-0.9615, -80.6928]` | `12,000` | `33,920` | `15.2` | `4` | Mercado (`0`), ULEAM (`3`), Los Esteros (`6`), Centro (`2`) |
| `2` | **Centro de Manta / Municipio** | `[-0.9496, -80.7214]` | `18,000` | `51,400` | `13.8` | `4` | Mercado (`0`), Terminal (`1`), Murciélago (`4`), Hospital (`5`) |
| `3` | **ULEAM (Campus Matriz)** | `[-0.9529, -80.7456]` | `14,000` | `39,810` | `11.6` | `3` | Terminal (`1`), Playa Murciélago (`4`), San Mateo (`7`) |
| `4` | **Playa El Murciélago** | `[-0.9418, -80.7319]` | `10,000` | `27,650` | `10.4` | `3` | Centro (`2`), ULEAM (`3`), San Mateo (`7`) |
| `5` | **Hospital Rodríguez Zambrano** | `[-0.9602, -80.7385]` | `8,000` | `21,900` | `9.8` | `3` | Centro (`2`), Mercado (`0`), San Mateo (`7`) |
| `6` | **Los Esteros** *(Foco Base)* | `[-0.9482, -80.7011]` | `16,000` | `41,215` | `21.5` | `2` | Mercado (`0`), Terminal (`1`) |
| `7` | **San Mateo** | `[-0.9685, -80.7620]` | `7,000` | `12,400` | `14.1` | `3` | ULEAM (`3`), Playa Murciélago (`4`), Hospital (`5`) |

### 4.2. Parámetros Clínicos Duales y Calibración Entomológica de Brière

| Parámetro Epidemiológico | Símbolo | 🧟 Modo Plaga Zombie (Track B) | 🦟 Modo Epidemia Dengue (INEC/MSP) | Fundamento Científico y Operativo |
| :--- | :---: | :---: | :---: | :--- |
| **Tasa de transmisión base** | $\beta_0$ | `0.72` $\text{día}^{-1}$ | `0.58` $\text{día}^{-1}$ | $R_0 = \beta/\gamma = 3.60$ (Zombie) y $R_0 \approx 3.48$ (Dengue DENV-1/DENV-2 en costa ecuatoriana). |
| **Periodo de incubación** | $\sigma^{-1}$ | `3 días` ($\sigma = 0.333$) | `5 días` ($\sigma = 0.200$) | Latencia entre exposición (`🟡 E`) e infecciosidad activa (`🔴 I`). |
| **Tasa de recuperación / retiro** | $\gamma$ | `0.20` $\text{día}^{-1}$ (`5 d`) | `0.1667` $\text{día}^{-1}$ (`6 d`) | Duración media de la ventana infecciosa activa antes de pasar a `🔵 R`. |
| **Casos iniciales en Paciente Cero** | $I_0$ | `10` casos | `14` casos | Clúster primario detectado por vigilancia SIVE-Alerta en el Día 0. |
| **Efectividad vacunal por defecto** | $e$ | `85%` | `80%` (Qdenga TAK-003 ref.) | Probabilidad binomial de inmunización efectiva aplicada **100% solo a `🟢 Sanos`**. |
| **Calibración Climática Open-Meteo** | $\beta_{\text{clima}}$ | \multicolumn{2}{c|}{$\beta_{\text{clima}} = \beta_0 \cdot \phi_{\text{Brière}}(T) \cdot \phi_{RH}(H) \cdot \phi_{\text{lluvia}}(P)$} | Función térmica de Brière $\phi(T) \propto T(T - 13.5)\sqrt{39.0 - T}$ normalizada a $26.5\ ^\circ\text{C}$. |

---

## 🧮 5. Modelo Matemático: *"Escudo de Centralidad + Cerco Perimetral Adaptativo"* y Certificación de Regla Estricta

### 5.1. Ecuaciones del Score de Priorización Barrial
En cada día $t \in \{1..T\}$, para cada barrio $i \in \{0..7\}$ con población susceptible $S_i(t) > 0$, el algoritmo calcula el puntaje de intervención:

$$
\text{Score}_i(t) = \underbrace{\text{Grado}_i \times \left(\sum_{j \in \mathcal{N}(i)} I_j(t)\right) \times \frac{S_i(t)}{\max(1, N_i)}}_{\text{Índice Base de Centralidad y Presión Vecina}} \times \Psi_{\text{anillo}}(i, t)
$$

Donde el **Multiplicador de Anillo Perimetral Adaptativo** $\Psi_{\text{anillo}}(i, t)$ actúa como un cortafuegos topológico:
- **Contención del Epicentro ($\Psi_{\text{anillo}} = 0.18$):** Si el nodo $i$ ya presenta alta carga infecciosa local ($I_i + E_i \ge 8$) pero aún tiene vecinos con alta proporción sana ($S_j / N_j > 0.35$), el motor evita desperdiciar vacunas dentro del foco expuesto —donde predomina población `🟡 E` y `🔴 I`— y en su lugar aplica **Cerco Sanitario (`-75%` flujo)** + **Fumigación (`-40%` transmisión local)**.
- **Blindaje del Anillo Vecino ($\Psi_{\text{anillo}} = 2.35$):** Si el nodo $i$ tiene baja prevalencia local ($< 3.5\%$) pero es colindante a un hub activo infectado, recibe prioridad máxima de vacunación preventiva para levantar un escudo inmunológico antes de que la onda infecciosa cruce el corredor vial.

### 5.2. Certificación Matemática de Regla Estricta y Determinismo Criptográfico
1. **Cumplimiento 100% Regla Estricta (`Solo 🟢 Sanos`):**
   En toda corrida y día, el cupo elegible de vacunación en el barrio $i$ es:
   $$
   \text{Elegibles}_i(t) = S_i(t) - S_{\text{vac\_fallida}, i}(t) \le S_i(t)
   $$
   Jamás se asigna una sola dosis a individuos en compartimentos `🟡 Expuesto (E)`, `🔴 Infeccioso (I)` ni `🔵 Recuperado/Inmune (R)`. El contador de auditoría registra `forbiddenVaccineViolations = 0` en el 100% de las simulaciones.
2. **PRNG Determinista `mulberry32(seed)` (Cero `Math.random()`):**
   Tanto [`src/app.js`](src/app.js) como [`infra/lambda_simulador.py`](infra/lambda_simulador.py) implementan exactamente el mismo generador de 32 bits `mulberry32` y derivan la secuencia de sub-semillas por corrida mediante `deriveSubSeeds(seed, runs)`.
3. **Firma Criptográfica FNV-1a de 32 bits Invulnerable a Partición Fan-Out:**
   Al finalizar las corridas en orden $r = 0 \dots N-1$, se calcula el hash FNV-1a (`offset_basis = 0x811C9DC5`, `prime = 0x01000193`) mezclando `cumulativeInfected`, `totalDosesApplied` y `totalBudgetSpent`. Ya sea que se ejecute en 1 proceso local o se divida en **5 Workers Lambda paralelos**, el reductor ordena los bloques por índice y produce **exactamente el mismo Hash FNV-1a bit a bit**.

---

## 🔥 6. Guía Paso a Paso para Reproducir Escenarios Oficiales

Puedes verificar ambos escenarios directamente en la [Demo Desplegada en AWS Amplify](https://prod.d1yapm4cwo9o63.amplifyapp.com/) o abriendo `src/index.html` localmente:

### Escenario A — Escenario Base Oficial (`Semilla: 2026` · `Presupuesto: $50,000`)
1. Pulsa el botón **`↺ Restaurar Base (Seed 2026)`** en la barra rápida o verifica los valores por defecto:
   - **Modo:** `🧟 Plaga Zombie (Track B)` | **Semilla (`seed`):** `2026` | **Corridas (`runs`):** `50` | **Días (`days`):** `60`
   - **Paciente Cero:** `Los Esteros (16.000 hab)` *(índice `6`)* | **Tasa $\beta$:** `0.72` | **Incubación:** `3 d`
   - **Stock de Vacunas:** `24,000` | **Efectividad:** `85%` | **Presupuesto:** `$50,000` (`800 dosis/día`, `2 brigadas/día`)
2. Haz clic en **`⚡ Ejecutar Operación Monte Carlo`** (o en **`✓ Probar Determinismo`**).
3. **Resultado Exacto Certificado:**

| Métrica Auditada (Escenario Base · `seed: 2026`) | Valor Exacto Reproducible |
| :--- | :---: |
| **Firma Criptográfica Hash FNV-1a** | **`0x483494DD`** |
| **Auditoría Regla Estricta (Violaciones fuera de `🟢 S`)** | **`0` (`100% Solo 🟢 Sanos`)** |
| **Sin Intervención — Infectados Acumulados** | `89,791` `[82,809 - 95,502]` |
| **Intervención al Azar — Vidas Salvadas** | `13,846` `[3,589 - 39,474]` (`$49,995` ejecutados) |
| **Escudo + Cerco Perimetral — Vidas Salvadas** | **`63,286` `[20,707 - 75,027]`** (`$49,995` ejecutados) |
| **Escudo + Cerco Perimetral — Infectados Acumulados** | `26,505` `[15,101 - 73,902]` |
| **Ventaja Neta vs. Reparto al Azar** | **`+49,440` vidas salvadas adicionales** |

---

### Escenario B — Crisis en Playa El Murciélago (`Semilla: 9999` · `50 corridas` · `$35,000` · `Efectividad: 60%`)
Simula un brote turístico costero con variante de escape vacunal parcial (`60%`) y recorte presupuestario (`$35,000`):
1. En el panel de configuración (o pulsando el preset rápido **`🏖️ Crisis en El Murciélago (Seed 9999)`** al pie de los controles), ajusta:
   - **Semilla (`seed`):** `9999` | **Corridas (`runs`):** `50` | **Horizonte (`days`):** `60`
   - **Barrio Paciente Cero:** `Playa El Murciélago` *(índice `4`)* | **Tasa $\beta$:** `0.72` | **Incubación:** `3 d`
   - **Stock de Vacunas:** `24,000` | **Efectividad Biológica:** `60%` | **Presupuesto Total:** `$35,000` (`800 dosis/día`, `2 brigadas/día`)
2. Haz clic en **`⚡ Ejecutar Operación Monte Carlo`**.
3. **Resultado Exacto Certificado:**

| Métrica Auditada (Crisis El Murciélago · `seed: 9999`) | Valor Exacto Reproducible |
| :--- | :---: |
| **Firma Criptográfica Hash FNV-1a** | **`0xBC296F7E`** |
| **Auditoría Regla Estricta (Violaciones fuera de `🟢 S`)** | **`0` (`100% Solo 🟢 Sanos`)** |
| **Sin Intervención — Infectados Acumulados** | `92,716` `[88,409 - 96,198]` |
| **Intervención al Azar — Vidas Salvadas** | `6,165` `[1,554 - 22,621]` (`$34,996` ejecutados) |
| **Escudo + Cerco Perimetral — Vidas Salvadas** | **`54,642` `[24,500 - 73,001]`** (`$34,995` ejecutados) |
| **Escudo + Cerco Perimetral — Infectados Acumulados** | `38,074` `[19,546 - 69,441]` |
| **Ventaja Neta vs. Reparto al Azar** | **`+48,477` vidas salvadas adicionales** |

---

## 🛡️ 7. Resiliencia Operativa y Blindaje QA para Demostraciones en Vivo

La aplicación cuenta con un parche integral de aseguramiento de calidad (QA) en [`src/app.js`](src/app.js) y [`src/index.html`](src/index.html) diseñado para resistir pruebas extremas del jurado:

1. **Prevención Anti-Spam Click y Feedback Visual (`setOperationButtonsBusy`):**
   - Al pulsar **"⚡ Ejecutar Operación Monte Carlo"** o **"🧠 Auto-Optimizar Presupuesto y Estrategia"**, ambos botones pasan inmediatamente a `disabled = true` con animación `<span class="btn-spinner">⏳</span> Calculando en AWS...` y overlay radar translúcido.
   - El estado se libera exclusivamente dentro del bloque `finally` cuando la promesa del Fan-Out en AWS (o el fallback local) finaliza por completo.
2. **Fallback Local Instantáneo y Timeout Rápido para API Externa (`3,500 ms`):**
   - La consulta a Open-Meteo está enlazada a un `AbortController` con timeout estricto de `3,500 ms`. Si el Wi-Fi del auditorio es lento o no hay salida a internet, captura la excepción limpiamente, asigna valores climatológicos costeros por defecto (`Temp: 26.0 °C`, `Humedad: 78%`) y actualiza el badge a **`🌤️ Clima Promedio (Modo Offline)`**.
   - Si el endpoint de AWS Lambda no responde, el cliente conmuta sin errores al motor local `mulberry32` y completa las 50 corridas en `~15 ms`.
3. **Seguros Matemáticos contra División por Cero y `NaN`:**
   - Todas las ecuaciones SEIR, tasas de ataque barrial, curva de Brière y porcentajes financieros del Informe del Alcalde están protegidas con `Math.max(1, node.population)`, `Math.max(0.0001, denominador)` y `|| 0`.
   - La función `sanitizeChartSeries(arr)` filtra cada serie antes de inyectarla en **Chart.js**, garantizando que ningún input en `0` (0 vacunas, 0 presupuesto, 0 brigadas) produzca `NaN` o `Infinity`.
4. **Sincronización Bidireccional Estricta (`Sliders` $\leftrightarrow$ `Inputs`):**
   - `syncDualControl()` actualiza los sliders en vivo cuando el usuario escribe en `<input type="number">` y ejecuta `enforceStrictBounds` en los eventos `change` y `blur`, acotando los valores entre `[min, max]` para impedir números negativos o desbordamientos.

---

## 📐 8. Evidencia de Kiro Spec-Driven Development (`.kiro/`), Auditoría Shift-Left con Checkov y Limitaciones

### 8.1. Ingeniería Guiada por Especificaciones en [`.kiro/`](.kiro/)
El proyecto fue diseñado bajo la metodología **Spec-Driven Development (SDD)** con artefactos completos y trazables:
- **Steering Context ([`.kiro/steering/`](.kiro/steering/)):**
  - [`product.md`](.kiro/steering/product.md): Visión operativa para el COE Cantonal de Manta y principios de traducción científica a decisiones ejecutivas.
  - [`tech.md`](.kiro/steering/tech.md): Stack técnico AWS Serverless, restricciones de cero dependencias externas y determinismo `mulberry32` + FNV-1a.
  - [`structure.md`](.kiro/steering/structure.md): Convenciones de arquitectura modular entre `src/`, `infra/`, `docs/` y `.github/workflows/`.
- **Especificaciones Formales EARS ([`.kiro/specs/manta-epidemic-shield/`](.kiro/specs/manta-epidemic-shield/)):**
  - [`requirements.md`](.kiro/specs/manta-epidemic-shield/requirements.md): Requisitos funcionales y no funcionales redactados en notación **EARS** (*WHEN ... THE SYSTEM SHALL ...*).
  - [`design.md`](.kiro/specs/manta-epidemic-shield/design.md): Diseño matemático del motor SEIR, contrato JSON de Fan-Out paralelo y esquema de tabla DynamoDB.
  - [`tasks.md`](.kiro/specs/manta-epidemic-shield/tasks.md): Plan de implementación verificado paso a paso.
- **Agent Hook Automatizado ([`.kiro/hooks/audit-determinism-and-safety.json`](.kiro/hooks/audit-determinism-and-safety.json)):**
  - Hook que audita automáticamente la ausencia de `Math.random()`, la preservación de `DEFAULT_LAMBDA_URL`, el hash `0x483494DD` para `seed=2026` y `0` violaciones de vacunación.

### 8.2. Seguridad Shift-Left IaC con Checkov ([`.github/workflows/checkov-security.yml`](.github/workflows/checkov-security.yml))
El pipeline de GitHub Actions escanea [`infra/template.yaml`](infra/template.yaml) con **Bridgecrew Checkov** y prueba el determinismo del backend en cada cambio, validando:
- Bucket S3 privado con `PublicAccessBlockConfiguration` completo (`BlockPublicAcls: true`, `BlockPublicPolicy: true`, `IgnorePublicAcls: true`, `RestrictPublicBuckets: true`), cifrado KMS con rotación automática (`EnableKeyRotation: true`) y política HTTPS-only (`aws:SecureTransport`).
- Tabla DynamoDB `SpookyThonSimulations` con cifrado `SSE-KMS` y `PointInTimeRecoveryEnabled: true`.
- Función Lambda con `ReservedConcurrentExecutions: 25`, `Tracing: Active` (X-Ray), `DeadLetterQueue` cifrada y políticas IAM de mínimo privilegio estrictamente acotadas al ARN de la tabla y del bucket.

### 8.3. Declaración Transparente de Limitaciones del Modelo
1. **Mezcla Homogénea Intra-Barrial:** Cada uno de los 8 nodos de Manta se modela como un compartimento metapoblacional bien mezclado; no subdivide la población por grupos etarios ni comorbilidades individuales.
2. **Matriz de Movilidad Diaria Estacionaria:** Los flujos inter-barriales reflejan la conmutación urbana promedio (INEC/GAD Manta) y no varían por hora del día ni por feriados nacionales extraordinarios.
3. **Eficacia Vacunal de Acción Inmediata:** La seroconversión protectora con probabilidad $e$ se modela en el día de aplicación de la dosis sobre el individuo `🟢 Sano`, abstrayendo la ventana de maduración inmunológica de 10–14 días.
4. **Cota de Concurrencia Interactiva (`500` corridas máx.):** Para garantizar tiempos de respuesta sub-segundo en vivo y preservar el 100% de la capa gratuita de AWS, el formulario acota las corridas por petición a `[1, 500]` y el horizonte a `[10, 150]` días.

---

## 📂 Estructura Completa del Proyecto

```text
spookython-manta-zombie/
├── README.md                                       # Documentación ejecutiva, científica y guía de reproducción
├── .github/workflows/
│   └── checkov-security.yml                        # Pipeline CI/CD Shift-Left: Checkov IaC + Test Determinismo
├── .kiro/
│   ├── steering/                                   # Contexto de producto, stack tecnológico y estructura
│   │   ├── product.md
│   │   ├── tech.md
│   │   └── structure.md
│   ├── specs/manta-epidemic-shield/                # Especificaciones formales EARS, diseño y tareas
│   │   ├── requirements.md
│   │   ├── design.md
│   │   └── tasks.md
│   └── hooks/
│       └── audit-determinism-and-safety.json       # Hook de validación de determinismo y seguridad
├── docs/
│   ├── arquitectura.svg                            # Diagrama vectorial final (Público / Serverless / Privado / CI-CD)
│   ├── arquitectura.drawio                         # Fuente editable XML para diagrams.net / draw.io
│   ├── budget.png                                  # Captura oficial de AWS Budgets ($0.00 USD gasto real)
│   └── costos.md                                   # Desglose matemático para 10,000 corridas/mes ($0.00 Free Tier)
├── infra/
│   ├── lambda_simulador.py                         # Worker AWS Lambda Python 3.12 (Fan-Out, S3, DynamoDB, Open-Meteo)
│   ├── manta_inec_msp_dataset.json                 # Dataset censal INEC 2022 + MSP Manabí (8 nodos GPS reales)
│   └── template.yaml                               # Plantilla AWS SAM endurecida (S3 privado, KMS, DynamoDB PITR, IAM)
└── src/
    ├── index.html                                  # Interfaz Centro de Comando, Mapa Leaflet Fullscreen y Controles
    ├── styles.css                                  # Estética Glassmorphism, Neon y diseño Mobile-First responsivo
    ├── app.js                                      # Motor SEIR mulberry32(seed), Fan-Out 5x, Auto-Optimizador y QA
    └── deploy.zip                                  # Paquete listo para despliegue directo en AWS Amplify Hosting
```
