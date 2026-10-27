/**
 * OPERACIÓN CONTENCIÓN MANTA · TRACK B: LA PLAGA ZOMBIE
 * Simulador Epidemiológico SEIR Diario Reproducible en Grafo + Monte Carlo
 *
 * Garantías de Ingeniería:
 * 1. Grafo exacto de Manta: 8 barrios reales (100,000 hab.) y 13 aristas simétricas de contacto.
 * 2. Determinismo total con mulberry32(seed): cero llamadas a Math.random().
 * 3. Regla Estricta auditada: Prohibido vacunar a Mordidos (E), Zombies (I) o Exorcizados/Inmunes (R);
 *    únicamente se vacuna a población 🟢 Sana (S).
 * 4. Comparación simultánea Monte Carlo de las 3 estrategias con Promedio y Rango [Mínimo - Máximo].
 */

(function () {
  "use strict";

  // ============================================================================
  // 1. DEFINICIÓN DEL GRAFO REAL DE MANTA (8 NODOS, 100,000 HAB., 13 ARISTAS)
  // ============================================================================
  const MANTA_NODES = [
    {
      id: "mercado",
      index: 0,
      name: "Mercado de Tarqui",
      shortName: "Mercado Tarqui",
      population: 15000,
      neighbors: [2, 6, 1, 5], // Centro, Los Esteros, Terminal, Hospital
      x: 560,
      y: 292
    },
    {
      id: "terminal",
      index: 1,
      name: "Terminal Terrestre",
      shortName: "Terminal Terrestre",
      population: 12000,
      neighbors: [0, 3, 6, 2], // Mercado, ULEAM, Los Esteros, Centro
      x: 642,
      y: 186
    },
    {
      id: "centro",
      index: 2,
      name: "Centro de Manta",
      shortName: "Centro de Manta",
      population: 18000,
      neighbors: [0, 1, 4, 5], // Mercado, Terminal, Playa Murciélago, Hospital
      x: 452,
      y: 152
    },
    {
      id: "uleam",
      index: 3,
      name: "ULEAM",
      shortName: "ULEAM",
      population: 14000,
      neighbors: [1, 4, 7], // Terminal, Playa Murciélago, San Mateo
      x: 268,
      y: 262
    },
    {
      id: "murcielago",
      index: 4,
      name: "Playa El Murciélago",
      shortName: "Playa Murciélago",
      population: 10000,
      neighbors: [2, 3, 7], // Centro, ULEAM, San Mateo
      x: 268,
      y: 122
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
      y: 295
    },
    {
      id: "san_mateo",
      index: 7,
      name: "San Mateo",
      shortName: "San Mateo",
      population: 7000,
      neighbors: [3, 4, 5], // ULEAM, Playa Murciélago, Hospital
      x: 102,
      y: 288
    }
  ];

  const TOTAL_CITY_POPULATION = MANTA_NODES.reduce((acc, n) => acc + n.population, 0); // 100,000

  // Construcción de lista única de aristas no dirigidas (13 aristas)
  const MANTA_EDGES = [];
  for (let i = 0; i < MANTA_NODES.length; i++) {
    for (const j of MANTA_NODES[i].neighbors) {
      if (i < j) {
        MANTA_EDGES.push({ u: i, v: j });
      }
    }
  }

  // Configuración por defecto solicitada
  const DEFAULT_CONFIG = Object.freeze({
    seed: 2026,
    runs: 50,
    days: 60,
    patientZeroIndex: 6, // Los Esteros (foco costero/portuario ideal para apreciar cuellos de botella)
    beta: 0.72,
    incubationDays: 3,
    totalVaccines: 24000
  });

  // Constantes epidemiológicas del modelo SEIR zombie
  const INITIAL_ZOMBIES = 10;       // Pacientes cero iniciales en el barrio foco (Día 0)
  const EXORCISM_RATE_GAMMA = 0.20; // Duración infecciosa media = 5 días antes de captura/exorcismo (I -> R)
  const CORRIDOR_COUPLING = 0.025;  // Factor de transmisión inter-barrial por arista de contacto
  const DEPLOYMENT_WINDOW = 15;     // Ventana logística de brigadas de respuesta rápida (días)
  const TACTICAL_BRIGADE_SIZE = 100;// Lote táctico para equilibrar cuellos de botella en el día

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

  /**
   * Deriva N sub-semillas deterministas de 32 bits a partir de la semilla maestra.
   * La corrida #0 usa directamente masterSeed >>> 0 y las siguientes provienen de mulberry32(masterSeed).
   */
  function deriveSubSeeds(masterSeed, count) {
    const base = masterSeed >>> 0;
    const seeder = mulberry32(base);
    const seeds = new Uint32Array(count);
    for (let r = 0; r < count; r++) {
      seeds[r] = r === 0 ? base : Math.floor(seeder() * 4294967296) >>> 0;
    }
    return seeds;
  }

  /**
   * Muestreador Binomial entero exacto/híbrido alimentado 100% por mulberry32.
   * - Para medias bajas (< 20): saltos geométricos exactos de Devroye O(n*p).
   * - Para medias altas (>= 20): aproximación Normal de Box-Muller con corrección de continuidad.
   */
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

  /**
   * Muestreador Hipergeométrico sin reemplazo alimentado por mulberry32.
   * Garantiza cotas exactas [max(0, draws - (total - success)), min(draws, success)]
   * para repartir vacunas al azar exclusivamente entre individuos 🟢 Sanos.
   */
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
   * Calcula el puntaje diario oficial de "Escudo de Centralidad y Riesgo" para un barrio k:
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
  // 3. MOTOR DE SIMULACIÓN DIARIA SEIR PARA UNA CORRIDA Y ESTRATEGIA
  // ============================================================================
  /**
   * @param {number} runSeed Semilla de 32 bits de la corrida actual
   * @param {"none"|"random"|"shield"} strategy Estrategia de vacunación
   * @param {object} config Parámetros de simulación
   * @param {boolean} recordNodeHistory Si es true, guarda instantáneas diarias por nodo para el mapa
   */
  function simulateSingleTrajectory(runSeed, strategy, config, recordNodeHistory) {
    const numNodes = MANTA_NODES.length;
    const days = config.days;
    const beta = config.beta;
    const sigma = 1 / Math.max(1, config.incubationDays);
    const gamma = EXORCISM_RATE_GAMMA;

    const S = new Int32Array(numNodes);
    const E = new Int32Array(numNodes);
    const I = new Int32Array(numNodes);
    const R = new Int32Array(numNodes);
    const vaccinatedByNode = new Int32Array(numNodes);
    const cumInfectedByNode = new Int32Array(numNodes);

    for (let k = 0; k < numNodes; k++) {
      S[k] = MANTA_NODES[k].population;
    }

    // Paciente Cero en Día 0
    const pz = config.patientZeroIndex;
    const initZ = Math.min(INITIAL_ZOMBIES, S[pz]);
    S[pz] -= initZ;
    I[pz] = initZ;
    cumInfectedByNode[pz] = initZ;

    let cumulativeInfected = initZ;
    let totalVaccinatedHealthy = 0;
    let forbiddenVaccineViolations = 0; // Auditoría estricta: debe ser siempre 0

    let remainingVaccines = strategy === "none" ? 0 : config.totalVaccines;
    const deployWindow = Math.max(1, Math.min(days, DEPLOYMENT_WINDOW));
    const vacRng = mulberry32((runSeed ^ 0x9E3779B9) >>> 0);

    // Series temporales diarias (Día 0 a Día D inclusive)
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
      // ------------------------------------------------------------------------
      // FASE 1: VACUNACIÓN DIARIA (REGLA ESTRICTA: SOLO POBLACIÓN 🟢 SANA)
      // ------------------------------------------------------------------------
      if (remainingVaccines > 0) {
        const remWindow = Math.max(1, deployWindow - d + 1);
        const dailyQuota = d <= deployWindow
          ? Math.ceil(remainingVaccines / remWindow)
          : remainingVaccines;

        let cityHealthyPool = 0;
        for (let k = 0; k < numNodes; k++) {
          cityHealthyPool += S[k];
        }

        // Nunca se aplican más vacunas que la población 🟢 Sana disponible
        const applicableToday = Math.min(dailyQuota, Math.min(remainingVaccines, cityHealthyPool));

        if (applicableToday > 0) {
          if (strategy === "random") {
            // Línea Base 2: Muestreo hipergeométrico multivariado exacto SOLO entre 🟢 Sanos
            let dosesLeft = applicableToday;
            let poolLeft = cityHealthyPool;
            for (let k = 0; k < numNodes && dosesLeft > 0; k++) {
              const healthyInBarrio = S[k];
              if (healthyInBarrio <= 0) continue;

              const allocate = sampleHypergeometric(poolLeft, healthyInBarrio, dosesLeft, vacRng);
              if (allocate > healthyInBarrio) {
                forbiddenVaccineViolations += allocate - healthyInBarrio;
              }

              S[k] -= allocate;
              R[k] += allocate;
              vaccinatedByNode[k] += allocate;
              totalVaccinatedHealthy += allocate;
              remainingVaccines -= allocate;
              dosesLeft -= allocate;
              poolLeft -= healthyInBarrio;
            }
          } else if (strategy === "shield") {
            // Nuestra Estrategia: Escudo de Centralidad y Riesgo
            // puntaje = Conexiones * Zombies_Vecinos * Proporción_Sanos_Locales
            let dosesLeft = applicableToday;
            while (dosesLeft > 0) {
              const step = Math.min(TACTICAL_BRIGADE_SIZE, dosesLeft);
              let bestNode = -1;
              let bestScore = -1;

              for (let k = 0; k < numNodes; k++) {
                if (S[k] <= 0) continue;
                const score = computeShieldScore(k, S, I);
                if (score > bestScore) {
                  bestScore = score;
                  bestNode = k;
                }
              }

              // Desempate preventivo únicamente cuando todos los puntajes son 0 (ej. brote ya contenido)
              if (bestNode === -1 || bestScore <= 0) {
                bestNode = -1;
                bestScore = -1;
                for (let k = 0; k < numNodes; k++) {
                  if (S[k] <= 0) continue;
                  const fallback =
                    MANTA_NODES[k].neighbors.length *
                    (I[k] + 1) *
                    (S[k] / MANTA_NODES[k].population);
                  if (fallback > bestScore) {
                    bestScore = fallback;
                    bestNode = k;
                  }
                }
              }

              if (bestNode === -1 || S[bestNode] <= 0) break;

              const allocate = Math.min(step, S[bestNode]);
              if (allocate > S[bestNode]) {
                forbiddenVaccineViolations += allocate - S[bestNode];
              }
              S[bestNode] -= allocate;
              R[bestNode] += allocate;
              vaccinatedByNode[bestNode] += allocate;
              totalVaccinatedHealthy += allocate;
              remainingVaccines -= allocate;
              dosesLeft -= allocate;
            }
          }
        }
      }

      // ------------------------------------------------------------------------
      // FASE 2: TRANSICIÓN DIARIA SEIR ESTOCÁSTICA (NÚMEROS ALEATORIOS COMUNES)
      // ------------------------------------------------------------------------
      for (let k = 0; k < numNodes; k++) {
        const node = MANTA_NODES[k];
        // Semilla específica por (corrida, día, barrio) vía mulberry32
        const nodeDaySeed = (runSeed ^ Math.imul(d, 73856093) ^ Math.imul(k + 1, 19349663)) >>> 0;
        const rng = mulberry32(nodeDaySeed);

        // Variabilidad estocástica diaria de contacto urbano [0.60, 1.40]
        const contactDispersion = 0.60 + 0.80 * rng();

        // Presión infecciosa local + presión por corredores viales desde barrios vecinos
        const localForce = beta * (I[k] / node.population);
        const hubTrafficFactor = node.neighbors.length / 3.0;
        let neighborForce = 0;
        for (let m = 0; m < node.neighbors.length; m++) {
          const nbIdx = node.neighbors[m];
          neighborForce +=
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
      totalVaccinatedHealthy,
      forbiddenVaccineViolations,
      vaccinatedByNode,
      cumInfectedByNode,
      dailyS,
      dailyE,
      dailyI,
      dailyR,
      dailyCumInf,
      nodeSnapshots
    };
  }

  // ============================================================================
  // 4. SIMULACIÓN MONTE CARLO COMPLETA + HASH DETERMINISTA FNV-1a
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
        vaccinatedSum: 0,
        violationsSum: 0,
        nodeVacSum: new Float64Array(numNodes),
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
        sampleSnapshots: null
      };
    }

    // Hash FNV-1a de 32 bits para auditar reproducibilidad exacta bit a bit
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
      const recordMapHistory = r === 0;

      const resNone = simulateSingleTrajectory(seed, "none", config, recordMapHistory);
      const resRandom = simulateSingleTrajectory(seed, "random", config, recordMapHistory);
      const resShield = simulateSingleTrajectory(seed, "shield", config, recordMapHistory);

      const runResults = {
        none: resNone,
        random: resRandom,
        shield: resShield
      };

      const baseInfected = resNone.cumulativeInfected;

      for (const key of strategyKeys) {
        const res = runResults[key];
        const bucket = agg[key];

        bucket.infectedArr[r] = res.cumulativeInfected;
        bucket.savedArr[r] = baseInfected - res.cumulativeInfected;
        bucket.vaccinatedSum += res.totalVaccinatedHealthy;
        bucket.violationsSum += res.forbiddenVaccineViolations;

        mixHash(res.cumulativeInfected);
        mixHash(res.totalVaccinatedHealthy);

        for (let k = 0; k < numNodes; k++) {
          bucket.nodeVacSum[k] += res.vaccinatedByNode[k];
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

        if (recordMapHistory) {
          bucket.sampleSnapshots = res.nodeSnapshots;
        }
      }
    }

    // Normalizar promedios diarios y por nodo
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
        meanVaccinated: bucket.vaccinatedSum / runs,
        violations: bucket.violationsSum,
        nodeMeanVac: Array.from(bucket.nodeVacSum, (v) => v / runs),
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
        sampleSnapshots: bucket.sampleSnapshots
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
  // 5. ESTADO DE UI, FORMATEADORES Y GRÁFICAS (CHART.JS + FALLBACK CANVAS)
  // ============================================================================
  const fmtInt = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 });
  const fmtDec = new Intl.NumberFormat("es-EC", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function formatInt(n) {
    return fmtInt.format(Math.round(n));
  }

  let currentResult = null;
  let activeChartMetric = "cumInfected"; // "cumInfected" | "activeZombies" | "protectedPop"
  let selectedNodeIndex = DEFAULT_CONFIG.patientZeroIndex;
  let timelineDay = 0;
  let timelineTimer = null;

  let comparisonChartInstance = null;
  let seirChartInstance = null;

  // Referencias al DOM
  const dom = {
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

    // Gráficas
    comparisonCanvas: document.getElementById("comparisonChart"),
    seirCanvas: document.getElementById("seirBreakdownChart"),
    selectSeirStrategy: document.getElementById("selectSeirStrategy"),

    // Mapa SVG y Línea de Tiempo
    selectMapStrategy: document.getElementById("selectMapStrategy"),
    btnPlayTimeline: document.getElementById("btnPlayTimeline"),
    timelineDayLabel: document.getElementById("timelineDayLabel"),
    timelineMaxDayLabel: document.getElementById("timelineMaxDayLabel"),
    timelineSlider: document.getElementById("timelineSlider"),
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

    // Tabla y Auditoría
    tableFinalDay: document.getElementById("tableFinalDay"),
    barrioTableBody: document.getElementById("barrioTableBody"),
    barrioTableFoot: document.getElementById("barrioTableFoot"),
    auditSummaryText: document.getElementById("auditSummaryText")
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
        : DEFAULT_CONFIG.totalVaccines
    };

    // Reflejar valores saneados en los inputs
    dom.inputSeed.value = String(config.seed);
    dom.inputRuns.value = String(config.runs);
    dom.rangeRuns.value = String(Math.min(250, config.runs));
    dom.outRuns.textContent = String(config.runs);

    dom.inputDays.value = String(config.days);
    dom.rangeDays.value = String(Math.min(150, config.days));
    dom.outDays.textContent = `${config.days} d`;

    dom.selectPatientZero.value = String(config.patientZeroIndex);

    dom.inputBeta.value = config.beta.toFixed(2);
    dom.rangeBeta.value = String(Math.min(1.5, config.beta));
    dom.outBeta.textContent = config.beta.toFixed(2);

    dom.inputIncubation.value = String(config.incubationDays);
    dom.rangeIncubation.value = String(Math.min(14, config.incubationDays));
    dom.outIncubation.textContent = `${config.incubationDays} d`;

    dom.inputVaccines.value = String(config.totalVaccines);
    dom.rangeVaccines.value = String(config.totalVaccines);
    dom.outVaccines.textContent = formatInt(config.totalVaccines);

    return config;
  }

  function applyConfigToForm(cfg) {
    dom.inputSeed.value = String(cfg.seed);
    dom.inputRuns.value = String(cfg.runs);
    dom.rangeRuns.value = String(cfg.runs);
    dom.outRuns.textContent = String(cfg.runs);

    dom.inputDays.value = String(cfg.days);
    dom.rangeDays.value = String(cfg.days);
    dom.outDays.textContent = `${cfg.days} d`;

    dom.selectPatientZero.value = String(cfg.patientZeroIndex);

    dom.inputBeta.value = cfg.beta.toFixed(2);
    dom.rangeBeta.value = String(cfg.beta);
    dom.outBeta.textContent = cfg.beta.toFixed(2);

    dom.inputIncubation.value = String(cfg.incubationDays);
    dom.rangeIncubation.value = String(cfg.incubationDays);
    dom.outIncubation.textContent = `${cfg.incubationDays} d`;

    dom.inputVaccines.value = String(cfg.totalVaccines);
    dom.rangeVaccines.value = String(cfg.totalVaccines);
    dom.outVaccines.textContent = formatInt(cfg.totalVaccines);
  }

  // ============================================================================
  // 6. ACTUALIZACIÓN DE TARJETAS KPI Y TABLA POR BARRIO
  // ============================================================================
  function renderKpisAndAudit(result) {
    const { config, summary, elapsedMs, hashHex } = result;
    const sNone = summary.none;
    const sRand = summary.random;
    const sShield = summary.shield;

    dom.activeSeedBadge.textContent = `mulberry32(${config.seed})`;
    dom.determinismHash.textContent = hashHex;

    const totalViolations =
      sNone.violations + sRand.violations + sShield.violations;
    dom.strictAuditBadge.textContent =
      totalViolations === 0
        ? "100% Solo 🟢 Sanos (0 violaciones)"
        : `Alerta: ${totalViolations}`;

    dom.execTimingInfo.textContent = `${config.runs} corridas × 3 estrategias en ${fmtDec.format(elapsedMs)} ms`;

    // Tarjeta 1: Sin Intervención
    dom.kpiBase1SavedMean.textContent = "0";
    dom.kpiBase1SavedRange.textContent = "[0 - 0]";
    dom.kpiBase1InfMean.textContent = formatInt(sNone.infectedStats.mean);
    dom.kpiBase1InfRange.textContent = `[${formatInt(sNone.infectedStats.min)} - ${formatInt(sNone.infectedStats.max)}]`;
    const uninfBase = TOTAL_CITY_POPULATION - sNone.infectedStats.mean;
    dom.kpiBase1Footer.textContent = `Población libre de contagio: ${formatInt(uninfBase)} hab.`;

    // Tarjeta 2: Intervención al Azar
    dom.kpiRandomVacPill.textContent = `${formatInt(sRand.meanVaccinated)} dosis a 🟢 S`;
    dom.kpiRandomSavedMean.textContent = formatInt(sRand.savedStats.mean);
    dom.kpiRandomSavedRange.textContent = `[${formatInt(sRand.savedStats.min)} - ${formatInt(sRand.savedStats.max)}]`;
    dom.kpiRandomInfMean.textContent = formatInt(sRand.infectedStats.mean);
    dom.kpiRandomInfRange.textContent = `[${formatInt(sRand.infectedStats.min)} - ${formatInt(sRand.infectedStats.max)}]`;
    dom.kpiRandomFooter.textContent = `Vacunados 🟢 Sanos: ${formatInt(sRand.meanVaccinated)} · 0 a E/I/R`;

    // Tarjeta 3: Escudo de Centralidad y Riesgo
    const extraLivesVsRandom = sShield.savedStats.mean - sRand.savedStats.mean;
    const sign = extraLivesVsRandom >= 0 ? "+" : "";
    dom.kpiShieldDeltaBadge.textContent = `${sign}${formatInt(extraLivesVsRandom)} salvados vs. Azar`;

    dom.kpiShieldSavedMean.textContent = formatInt(sShield.savedStats.mean);
    dom.kpiShieldSavedRange.textContent = `[${formatInt(sShield.savedStats.min)} - ${formatInt(sShield.savedStats.max)}]`;
    dom.kpiShieldInfMean.textContent = formatInt(sShield.infectedStats.mean);
    dom.kpiShieldInfRange.textContent = `[${formatInt(sShield.infectedStats.min)} - ${formatInt(sShield.infectedStats.max)}]`;

    const reductionPct =
      sNone.infectedStats.mean > 0
        ? (sShield.savedStats.mean / sNone.infectedStats.mean) * 100
        : 0;
    dom.kpiShieldFooter.textContent = `Vacunados 🟢 Sanos: ${formatInt(sShield.meanVaccinated)} · Reducción: ${fmtDec.format(reductionPct)}%`;

    // Tabla por Barrio
    dom.tableFinalDay.textContent = String(config.days);
    dom.barrioTableBody.innerHTML = "";

    let totVac = 0;
    let totInfNone = 0;
    let totInfRand = 0;
    let totInfShield = 0;

    MANTA_NODES.forEach((node, idx) => {
      const vac = sShield.nodeMeanVac[idx];
      const infNone = sNone.nodeMeanInf[idx];
      const infRand = sRand.nodeMeanInf[idx];
      const infShield = sShield.nodeMeanInf[idx];
      const savedLocal = infNone - infShield;

      totVac += vac;
      totInfNone += infNone;
      totInfRand += infRand;
      totInfShield += infShield;

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
        <td class="num">26 (13 aristas)</td>
        <td class="num" style="color:#67e8f9;">${formatInt(totVac)}</td>
        <td class="num" style="color:#fca5a5;">${formatInt(totInfNone)}</td>
        <td class="num" style="color:#fcd34d;">${formatInt(totInfRand)}</td>
        <td class="num" style="color:#6ee7b7;">${formatInt(totInfShield)}</td>
        <td class="num" style="color:#34d399;">+${formatInt(totSavedShield)}</td>
      </tr>
    `;

    const firstSeedsPreview = Array.from(result.subSeeds.slice(0, Math.min(4, result.subSeeds.length)))
      .map((s) => s.toString())
      .join(", ");
    const unappliedDoses = Math.max(0, config.totalVaccines - Math.round(sShield.meanVaccinated));
    const withheldNote =
      unappliedDoses > 0
        ? ` Se retuvieron ${formatInt(unappliedDoses)} dosis por agotamiento de población 🟢 Sana elegible.`
        : "";

    dom.auditSummaryText.textContent =
      `Semilla maestra ${config.seed} → sub-semillas [${firstSeedsPreview}${result.subSeeds.length > 4 ? ", ..." : ""}] ` +
      `(${config.runs} corridas). Dosis aplicadas a 🟡 Mordidos, 🔴 Zombies o 🔵 Exorcizados: 0 (cumplimiento 100%). ` +
      `Firma determinista: ${hashHex}.${withheldNote}`;
  }

  function highlightSelectedTableRow() {
    const rows = dom.barrioTableBody.querySelectorAll("tr");
    rows.forEach((row, idx) => {
      row.classList.toggle("row-selected", idx === selectedNodeIndex);
    });
  }

  // ============================================================================
  // 7. GRÁFICAS DIARIAS CON CHART.JS (Y FALLBACK NATIVO 2D SI SIN RED)
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

    // Gráfica 1: Comparación de las 3 Estrategias + Bandas [Mín - Máx]
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
            borderWidth: 2.6,
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
            borderWidth: 2.6,
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
        interaction: {
          mode: "index",
          intersect: false
        },
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
                if (dsIdx === 0) {
                  return ` Sin Intervención: ${val} [${formatInt(minNone[dIdx])} - ${formatInt(maxNone[dIdx])}]`;
                }
                if (dsIdx === 3) {
                  return ` Intervención al Azar: ${val} [${formatInt(minRand[dIdx])} - ${formatInt(maxRand[dIdx])}]`;
                }
                if (dsIdx === 6) {
                  return ` Escudo Centralidad: ${val} [${formatInt(minShield[dIdx])} - ${formatInt(maxShield[dIdx])}]`;
                }
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
            ticks: {
              color: "#94a3b8",
              callback: (v) => formatInt(v)
            },
            grid: { color: "rgba(148, 163, 184, 0.08)" }
          }
        }
      }
    });

    // Gráfica 2: Desglose SEIR Diario (S, E, I, R)
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
        interaction: {
          mode: "index",
          intersect: false
        },
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
            ticks: {
              color: "#94a3b8",
              callback: (v) => formatInt(v)
            },
            grid: { color: "rgba(148, 163, 184, 0.08)" }
          }
        }
      }
    });
  }

  // Fallback ligero en Canvas 2D por si el navegador corre sin acceso al CDN
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
  // 8. MAPA SVG INTERACTIVO DEL GRAFO DE MANTA + REPRODUCTOR TEMPORAL
  // ============================================================================
  const SVG_NS = "http://www.w3.org/2000/svg";

  function buildEdgePath(uNode, vNode) {
    // Curva suave para el corredor largo Terminal (1) <-> ULEAM (3) para evitar cruces visuales
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

      // Halo exterior de estado/selección
      const outer = document.createElementNS(SVG_NS, "circle");
      outer.setAttribute("id", `svgNodeOuter_${node.index}`);
      outer.setAttribute("class", "node-outer-ring");
      outer.setAttribute("r", String(radius + 4));
      outer.setAttribute("fill", "rgba(15, 23, 42, 0.92)");
      outer.setAttribute("stroke", "#10b981");
      outer.setAttribute("stroke-width", "2.4");
      g.appendChild(outer);

      // Círculo interior proporcional a zombies / inmunidad
      const inner = document.createElementNS(SVG_NS, "circle");
      inner.setAttribute("id", `svgNodeCore_${node.index}`);
      inner.setAttribute("r", String(radius));
      inner.setAttribute("fill", "rgba(16, 185, 129, 0.25)");
      g.appendChild(inner);

      // Contador central rápido (Zombies activos)
      const countTxt = document.createElementNS(SVG_NS, "text");
      countTxt.setAttribute("id", `svgNodeCount_${node.index}`);
      countTxt.setAttribute("y", "4");
      countTxt.setAttribute("text-anchor", "middle");
      countTxt.setAttribute("fill", "#ffffff");
      countTxt.setAttribute("font-family", "JetBrains Mono, monospace");
      countTxt.setAttribute("font-size", "10.5");
      countTxt.setAttribute("font-weight", "700");
      countTxt.textContent = "0";
      g.appendChild(countTxt);

      // Etiqueta de nombre y población debajo del nodo
      const labelY = radius + 12;
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("class", "node-label-bg");
      rect.setAttribute("x", "-64");
      rect.setAttribute("y", String(labelY));
      rect.setAttribute("width", "128");
      rect.setAttribute("height", "42");
      g.appendChild(rect);

      const title = document.createElementNS(SVG_NS, "text");
      title.setAttribute("id", `svgNodeTitle_${node.index}`);
      title.setAttribute("class", "node-title");
      title.setAttribute("x", "0");
      title.setAttribute("y", String(labelY + 14));
      title.textContent = node.shortName;
      g.appendChild(title);

      const sub = document.createElementNS(SVG_NS, "text");
      sub.setAttribute("class", "node-sub");
      sub.setAttribute("x", "0");
      sub.setAttribute("y", String(labelY + 26));
      sub.textContent = `${formatInt(node.population)} hab · ${node.neighbors.length} conex.`;
      g.appendChild(sub);

      const scoreTxt = document.createElementNS(SVG_NS, "text");
      scoreTxt.setAttribute("id", `svgNodeScore_${node.index}`);
      scoreTxt.setAttribute("class", "node-score-badge");
      scoreTxt.setAttribute("x", "0");
      scoreTxt.setAttribute("y", String(labelY + 38));
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

  function renderMapState() {
    if (!currentResult) return;

    const mapStrat = dom.selectMapStrategy.value || "shield";
    const snapshots = currentResult.summary[mapStrat].sampleSnapshots;
    const maxDay = currentResult.config.days;
    const day = Math.max(0, Math.min(maxDay, timelineDay));
    const daySnap = snapshots[day];

    dom.timelineDayLabel.textContent = String(day);
    dom.timelineMaxDayLabel.textContent = String(maxDay);
    dom.timelineSlider.max = String(maxDay);
    dom.timelineSlider.value = String(day);

    // Actualizar aristas según actividad zombie o bloqueo inmune
    MANTA_EDGES.forEach((edge, idx) => {
      const pathEl = document.getElementById(`svgEdge_${idx}`);
      if (!pathEl) return;
      const su = daySnap[edge.u];
      const sv = daySnap[edge.v];
      const activePressure = su.I + sv.I > 35;
      const heavilyShielded =
        su.vaccinated / MANTA_NODES[edge.u].population > 0.45 ||
        sv.vaccinated / MANTA_NODES[edge.v].population > 0.45;

      pathEl.classList.toggle("edge-hot", activePressure && !heavilyShielded);
      pathEl.classList.toggle("edge-shielded", heavilyShielded);
    });

    // Actualizar los 8 nodos
    MANTA_NODES.forEach((node, idx) => {
      const st = daySnap[idx];
      const groupEl = document.getElementById(`svgNodeGroup_${idx}`);
      const outerEl = document.getElementById(`svgNodeOuter_${idx}`);
      const coreEl = document.getElementById(`svgNodeCore_${idx}`);
      const countEl = document.getElementById(`svgNodeCount_${idx}`);
      const titleEl = document.getElementById(`svgNodeTitle_${idx}`);
      const scoreEl = document.getElementById(`svgNodeScore_${idx}`);

      groupEl.classList.toggle("node-selected", idx === selectedNodeIndex);

      const isPZ = idx === currentResult.config.patientZeroIndex;
      titleEl.textContent = isPZ ? `☣ ${node.shortName}` : node.shortName;

      const zombieFrac = st.I / node.population;
      const vacFrac = st.vaccinated / node.population;

      let strokeColor = "#10b981"; // 🟢 Sano predominante
      let fillColor = "rgba(16, 185, 129, 0.25)";

      if (st.I > 0) {
        const alpha = Math.min(0.82, 0.25 + zombieFrac * 3.2);
        strokeColor = "#ef4444";
        fillColor = `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
      } else if (st.E > 0) {
        strokeColor = "#f59e0b";
        fillColor = "rgba(245, 158, 11, 0.35)";
      } else if (vacFrac > 0.3) {
        strokeColor = "#3b82f6";
        fillColor = "rgba(59, 130, 246, 0.36)";
      }

      outerEl.setAttribute("stroke", strokeColor);
      coreEl.setAttribute("fill", fillColor);
      countEl.textContent = st.I > 0 ? `🔴${formatInt(st.I)}` : `🟢${Math.round((st.S / node.population) * 100)}%`;
      scoreEl.textContent = `Puntaje: ${fmtDec.format(st.score)}`;
    });

    // Actualizar panel inspector del barrio seleccionado
    const selNode = MANTA_NODES[selectedNodeIndex];
    const selSnap = daySnap[selectedNodeIndex];
    const neighborNames = selNode.neighbors.map((nIdx) => MANTA_NODES[nIdx].shortName).join(", ");

    dom.inspNodeName.textContent =
      selectedNodeIndex === currentResult.config.patientZeroIndex
        ? `☣ ${selNode.name} (Paciente Cero)`
        : selNode.name;
    dom.inspNodeMeta.textContent =
      `Población: ${formatInt(selNode.population)} hab. · ${selNode.neighbors.length} conexiones (${neighborNames})`;

    dom.inspS.textContent = formatInt(selSnap.S);
    dom.inspE.textContent = formatInt(selSnap.E);
    dom.inspI.textContent = formatInt(selSnap.I);
    dom.inspR.textContent = formatInt(selSnap.R);
    dom.inspVac.textContent = formatInt(selSnap.vaccinated);
    dom.inspScore.textContent = fmtDec.format(selSnap.score);
  }

  function stopTimelinePlayback() {
    if (timelineTimer !== null) {
      clearInterval(timelineTimer);
      timelineTimer = null;
      dom.btnPlayTimeline.textContent = "▶ Reproducir";
    }
  }

  function toggleTimelinePlayback() {
    if (!currentResult) return;
    if (timelineTimer !== null) {
      stopTimelinePlayback();
      return;
    }

    const maxDay = currentResult.config.days;
    if (timelineDay >= maxDay) {
      timelineDay = 0;
    }
    dom.btnPlayTimeline.textContent = "⏸ Pausar";

    timelineTimer = setInterval(() => {
      if (!currentResult || timelineDay >= currentResult.config.days) {
        stopTimelinePlayback();
        return;
      }
      timelineDay++;
      renderMapState();
    }, 140);
  }

  // ============================================================================
  // 9. ORQUESTACIÓN PRINCIPAL Y EVENTOS
  // ============================================================================
  function executeFullSimulation(hideBanner = true) {
    stopTimelinePlayback();
    if (hideBanner) {
      dom.reproBanner.classList.add("hidden");
    }

    const config = readConfigFromForm();
    currentResult = runMonteCarloSimulation(config);

    // Mostrar el cierre de campaña en el mapa al simular para ver el impacto de inmediato,
    // manteniendo el deslizador listo para recorrer desde Día 0
    timelineDay = config.days;

    renderKpisAndAudit(currentResult);
    renderCharts(currentResult);
    renderMapState();
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

    currentResult = runB;
    renderKpisAndAudit(currentResult);
    renderCharts(currentResult);
    renderMapState();

    dom.reproBanner.classList.remove("hidden");
    dom.reproBanner.textContent = identical
      ? `✓ Reproducibilidad Determinista Verificada: Dos ejecuciones independientes de ${config.runs} corridas con mulberry32(${config.seed}) produjeron exactamente el mismo hash (${runA.hashHex}), promedio de salvados (${formatInt(runA.summary.shield.savedStats.mean)}) y curvas diarias idénticas.`
      : "⚠️ Discrepancia detectada en verificación.";
  }

  function bindEvents() {
    syncDualControl(dom.rangeRuns, dom.inputRuns, dom.outRuns, (v) => String(v));
    syncDualControl(dom.rangeDays, dom.inputDays, dom.outDays, (v) => `${v} d`);
    syncDualControl(dom.rangeBeta, dom.inputBeta, dom.outBeta, (v) => Number(v).toFixed(2));
    syncDualControl(dom.rangeIncubation, dom.inputIncubation, dom.outIncubation, (v) => `${v} d`);
    syncDualControl(dom.rangeVaccines, dom.inputVaccines, dom.outVaccines, (v) => formatInt(v));

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
      executeFullSimulation(true);
    });

    dom.btnVerifyDeterminism.addEventListener("click", () => {
      verifyDeterminismProof();
    });

    // Selector de pestaña de métrica en la gráfica comparativa principal
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
      timelineDay = parseInt(dom.timelineSlider.value, 10) || 0;
      renderMapState();
    });

    dom.btnPlayTimeline.addEventListener("click", () => {
      toggleTimelinePlayback();
    });

    dom.btnSetPatientZeroFromMap.addEventListener("click", () => {
      dom.selectPatientZero.value = String(selectedNodeIndex);
      executeFullSimulation(true);
    });
  }

  function bootstrap() {
    populatePatientZeroSelect();
    applyConfigToForm(DEFAULT_CONFIG);
    initStaticMapSkeleton();
    bindEvents();
    executeFullSimulation(true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
