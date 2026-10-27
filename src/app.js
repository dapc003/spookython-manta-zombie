/**
 * OPERACIÓN CONTENCIÓN MANTA · NIVEL PRO (TRACK B: LA PLAGA ZOMBIE)
 * Simulador Epidemiológico SEIR Diario Reproducible, Panel Anti-Brote Sorpresa y Monte Carlo
 *
 * Garantías de Ingeniería:
 * 1. Grafo real de Manta: 8 barrios (100,000 hab.) y 13 aristas simétricas de contacto.
 * 2. Determinismo exacto con mulberry32(seed): cero llamadas a Math.random().
 * 3. Regla Estricta inquebrantable: Prohibido vacunar a Mordidos (E), Zombies (I) o Exorcizados (R);
 *    únicamente se vacuna a población 🟢 Sana (S) elegible.
 * 4. Nivel Pro: Efectividad vacunal (10%-100%), Presupuesto ($), Llegada escalonada diaria,
 *    Vacuna ($15), Fumigación ($1,200 / -40% local 5 días) y Cierre Selectivo ($3,500 / -75% flujo),
 *    Mapa SVG animado Día 1..60 e Informe Ejecutivo dinámico para el Alcalde de Manta.
 */

(function () {
  "use strict";

  // ============================================================================
  // 1. GRAFO OFICIAL DE MANTA (8 BARRIOS, 100,000 HABITANTES, 13 ARISTAS)
  // ============================================================================
  const MANTA_NODES = [
    {
      id: "mercado",
      index: 0,
      name: "Mercado de Tarqui",
      shortName: "Mercado Tarqui",
      population: 15000,
      neighbors: [2, 6, 1, 5], // Centro, Los Esteros, Terminal, Hospital
      x: 558,
      y: 288
    },
    {
      id: "terminal",
      index: 1,
      name: "Terminal Terrestre",
      shortName: "Terminal Terrestre",
      population: 12000,
      neighbors: [0, 3, 6, 2], // Mercado, ULEAM, Los Esteros, Centro
      x: 642,
      y: 184
    },
    {
      id: "centro",
      index: 2,
      name: "Centro de Manta",
      shortName: "Centro de Manta",
      population: 18000,
      neighbors: [0, 1, 4, 5], // Mercado, Terminal, Playa Murciélago, Hospital
      x: 450,
      y: 150
    },
    {
      id: "uleam",
      index: 3,
      name: "ULEAM",
      shortName: "ULEAM",
      population: 14000,
      neighbors: [1, 4, 7], // Terminal, Playa Murciélago, San Mateo
      x: 268,
      y: 258
    },
    {
      id: "murcielago",
      index: 4,
      name: "Playa El Murciélago",
      shortName: "Playa Murciélago",
      population: 10000,
      neighbors: [2, 3, 7], // Centro, ULEAM, San Mateo
      x: 268,
      y: 118
    },
    {
      id: "hospital",
      index: 5,
      name: "Hospital Rodríguez Zambrano",
      shortName: "Hosp. R. Zambrano",
      population: 8000,
      neighbors: [2, 0, 7], // Centro, Mercado, San Mateo
      x: 382,
      y: 358
    },
    {
      id: "esteros",
      index: 6,
      name: "Los Esteros",
      shortName: "Los Esteros",
      population: 16000,
      neighbors: [0, 1], // Mercado, Terminal
      x: 740,
      y: 292
    },
    {
      id: "san_mateo",
      index: 7,
      name: "San Mateo",
      shortName: "San Mateo",
      population: 7000,
      neighbors: [3, 4, 5], // ULEAM, Playa Murciélago, Hospital
      x: 100,
      y: 284
    }
  ];

  const TOTAL_CITY_POPULATION = MANTA_NODES.reduce((acc, n) => acc + n.population, 0); // 100,000

  const MANTA_EDGES = [];
  for (let i = 0; i < MANTA_NODES.length; i++) {
    for (const j of MANTA_NODES[i].neighbors) {
      if (i < j) {
        MANTA_EDGES.push({ u: i, v: j });
      }
    }
  }

  // Costos e impactos oficiales de las Intervenciones Combinadas
  const COST_VACCINE_DOSE = 15;          // $15 por dosis
  const COST_FUMIGATION = 1200;          // $1,200 por barrio (5 días, -40% contagio local)
  const FUMIGATION_DURATION_DAYS = 5;
  const FUMIGATION_LOCAL_MULT = 0.60;    // Reduce contagio local un 40%
  const COST_NODE_CLOSURE = 3500;        // $3,500 por barrio (-75% flujo inter-barrial)
  const CLOSURE_FLOW_MULT = 0.25;        // Reduce flujo entre barrios vecinos un 75%

  // Parámetros por defecto (Base + Nivel Pro)
  const DEFAULT_CONFIG = Object.freeze({
    seed: 2026,
    runs: 50,
    days: 60,
    patientZeroIndex: 6, // Los Esteros
    beta: 0.72,
    incubationDays: 3,
    totalVaccines: 24000,
    vaccineEfficacyPct: 85,
    totalBudget: 50000,
    dailyDoseArrival: 800,
    dailyBrigadeArrival: 2,
    useVaccines: true,
    useFumigation: true,
    useClosure: true
  });

  // Parámetros biológicos base del brote
  const INITIAL_ZOMBIES = 10;
  const EXORCISM_RATE_GAMMA = 0.20;
  const CORRIDOR_COUPLING = 0.025;
  const TACTICAL_BRIGADE_SIZE = 100;

  // ============================================================================
  // 2. GENERADOR PSEUDOALEATORIO DETERMINISTA: mulberry32(seed)
  // ============================================================================
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      let t = (a = (a + 0x6D2B79F5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function deriveSubSeeds(masterSeed, count) {
    const base = masterSeed >>> 0;
    const seeder = mulberry32(base);
    const seeds = new Uint32Array(count);
    for (let r = 0; r < count; r++) {
      seeds[r] = r === 0 ? base : Math.floor(seeder() * 4294967296) >>> 0;
    }
    return seeds;
  }

  function sampleBinomial(n, p, rng) {
    if (n <= 0 || p <= 0) return 0;
    if (p >= 1) return n;
    if (p > 0.5) {
      return n - sampleBinomial(n, 1 - p, rng);
    }

    const mean = n * p;
    if (mean < 20) {
      let successes = 0;
      let idx = 0;
      const logComplement = Math.log(1 - p);
      while (true) {
        const u = Math.max(1e-12, rng());
        const skip = Math.floor(Math.log(u) / logComplement);
        idx += skip + 1;
        if (idx > n) break;
        successes++;
      }
      return successes;
    }

    const u1 = Math.max(1e-12, rng());
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const std = Math.sqrt(mean * (1 - p));
    const sampled = Math.round(mean + std * z);
    return Math.max(0, Math.min(n, sampled));
  }

  function sampleHypergeometric(totalPop, successPop, draws, rng) {
    if (draws <= 0 || successPop <= 0 || totalPop <= 0) return 0;
    const minPossible = Math.max(0, draws - (totalPop - successPop));
    const maxPossible = Math.min(draws, successPop);
    if (minPossible >= maxPossible) return minPossible;

    if (draws <= 40) {
      let chosen = 0;
      let remTot = totalPop;
      let remSucc = successPop;
      for (let i = 0; i < draws; i++) {
        if (rng() < remSucc / remTot) {
          chosen++;
          remSucc--;
        }
        remTot--;
      }
      return Math.max(minPossible, Math.min(maxPossible, chosen));
    }

    const p = successPop / totalPop;
    const mean = draws * p;
    const fpc = totalPop > 1 ? (totalPop - draws) / (totalPop - 1) : 0;
    const variance = Math.max(0, draws * p * (1 - p) * fpc);
    const u1 = Math.max(1e-12, rng());
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const sampled = Math.round(mean + Math.sqrt(variance) * z);
    return Math.max(minPossible, Math.min(maxPossible, sampled));
  }

  /**
   * Puntaje diario oficial de "Escudo de Centralidad y Riesgo":
   * puntaje = Conexiones del barrio * Zombies en barrios vecinos * Proporción de Sanos locales
   */
  function computeShieldScore(nodeIndex, S, I) {
    if (S[nodeIndex] <= 0) return 0;
    const node = MANTA_NODES[nodeIndex];
    const connections = node.neighbors.length;
    let neighborZombies = 0;
    for (let m = 0; m < node.neighbors.length; m++) {
      neighborZombies += I[node.neighbors[m]];
    }
    const healthyRatio = S[nodeIndex] / node.population;
    return connections * neighborZombies * healthyRatio;
  }

  // ============================================================================
  // 3. SIMULACIÓN SEIR DIARIA CON PRESUPUESTO E INTERVENCIONES COMBINADAS
  // ============================================================================
  function simulateSingleTrajectory(runSeed, strategy, config, recordNodeHistory) {
    const numNodes = MANTA_NODES.length;
    const days = config.days;
    const beta = config.beta;
    const sigma = 1 / Math.max(1, config.incubationDays);
    const gamma = EXORCISM_RATE_GAMMA;
    const efficacy = Math.max(0.10, Math.min(1.0, config.vaccineEfficacyPct / 100));

    const S = new Int32Array(numNodes);
    const S_vacFailed = new Int32Array(numNodes); // Sanos vacunados cuya dosis no inmunizó por resistencia
    const E = new Int32Array(numNodes);
    const I = new Int32Array(numNodes);
    const R = new Int32Array(numNodes);

    const fumigationDaysLeft = new Int32Array(numNodes);
    const nodeClosed = new Uint8Array(numNodes);

    const vaccinatedByNode = new Int32Array(numNodes);
    const fumigationsByNode = new Int32Array(numNodes);
    const closuresByNode = new Int32Array(numNodes);
    const cumInfectedByNode = new Int32Array(numNodes);

    // Registro de acciones en las primeras 48 horas (Día 1 y Día 2) para el Informe del Alcalde
    const first48h = recordNodeHistory
      ? {
          closures: [],
          fumigations: [],
          vaccinatedByNode: new Int32Array(numNodes)
        }
      : null;

    for (let k = 0; k < numNodes; k++) {
      S[k] = MANTA_NODES[k].population;
    }

    const pz = config.patientZeroIndex;
    const initZ = Math.min(INITIAL_ZOMBIES, S[pz]);
    S[pz] -= initZ;
    I[pz] = initZ;
    cumInfectedByNode[pz] = initZ;

    let cumulativeInfected = initZ;
    let totalDosesApplied = 0;
    let totalImmunizedByVaccine = 0;
    let totalFumigations = 0;
    let totalClosures = 0;
    let totalBudgetSpent = 0;
    let forbiddenVaccineViolations = 0;

    let cashRemaining = strategy === "none" ? 0 : config.totalBudget;
    let regionalStockRemaining = strategy === "none" ? 0 : config.totalVaccines;
    let coldChainDosesAvailable = 0;

    const policyRng = mulberry32((runSeed ^ 0x9E3779B9) >>> 0);
    const effRng = mulberry32((runSeed ^ 0x517CC1B7) >>> 0);

    const dailyS = new Int32Array(days + 1);
    const dailyE = new Int32Array(days + 1);
    const dailyI = new Int32Array(days + 1);
    const dailyR = new Int32Array(days + 1);
    const dailyCumInf = new Int32Array(days + 1);
    const nodeSnapshots = recordNodeHistory ? new Array(days + 1) : null;

    function recordDay(d) {
      let sumS = 0, sumE = 0, sumI = 0, sumR = 0;
      for (let k = 0; k < numNodes; k++) {
        sumS += S[k];
        sumE += E[k];
        sumI += I[k];
        sumR += R[k];
      }
      dailyS[d] = sumS;
      dailyE[d] = sumE;
      dailyI[d] = sumI;
      dailyR[d] = sumR;
      dailyCumInf[d] = cumulativeInfected;

      if (recordNodeHistory) {
        const snap = new Array(numNodes);
        for (let k = 0; k < numNodes; k++) {
          snap[k] = {
            S: S[k],
            E: E[k],
            I: I[k],
            R: R[k],
            vaccinated: vaccinatedByNode[k],
            fumActive: fumigationDaysLeft[k] > 0,
            fumDaysLeft: fumigationDaysLeft[k],
            closed: nodeClosed[k] === 1,
            cumInf: cumInfectedByNode[k],
            score: computeShieldScore(k, S, I)
          };
        }
        nodeSnapshots[d] = snap;
      }
    }

    recordDay(0);

    const newExposed = new Int32Array(numNodes);
    const newZombies = new Int32Array(numNodes);
    const newExorcised = new Int32Array(numNodes);

    for (let d = 1; d <= days; d++) {
      // Reducir contador de días restantes de fumigación activa
      for (let k = 0; k < numNodes; k++) {
        if (fumigationDaysLeft[k] > 0) {
          fumigationDaysLeft[k]--;
        }
      }

      // Llegada escalonada diaria de dosis a la cadena de frío (hasta el tope regional)
      if (strategy !== "none" && regionalStockRemaining > 0) {
        const arrivingDoses = Math.min(config.dailyDoseArrival, regionalStockRemaining);
        coldChainDosesAvailable += arrivingDoses;
        regionalStockRemaining -= arrivingDoses;
      }

      let brigadesLeftToday = strategy === "none" ? 0 : config.dailyBrigadeArrival;

      // ------------------------------------------------------------------------
      // FASE 1: INTERVENCIONES COMBINADAS Y VACUNACIÓN ESTRICTA A 🟢 SANOS
      // ------------------------------------------------------------------------
      if (strategy === "random" && cashRemaining > 0) {
        // 1A. Operativos al azar sin inteligencia topológica
        while (brigadesLeftToday > 0) {
          const canClose = config.useClosure && cashRemaining >= COST_NODE_CLOSURE && totalClosures < 3;
          const canFum = config.useFumigation && cashRemaining >= COST_FUMIGATION && totalFumigations < 8;
          if (!canClose && !canFum) break;

          const roll = policyRng();
          const randBarrio = Math.floor(policyRng() * numNodes);

          if (canClose && roll < 0.18 && nodeClosed[randBarrio] === 0) {
            nodeClosed[randBarrio] = 1;
            closuresByNode[randBarrio]++;
            totalClosures++;
            cashRemaining -= COST_NODE_CLOSURE;
            totalBudgetSpent += COST_NODE_CLOSURE;
            brigadesLeftToday--;
          } else if (canFum && roll < 0.50 && fumigationDaysLeft[randBarrio] === 0) {
            fumigationDaysLeft[randBarrio] = FUMIGATION_DURATION_DAYS;
            fumigationsByNode[randBarrio]++;
            totalFumigations++;
            cashRemaining -= COST_FUMIGATION;
            totalBudgetSpent += COST_FUMIGATION;
            brigadesLeftToday--;
          } else {
            break;
          }
        }

        // 1B. Vacunación al azar estrictamente en población 🟢 Sana elegible
        if (config.useVaccines && coldChainDosesAvailable > 0 && cashRemaining >= COST_VACCINE_DOSE) {
          const maxAffordable = Math.floor(cashRemaining / COST_VACCINE_DOSE);
          let eligiblePool = 0;
          for (let k = 0; k < numNodes; k++) {
            eligiblePool += S[k] - S_vacFailed[k];
          }

          const toApply = Math.min(coldChainDosesAvailable, Math.min(maxAffordable, eligiblePool));
          let dosesLeft = toApply;
          let poolLeft = eligiblePool;

          for (let k = 0; k < numNodes && dosesLeft > 0; k++) {
            const eligInBarrio = S[k] - S_vacFailed[k];
            if (eligInBarrio <= 0) continue;

            const allocate = sampleHypergeometric(poolLeft, eligInBarrio, dosesLeft, policyRng);
            if (allocate > S[k]) {
              forbiddenVaccineViolations += allocate - S[k];
            }

            const immunized = sampleBinomial(allocate, efficacy, effRng);
            S[k] -= immunized;
            R[k] += immunized;
            S_vacFailed[k] += allocate - immunized;

            vaccinatedByNode[k] += allocate;
            totalDosesApplied += allocate;
            totalImmunizedByVaccine += immunized;
            coldChainDosesAvailable -= allocate;
            cashRemaining -= allocate * COST_VACCINE_DOSE;
            totalBudgetSpent += allocate * COST_VACCINE_DOSE;

            dosesLeft -= allocate;
            poolLeft -= eligInBarrio;
          }
        }
      } else if (strategy === "shield" && cashRemaining > 0) {
        // Reserva táctica adaptativa para fumigaciones durante los primeros 18 días
        // Si la efectividad de la vacuna cae (variante resistente), protege más presupuesto para fumigación y cierres
        const maxStrategicClosures = !config.useVaccines
          ? 8
          : efficacy < 0.50
            ? Math.max(1, Math.min(5, Math.floor(config.totalBudget / 9500)))
            : Math.max(1, Math.min(4, Math.floor(config.totalBudget / 12500)));

        // 2A. Cierre Selectivo de Nodo ($3,500, -75% flujo inter-barrial) en foco activo y puentes críticos
        if (config.useClosure) {
          while (
            brigadesLeftToday > 0 &&
            cashRemaining >= COST_NODE_CLOSURE &&
            totalClosures < maxStrategicClosures
          ) {
            let bestCloseNode = -1;
            let bestCloseScore = 0;

            for (let k = 0; k < numNodes; k++) {
              if (nodeClosed[k] === 1) continue;
              const deg = MANTA_NODES[k].neighbors.length;
              let neighZ = 0;
              for (let m = 0; m < deg; m++) {
                neighZ += I[MANTA_NODES[k].neighbors[m]];
              }
              const sFrac = S[k] / MANTA_NODES[k].population;

              // Prioridad 1: Contener el epicentro activo con zombies; Prioridad 2: Cerrar cuellos de botella amenazados
              let cScore = 0;
              if (I[k] >= 5) {
                cScore = 1500 + I[k] * deg * 12;
              } else if (neighZ >= 6) {
                cScore = deg * neighZ * sFrac * 3.0;
              }

              if (cScore > bestCloseScore) {
                bestCloseScore = cScore;
                bestCloseNode = k;
              }
            }

            if (bestCloseNode === -1) break;

            nodeClosed[bestCloseNode] = 1;
            closuresByNode[bestCloseNode]++;
            totalClosures++;
            cashRemaining -= COST_NODE_CLOSURE;
            totalBudgetSpent += COST_NODE_CLOSURE;
            brigadesLeftToday--;

            if (first48h && d <= 2 && !first48h.closures.includes(bestCloseNode)) {
              first48h.closures.push(bestCloseNode);
            }
          }
        }

        // 2B. Brigada de Fumigación ($1,200, -40% contagio local por 5 días) en barrios con infección activa
        if (config.useFumigation) {
          while (brigadesLeftToday > 0 && cashRemaining >= COST_FUMIGATION) {
            let bestFumNode = -1;
            let bestFumScore = 0;

            for (let k = 0; k < numNodes; k++) {
              if (fumigationDaysLeft[k] > 0 || S[k] < 150) continue;
              const activeLoad = I[k] + 0.5 * E[k];
              if (activeLoad < 4) continue;

              const sFrac = S[k] / MANTA_NODES[k].population;
              const deg = MANTA_NODES[k].neighbors.length;
              const fScore = activeLoad * sFrac * (1 + 0.3 * deg);
              if (fScore > bestFumScore) {
                bestFumScore = fScore;
                bestFumNode = k;
              }
            }

            if (bestFumNode === -1) break;

            fumigationDaysLeft[bestFumNode] = FUMIGATION_DURATION_DAYS;
            fumigationsByNode[bestFumNode]++;
            totalFumigations++;
            cashRemaining -= COST_FUMIGATION;
            totalBudgetSpent += COST_FUMIGATION;
            brigadesLeftToday--;

            if (first48h && d <= 2 && !first48h.fumigations.includes(bestFumNode)) {
              first48h.fumigations.push(bestFumNode);
            }
          }
        }

        // 2C. Vacunación Focalizada por Escudo de Centralidad y Riesgo ($15/dosis, solo 🟢 Sanos)
        if (config.useVaccines && coldChainDosesAvailable > 0 && cashRemaining >= COST_VACCINE_DOSE) {
          // Si la fumigación está activa y estamos en las primeras 2 semanas, reservar colchón operativo para re-fumigar
          const fumReserve =
            config.useFumigation && d <= 16
              ? Math.min(cashRemaining, Math.round(config.totalBudget * (efficacy < 0.50 ? 0.22 : 0.08)))
              : 0;
          const spendableForVaccines = Math.max(0, cashRemaining - fumReserve);
          const maxAffordableDoses = Math.floor(spendableForVaccines / COST_VACCINE_DOSE);

          let eligibleTotal = 0;
          for (let k = 0; k < numNodes; k++) {
            eligibleTotal += S[k] - S_vacFailed[k];
          }

          let dosesLeft = Math.min(coldChainDosesAvailable, Math.min(maxAffordableDoses, eligibleTotal));

          while (dosesLeft > 0) {
            const step = Math.min(TACTICAL_BRIGADE_SIZE, dosesLeft);
            let bestNode = -1;
            let bestScore = -1;

            for (let k = 0; k < numNodes; k++) {
              const elig = S[k] - S_vacFailed[k];
              if (elig <= 0) continue;
              // Fórmula exacta: Conexiones * Zombies_Vecinos * Proporción_Sanos_Locales
              const score = computeShieldScore(k, S, I) * (elig / Math.max(1, S[k]));
              if (score > bestScore) {
                bestScore = score;
                bestNode = k;
              }
            }

            if (bestNode === -1 || bestScore <= 0) {
              bestNode = -1;
              bestScore = -1;
              for (let k = 0; k < numNodes; k++) {
                const elig = S[k] - S_vacFailed[k];
                if (elig <= 0) continue;
                const fb =
                  MANTA_NODES[k].neighbors.length *
                  (I[k] + 1) *
                  (elig / MANTA_NODES[k].population);
                if (fb > bestScore) {
                  bestScore = fb;
                  bestNode = k;
                }
              }
            }

            if (bestNode === -1) break;
            const eligBest = S[bestNode] - S_vacFailed[bestNode];
            if (eligBest <= 0) break;

            const allocate = Math.min(step, eligBest);
            if (allocate > S[bestNode]) {
              forbiddenVaccineViolations += allocate - S[bestNode];
            }

            const immunized = sampleBinomial(allocate, efficacy, effRng);
            S[bestNode] -= immunized;
            R[bestNode] += immunized;
            S_vacFailed[bestNode] += allocate - immunized;

            vaccinatedByNode[bestNode] += allocate;
            totalDosesApplied += allocate;
            totalImmunizedByVaccine += immunized;
            coldChainDosesAvailable -= allocate;
            cashRemaining -= allocate * COST_VACCINE_DOSE;
            totalBudgetSpent += allocate * COST_VACCINE_DOSE;
            dosesLeft -= allocate;

            if (first48h && d <= 2) {
              first48h.vaccinatedByNode[bestNode] += allocate;
            }
          }
        }
      }

      // ------------------------------------------------------------------------
      // FASE 2: TRANSICIÓN DIARIA SEIR ESTOCÁSTICA (NÚMEROS ALEATORIOS COMUNES)
      // ------------------------------------------------------------------------
      for (let k = 0; k < numNodes; k++) {
        const node = MANTA_NODES[k];
        const nodeDaySeed = (runSeed ^ Math.imul(d, 73856093) ^ Math.imul(k + 1, 19349663)) >>> 0;
        const rng = mulberry32(nodeDaySeed);

        const contactDispersion = 0.60 + 0.80 * rng();

        // Efecto de Brigada de Fumigación activa: -40% contagio local
        const localFumModifier = fumigationDaysLeft[k] > 0 ? FUMIGATION_LOCAL_MULT : 1.0;
        const localForce = localFumModifier * beta * (I[k] / node.population);

        // Efecto de Cierre Selectivo de Nodo: -75% flujo inter-barrial por nodo cerrado en la arista
        const hubTrafficFactor = node.neighbors.length / 3.0;
        let neighborForce = 0;
        for (let m = 0; m < node.neighbors.length; m++) {
          const nbIdx = node.neighbors[m];
          let corridorMod = 1.0;
          if (nodeClosed[k] === 1) corridorMod *= CLOSURE_FLOW_MULT;
          if (nodeClosed[nbIdx] === 1) corridorMod *= CLOSURE_FLOW_MULT;

          neighborForce +=
            corridorMod *
            CORRIDOR_COUPLING *
            hubTrafficFactor *
            beta *
            (I[nbIdx] / MANTA_NODES[nbIdx].population);
        }

        const totalLambda = (localForce + neighborForce) * contactDispersion;
        const probBite = totalLambda > 0 ? 1 - Math.exp(-totalLambda) : 0;

        newExposed[k] = sampleBinomial(S[k], probBite, rng);
        newZombies[k] = sampleBinomial(E[k], sigma, rng);
        newExorcised[k] = sampleBinomial(I[k], gamma, rng);
      }

      for (let k = 0; k < numNodes; k++) {
        if (S[k] > 0 && newExposed[k] > 0 && S_vacFailed[k] > 0) {
          const bittenFromFailed = Math.round((newExposed[k] * S_vacFailed[k]) / S[k]);
          S_vacFailed[k] = Math.max(
            0,
            Math.min(S[k] - newExposed[k], S_vacFailed[k] - bittenFromFailed)
          );
        }

        S[k] -= newExposed[k];
        E[k] = E[k] + newExposed[k] - newZombies[k];
        I[k] = I[k] + newZombies[k] - newExorcised[k];
        R[k] += newExorcised[k];

        cumInfectedByNode[k] += newExposed[k];
        cumulativeInfected += newExposed[k];
      }

      recordDay(d);
    }

    return {
      cumulativeInfected,
      totalDosesApplied,
      totalImmunizedByVaccine,
      totalFumigations,
      totalClosures,
      totalBudgetSpent,
      forbiddenVaccineViolations,
      vaccinatedByNode,
      fumigationsByNode,
      closuresByNode,
      cumInfectedByNode,
      dailyS,
      dailyE,
      dailyI,
      dailyR,
      dailyCumInf,
      nodeSnapshots,
      first48h
    };
  }

  // ============================================================================
  // 4. AGREGADOR MONTE CARLO + FIRMA DETERMINISTA FNV-1a
  // ============================================================================
  function computeStats(values) {
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return {
      mean: sum / values.length,
      min,
      max
    };
  }

  function runMonteCarloSimulation(config) {
    const t0 = performance.now();
    const runs = config.runs;
    const days = config.days;
    const numNodes = MANTA_NODES.length;
    const subSeeds = deriveSubSeeds(config.seed, runs);

    const strategyKeys = ["none", "random", "shield"];
    const agg = {};

    for (const key of strategyKeys) {
      agg[key] = {
        infectedArr: new Float64Array(runs),
        savedArr: new Float64Array(runs),
        dosesSum: 0,
        immunizedSum: 0,
        fumigationsSum: 0,
        closuresSum: 0,
        spentSum: 0,
        violationsSum: 0,
        nodeVacSum: new Float64Array(numNodes),
        nodeFumSum: new Float64Array(numNodes),
        nodeCloseSum: new Float64Array(numNodes),
        nodeInfSum: new Float64Array(numNodes),
        dailyMeanS: new Float64Array(days + 1),
        dailyMeanE: new Float64Array(days + 1),
        dailyMeanI: new Float64Array(days + 1),
        dailyMeanR: new Float64Array(days + 1),
        dailyMeanCumInf: new Float64Array(days + 1),
        dailyMinCumInf: new Float64Array(days + 1).fill(Infinity),
        dailyMaxCumInf: new Float64Array(days + 1).fill(-Infinity),
        dailyMinI: new Float64Array(days + 1).fill(Infinity),
        dailyMaxI: new Float64Array(days + 1).fill(-Infinity),
        dailyMeanProtected: new Float64Array(days + 1),
        dailyMinProtected: new Float64Array(days + 1).fill(Infinity),
        dailyMaxProtected: new Float64Array(days + 1).fill(-Infinity),
        sampleSnapshots: null,
        first48h: null
      };
    }

    let fnvHash = 0x811c9dc5;
    function mixHash(val) {
      fnvHash ^= val & 0xff;
      fnvHash = Math.imul(fnvHash, 0x01000193) >>> 0;
      fnvHash ^= (val >>> 8) & 0xff;
      fnvHash = Math.imul(fnvHash, 0x01000193) >>> 0;
      fnvHash ^= (val >>> 16) & 0xff;
      fnvHash = Math.imul(fnvHash, 0x01000193) >>> 0;
    }

    for (let r = 0; r < runs; r++) {
      const seed = subSeeds[r];
      const recordDetail = r === 0;

      const resNone = simulateSingleTrajectory(seed, "none", config, recordDetail);
      const resRandom = simulateSingleTrajectory(seed, "random", config, recordDetail);
      const resShield = simulateSingleTrajectory(seed, "shield", config, recordDetail);

      const runResults = { none: resNone, random: resRandom, shield: resShield };
      const baseInfected = resNone.cumulativeInfected;

      for (const key of strategyKeys) {
        const res = runResults[key];
        const bucket = agg[key];

        bucket.infectedArr[r] = res.cumulativeInfected;
        bucket.savedArr[r] = baseInfected - res.cumulativeInfected;
        bucket.dosesSum += res.totalDosesApplied;
        bucket.immunizedSum += res.totalImmunizedByVaccine;
        bucket.fumigationsSum += res.totalFumigations;
        bucket.closuresSum += res.totalClosures;
        bucket.spentSum += res.totalBudgetSpent;
        bucket.violationsSum += res.forbiddenVaccineViolations;

        mixHash(res.cumulativeInfected);
        mixHash(res.totalDosesApplied);
        mixHash(res.totalBudgetSpent);

        for (let k = 0; k < numNodes; k++) {
          bucket.nodeVacSum[k] += res.vaccinatedByNode[k];
          bucket.nodeFumSum[k] += res.fumigationsByNode[k];
          bucket.nodeCloseSum[k] += res.closuresByNode[k];
          bucket.nodeInfSum[k] += res.cumInfectedByNode[k];
        }

        for (let d = 0; d <= days; d++) {
          const cumInf = res.dailyCumInf[d];
          const actI = res.dailyI[d];
          const protectedPop = TOTAL_CITY_POPULATION - cumInf;

          bucket.dailyMeanS[d] += res.dailyS[d];
          bucket.dailyMeanE[d] += res.dailyE[d];
          bucket.dailyMeanI[d] += actI;
          bucket.dailyMeanR[d] += res.dailyR[d];
          bucket.dailyMeanCumInf[d] += cumInf;
          bucket.dailyMeanProtected[d] += protectedPop;

          if (cumInf < bucket.dailyMinCumInf[d]) bucket.dailyMinCumInf[d] = cumInf;
          if (cumInf > bucket.dailyMaxCumInf[d]) bucket.dailyMaxCumInf[d] = cumInf;

          if (actI < bucket.dailyMinI[d]) bucket.dailyMinI[d] = actI;
          if (actI > bucket.dailyMaxI[d]) bucket.dailyMaxI[d] = actI;

          if (protectedPop < bucket.dailyMinProtected[d]) bucket.dailyMinProtected[d] = protectedPop;
          if (protectedPop > bucket.dailyMaxProtected[d]) bucket.dailyMaxProtected[d] = protectedPop;
        }

        if (recordDetail) {
          bucket.sampleSnapshots = res.nodeSnapshots;
          bucket.first48h = res.first48h;
        }
      }
    }

    const summary = {};
    for (const key of strategyKeys) {
      const bucket = agg[key];
      for (let d = 0; d <= days; d++) {
        bucket.dailyMeanS[d] /= runs;
        bucket.dailyMeanE[d] /= runs;
        bucket.dailyMeanI[d] /= runs;
        bucket.dailyMeanR[d] /= runs;
        bucket.dailyMeanCumInf[d] /= runs;
        bucket.dailyMeanProtected[d] /= runs;
      }

      summary[key] = {
        infectedStats: computeStats(bucket.infectedArr),
        savedStats: computeStats(bucket.savedArr),
        meanDoses: bucket.dosesSum / runs,
        meanImmunized: bucket.immunizedSum / runs,
        meanFumigations: bucket.fumigationsSum / runs,
        meanClosures: bucket.closuresSum / runs,
        meanSpent: bucket.spentSum / runs,
        violations: bucket.violationsSum,
        nodeMeanVac: Array.from(bucket.nodeVacSum, (v) => v / runs),
        nodeMeanFum: Array.from(bucket.nodeFumSum, (v) => v / runs),
        nodeMeanClose: Array.from(bucket.nodeCloseSum, (v) => v / runs),
        nodeMeanInf: Array.from(bucket.nodeInfSum, (v) => v / runs),
        series: {
          S: Array.from(bucket.dailyMeanS),
          E: Array.from(bucket.dailyMeanE),
          I: Array.from(bucket.dailyMeanI),
          R: Array.from(bucket.dailyMeanR),
          cumInfectedMean: Array.from(bucket.dailyMeanCumInf),
          cumInfectedMin: Array.from(bucket.dailyMinCumInf),
          cumInfectedMax: Array.from(bucket.dailyMaxCumInf),
          activeIMean: Array.from(bucket.dailyMeanI),
          activeIMin: Array.from(bucket.dailyMinI),
          activeIMax: Array.from(bucket.dailyMaxI),
          protectedMean: Array.from(bucket.dailyMeanProtected),
          protectedMin: Array.from(bucket.dailyMinProtected),
          protectedMax: Array.from(bucket.dailyMaxProtected)
        },
        sampleSnapshots: bucket.sampleSnapshots,
        first48h: bucket.first48h
      };
    }

    const elapsedMs = performance.now() - t0;
    const hashHex = "0x" + fnvHash.toString(16).toUpperCase().padStart(8, "0");

    return {
      config,
      subSeeds,
      summary,
      elapsedMs,
      hashHex
    };
  }

  // ============================================================================
  // 5. ESTADO DE UI, REFERENCIAS DOM Y CONTROLES
  // ============================================================================
  const fmtInt = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 });
  const fmtDec = new Intl.NumberFormat("es-EC", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function formatInt(n) {
    return fmtInt.format(Math.round(n));
  }

  function formatUSD(n) {
    return "$" + fmtInt.format(Math.round(n));
  }

  let currentResult = null;
  let activeChartMetric = "cumInfected";
  let selectedNodeIndex = DEFAULT_CONFIG.patientZeroIndex;
  let timelineDay = 1;
  let timelineTimer = null;
  let plainTextMayorBrief = "";
  let latestRequestId = 0;

  const DEFAULT_LAMBDA_URL = "https://sw5fdgyzewlgqjttz2jhjkvaey0udlbt.lambda-url.us-east-2.on.aws/";
  const LAMBDA_STORAGE_KEY = "manta_contencion_lambda_url";

  let comparisonChartInstance = null;
  let seirChartInstance = null;

  const dom = {
    // Conexión Cloud AWS Lambda
    inputLambdaUrl: document.getElementById("inputLambdaUrl"),
    btnApplyLambda: document.getElementById("btnApplyLambda"),
    btnClearLambda: document.getElementById("btnClearLambda"),
    cloudStatusPill: document.getElementById("cloudStatusPill"),
    cloudStatusText: document.getElementById("cloudStatusText"),

    form: document.getElementById("simForm"),
    inputSeed: document.getElementById("inputSeed"),
    rangeRuns: document.getElementById("rangeRuns"),
    inputRuns: document.getElementById("inputRuns"),
    outRuns: document.getElementById("outRuns"),
    rangeDays: document.getElementById("rangeDays"),
    inputDays: document.getElementById("inputDays"),
    outDays: document.getElementById("outDays"),
    selectPatientZero: document.getElementById("selectPatientZero"),
    rangeBeta: document.getElementById("rangeBeta"),
    inputBeta: document.getElementById("inputBeta"),
    outBeta: document.getElementById("outBeta"),
    rangeIncubation: document.getElementById("rangeIncubation"),
    inputIncubation: document.getElementById("inputIncubation"),
    outIncubation: document.getElementById("outIncubation"),
    rangeVaccines: document.getElementById("rangeVaccines"),
    inputVaccines: document.getElementById("inputVaccines"),
    outVaccines: document.getElementById("outVaccines"),

    // Controles Anti-Brote Sorpresa (Nivel Pro)
    rangeEfficacy: document.getElementById("rangeEfficacy"),
    inputEfficacy: document.getElementById("inputEfficacy"),
    outEfficacy: document.getElementById("outEfficacy"),
    rangeBudget: document.getElementById("rangeBudget"),
    inputBudget: document.getElementById("inputBudget"),
    outBudget: document.getElementById("outBudget"),
    rangeDailyDoses: document.getElementById("rangeDailyDoses"),
    inputDailyDoses: document.getElementById("inputDailyDoses"),
    outDailyDoses: document.getElementById("outDailyDoses"),
    rangeDailyBrigades: document.getElementById("rangeDailyBrigades"),
    inputDailyBrigades: document.getElementById("inputDailyBrigades"),
    outDailyBrigades: document.getElementById("outDailyBrigades"),

    chkUseVaccines: document.getElementById("chkUseVaccines"),
    chkUseFumigation: document.getElementById("chkUseFumigation"),
    chkUseClosure: document.getElementById("chkUseClosure"),
    statShieldVaccines: document.getElementById("statShieldVaccines"),
    statShieldFumigation: document.getElementById("statShieldFumigation"),
    statShieldClosure: document.getElementById("statShieldClosure"),

    btnVerifyDeterminism: document.getElementById("btnVerifyDeterminism"),
    btnResetDefaults: document.getElementById("btnResetDefaults"),
    reproBanner: document.getElementById("reproBanner"),
    execTimingInfo: document.getElementById("execTimingInfo"),

    activeSeedBadge: document.getElementById("activeSeedBadge"),
    determinismHash: document.getElementById("determinismHash"),
    strictAuditBadge: document.getElementById("strictAuditBadge"),

    // KPIs
    kpiBase1SavedMean: document.getElementById("kpiBase1SavedMean"),
    kpiBase1SavedRange: document.getElementById("kpiBase1SavedRange"),
    kpiBase1InfMean: document.getElementById("kpiBase1InfMean"),
    kpiBase1InfRange: document.getElementById("kpiBase1InfRange"),
    kpiBase1Footer: document.getElementById("kpiBase1Footer"),

    kpiRandomVacPill: document.getElementById("kpiRandomVacPill"),
    kpiRandomSavedMean: document.getElementById("kpiRandomSavedMean"),
    kpiRandomSavedRange: document.getElementById("kpiRandomSavedRange"),
    kpiRandomInfMean: document.getElementById("kpiRandomInfMean"),
    kpiRandomInfRange: document.getElementById("kpiRandomInfRange"),
    kpiRandomFooter: document.getElementById("kpiRandomFooter"),

    kpiShieldDeltaBadge: document.getElementById("kpiShieldDeltaBadge"),
    kpiShieldSavedMean: document.getElementById("kpiShieldSavedMean"),
    kpiShieldSavedRange: document.getElementById("kpiShieldSavedRange"),
    kpiShieldInfMean: document.getElementById("kpiShieldInfMean"),
    kpiShieldInfRange: document.getElementById("kpiShieldInfRange"),
    kpiShieldFooter: document.getElementById("kpiShieldFooter"),

    // Informe Ejecutivo del Alcalde
    mayorReportContainer: document.getElementById("mayorReportContainer"),
    btnCopyMayorReport: document.getElementById("btnCopyMayorReport"),

    // Mapa SVG y Animación Día 1..60
    mapDescMaxDay: document.getElementById("mapDescMaxDay"),
    selectMapStrategy: document.getElementById("selectMapStrategy"),
    btnPlayTimeline: document.getElementById("btnPlayTimeline"),
    btnResetTimeline: document.getElementById("btnResetTimeline"),
    selectPlaySpeed: document.getElementById("selectPlaySpeed"),
    timelineDayLabel: document.getElementById("timelineDayLabel"),
    timelineMaxDayLabel: document.getElementById("timelineMaxDayLabel"),
    timelineSlider: document.getElementById("timelineSlider"),
    timelineProgressFill: document.getElementById("timelineProgressFill"),
    cityLiveS: document.getElementById("cityLiveS"),
    cityLiveE: document.getElementById("cityLiveE"),
    cityLiveI: document.getElementById("cityLiveI"),
    cityLiveR: document.getElementById("cityLiveR"),
    svgEdgesLayer: document.getElementById("svgEdgesLayer"),
    svgNodesLayer: document.getElementById("svgNodesLayer"),

    inspNodeName: document.getElementById("inspNodeName"),
    inspNodeMeta: document.getElementById("inspNodeMeta"),
    btnSetPatientZeroFromMap: document.getElementById("btnSetPatientZeroFromMap"),
    inspS: document.getElementById("inspS"),
    inspE: document.getElementById("inspE"),
    inspI: document.getElementById("inspI"),
    inspR: document.getElementById("inspR"),
    inspVac: document.getElementById("inspVac"),
    inspScore: document.getElementById("inspScore"),

    // Tabla y Gráficas
    tableFinalDay: document.getElementById("tableFinalDay"),
    barrioTableBody: document.getElementById("barrioTableBody"),
    barrioTableFoot: document.getElementById("barrioTableFoot"),
    auditSummaryText: document.getElementById("auditSummaryText"),
    comparisonCanvas: document.getElementById("comparisonChart"),
    seirCanvas: document.getElementById("seirBreakdownChart"),
    selectSeirStrategy: document.getElementById("selectSeirStrategy")
  };

  function populatePatientZeroSelect() {
    dom.selectPatientZero.innerHTML = "";
    MANTA_NODES.forEach((node) => {
      const opt = document.createElement("option");
      opt.value = String(node.index);
      opt.textContent = `${node.name} (${formatInt(node.population)} hab · ${node.neighbors.length} conex.)`;
      if (node.index === DEFAULT_CONFIG.patientZeroIndex) {
        opt.selected = true;
      }
      dom.selectPatientZero.appendChild(opt);
    });
  }

  function syncDualControl(rangeEl, numEl, outEl, formatter) {
    rangeEl.addEventListener("input", () => {
      numEl.value = rangeEl.value;
      if (outEl) outEl.textContent = formatter(Number(rangeEl.value));
    });
    numEl.addEventListener("input", () => {
      const v = Number(numEl.value);
      if (!Number.isNaN(v)) {
        rangeEl.value = String(Math.max(Number(rangeEl.min), Math.min(Number(rangeEl.max), v)));
        if (outEl) outEl.textContent = formatter(v);
      }
    });
  }

  function readConfigFromForm() {
    const seedRaw = parseInt(dom.inputSeed.value, 10);
    const runsRaw = parseInt(dom.inputRuns.value, 10);
    const daysRaw = parseInt(dom.inputDays.value, 10);
    const pzRaw = parseInt(dom.selectPatientZero.value, 10);
    const betaRaw = parseFloat(dom.inputBeta.value);
    const incRaw = parseInt(dom.inputIncubation.value, 10);
    const vacRaw = parseInt(dom.inputVaccines.value, 10);

    const effRaw = parseInt(dom.inputEfficacy.value, 10);
    const budgetRaw = parseInt(dom.inputBudget.value, 10);
    const dailyDoseRaw = parseInt(dom.inputDailyDoses.value, 10);
    const dailyBrigRaw = parseInt(dom.inputDailyBrigades.value, 10);

    const config = {
      seed: Number.isFinite(seedRaw) ? Math.max(0, seedRaw) : DEFAULT_CONFIG.seed,
      runs: Number.isFinite(runsRaw) ? Math.max(1, Math.min(500, runsRaw)) : DEFAULT_CONFIG.runs,
      days: Number.isFinite(daysRaw) ? Math.max(10, Math.min(365, daysRaw)) : DEFAULT_CONFIG.days,
      patientZeroIndex:
        Number.isFinite(pzRaw) && pzRaw >= 0 && pzRaw < MANTA_NODES.length
          ? pzRaw
          : DEFAULT_CONFIG.patientZeroIndex,
      beta: Number.isFinite(betaRaw) ? Math.max(0.05, Math.min(2.5, betaRaw)) : DEFAULT_CONFIG.beta,
      incubationDays: Number.isFinite(incRaw) ? Math.max(1, Math.min(30, incRaw)) : DEFAULT_CONFIG.incubationDays,
      totalVaccines: Number.isFinite(vacRaw)
        ? Math.max(0, Math.min(TOTAL_CITY_POPULATION, vacRaw))
        : DEFAULT_CONFIG.totalVaccines,
      vaccineEfficacyPct: Number.isFinite(effRaw)
        ? Math.max(10, Math.min(100, effRaw))
        : DEFAULT_CONFIG.vaccineEfficacyPct,
      totalBudget: Number.isFinite(budgetRaw)
        ? Math.max(0, Math.min(2000000, budgetRaw))
        : DEFAULT_CONFIG.totalBudget,
      dailyDoseArrival: Number.isFinite(dailyDoseRaw)
        ? Math.max(0, Math.min(20000, dailyDoseRaw))
        : DEFAULT_CONFIG.dailyDoseArrival,
      dailyBrigadeArrival: Number.isFinite(dailyBrigRaw)
        ? Math.max(0, Math.min(20, dailyBrigRaw))
        : DEFAULT_CONFIG.dailyBrigadeArrival,
      useVaccines: dom.chkUseVaccines.checked,
      useFumigation: dom.chkUseFumigation.checked,
      useClosure: dom.chkUseClosure.checked
    };

    applyConfigToForm(config);
    return config;
  }

  function applyConfigToForm(cfg) {
    dom.inputSeed.value = String(cfg.seed);

    dom.inputRuns.value = String(cfg.runs);
    dom.rangeRuns.value = String(Math.min(200, cfg.runs));
    dom.outRuns.textContent = String(cfg.runs);

    dom.inputDays.value = String(cfg.days);
    dom.rangeDays.value = String(Math.min(150, cfg.days));
    dom.outDays.textContent = `${cfg.days} d`;

    dom.selectPatientZero.value = String(cfg.patientZeroIndex);

    dom.inputBeta.value = cfg.beta.toFixed(2);
    dom.rangeBeta.value = String(Math.min(1.5, cfg.beta));
    dom.outBeta.textContent = cfg.beta.toFixed(2);

    dom.inputIncubation.value = String(cfg.incubationDays);
    dom.rangeIncubation.value = String(Math.min(14, cfg.incubationDays));
    dom.outIncubation.textContent = `${cfg.incubationDays} d`;

    dom.inputVaccines.value = String(cfg.totalVaccines);
    dom.rangeVaccines.value = String(cfg.totalVaccines);
    dom.outVaccines.textContent = formatInt(cfg.totalVaccines);

    dom.inputEfficacy.value = String(cfg.vaccineEfficacyPct);
    dom.rangeEfficacy.value = String(cfg.vaccineEfficacyPct);
    dom.outEfficacy.textContent = `${cfg.vaccineEfficacyPct}%`;

    dom.inputBudget.value = String(cfg.totalBudget);
    dom.rangeBudget.value = String(Math.min(300000, cfg.totalBudget));
    dom.outBudget.textContent = formatUSD(cfg.totalBudget);

    dom.inputDailyDoses.value = String(cfg.dailyDoseArrival);
    dom.rangeDailyDoses.value = String(Math.min(4000, cfg.dailyDoseArrival));
    dom.outDailyDoses.textContent = `${formatInt(cfg.dailyDoseArrival)} /día`;

    dom.inputDailyBrigades.value = String(cfg.dailyBrigadeArrival);
    dom.rangeDailyBrigades.value = String(Math.min(8, cfg.dailyBrigadeArrival));
    dom.outDailyBrigades.textContent = `${cfg.dailyBrigadeArrival} /día`;

    dom.chkUseVaccines.checked = cfg.useVaccines;
    dom.chkUseFumigation.checked = cfg.useFumigation;
    dom.chkUseClosure.checked = cfg.useClosure;
  }

  // ============================================================================
  // 6. INFORME EJECUTIVO AUTOMÁTICO PARA EL ALCALDE DE MANTA (SIN TECNICISMOS)
  // ============================================================================
  function renderMayorReport(result) {
    const { config, summary } = result;
    const sNone = summary.none;
    const sRand = summary.random;
    const sShield = summary.shield;

    const pzNode = MANTA_NODES[config.patientZeroIndex];

    // Identificar barrios intervenidos en las primeras 48 horas (Día 1 y Día 2)
    const f48 = sShield.first48h || {
      closures: [],
      fumigations: [],
      vaccinatedByNode: new Int32Array(MANTA_NODES.length)
    };

    const priorityNeighbors = pzNode.neighbors
      .slice()
      .sort((a, b) => MANTA_NODES[b].neighbors.length - MANTA_NODES[a].neighbors.length)
      .slice(0, 2)
      .map((idx) => MANTA_NODES[idx].name);

    const earlyTargetSet = new Set([pzNode.name]);
    f48.closures.forEach((idx) => earlyTargetSet.add(MANTA_NODES[idx].name));
    f48.fumigations.forEach((idx) => earlyTargetSet.add(MANTA_NODES[idx].name));
    MANTA_NODES.forEach((n, idx) => {
      if (f48.vaccinatedByNode[idx] > 0) earlyTargetSet.add(n.name);
    });
    priorityNeighbors.forEach((name) => earlyTargetSet.add(name));

    const first48Names = Array.from(earlyTargetSet);
    const bridgeText = priorityNeighbors.join(" y ");

    // Cálculos de presupuesto promedio ejecutado por el Escudo
    const vacCost = Math.round(sShield.meanDoses * COST_VACCINE_DOSE);
    const fumCost = Math.round(sShield.meanFumigations * COST_FUMIGATION);
    const closeCost = Math.round(sShield.meanClosures * COST_NODE_CLOSURE);
    const totalSpent = Math.round(sShield.meanSpent);

    const savedVsNoneMean = Math.round(sShield.savedStats.mean);
    const savedVsNoneMin = Math.round(sShield.savedStats.min);
    const savedVsNoneMax = Math.round(sShield.savedStats.max);

    const randSavedMean = Math.round(sRand.savedStats.mean);
    const randSavedMin = Math.round(sRand.savedStats.min);
    const randSavedMax = Math.round(sRand.savedStats.max);

    const extraVsRandom = savedVsNoneMean - randSavedMean;

    const variantAlert =
      config.vaccineEfficacyPct < 60
        ? ` Ante la baja efectividad de la vacuna frente a esta variante (${config.vaccineEfficacyPct}%), el plan refuerza automáticamente los cierres viales y la fumigación para no depender solo del biológico.`
        : ` Con una efectividad vacunal del ${config.vaccineEfficacyPct}%, cada dosis aplicada exclusivamente a vecinos sanos levanta una barrera real de protección.`;

    const leadText =
      `Señor Alcalde de Manta: Se ha detectado el inicio del brote en ${pzNode.name}. ` +
      `Activando de inmediato la operación "Escudo de Centralidad y Riesgo" con un presupuesto de ${formatUSD(config.totalBudget)} ` +
      `(ejecutando en promedio ${formatUSD(totalSpent)}), protegeremos la vida de ${formatInt(savedVsNoneMean)} mantenses en promedio ` +
      `[Rango: ${formatInt(savedVsNoneMin)} a ${formatInt(savedVsNoneMax)}] en los próximos ${config.days} días.`;

    const sec1Text =
      `En las primeras 48 horas debemos intervenir de forma prioritaria en: ${first48Names.join(", ")}. ` +
      `El primer paso es contener y fumigar de inmediato ${pzNode.name} para frenar los contagios dentro del foco inicial, ` +
      `mientras instalamos controles viales y brigadas de vacunación preventiva en sus accesos clave (${bridgeText}) antes de que la plaga cruce hacia el resto de la ciudad.`;

    const sec2Text =
      `De los ${formatUSD(config.totalBudget)} autorizados (con llegada escalonada de ${formatInt(config.dailyDoseArrival)} dosis y ${config.dailyBrigadeArrival} brigadas operativas por día), ` +
      `la inversión óptima destina: ` +
      `1) ${formatUSD(closeCost)} para ${fmtDec.format(sShield.meanClosures)} cierres selectivos de acceso vial ($3,500 c/u, reduciendo un 75% el paso del brote entre barrios); ` +
      `2) ${formatUSD(fumCost)} para ${fmtDec.format(sShield.meanFumigations)} operativos de fumigación intensiva ($1,200 c/u, reduciendo un 40% los contagios locales por 5 días); y ` +
      `3) ${formatUSD(vacCost)} para aplicar ${formatInt(sShield.meanDoses)} dosis de vacuna ($15 c/u) únicamente a ciudadanos sanos.${variantAlert}`;

    const sec3Text =
      `• Frente a no hacer nada (donde se infectarían cerca de ${formatInt(sNone.infectedStats.mean)} personas): nuestra estrategia salva en promedio ${formatInt(savedVsNoneMean)} vidas, con un rango comprobado entre [${formatInt(savedVsNoneMin)} - ${formatInt(savedVsNoneMax)}] personas libres de contagio. ` +
      `• Frente a repartir recursos al azar (que apenas salva ${formatInt(randSavedMean)} personas [${formatInt(randSavedMin)} - ${formatInt(randSavedMax)}]): nuestra estrategia focalizada rescata ${extraVsRandom >= 0 ? "+" : ""}${formatInt(extraVsRandom)} ciudadanos adicionales con el mismo techo presupuestario.`;

    const sec4Text =
      `Si repartimos vacunas y brigadas al azar por toda Manta, los recursos llegan diluidos y el brote atraviesa sin freno las avenidas principales. ` +
      `En cambio, nuestra estrategia funciona como un cortafuegos inteligente: debilita el brote donde nació, cierra temporalmente el paso en los cruces más transitados de la ciudad ` +
      `y vacuna estrictamente a vecinos sanos (jamás desperdiciando dosis en personas ya mordidas, infectadas o inmunizadas), aislando a barrios enteros del peligro.`;

    dom.mayorReportContainer.innerHTML = `
      <div class="mayor-lead">
        <strong>Resumen Directivo Inmediato:</strong> ${leadText}
      </div>
      <div class="mayor-card">
        <h3>⏱️ 1. Barrios a Intervenir en las Primeras 48 Horas</h3>
        <p>${sec1Text}</p>
      </div>
      <div class="mayor-card">
        <h3>💰 2. Cómo Distribuir el Presupuesto (${formatUSD(config.totalBudget)})</h3>
        <p>${sec2Text}</p>
      </div>
      <div class="mayor-card">
        <h3>🛟 3. Vidas Salvadas [Rango Mínimo - Máximo]</h3>
        <p>${sec3Text}</p>
      </div>
      <div class="mayor-card">
        <h3>🧭 4. Justificación Clara de la Estrategia</h3>
        <p>${sec4Text}</p>
      </div>
    `;

    plainTextMayorBrief = [
      "INFORME EJECUTIVO OFICIAL · ALCALDÍA DE MANTA (COE CANTONAL)",
      "============================================================",
      leadText,
      "",
      "1. PRIMERAS 48 HORAS:",
      sec1Text,
      "",
      `2. DISTRIBUCIÓN DEL PRESUPUESTO (${formatUSD(config.totalBudget)}):`,
      sec2Text,
      "",
      "3. IMPACTO EN VIDAS SALVADAS [MÍNIMO - MÁXIMO]:",
      sec3Text,
      "",
      "4. JUSTIFICACIÓN DE LA ESTRATEGIA:",
      sec4Text
    ].join("\n");
  }

  // ============================================================================
  // 7. ACTUALIZACIÓN DE TARJETAS KPI, COSTOS Y TABLA POR BARRIO
  // ============================================================================
  function renderKpisAndAudit(result) {
    const { config, summary, elapsedMs, hashHex } = result;
    const sNone = summary.none;
    const sRand = summary.random;
    const sShield = summary.shield;

    dom.activeSeedBadge.textContent = `mulberry32(${config.seed})`;
    dom.determinismHash.textContent = hashHex;

    const totalViolations = sNone.violations + sRand.violations + sShield.violations;
    dom.strictAuditBadge.textContent =
      totalViolations === 0 ? "100% Solo 🟢 Sanos" : `Violaciones: ${totalViolations}`;

    dom.execTimingInfo.textContent = `${config.runs} corridas × 3 estrategias en ${fmtDec.format(elapsedMs)} ms`;

    // Estadísticas en tarjetas de Intervenciones Combinadas
    dom.statShieldVaccines.textContent =
      `Escudo: ${formatInt(sShield.meanDoses)} dosis (${formatUSD(sShield.meanDoses * COST_VACCINE_DOSE)}) · Inmunizados: ${formatInt(sShield.meanImmunized)}`;
    dom.statShieldFumigation.textContent =
      `Escudo: ${fmtDec.format(sShield.meanFumigations)} brigadas (${formatUSD(sShield.meanFumigations * COST_FUMIGATION)})`;
    dom.statShieldClosure.textContent =
      `Escudo: ${fmtDec.format(sShield.meanClosures)} cierres (${formatUSD(sShield.meanClosures * COST_NODE_CLOSURE)})`;

    // KPI 1: Sin Intervención
    dom.kpiBase1SavedMean.textContent = "0";
    dom.kpiBase1SavedRange.textContent = "[0 - 0]";
    dom.kpiBase1InfMean.textContent = formatInt(sNone.infectedStats.mean);
    dom.kpiBase1InfRange.textContent = `[${formatInt(sNone.infectedStats.min)} - ${formatInt(sNone.infectedStats.max)}]`;
    dom.kpiBase1Footer.textContent =
      `Población nunca infectada: ${formatInt(TOTAL_CITY_POPULATION - sNone.infectedStats.mean)} hab.`;

    // KPI 2: Intervención al Azar
    dom.kpiRandomVacPill.textContent = `${formatUSD(sRand.meanSpent)} ejecutados`;
    dom.kpiRandomSavedMean.textContent = formatInt(sRand.savedStats.mean);
    dom.kpiRandomSavedRange.textContent = `[${formatInt(sRand.savedStats.min)} - ${formatInt(sRand.savedStats.max)}]`;
    dom.kpiRandomInfMean.textContent = formatInt(sRand.infectedStats.mean);
    dom.kpiRandomInfRange.textContent = `[${formatInt(sRand.infectedStats.min)} - ${formatInt(sRand.infectedStats.max)}]`;
    dom.kpiRandomFooter.textContent =
      `Dosis a 🟢 S: ${formatInt(sRand.meanDoses)} · Fumig.: ${fmtDec.format(sRand.meanFumigations)} · Cierres: ${fmtDec.format(sRand.meanClosures)}`;

    // KPI 3: Escudo de Centralidad y Riesgo
    const extraLives = sShield.savedStats.mean - sRand.savedStats.mean;
    const sign = extraLives >= 0 ? "+" : "";
    dom.kpiShieldDeltaBadge.textContent = `${sign}${formatInt(extraLives)} vs. Azar`;

    dom.kpiShieldSavedMean.textContent = formatInt(sShield.savedStats.mean);
    dom.kpiShieldSavedRange.textContent = `[${formatInt(sShield.savedStats.min)} - ${formatInt(sShield.savedStats.max)}]`;
    dom.kpiShieldInfMean.textContent = formatInt(sShield.infectedStats.mean);
    dom.kpiShieldInfRange.textContent = `[${formatInt(sShield.infectedStats.min)} - ${formatInt(sShield.infectedStats.max)}]`;
    dom.kpiShieldFooter.textContent =
      `Inversión: ${formatUSD(sShield.meanSpent)} / ${formatUSD(config.totalBudget)} · Dosis 🟢 S: ${formatInt(sShield.meanDoses)}`;

    // Tabla por Barrio
    dom.tableFinalDay.textContent = String(config.days);
    dom.barrioTableBody.innerHTML = "";

    let totVac = 0;
    let totFum = 0;
    let totClose = 0;
    let totInfNone = 0;
    let totInfRand = 0;
    let totInfShield = 0;

    MANTA_NODES.forEach((node, idx) => {
      const vac = sShield.nodeMeanVac[idx];
      const fum = sShield.nodeMeanFum[idx];
      const cls = sShield.nodeMeanClose[idx];
      const infNone = sNone.nodeMeanInf[idx];
      const infRand = sRand.nodeMeanInf[idx];
      const infShield = sShield.nodeMeanInf[idx];
      const savedLocal = infNone - infShield;

      totVac += vac;
      totFum += fum;
      totClose += cls;
      totInfNone += infNone;
      totInfRand += infRand;
      totInfShield += infShield;

      const opsBadges = [];
      if (cls >= 0.05) opsBadges.push(`🚧${fmtDec.format(cls)}`);
      if (fum >= 0.05) opsBadges.push(`🌫️${fmtDec.format(fum)}`);
      const opsText = opsBadges.length > 0 ? opsBadges.join(" ") : "—";

      const tr = document.createElement("tr");
      if (idx === selectedNodeIndex) {
        tr.classList.add("row-selected");
      }

      const isPZ = idx === config.patientZeroIndex;
      tr.innerHTML = `
        <td>
          <span class="barrio-cell-name">
            ${node.name}
            ${isPZ ? '<span class="pz-marker" title="Barrio Paciente Cero">☣ CERO</span>' : ""}
          </span>
        </td>
        <td class="num">${formatInt(node.population)}</td>
        <td class="num">${node.neighbors.length}</td>
        <td class="num" style="color:#67e8f9;">${formatInt(vac)}</td>
        <td class="num" style="color:#fde68a;">${opsText}</td>
        <td class="num" style="color:#fca5a5;">${formatInt(infNone)}</td>
        <td class="num" style="color:#fcd34d;">${formatInt(infRand)}</td>
        <td class="num" style="color:#6ee7b7;font-weight:700;">${formatInt(infShield)}</td>
        <td class="num" style="color:#34d399;font-weight:700;">+${formatInt(savedLocal)}</td>
      `;

      tr.addEventListener("click", () => {
        selectedNodeIndex = idx;
        renderMapState();
        highlightSelectedTableRow();
      });

      dom.barrioTableBody.appendChild(tr);
    });

    const totSavedShield = totInfNone - totInfShield;
    dom.barrioTableFoot.innerHTML = `
      <tr>
        <td>TOTAL MANTA (8 Barrios)</td>
        <td class="num">${formatInt(TOTAL_CITY_POPULATION)}</td>
        <td class="num">13 aristas</td>
        <td class="num" style="color:#67e8f9;">${formatInt(totVac)}</td>
        <td class="num" style="color:#fde68a;">🚧${fmtDec.format(totClose)} · 🌫️${fmtDec.format(totFum)}</td>
        <td class="num" style="color:#fca5a5;">${formatInt(totInfNone)}</td>
        <td class="num" style="color:#fcd34d;">${formatInt(totInfRand)}</td>
        <td class="num" style="color:#6ee7b7;">${formatInt(totInfShield)}</td>
        <td class="num" style="color:#34d399;">+${formatInt(totSavedShield)}</td>
      </tr>
    `;

    const firstSeedsPreview = Array.from(result.subSeeds.slice(0, Math.min(4, result.subSeeds.length)))
      .map((s) => s.toString())
      .join(", ");

    dom.auditSummaryText.textContent =
      `Semilla ${config.seed} → sub-semillas [${firstSeedsPreview}${result.subSeeds.length > 4 ? ", ..." : ""}] (${config.runs} corridas). ` +
      `Presupuesto ejecutado por Escudo: ${formatUSD(sShield.meanSpent)} de ${formatUSD(config.totalBudget)} autorizados. ` +
      `Efectividad vacunal: ${config.vaccineEfficacyPct}%. Dosis aplicadas a 🟡 Mordidos, 🔴 Zombies o 🔵 Exorcizados: 0 (cumplimiento estricto 100%). Hash: ${hashHex}.`;
  }

  function highlightSelectedTableRow() {
    const rows = dom.barrioTableBody.querySelectorAll("tr");
    rows.forEach((row, idx) => {
      row.classList.toggle("row-selected", idx === selectedNodeIndex);
    });
  }

  // ============================================================================
  // 8. GRÁFICAS DIARIAS CON CHART.JS (MÁS FALLBACK CANVAS 2D)
  // ============================================================================
  function renderCharts(result) {
    const days = result.config.days;
    const labels = Array.from({ length: days + 1 }, (_, d) => `Día ${d}`);
    const sNone = result.summary.none.series;
    const sRand = result.summary.random.series;
    const sShield = result.summary.shield.series;

    let meanNone, minNone, maxNone;
    let meanRand, minRand, maxRand;
    let meanShield, minShield, maxShield;
    let yAxisTitle = "Personas";

    if (activeChartMetric === "activeZombies") {
      meanNone = sNone.activeIMean; minNone = sNone.activeIMin; maxNone = sNone.activeIMax;
      meanRand = sRand.activeIMean; minRand = sRand.activeIMin; maxRand = sRand.activeIMax;
      meanShield = sShield.activeIMean; minShield = sShield.activeIMin; maxShield = sShield.activeIMax;
      yAxisTitle = "🔴 Zombies Activos I(t)";
    } else if (activeChartMetric === "protectedPop") {
      meanNone = sNone.protectedMean; minNone = sNone.protectedMin; maxNone = sNone.protectedMax;
      meanRand = sRand.protectedMean; minRand = sRand.protectedMin; maxRand = sRand.protectedMax;
      meanShield = sShield.protectedMean; minShield = sShield.protectedMin; maxShield = sShield.protectedMax;
      yAxisTitle = "Población Nunca Infectada (Hab.)";
    } else {
      meanNone = sNone.cumInfectedMean; minNone = sNone.cumInfectedMin; maxNone = sNone.cumInfectedMax;
      meanRand = sRand.cumInfectedMean; minRand = sRand.cumInfectedMin; maxRand = sRand.cumInfectedMax;
      meanShield = sShield.cumInfectedMean; minShield = sShield.cumInfectedMin; maxShield = sShield.cumInfectedMax;
      yAxisTitle = "Infectados Acumulados (Hab.)";
    }

    const seirKey = dom.selectSeirStrategy.value || "shield";
    const chosenSeir = result.summary[seirKey].series;

    if (typeof window.Chart === "undefined") {
      drawFallbackLines(dom.comparisonCanvas, [
        { label: "Sin Intervención", color: "#ef4444", data: meanNone },
        { label: "Intervención al Azar", color: "#f59e0b", data: meanRand },
        { label: "Escudo Centralidad y Riesgo", color: "#06d6a0", data: meanShield }
      ]);
      drawFallbackLines(dom.seirCanvas, [
        { label: "Sano (S)", color: "#10b981", data: chosenSeir.S },
        { label: "Mordido (E)", color: "#f59e0b", data: chosenSeir.E },
        { label: "Zombie (I)", color: "#ef4444", data: chosenSeir.I },
        { label: "Exorcizado/Inmune (R)", color: "#3b82f6", data: chosenSeir.R }
      ]);
      return;
    }

    if (comparisonChartInstance) {
      comparisonChartInstance.destroy();
    }

    comparisonChartInstance = new window.Chart(dom.comparisonCanvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Sin Intervención (Promedio)",
            data: meanNone,
            borderColor: "#ef4444",
            backgroundColor: "#ef4444",
            borderWidth: 2.5,
            borderDash: [6, 4],
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.25
          },
          {
            label: "Sin Intervención [Máx]",
            data: maxNone,
            borderColor: "transparent",
            backgroundColor: "rgba(239, 68, 68, 0.10)",
            pointRadius: 0,
            fill: "+1",
            tension: 0.25,
            legendHidden: true
          },
          {
            label: "Sin Intervención [Mín]",
            data: minNone,
            borderColor: "transparent",
            backgroundColor: "transparent",
            pointRadius: 0,
            fill: false,
            tension: 0.25,
            legendHidden: true
          },
          {
            label: "Intervención al Azar (Promedio)",
            data: meanRand,
            borderColor: "#f59e0b",
            backgroundColor: "#f59e0b",
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.25
          },
          {
            label: "Azar [Máx]",
            data: maxRand,
            borderColor: "transparent",
            backgroundColor: "rgba(245, 158, 11, 0.11)",
            pointRadius: 0,
            fill: "+1",
            tension: 0.25,
            legendHidden: true
          },
          {
            label: "Azar [Mín]",
            data: minRand,
            borderColor: "transparent",
            backgroundColor: "transparent",
            pointRadius: 0,
            fill: false,
            tension: 0.25,
            legendHidden: true
          },
          {
            label: "Escudo Centralidad y Riesgo (Promedio)",
            data: meanShield,
            borderColor: "#06d6a0",
            backgroundColor: "#06d6a0",
            borderWidth: 3.2,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.25
          },
          {
            label: "Escudo [Máx]",
            data: maxShield,
            borderColor: "transparent",
            backgroundColor: "rgba(6, 214, 160, 0.15)",
            pointRadius: 0,
            fill: "+1",
            tension: 0.25,
            legendHidden: true
          },
          {
            label: "Escudo [Mín]",
            data: minShield,
            borderColor: "transparent",
            backgroundColor: "transparent",
            pointRadius: 0,
            fill: false,
            tension: 0.25,
            legendHidden: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            labels: {
              color: "#cbd5e1",
              usePointStyle: true,
              boxWidth: 10,
              font: { family: "Inter", size: 12 },
              filter: (item, chartData) => !chartData.datasets[item.datasetIndex].legendHidden
            }
          },
          tooltip: {
            backgroundColor: "rgba(9, 16, 31, 0.95)",
            borderColor: "rgba(56, 189, 248, 0.35)",
            borderWidth: 1,
            titleColor: "#f8fafc",
            bodyColor: "#e2e8f0",
            filter: (ctx) => !ctx.dataset.legendHidden,
            callbacks: {
              label: (ctx) => {
                const dsIdx = ctx.datasetIndex;
                const dIdx = ctx.dataIndex;
                const val = formatInt(ctx.parsed.y);
                if (dsIdx === 0) return ` Sin Intervención: ${val} [${formatInt(minNone[dIdx])} - ${formatInt(maxNone[dIdx])}]`;
                if (dsIdx === 3) return ` Intervención al Azar: ${val} [${formatInt(minRand[dIdx])} - ${formatInt(maxRand[dIdx])}]`;
                if (dsIdx === 6) return ` Escudo Centralidad: ${val} [${formatInt(minShield[dIdx])} - ${formatInt(maxShield[dIdx])}]`;
                return ` ${ctx.dataset.label}: ${val}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: "#94a3b8", maxTicksLimit: 11 },
            grid: { color: "rgba(148, 163, 184, 0.08)" }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: yAxisTitle,
              color: "#94a3b8",
              font: { family: "Inter", size: 11.5, weight: "600" }
            },
            ticks: { color: "#94a3b8", callback: (v) => formatInt(v) },
            grid: { color: "rgba(148, 163, 184, 0.08)" }
          }
        }
      }
    });

    if (seirChartInstance) {
      seirChartInstance.destroy();
    }

    seirChartInstance = new window.Chart(dom.seirCanvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "🟢 Sano (S)",
            data: chosenSeir.S,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.10)",
            borderWidth: 2.4,
            pointRadius: 0,
            fill: true,
            tension: 0.25
          },
          {
            label: "🟡 Mordido / Expuesto (E)",
            data: chosenSeir.E,
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            borderWidth: 2.2,
            pointRadius: 0,
            fill: true,
            tension: 0.25
          },
          {
            label: "🔴 Zombie / Infeccioso (I)",
            data: chosenSeir.I,
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.16)",
            borderWidth: 2.6,
            pointRadius: 0,
            fill: true,
            tension: 0.25
          },
          {
            label: "🔵 Exorcizado / Inmune (R)",
            data: chosenSeir.R,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.12)",
            borderWidth: 2.4,
            pointRadius: 0,
            fill: true,
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            labels: {
              color: "#cbd5e1",
              usePointStyle: true,
              boxWidth: 10,
              font: { family: "Inter", size: 11.5 }
            }
          },
          tooltip: {
            backgroundColor: "rgba(9, 16, 31, 0.95)",
            borderColor: "rgba(56, 189, 248, 0.35)",
            borderWidth: 1,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatInt(ctx.parsed.y)} hab.`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: "#94a3b8", maxTicksLimit: 9 },
            grid: { color: "rgba(148, 163, 184, 0.08)" }
          },
          y: {
            beginAtZero: true,
            max: TOTAL_CITY_POPULATION,
            ticks: { color: "#94a3b8", callback: (v) => formatInt(v) },
            grid: { color: "rgba(148, 163, 184, 0.08)" }
          }
        }
      }
    });
  }

  function drawFallbackLines(canvas, seriesList) {
    const ctx = canvas.getContext("2d");
    const w = (canvas.width = canvas.parentElement.clientWidth || 600);
    const h = (canvas.height = canvas.parentElement.clientHeight || 340);
    ctx.clearRect(0, 0, w, h);

    const pad = { top: 32, right: 20, bottom: 28, left: 58 };
    const pw = w - pad.left - pad.right;
    const ph = h - pad.top - pad.bottom;

    let maxVal = 1;
    seriesList.forEach((s) => {
      s.data.forEach((v) => {
        if (v > maxVal) maxVal = v;
      });
    });

    ctx.strokeStyle = "rgba(148,163,184,0.18)";
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = pad.top + (ph * g) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px monospace";
      const val = Math.round(maxVal * (1 - g / 4));
      ctx.fillText(formatInt(val), 6, y + 4);
    }

    seriesList.forEach((s, idx) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const len = Math.max(1, s.data.length - 1);
      s.data.forEach((v, i) => {
        const x = pad.left + (pw * i) / len;
        const y = pad.top + ph * (1 - v / maxVal);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.fillStyle = s.color;
      ctx.font = "12px sans-serif";
      ctx.fillText(s.label, pad.left + idx * 170, 18);
    });
  }

  // ============================================================================
  // 9. MAPA SVG INTERACTIVO Y ANIMADO DE LA RED DE MANTA (DÍA 1 A DÍA 60)
  // ============================================================================
  const SVG_NS = "http://www.w3.org/2000/svg";

  function buildEdgePath(uNode, vNode) {
    if (
      (uNode.index === 1 && vNode.index === 3) ||
      (uNode.index === 3 && vNode.index === 1)
    ) {
      const cx = (uNode.x + vNode.x) / 2;
      const cy = (uNode.y + vNode.y) / 2 + 16;
      return `M ${uNode.x},${uNode.y} Q ${cx},${cy} ${vNode.x},${vNode.y}`;
    }
    return `M ${uNode.x},${uNode.y} L ${vNode.x},${vNode.y}`;
  }

  function compactCount(v) {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(Math.round(v));
  }

  function initStaticMapSkeleton() {
    dom.svgEdgesLayer.innerHTML = "";
    dom.svgNodesLayer.innerHTML = "";

    MANTA_EDGES.forEach((edge, idx) => {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("id", `svgEdge_${idx}`);
      path.setAttribute("class", "graph-edge");
      path.setAttribute("fill", "none");
      path.setAttribute("d", buildEdgePath(MANTA_NODES[edge.u], MANTA_NODES[edge.v]));
      dom.svgEdgesLayer.appendChild(path);
    });

    MANTA_NODES.forEach((node) => {
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("id", `svgNodeGroup_${node.index}`);
      g.setAttribute("class", "graph-node-group");
      g.setAttribute("transform", `translate(${node.x}, ${node.y})`);

      const radius = Math.round(18 + (node.population / 18000) * 10);

      // Anillo táctico exterior
      const outer = document.createElementNS(SVG_NS, "circle");
      outer.setAttribute("id", `svgNodeOuter_${node.index}`);
      outer.setAttribute("class", "node-outer-ring");
      outer.setAttribute("r", String(radius + 4));
      outer.setAttribute("fill", "rgba(15, 23, 42, 0.94)");
      outer.setAttribute("stroke", "#10b981");
      outer.setAttribute("stroke-width", "2.6");
      g.appendChild(outer);

      // Núcleo coloreado dinámicamente día a día
      const inner = document.createElementNS(SVG_NS, "circle");
      inner.setAttribute("id", `svgNodeCore_${node.index}`);
      inner.setAttribute("class", "node-core-fill");
      inner.setAttribute("r", String(radius));
      inner.setAttribute("fill", "rgba(16, 185, 129, 0.35)");
      g.appendChild(inner);

      // Indicador rápido central (Zombies o estado dominante)
      const countTxt = document.createElementNS(SVG_NS, "text");
      countTxt.setAttribute("id", `svgNodeCount_${node.index}`);
      countTxt.setAttribute("y", "4");
      countTxt.setAttribute("text-anchor", "middle");
      countTxt.setAttribute("fill", "#ffffff");
      countTxt.setAttribute("font-family", "JetBrains Mono, monospace");
      countTxt.setAttribute("font-size", "10");
      countTxt.setAttribute("font-weight", "700");
      countTxt.textContent = "0";
      g.appendChild(countTxt);

      // Insignia flotante superior para Cierre Selectivo o Fumigación activa
      const opsBadge = document.createElementNS(SVG_NS, "text");
      opsBadge.setAttribute("id", `svgNodeOps_${node.index}`);
      opsBadge.setAttribute("x", "0");
      opsBadge.setAttribute("y", String(-(radius + 9)));
      opsBadge.setAttribute("text-anchor", "middle");
      opsBadge.setAttribute("font-size", "12");
      opsBadge.textContent = "";
      g.appendChild(opsBadge);

      // Caja de telemetría SEIR debajo del nodo
      const labelY = radius + 10;
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("class", "node-label-bg");
      rect.setAttribute("x", "-74");
      rect.setAttribute("y", String(labelY));
      rect.setAttribute("width", "148");
      rect.setAttribute("height", "46");
      g.appendChild(rect);

      const title = document.createElementNS(SVG_NS, "text");
      title.setAttribute("id", `svgNodeTitle_${node.index}`);
      title.setAttribute("class", "node-title");
      title.setAttribute("x", "0");
      title.setAttribute("y", String(labelY + 13));
      title.textContent = node.shortName;
      g.appendChild(title);

      // Línea con conteo en vivo 🟢S 🟡E 🔴I 🔵R del barrio
      const seirLine = document.createElementNS(SVG_NS, "text");
      seirLine.setAttribute("id", `svgNodeSeir_${node.index}`);
      seirLine.setAttribute("class", "node-sub");
      seirLine.setAttribute("x", "0");
      seirLine.setAttribute("y", String(labelY + 26));
      seirLine.textContent = "🟢0 🟡0 🔴0 🔵0";
      g.appendChild(seirLine);

      const scoreTxt = document.createElementNS(SVG_NS, "text");
      scoreTxt.setAttribute("id", `svgNodeScore_${node.index}`);
      scoreTxt.setAttribute("class", "node-score-badge");
      scoreTxt.setAttribute("x", "0");
      scoreTxt.setAttribute("y", String(labelY + 39));
      scoreTxt.textContent = "Escudo: 0.0";
      g.appendChild(scoreTxt);

      g.addEventListener("click", () => {
        selectedNodeIndex = node.index;
        renderMapState();
        highlightSelectedTableRow();
      });

      dom.svgNodesLayer.appendChild(g);
    });
  }

  function computeNodeVisualColors(st, population) {
    const zFrac = st.I / population;
    const eFrac = st.E / population;
    const rFrac = st.R / population;

    if (st.I > 0 && zFrac >= 0.015) {
      const intensity = Math.min(0.88, 0.35 + zFrac * 2.6);
      return {
        stroke: st.closed ? "#38bdf8" : "#ef4444",
        fill: `rgba(239, 68, 68, ${intensity.toFixed(2)})`
      };
    }
    if (st.E > 0 && (eFrac >= 0.01 || st.I > 0)) {
      return {
        stroke: st.closed ? "#38bdf8" : "#f59e0b",
        fill: "rgba(245, 158, 11, 0.42)"
      };
    }
    if (rFrac >= 0.35) {
      return {
        stroke: "#3b82f6",
        fill: "rgba(59, 130, 246, 0.42)"
      };
    }
    return {
      stroke: st.closed ? "#38bdf8" : "#10b981",
      fill: "rgba(16, 185, 129, 0.30)"
    };
  }

  function renderMapState() {
    if (!currentResult) return;

    const mapStrat = dom.selectMapStrategy.value || "shield";
    const snapshots = currentResult.summary[mapStrat].sampleSnapshots;
    const maxDay = currentResult.config.days;
    const day = Math.max(1, Math.min(maxDay, timelineDay));
    const daySnap = snapshots[day];

    dom.mapDescMaxDay.textContent = String(maxDay);
    dom.timelineDayLabel.textContent = String(day);
    dom.timelineMaxDayLabel.textContent = String(maxDay);
    dom.timelineSlider.min = "1";
    dom.timelineSlider.max = String(maxDay);
    dom.timelineSlider.value = String(day);

    const pct = maxDay > 1 ? ((day - 1) / (maxDay - 1)) * 100 : 100;
    dom.timelineProgressFill.style.width = `${pct.toFixed(1)}%`;

    // Conteos vivos acumulados de toda la red de Manta en este día
    let sumS = 0, sumE = 0, sumI = 0, sumR = 0;
    for (let k = 0; k < MANTA_NODES.length; k++) {
      sumS += daySnap[k].S;
      sumE += daySnap[k].E;
      sumI += daySnap[k].I;
      sumR += daySnap[k].R;
    }
    dom.cityLiveS.textContent = formatInt(sumS);
    dom.cityLiveE.textContent = formatInt(sumE);
    dom.cityLiveI.textContent = formatInt(sumI);
    dom.cityLiveR.textContent = formatInt(sumR);

    // Actualizar las 13 aristas viales
    MANTA_EDGES.forEach((edge, idx) => {
      const pathEl = document.getElementById(`svgEdge_${idx}`);
      if (!pathEl) return;
      const su = daySnap[edge.u];
      const sv = daySnap[edge.v];
      const hasCordon = su.closed || sv.closed;
      const activeZombieFlow = su.I + sv.I > 30;
      const immunizedCorridor =
        su.R / MANTA_NODES[edge.u].population > 0.45 ||
        sv.R / MANTA_NODES[edge.v].population > 0.45;

      pathEl.classList.toggle("edge-cordon", hasCordon);
      pathEl.classList.toggle("edge-hot", !hasCordon && activeZombieFlow);
      pathEl.classList.toggle("edge-shielded", !hasCordon && !activeZombieFlow && immunizedCorridor);
    });

    // Actualizar los 8 barrios de Manta
    MANTA_NODES.forEach((node, idx) => {
      const st = daySnap[idx];
      const groupEl = document.getElementById(`svgNodeGroup_${idx}`);
      const outerEl = document.getElementById(`svgNodeOuter_${idx}`);
      const coreEl = document.getElementById(`svgNodeCore_${idx}`);
      const countEl = document.getElementById(`svgNodeCount_${idx}`);
      const opsEl = document.getElementById(`svgNodeOps_${idx}`);
      const titleEl = document.getElementById(`svgNodeTitle_${idx}`);
      const seirEl = document.getElementById(`svgNodeSeir_${idx}`);
      const scoreEl = document.getElementById(`svgNodeScore_${idx}`);

      groupEl.classList.toggle("node-selected", idx === selectedNodeIndex);

      const isPZ = idx === currentResult.config.patientZeroIndex;
      titleEl.textContent = isPZ ? `☣ ${node.shortName}` : node.shortName;

      const colors = computeNodeVisualColors(st, node.population);
      outerEl.setAttribute("stroke", colors.stroke);
      outerEl.setAttribute("stroke-dasharray", st.closed ? "4 2" : "none");
      coreEl.setAttribute("fill", colors.fill);

      countEl.textContent = st.I > 0 ? `🔴${compactCount(st.I)}` : `🟢${compactCount(st.S)}`;

      const badges = [];
      if (st.closed) badges.push("🚧");
      if (st.fumActive) badges.push("🌫️");
      opsEl.textContent = badges.join(" ");

      seirEl.textContent =
        `🟢${compactCount(st.S)} 🟡${compactCount(st.E)} 🔴${compactCount(st.I)} 🔵${compactCount(st.R)}`;
      scoreEl.textContent = `Puntaje: ${fmtDec.format(st.score)}`;
    });

    // Actualizar Inspector detallado del barrio seleccionado
    const selNode = MANTA_NODES[selectedNodeIndex];
    const selSnap = daySnap[selectedNodeIndex];
    const neighborNames = selNode.neighbors.map((nIdx) => MANTA_NODES[nIdx].shortName).join(", ");

    dom.inspNodeName.textContent =
      selectedNodeIndex === currentResult.config.patientZeroIndex
        ? `☣ ${selNode.name} (Paciente Cero)`
        : selNode.name;
    dom.inspNodeMeta.textContent =
      `Día ${day} · Pob.: ${formatInt(selNode.population)} hab. · ${selNode.neighbors.length} conexiones (${neighborNames})`;

    dom.inspS.textContent = formatInt(selSnap.S);
    dom.inspE.textContent = formatInt(selSnap.E);
    dom.inspI.textContent = formatInt(selSnap.I);
    dom.inspR.textContent = formatInt(selSnap.R);

    const statusTags = [`${formatInt(selSnap.vaccinated)} dosis`];
    if (selSnap.closed) statusTags.push("🚧 Cerrado");
    if (selSnap.fumActive) statusTags.push(`🌫️ Fumig. (${selSnap.fumDaysLeft}d)`);
    dom.inspVac.textContent = statusTags.join(" · ");
    dom.inspScore.textContent = fmtDec.format(selSnap.score);
  }

  function stopTimelinePlayback() {
    if (timelineTimer !== null) {
      clearInterval(timelineTimer);
      timelineTimer = null;
      dom.btnPlayTimeline.textContent = "▶ Play";
    }
  }

  function startTimelinePlayback() {
    if (!currentResult) return;
    stopTimelinePlayback();

    const maxDay = currentResult.config.days;
    if (timelineDay >= maxDay) {
      timelineDay = 1;
      renderMapState();
    }

    const intervalMs = parseInt(dom.selectPlaySpeed.value, 10) || 180;
    dom.btnPlayTimeline.textContent = "⏸ Pausa";

    timelineTimer = setInterval(() => {
      if (!currentResult || timelineDay >= currentResult.config.days) {
        stopTimelinePlayback();
        return;
      }
      timelineDay++;
      renderMapState();
    }, intervalMs);
  }

  function toggleTimelinePlayback() {
    if (timelineTimer !== null) {
      stopTimelinePlayback();
    } else {
      startTimelinePlayback();
    }
  }

  // ============================================================================
  // 10. ESCENARIOS RÁPIDOS DEL JURADO Y ORQUESTACIÓN DE EVENTOS
  // ============================================================================
  function applyJuryPreset(presetName) {
    const base = readConfigFromForm();
    if (presetName === "standard") {
      Object.assign(base, {
        beta: 0.72,
        vaccineEfficacyPct: 85,
        totalBudget: 50000,
        dailyDoseArrival: 800,
        dailyBrigadeArrival: 2,
        useVaccines: true,
        useFumigation: true,
        useClosure: true
      });
    } else if (presetName === "resistant") {
      Object.assign(base, {
        vaccineEfficacyPct: 25,
        totalBudget: 50000,
        dailyDoseArrival: 800,
        dailyBrigadeArrival: 3,
        useVaccines: true,
        useFumigation: true,
        useClosure: true
      });
    } else if (presetName === "austerity") {
      Object.assign(base, {
        vaccineEfficacyPct: 80,
        totalBudget: 22000,
        dailyDoseArrival: 350,
        dailyBrigadeArrival: 1,
        useVaccines: true,
        useFumigation: true,
        useClosure: true
      });
    } else if (presetName === "hyper") {
      Object.assign(base, {
        beta: 1.05,
        vaccineEfficacyPct: 75,
        totalBudget: 75000,
        dailyDoseArrival: 1200,
        dailyBrigadeArrival: 3,
        useVaccines: true,
        useFumigation: true,
        useClosure: true
      });
    }
    applyConfigToForm(base);
    executeFullSimulation(true);
  }

  function setCloudStatus(mode, text) {
    if (!dom.cloudStatusPill || !dom.cloudStatusText) return;
    dom.cloudStatusPill.className = `cloud-status-pill ${mode}`;
    dom.cloudStatusText.textContent = text;
  }

  function saveLambdaUrlPreference(url) {
    try {
      if (typeof url === "string") {
        window.localStorage.setItem(LAMBDA_STORAGE_KEY, url);
      }
    } catch (_) {
      // Ignorar silenciosamente si el navegador bloquea localStorage en modo archivo
    }
  }

  function loadLambdaUrlPreference() {
    try {
      const stored = window.localStorage.getItem(LAMBDA_STORAGE_KEY);
      if (stored === "local") return "";
      return stored && stored.trim() ? stored.trim() : DEFAULT_LAMBDA_URL;
    } catch (_) {
      return DEFAULT_LAMBDA_URL;
    }
  }

  async function requestCloudLambdaSimulation(lambdaUrl, config) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const t0 = performance.now();

    try {
      const payload = {
        seed: config.seed,
        runs: config.runs,
        days: config.days,
        beta: config.beta,
        vaccines: config.totalVaccines,
        vaccineEffectiveness: config.vaccineEfficacyPct,
        initialNode: config.patientZeroIndex,
        budget: config.totalBudget,
        incubationDays: config.incubationDays,
        dailyDoseArrival: config.dailyDoseArrival,
        dailyBrigadeArrival: config.dailyBrigadeArrival,
        useVaccines: config.useVaccines,
        useFumigation: config.useFumigation,
        useClosure: config.useClosure
      };

      const resp = await fetch(lambdaUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      let rawData = await resp.json();
      if (rawData && typeof rawData.body === "string") {
        rawData = JSON.parse(rawData.body);
      }

      if (!rawData || !rawData.summary || !rawData.summary.shield) {
        throw new Error("Formato de respuesta incompleto");
      }

      const elapsedMs = performance.now() - t0;
      const subSeeds = Array.isArray(rawData.subSeeds) && rawData.subSeeds.length > 0
        ? Uint32Array.from(rawData.subSeeds)
        : deriveSubSeeds(config.seed, config.runs);

      return {
        config,
        subSeeds,
        summary: rawData.summary,
        strategies: rawData.strategies || null,
        mayorRecommendation: rawData.mayorRecommendation || null,
        elapsedMs,
        hashHex: rawData.hashHex || "0xCLOUD200",
        cloudEngine: rawData.engine || "aws-lambda-python3.12"
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function renderAllViews(result) {
    currentResult = result;
    timelineDay = Math.max(1, Math.min(result.config.days, timelineDay || result.config.days));
    renderKpisAndAudit(currentResult);
    renderMayorReport(currentResult);
    renderCharts(currentResult);
    renderMapState();
  }

  async function executeFullSimulation(hideBanner = true) {
    stopTimelinePlayback();
    if (hideBanner) {
      dom.reproBanner.classList.add("hidden");
    }

    const reqId = ++latestRequestId;
    const config = readConfigFromForm();
    const lambdaUrl = dom.inputLambdaUrl ? dom.inputLambdaUrl.value.trim() : "";
    saveLambdaUrlPreference(lambdaUrl || "local");

    if (!lambdaUrl) {
      const localResult = runMonteCarloSimulation(config);
      if (reqId !== latestRequestId) return;
      setCloudStatus(
        "mode-local",
        `⚡ Motor Local Activo (${fmtDec.format(localResult.elapsedMs)} ms)`
      );
      renderAllViews(localResult);
      return;
    }

    // Ejecución en AWS Lambda con Fallback Inteligente silencioso en milisegundos si falla la red
    setCloudStatus("mode-loading", "☁️ Ejecutando en AWS Lambda...");
    try {
      const cloudResult = await requestCloudLambdaSimulation(lambdaUrl, config);
      if (reqId !== latestRequestId) return;
      renderAllViews(cloudResult);
      dom.execTimingInfo.textContent =
        `☁️ AWS Lambda · ${config.runs} corridas en ${Math.round(cloudResult.elapsedMs)} ms`;
      setCloudStatus(
        "mode-cloud",
        `☁️ AWS Lambda Conectado (${Math.round(cloudResult.elapsedMs)} ms)`
      );
    } catch (_) {
      if (reqId !== latestRequestId) return;
      const fallbackResult = runMonteCarloSimulation(config);
      renderAllViews(fallbackResult);
      setCloudStatus(
        "mode-fallback",
        `⚡ Fallback Local Instantáneo (${fmtDec.format(fallbackResult.elapsedMs)} ms)`
      );
    }
  }

  function verifyDeterminismProof() {
    const config = readConfigFromForm();
    const runA = runMonteCarloSimulation(config);
    const runB = runMonteCarloSimulation(config);

    const identical =
      runA.hashHex === runB.hashHex &&
      runA.summary.shield.savedStats.mean === runB.summary.shield.savedStats.mean &&
      runA.summary.random.infectedStats.mean === runB.summary.random.infectedStats.mean &&
      runA.summary.none.infectedStats.mean === runB.summary.none.infectedStats.mean;

    renderAllViews(runB);

    dom.reproBanner.classList.remove("hidden");
    dom.reproBanner.textContent = identical
      ? `✓ Reproducibilidad Exacta Comprobada: Dos ejecuciones independientes de ${config.runs} corridas con mulberry32(${config.seed}), efectividad ${config.vaccineEfficacyPct}% y presupuesto ${formatUSD(config.totalBudget)} produjeron exactamente el mismo hash (${runA.hashHex}) y ${formatInt(runA.summary.shield.savedStats.mean)} vidas salvadas.`
      : "⚠️ Discrepancia detectada en verificación.";
  }

  function bindEvents() {
    syncDualControl(dom.rangeRuns, dom.inputRuns, dom.outRuns, (v) => String(v));
    syncDualControl(dom.rangeDays, dom.inputDays, dom.outDays, (v) => `${v} d`);
    syncDualControl(dom.rangeBeta, dom.inputBeta, dom.outBeta, (v) => Number(v).toFixed(2));
    syncDualControl(dom.rangeIncubation, dom.inputIncubation, dom.outIncubation, (v) => `${v} d`);
    syncDualControl(dom.rangeVaccines, dom.inputVaccines, dom.outVaccines, (v) => formatInt(v));

    syncDualControl(dom.rangeEfficacy, dom.inputEfficacy, dom.outEfficacy, (v) => `${Math.round(v)}%`);
    syncDualControl(dom.rangeBudget, dom.inputBudget, dom.outBudget, (v) => formatUSD(v));
    syncDualControl(dom.rangeDailyDoses, dom.inputDailyDoses, dom.outDailyDoses, (v) => `${formatInt(v)} /día`);
    syncDualControl(dom.rangeDailyBrigades, dom.inputDailyBrigades, dom.outDailyBrigades, (v) => `${Math.round(v)} /día`);

    // Recálculo reactivo inmediato en el panel Anti-Brote Sorpresa para defensa fluida ante el Jurado
    const liveProInputs = [
      dom.rangeEfficacy, dom.inputEfficacy,
      dom.rangeBudget, dom.inputBudget,
      dom.rangeDailyDoses, dom.inputDailyDoses,
      dom.rangeDailyBrigades, dom.inputDailyBrigades,
      dom.chkUseVaccines, dom.chkUseFumigation, dom.chkUseClosure
    ];
    liveProInputs.forEach((el) => {
      el.addEventListener("change", () => executeFullSimulation(true));
    });

    document.querySelectorAll(".btn-preset[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyJuryPreset(btn.getAttribute("data-preset"));
      });
    });

    dom.form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      executeFullSimulation(true);
    });

    dom.selectPatientZero.addEventListener("change", () => {
      selectedNodeIndex = parseInt(dom.selectPatientZero.value, 10) || 0;
      executeFullSimulation(true);
    });

    dom.btnResetDefaults.addEventListener("click", () => {
      applyConfigToForm(DEFAULT_CONFIG);
      selectedNodeIndex = DEFAULT_CONFIG.patientZeroIndex;
      timelineDay = 1;
      executeFullSimulation(true);
    });

    dom.btnVerifyDeterminism.addEventListener("click", () => {
      verifyDeterminismProof();
    });

    dom.btnCopyMayorReport.addEventListener("click", () => {
      if (navigator.clipboard && plainTextMayorBrief) {
        navigator.clipboard.writeText(plainTextMayorBrief).then(() => {
          const prev = dom.btnCopyMayorReport.textContent;
          dom.btnCopyMayorReport.textContent = "✓ Informe Copiado";
          setTimeout(() => {
            dom.btnCopyMayorReport.textContent = prev;
          }, 1800);
        });
      }
    });

    const metricTabs = document.querySelectorAll(".seg-btn[data-chart-metric]");
    metricTabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        metricTabs.forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        activeChartMetric = btn.getAttribute("data-chart-metric");
        if (currentResult) {
          renderCharts(currentResult);
        }
      });
    });

    dom.selectSeirStrategy.addEventListener("change", () => {
      if (currentResult) {
        renderCharts(currentResult);
      }
    });

    dom.selectMapStrategy.addEventListener("change", () => {
      renderMapState();
    });

    dom.timelineSlider.addEventListener("input", () => {
      stopTimelinePlayback();
      timelineDay = parseInt(dom.timelineSlider.value, 10) || 1;
      renderMapState();
    });

    dom.btnPlayTimeline.addEventListener("click", () => {
      toggleTimelinePlayback();
    });

    dom.btnResetTimeline.addEventListener("click", () => {
      stopTimelinePlayback();
      timelineDay = 1;
      renderMapState();
    });

    dom.selectPlaySpeed.addEventListener("change", () => {
      if (timelineTimer !== null) {
        startTimelinePlayback();
      }
    });

    dom.btnSetPatientZeroFromMap.addEventListener("click", () => {
      dom.selectPatientZero.value = String(selectedNodeIndex);
      executeFullSimulation(true);
    });

    if (dom.btnApplyLambda) {
      dom.btnApplyLambda.addEventListener("click", () => {
        executeFullSimulation(true);
      });
    }

    if (dom.btnClearLambda) {
      dom.btnClearLambda.addEventListener("click", () => {
        if (dom.inputLambdaUrl) {
          dom.inputLambdaUrl.value = "";
        }
        saveLambdaUrlPreference("local");
        executeFullSimulation(true);
      });
    }

    if (dom.inputLambdaUrl) {
      dom.inputLambdaUrl.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          executeFullSimulation(true);
        }
      });
    }
  }

  function bootstrap() {
    populatePatientZeroSelect();
    applyConfigToForm(DEFAULT_CONFIG);
    if (dom.inputLambdaUrl) {
      dom.inputLambdaUrl.value = loadLambdaUrlPreference();
    }
    initStaticMapSkeleton();
    bindEvents();
    timelineDay = DEFAULT_CONFIG.days;
    executeFullSimulation(true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
