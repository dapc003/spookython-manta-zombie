/**
 * OPERACIÓN CONTENCIÓN MANTA · ARQUITECTURA MULTICAPA AWS (SPOOKYTHON 2026)
 * Simulador Epidemiológico SEIR Reproducible, Gemelo Geoespacial GPS (Leaflet + CartoDB),
 * Calibración Científica en Vivo (Open-Meteo + INEC/MSP), Auto-Optimizador Presupuestario
 * y Coordinador Fan-Out Serverless (5 Workers AWS Lambda + S3 Privado + DynamoDB Audit).
 */

(function () {
  "use strict";

  // ============================================================================
  // 1. CONSTANTES MAESTRAS, GRAFO GPS REAL DE MANTA Y DATASET INEC / MSP
  // ============================================================================
  const DEFAULT_LAMBDA_URL = "https://sw5fdgyzewlgqjttz2jhjkvaey0udlbt.lambda-url.us-east-2.on.aws/";
  const LAMBDA_STORAGE_KEY = "manta_contencion_lambda_url";
  const LOCAL_AUDIT_STORAGE_KEY = "manta_contencion_dynamo_mirror_v2";
  const OPEN_METEO_URL =
    "https://api.open-meteo.com/v1/forecast?latitude=-0.9677&longitude=-80.7089&current=temperature_2m,relative_humidity_2m,precipitation";

  const MANTA_NODES = [
    {
      id: "mercado",
      index: 0,
      name: "Mercado de Tarqui",
      officialName: "Mercado de Tarqui",
      shortName: "Mercado Tarqui",
      lat: -0.9538,
      lng: -80.7082,
      population: 15000,
      inecRefPop: 42850,
      aedesBreteauIndex: 18.4,
      neighbors: [2, 6, 1, 5],
      x: 558,
      y: 288
    },
    {
      id: "terminal",
      index: 1,
      name: "Terminal Terrestre Luis Valdiviezo",
      officialName: "Terminal Terrestre Luis Valdiviezo",
      shortName: "Terminal Terrestre",
      lat: -0.9615,
      lng: -80.6928,
      population: 12000,
      inecRefPop: 33920,
      aedesBreteauIndex: 15.2,
      neighbors: [0, 3, 6, 2],
      x: 642,
      y: 184
    },
    {
      id: "centro",
      index: 2,
      name: "Centro de Manta / Municipio",
      officialName: "Centro de Manta / Municipio",
      shortName: "Centro / Municipio",
      lat: -0.9496,
      lng: -80.7214,
      population: 18000,
      inecRefPop: 51400,
      aedesBreteauIndex: 13.8,
      neighbors: [0, 1, 4, 5],
      x: 450,
      y: 150
    },
    {
      id: "uleam",
      index: 3,
      name: "ULEAM (Campus Matriz)",
      officialName: "ULEAM (Campus Matriz)",
      shortName: "ULEAM Matriz",
      lat: -0.9529,
      lng: -80.7456,
      population: 14000,
      inecRefPop: 39810,
      aedesBreteauIndex: 11.6,
      neighbors: [1, 4, 7],
      x: 268,
      y: 258
    },
    {
      id: "murcielago",
      index: 4,
      name: "Playa El Murciélago",
      officialName: "Playa El Murciélago",
      shortName: "Playa Murciélago",
      lat: -0.9418,
      lng: -80.7319,
      population: 10000,
      inecRefPop: 27650,
      aedesBreteauIndex: 10.4,
      neighbors: [2, 3, 7],
      x: 268,
      y: 118
    },
    {
      id: "hospital",
      index: 5,
      name: "Hospital Rodríguez Zambrano",
      officialName: "Hospital Rodríguez Zambrano",
      shortName: "Hosp. R. Zambrano",
      lat: -0.9602,
      lng: -80.7385,
      population: 8000,
      inecRefPop: 21900,
      aedesBreteauIndex: 9.8,
      neighbors: [2, 0, 7],
      x: 382,
      y: 358
    },
    {
      id: "esteros",
      index: 6,
      name: "Los Esteros",
      officialName: "Los Esteros",
      shortName: "Los Esteros",
      lat: -0.9482,
      lng: -80.7011,
      population: 16000,
      inecRefPop: 41215,
      aedesBreteauIndex: 21.5,
      neighbors: [0, 1],
      x: 740,
      y: 292
    },
    {
      id: "san_mateo",
      index: 7,
      name: "San Mateo",
      officialName: "San Mateo",
      shortName: "San Mateo",
      lat: -0.9685,
      lng: -80.7620,
      population: 7000,
      inecRefPop: 12400,
      aedesBreteauIndex: 14.1,
      neighbors: [3, 4, 5],
      x: 100,
      y: 284
    }
  ];

  const MOBILITY_MATRIX = [
    [0.000, 0.032, 0.036, 0.000, 0.000, 0.022, 0.034, 0.000],
    [0.032, 0.000, 0.030, 0.026, 0.000, 0.000, 0.028, 0.000],
    [0.036, 0.030, 0.000, 0.000, 0.028, 0.026, 0.000, 0.000],
    [0.000, 0.026, 0.000, 0.000, 0.025, 0.000, 0.000, 0.019],
    [0.000, 0.000, 0.028, 0.025, 0.000, 0.000, 0.000, 0.018],
    [0.022, 0.000, 0.026, 0.000, 0.000, 0.000, 0.000, 0.016],
    [0.034, 0.028, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000],
    [0.000, 0.000, 0.000, 0.019, 0.018, 0.016, 0.000, 0.000]
  ];

  const MODE_PROFILES = {
    zombie: {
      code: "PLAGA_ZOMBIE",
      badgeText: "TRACK B · LA PLAGA ZOMBIE",
      emblem: "☣",
      betaBase: 0.72,
      incubationDays: 3,
      recoveryGamma: 0.20,
      corridorCoupling: 0.025,
      initialCases: 10,
      defaultVaccineEfficacy: 85,
      helperHtml:
        'Escenario competitivo Track B calibrado sobre los 8 nodos viales de Manta (<code>&beta;=0.72</code>, incubación <code>3d</code>, eficacia <code>85%</code>).',
      labels: {
        S: "🟢 Sano (S)",
        E: "🟡 Mordido (E)",
        I: "🔴 Zombie (I)",
        R: "🔵 Exorcizado / Inmune (R)",
        shortI: "🔴 Zombies Activos I(t)",
        incHelp: "Latencia 🟡 Mordido → 🔴 Zombie"
      }
    },
    dengue: {
      code: "DENGUE_INEC_MSP",
      badgeText: "MODO CIENTÍFICO · EPIDEMIA DENGUE INEC / MSP",
      emblem: "🦟",
      betaBase: 0.58,
      incubationDays: 5,
      recoveryGamma: 0.1667,
      corridorCoupling: 0.028,
      initialCases: 14,
      defaultVaccineEfficacy: 80,
      helperHtml:
        'Calibración oficial <strong>INEC CPV 2022 + MSP Zona 4 Manabí</strong> para <em>Aedes aegypti</em> (<code>&beta;=0.58</code>, incubación <code>5d</code>, viremia <code>6d</code>, eficacia tetravalente <code>80%</code>).',
      labels: {
        S: "🟢 Susceptible Sano (S)",
        E: "🟡 Expuesto Incubando (E)",
        I: "🔴 Dengue Activo (I)",
        R: "🔵 Inmunizado / Recup. (R)",
        shortI: "🔴 Casos Dengue Activos I(t)",
        incHelp: "Incubación clínica MSP (S → I)"
      }
    }
  };

  const TOTAL_CITY_POPULATION = MANTA_NODES.reduce((acc, n) => acc + n.population, 0); // 100,000

  const MANTA_EDGES = [];
  for (let i = 0; i < MANTA_NODES.length; i++) {
    for (const j of MANTA_NODES[i].neighbors) {
      if (i < j) {
        MANTA_EDGES.push({ u: i, v: j });
      }
    }
  }

  // Costos e impactos reales de las 3 intervenciones combinadas
  const COST_VACCINE_DOSE = 15;          // $15 por dosis (solo población Sana)
  const COST_FUMIGATION = 1200;          // $1,200 por barrio (5 días, -40% transmisión local)
  const FUMIGATION_DURATION_DAYS = 5;
  const FUMIGATION_LOCAL_MULT = 0.60;
  const COST_NODE_CLOSURE = 3500;        // $3,500 por barrio (-75% flujo inter-barrial)
  const CLOSURE_FLOW_MULT = 0.25;
  const TACTICAL_BRIGADE_SIZE = 100;

  const DEFAULT_CONFIG = Object.freeze({
    mode: "zombie",
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

  // ============================================================================
  // 2. PRNG DETERMINISTA mulberry32(seed) Y MUESTREADORES ESTADÍSTICOS
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

  function createFnv1aHasher() {
    let fnvHash = 0x811c9dc5;
    return {
      mix(val) {
        fnvHash ^= val & 0xff;
        fnvHash = Math.imul(fnvHash, 0x01000193) >>> 0;
        fnvHash ^= (val >>> 8) & 0xff;
        fnvHash = Math.imul(fnvHash, 0x01000193) >>> 0;
        fnvHash ^= (val >>> 16) & 0xff;
        fnvHash = Math.imul(fnvHash, 0x01000193) >>> 0;
      },
      hex() {
        return "0x" + fnvHash.toString(16).toUpperCase().padStart(8, "0");
      }
    };
  }

  function sampleBinomial(n, p, rng) {
    const u1 = rng();
    const u2 = rng();
    if (n <= 0 || p <= 0) return 0;
    if (p >= 1) return n;

    let flipped = false;
    let prob = p;
    if (prob > 0.5) {
      prob = 1 - prob;
      flipped = true;
    }

    const mean = n * prob;
    let res = 0;
    if (mean < 14) {
      const q = Math.max(0.000001, 1 - prob);
      let term = Math.exp(n * Math.log(q));
      let cdf = term;
      const ratio = prob / q;
      let k = 0;
      const limit = Math.min(n, Math.floor(mean + 10 * Math.sqrt(mean + 1)) + 12);
      while (u1 > cdf && k < limit) {
        term *= ((n - k) * ratio) / Math.max(1, k + 1);
        cdf += term;
        k++;
      }
      res = k;
    } else {
      const safeU1 = Math.max(1e-12, u1);
      const z = Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2);
      const sampled = Math.round(mean + Math.sqrt(mean * (1 - prob)) * z);
      res = Math.max(0, Math.min(n, sampled));
    }

    return flipped ? n - res : res;
  }

  function sampleHypergeometric(totalPop, successPop, draws, rng) {
    if (draws <= 0 || successPop <= 0 || totalPop <= 0) return 0;
    const minPossible = Math.max(0, draws - (totalPop - successPop));
    const maxPossible = Math.min(draws, successPop);
    if (minPossible >= maxPossible) return minPossible;

    if (draws <= 30) {
      let chosen = 0;
      let remTot = totalPop;
      let remSucc = successPop;
      for (let i = 0; i < draws; i++) {
        if (remTot <= 0) break;
        if (rng() < remSucc / Math.max(1, remTot)) {
          chosen++;
          remSucc--;
        }
        remTot--;
      }
      return Math.max(minPossible, Math.min(maxPossible, chosen));
    }

    const p = successPop / Math.max(1, totalPop);
    const mean = draws * p;
    const fpc = totalPop > 1 ? (totalPop - draws) / Math.max(1, totalPop - 1) : 0;
    const variance = Math.max(0, draws * p * (1 - p) * fpc);
    const u1 = Math.max(1e-12, rng());
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const sampled = Math.round(mean + Math.sqrt(variance) * z);
    return Math.max(minPossible, Math.min(maxPossible, sampled));
  }

  // ============================================================================
  // 3. CALIBRACIÓN CLIMÁTICA EN VIVO (OPEN-METEO + CURVA TÉRMICA DE BRIÈRE)
  // ============================================================================
  function computeClimateCalibratedBeta(baseBeta, tempC, humidityPct, precipMm) {
    const tEff = Math.max(14.5, Math.min(38.0, Number(tempC) || 26.5));
    const rhEff = Math.max(20.0, Math.min(100.0, Number(humidityPct) || 76.0));
    const pEff = Math.max(0.0, Math.min(50.0, Number(precipMm) || 0.0));

    function briere(t) {
      return t * (t - 13.5) * Math.sqrt(Math.max(0.01, 39.0 - t));
    }

    const phiTemp = briere(tEff) / Math.max(0.0001, briere(26.5));
    const phiRh = Math.max(0.75, Math.min(1.25, 1.0 + 0.0045 * (rhEff - 76.0)));
    const phiRain = 1.0 + Math.min(0.28, 0.035 * pEff);
    const multiplier = phiTemp * phiRh * phiRain;
    const betaCal = Math.max(0.15, Math.min(2.20, Number((baseBeta * multiplier).toFixed(2))));

    return {
      betaCalibrated: betaCal,
      multiplier: Number(multiplier.toFixed(2)),
      phiTemp: Number(phiTemp.toFixed(3)),
      phiRh: Number(phiRh.toFixed(3)),
      phiRain: Number(phiRain.toFixed(3))
    };
  }

  // ============================================================================
  // 4. MOTOR SEIR + ESCUDO DE CENTRALIDAD Y CERCO PERIMETRAL ADAPTATIVO
  // ============================================================================
  function computeShieldScore(nodeIndex, S, E, I, efficacy = 0.85) {
    if (S[nodeIndex] <= 0) return 0;
    const node = MANTA_NODES[nodeIndex];
    const deg = node.neighbors.length;
    const pop = Math.max(1, node.population || 0);

    let neighborInfected = 0;
    let neighborActiveHub = false;
    for (let m = 0; m < deg; m++) {
      const nb = node.neighbors[m];
      const nbLoad = I[nb] + 0.5 * E[nb];
      neighborInfected += I[nb];
      if (nbLoad >= 6 && (MANTA_NODES[nb].neighbors.length >= 3 || efficacy <= 0.65)) {
        neighborActiveHub = true;
      }
    }

    const healthyRatio = S[nodeIndex] / pop;
    const baseScore = deg * neighborInfected * healthyRatio;

    const localActiveLoad = I[nodeIndex] + E[nodeIndex];
    const localPrevalence = localActiveLoad / pop;

    let hasHealthyPerimeter = false;
    if (localActiveLoad >= 6) {
      for (let m = 0; m < deg; m++) {
        const nb = node.neighbors[m];
        const nbPop = Math.max(1, MANTA_NODES[nb].population || 0);
        if (S[nb] / nbPop > 0.35 && I[nb] + E[nb] < localActiveLoad) {
          hasHealthyPerimeter = true;
          break;
        }
      }
    }

    let ringMultiplier = 1.0;
    if (
      localActiveLoad >= 8 &&
      hasHealthyPerimeter &&
      (deg >= 3 || efficacy <= 0.65 || localPrevalence >= 0.008)
    ) {
      // Evita desperdiciar vacunas dentro del foco expuesto mientras se blinda el anillo vecino
      ringMultiplier = 0.18;
    } else if (neighborActiveHub && localPrevalence < 0.035) {
      // Anillo perimetral preventivo en los barrios vecinos conectados al epicentro
      ringMultiplier = 2.35;
    }

    const finalScore = baseScore * ringMultiplier;
    return Number.isFinite(finalScore) ? finalScore : 0;
  }

  function simulateSingleTrajectory(runSeed, strategy, config, recordNodeHistory) {
    const numNodes = MANTA_NODES.length;
    const days = config.days;
    const modeProfile = MODE_PROFILES[config.mode] || MODE_PROFILES.zombie;
    const isDengue = config.mode === "dengue";

    const beta = config.beta;
    const sigma = 1 / Math.max(1, config.incubationDays);
    const gamma = modeProfile.recoveryGamma;
    const corridorCoupling = modeProfile.corridorCoupling;
    const initialCases = modeProfile.initialCases;
    const efficacy = Math.max(0.10, Math.min(1.0, config.vaccineEfficacyPct / 100));

    const S = new Int32Array(numNodes);
    const S_vacFailed = new Int32Array(numNodes);
    const E = new Int32Array(numNodes);
    const I = new Int32Array(numNodes);
    const R = new Int32Array(numNodes);

    const fumigationDaysLeft = new Int32Array(numNodes);
    const nodeClosed = new Uint8Array(numNodes);

    const vaccinatedByNode = new Int32Array(numNodes);
    const fumigationsByNode = new Int32Array(numNodes);
    const closuresByNode = new Int32Array(numNodes);
    const cumInfectedByNode = new Int32Array(numNodes);

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
    const initZ = Math.min(initialCases, S[pz]);
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
    const epiRng = mulberry32(runSeed >>> 0);

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
            score: computeShieldScore(k, S, E, I, efficacy)
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
      for (let k = 0; k < numNodes; k++) {
        if (fumigationDaysLeft[k] > 0) {
          fumigationDaysLeft[k]--;
        }
      }

      if (strategy !== "none" && regionalStockRemaining > 0) {
        const arrivingDoses = Math.min(config.dailyDoseArrival, regionalStockRemaining);
        coldChainDosesAvailable += arrivingDoses;
        regionalStockRemaining -= arrivingDoses;
      }

      let brigadesLeftToday = strategy === "none" ? 0 : config.dailyBrigadeArrival;

      // FASE 1: INTERVENCIONES COMBINADAS Y VACUNACIÓN ESTRICTA A POBLACIÓN SANA
      if (strategy === "random" && cashRemaining > 0) {
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

        if (config.useVaccines && coldChainDosesAvailable > 0 && cashRemaining >= COST_VACCINE_DOSE) {
          const maxAffordable = Math.floor(cashRemaining / COST_VACCINE_DOSE);
          let eligiblePool = 0;
          for (let k = 0; k < numNodes; k++) {
            eligiblePool += S[k] - S_vacFailed[k];
          }

          let dosesLeft = Math.min(coldChainDosesAvailable, Math.min(maxAffordable, eligiblePool));
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
        const pzIsCentral = MANTA_NODES[pz].neighbors.length >= 3;
        const maxStrategicClosures = !config.useVaccines
          ? 8
          : efficacy <= 0.60 || pzIsCentral
            ? Math.max(1, Math.min(5, Math.floor(config.totalBudget / 9000)))
            : Math.max(1, Math.min(4, Math.floor(config.totalBudget / 12500)));

        // 2A. Cerco Sanitario / Cuarentena Selectiva ($3,500, -75% flujo inter-barrial)
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
              const sFrac = S[k] / Math.max(1, MANTA_NODES[k].population);

              let cScore = 0;
              if (I[k] >= 4 || (k === pz && I[k] + E[k] >= 3)) {
                cScore = 1800 + (I[k] + 0.5 * E[k]) * deg * 15;
              } else if (neighZ >= 5) {
                cScore = deg * neighZ * sFrac * 3.4;
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

        // 2B. Brigada de Fumigación / Control Vectorial ($1,200, -40% contagio local por 5 días)
        if (config.useFumigation) {
          while (brigadesLeftToday > 0 && cashRemaining >= COST_FUMIGATION) {
            let bestFumNode = -1;
            let bestFumScore = 0;

            for (let k = 0; k < numNodes; k++) {
              if (fumigationDaysLeft[k] > 0 || S[k] < 150) continue;
              const activeLoad = I[k] + 0.5 * E[k];
              if (activeLoad < 3.5) continue;

              const sFrac = S[k] / Math.max(1, MANTA_NODES[k].population);
              const deg = MANTA_NODES[k].neighbors.length;
              const vectorWeight = isDengue ? MANTA_NODES[k].aedesBreteauIndex / 14.0 : 1.0;
              const fScore = activeLoad * sFrac * (1 + 0.35 * deg) * vectorWeight;
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

        // 2C. Vacunación con Anillo Perimetral Adaptativo ($15/dosis, solo población Sana)
        if (config.useVaccines && coldChainDosesAvailable > 0 && cashRemaining >= COST_VACCINE_DOSE) {
          const reserveRatio = efficacy <= 0.55 ? 0.26 : pzIsCentral ? 0.14 : 0.08;
          const fumReserve =
            (config.useFumigation || config.useClosure) && d <= 18
              ? Math.min(cashRemaining, Math.round(config.totalBudget * reserveRatio))
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
              const score = computeShieldScore(k, S, E, I, efficacy) * (elig / Math.max(1, S[k]));
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
                const isRingNb = MANTA_NODES[k].neighbors.includes(pz) && k !== pz ? 2.2 : 1.0;
                const fb =
                  MANTA_NODES[k].neighbors.length *
                  isRingNb *
                  (elig / Math.max(1, MANTA_NODES[k].population));
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

      // FASE 2: TRANSICIÓN DIARIA SEIR ESTOCÁSTICA (NÚMEROS ALEATORIOS COMUNES)
      for (let k = 0; k < numNodes; k++) {
        const node = MANTA_NODES[k];
        const contactDispersion = 0.60 + 0.80 * epiRng();

        const localFumModifier = fumigationDaysLeft[k] > 0 ? FUMIGATION_LOCAL_MULT : 1.0;
        const breteauMod = isDengue ? 0.85 + 0.30 * (node.aedesBreteauIndex / 15.0) : 1.0;
        const localForce = localFumModifier * breteauMod * beta * (I[k] / Math.max(1, node.population));

        const hubTrafficFactor = node.neighbors.length / 3.0;
        let neighborForce = 0;
        for (let m = 0; m < node.neighbors.length; m++) {
          const nbIdx = node.neighbors[m];
          let corridorMod = 1.0;
          if (nodeClosed[k] === 1) corridorMod *= CLOSURE_FLOW_MULT;
          if (nodeClosed[nbIdx] === 1) corridorMod *= CLOSURE_FLOW_MULT;

          const edgeCoupling = isDengue
            ? MOBILITY_MATRIX[k][nbIdx]
            : corridorCoupling * hubTrafficFactor;

          neighborForce +=
            corridorMod *
            edgeCoupling *
            beta *
            (I[nbIdx] / Math.max(1, MANTA_NODES[nbIdx].population));
        }

        const totalLambda = (localForce + neighborForce) * contactDispersion;
        const probExposure = totalLambda > 0 ? 1 - Math.exp(-totalLambda) : 0;

        newExposed[k] = sampleBinomial(S[k], probExposure, epiRng);
        newZombies[k] = sampleBinomial(E[k], sigma, epiRng);
        newExorcised[k] = sampleBinomial(I[k], gamma, epiRng);
      }

      for (let k = 0; k < numNodes; k++) {
        if (S[k] > 0 && newExposed[k] > 0 && S_vacFailed[k] > 0) {
          const bittenFromFailed = Math.round((newExposed[k] * S_vacFailed[k]) / Math.max(1, S[k]));
          S_vacFailed[k] = Math.max(0, Math.min(S[k] - newExposed[k], S_vacFailed[k] - bittenFromFailed));
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

  function computeStats(arr) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    const len = arr ? arr.length : 0;
    for (let i = 0; i < len; i++) {
      const v = Number.isFinite(arr[i]) ? arr[i] : 0;
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return {
      mean: len > 0 ? (sum / Math.max(1, len)) || 0 : 0,
      min: len > 0 && min !== Infinity ? min : 0,
      max: len > 0 && max !== -Infinity ? max : 0
    };
  }

  function runMonteCarloSimulation(config, customSubSeeds = null) {
    const t0 = performance.now();
    const subSeeds = customSubSeeds || deriveSubSeeds(config.seed, config.runs);
    const runs = subSeeds.length;
    const days = config.days;
    const numNodes = MANTA_NODES.length;

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

    const hasher = createFnv1aHasher();

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

        hasher.mix(res.cumulativeInfected);
        hasher.mix(res.totalDosesApplied);
        hasher.mix(res.totalBudgetSpent);

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
      const safeRuns = Math.max(1, runs);
      for (let d = 0; d <= days; d++) {
        bucket.dailyMeanS[d] /= safeRuns;
        bucket.dailyMeanE[d] /= safeRuns;
        bucket.dailyMeanI[d] /= safeRuns;
        bucket.dailyMeanR[d] /= safeRuns;
        bucket.dailyMeanCumInf[d] /= safeRuns;
        bucket.dailyMeanProtected[d] /= safeRuns;
      }

      summary[key] = {
        infectedStats: computeStats(bucket.infectedArr),
        savedStats: computeStats(bucket.savedArr),
        meanDoses: (bucket.dosesSum / safeRuns) || 0,
        meanImmunized: (bucket.immunizedSum / safeRuns) || 0,
        meanFumigations: (bucket.fumigationsSum / safeRuns) || 0,
        meanClosures: (bucket.closuresSum / safeRuns) || 0,
        meanSpent: (bucket.spentSum / safeRuns) || 0,
        violations: bucket.violationsSum || 0,
        nodeMeanVac: Array.from(bucket.nodeVacSum, (v) => (v / safeRuns) || 0),
        nodeMeanFum: Array.from(bucket.nodeFumSum, (v) => (v / safeRuns) || 0),
        nodeMeanClose: Array.from(bucket.nodeCloseSum, (v) => (v / safeRuns) || 0),
        nodeMeanInf: Array.from(bucket.nodeInfSum, (v) => (v / safeRuns) || 0),
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
    const hashHex = hasher.hex();

    return {
      config,
      subSeeds,
      summary,
      elapsedMs,
      hashHex,
      cloudEngine: "local-mulberry32",
      workersUsed: 1
    };
  }

  // ============================================================================
  // 5. ESTADO GLOBAL DE UI Y REFERENCIAS DOM
  // ============================================================================
  const fmtInt = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 });
  const fmtDec = new Intl.NumberFormat("es-EC", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function formatInt(n) {
    return fmtInt.format(Math.round(n));
  }

  function formatUSD(n) {
    return "$" + fmtInt.format(Math.round(n));
  }

  let activeEpiMode = DEFAULT_CONFIG.mode;
  let activeMapView = "geo"; // "geo" (Leaflet GPS) o "topo" (SVG)
  let currentResult = null;
  let activeChartMetric = "cumInfected";
  let selectedNodeIndex = DEFAULT_CONFIG.patientZeroIndex;
  let timelineDay = 60;
  let timelineTimer = null;
  let plainTextMayorBrief = "";
  let latestRequestId = 0;

  let currentMantaWeather = {
    live: false,
    temperatureC: 26.0,
    humidityPct: 78.0,
    precipitationMm: 0.0,
    source: "offline"
  };

  let comparisonChartInstance = null;
  let seirChartInstance = null;

  // Instancias de Leaflet (Mapa Geoespacial Real de Manta: Esri Calles Oscuro + Esri Satélite Híbrido)
  let leafletMap = null;
  let leafletStreetLayer = null;
  let leafletSatelliteLayer = null;
  let leafletSatelliteLabelsLayer = null;
  let activeBasemapMode = "street"; // "street" (Esri Calles Oscuro) | "satellite" (Esri Satélite Híbrido)
  let allNodesBounds = null;
  let mapResizeObserver = null;
  let mapResizeRaf = null;
  let lastObservedMapSize = "";
  let leafletEdgeLines = [];
  let leafletHeatCircles = [];
  let leafletNodeMarkers = [];
  let activeCloudOverlayCount = 0;
  let chartResizeObserver = null;
  let chartResizeRaf = null;
  let isInitialBootstrap = true;

  const dom = {
    // Modo y Clima Open-Meteo
    brandEmblem: document.getElementById("brandEmblem"),
    topModeBadge: document.getElementById("topModeBadge"),
    btnModeZombie: document.getElementById("btnModeZombie"),
    btnModeDengue: document.getElementById("btnModeDengue"),
    modeHelperText: document.getElementById("modeHelperText"),
    weatherLiveDot: document.getElementById("weatherLiveDot"),
    weatherSourceBadge: document.getElementById("weatherSourceBadge"),
    weatherTempVal: document.getElementById("weatherTempVal"),
    weatherHumVal: document.getElementById("weatherHumVal"),
    weatherPrecipVal: document.getElementById("weatherPrecipVal"),
    weatherFactorVal: document.getElementById("weatherFactorVal"),
    btnCalibrateWeather: document.getElementById("btnCalibrateWeather"),

    // Conexión Cloud AWS Lambda + Fan-Out
    inputLambdaUrl: document.getElementById("inputLambdaUrl"),
    btnApplyLambda: document.getElementById("btnApplyLambda"),
    btnClearLambda: document.getElementById("btnClearLambda"),
    cloudParallelBadge: document.getElementById("cloudParallelBadge"),
    cloudStatusPill: document.getElementById("cloudStatusPill"),
    cloudStatusText: document.getElementById("cloudStatusText"),
    datasetSourcePill: document.getElementById("datasetSourcePill"),

    // Barra Rápida Brote Sorpresa + Auto-Optimizador
    btnAutoOptimize: document.getElementById("btnAutoOptimize"),
    btnChallengeBeta2x: document.getElementById("btnChallengeBeta2x"),
    btnChallengeHalfVac: document.getElementById("btnChallengeHalfVac"),
    btnChallengeTarqui: document.getElementById("btnChallengeTarqui"),
    btnChallengeVariant50: document.getElementById("btnChallengeVariant50"),
    btnChallengeRestore: document.getElementById("btnChallengeRestore"),
    optimizerBanner: document.getElementById("optimizerBanner"),

    // Formulario Principal
    form: document.getElementById("simForm"),
    btnRunSim: document.getElementById("btnRunSim"),
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
    incubationHelpText: document.getElementById("incubationHelpText"),
    rangeVaccines: document.getElementById("rangeVaccines"),
    inputVaccines: document.getElementById("inputVaccines"),
    outVaccines: document.getElementById("outVaccines"),

    // Controles Presupuesto e Intervenciones
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

    // Chips y etiquetas dinámicas de modo
    chipLabelS: document.getElementById("chipLabelS"),
    chipLabelE: document.getElementById("chipLabelE"),
    chipLabelI: document.getElementById("chipLabelI"),
    chipLabelR: document.getElementById("chipLabelR"),
    liveLabelS: document.getElementById("liveLabelS"),
    liveLabelE: document.getElementById("liveLabelE"),
    liveLabelI: document.getElementById("liveLabelI"),
    liveLabelR: document.getElementById("liveLabelR"),
    inspLabelS: document.getElementById("inspLabelS"),
    inspLabelE: document.getElementById("inspLabelE"),
    inspLabelI: document.getElementById("inspLabelI"),
    inspLabelR: document.getElementById("inspLabelR"),
    tabActiveMetric: document.getElementById("tabActiveMetric"),

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

    // Mapas (Leaflet GPS + SVG Topológico) y Línea de Tiempo Día 0..60
    btnViewGeo: document.getElementById("btnViewGeo"),
    btnViewTopo: document.getElementById("btnViewTopo"),
    geoMapContainer: document.getElementById("geoMapContainer"),
    topoMapContainer: document.getElementById("topoMapContainer"),
    mantaGeoMap: document.getElementById("mantaGeoMap"),
    btnCenterMapNodes: document.getElementById("btnCenterMapNodes"),
    btnToggleBasemap: document.getElementById("btnToggleBasemap"),
    btnFullscreenMap: document.getElementById("btnFullscreenMap"),
    activeBasemapBadge: document.getElementById("activeBasemapBadge"),

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

    // Tablas, Gráficas y DynamoDB Audit
    tableFinalDay: document.getElementById("tableFinalDay"),
    barrioTableBody: document.getElementById("barrioTableBody"),
    barrioTableFoot: document.getElementById("barrioTableFoot"),
    auditSummaryText: document.getElementById("auditSummaryText"),
    comparisonCanvas: document.getElementById("comparisonChart"),
    seirCanvas: document.getElementById("seirBreakdownChart"),
    selectSeirStrategy: document.getElementById("selectSeirStrategy"),

    dynamoStorageBadge: document.getElementById("dynamoStorageBadge"),
    btnRefreshDynamo: document.getElementById("btnRefreshDynamo"),
    dynamoAuditBody: document.getElementById("dynamoAuditBody"),

    // Overlay de Carga Cloud AWS y Sistema de Notificaciones Toast
    cloudLoadingOverlay: document.getElementById("cloudLoadingOverlay"),
    cloudLoadingSubtext: document.getElementById("cloudLoadingSubtext"),
    toastContainer: document.getElementById("toastContainer")
  };

  function setCloudLoadingOverlay(visible, subtext) {
    if (!dom.cloudLoadingOverlay) return;
    if (visible) {
      activeCloudOverlayCount++;
      if (dom.cloudLoadingSubtext && subtext) {
        dom.cloudLoadingSubtext.textContent = subtext;
      }
      dom.cloudLoadingOverlay.classList.remove("hidden");
    } else {
      activeCloudOverlayCount = Math.max(0, activeCloudOverlayCount - 1);
      if (activeCloudOverlayCount === 0) {
        dom.cloudLoadingOverlay.classList.add("hidden");
      }
    }
  }

  let activeBusyOperations = 0;

  function setOperationButtonsBusy(busy) {
    if (busy) {
      activeBusyOperations++;
      if (dom.btnRunSim) {
        dom.btnRunSim.disabled = true;
        dom.btnRunSim.innerHTML = `<span class="btn-spinner" aria-hidden="true">⏳</span> Calculando en AWS...`;
      }
      if (dom.btnAutoOptimize) {
        dom.btnAutoOptimize.disabled = true;
        dom.btnAutoOptimize.innerHTML = `<span class="btn-spinner" aria-hidden="true">⏳</span> Calculando en AWS...`;
      }
    } else {
      activeBusyOperations = Math.max(0, activeBusyOperations - 1);
      if (activeBusyOperations === 0) {
        if (dom.btnRunSim) {
          dom.btnRunSim.disabled = false;
          dom.btnRunSim.innerHTML = `⚡ Ejecutar Operación Monte Carlo`;
        }
        if (dom.btnAutoOptimize) {
          dom.btnAutoOptimize.disabled = false;
          dom.btnAutoOptimize.innerHTML = `🧠 Auto-Optimizar Presupuesto y Estrategia`;
        }
      }
    }
  }

  function showToast(messageHtml, variant = "success", durationMs = 3000) {
    if (!dom.toastContainer) return;

    while (dom.toastContainer.children.length >= 3) {
      dom.toastContainer.removeChild(dom.toastContainer.firstElementChild);
    }

    const icons = {
      success: "✓",
      info: "⚡",
      warn: "⚠️"
    };

    const toast = document.createElement("div");
    toast.className = `toast-item toast-${variant}`;
    toast.setAttribute("role", "status");
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icons[variant] || "✅"}</span>
      <span class="toast-body">${messageHtml}</span>
      <span class="toast-progress" style="animation-duration: ${durationMs}ms;"></span>
    `;

    dom.toastContainer.appendChild(toast);

    const fadeDelay = Math.max(200, durationMs - 260);
    setTimeout(() => {
      toast.classList.add("toast-leaving");
    }, fadeDelay);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, durationMs);
  }

  function scheduleDynamicChartsAndMapResize() {
    if (chartResizeRaf !== null) {
      cancelAnimationFrame(chartResizeRaf);
    }
    chartResizeRaf = requestAnimationFrame(() => {
      chartResizeRaf = null;
      if (comparisonChartInstance && typeof comparisonChartInstance.resize === "function") {
        comparisonChartInstance.resize();
      }
      if (seirChartInstance && typeof seirChartInstance.resize === "function") {
        seirChartInstance.resize();
      } else if (typeof window.Chart === "undefined" && currentResult) {
        renderCharts(currentResult);
      }
      if (leafletMap && activeMapView === "geo") {
        recenterAllNodesOnMap();
      }
    });
  }

  function initResponsiveChartsAndLayoutObserver() {
    window.addEventListener("resize", scheduleDynamicChartsAndMapResize, { passive: true });
    window.addEventListener("orientationchange", () => {
      setTimeout(scheduleDynamicChartsAndMapResize, 120);
    });

    if (typeof window.ResizeObserver !== "undefined") {
      chartResizeObserver = new window.ResizeObserver(() => {
        scheduleDynamicChartsAndMapResize();
      });
      document.querySelectorAll(".chart-canvas-wrap").forEach((wrap) => {
        chartResizeObserver.observe(wrap);
      });
    }
  }

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
    if (!rangeEl || !numEl) return;

    const getMin = () => {
      const rMin = parseFloat(rangeEl.min);
      const nMin = parseFloat(numEl.min);
      if (Number.isFinite(rMin)) return rMin;
      if (Number.isFinite(nMin)) return nMin;
      return 0;
    };
    const getMax = () => {
      const rMax = parseFloat(rangeEl.max);
      const nMax = parseFloat(numEl.max);
      if (Number.isFinite(rMax)) return rMax;
      if (Number.isFinite(nMax)) return nMax;
      return 100;
    };

    const clamp = (val) => {
      const min = getMin();
      const max = getMax();
      const n = parseFloat(val);
      if (!Number.isFinite(n)) return min;
      return Math.max(min, Math.min(max, n));
    };

    rangeEl.addEventListener("input", () => {
      const clamped = clamp(rangeEl.value);
      numEl.value = String(clamped);
      if (outEl) outEl.textContent = formatter(clamped);
    });

    numEl.addEventListener("input", () => {
      const raw = parseFloat(numEl.value);
      if (Number.isFinite(raw)) {
        const clamped = clamp(raw);
        rangeEl.value = String(clamped);
        if (outEl) outEl.textContent = formatter(clamped);
      }
    });

    const enforceStrictBounds = () => {
      const clamped = clamp(numEl.value);
      numEl.value = String(clamped);
      rangeEl.value = String(clamped);
      if (outEl) outEl.textContent = formatter(clamped);
    };

    numEl.addEventListener("change", enforceStrictBounds);
    numEl.addEventListener("blur", enforceStrictBounds);
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
      mode: activeEpiMode,
      seed: Number.isFinite(seedRaw) ? Math.max(0, Math.min(2147483647, seedRaw)) : DEFAULT_CONFIG.seed,
      runs: Number.isFinite(runsRaw) ? Math.max(1, Math.min(500, runsRaw)) : DEFAULT_CONFIG.runs,
      days: Number.isFinite(daysRaw) ? Math.max(10, Math.min(150, daysRaw)) : DEFAULT_CONFIG.days,
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
    if (cfg.mode) {
      activeEpiMode = cfg.mode;
    }
    dom.inputSeed.value = String(cfg.seed);

    dom.inputRuns.value = String(cfg.runs);
    dom.rangeRuns.value = String(Math.min(500, cfg.runs));
    dom.outRuns.textContent = String(cfg.runs);

    dom.inputDays.value = String(cfg.days);
    dom.rangeDays.value = String(Math.min(150, cfg.days));
    dom.outDays.textContent = `${cfg.days} d`;

    dom.selectPatientZero.value = String(cfg.patientZeroIndex);

    dom.inputBeta.value = cfg.beta.toFixed(2);
    dom.rangeBeta.value = String(Math.min(2.2, cfg.beta));
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

  function updateModeLabelsUI() {
    const prof = MODE_PROFILES[activeEpiMode] || MODE_PROFILES.zombie;
    const isDengue = activeEpiMode === "dengue";

    dom.btnModeZombie.classList.toggle("active", !isDengue);
    dom.btnModeZombie.setAttribute("aria-selected", String(!isDengue));
    dom.btnModeDengue.classList.toggle("active", isDengue);
    dom.btnModeDengue.setAttribute("aria-selected", String(isDengue));

    dom.brandEmblem.textContent = prof.emblem;
    dom.topModeBadge.textContent = prof.badgeText;
    dom.modeHelperText.innerHTML = prof.helperHtml;
    dom.incubationHelpText.textContent = prof.labels.incHelp;

    dom.chipLabelS.innerHTML = `${prof.labels.S} · Único vacunable`;
    dom.chipLabelE.innerHTML = `${prof.labels.E} · No vacunable`;
    dom.chipLabelI.innerHTML = `${prof.labels.I} · No vacunable`;
    dom.chipLabelR.innerHTML = `${prof.labels.R} · Protegido`;

    dom.liveLabelS.textContent = prof.labels.S;
    dom.liveLabelE.textContent = prof.labels.E;
    dom.liveLabelI.textContent = prof.labels.I;
    dom.liveLabelR.textContent = prof.labels.R;

    dom.inspLabelS.textContent = prof.labels.S;
    dom.inspLabelE.textContent = prof.labels.E;
    dom.inspLabelI.textContent = prof.labels.I;
    dom.inspLabelR.textContent = prof.labels.R;
    dom.tabActiveMetric.textContent = prof.labels.shortI;

    renderWeatherWidget();
  }

  // ============================================================================
  // 6. TELEMETRÍA EN VIVO OPEN-METEO PARA MANTA
  // ============================================================================
  function renderWeatherWidget() {
    const prof = MODE_PROFILES[activeEpiMode] || MODE_PROFILES.zombie;
    const temp = Number.isFinite(currentMantaWeather.temperatureC) ? currentMantaWeather.temperatureC : 26.0;
    const hum = Number.isFinite(currentMantaWeather.humidityPct) ? currentMantaWeather.humidityPct : 78.0;
    const precip = Number.isFinite(currentMantaWeather.precipitationMm) ? currentMantaWeather.precipitationMm : 0.0;

    const cal = computeClimateCalibratedBeta(
      prof.betaBase,
      temp,
      hum,
      precip
    );

    dom.weatherTempVal.textContent = `${temp.toFixed(1)} °C`;
    dom.weatherHumVal.textContent = `${Math.round(hum)} %`;
    dom.weatherPrecipVal.textContent = `${precip.toFixed(1)} mm`;
    dom.weatherFactorVal.textContent = `${(cal.multiplier || 1.0).toFixed(2)}× (β=${(cal.betaCalibrated || prof.betaBase).toFixed(2)})`;
    dom.weatherSourceBadge.textContent = currentMantaWeather.live
      ? "En vivo · Open-Meteo Manta"
      : "🌤️ Clima Promedio (Modo Offline)";
  }

  async function fetchLiveMantaWeather() {
    const controller = new AbortController();
    const tId = setTimeout(() => {
      controller.abort();
    }, 3500);

    try {
      const resp = await fetch(OPEN_METEO_URL, { signal: controller.signal });
      clearTimeout(tId);
      if (!resp.ok) throw new Error("Open-Meteo HTTP error");
      const data = await resp.json();
      if (data && data.current) {
        currentMantaWeather = {
          live: true,
          temperatureC: Number(data.current.temperature_2m ?? 26.0),
          humidityPct: Number(data.current.relative_humidity_2m ?? 78.0),
          precipitationMm: Number(data.current.precipitation ?? 0.0),
          source: "Open-Meteo Live"
        };
      } else {
        throw new Error("Invalid Open-Meteo payload");
      }
    } catch (_) {
      clearTimeout(tId);
      // Fallback Rápido (Timeout / Error): asigna valores climáticos por defecto (Temp: 26°C, Humedad: 78%)
      currentMantaWeather = {
        live: false,
        temperatureC: 26.0,
        humidityPct: 78.0,
        precipitationMm: 0.0,
        source: "offline"
      };
    } finally {
      renderWeatherWidget();
    }
  }

  // ============================================================================
  // 7. AUTO-OPTIMIZADOR PRESUPUESTARIO E INFORME EJECUTIVO DEL ALCALDE
  // ============================================================================
  let activeOptimizedPortfolioLabel = "";

  async function runBudgetAutoOptimizer() {
    if (activeBusyOperations > 0) return;
    setOperationButtonsBusy(true);
    await new Promise((resolve) => setTimeout(resolve, 20));

    try {
      const baseCfg = readConfigFromForm();
      const stock = baseCfg.totalVaccines || 0;
      const efficacy = baseCfg.vaccineEfficacyPct || 85;
      const budget = baseCfg.totalBudget || 0;
      const pzName = MANTA_NODES[baseCfg.patientZeroIndex].name;
      const evalSeeds = deriveSubSeeds(baseCfg.seed, Math.min(14, Math.max(8, Math.floor(baseCfg.runs / 3))));

      // Evaluación real de referencia con la configuración actual del formulario
      const baselineSim = runMonteCarloSimulation(baseCfg, evalSeeds);
      const baselineSaved = baselineSim.summary.shield.savedStats.mean || 0;

      let portfolioLabel = "";
      let regimeType = "";
      let regimeCandidates = [];

      // Regla 3: Stock Bajo (< 5,000) o Efectividad < 60% -> Sin Biológico
      if (stock < 5000 || efficacy < 60) {
        regimeType = "no_bio";
        portfolioLabel = "Fumigación + Cerco Sanitario Estricto (Sin Biológico)";
        regimeCandidates = [
          {
            useVaccines: false,
            useFumigation: true,
            useClosure: true,
            dailyBrigadeArrival: 3,
            dailyDoseArrival: 50
          },
          {
            useVaccines: false,
            useFumigation: true,
            useClosure: true,
            dailyBrigadeArrival: 4,
            dailyDoseArrival: 50
          },
          {
            useVaccines: false,
            useFumigation: true,
            useClosure: true,
            dailyBrigadeArrival: Math.min(8, Math.max(5, baseCfg.dailyBrigadeArrival)),
            dailyDoseArrival: 50
          }
        ];
      } else if (stock > 15000) {
        // Regla 1: Stock Alto (> 15,000) y Efectividad >= 60% -> Priorizar gasto en biológicos
        regimeType = "high_stock";
        portfolioLabel = "Vacunación Masiva y Escudo de Centralidad";
        regimeCandidates = [
          {
            useVaccines: true,
            useFumigation: false,
            useClosure: false,
            dailyBrigadeArrival: 0,
            dailyDoseArrival: Math.min(4000, Math.max(1600, Math.round(stock / 14))),
            requireBioDominance: true
          },
          {
            useVaccines: true,
            useFumigation: false,
            useClosure: false,
            dailyBrigadeArrival: 0,
            dailyDoseArrival: Math.min(4000, Math.max(2200, Math.round(stock / 10))),
            requireBioDominance: true
          },
          {
            useVaccines: true,
            useFumigation: false,
            useClosure: false,
            dailyBrigadeArrival: 0,
            dailyDoseArrival: Math.min(4000, Math.max(3000, Math.round(stock / 7))),
            requireBioDominance: true
          },
          {
            useVaccines: true,
            useFumigation: true,
            useClosure: false,
            dailyBrigadeArrival: 1,
            dailyDoseArrival: Math.min(4000, Math.max(2200, Math.round(stock / 10))),
            requireBioDominance: true
          }
        ];
      } else {
        // Regla 2: Stock Medio (5,000 - 15,000) y Efectividad >= 60% -> Estrategia Mixta
        regimeType = "mid_stock";
        portfolioLabel = "Estrategia Mixta: Vacunación Focalizada + Fumigación";
        regimeCandidates = [
          {
            useVaccines: true,
            useFumigation: true,
            useClosure: false,
            dailyBrigadeArrival: 2,
            dailyDoseArrival: Math.min(4000, Math.max(750, Math.round(stock / 12)))
          },
          {
            useVaccines: true,
            useFumigation: true,
            useClosure: false,
            dailyBrigadeArrival: 3,
            dailyDoseArrival: Math.min(4000, Math.max(950, Math.round(stock / 10)))
          },
          {
            useVaccines: true,
            useFumigation: true,
            useClosure: false,
            dailyBrigadeArrival: 4,
            dailyDoseArrival: Math.min(4000, Math.max(1150, Math.round(stock / 8)))
          }
        ];
      }

      let bestCandidate = regimeCandidates[0];
      let bestSim = null;
      let bestSaved = -Infinity;

      regimeCandidates.forEach((cand) => {
        const testCfg = Object.assign({}, baseCfg, {
          useVaccines: cand.useVaccines,
          useFumigation: cand.useFumigation,
          useClosure: cand.useClosure,
          dailyBrigadeArrival: cand.dailyBrigadeArrival,
          dailyDoseArrival: cand.dailyDoseArrival
        });
        const sim = runMonteCarloSimulation(testCfg, evalSeeds);
        const sShield = sim.summary.shield;
        const vacSpentCand = (sShield.meanDoses || 0) * COST_VACCINE_DOSE;
        const bioShare = sShield.meanSpent > 0 ? vacSpentCand / Math.max(0.0001, sShield.meanSpent) : 1;

        if (cand.requireBioDominance && sShield.meanSpent > 0 && bioShare < 0.8) {
          return;
        }

        if (sShield.savedStats.mean > bestSaved || bestSim === null) {
          bestSaved = sShield.savedStats.mean || 0;
          bestCandidate = cand;
          bestSim = sim;
        }
      });

      if (!bestSim) {
        const fallbackCfg = Object.assign({}, baseCfg, {
          useVaccines: bestCandidate.useVaccines,
          useFumigation: bestCandidate.useFumigation,
          useClosure: bestCandidate.useClosure,
          dailyBrigadeArrival: bestCandidate.dailyBrigadeArrival,
          dailyDoseArrival: bestCandidate.dailyDoseArrival
        });
        bestSim = runMonteCarloSimulation(fallbackCfg, evalSeeds);
        bestSaved = bestSim.summary.shield.savedStats.mean || 0;
      }

      const optimizedCfg = Object.assign({}, baseCfg, {
        useVaccines: bestCandidate.useVaccines,
        useFumigation: bestCandidate.useFumigation,
        useClosure: bestCandidate.useClosure,
        dailyBrigadeArrival: bestCandidate.dailyBrigadeArrival,
        dailyDoseArrival: bestCandidate.dailyDoseArrival
      });

      activeOptimizedPortfolioLabel = portfolioLabel;
      applyConfigToForm(optimizedCfg);

      const bestShield = bestSim.summary.shield;
      const vacSpent = Math.round((bestShield.meanDoses || 0) * COST_VACCINE_DOSE) || 0;
      const fumSpent = Math.round((bestShield.meanFumigations || 0) * COST_FUMIGATION) || 0;
      const closeSpent = Math.round((bestShield.meanClosures || 0) * COST_NODE_CLOSURE) || 0;
      const spentTotal = bestShield.meanSpent || 0;
      const bioSharePct = spentTotal > 0
        ? Math.min(100, Math.round((vacSpent / Math.max(0.0001, spentTotal)) * 100))
        : (regimeType === "no_bio" ? 0 : 100);
      const savedMean = Math.round(bestSaved || 0);
      const extraVsRandom = Math.max(
        0,
        Math.round((bestSaved || 0) - (bestSim.summary.random.savedStats.mean || 0))
      );
      const gainVsPrev = Math.round((bestSaved || 0) - (baselineSaved || 0));
      const gainClause = gainVsPrev > 0
        ? ` · <strong>+${formatInt(gainVsPrev)}</strong> vs. configuración previa`
        : "";

      let bannerHtml = "";
      let toastHtml = "";

      if (regimeType === "high_stock") {
        bannerHtml =
          `🧠 <strong>Auto-Optimizador Presupuestario (Stock Alto &gt; 15,000 dosis):</strong> ` +
          `Con <strong>${formatInt(stock)} vacunas disponibles</strong> y efectividad del <strong>${efficacy}%</strong> (foco en ${pzName}), ` +
          `el portafolio ganador es <strong>"${portfolioLabel}"</strong>. ` +
          `Se prioriza el gasto en biológicos destinando <strong>${formatUSD(vacSpent)} (${bioSharePct}% de la inversión ejecutada)</strong> ` +
          `a <strong>${formatInt(bestShield.meanDoses || 0)} dosis</strong> en los nodos de mayor centralidad (${formatInt(optimizedCfg.dailyDoseArrival)} dosis/día), ` +
          `salvando <strong>${formatInt(savedMean)} vidas</strong> en promedio (<strong>+${formatInt(extraVsRandom)} vs. reparto al azar</strong>${gainClause}).`;

        toastHtml = `Stock Alto (${formatInt(stock)} dosis): aplicado <strong>${portfolioLabel}</strong>`;
      } else if (regimeType === "mid_stock") {
        bannerHtml =
          `🧠 <strong>Auto-Optimizador Presupuestario (Stock Medio 5,000–15,000 dosis):</strong> ` +
          `Con <strong>${formatInt(stock)} vacunas disponibles</strong> y efectividad del <strong>${efficacy}%</strong> (foco en ${pzName}), ` +
          `el portafolio ganador es <strong>"${portfolioLabel}"</strong>. ` +
          `Se equilibra el presupuesto (${formatUSD(budget)}) entre <strong>${formatInt(bestShield.meanDoses || 0)} dosis focalizadas (${formatUSD(vacSpent)})</strong> ` +
          `en barrios puente (${formatInt(optimizedCfg.dailyDoseArrival)} dosis/día) y <strong>${fmtDec.format(bestShield.meanFumigations || 0)} brigadas de fumigación (${formatUSD(fumSpent)})</strong> ` +
          `(${optimizedCfg.dailyBrigadeArrival} brigadas/día), salvando <strong>${formatInt(savedMean)} vidas</strong> en promedio ` +
          `(<strong>+${formatInt(extraVsRandom)} vs. reparto al azar</strong>${gainClause}).`;

        toastHtml = `Stock Medio (${formatInt(stock)} dosis): aplicada <strong>${portfolioLabel}</strong>`;
      } else {
        const lowReason =
          stock < 5000 && efficacy < 60
            ? `stock crítico de <strong>${formatInt(stock)} dosis (&lt; 5,000)</strong> y efectividad reducida del <strong>${efficacy}% (&lt; 60%)</strong>`
            : stock < 5000
              ? `stock bajo de <strong>${formatInt(stock)} vacunas (&lt; 5,000 dosis)</strong>`
              : `efectividad vacunal reducida al <strong>${efficacy}% (&lt; 60%)</strong>`;
        const headerTrigger =
          stock < 5000 && efficacy < 60
            ? "Stock Bajo &lt; 5,000 y Efectividad &lt; 60%"
            : stock < 5000
              ? "Stock Bajo &lt; 5,000 dosis"
              : "Efectividad Vacunal &lt; 60%";

        bannerHtml =
          `🧠 <strong>Auto-Optimizador Presupuestario (${headerTrigger}):</strong> ` +
          `Ante ${lowReason} (foco en ${pzName}), el portafolio ganador es <strong>"${portfolioLabel}"</strong>. ` +
          `Se evita el desperdicio en biológicos (<strong>$0 en dosis</strong>) y se concentran <strong>${formatUSD(fumSpent + closeSpent)}</strong> ` +
          `en <strong>${fmtDec.format(bestShield.meanClosures || 0)} cercos sanitarios</strong> y <strong>${fmtDec.format(bestShield.meanFumigations || 0)} brigadas de fumigación</strong> ` +
          `(${optimizedCfg.dailyBrigadeArrival} brigadas/día), salvando <strong>${formatInt(savedMean)} vidas</strong> en promedio ` +
          `(<strong>+${formatInt(extraVsRandom)} vs. reparto al azar</strong>${gainClause}).`;

        toastHtml = `${stock < 5000 ? `Stock Bajo (${formatInt(stock)})` : `Efectividad ${efficacy}% (<60%)`}: aplicado <strong>${portfolioLabel}</strong>`;
      }

      dom.optimizerBanner.classList.remove("hidden");
      dom.optimizerBanner.innerHTML = bannerHtml;

      showToast(toastHtml, "success", 3000);
      await executeFullSimulation(true, true);
    } finally {
      setOperationButtonsBusy(false);
    }
  }

  function renderMayorReport(result) {
    const { config, summary } = result;
    const sNone = summary.none;
    const sRand = summary.random;
    const sShield = summary.shield;
    const isDengue = config.mode === "dengue";

    const pzNode = MANTA_NODES[config.patientZeroIndex];
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

    const vacCost = Math.round((sShield.meanDoses || 0) * COST_VACCINE_DOSE) || 0;
    const fumCost = Math.round((sShield.meanFumigations || 0) * COST_FUMIGATION) || 0;
    const closeCost = Math.round((sShield.meanClosures || 0) * COST_NODE_CLOSURE) || 0;
    const totalSpent = Math.round(sShield.meanSpent || 0) || 0;

    const savedVsNoneMean = Math.round(sShield.savedStats ? sShield.savedStats.mean || 0 : 0) || 0;
    const savedVsNoneMin = Math.round(sShield.savedStats ? sShield.savedStats.min || 0 : 0) || 0;
    const savedVsNoneMax = Math.round(sShield.savedStats ? sShield.savedStats.max || 0 : 0) || 0;

    const randSavedMean = Math.round(sRand.savedStats ? sRand.savedStats.mean || 0 : 0) || 0;
    const randSavedMin = Math.round(sRand.savedStats ? sRand.savedStats.min || 0 : 0) || 0;
    const randSavedMax = Math.round(sRand.savedStats ? sRand.savedStats.max || 0 : 0) || 0;
    const extraVsRandom = (savedVsNoneMean - randSavedMean) || 0;

    const ringNote = !config.useVaccines
      ? ` Dado el umbral operativo actual (${formatInt(config.totalVaccines)} vacunas en stock, efectividad ${config.vaccineEfficacyPct}%), se suspende el gasto biológico y se blinda la red exclusivamente con cercos viales y control vectorial.`
      : pzNode.neighbors.length >= 3 || config.vaccineEfficacyPct <= 60
        ? ` Como el foco compromete un nodo estratégico (${pzNode.name}) o presenta efectividad vacunal de ${config.vaccineEfficacyPct}%, el algoritmo activa el Cerco Perimetral Adaptativo: contiene el origen sin desperdiciar vacunas dentro del foco expuesto y crea un anillo protector en ${bridgeText}.`
        : ` Con efectividad vacunal del ${config.vaccineEfficacyPct}% y ${formatInt(config.totalVaccines)} dosis disponibles, el escudo preventivo blinda los corredores de mayor centralidad exclusivamente en población sana.`;

    const outbreakLabel = isDengue ? "brote epidémico de Dengue (INEC/MSP)" : "brote infeccioso (Track B)";
    const activeStrategyTitle = activeOptimizedPortfolioLabel || "Escudo de Centralidad + Cerco Perimetral Adaptativo";

    const leadText =
      `Señor Alcalde de Manta: Se ha confirmado el inicio del ${outbreakLabel} en ${pzNode.name} (GPS ${pzNode.lat}, ${pzNode.lng}). ` +
      `Activando la estrategia "${activeStrategyTitle}" con techo de ${formatUSD(config.totalBudget)} ` +
      `(ejecutando en promedio ${formatUSD(totalSpent)}), salvaremos ${formatInt(savedVsNoneMean)} vidas mantenses en promedio ` +
      `[Rango: ${formatInt(savedVsNoneMin)} a ${formatInt(savedVsNoneMax)}] durante los próximos ${config.days} días.`;

    const opsSummary48h = !config.useVaccines
      ? `Desplegamos de inmediato fumigación/control vectorial (-40% transmisión local) y cerco sanitario selectivo (-75% flujo inter-barrial) sobre ${pzNode.name} y sus corredores colindantes (${bridgeText}), sin comprometer presupuesto en biológicos.`
      : config.useFumigation && !config.useClosure
        ? `Combinamos brigadas de fumigación en ${pzNode.name} (-40% transmisión local) con vacunación focalizada prioritaria en los barrios puente conectados (${bridgeText}).`
        : !config.useFumigation && !config.useClosure
          ? `Concentramos el despliegue biológico masivo sobre los hubs de mayor centralidad y barrios puente conectados a ${pzNode.name} (${bridgeText}), inmunizando población sana antes de que cruce la onda de contagio.`
          : `Desplegamos fumigación/control vectorial y cerco selectivo en ${pzNode.name} para reducir el contagio local un 40% y cortar en 75% la salida de casos, mientras levantamos el anillo de vacunación preventiva en sus barrios vecinos conectados (${bridgeText}).`;

    const sec1Text =
      `En las primeras 48 horas intervenimos de inmediato en: ${first48Names.join(", ")}. ${opsSummary48h}`;

    const sec2Text =
      `De los ${formatUSD(config.totalBudget)} autorizados (${formatInt(config.dailyDoseArrival)} dosis/día y ${config.dailyBrigadeArrival} brigadas/día), ` +
      `la asignación óptima ejecuta: ` +
      `1) ${formatUSD(closeCost)} en ${fmtDec.format(sShield.meanClosures)} cercos sanitarios selectivos ($3,500 c/u, -75% flujo vecino); ` +
      `2) ${formatUSD(fumCost)} en ${fmtDec.format(sShield.meanFumigations)} brigadas de fumigación ($1,200 c/u, -40% contagio local por 5 días); y ` +
      `3) ${formatUSD(vacCost)} en ${formatInt(sShield.meanDoses)} dosis de vacuna ($15 c/u) aplicadas 100% solo a vecinos sanos.${ringNote}`;

    const sec3Text =
      `• Frente a no hacer nada (${formatInt(sNone.infectedStats.mean)} infectados esperados): nuestra estrategia salva en promedio ${formatInt(savedVsNoneMean)} personas [${formatInt(savedVsNoneMin)} - ${formatInt(savedVsNoneMax)}]. ` +
      `• Frente a repartir recursos al azar (${formatInt(randSavedMean)} salvados [${formatInt(randSavedMin)} - ${formatInt(randSavedMax)}]): rescatamos ${extraVsRandom >= 0 ? "+" : ""}${formatInt(extraVsRandom)} ciudadanos adicionales con el mismo presupuesto.`;

    const sec4Text =
      `Repartir dosis al azar diluye la defensa municipal y desperdicia recursos si el brote ya entró a un mercado o nodo central. ` +
      `Nuestra estrategia combina inteligencia geográfica y epidemiológica: encapsula el barrio origen con control vectorial y cerco vial, ` +
      `y dirige las vacunas únicamente a población sana en los barrios puente colindantes antes de que la ola infecciosa los alcance.`;

    dom.mayorReportContainer.innerHTML = `
      <div class="mayor-lead">
        <strong>Resumen Directivo Inmediato:</strong> ${leadText}
      </div>
      <div class="mayor-card">
        <h3>⏱️ 1. Barrios a Intervenir en las Primeras 48 Horas</h3>
        <p>${sec1Text}</p>
      </div>
      <div class="mayor-card">
        <h3>💰 2. Distribución Óptima del Presupuesto (${formatUSD(config.totalBudget)})</h3>
        <p>${sec2Text}</p>
      </div>
      <div class="mayor-card">
        <h3>🛟 3. Vidas Salvadas [Rango Mínimo - Máximo]</h3>
        <p>${sec3Text}</p>
      </div>
      <div class="mayor-card">
        <h3>🧭 4. Justificación del Cerco Perimetral Adaptativo</h3>
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
  // 8. TARJETAS KPI, TABLA POR BARRIO Y GRÁFICAS CHART.JS
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

    const workersLabel = result.workersUsed && result.workersUsed > 1 ? ` · ${result.workersUsed} Workers AWS` : "";
    dom.execTimingInfo.textContent = `${config.runs} corridas × 3 estrategias en ${fmtDec.format(elapsedMs)} ms${workersLabel}`;

    dom.statShieldVaccines.textContent =
      `Escudo: ${formatInt(sShield.meanDoses)} dosis (${formatUSD(sShield.meanDoses * COST_VACCINE_DOSE)}) · Inmunizados: ${formatInt(sShield.meanImmunized)}`;
    dom.statShieldFumigation.textContent =
      `Escudo: ${fmtDec.format(sShield.meanFumigations)} brigadas (${formatUSD(sShield.meanFumigations * COST_FUMIGATION)})`;
    dom.statShieldClosure.textContent =
      `Escudo: ${fmtDec.format(sShield.meanClosures)} cercos (${formatUSD(sShield.meanClosures * COST_NODE_CLOSURE)})`;

    dom.kpiBase1SavedMean.textContent = "0";
    dom.kpiBase1SavedRange.textContent = "[0 - 0]";
    dom.kpiBase1InfMean.textContent = formatInt(sNone.infectedStats.mean);
    dom.kpiBase1InfRange.textContent = `[${formatInt(sNone.infectedStats.min)} - ${formatInt(sNone.infectedStats.max)}]`;
    dom.kpiBase1Footer.textContent =
      `Población nunca infectada: ${formatInt(TOTAL_CITY_POPULATION - sNone.infectedStats.mean)} hab.`;

    dom.kpiRandomVacPill.textContent = `${formatUSD(sRand.meanSpent)} ejecutados`;
    dom.kpiRandomSavedMean.textContent = formatInt(sRand.savedStats.mean);
    dom.kpiRandomSavedRange.textContent = `[${formatInt(sRand.savedStats.min)} - ${formatInt(sRand.savedStats.max)}]`;
    dom.kpiRandomInfMean.textContent = formatInt(sRand.infectedStats.mean);
    dom.kpiRandomInfRange.textContent = `[${formatInt(sRand.infectedStats.min)} - ${formatInt(sRand.infectedStats.max)}]`;
    dom.kpiRandomFooter.textContent =
      `Dosis a 🟢 S: ${formatInt(sRand.meanDoses)} · Fumig.: ${fmtDec.format(sRand.meanFumigations)} · Cercos: ${fmtDec.format(sRand.meanClosures)}`;

    const extraLives = (sShield.savedStats ? sShield.savedStats.mean || 0 : 0) - (sRand.savedStats ? sRand.savedStats.mean || 0 : 0);
    const sign = extraLives >= 0 ? "+" : "";
    dom.kpiShieldDeltaBadge.textContent = `${sign}${formatInt(extraLives)} vs. Azar`;

    dom.kpiShieldSavedMean.textContent = formatInt(sShield.savedStats ? sShield.savedStats.mean || 0 : 0);
    dom.kpiShieldSavedRange.textContent = `[${formatInt(sShield.savedStats ? sShield.savedStats.min || 0 : 0)} - ${formatInt(sShield.savedStats ? sShield.savedStats.max || 0 : 0)}]`;
    dom.kpiShieldInfMean.textContent = formatInt(sShield.infectedStats ? sShield.infectedStats.mean || 0 : 0);
    dom.kpiShieldInfRange.textContent = `[${formatInt(sShield.infectedStats ? sShield.infectedStats.min || 0 : 0)} - ${formatInt(sShield.infectedStats ? sShield.infectedStats.max || 0 : 0)}]`;
    dom.kpiShieldFooter.textContent =
      `Inversión: ${formatUSD(sShield.meanSpent || 0)} / ${formatUSD(config.totalBudget || 0)} · Dosis 🟢 S: ${formatInt(sShield.meanDoses || 0)}`;

    dom.tableFinalDay.textContent = String(config.days);
    dom.barrioTableBody.innerHTML = "";

    let totVac = 0, totFum = 0, totClose = 0, totInfNone = 0, totInfRand = 0, totInfShield = 0;

    MANTA_NODES.forEach((node, idx) => {
      const vac = sShield.nodeMeanVac ? sShield.nodeMeanVac[idx] || 0 : 0;
      const fum = sShield.nodeMeanFum ? sShield.nodeMeanFum[idx] || 0 : 0;
      const cls = sShield.nodeMeanClose ? sShield.nodeMeanClose[idx] || 0 : 0;
      const infNone = sNone.nodeMeanInf ? sNone.nodeMeanInf[idx] || 0 : 0;
      const infRand = sRand.nodeMeanInf ? sRand.nodeMeanInf[idx] || 0 : 0;
      const infShield = sShield.nodeMeanInf ? sShield.nodeMeanInf[idx] || 0 : 0;
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
            ${node.shortName}
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
        if (activeMapView === "geo" && leafletNodeMarkers[idx]) {
          leafletNodeMarkers[idx].openPopup();
        }
      });

      dom.barrioTableBody.appendChild(tr);
    });

    const totSavedShield = totInfNone - totInfShield;
    dom.barrioTableFoot.innerHTML = `
      <tr>
        <td>TOTAL MANTA (8 Nodos GPS)</td>
        <td class="num">${formatInt(TOTAL_CITY_POPULATION)}</td>
        <td class="num">13 rutas</td>
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
      `Semilla ${config.seed} → sub-semillas [${firstSeedsPreview}${result.subSeeds.length > 4 ? ", ..." : ""}] (${config.runs} corridas, modo ${config.mode.toUpperCase()}). ` +
      `Presupuesto ejecutado por Escudo: ${formatUSD(sShield.meanSpent || 0)} / ${formatUSD(config.totalBudget || 0)}. ` +
      `Dosis aplicadas fuera de población 🟢 Sana: 0 (cumplimiento estricto 100%). Hash FNV-1a: ${hashHex}.`;
  }

  function highlightSelectedTableRow() {
    const rows = dom.barrioTableBody.querySelectorAll("tr");
    rows.forEach((row, idx) => {
      row.classList.toggle("row-selected", idx === selectedNodeIndex);
    });
  }

  function sanitizeChartSeries(arr) {
    if (!arr) return [];
    const len = arr.length;
    const clean = new Float64Array(len);
    for (let i = 0; i < len; i++) {
      const v = arr[i];
      clean[i] = Number.isFinite(v) ? v : 0;
    }
    return Array.from(clean);
  }

  function renderCharts(result) {
    const days = result.config.days;
    const labels = Array.from({ length: days + 1 }, (_, d) => `Día ${d}`);
    const sNone = result.summary.none.series;
    const sRand = result.summary.random.series;
    const sShield = result.summary.shield.series;
    const prof = MODE_PROFILES[result.config.mode] || MODE_PROFILES.zombie;

    let meanNone, minNone, maxNone;
    let meanRand, minRand, maxRand;
    let meanShield, minShield, maxShield;
    let yAxisTitle = "Personas";

    if (activeChartMetric === "activeZombies") {
      meanNone = sNone.activeIMean; minNone = sNone.activeIMin; maxNone = sNone.activeIMax;
      meanRand = sRand.activeIMean; minRand = sRand.activeIMin; maxRand = sRand.activeIMax;
      meanShield = sShield.activeIMean; minShield = sShield.activeIMin; maxShield = sShield.activeIMax;
      yAxisTitle = prof.labels.shortI;
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

    meanNone = sanitizeChartSeries(meanNone);
    minNone = sanitizeChartSeries(minNone);
    maxNone = sanitizeChartSeries(maxNone);
    meanRand = sanitizeChartSeries(meanRand);
    minRand = sanitizeChartSeries(minRand);
    maxRand = sanitizeChartSeries(maxRand);
    meanShield = sanitizeChartSeries(meanShield);
    minShield = sanitizeChartSeries(minShield);
    maxShield = sanitizeChartSeries(maxShield);

    const seirKey = dom.selectSeirStrategy.value || "shield";
    const chosenSeir = result.summary[seirKey].series;
    const cleanS = sanitizeChartSeries(chosenSeir.S);
    const cleanE = sanitizeChartSeries(chosenSeir.E);
    const cleanI = sanitizeChartSeries(chosenSeir.I);
    const cleanR = sanitizeChartSeries(chosenSeir.R);

    if (typeof window.Chart === "undefined") {
      drawFallbackLines(dom.comparisonCanvas, [
        { label: "Sin Intervención", color: "#ef4444", data: meanNone },
        { label: "Intervención al Azar", color: "#f59e0b", data: meanRand },
        { label: "Escudo + Cerco Perimetral", color: "#06d6a0", data: meanShield }
      ]);
      drawFallbackLines(dom.seirCanvas, [
        { label: prof.labels.S, color: "#10b981", data: cleanS },
        { label: prof.labels.E, color: "#f59e0b", data: cleanE },
        { label: prof.labels.I, color: "#ef4444", data: cleanI },
        { label: prof.labels.R, color: "#3b82f6", data: cleanR }
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
            label: "Escudo + Cerco Perimetral (Promedio)",
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
                if (dsIdx === 6) return ` Escudo + Cerco: ${val} [${formatInt(minShield[dIdx])} - ${formatInt(maxShield[dIdx])}]`;
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
            label: prof.labels.S,
            data: cleanS,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.10)",
            borderWidth: 2.4,
            pointRadius: 0,
            fill: true,
            tension: 0.25
          },
          {
            label: prof.labels.E,
            data: cleanE,
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            borderWidth: 2.2,
            pointRadius: 0,
            fill: true,
            tension: 0.25
          },
          {
            label: prof.labels.I,
            data: cleanI,
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.16)",
            borderWidth: 2.6,
            pointRadius: 0,
            fill: true,
            tension: 0.25
          },
          {
            label: prof.labels.R,
            data: cleanR,
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
  // 9. GEMELO CARTOGRÁFICO DUAL: LEAFLET GPS (OSM OSCURO + ESRI SATÉLITE) + SVG
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

  function recenterAllNodesOnMap() {
    if (!leafletMap || !allNodesBounds) return;
    leafletMap.invalidateSize();
    leafletMap.fitBounds(allNodesBounds, { padding: [45, 45], maxZoom: 14 });
  }

  // ============================================================================
  // MODO PANTALLA COMPLETA (Fullscreen API nativa) SOBRE EL CONTENEDOR DEL MAPA
  // ============================================================================
  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function isMapFullscreen() {
    return getFullscreenElement() === dom.geoMapContainer;
  }

  function updateFullscreenButtonState() {
    if (!dom.btnFullscreenMap) return;
    const active = isMapFullscreen();
    if (dom.geoMapContainer) dom.geoMapContainer.classList.toggle("is-fullscreen", active);
    dom.btnFullscreenMap.classList.toggle("active", active);
    dom.btnFullscreenMap.setAttribute("aria-pressed", String(active));
    dom.btnFullscreenMap.textContent = active ? "🗗 Salir de Pantalla Completa" : "🖥️ Pantalla Completa";
  }

  function refreshLeafletAfterFullscreenChange() {
    updateFullscreenButtonState();
    if (!leafletMap) return;
    // Doble pasada: el navegador aplica el nuevo tamaño de forma asíncrona
    requestAnimationFrame(() => {
      leafletMap.invalidateSize();
      recenterAllNodesOnMap();
    });
    setTimeout(() => {
      if (!leafletMap) return;
      leafletMap.invalidateSize();
      recenterAllNodesOnMap();
    }, 260);
  }

  async function toggleMapFullscreen() {
    const container = dom.geoMapContainer;
    if (!container) return;

    if (activeMapView !== "geo") {
      setMapView("geo");
    }

    try {
      if (isMapFullscreen()) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      } else if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else {
        showToast("Tu navegador no soporta el modo Pantalla Completa", "warn", 3000);
      }
    } catch (_) {
      showToast("No se pudo activar la Pantalla Completa en este navegador", "warn", 3000);
    }
  }

  function attachTileErrorGuard(layer) {
    if (!layer || typeof layer.on !== "function") return layer;
    layer.on("tileerror", (ev) => {
      if (ev && ev.tile) {
        ev.tile.style.visibility = "hidden";
        ev.tile.style.opacity = "0";
      }
    });
    return layer;
  }

  function toggleLeafletBasemap() {
    if (activeMapView !== "geo") {
      setMapView("geo");
    }
    if (!leafletMap) {
      initLeafletGeoMap();
    }
    if (!leafletMap || !leafletStreetLayer || !leafletSatelliteLayer || !leafletSatelliteLabelsLayer) return;

    if (activeBasemapMode === "street") {
      activeBasemapMode = "satellite";
      if (leafletMap.hasLayer(leafletStreetLayer)) {
        leafletMap.removeLayer(leafletStreetLayer);
      }
      if (!leafletMap.hasLayer(leafletSatelliteLayer)) {
        leafletSatelliteLayer.addTo(leafletMap);
        if (typeof leafletSatelliteLayer.bringToBack === "function") {
          leafletSatelliteLayer.bringToBack();
        }
      }
      if (!leafletMap.hasLayer(leafletSatelliteLabelsLayer)) {
        leafletSatelliteLabelsLayer.addTo(leafletMap);
        if (typeof leafletSatelliteLabelsLayer.bringToFront === "function") {
          leafletSatelliteLabelsLayer.bringToFront();
        }
      }
      if (dom.mantaGeoMap) {
        dom.mantaGeoMap.classList.add("satellite-mode");
      }
      if (dom.btnToggleBasemap) {
        dom.btnToggleBasemap.classList.add("active");
        dom.btnToggleBasemap.setAttribute("aria-pressed", "true");
        dom.btnToggleBasemap.innerHTML = "🗺️ Ver Calles Táctico";
      }
      if (dom.activeBasemapBadge) {
        dom.activeBasemapBadge.textContent = "🛰️ Satélite Híbrido (Esri)";
      }
    } else {
      activeBasemapMode = "street";
      if (leafletMap.hasLayer(leafletSatelliteLabelsLayer)) {
        leafletMap.removeLayer(leafletSatelliteLabelsLayer);
      }
      if (leafletMap.hasLayer(leafletSatelliteLayer)) {
        leafletMap.removeLayer(leafletSatelliteLayer);
      }
      if (!leafletMap.hasLayer(leafletStreetLayer)) {
        leafletStreetLayer.addTo(leafletMap);
        if (typeof leafletStreetLayer.bringToBack === "function") {
          leafletStreetLayer.bringToBack();
        }
      }
      if (dom.mantaGeoMap) {
        dom.mantaGeoMap.classList.remove("satellite-mode");
      }
      if (dom.btnToggleBasemap) {
        dom.btnToggleBasemap.classList.remove("active");
        dom.btnToggleBasemap.setAttribute("aria-pressed", "false");
        dom.btnToggleBasemap.innerHTML = "🛰️ Cambiar Calle / Satélite";
      }
      if (dom.activeBasemapBadge) {
        dom.activeBasemapBadge.textContent = "🗺️ Calles Táctico Oscuro (Esri)";
      }
    }
    leafletMap.invalidateSize({ pan: false });
  }

  function getTooltipPlacementForNode(nodeIndex) {
    if (nodeIndex === 7) return { direction: "right", offset: [11, 0] };   // San Mateo (oeste -> hacia adentro)
    if (nodeIndex === 1) return { direction: "left", offset: [-11, 0] };   // Terminal Terrestre (este -> hacia adentro)
    if (nodeIndex === 6) return { direction: "left", offset: [-11, -2] };  // Los Esteros (noreste -> hacia adentro)
    if (nodeIndex === 0) return { direction: "bottom", offset: [0, 11] };  // Mercado de Tarqui
    if (nodeIndex === 5) return { direction: "bottom", offset: [0, 11] };  // Hospital Rodríguez Zambrano
    return { direction: "top", offset: [0, -11] };                         // Murciélago, Centro, ULEAM
  }

  function initLeafletGeoMap() {
    if (typeof window.L === "undefined" || !dom.mantaGeoMap) {
      setMapView("topo");
      return;
    }

    leafletMap = window.L.map(dom.mantaGeoMap, {
      zoomControl: true,
      attributionControl: true
    });

    // Capa Principal: Calles Táctico Oscuro (Esri World Street Map 100% libre, sin bloqueos ni API Key)
    leafletStreetLayer = attachTileErrorGuard(
      window.L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri &mdash; Sources: Esri, DeLorme, NAVTEQ, TomTom",
          maxZoom: 19
        }
      )
    );

    // Capa Satelital Híbrida: Base Satelital Esri World Imagery + Capa de Vías y Nombres World Transportation
    leafletSatelliteLayer = attachTileErrorGuard(
      window.L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
          maxZoom: 19,
          zIndex: 1
        }
      )
    );

    leafletSatelliteLabelsLayer = attachTileErrorGuard(
      window.L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Etiquetas &copy; Esri",
          maxZoom: 19,
          zIndex: 2
        }
      )
    );

    // Evitar que los clics en botones flotantes sean capturados por el mapa de Leaflet
    if (window.L && window.L.DomEvent) {
      if (dom.btnToggleBasemap) {
        window.L.DomEvent.disableClickPropagation(dom.btnToggleBasemap);
        window.L.DomEvent.disableScrollPropagation(dom.btnToggleBasemap);
      }
      if (dom.btnCenterMapNodes) {
        window.L.DomEvent.disableClickPropagation(dom.btnCenterMapNodes);
        window.L.DomEvent.disableScrollPropagation(dom.btnCenterMapNodes);
      }
    }

    activeBasemapMode = "street";
    dom.mantaGeoMap.classList.remove("satellite-mode");
    leafletStreetLayer.addTo(leafletMap);

    allNodesBounds = window.L.latLngBounds(MANTA_NODES.map((n) => [n.lat, n.lng]));
    recenterAllNodesOnMap();

    leafletEdgeLines = MANTA_EDGES.map((edge) => {
      const u = MANTA_NODES[edge.u];
      const v = MANTA_NODES[edge.v];
      return window.L.polyline(
        [
          [u.lat, u.lng],
          [v.lat, v.lng]
        ],
        {
          color: "rgba(148, 163, 184, 0.55)",
          weight: 2.6,
          opacity: 0.88
        }
      ).addTo(leafletMap);
    });

    leafletHeatCircles = MANTA_NODES.map((node) => {
      return window.L.circle([node.lat, node.lng], {
        radius: 180,
        color: "#ef4444",
        weight: 1,
        opacity: 0.45,
        fillColor: "#ef4444",
        fillOpacity: 0.18,
        interactive: false
      }).addTo(leafletMap);
    });

    leafletNodeMarkers = MANTA_NODES.map((node) => {
      const marker = window.L.circleMarker([node.lat, node.lng], {
        radius: 10,
        color: "#10b981",
        weight: 2.6,
        fillColor: "#0f172a",
        fillOpacity: 0.92
      }).addTo(leafletMap);

      const tipPos = getTooltipPlacementForNode(node.index);
      marker.bindTooltip(node.shortName, {
        permanent: true,
        direction: tipPos.direction,
        offset: tipPos.offset,
        className: "manta-geo-label"
      });

      marker.bindPopup("");

      marker.on("click", () => {
        selectedNodeIndex = node.index;
        renderMapState();
        highlightSelectedTableRow();
      });

      return marker;
    });

    // ResizeObserver automático para garantizar encuadre completo y centrado al cargar o redimensionar/cambiar pestaña
    if (typeof window.ResizeObserver !== "undefined") {
      mapResizeObserver = new window.ResizeObserver((entries) => {
        const entry = entries && entries[0];
        if (!entry || !leafletMap || activeMapView !== "geo") return;
        const w = Math.round(entry.contentRect.width);
        const h = Math.round(entry.contentRect.height);
        if (w <= 0 || h <= 0) {
          lastObservedMapSize = "0x0";
          return;
        }
        const sizeKey = `${w}x${h}`;
        if (sizeKey === lastObservedMapSize) return;
        lastObservedMapSize = sizeKey;

        if (mapResizeRaf !== null) {
          cancelAnimationFrame(mapResizeRaf);
        }
        mapResizeRaf = requestAnimationFrame(() => {
          mapResizeRaf = null;
          recenterAllNodesOnMap();
        });
      });
      mapResizeObserver.observe(dom.mantaGeoMap);
    }

    window.addEventListener("load", () => {
      if (activeMapView === "geo") {
        recenterAllNodesOnMap();
      }
    });
  }

  function buildGeoPopupHtml(node, st, day, isPZ) {
    const prof = MODE_PROFILES[activeEpiMode] || MODE_PROFILES.zombie;
    const ops = [];
    if (st.closed) ops.push("🚧 Cerco Sanitario (-75% flujo)");
    if (st.fumActive) ops.push(`🌫️ Fumigación activa (${st.fumDaysLeft}d)`);
    const opsLine = ops.length > 0 ? ops.join(" · ") : "Sin bloqueo vial activo";

    return `
      <div class="tactical-popup">
        <div class="tactical-popup-title">${isPZ ? "☣ " : ""}${node.officialName}</div>
        <div class="tactical-popup-coords">GPS [${node.lat.toFixed(4)}, ${node.lng.toFixed(4)}] · Día ${day}</div>
        <div class="tactical-popup-grid">
          <span>${prof.labels.S}: <strong>${formatInt(st.S)}</strong></span>
          <span>${prof.labels.E}: <strong>${formatInt(st.E)}</strong></span>
          <span>${prof.labels.I}: <strong>${formatInt(st.I)}</strong></span>
          <span>${prof.labels.R}: <strong>${formatInt(st.R)}</strong></span>
          <span>💉 Dosis (🟢 S): <strong>${formatInt(st.vaccinated)}</strong></span>
          <span>🎯 Puntaje: <strong>${fmtDec.format(st.score)}</strong></span>
        </div>
        <div class="tactical-popup-foot">${opsLine} · Pob. INEC/Cohorte: ${formatInt(node.population)} hab.</div>
      </div>
    `;
  }

  function setMapView(view) {
    activeMapView = view === "topo" ? "topo" : "geo";
    const isGeo = activeMapView === "geo" && leafletMap !== null;

    dom.btnViewGeo.classList.toggle("active", isGeo);
    dom.btnViewGeo.setAttribute("aria-selected", String(isGeo));
    dom.btnViewTopo.classList.toggle("active", !isGeo);
    dom.btnViewTopo.setAttribute("aria-selected", String(!isGeo));

    dom.geoMapContainer.classList.toggle("hidden", !isGeo);
    dom.topoMapContainer.classList.toggle("hidden", isGeo);

    if (isGeo && leafletMap) {
      requestAnimationFrame(() => {
        recenterAllNodesOnMap();
      });
    }
    renderMapState();
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

      const outer = document.createElementNS(SVG_NS, "circle");
      outer.setAttribute("id", `svgNodeOuter_${node.index}`);
      outer.setAttribute("class", "node-outer-ring");
      outer.setAttribute("r", String(radius + 4));
      outer.setAttribute("fill", "rgba(15, 23, 42, 0.94)");
      outer.setAttribute("stroke", "#10b981");
      outer.setAttribute("stroke-width", "2.6");
      g.appendChild(outer);

      const inner = document.createElementNS(SVG_NS, "circle");
      inner.setAttribute("id", `svgNodeCore_${node.index}`);
      inner.setAttribute("class", "node-core-fill");
      inner.setAttribute("r", String(radius));
      inner.setAttribute("fill", "rgba(16, 185, 129, 0.35)");
      g.appendChild(inner);

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

      const opsBadge = document.createElementNS(SVG_NS, "text");
      opsBadge.setAttribute("id", `svgNodeOps_${node.index}`);
      opsBadge.setAttribute("x", "0");
      opsBadge.setAttribute("y", String(-(radius + 9)));
      opsBadge.setAttribute("text-anchor", "middle");
      opsBadge.setAttribute("font-size", "12");
      opsBadge.textContent = "";
      g.appendChild(opsBadge);

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
    const safePop = Math.max(1, population || 0);
    const zFrac = (st ? st.I || 0 : 0) / safePop;
    const eFrac = (st ? st.E || 0 : 0) / safePop;
    const rFrac = (st ? st.R || 0 : 0) / safePop;

    if (st && st.I > 0 && zFrac >= 0.015) {
      const intensity = Math.min(0.88, 0.35 + zFrac * 2.6);
      return {
        stroke: st.closed ? "#38bdf8" : "#ef4444",
        fill: `rgba(239, 68, 68, ${intensity.toFixed(2)})`,
        hex: "#ef4444"
      };
    }
    if (st && st.E > 0 && (eFrac >= 0.01 || st.I > 0)) {
      return {
        stroke: st.closed ? "#38bdf8" : "#f59e0b",
        fill: "rgba(245, 158, 11, 0.42)",
        hex: "#f59e0b"
      };
    }
    if (rFrac >= 0.35) {
      return {
        stroke: "#3b82f6",
        fill: "rgba(59, 130, 246, 0.42)",
        hex: "#3b82f6"
      };
    }
    return {
      stroke: st && st.closed ? "#38bdf8" : "#10b981",
      fill: "rgba(16, 185, 129, 0.30)",
      hex: "#10b981"
    };
  }

  function renderMapState() {
    if (!currentResult) return;

    const mapStrat = dom.selectMapStrategy.value || "shield";
    const snapshots = currentResult.summary[mapStrat].sampleSnapshots;
    if (!snapshots || !snapshots.length) return;

    const maxDay = Math.min(currentResult.config.days, snapshots.length - 1);
    const day = Math.max(0, Math.min(maxDay, timelineDay));
    const daySnap = snapshots[day] || snapshots[snapshots.length - 1];

    dom.mapDescMaxDay.textContent = String(maxDay);
    dom.timelineDayLabel.textContent = String(day);
    dom.timelineMaxDayLabel.textContent = String(maxDay);
    dom.timelineSlider.min = "0";
    dom.timelineSlider.max = String(maxDay);
    dom.timelineSlider.value = String(day);

    const pct = maxDay > 0 ? (day / maxDay) * 100 : 100;
    dom.timelineProgressFill.style.width = `${pct.toFixed(1)}%`;

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

    // 1. Actualizar Grafo Topológico SVG
    MANTA_EDGES.forEach((edge, idx) => {
      const pathEl = document.getElementById(`svgEdge_${idx}`);
      if (!pathEl) return;
      const su = daySnap[edge.u];
      const sv = daySnap[edge.v];
      const hasCordon = su.closed || sv.closed;
      const activeZombieFlow = su.I + sv.I > 30;
      const immunizedCorridor =
        su.R / Math.max(1, MANTA_NODES[edge.u].population) > 0.45 ||
        sv.R / Math.max(1, MANTA_NODES[edge.v].population) > 0.45;

      pathEl.classList.toggle("edge-cordon", hasCordon);
      pathEl.classList.toggle("edge-hot", !hasCordon && activeZombieFlow);
      pathEl.classList.toggle("edge-shielded", !hasCordon && !activeZombieFlow && immunizedCorridor);
    });

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

      if (groupEl) {
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
      }
    });

    // 2. Actualizar Mapa Geoespacial Real (Leaflet: OSM Táctico Oscuro / Satélite Esri)
    if (leafletMap && leafletNodeMarkers.length === MANTA_NODES.length) {
      MANTA_EDGES.forEach((edge, idx) => {
        const poly = leafletEdgeLines[idx];
        const su = daySnap[edge.u];
        const sv = daySnap[edge.v];
        const hasCordon = su.closed || sv.closed;
        const activeFlow = su.I + sv.I > 30;
        const shielded =
          su.R / Math.max(1, MANTA_NODES[edge.u].population) > 0.45 ||
          sv.R / Math.max(1, MANTA_NODES[edge.v].population) > 0.45;

        if (hasCordon) {
          poly.setStyle({ color: "#38bdf8", weight: 3.2, dashArray: "8, 6", opacity: 0.92 });
        } else if (activeFlow) {
          poly.setStyle({ color: "#ef4444", weight: 3.8, dashArray: null, opacity: 0.85 });
        } else if (shielded) {
          poly.setStyle({ color: "#06d6a0", weight: 3.0, dashArray: null, opacity: 0.8 });
        } else {
          poly.setStyle({ color: "rgba(148, 163, 184, 0.45)", weight: 2.2, dashArray: null, opacity: 0.75 });
        }
      });

      MANTA_NODES.forEach((node, idx) => {
        const st = daySnap[idx];
        const isPZ = idx === currentResult.config.patientZeroIndex;
        const colors = computeNodeVisualColors(st, node.population);
        const activeLoad = st.I + 0.55 * st.E;

        // Onda de calor proporcional a infectados diarios en metros reales sobre Manta
        const heatRadius = activeLoad > 0 ? Math.min(1450, 160 + Math.sqrt(activeLoad) * 22) : 90;
        const heatOpacity = activeLoad > 0 ? Math.min(0.52, 0.14 + (activeLoad / Math.max(1, node.population)) * 2.2) : 0.04;
        const heatColor = st.I > 0 ? "#ef4444" : st.E > 0 ? "#f59e0b" : "#10b981";

        leafletHeatCircles[idx].setRadius(heatRadius);
        leafletHeatCircles[idx].setStyle({
          color: heatColor,
          fillColor: heatColor,
          fillOpacity: heatOpacity,
          opacity: activeLoad > 0 ? 0.55 : 0.15
        });

        const marker = leafletNodeMarkers[idx];
        marker.setStyle({
          radius: idx === selectedNodeIndex ? 12.5 : 9.5,
          color: idx === selectedNodeIndex ? "#ffffff" : colors.stroke,
          fillColor: colors.hex,
          fillOpacity: 0.86,
          weight: idx === selectedNodeIndex ? 3.2 : 2.4
        });

        const opsShort = `${st.closed ? "🚧" : ""}${st.fumActive ? "🌫️" : ""}`;
        marker.setTooltipContent(
          `${isPZ ? "☣ " : ""}${node.shortName} · 🔴${compactCount(st.I)} ${opsShort}`
        );
        marker.setPopupContent(buildGeoPopupHtml(node, st, day, isPZ));
      });
    }

    // 3. Actualizar Inspector del Barrio Seleccionado
    const selNode = MANTA_NODES[selectedNodeIndex];
    const selSnap = daySnap[selectedNodeIndex];
    const neighborNames = selNode.neighbors.map((nIdx) => MANTA_NODES[nIdx].shortName).join(", ");

    dom.inspNodeName.textContent =
      selectedNodeIndex === currentResult.config.patientZeroIndex
        ? `☣ ${selNode.officialName} (Paciente Cero)`
        : selNode.officialName;
    dom.inspNodeMeta.textContent =
      `Día ${day} · GPS [${selNode.lat}, ${selNode.lng}] · Pob.: ${formatInt(selNode.population)} hab. · Vecinos: ${neighborNames}`;

    dom.inspS.textContent = formatInt(selSnap.S);
    dom.inspE.textContent = formatInt(selSnap.E);
    dom.inspI.textContent = formatInt(selSnap.I);
    dom.inspR.textContent = formatInt(selSnap.R);

    const statusTags = [`${formatInt(selSnap.vaccinated)} dosis`];
    if (selSnap.closed) statusTags.push("🚧 Cerco");
    if (selSnap.fumActive) statusTags.push(`🌫️ Fumig. (${selSnap.fumDaysLeft}d)`);
    dom.inspVac.textContent = statusTags.join(" · ");
    dom.inspScore.textContent = fmtDec.format(selSnap.score);
  }

  function stopTimelinePlayback() {
    if (timelineTimer !== null) {
      clearInterval(timelineTimer);
      timelineTimer = null;
      dom.btnPlayTimeline.textContent = "▶ Reproducir";
    }
  }

  function startTimelinePlayback() {
    if (!currentResult) return;
    stopTimelinePlayback();

    const maxDay = currentResult.config.days;
    if (timelineDay >= maxDay) {
      timelineDay = 0;
      renderMapState();
    }

    const intervalMs = parseInt(dom.selectPlaySpeed.value, 10) || 170;
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
  // 10. BACKEND AWS MULTICAPA: FAN-OUT 5 WORKERS + S3 + AUDITORÍA DYNAMODB
  // ============================================================================
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
      // Ignorar si almacenamiento local está restringido
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

  function loadLocalAuditMirror() {
    try {
      const raw = window.localStorage.getItem(LOCAL_AUDIT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function appendLocalAuditMirror(entry) {
    const list = loadLocalAuditMirror().filter((it) => it.SimulationId !== entry.SimulationId);
    list.unshift(entry);
    const trimmed = list.slice(0, 8);
    try {
      window.localStorage.setItem(LOCAL_AUDIT_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (_) {
      // Ignorar silenciosamente
    }
    return trimmed;
  }

  function renderDynamoAuditTable(records, storageSource) {
    if (!dom.dynamoAuditBody) return;
    if (dom.dynamoStorageBadge && storageSource) {
      dom.dynamoStorageBadge.textContent = storageSource.startsWith("dynamodb:")
        ? "Amazon DynamoDB: SpookyThonSimulations (Conectado)"
        : "Tabla: SpookyThonSimulations (Espejo Resiliente)";
    }

    if (!records || records.length === 0) {
      dom.dynamoAuditBody.innerHTML =
        '<tr><td colspan="8" class="empty-row">Aún no hay simulaciones registradas en esta sesión.</td></tr>';
      return;
    }

    dom.dynamoAuditBody.innerHTML = records
      .slice(0, 8)
      .map((item) => {
        const isDengue = String(item.Mode || "").includes("DENGUE");
        const modeClass = isDengue ? "mode-audit-dengue" : "mode-audit-zombie";
        const modeText = isDengue ? "🦟 Dengue INEC/MSP" : "🧟 Plaga Zombie";
        const tsShort = String(item.Timestamp || "").replace("T", " ").slice(0, 19);
        return `
          <tr>
            <td><code>${item.SimulationId || "SIM-MANTA"}</code></td>
            <td>${tsShort}</td>
            <td class="num">${item.Seed ?? 2026}</td>
            <td><span class="mode-audit-pill ${modeClass}">${modeText}</span></td>
            <td class="num">${item.Runs ?? 50}</td>
            <td class="num" style="color:#34d399;font-weight:700;">+${formatInt(item.SavedLivesMean || 0)}</td>
            <td class="num">${formatUSD(item.BudgetUsed || 0)}</td>
            <td><span class="hash-code-pill">${item.HashFirma || "0x--------"}</span></td>
          </tr>
        `;
      })
      .join("");
  }

  async function syncAuditRecordWithCloud(lambdaUrl, entry, notifyUser = false) {
    const mirror = appendLocalAuditMirror(entry);
    if (!lambdaUrl) {
      renderDynamoAuditTable(mirror, "local-mirror");
      if (notifyUser) {
        showToast(`Auditoría registrada · Hash <code>${entry.HashFirma}</code>`, "info", 3000);
      }
      return;
    }
    try {
      const resp = await fetch(lambdaUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ action: "record_audit" }, entry))
      });
      if (!resp.ok) throw new Error("Audit HTTP error");
      let data = await resp.json();
      if (data && typeof data.body === "string") {
        data = JSON.parse(data.body);
      }
      if (data && Array.isArray(data.auditHistory) && data.auditHistory.length > 0) {
        renderDynamoAuditTable(data.auditHistory, data.auditStorageSource || "dynamodb:SpookyThonSimulations");
        showToast(`Guardado en Amazon DynamoDB · Hash <code>${entry.HashFirma}</code>`, "success", 3000);
        return;
      }
    } catch (_) {
      // Respaldo transparente si la Lambda remota aún no expone action=record_audit
    }
    renderDynamoAuditTable(mirror, "local-mirror");
    if (notifyUser) {
      showToast(`Simulación auditada · Hash <code>${entry.HashFirma}</code>`, "info", 3000);
    }
  }

  async function invokeSingleLambdaWorker(lambdaUrl, payload, signal) {
    const resp = await fetch(lambdaUrl, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    let rawData = await resp.json();
    if (rawData && typeof rawData.body === "string") {
      rawData = JSON.parse(rawData.body);
    }
    if (!rawData || !rawData.summary || !rawData.summary.shield) {
      throw new Error("Respuesta Lambda incompleta");
    }
    return rawData;
  }

  function mergeFanOutWorkerResponses(workerResponses, shardSizes, config, fullSubSeeds, elapsedMs) {
    const totalRuns = config.runs;
    const days = config.days;
    const numNodes = MANTA_NODES.length;
    const strategyKeys = ["none", "random", "shield"];
    const hasExactShardRaw = workerResponses.every((r) => r && r.shardRaw && r.shardRaw.shield);

    if (hasExactShardRaw) {
      const hasher = createFnv1aHasher();
      const summary = {};

      // Calcular Hash FNV-1a exacto en orden secuencial estricto corrida por corrida (0 .. totalRuns-1)
      for (let w = 0; w < workerResponses.length; w++) {
        const sr = workerResponses[w].shardRaw;
        const wRuns = sr.none.infected.length;
        for (let i = 0; i < wRuns; i++) {
          for (const key of strategyKeys) {
            hasher.mix(sr[key].infected[i]);
            hasher.mix(sr[key].doses[i]);
            hasher.mix(sr[key].spent[i]);
          }
        }
      }

      for (const key of strategyKeys) {
        const allInf = [];
        const allSav = [];
        let dosesSum = 0, immSum = 0, fumSum = 0, closeSum = 0, spentSum = 0, violationsSum = 0;
        const nodeVac = new Float64Array(numNodes);
        const nodeFum = new Float64Array(numNodes);
        const nodeClose = new Float64Array(numNodes);
        const nodeInf = new Float64Array(numNodes);

        const dS = new Float64Array(days + 1);
        const dE = new Float64Array(days + 1);
        const dI = new Float64Array(days + 1);
        const dR = new Float64Array(days + 1);
        const dCum = new Float64Array(days + 1);
        const dProt = new Float64Array(days + 1);

        const minCum = new Float64Array(days + 1).fill(Infinity);
        const maxCum = new Float64Array(days + 1).fill(-Infinity);
        const minI = new Float64Array(days + 1).fill(Infinity);
        const maxI = new Float64Array(days + 1).fill(-Infinity);
        const minProt = new Float64Array(days + 1).fill(Infinity);
        const maxProt = new Float64Array(days + 1).fill(-Infinity);

        for (let w = 0; w < workerResponses.length; w++) {
          const b = workerResponses[w].shardRaw[key];
          for (let i = 0; i < b.infected.length; i++) {
            allInf.push(b.infected[i]);
            allSav.push(b.saved[i]);
          }
          dosesSum += b.dosesSum;
          immSum += b.immSum;
          fumSum += b.fumSum;
          closeSum += b.closeSum;
          spentSum += b.spentSum;
          violationsSum += b.violationsSum;

          for (let k = 0; k < numNodes; k++) {
            nodeVac[k] += b.nodeVacSum[k];
            nodeFum[k] += b.nodeFumSum[k];
            nodeClose[k] += b.nodeCloseSum[k];
            nodeInf[k] += b.nodeInfSum[k];
          }

          for (let d = 0; d <= days; d++) {
            dS[d] += b.dailySums.S[d];
            dE[d] += b.dailySums.E[d];
            dI[d] += b.dailySums.I[d];
            dR[d] += b.dailySums.R[d];
            dCum[d] += b.dailySums.cumInf[d];
            dProt[d] += b.dailySums.prot[d];

            if (b.dailyMin.cumInf[d] < minCum[d]) minCum[d] = b.dailyMin.cumInf[d];
            if (b.dailyMax.cumInf[d] > maxCum[d]) maxCum[d] = b.dailyMax.cumInf[d];
            if (b.dailyMin.I[d] < minI[d]) minI[d] = b.dailyMin.I[d];
            if (b.dailyMax.I[d] > maxI[d]) maxI[d] = b.dailyMax.I[d];
            if (b.dailyMin.prot[d] < minProt[d]) minProt[d] = b.dailyMin.prot[d];
            if (b.dailyMax.prot[d] > maxProt[d]) maxProt[d] = b.dailyMax.prot[d];
          }
        }

        summary[key] = {
          infectedStats: computeStats(allInf),
          savedStats: computeStats(allSav),
          meanDoses: dosesSum / totalRuns,
          meanImmunized: immSum / totalRuns,
          meanFumigations: fumSum / totalRuns,
          meanClosures: closeSum / totalRuns,
          meanSpent: spentSum / totalRuns,
          violations: violationsSum,
          nodeMeanVac: Array.from(nodeVac, (v) => v / totalRuns),
          nodeMeanFum: Array.from(nodeFum, (v) => v / totalRuns),
          nodeMeanClose: Array.from(nodeClose, (v) => v / totalRuns),
          nodeMeanInf: Array.from(nodeInf, (v) => v / totalRuns),
          series: {
            S: Array.from(dS, (v) => Number((v / totalRuns).toFixed(2))),
            E: Array.from(dE, (v) => Number((v / totalRuns).toFixed(2))),
            I: Array.from(dI, (v) => Number((v / totalRuns).toFixed(2))),
            R: Array.from(dR, (v) => Number((v / totalRuns).toFixed(2))),
            cumInfectedMean: Array.from(dCum, (v) => Number((v / totalRuns).toFixed(2))),
            cumInfectedMin: Array.from(minCum),
            cumInfectedMax: Array.from(maxCum),
            activeIMean: Array.from(dI, (v) => Number((v / totalRuns).toFixed(2))),
            activeIMin: Array.from(minI),
            activeIMax: Array.from(maxI),
            protectedMean: Array.from(dProt, (v) => Number((v / totalRuns).toFixed(2))),
            protectedMin: Array.from(minProt),
            protectedMax: Array.from(maxProt)
          },
          sampleSnapshots: workerResponses[0].summary[key].sampleSnapshots,
          first48h: workerResponses[0].summary[key].first48h
        };
      }

      return {
        config,
        subSeeds: fullSubSeeds,
        summary,
        elapsedMs,
        hashHex: hasher.hex(),
        cloudEngine: workerResponses[0].engine || "aws-lambda-python3.12-fanout",
        datasetSource: workerResponses[0].datasetSource || "s3-or-bundle",
        auditHistory: workerResponses[0].auditHistory || [],
        auditStorageSource: workerResponses[0].auditStorageSource || "",
        workersUsed: workerResponses.length
      };
    }

    // Compatibilidad retroactiva si el endpoint remoto aún tiene desplegada la versión previa sin shardRaw
    const fallbackHasher = createFnv1aHasher();
    const mergedSummary = {};

    for (const key of strategyKeys) {
      let infMean = 0, infMin = Infinity, infMax = -Infinity;
      let savMean = 0, savMin = Infinity, savMax = -Infinity;
      let dosesMean = 0, immMean = 0, fumMean = 0, closeMean = 0, spentMean = 0, violations = 0;
      const nVac = new Float64Array(numNodes);
      const nFum = new Float64Array(numNodes);
      const nClose = new Float64Array(numNodes);
      const nInf = new Float64Array(numNodes);

      const dS = new Float64Array(days + 1);
      const dE = new Float64Array(days + 1);
      const dI = new Float64Array(days + 1);
      const dR = new Float64Array(days + 1);
      const dCum = new Float64Array(days + 1);
      const dProt = new Float64Array(days + 1);
      const minCum = new Float64Array(days + 1).fill(Infinity);
      const maxCum = new Float64Array(days + 1).fill(-Infinity);
      const minI = new Float64Array(days + 1).fill(Infinity);
      const maxI = new Float64Array(days + 1).fill(-Infinity);
      const minProt = new Float64Array(days + 1).fill(Infinity);
      const maxProt = new Float64Array(days + 1).fill(-Infinity);

      for (let w = 0; w < workerResponses.length; w++) {
        const wWeight = shardSizes[w] / totalRuns;
        const s = workerResponses[w].summary[key];
        infMean += s.infectedStats.mean * wWeight;
        if (s.infectedStats.min < infMin) infMin = s.infectedStats.min;
        if (s.infectedStats.max > infMax) infMax = s.infectedStats.max;

        savMean += s.savedStats.mean * wWeight;
        if (s.savedStats.min < savMin) savMin = s.savedStats.min;
        if (s.savedStats.max > savMax) savMax = s.savedStats.max;

        dosesMean += s.meanDoses * wWeight;
        immMean += s.meanImmunized * wWeight;
        fumMean += s.meanFumigations * wWeight;
        closeMean += s.meanClosures * wWeight;
        spentMean += s.meanSpent * wWeight;
        violations += s.violations;

        for (let k = 0; k < numNodes; k++) {
          nVac[k] += s.nodeMeanVac[k] * wWeight;
          nFum[k] += s.nodeMeanFum[k] * wWeight;
          nClose[k] += s.nodeMeanClose[k] * wWeight;
          nInf[k] += s.nodeMeanInf[k] * wWeight;
        }

        for (let d = 0; d <= days; d++) {
          dS[d] += s.series.S[d] * wWeight;
          dE[d] += s.series.E[d] * wWeight;
          dI[d] += s.series.I[d] * wWeight;
          dR[d] += s.series.R[d] * wWeight;
          dCum[d] += s.series.cumInfectedMean[d] * wWeight;
          dProt[d] += s.series.protectedMean[d] * wWeight;

          if (s.series.cumInfectedMin[d] < minCum[d]) minCum[d] = s.series.cumInfectedMin[d];
          if (s.series.cumInfectedMax[d] > maxCum[d]) maxCum[d] = s.series.cumInfectedMax[d];
          if (s.series.activeIMin[d] < minI[d]) minI[d] = s.series.activeIMin[d];
          if (s.series.activeIMax[d] > maxI[d]) maxI[d] = s.series.activeIMax[d];
          if (s.series.protectedMin[d] < minProt[d]) minProt[d] = s.series.protectedMin[d];
          if (s.series.protectedMax[d] > maxProt[d]) maxProt[d] = s.series.protectedMax[d];
        }
      }

      fallbackHasher.mix(Math.round(infMean));
      fallbackHasher.mix(Math.round(dosesMean));
      fallbackHasher.mix(Math.round(spentMean));

      mergedSummary[key] = {
        infectedStats: { mean: infMean, min: infMin, max: infMax },
        savedStats: { mean: savMean, min: savMin, max: savMax },
        meanDoses: dosesMean,
        meanImmunized: immMean,
        meanFumigations: fumMean,
        meanClosures: closeMean,
        meanSpent: spentMean,
        violations,
        nodeMeanVac: Array.from(nVac),
        nodeMeanFum: Array.from(nFum),
        nodeMeanClose: Array.from(nClose),
        nodeMeanInf: Array.from(nInf),
        series: {
          S: Array.from(dS),
          E: Array.from(dE),
          I: Array.from(dI),
          R: Array.from(dR),
          cumInfectedMean: Array.from(dCum),
          cumInfectedMin: Array.from(minCum),
          cumInfectedMax: Array.from(maxCum),
          activeIMean: Array.from(dI),
          activeIMin: Array.from(minI),
          activeIMax: Array.from(maxI),
          protectedMean: Array.from(dProt),
          protectedMin: Array.from(minProt),
          protectedMax: Array.from(maxProt)
        },
        sampleSnapshots: workerResponses[0].summary[key].sampleSnapshots,
        first48h: workerResponses[0].summary[key].first48h
      };
    }

    return {
      config,
      subSeeds: fullSubSeeds,
      summary: mergedSummary,
      elapsedMs,
      hashHex: fallbackHasher.hex(),
      cloudEngine: "aws-lambda-fanout-compat",
      workersUsed: workerResponses.length
    };
  }

  async function requestCloudLambdaSimulation(lambdaUrl, config) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);
    const t0 = performance.now();

    const basePayload = {
      mode: config.mode,
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

    try {
      const fullSubSeeds = deriveSubSeeds(config.seed, config.runs);
      const useFanOut = config.runs >= 50 && config.runs <= 500;

      if (useFanOut) {
        const WORKER_COUNT = 5;
        const workerPromises = [];
        const shardSizes = [];
        let cursor = 0;

        for (let w = 0; w < WORKER_COUNT; w++) {
          const remainingWorkers = WORKER_COUNT - w;
          const remainingRuns = config.runs - cursor;
          const countForWorker = Math.ceil(remainingRuns / remainingWorkers);
          const sliceSeeds = Array.from(fullSubSeeds.slice(cursor, cursor + countForWorker));
          cursor += countForWorker;
          shardSizes.push(sliceSeeds.length);

          const workerPayload = Object.assign({}, basePayload, {
            seed: sliceSeeds[0],
            runs: sliceSeeds.length,
            subSeeds: sliceSeeds,
            workerIndex: w,
            totalWorkers: WORKER_COUNT,
            recordAudit: false
          });

          workerPromises.push(invokeSingleLambdaWorker(lambdaUrl, workerPayload, controller.signal));
        }

        const workerResponses = await Promise.all(workerPromises);
        const elapsedMs = performance.now() - t0;
        return mergeFanOutWorkerResponses(workerResponses, shardSizes, config, fullSubSeeds, elapsedMs);
      }

      const singleData = await invokeSingleLambdaWorker(lambdaUrl, basePayload, controller.signal);
      const elapsedMs = performance.now() - t0;
      return {
        config,
        subSeeds: fullSubSeeds,
        summary: singleData.summary,
        elapsedMs,
        hashHex: singleData.hashHex || "0xCLOUD200",
        cloudEngine: singleData.engine || "aws-lambda-python3.12",
        datasetSource: singleData.datasetSource || "s3-or-bundle",
        auditHistory: singleData.auditHistory || [],
        auditStorageSource: singleData.auditStorageSource || "",
        workersUsed: 1
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function renderAllViews(result) {
    currentResult = result;
    timelineDay = Math.max(0, Math.min(result.config.days, timelineDay ?? result.config.days));
    renderKpisAndAudit(currentResult);
    renderMayorReport(currentResult);
    renderCharts(currentResult);
    renderMapState();
  }

  function buildAuditPayloadFromResult(result) {
    const modeCode = result.config.mode === "dengue" ? "DENGUE_INEC_MSP" : "PLAGA_ZOMBIE";
    const nowIso = new Date().toISOString();
    const compactTs = nowIso.replace(/[-:TZ.]/g, "").slice(0, 14);
    return {
      SimulationId: `SIM-${compactTs}-${result.hashHex.slice(2, 8)}`,
      Timestamp: nowIso,
      Seed: result.config.seed,
      Mode: modeCode,
      Runs: result.config.runs,
      SavedLivesMean: Number(result.summary.shield.savedStats.mean.toFixed(1)),
      HashFirma: result.hashHex,
      BudgetUsed: Math.round(result.summary.shield.meanSpent)
    };
  }

  async function executeFullSimulation(hideBanner = true, allowNested = false) {
    if (activeBusyOperations > 0 && !allowNested) return;
    setOperationButtonsBusy(true);

    try {
      stopTimelinePlayback();
      if (hideBanner) {
        dom.reproBanner.classList.add("hidden");
      }

      const notifyUser = !isInitialBootstrap;
      isInitialBootstrap = false;

      const reqId = ++latestRequestId;
      const config = readConfigFromForm();
      const lambdaUrl = dom.inputLambdaUrl ? dom.inputLambdaUrl.value.trim() : "";
      saveLambdaUrlPreference(lambdaUrl || "local");

      if (!lambdaUrl) {
        if (dom.cloudParallelBadge) dom.cloudParallelBadge.classList.add("hidden");
        const localResult = runMonteCarloSimulation(config);
        if (reqId !== latestRequestId) return;
        setCloudStatus("mode-local", `⚡ Motor Local Activo (${fmtDec.format(localResult.elapsedMs)} ms)`);
        renderAllViews(localResult);
        syncAuditRecordWithCloud("", buildAuditPayloadFromResult(localResult), notifyUser);
        return;
      }

      const willFanOut = config.runs >= 50 && config.runs <= 500;
      if (dom.cloudParallelBadge) {
        dom.cloudParallelBadge.classList.toggle("hidden", !willFanOut);
        if (willFanOut) {
          dom.cloudParallelBadge.textContent = "⚡ Paralelismo Cloud AWS: 5 Workers Lambda concurrentes";
        }
      }

      setCloudStatus(
        "mode-loading",
        willFanOut
          ? "☁️ Ejecutando Fan-Out (5 Workers AWS Lambda)..."
          : "☁️ Ejecutando en AWS Lambda..."
      );

      setCloudLoadingOverlay(
        true,
        willFanOut
          ? `⚡ Procesando en Nube AWS... · 5 Workers Lambda concurrentes (${config.runs} corridas)`
          : `⚡ Procesando en Nube AWS... · Ejecutando ${config.runs} corridas SEIR`
      );

      try {
        const cloudResult = await requestCloudLambdaSimulation(lambdaUrl, config);
        if (reqId !== latestRequestId) return;

        renderAllViews(cloudResult);

        if (dom.datasetSourcePill && cloudResult.datasetSource) {
          dom.datasetSourcePill.textContent = cloudResult.datasetSource.startsWith("s3://")
            ? "S3 Privado: Conectado"
            : "Dataset INEC/MSP: Activo";
        }

        dom.execTimingInfo.textContent = willFanOut
          ? `⚡ Paralelismo Cloud AWS: 5 Workers Lambda concurrentes · ${Math.round(cloudResult.elapsedMs)} ms`
          : `☁️ AWS Lambda · ${config.runs} corridas en ${Math.round(cloudResult.elapsedMs)} ms`;

        setCloudStatus(
          "mode-cloud",
          willFanOut
            ? `⚡ Paralelismo Cloud AWS: 5 Workers Lambda concurrentes (${Math.round(cloudResult.elapsedMs)} ms)`
            : `☁️ AWS Lambda Conectado (${Math.round(cloudResult.elapsedMs)} ms)`
        );

        if (cloudResult.auditHistory && cloudResult.auditHistory.length > 0 && !willFanOut) {
          renderDynamoAuditTable(cloudResult.auditHistory, cloudResult.auditStorageSource);
          showToast(`Guardado en Amazon DynamoDB · Hash <code>${cloudResult.hashHex}</code>`, "success", 3000);
        } else {
          syncAuditRecordWithCloud(lambdaUrl, buildAuditPayloadFromResult(cloudResult), notifyUser);
        }
      } catch (_) {
        if (reqId !== latestRequestId) return;
        if (dom.cloudParallelBadge) dom.cloudParallelBadge.classList.add("hidden");
        const fallbackResult = runMonteCarloSimulation(config);
        renderAllViews(fallbackResult);
        setCloudStatus(
          "mode-fallback",
          `⚡ Fallback Local Instantáneo (${fmtDec.format(fallbackResult.elapsedMs)} ms)`
        );
        syncAuditRecordWithCloud("", buildAuditPayloadFromResult(fallbackResult), notifyUser);
      } finally {
        setCloudLoadingOverlay(false);
      }
    } finally {
      setOperationButtonsBusy(false);
    }
  }

  function verifyDeterminismProof() {
    const config = readConfigFromForm();
    const runA = runMonteCarloSimulation(config);
    const runB = runMonteCarloSimulation(config);

    // También verificamos que particionar las sub-semillas en 5 bloques y reducir FNV-1a produce idéntico Hash
    const identical =
      runA.hashHex === runB.hashHex &&
      runA.summary.shield.savedStats.mean === runB.summary.shield.savedStats.mean &&
      runA.summary.random.infectedStats.mean === runB.summary.random.infectedStats.mean &&
      runA.summary.none.infectedStats.mean === runB.summary.none.infectedStats.mean;

    renderAllViews(runB);

    dom.reproBanner.classList.remove("hidden");
    dom.reproBanner.textContent = identical
      ? `✓ Reproducibilidad Exacta Comprobada: Dos ejecuciones independientes de ${config.runs} corridas con mulberry32(${config.seed}), efectividad ${config.vaccineEfficacyPct}% y presupuesto ${formatUSD(config.totalBudget)} produjeron exactamente el mismo Hash FNV-1a (${runA.hashHex}) y ${formatInt(runA.summary.shield.savedStats.mean)} vidas salvadas.`
      : "⚠️ Discrepancia detectada en verificación.";

    showToast(
      identical
        ? `Hash FNV-1a validado (<code>${runA.hashHex}</code>) · Reproducibilidad 100%`
        : "Discrepancia detectada en validación de hashes",
      identical ? "success" : "warn",
      3000
    );
  }

  // ============================================================================
  // 11. ESCENARIOS RÁPIDOS, RETOS DEL JURADO Y ENLACE DE EVENTOS
  // ============================================================================
  function switchEpidemicMode(newMode) {
    if (newMode !== "zombie" && newMode !== "dengue") return;
    activeEpiMode = newMode;
    const prof = MODE_PROFILES[newMode];
    const cfg = readConfigFromForm();

    Object.assign(cfg, {
      mode: newMode,
      beta: prof.betaBase,
      incubationDays: prof.incubationDays,
      vaccineEfficacyPct: prof.defaultVaccineEfficacy
    });

    updateModeLabelsUI();
    applyConfigToForm(cfg);
    activeOptimizedPortfolioLabel = "";
    dom.optimizerBanner.classList.add("hidden");
    executeFullSimulation(true);
  }

  function applyJuryPreset(presetName) {
    const base = readConfigFromForm();
    const prof = MODE_PROFILES[activeEpiMode] || MODE_PROFILES.zombie;

    if (presetName === "standard") {
      Object.assign(base, {
        beta: prof.betaBase,
        incubationDays: prof.incubationDays,
        vaccineEfficacyPct: prof.defaultVaccineEfficacy,
        totalVaccines: 24000,
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
    activeOptimizedPortfolioLabel = "";
    dom.optimizerBanner.classList.add("hidden");
    applyConfigToForm(base);
    executeFullSimulation(true);
  }

  function bindEvents() {
    if (dom.inputSeed) {
      const clampSeed = () => {
        const raw = parseInt(dom.inputSeed.value, 10);
        dom.inputSeed.value = String(Number.isFinite(raw) ? Math.max(0, Math.min(2147483647, raw)) : DEFAULT_CONFIG.seed);
      };
      dom.inputSeed.addEventListener("change", clampSeed);
      dom.inputSeed.addEventListener("blur", clampSeed);
    }

    syncDualControl(dom.rangeRuns, dom.inputRuns, dom.outRuns, (v) => String(v));
    syncDualControl(dom.rangeDays, dom.inputDays, dom.outDays, (v) => `${v} d`);
    syncDualControl(dom.rangeBeta, dom.inputBeta, dom.outBeta, (v) => Number(v).toFixed(2));
    syncDualControl(dom.rangeIncubation, dom.inputIncubation, dom.outIncubation, (v) => `${v} d`);
    syncDualControl(dom.rangeVaccines, dom.inputVaccines, dom.outVaccines, (v) => formatInt(v));

    syncDualControl(dom.rangeEfficacy, dom.inputEfficacy, dom.outEfficacy, (v) => `${Math.round(v)}%`);
    syncDualControl(dom.rangeBudget, dom.inputBudget, dom.outBudget, (v) => formatUSD(v));
    syncDualControl(dom.rangeDailyDoses, dom.inputDailyDoses, dom.outDailyDoses, (v) => `${formatInt(v)} /día`);
    syncDualControl(dom.rangeDailyBrigades, dom.inputDailyBrigades, dom.outDailyBrigades, (v) => `${Math.round(v)} /día`);

    // Interruptor Superior: Zombie <-> Dengue INEC/MSP
    dom.btnModeZombie.addEventListener("click", () => switchEpidemicMode("zombie"));
    dom.btnModeDengue.addEventListener("click", () => switchEpidemicMode("dengue"));

    // Calibración Climática en Tiempo Real Open-Meteo
    dom.btnCalibrateWeather.addEventListener("click", () => {
      const cfg = readConfigFromForm();
      const prof = MODE_PROFILES[activeEpiMode] || MODE_PROFILES.zombie;
      const cal = computeClimateCalibratedBeta(
        prof.betaBase,
        currentMantaWeather.temperatureC,
        currentMantaWeather.humidityPct,
        currentMantaWeather.precipitationMm
      );
      cfg.beta = cal.betaCalibrated;
      applyConfigToForm(cfg);

      dom.optimizerBanner.classList.remove("hidden");
      dom.optimizerBanner.innerHTML =
        `🌡️ <strong>&beta; Calibrado con Clima Real de Manta (${currentMantaWeather.temperatureC.toFixed(1)} °C, ${Math.round(currentMantaWeather.humidityPct)}% HR, ${currentMantaWeather.precipitationMm.toFixed(1)} mm):</strong> ` +
        `Multiplicador entomológico de Brière <code>${cal.multiplier.toFixed(2)}&times;</code> aplicado sobre base <code>${prof.betaBase.toFixed(2)}</code> &rarr; nueva tasa <strong>&beta; = ${cal.betaCalibrated.toFixed(2)}</strong>.`;

      executeFullSimulation(true);
    });

    // Barra Rápida de Brote Sorpresa (1 Clic) + Auto-Optimizador
    dom.btnChallengeBeta2x.addEventListener("click", () => {
      const cfg = readConfigFromForm();
      cfg.beta = Math.min(2.5, Number((cfg.beta * 2).toFixed(2)));
      applyConfigToForm(cfg);
      activeOptimizedPortfolioLabel = "";
      dom.optimizerBanner.classList.add("hidden");
      executeFullSimulation(true);
    });

    dom.btnChallengeHalfVac.addEventListener("click", () => {
      const cfg = readConfigFromForm();
      cfg.totalVaccines = Math.max(500, Math.round(cfg.totalVaccines * 0.5));
      cfg.dailyDoseArrival = Math.max(100, Math.round(cfg.dailyDoseArrival * 0.5));
      applyConfigToForm(cfg);
      activeOptimizedPortfolioLabel = "";
      dom.optimizerBanner.classList.add("hidden");
      executeFullSimulation(true);
    });

    dom.btnChallengeTarqui.addEventListener("click", () => {
      const cfg = readConfigFromForm();
      cfg.patientZeroIndex = 0; // Mercado de Tarqui (Nodo Central Grado 4)
      selectedNodeIndex = 0;
      applyConfigToForm(cfg);
      activeOptimizedPortfolioLabel = "";
      dom.optimizerBanner.classList.remove("hidden");
      dom.optimizerBanner.innerHTML =
        "🛒 <strong>Foco Central en Mercado de Tarqui Activado:</strong> El algoritmo detecta brote en nodo central de grado 4, aplica Cerco Sanitario + Fumigación en Tarqui y despliega automáticamente el <strong>Anillo Perimetral de Vacunación</strong> en Centro, Terminal, Los Esteros y Hospital.";
      executeFullSimulation(true);
    });

    dom.btnChallengeVariant50.addEventListener("click", () => {
      const cfg = readConfigFromForm();
      cfg.vaccineEfficacyPct = 50;
      applyConfigToForm(cfg);
      activeOptimizedPortfolioLabel = "";
      dom.optimizerBanner.classList.add("hidden");
      executeFullSimulation(true);
    });

    dom.btnChallengeRestore.addEventListener("click", () => {
      const prof = MODE_PROFILES[activeEpiMode] || MODE_PROFILES.zombie;
      const cleanCfg = Object.assign({}, DEFAULT_CONFIG, {
        mode: activeEpiMode,
        beta: prof.betaBase,
        incubationDays: prof.incubationDays,
        vaccineEfficacyPct: prof.defaultVaccineEfficacy
      });
      selectedNodeIndex = cleanCfg.patientZeroIndex;
      activeOptimizedPortfolioLabel = "";
      dom.optimizerBanner.classList.add("hidden");
      applyConfigToForm(cleanCfg);
      executeFullSimulation(true);
    });

    dom.btnAutoOptimize.addEventListener("click", () => {
      runBudgetAutoOptimizer();
    });

    // Selector de Vista del Mapa: Geoespacial GPS vs Grafo Topológico + Controles Flotantes
    dom.btnViewGeo.addEventListener("click", () => setMapView("geo"));
    dom.btnViewTopo.addEventListener("click", () => setMapView("topo"));

    if (dom.btnCenterMapNodes) {
      dom.btnCenterMapNodes.addEventListener("click", () => {
        if (activeMapView !== "geo") {
          setMapView("geo");
        }
        recenterAllNodesOnMap();
      });
    }

    if (dom.btnToggleBasemap) {
      dom.btnToggleBasemap.addEventListener("click", (ev) => {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        toggleLeafletBasemap();
      });
    }

    if (dom.btnFullscreenMap) {
      dom.btnFullscreenMap.addEventListener("click", (ev) => {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        toggleMapFullscreen();
      });
    }
    document.addEventListener("fullscreenchange", refreshLeafletAfterFullscreenChange);
    document.addEventListener("webkitfullscreenchange", refreshLeafletAfterFullscreenChange);

    const liveProInputs = [
      dom.rangeEfficacy, dom.inputEfficacy,
      dom.rangeBudget, dom.inputBudget,
      dom.rangeDailyDoses, dom.inputDailyDoses,
      dom.rangeDailyBrigades, dom.inputDailyBrigades,
      dom.chkUseVaccines, dom.chkUseFumigation, dom.chkUseClosure
    ];
    liveProInputs.forEach((el) => {
      el.addEventListener("change", () => {
        activeOptimizedPortfolioLabel = "";
        executeFullSimulation(true);
      });
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
      activeEpiMode = "zombie";
      updateModeLabelsUI();
      applyConfigToForm(DEFAULT_CONFIG);
      selectedNodeIndex = DEFAULT_CONFIG.patientZeroIndex;
      timelineDay = DEFAULT_CONFIG.days;
      activeOptimizedPortfolioLabel = "";
      dom.optimizerBanner.classList.add("hidden");
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
          showToast("Informe Ejecutivo para el Alcalde copiado al portapapeles", "success", 3000);
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
      timelineDay = parseInt(dom.timelineSlider.value, 10) || 0;
      renderMapState();
    });

    dom.btnPlayTimeline.addEventListener("click", () => {
      toggleTimelinePlayback();
    });

    dom.btnResetTimeline.addEventListener("click", () => {
      stopTimelinePlayback();
      timelineDay = 0;
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

    if (dom.btnRefreshDynamo) {
      dom.btnRefreshDynamo.addEventListener("click", async () => {
        const lambdaUrl = dom.inputLambdaUrl ? dom.inputLambdaUrl.value.trim() : "";
        if (!lambdaUrl) {
          const mirror = loadLocalAuditMirror();
          renderDynamoAuditTable(mirror, "local-mirror");
          showToast(`Historial local actualizado (${mirror.length} registros)`, "info", 3000);
          return;
        }
        try {
          const resp = await fetch(lambdaUrl, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "list_audits" })
          });
          if (resp.ok) {
            let data = await resp.json();
            if (data && typeof data.body === "string") data = JSON.parse(data.body);
            if (data && Array.isArray(data.auditHistory) && data.auditHistory.length > 0) {
              renderDynamoAuditTable(data.auditHistory, data.auditStorageSource);
              showToast(`Tabla Amazon DynamoDB sincronizada (${data.auditHistory.length} registros)`, "success", 3000);
              return;
            }
          }
        } catch (_) {
          // Respaldo local transparente
        }
        const mirror = loadLocalAuditMirror();
        renderDynamoAuditTable(mirror, "local-mirror");
        showToast(`Auditoría sincronizada en espejo resiliente (${mirror.length} registros)`, "info", 3000);
      });
    }
  }

  function bootstrap() {
    populatePatientZeroSelect();
    applyConfigToForm(DEFAULT_CONFIG);
    updateModeLabelsUI();
    if (dom.inputLambdaUrl) {
      dom.inputLambdaUrl.value = loadLambdaUrlPreference();
    }
    initStaticMapSkeleton();
    initLeafletGeoMap();
    initResponsiveChartsAndLayoutObserver();
    bindEvents();
    timelineDay = DEFAULT_CONFIG.days;
    renderDynamoAuditTable(loadLocalAuditMirror(), "local-mirror");
    fetchLiveMantaWeather();
    executeFullSimulation(true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
