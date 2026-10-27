"""
OPERACIÓN CONTENCIÓN MANTA · AWS LAMBDA BACKEND (PYTHON 3.12)
Track B - La Plaga Zombie

Función serverless sin dependencias externas (solo librerías estándar: json, math, random).
Soporta peticiones OPTIONS y POST con CORS abierto (*), ejecuta simulaciones Monte Carlo
reproducibles por semilla sobre el grafo real de 8 barrios de Manta para las 3 estrategias
(Sin Intervención, Al Azar, Escudo de Centralidad y Riesgo), respeta estrictamente la regla
de vacunar únicamente a población Sana, y genera la recomendación ejecutiva para el Alcalde.
"""

import json
import math
import random

# ==============================================================================
# 1. GRAFO REAL DE MANTA (8 NODOS, 100,000 HABITANTES, 13 ARISTAS DE CONTACTO)
# ==============================================================================
MANTA_NODES = [
    {
        "id": "mercado",
        "index": 0,
        "name": "Mercado de Tarqui",
        "population": 15000,
        "neighbors": [2, 6, 1, 5],  # Centro, Los Esteros, Terminal, Hospital
    },
    {
        "id": "terminal",
        "index": 1,
        "name": "Terminal Terrestre",
        "population": 12000,
        "neighbors": [0, 3, 6, 2],  # Mercado, ULEAM, Los Esteros, Centro
    },
    {
        "id": "centro",
        "index": 2,
        "name": "Centro de Manta",
        "population": 18000,
        "neighbors": [0, 1, 4, 5],  # Mercado, Terminal, Playa Murciélago, Hospital
    },
    {
        "id": "uleam",
        "index": 3,
        "name": "ULEAM",
        "population": 14000,
        "neighbors": [1, 4, 7],     # Terminal, Playa Murciélago, San Mateo
    },
    {
        "id": "murcielago",
        "index": 4,
        "name": "Playa El Murciélago",
        "population": 10000,
        "neighbors": [2, 3, 7],     # Centro, ULEAM, San Mateo
    },
    {
        "id": "hospital",
        "index": 5,
        "name": "Hospital Rodríguez Zambrano",
        "population": 8000,
        "neighbors": [2, 0, 7],     # Centro, Mercado, San Mateo
    },
    {
        "id": "esteros",
        "index": 6,
        "name": "Los Esteros",
        "population": 16000,
        "neighbors": [0, 1],        # Mercado, Terminal
    },
    {
        "id": "san_mateo",
        "index": 7,
        "name": "San Mateo",
        "population": 7000,
        "neighbors": [3, 4, 5],     # ULEAM, Playa Murciélago, Hospital
    },
]

TOTAL_CITY_POPULATION = sum(n["population"] for n in MANTA_NODES)  # 100,000

# Costos y parámetros de Intervenciones Combinadas
COST_VACCINE_DOSE = 15          # $15 por dosis
COST_FUMIGATION = 1200          # $1,200 por barrio (reduce contagio local 40% por 5 días)
FUMIGATION_DURATION_DAYS = 5
FUMIGATION_LOCAL_MULT = 0.60
COST_NODE_CLOSURE = 3500        # $3,500 por barrio (reduce flujo vecino 75%)
CLOSURE_FLOW_MULT = 0.25

INITIAL_ZOMBIES = 10
EXORCISM_RATE_GAMMA = 0.20
CORRIDOR_COUPLING = 0.025
TACTICAL_BRIGADE_SIZE = 100

CORS_HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
}


# ==============================================================================
# 2. PRNG DETERMINISTA DE ALTA VELOCIDAD (C-NATIVE random.Random + mulberry32)
# ==============================================================================
def mulberry32_next(state):
    """Avanza un paso de 32 bits del generador determinista mulberry32 (para derivar semillas)."""
    state = (state + 0x6D2B79F5) & 0xFFFFFFFF
    t = state
    t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
    t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
    val = ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0
    return state, val


def derive_sub_seeds(master_seed, runs):
    base = int(master_seed) & 0xFFFFFFFF
    state = base
    seeds = []
    for r in range(runs):
        if r == 0:
            seeds.append(base)
        else:
            state, val = mulberry32_next(state)
            seeds.append(int(val * 4294967296.0) & 0xFFFFFFFF)
    return seeds


