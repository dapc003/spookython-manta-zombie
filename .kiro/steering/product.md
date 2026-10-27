# Product Steering — Operación Contención Manta (SpookyThon 2026)

## Visión Ejecutiva
**Operación Contención Manta** es una plataforma de inteligencia epidemiológica espacial, optimización presupuestaria y simulación estocástica Monte Carlo diseñada para el **COE Cantonal y la Alcaldía de Manta (Manabí, Ecuador)**.

Opera en un **modo dual científico-narrativo**:
1. **🧟 Modo: Plaga Zombie (Track B — SpookyThon 2026):** Escenario de transmisión aguda de alta velocidad para defensa competitiva en vivo frente al jurado.
2. **🦟 Modo Real: Epidemia Dengue Manta (Datos INEC / MSP):** Gemelo epidemiológico calibrado con demografía censal real del INEC (CPV 2022), parámetros clínicos arbovirales de la Coordinación Zonal 4 del Ministerio de Salud Pública (MSP) y telemetría climática en vivo desde **Open-Meteo** para las coordenadas costeras de Manta (`-0.9677, -80.7089`).

## Reglas de Dominio Inquebrantables
1. **Regla Estricta de Vacunación (`100% Solo 🟢 Sanos`):** Queda terminantemente prohibido aplicar dosis de vacuna a individuos en estado `🟡 Expuesto/Mordido (E)`, `🔴 Infeccioso/Zombie (I)` o `🔵 Inmune/Exorcizado (R)`. El contador de violaciones auditadas debe ser siempre `0`.
2. **Reproducibilidad Determinista Exacta (`mulberry32(seed)`):** Queda prohibido el uso de `Math.random()`. Misma semilla (`seed: 2026` por defecto) + mismos parámetros deben producir siempre exactamente las mismas métricas, curvas diarias y firma **FNV-1a de 32 bits (`HashFirma`)**, tanto en ejecución secuencial como bajo **Fan-Out Paralelo de 5 Workers AWS Lambda**.
3. **Estrategia Propia Superior ("Escudo de Centralidad + Cerco Perimetral Adaptativo"):** Combina:
   - **Vacunación Preventiva (`$15/dosis`)** priorizada por grado vial, amenaza vecina y anillo perimetral cuando el foco nace en un nodo central (como *Mercado de Tarqui*) o cae la eficacia vacunal.
   - **Brigada de Fumigación / Control Vectorial (`$1,200/barrio`)** reduciendo un `40%` el contagio local durante `5 días`.
   - **Cerco Sanitario / Cuarentena Selectiva (`$3,500/barrio`)** reduciendo un `75%` el flujo inter-barrial en corredores conectados.
4. **Claridad Ejecutiva y Resiliencia:** Todo resultado técnico se traduce en un **Informe Ejecutivo sin tecnicismos para el Alcalde de Manta**, con conmutación silenciosa al motor local en milisegundos si falla la red durante el pitch.