def sample_binomial(
    n,
    p,
    rng,
    _log=math.log,
    _exp=math.exp,
    _sqrt=math.sqrt,
    _cos=math.cos,
    _tau=2.0 * math.pi,
):
    """Consume siempre exactamente 2 números de rng para mantener Números Aleatorios Comunes."""
    u1 = rng.random()
    u2 = rng.random()
    if n <= 0 or p <= 0.0:
        return 0
    if p >= 1.0:
        return n

    flipped = False
    if p > 0.5:
        p = 1.0 - p
        flipped = True

    mean = n * p
    if mean < 14.0:
        # Inversión exacta de la CDF Binomial usando únicamente u1
        q = 1.0 - p
        prob = _exp(n * _log(q))
        cdf = prob
        ratio = p / q
        k = 0
        limit = min(n, int(mean + 10.0 * _sqrt(mean + 1.0)) + 12)
        while u1 > cdf and k < limit:
            prob *= (n - k) * ratio / (k + 1)
            cdf += prob
            k += 1
        res = k
    else:
        if u1 <= 1e-12:
            u1 = 1e-12
        z = _sqrt(-2.0 * _log(u1)) * _cos(_tau * u2)
        res = round(mean + _sqrt(mean * (1.0 - p)) * z)
        if res < 0:
            res = 0
        elif res > n:
            res = n

    return (n - res) if flipped else res


def sample_hypergeometric(total_pop, success_pop, draws, rng, _sqrt=math.sqrt):
    if draws <= 0 or success_pop <= 0 or total_pop <= 0:
        return 0
    min_possible = draws - (total_pop - success_pop)
    if min_possible < 0:
        min_possible = 0
    max_possible = draws if draws < success_pop else success_pop
    if min_possible >= max_possible:
        return min_possible

    if draws <= 30:
        chosen = 0
        rem_tot = total_pop
        rem_succ = success_pop
        rand = rng.random
        for _ in range(draws):
            if rand() < (rem_succ / rem_tot):
                chosen += 1
                rem_succ -= 1
            rem_tot -= 1
        return max(min_possible, min(max_possible, chosen))

    p = success_pop / total_pop
    mean = draws * p
    fpc = (total_pop - draws) / (total_pop - 1) if total_pop > 1 else 0.0
    variance = draws * p * (1.0 - p) * fpc
    sampled = round(rng.gauss(mean, _sqrt(variance if variance > 0.0 else 0.0)))
    if sampled < min_possible:
        return min_possible
    if sampled > max_possible:
        return max_possible
    return sampled


def compute_shield_score(node_idx, S, I):
    if S[node_idx] <= 0:
        return 0.0
    node = MANTA_NODES[node_idx]
    connections = len(node["neighbors"])
    neighbor_zombies = sum(I[nb] for nb in node["neighbors"])
    healthy_ratio = S[node_idx] / node["population"]
    return connections * neighbor_zombies * healthy_ratio


def imul32(a, b):
    return ((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF)) & 0xFFFFFFFF


# ==============================================================================
# 3. MOTOR DE SIMULACIÓN DIARIA SEIR POR ESTRATEGIA
# ==============================================================================
def simulate_single_trajectory(run_seed, strategy, config, record_history=False):
    num_nodes = len(MANTA_NODES)
    days = config["days"]
    beta = config["beta"]
    sigma = 1.0 / max(1, config["incubationDays"])
    gamma = EXORCISM_RATE_GAMMA
    efficacy = max(0.10, min(1.0, config["vaccineEffectiveness"] / 100.0))

    S = [n["population"] for n in MANTA_NODES]
    S_failed = [0] * num_nodes
    E = [0] * num_nodes
    I = [0] * num_nodes
    R = [0] * num_nodes

    fum_days_left = [0] * num_nodes
    node_closed = [0] * num_nodes

    vaccinated_by_node = [0] * num_nodes
    fumigations_by_node = [0] * num_nodes
    closures_by_node = [0] * num_nodes
    cum_inf_by_node = [0] * num_nodes

    first_48h = (
        {"closures": [], "fumigations": [], "vaccinatedByNode": [0] * num_nodes}
        if record_history
        else None
    )

    pz = config["initialNode"]
    init_z = min(INITIAL_ZOMBIES, S[pz])
    S[pz] -= init_z
    I[pz] = init_z
    cum_inf_by_node[pz] = init_z

    cumulative_infected = init_z
    total_doses_applied = 0
    total_immunized = 0
    total_fumigations = 0
    total_closures = 0
    total_spent = 0
    violations = 0

    cash_rem = 0 if strategy == "none" else config["budget"]
    stock_rem = 0 if strategy == "none" else config["vaccines"]
    cold_chain_doses = 0

    policy_rng = random.Random((run_seed ^ 0x9E3779B9) & 0xFFFFFFFF)
    eff_rng = random.Random((run_seed ^ 0x517CC1B7) & 0xFFFFFFFF)
    epi_rng = random.Random(run_seed & 0xFFFFFFFF)

    daily_S = [0] * (days + 1)
    daily_E = [0] * (days + 1)
    daily_I = [0] * (days + 1)
    daily_R = [0] * (days + 1)
    daily_cum_inf = [0] * (days + 1)
    node_snapshots = [None] * (days + 1) if record_history else None

    def record_day(d):
        daily_S[d] = sum(S)
        daily_E[d] = sum(E)
        daily_I[d] = sum(I)
        daily_R[d] = sum(R)
        daily_cum_inf[d] = cumulative_infected

        if record_history:
            snap = []
            for k in range(num_nodes):
                snap.append(
                    {
                        "S": S[k],
                        "E": E[k],
                        "I": I[k],
                        "R": R[k],
                        "vaccinated": vaccinated_by_node[k],
                        "fumActive": fum_days_left[k] > 0,
                        "fumDaysLeft": fum_days_left[k],
                        "closed": node_closed[k] == 1,
                        "cumInf": cum_inf_by_node[k],
                        "score": round(compute_shield_score(k, S, I), 2),
                    }
                )
            node_snapshots[d] = snap

    record_day(0)

    for d in range(1, days + 1):
        for k in range(num_nodes):
            if fum_days_left[k] > 0:
                fum_days_left[k] -= 1

        if strategy != "none" and stock_rem > 0:
            arriving = min(config["dailyDoseArrival"], stock_rem)
            cold_chain_doses += arriving
            stock_rem -= arriving

        brigades_left = 0 if strategy == "none" else config["dailyBrigadeArrival"]

        # FASE 1: INTERVENCIONES Y VACUNACIÓN ESTRICTA A SANOS
        if strategy == "random" and cash_rem > 0:
            while brigades_left > 0:
                can_close = (
                    config["useClosure"]
                    and cash_rem >= COST_NODE_CLOSURE
                    and total_closures < 3
                )
                can_fum = (
                    config["useFumigation"]
                    and cash_rem >= COST_FUMIGATION
                    and total_fumigations < 8
                )
                if not can_close and not can_fum:
                    break

                roll = policy_rng.random()
                rand_barrio = int(math.floor(policy_rng.random() * num_nodes))

                if can_close and roll < 0.18 and node_closed[rand_barrio] == 0:
                    node_closed[rand_barrio] = 1
                    closures_by_node[rand_barrio] += 1
                    total_closures += 1
                    cash_rem -= COST_NODE_CLOSURE
                    total_spent += COST_NODE_CLOSURE
                    brigades_left -= 1
                elif can_fum and roll < 0.50 and fum_days_left[rand_barrio] == 0:
                    fum_days_left[rand_barrio] = FUMIGATION_DURATION_DAYS
                    fumigations_by_node[rand_barrio] += 1
                    total_fumigations += 1
                    cash_rem -= COST_FUMIGATION
                    total_spent += COST_FUMIGATION
                    brigades_left -= 1
                else:
                    break

            if (
                config["useVaccines"]
                and cold_chain_doses > 0
                and cash_rem >= COST_VACCINE_DOSE
            ):
                max_aff = cash_rem // COST_VACCINE_DOSE
                elig_pool = sum(S[k] - S_failed[k] for k in range(num_nodes))
                to_apply = min(cold_chain_doses, max_aff, elig_pool)
                doses_left = to_apply
                pool_left = elig_pool

                for k in range(num_nodes):
                    if doses_left <= 0:
                        break
                    elig_k = S[k] - S_failed[k]
                    if elig_k <= 0:
                        continue

                    alloc = sample_hypergeometric(pool_left, elig_k, doses_left, policy_rng)
                    if alloc > S[k]:
                        violations += alloc - S[k]
                        alloc = S[k]

                    imm = sample_binomial(alloc, efficacy, eff_rng)
                    S[k] -= imm
                    R[k] += imm
                    S_failed[k] += alloc - imm

                    vaccinated_by_node[k] += alloc
                    total_doses_applied += alloc
                    total_immunized += imm
                    cold_chain_doses -= alloc
                    cash_rem -= alloc * COST_VACCINE_DOSE
                    total_spent += alloc * COST_VACCINE_DOSE

                    doses_left -= alloc
                    pool_left -= elig_k

        elif strategy == "shield" and cash_rem > 0:
            if not config["useVaccines"]:
                max_closures = 8
            elif efficacy < 0.50:
                max_closures = max(1, min(5, config["budget"] // 9500))
            else:
                max_closures = max(1, min(4, config["budget"] // 12500))

            if config["useClosure"]:
                while (
                    brigades_left > 0
                    and cash_rem >= COST_NODE_CLOSURE
                    and total_closures < max_closures
                ):
                    best_c = -1
                    best_cs = 0.0
                    for k in range(num_nodes):
                        if node_closed[k] == 1:
                            continue
                        deg = len(MANTA_NODES[k]["neighbors"])
                        neigh_z = sum(I[nb] for nb in MANTA_NODES[k]["neighbors"])
                        s_frac = S[k] / MANTA_NODES[k]["population"]
                        if I[k] >= 5:
                            c_score = 1500.0 + I[k] * deg * 12.0
                        elif neigh_z >= 6:
                            c_score = deg * neigh_z * s_frac * 3.0
                        else:
                            c_score = 0.0
                        if c_score > best_cs:
                            best_cs = c_score
                            best_c = k

                    if best_c == -1:
                        break

                    node_closed[best_c] = 1
                    closures_by_node[best_c] += 1
                    total_closures += 1
                    cash_rem -= COST_NODE_CLOSURE
                    total_spent += COST_NODE_CLOSURE
                    brigades_left -= 1

                    if first_48h is not None and d <= 2 and best_c not in first_48h["closures"]:
                        first_48h["closures"].append(best_c)

            if config["useFumigation"]:
                while brigades_left > 0 and cash_rem >= COST_FUMIGATION:
                    best_f = -1
                    best_fs = 0.0
                    for k in range(num_nodes):
                        if fum_days_left[k] > 0 or S[k] < 150:
                            continue
                        active_load = I[k] + 0.5 * E[k]
                        if active_load < 4:
                            continue
                        s_frac = S[k] / MANTA_NODES[k]["population"]
                        deg = len(MANTA_NODES[k]["neighbors"])
                        f_score = active_load * s_frac * (1.0 + 0.3 * deg)
                        if f_score > best_fs:
                            best_fs = f_score
                            best_f = k

                    if best_f == -1:
                        break

                    fum_days_left[best_f] = FUMIGATION_DURATION_DAYS
                    fumigations_by_node[best_f] += 1
                    total_fumigations += 1
                    cash_rem -= COST_FUMIGATION
                    total_spent += COST_FUMIGATION
                    brigades_left -= 1

                    if first_48h is not None and d <= 2 and best_f not in first_48h["fumigations"]:
                        first_48h["fumigations"].append(best_f)

            if (
                config["useVaccines"]
                and cold_chain_doses > 0
                and cash_rem >= COST_VACCINE_DOSE
            ):
                fum_reserve = (
                    min(
                        cash_rem,
                        int(round(config["budget"] * (0.22 if efficacy < 0.50 else 0.08))),
                    )
                    if (config["useFumigation"] and d <= 16)
                    else 0
                )
                spendable = max(0, cash_rem - fum_reserve)
                max_aff = spendable // COST_VACCINE_DOSE
                elig_tot = sum(S[k] - S_failed[k] for k in range(num_nodes))
                doses_left = min(cold_chain_doses, max_aff, elig_tot)

                while doses_left > 0:
                    step = min(TACTICAL_BRIGADE_SIZE, doses_left)
                    best_n = -1
                    best_sc = -1.0

                    for k in range(num_nodes):
                        elig = S[k] - S_failed[k]
                        if elig <= 0:
                            continue
                        sc = compute_shield_score(k, S, I) * (elig / max(1, S[k]))
                        if sc > best_sc:
                            best_sc = sc
                            best_n = k

                    if best_n == -1 or best_sc <= 0.0:
                        best_n = -1
                        best_sc = -1.0
                        for k in range(num_nodes):
                            elig = S[k] - S_failed[k]
                            if elig <= 0:
                                continue
                            fb = (
                                len(MANTA_NODES[k]["neighbors"])
                                * (I[k] + 1.0)
                                * (elig / MANTA_NODES[k]["population"])
                            )
                            if fb > best_sc:
                                best_sc = fb
                                best_n = k

                    if best_n == -1:
                        break
                    elig_best = S[best_n] - S_failed[best_n]
                    if elig_best <= 0:
                        break

                    alloc = min(step, elig_best)
                    if alloc > S[best_n]:
                        violations += alloc - S[best_n]
                        alloc = S[best_n]

                    imm = sample_binomial(alloc, efficacy, eff_rng)
                    S[best_n] -= imm
                    R[best_n] += imm
                    S_failed[best_n] += alloc - imm

                    vaccinated_by_node[best_n] += alloc
                    total_doses_applied += alloc
                    total_immunized += imm
                    cold_chain_doses -= alloc
                    cash_rem -= alloc * COST_VACCINE_DOSE
                    total_spent += alloc * COST_VACCINE_DOSE
                    doses_left -= alloc

                    if first_48h is not None and d <= 2:
                        first_48h["vaccinatedByNode"][best_n] += alloc

        # FASE 2: TRANSICIÓN DIARIA SEIR ESTOCÁSTICA (NÚMEROS ALEATORIOS COMUNES)
        new_E = [0] * num_nodes
        new_I = [0] * num_nodes
        new_R = [0] * num_nodes

        for k in range(num_nodes):
            node = MANTA_NODES[k]
            rng = epi_rng

            dispersion = 0.60 + 0.80 * rng.random()
            local_mod = FUMIGATION_LOCAL_MULT if fum_days_left[k] > 0 else 1.0
            local_force = local_mod * beta * (I[k] / node["population"])

            hub_factor = len(node["neighbors"]) / 3.0
            neigh_force = 0.0
            for nb_idx in node["neighbors"]:
                c_mod = 1.0
                if node_closed[k] == 1:
                    c_mod *= CLOSURE_FLOW_MULT
                if node_closed[nb_idx] == 1:
                    c_mod *= CLOSURE_FLOW_MULT
                neigh_force += (
                    c_mod
                    * CORRIDOR_COUPLING
                    * hub_factor
                    * beta
                    * (I[nb_idx] / MANTA_NODES[nb_idx]["population"])
                )

            lam = (local_force + neigh_force) * dispersion
            prob_bite = 1.0 - math.exp(-lam) if lam > 0.0 else 0.0

            new_E[k] = sample_binomial(S[k], prob_bite, rng)
            new_I[k] = sample_binomial(E[k], sigma, rng)
            new_R[k] = sample_binomial(I[k], gamma, rng)

        for k in range(num_nodes):
            if S[k] > 0 and new_E[k] > 0 and S_failed[k] > 0:
                bitten_failed = int(round((new_E[k] * S_failed[k]) / S[k]))
                S_failed[k] = max(0, min(S[k] - new_E[k], S_failed[k] - bitten_failed))

            S[k] -= new_E[k]
            E[k] = E[k] + new_E[k] - new_I[k]
            I[k] = I[k] + new_I[k] - new_R[k]
            R[k] += new_R[k]

            cum_inf_by_node[k] += new_E[k]
            cumulative_infected += new_E[k]

        record_day(d)

    return {
        "cumulativeInfected": cumulative_infected,
        "totalDosesApplied": total_doses_applied,
        "totalImmunized": total_immunized,
        "totalFumigations": total_fumigations,
        "totalClosures": total_closures,
        "totalBudgetSpent": total_spent,
        "violations": violations,
        "vaccinatedByNode": vaccinated_by_node,
        "fumigationsByNode": fumigations_by_node,
        "closuresByNode": closures_by_node,
        "cumInfectedByNode": cum_inf_by_node,
        "dailyS": daily_S,
        "dailyE": daily_E,
        "dailyI": daily_I,
        "dailyR": daily_R,
        "dailyCumInf": daily_cum_inf,
        "nodeSnapshots": node_snapshots,
        "first48h": first_48h,
    }


# ==============================================================================
# 4. MONTE CARLO Y GENERACIÓN DE INFORME EJECUTIVO PARA EL ALCALDE DE MANTA
# ==============================================================================
def compute_stats(arr):
    if not arr:
        return {"mean": 0.0, "min": 0, "max": 0}
    return {
        "mean": sum(arr) / len(arr),
        "min": min(arr),
        "max": max(arr),
    }


def build_mayor_recommendation(config, summary):
    pz_node = MANTA_NODES[config["initialNode"]]
    s_none = summary["none"]
    s_rand = summary["random"]
    s_shield = summary["shield"]

    f48 = s_shield["first48h"] or {
        "closures": [],
        "fumigations": [],
        "vaccinatedByNode": [0] * len(MANTA_NODES),
    }

    priority_neighbors = [
        MANTA_NODES[idx]["name"]
        for idx in sorted(
            pz_node["neighbors"],
            key=lambda i: len(MANTA_NODES[i]["neighbors"]),
            reverse=True,
        )[:2]
    ]

    targets = [pz_node["name"]]
    for idx in f48["closures"] + f48["fumigations"]:
        name = MANTA_NODES[idx]["name"]
        if name not in targets:
            targets.append(name)
    for idx, doses in enumerate(f48["vaccinatedByNode"]):
        if doses > 0 and MANTA_NODES[idx]["name"] not in targets:
            targets.append(MANTA_NODES[idx]["name"])
    for name in priority_neighbors:
        if name not in targets:
            targets.append(name)

    saved_mean = int(round(s_shield["savedStats"]["mean"]))
    saved_min = int(round(s_shield["savedStats"]["min"]))
    saved_max = int(round(s_shield["savedStats"]["max"]))

    rand_mean = int(round(s_rand["savedStats"]["mean"]))
    rand_min = int(round(s_rand["savedStats"]["min"]))
    rand_max = int(round(s_rand["savedStats"]["max"]))
    extra_vs_rand = saved_mean - rand_mean

    close_cost = int(round(s_shield["meanClosures"] * COST_NODE_CLOSURE))
    fum_cost = int(round(s_shield["meanFumigations"] * COST_FUMIGATION))
    vac_cost = int(round(s_shield["meanDoses"] * COST_VACCINE_DOSE))
    spent_mean = int(round(s_shield["meanSpent"]))

    return {
        "first48HoursBarrios": targets,
        "summary": (
            f"Señor Alcalde de Manta: Ante el brote iniciado en {pz_node['name']}, "
            f"activar la estrategia inteligente con ${config['budget']:,} (ejecutando ~${spent_mean:,}) "
            f"permite salvar en promedio {saved_mean:,} vidas [Rango: {saved_min:,} - {saved_max:,}] "
            f"en {config['days']} días."
        ),
        "first48HoursPlan": (
            f"Intervenir en las primeras 48 horas: {', '.join(targets)}. "
            f"Contener y fumigar {pz_node['name']} de inmediato mientras se blindan sus accesos "
            f"principales ({' y '.join(priority_neighbors)})."
        ),
        "budgetDistribution": (
            f"Distribución óptima de ${config['budget']:,}: "
            f"${close_cost:,} en cierres selectivos viales (-75% flujo vecino), "
            f"${fum_cost:,} en brigadas de fumigación (-40% contagio local por 5 días), y "
            f"${vac_cost:,} en {int(round(s_shield['meanDoses'])):,} dosis de vacuna ($15 c/u) "
            f"aplicadas estrictamente a población sana (efectividad {config['vaccineEffectiveness']}%)."
        ),
        "livesSavedComparison": (
            f"Frente a no hacer nada: {saved_mean:,} vidas salvadas en promedio [{saved_min:,} - {saved_max:,}]. "
            f"Frente al reparto al azar ({rand_mean:,} salvados [{rand_min:,} - {rand_max:,}]): "
            f"+{extra_vs_rand:,} ciudadanos adicionales protegidos con el mismo presupuesto."
        ),
        "justification": (
            "En vez de diluir recursos al azar por toda la ciudad, la estrategia protege los cruces viales "
            "más conectados como un cortafuegos, apaga el contagio local en el barrio origen y vacuna "
            "únicamente a vecinos sanos sin desperdiciar ni una sola dosis."
        ),
    }


def run_monte_carlo(config):
    runs = config["runs"]
    days = config["days"]
    num_nodes = len(MANTA_NODES)
    sub_seeds = derive_sub_seeds(config["seed"], runs)

    strategy_keys = ("none", "random", "shield")
    agg = {}
    for key in strategy_keys:
        agg[key] = {
            "infected": [],
            "saved": [],
            "doses_sum": 0,
            "imm_sum": 0,
            "fum_sum": 0,
            "close_sum": 0,
            "spent_sum": 0,
            "violations_sum": 0,
            "node_vac": [0.0] * num_nodes,
            "node_fum": [0.0] * num_nodes,
            "node_close": [0.0] * num_nodes,
            "node_inf": [0.0] * num_nodes,
            "daily_S": [0.0] * (days + 1),
            "daily_E": [0.0] * (days + 1),
            "daily_I": [0.0] * (days + 1),
            "daily_R": [0.0] * (days + 1),
            "daily_cum_inf": [0.0] * (days + 1),
            "daily_min_cum": [10**9] * (days + 1),
            "daily_max_cum": [0] * (days + 1),
            "daily_min_I": [10**9] * (days + 1),
            "daily_max_I": [0] * (days + 1),
            "daily_prot": [0.0] * (days + 1),
            "daily_min_prot": [10**9] * (days + 1),
            "daily_max_prot": [0] * (days + 1),
            "sampleSnapshots": None,
            "first48h": None,
        }

    fnv_hash = 0x811C9DC5

    def mix_hash(val):
        nonlocal fnv_hash
        for shift in (0, 8, 16):
            fnv_hash ^= (val >> shift) & 0xFF
            fnv_hash = imul32(fnv_hash, 0x01000193)

    # Ejecución simultánea lógica por semilla para varianza reducida (Common Random Numbers)
    for r, seed in enumerate(sub_seeds):
        rec = r == 0
        res_map = {
            "none": simulate_single_trajectory(seed, "none", config, rec),
            "random": simulate_single_trajectory(seed, "random", config, rec),
            "shield": simulate_single_trajectory(seed, "shield", config, rec),
        }
        base_inf = res_map["none"]["cumulativeInfected"]

        for key in strategy_keys:
            res = res_map[key]
            b = agg[key]
            b["infected"].append(res["cumulativeInfected"])
            b["saved"].append(base_inf - res["cumulativeInfected"])
            b["doses_sum"] += res["totalDosesApplied"]
            b["imm_sum"] += res["totalImmunized"]
            b["fum_sum"] += res["totalFumigations"]
            b["close_sum"] += res["totalClosures"]
            b["spent_sum"] += res["totalBudgetSpent"]
            b["violations_sum"] += res["violations"]

            mix_hash(res["cumulativeInfected"])
            mix_hash(res["totalDosesApplied"])
            mix_hash(res["totalBudgetSpent"])

            for k in range(num_nodes):
                b["node_vac"][k] += res["vaccinatedByNode"][k]
                b["node_fum"][k] += res["fumigationsByNode"][k]
                b["node_close"][k] += res["closuresByNode"][k]
                b["node_inf"][k] += res["cumInfectedByNode"][k]

            for d in range(days + 1):
                c_inf = res["dailyCumInf"][d]
                act_i = res["dailyI"][d]
                prot = TOTAL_CITY_POPULATION - c_inf

                b["daily_S"][d] += res["dailyS"][d]
                b["daily_E"][d] += res["dailyE"][d]
                b["daily_I"][d] += act_i
                b["daily_R"][d] += res["dailyR"][d]
                b["daily_cum_inf"][d] += c_inf
                b["daily_prot"][d] += prot

                if c_inf < b["daily_min_cum"][d]:
                    b["daily_min_cum"][d] = c_inf
                if c_inf > b["daily_max_cum"][d]:
                    b["daily_max_cum"][d] = c_inf

                if act_i < b["daily_min_I"][d]:
                    b["daily_min_I"][d] = act_i
                if act_i > b["daily_max_I"][d]:
                    b["daily_max_I"][d] = act_i

                if prot < b["daily_min_prot"][d]:
                    b["daily_min_prot"][d] = prot
                if prot > b["daily_max_prot"][d]:
                    b["daily_max_prot"][d] = prot

            if rec:
                b["sampleSnapshots"] = res["nodeSnapshots"]
                b["first48h"] = res["first48h"]

    summary = {}
    for key in strategy_keys:
        b = agg[key]
        inf_stats = compute_stats(b["infected"])
        sav_stats = compute_stats(b["saved"])
        summary[key] = {
            "infectedStats": inf_stats,
            "savedStats": sav_stats,
            "meanDoses": b["doses_sum"] / runs,
            "meanImmunized": b["imm_sum"] / runs,
            "meanFumigations": b["fum_sum"] / runs,
            "meanClosures": b["close_sum"] / runs,
            "meanSpent": b["spent_sum"] / runs,
            "violations": b["violations_sum"],
            "nodeMeanVac": [v / runs for v in b["node_vac"]],
            "nodeMeanFum": [v / runs for v in b["node_fum"]],
            "nodeMeanClose": [v / runs for v in b["node_close"]],
            "nodeMeanInf": [v / runs for v in b["node_inf"]],
            "series": {
                "S": [round(v / runs, 2) for v in b["daily_S"]],
                "E": [round(v / runs, 2) for v in b["daily_E"]],
                "I": [round(v / runs, 2) for v in b["daily_I"]],
                "R": [round(v / runs, 2) for v in b["daily_R"]],
                "cumInfectedMean": [round(v / runs, 2) for v in b["daily_cum_inf"]],
                "cumInfectedMin": b["daily_min_cum"],
                "cumInfectedMax": b["daily_max_cum"],
                "activeIMean": [round(v / runs, 2) for v in b["daily_I"]],
                "activeIMin": b["daily_min_I"],
                "activeIMax": b["daily_max_I"],
                "protectedMean": [round(v / runs, 2) for v in b["daily_prot"]],
                "protectedMin": b["daily_min_prot"],
                "protectedMax": b["daily_max_prot"],
            },
            "sampleSnapshots": b["sampleSnapshots"],
            "first48h": b["first48h"],
        }

    hash_hex = f"0x{fnv_hash:08X}"
    mayor_rec = build_mayor_recommendation(config, summary)

    return {
        "ok": True,
        "engine": "aws-lambda-python3.12",
        "hashHex": hash_hex,
        "subSeeds": sub_seeds[:10],
        "scenario": config,
        "strategies": {
            "sinIntervencion": {
                "infectedMean": round(summary["none"]["infectedStats"]["mean"], 1),
                "infectedRange": [
                    summary["none"]["infectedStats"]["min"],
                    summary["none"]["infectedStats"]["max"],
                ],
                "savedMean": 0.0,
                "savedRange": [0, 0],
                "dailyCurves": summary["none"]["series"],
            },
            "alAzar": {
                "infectedMean": round(summary["random"]["infectedStats"]["mean"], 1),
                "infectedRange": [
                    summary["random"]["infectedStats"]["min"],
                    summary["random"]["infectedStats"]["max"],
                ],
                "savedMean": round(summary["random"]["savedStats"]["mean"], 1),
                "savedRange": [
                    summary["random"]["savedStats"]["min"],
                    summary["random"]["savedStats"]["max"],
                ],
                "dailyCurves": summary["random"]["series"],
            },
            "estrategiaInteligente": {
                "infectedMean": round(summary["shield"]["infectedStats"]["mean"], 1),
                "infectedRange": [
                    summary["shield"]["infectedStats"]["min"],
                    summary["shield"]["infectedStats"]["max"],
                ],
                "savedMean": round(summary["shield"]["savedStats"]["mean"], 1),
                "savedRange": [
                    summary["shield"]["savedStats"]["min"],
                    summary["shield"]["savedStats"]["max"],
                ],
                "dailyCurves": summary["shield"]["series"],
            },
        },
        "mayorRecommendation": mayor_rec,
        "summary": summary,
    }


# ==============================================================================
# 5. PARSEO DE ENTRADA Y HANDLER PRINCIPAL AWS LAMBDA
# ==============================================================================
def resolve_initial_node(raw_node):
    if isinstance(raw_node, int):
        return max(0, min(len(MANTA_NODES) - 1, raw_node))
    if isinstance(raw_node, str):
        cleaned = raw_node.strip().lower()
        if cleaned.isdigit():
            return max(0, min(len(MANTA_NODES) - 1, int(cleaned)))
        for node in MANTA_NODES:
            if cleaned in (node["id"].lower(), node["name"].lower()):
                return node["index"]
    return 6  # Defecto: Los Esteros


def parse_scenario_payload(body_dict):
    def get_num(keys, default, cast_fn, min_v, max_v):
        for k in keys:
            if k in body_dict and body_dict[k] is not None:
                try:
                    return max(min_v, min(max_v, cast_fn(body_dict[k])))
                except (ValueError, TypeError):
                    pass
        return default

    def get_bool(key, default=True):
        if key in body_dict and body_dict[key] is not None:
            return bool(body_dict[key])
        return default

    raw_init = body_dict.get("initialNode", body_dict.get("patientZeroIndex", 6))

    return {
        "seed": get_num(("seed",), 2026, int, 0, 2147483647),
        "runs": get_num(("runs",), 50, int, 1, 300),
        "days": get_num(("days",), 60, int, 10, 365),
        "beta": get_num(("beta",), 0.72, float, 0.05, 2.5),
        "vaccines": get_num(("vaccines", "totalVaccines"), 24000, int, 0, 100000),
        "vaccineEffectiveness": get_num(
            ("vaccineEffectiveness", "vaccineEfficacyPct"), 85, float, 10.0, 100.0
        ),
        "initialNode": resolve_initial_node(raw_init),
        "budget": get_num(("budget", "totalBudget"), 50000, int, 0, 2000000),
        "incubationDays": get_num(("incubationDays",), 3, int, 1, 30),
        "dailyDoseArrival": get_num(("dailyDoseArrival",), 800, int, 0, 20000),
        "dailyBrigadeArrival": get_num(("dailyBrigadeArrival",), 2, int, 0, 20),
        "useVaccines": get_bool("useVaccines", True),
        "useFumigation": get_bool("useFumigation", True),
        "useClosure": get_bool("useClosure", True),
    }


def lambda_handler(event, context):
    """Punto de entrada oficial para AWS Lambda (Python 3.12) con Function URL o API Gateway."""
    if not isinstance(event, dict):
        event = {}

    http_method = (
        event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("httpMethod")
        or "POST"
    ).upper()

    # Preflight CORS
    if http_method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({"ok": True, "cors": "enabled"}),
        }

    try:
        raw_body = event.get("body")
        if isinstance(raw_body, str) and raw_body.strip():
            payload = json.loads(raw_body)
        elif isinstance(raw_body, dict):
            payload = raw_body
        else:
            payload = event

        if not isinstance(payload, dict):
            payload = {}

        scenario_cfg = parse_scenario_payload(payload)
        result = run_monte_carlo(scenario_cfg)

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps(result, ensure_ascii=False),
        }
    except Exception as exc:
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps(
                {"ok": False, "error": f"Solicitud inválida: {str(exc)}"},
                ensure_ascii=False,
            ),
        }
