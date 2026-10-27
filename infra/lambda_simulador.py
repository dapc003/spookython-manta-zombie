"""
OPERACIÓN CONTENCIÓN MANTA · AWS LAMBDA MULTICAPA (PYTHON 3.12)
SpookyThon 2026 — Track B (La Plaga Zombie) & Modo Científico Real (Dengue INEC/MSP)

Capacidades de Arquitectura Serverless:
1. Soporta OPTIONS, GET y POST con cabeceras CORS abiertas (*).
2. Ejecución Fan-Out Paralela: procesa rangos deterministas de sub-semillas (subSeeds)
   devolviendo acumuladores exactos (shardRaw) para que N workers paralelos produzcan
   exactamente el mismo resultado y Hash FNV-1a de 32 bits que una corrida secuencial.
3. Estrategia mejorada "Escudo de Centralidad + Cerco Perimetral Adaptativo" respetando
   la Regla Estricta (0 vacunas a Expuestos, Infectados o Recuperados; 100% solo Sanos).
4. Integración AWS Multicapa resiliente con boto3 (bloques try/except seguros):
   - Lectura de calibración desde Bucket S3 privado (DATASET_BUCKET = spookython-manta-datos-2026)
     con respaldo inmediato al dataset local INEC/MSP.
   - Registro y consulta de auditoría inmutable en Amazon DynamoDB (SpookyThonSimulations).
   - Telemetría meteorológica en vivo desde Open-Meteo para Manta (-0.9677, -80.7089).
"""

from datetime import datetime, timezone
from decimal import Decimal
import json
import math
import os
import random
import urllib.request
import uuid

try:
    import boto3
    from botocore.config import Config as BotoConfig

    BOTO3_AVAILABLE = True
except Exception:
    boto3 = None
    BotoConfig = None
    BOTO3_AVAILABLE = False

# ==============================================================================
# 1. CONFIGURACIÓN AWS Y DATASET DE RESPALDO INEC / MSP DE MANTA
# ==============================================================================
DATASET_BUCKET = os.environ.get("DATASET_BUCKET", "spookython-manta-datos-2026")
DATASET_KEY = os.environ.get("DATASET_KEY", "manta_inec_msp_dataset.json")
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "SpookyThonSimulations")
OPEN_METEO_MANTA_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude=-0.9677&longitude=-80.7089"
    "&current=temperature_2m,relative_humidity_2m,precipitation"
)

LOCAL_FALLBACK_DATASET = {
    "datasetId": "INEC-MSP-MANTA-2026-V2",
    "modes": {
        "zombie": {
            "code": "PLAGA_ZOMBIE",
            "betaBase": 0.72,
            "incubationDays": 3,
            "recoveryGamma": 0.20,
            "corridorCoupling": 0.025,
            "initialCases": 10,
        },
        "dengue": {
            "code": "DENGUE_INEC_MSP",
            "betaBase": 0.58,
            "incubationDays": 5,
            "recoveryGamma": 0.1667,
            "corridorCoupling": 0.028,
            "initialCases": 14,
        },
    },
    "nodes": [
        {
            "id": "mercado",
            "index": 0,
            "name": "Mercado de Tarqui",
            "lat": -0.9538,
            "lng": -80.7082,
            "population": 15000,
            "aedesBreteauIndex": 18.4,
            "neighbors": [2, 6, 1, 5],
        },
        {
            "id": "terminal",
            "index": 1,
            "name": "Terminal Terrestre",
            "lat": -0.9615,
            "lng": -80.6928,
            "population": 12000,
            "aedesBreteauIndex": 15.2,
            "neighbors": [0, 3, 6, 2],
        },
        {
            "id": "centro",
            "index": 2,
            "name": "Centro de Manta",
            "lat": -0.9496,
            "lng": -80.7214,
            "population": 18000,
            "aedesBreteauIndex": 13.8,
            "neighbors": [0, 1, 4, 5],
        },
        {
            "id": "uleam",
            "index": 3,
            "name": "ULEAM",
            "lat": -0.9529,
            "lng": -80.7456,
            "population": 14000,
            "aedesBreteauIndex": 11.6,
            "neighbors": [1, 4, 7],
        },
        {
            "id": "murcielago",
            "index": 4,
            "name": "Playa El Murciélago",
            "lat": -0.9418,
            "lng": -80.7319,
            "population": 10000,
            "aedesBreteauIndex": 10.4,
            "neighbors": [2, 3, 7],
        },
        {
            "id": "hospital",
            "index": 5,
            "name": "Hospital Rodríguez Zambrano",
            "lat": -0.9602,
            "lng": -80.7385,
            "population": 8000,
            "aedesBreteauIndex": 9.8,
            "neighbors": [2, 0, 7],
        },
        {
            "id": "esteros",
            "index": 6,
            "name": "Los Esteros",
            "lat": -0.9482,
            "lng": -80.7011,
            "population": 16000,
            "aedesBreteauIndex": 21.5,
            "neighbors": [0, 1],
        },
        {
            "id": "san_mateo",
            "index": 7,
            "name": "San Mateo",
            "lat": -0.9885,
            "lng": -80.8092,
            "population": 7000,
            "aedesBreteauIndex": 14.1,
            "neighbors": [3, 4, 5],
        },
    ],
    "mobilityMatrix": [
        [0.000, 0.032, 0.036, 0.000, 0.000, 0.022, 0.034, 0.000],
        [0.032, 0.000, 0.030, 0.026, 0.000, 0.000, 0.028, 0.000],
        [0.036, 0.030, 0.000, 0.000, 0.028, 0.026, 0.000, 0.000],
        [0.000, 0.026, 0.000, 0.000, 0.025, 0.000, 0.000, 0.019],
        [0.000, 0.000, 0.028, 0.025, 0.000, 0.000, 0.000, 0.018],
        [0.022, 0.000, 0.026, 0.000, 0.000, 0.000, 0.000, 0.016],
        [0.034, 0.028, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000],
        [0.000, 0.000, 0.000, 0.019, 0.018, 0.016, 0.000, 0.000],
    ],
}

MANTA_NODES = LOCAL_FALLBACK_DATASET["nodes"]
TOTAL_CITY_POPULATION = sum(n["population"] for n in MANTA_NODES)  # 100,000

# Costos oficiales de Intervenciones Combinadas
COST_VACCINE_DOSE = 15          # $15 por dosis (solo población Sana)
COST_FUMIGATION = 1200          # $1,200 por barrio (-40% contagio local por 5 días)
FUMIGATION_DURATION_DAYS = 5
FUMIGATION_LOCAL_MULT = 0.60
COST_NODE_CLOSURE = 3500        # $3,500 por barrio (-75% flujo inter-barrial)
CLOSURE_FLOW_MULT = 0.25
TACTICAL_BRIGADE_SIZE = 100

CORS_HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
}

# Caché en contenedor tibio (Warm Container) para evitar latencia repetitiva
_CACHED_DATASET = None
_CACHED_DATASET_SOURCE = None
_S3_ATTEMPTED = False
_DYNAMO_DISABLED_IN_CONTAINER = False
_MEMORY_AUDIT_RING = []


# ==============================================================================
# 2. INTEGRACIONES AWS S3 PRIVADO, DYNAMODB Y CLIMA REAL OPEN-METEO
# ==============================================================================
def _fast_boto_config():
    if BotoConfig is None:
        return None
    return BotoConfig(
        connect_timeout=1.1,
        read_timeout=1.2,
        retries={"max_attempts": 1, "mode": "standard"},
    )


def load_calibration_dataset():
    """
    Intenta leer el archivo de calibración desde un Bucket S3 privado
    (DATASET_BUCKET = spookython-manta-datos-2026) con fallback inmediato
    al archivo empaquetado o al diccionario oficial INEC/MSP en memoria.
    """
    global _CACHED_DATASET, _CACHED_DATASET_SOURCE, _S3_ATTEMPTED
    if _CACHED_DATASET is not None:
        return _CACHED_DATASET, _CACHED_DATASET_SOURCE

    if BOTO3_AVAILABLE and not _S3_ATTEMPTED and os.environ.get("SKIP_AWS_IO") != "1":
        _S3_ATTEMPTED = True
        try:
            s3 = boto3.client("s3", config=_fast_boto_config())
            obj = s3.get_object(Bucket=DATASET_BUCKET, Key=DATASET_KEY)
            raw_bytes = obj["Body"].read()
            parsed = json.loads(raw_bytes.decode("utf-8"))
            if isinstance(parsed, dict) and "nodes" in parsed:
                _CACHED_DATASET = parsed
                _CACHED_DATASET_SOURCE = f"s3://{DATASET_BUCKET}/{DATASET_KEY}"
                return _CACHED_DATASET, _CACHED_DATASET_SOURCE
        except Exception:
            pass

    # Intento secundario: archivo JSON local junto a la función Lambda
    try:
        local_path = os.path.join(os.path.dirname(__file__), "manta_inec_msp_dataset.json")
        if os.path.exists(local_path):
            with open(local_path, "r", encoding="utf-8") as fh:
                parsed = json.load(fh)
                if isinstance(parsed, dict) and "nodes" in parsed:
                    _CACHED_DATASET = parsed
                    _CACHED_DATASET_SOURCE = "local-bundle:manta_inec_msp_dataset.json"
                    return _CACHED_DATASET, _CACHED_DATASET_SOURCE
    except Exception:
        pass

    _CACHED_DATASET = LOCAL_FALLBACK_DATASET
    _CACHED_DATASET_SOURCE = "embedded-fallback:INEC-MSP-MANTA-2026"
    return _CACHED_DATASET, _CACHED_DATASET_SOURCE


def compute_climate_calibrated_beta(base_beta, temp_c, humidity_pct, precip_mm):
    """
    Modelo térmico-entomológico de Brière / Mordecai adaptado a la costa de Manta:
    Óptimo vectorial ~28.5°C, supervivencia favorecida con humedad > 65% y criaderos por lluvia.
    """
    t_eff = max(14.5, min(38.0, float(temp_c)))
    rh_eff = max(20.0, min(100.0, float(humidity_pct)))
    p_eff = max(0.0, min(50.0, float(precip_mm)))

    def briere_term(t):
        return t * (t - 13.5) * math.sqrt(max(0.01, 39.0 - t))

    phi_temp = briere_term(t_eff) / briere_term(26.5)
    phi_rh = max(0.75, min(1.25, 1.0 + 0.0045 * (rh_eff - 76.0)))
    phi_rain = 1.0 + min(0.28, 0.035 * p_eff)

    calibrated = base_beta * phi_temp * phi_rh * phi_rain
    return round(max(0.15, min(2.20, calibrated)), 2), {
        "phiTemp": round(phi_temp, 3),
        "phiHumidity": round(phi_rh, 3),
        "phiRain": round(phi_rain, 3),
        "combinedMultiplier": round(phi_temp * phi_rh * phi_rain, 3),
    }


def fetch_manta_live_weather():
    """Consulta Open-Meteo en tiempo real para Manta con respaldo climatológico seguro."""
    try:
        req = urllib.request.Request(
            OPEN_METEO_MANTA_URL,
            headers={"User-Agent": "OperacionContencionManta-SpookyThon/2.0"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=2.2) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            curr = data.get("current", {})
            temp_c = float(curr.get("temperature_2m", 26.8))
            humidity = float(curr.get("relative_humidity_2m", 78.0))
            precip = float(curr.get("precipitation", 0.0))
            beta_zombie, factors = compute_climate_calibrated_beta(0.72, temp_c, humidity, precip)
            beta_dengue, _ = compute_climate_calibrated_beta(0.58, temp_c, humidity, precip)
            return {
                "live": True,
                "source": "open-meteo-live",
                "latitude": -0.9677,
                "longitude": -80.7089,
                "temperatureC": round(temp_c, 1),
                "humidityPct": round(humidity, 0),
                "precipitationMm": round(precip, 2),
                "observedAt": curr.get("time") or datetime.now(timezone.utc).isoformat(),
                "calibratedBetaZombie": beta_zombie,
                "calibratedBetaDengue": beta_dengue,
                "factors": factors,
            }
    except Exception:
        beta_zombie, factors = compute_climate_calibrated_beta(0.72, 26.8, 78.0, 0.0)
        beta_dengue, _ = compute_climate_calibrated_beta(0.58, 26.8, 78.0, 0.0)
        return {
            "live": False,
            "source": "climatologia-costera-manta-fallback",
            "latitude": -0.9677,
            "longitude": -80.7089,
            "temperatureC": 26.8,
            "humidityPct": 78.0,
            "precipitationMm": 0.0,
            "observedAt": datetime.now(timezone.utc).isoformat(),
            "calibratedBetaZombie": beta_zombie,
            "calibratedBetaDengue": beta_dengue,
            "factors": factors,
        }


def _normalize_dynamo_item(item):
    return {
        "SimulationId": str(item.get("SimulationId", "")),
        "Timestamp": str(item.get("Timestamp", "")),
        "Seed": int(item.get("Seed", 2026)),
        "Mode": str(item.get("Mode", "PLAGA_ZOMBIE")),
        "Runs": int(item.get("Runs", 50)),
        "SavedLivesMean": round(float(item.get("SavedLivesMean", 0.0)), 1),
        "HashFirma": str(item.get("HashFirma", "0x00000000")),
        "BudgetUsed": round(float(item.get("BudgetUsed", 0.0)), 0),
    }


def save_and_fetch_dynamo_audit(audit_entry=None, max_items=8):
    """
    Guarda un registro de auditoría en Amazon DynamoDB (SpookyThonSimulations)
    y devuelve las últimas corridas registradas. Usa try/except seguros para
    jamás fallar si la tabla o los permisos IAM aún no están desplegados.
    """
    global _DYNAMO_DISABLED_IN_CONTAINER, _MEMORY_AUDIT_RING

    if audit_entry is not None:
        normalized_local = _normalize_dynamo_item(audit_entry)
        # Evitar duplicados consecutivos con mismo SimulationId
        _MEMORY_AUDIT_RING = [
            x for x in _MEMORY_AUDIT_RING if x["SimulationId"] != normalized_local["SimulationId"]
        ]
        _MEMORY_AUDIT_RING.insert(0, normalized_local)
        _MEMORY_AUDIT_RING = _MEMORY_AUDIT_RING[:max_items]

    if BOTO3_AVAILABLE and not _DYNAMO_DISABLED_IN_CONTAINER and os.environ.get("SKIP_AWS_IO") != "1":
        try:
            dynamodb = boto3.resource("dynamodb", config=_fast_boto_config())
            table = dynamodb.Table(DYNAMODB_TABLE)

            if audit_entry is not None:
                dynamo_item = {
                    "SimulationId": str(audit_entry["SimulationId"]),
                    "Timestamp": str(audit_entry["Timestamp"]),
                    "Seed": int(audit_entry["Seed"]),
                    "Mode": str(audit_entry["Mode"]),
                    "Runs": int(audit_entry.get("Runs", 50)),
                    "SavedLivesMean": Decimal(str(round(float(audit_entry["SavedLivesMean"]), 1))),
                    "HashFirma": str(audit_entry["HashFirma"]),
                    "BudgetUsed": Decimal(str(int(round(float(audit_entry["BudgetUsed"]))))),
                }
                table.put_item(Item=dynamo_item)

            scan_resp = table.scan(Limit=25)
            raw_items = scan_resp.get("Items", [])
            parsed_items = [_normalize_dynamo_item(it) for it in raw_items]
            parsed_items.sort(key=lambda x: x["Timestamp"], reverse=True)
            return parsed_items[:max_items], f"dynamodb:{DYNAMODB_TABLE}"
        except Exception:
            _DYNAMO_DISABLED_IN_CONTAINER = True

    return list(_MEMORY_AUDIT_RING[:max_items]), "memory-fallback-safe"


# ==============================================================================
# 3. PRNG DETERMINISTA Y MUESTREADORES DE NÚMEROS ALEATORIOS COMUNES
# ==============================================================================
def imul32(a, b):
    return ((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF)) & 0xFFFFFFFF


def mulberry32_next(state):
    """Avanza exactamente un paso de 32 bits del generador mulberry32(seed)."""
    state = (state + 0x6D2B79F5) & 0xFFFFFFFF
    t = state
    t = imul32(t ^ (t >> 15), t | 1)
    t = (t ^ (t + imul32(t ^ (t >> 7), t | 61))) & 0xFFFFFFFF
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
            seeds.append(int(math.floor(val * 4294967296.0)) & 0xFFFFFFFF)
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
    """Consume exactamente 2 extracciones de rng para preservar Números Aleatorios Comunes."""
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
    min_possible = max(0, draws - (total_pop - success_pop))
    max_possible = min(draws, success_pop)
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
    var = max(0.0, draws * p * (1.0 - p) * fpc)
    u1 = max(1e-12, rng.random())
    u2 = rng.random()
    z = _sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
    sampled = round(mean + _sqrt(var) * z)
    return max(min_possible, min(max_possible, sampled))


# ==============================================================================
# 4. MOTOR SEIR + ESCUDO DE CENTRALIDAD Y CERCO PERIMETRAL ADAPTATIVO
# ==============================================================================
def compute_shield_score(node_idx, S, E, I, efficacy=0.85):
    """
    Índice compuesto del 'Escudo de Centralidad + Cerco Perimetral Adaptativo':
    1. Base topológica: Conexiones * Infectados_Vecinos * (Sanos_Locales / Pob_Local).
    2. Anillo Perimetral Adaptativo: Si un nodo central ya presenta brote activo interno
       (ej. foco en Mercado de Tarqui) o la vacuna tiene menor efectividad, evita diluir
       vacunas dentro del foco expuesto y amplifica (x2.35) el anillo en sus vecinos sanos.
    """
    if S[node_idx] <= 0:
        return 0.0
    node = MANTA_NODES[node_idx]
    neighbors = node["neighbors"]
    deg = len(neighbors)

    neighbor_infected = 0
    neighbor_active_hub = False
    for nb in neighbors:
        nb_load = I[nb] + 0.5 * E[nb]
        neighbor_infected += I[nb]
        if nb_load >= 6 and (len(MANTA_NODES[nb]["neighbors"]) >= 3 or efficacy <= 0.65):
            neighbor_active_hub = True

    healthy_ratio = S[node_idx] / node["population"]
    base_score = deg * neighbor_infected * healthy_ratio

    local_active_load = I[node_idx] + E[node_idx]
    local_prevalence = local_active_load / node["population"]

    # Verificar si existen vecinos aún sanos alrededor de este foco activo para formar el anillo
    has_healthy_perimeter = False
    if local_active_load >= 6:
        for nb in neighbors:
            if (S[nb] / MANTA_NODES[nb]["population"]) > 0.35 and (I[nb] + E[nb]) < local_active_load:
                has_healthy_perimeter = True
                break

    ring_multiplier = 1.0
    if local_active_load >= 8 and has_healthy_perimeter and (deg >= 3 or efficacy <= 0.65 or local_prevalence >= 0.008):
        # Evita desperdiciar dosis en el epicentro expuesto mientras se blinda el anillo vecino
        ring_multiplier = 0.18
    elif neighbor_active_hub and local_prevalence < 0.035:
        # Impulsa el anillo de vacunación preventiva en los barrios colindantes al foco
        ring_multiplier = 2.35

    return base_score * ring_multiplier


def simulate_single_trajectory(run_seed, strategy, config, dataset, record_history=False):
    nodes = dataset.get("nodes", MANTA_NODES)
    mobility_matrix = dataset.get("mobilityMatrix")
    mode_key = config.get("mode", "zombie")
    mode_meta = dataset.get("modes", {}).get(mode_key, LOCAL_FALLBACK_DATASET["modes"]["zombie"])

    num_nodes = len(nodes)
    days = config["days"]
    beta = config["beta"]
    sigma = 1.0 / max(1, config["incubationDays"])
    gamma = float(mode_meta.get("recoveryGamma", 0.20))
    corridor_coupling = float(mode_meta.get("corridorCoupling", 0.025))
    initial_cases = int(mode_meta.get("initialCases", 10))
    efficacy = max(0.10, min(1.0, config["vaccineEffectiveness"] / 100.0))
    is_dengue = mode_key == "dengue"

    S = [n["population"] for n in nodes]
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
    init_z = min(initial_cases, S[pz])
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
                        "score": round(compute_shield_score(k, S, E, I, efficacy), 2),
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

        # FASE 1: INTERVENCIONES COMBINADAS Y VACUNACIÓN ESTRICTA A POBLACIÓN SANA
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
                doses_left = min(cold_chain_doses, min(max_aff, elig_pool))
                pool_left = elig_pool

                for k in range(num_nodes):
                    if doses_left <= 0:
                        break
                    elig_barrio = S[k] - S_failed[k]
                    if elig_barrio <= 0:
                        continue

                    alloc = sample_hypergeometric(pool_left, elig_barrio, doses_left, policy_rng)
                    if alloc > S[k]:
                        violations += alloc - S[k]

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
                    pool_left -= elig_barrio

        elif strategy == "shield" and cash_rem > 0:
            pz_is_central = len(nodes[pz]["neighbors"]) >= 3
            max_closures = (
                8
                if not config["useVaccines"]
                else (
                    max(1, min(5, config["budget"] // 9000))
                    if (efficacy <= 0.60 or pz_is_central)
                    else max(1, min(4, config["budget"] // 12500))
                )
            )

            # 2A. Cerco Sanitario Selectivo ($3,500, -75% flujo inter-barrial) en origen y puentes
            if config["useClosure"]:
                while (
                    brigades_left > 0
                    and cash_rem >= COST_NODE_CLOSURE
                    and total_closures < max_closures
                ):
                    best_c = -1
                    best_c_score = 0.0
                    for k in range(num_nodes):
                        if node_closed[k] == 1:
                            continue
                        deg = len(nodes[k]["neighbors"])
                        neigh_z = sum(I[nb] for nb in nodes[k]["neighbors"])
                        s_frac = S[k] / nodes[k]["population"]
                        c_score = 0.0
                        if I[k] >= 4 or (k == pz and (I[k] + E[k]) >= 3):
                            c_score = 1800.0 + (I[k] + 0.5 * E[k]) * deg * 15.0
                        elif neigh_z >= 5:
                            c_score = deg * neigh_z * s_frac * 3.4
                        if c_score > best_c_score:
                            best_c_score = c_score
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

            # 2B. Brigada de Fumigación / Control Vectorial ($1,200, -40% contagio local por 5 días)
            if config["useFumigation"]:
                while brigades_left > 0 and cash_rem >= COST_FUMIGATION:
                    best_f = -1
                    best_f_score = 0.0
                    for k in range(num_nodes):
                        if fum_days_left[k] > 0 or S[k] < 150:
                            continue
                        act_load = I[k] + 0.5 * E[k]
                        if act_load < 3.5:
                            continue
                        s_frac = S[k] / nodes[k]["population"]
                        deg = len(nodes[k]["neighbors"])
                        vector_weight = (
                            (nodes[k].get("aedesBreteauIndex", 14.0) / 14.0) if is_dengue else 1.0
                        )
                        f_score = act_load * s_frac * (1.0 + 0.35 * deg) * vector_weight
                        if f_score > best_f_score:
                            best_f_score = f_score
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

            # 2C. Vacunación con Anillo Perimetral Adaptativo ($15/dosis, 100% solo Sanos)
            if (
                config["useVaccines"]
                and cold_chain_doses > 0
                and cash_rem >= COST_VACCINE_DOSE
            ):
                reserve_ratio = (
                    0.26
                    if efficacy <= 0.55
                    else (0.14 if pz_is_central else 0.08)
                )
                fum_reserve = (
                    min(cash_rem, int(round(config["budget"] * reserve_ratio)))
                    if (config["useFumigation"] or config["useClosure"]) and d <= 18
                    else 0
                )
                spendable = max(0, cash_rem - fum_reserve)
                max_aff = spendable // COST_VACCINE_DOSE
                elig_total = sum(S[k] - S_failed[k] for k in range(num_nodes))
                doses_left = min(cold_chain_doses, min(max_aff, elig_total))

                while doses_left > 0:
                    step = min(TACTICAL_BRIGADE_SIZE, doses_left)
                    best_n = -1
                    best_s = -1.0

                    for k in range(num_nodes):
                        elig = S[k] - S_failed[k]
                        if elig <= 0:
                            continue
                        sc = compute_shield_score(k, S, E, I, efficacy) * (elig / max(1, S[k]))
                        if sc > best_s:
                            best_s = sc
                            best_n = k

                    if best_n == -1 or best_s <= 0.0:
                        best_n = -1
                        best_s = -1.0
                        for k in range(num_nodes):
                            elig = S[k] - S_failed[k]
                            if elig <= 0:
                                continue
                            # Si el foco es central, priorizar primero vecinos conectados al foco
                            is_ring_nb = 2.2 if (pz in nodes[k]["neighbors"] and k != pz) else 1.0
                            fb = (
                                len(nodes[k]["neighbors"])
                                * is_ring_nb
                                * (elig / nodes[k]["population"])
                            )
                            if fb > best_s:
                                best_s = fb
                                best_n = k

                    if best_n == -1:
                        break
                    elig_best = S[best_n] - S_failed[best_n]
                    if elig_best <= 0:
                        break

                    alloc = min(step, elig_best)
                    if alloc > S[best_n]:
                        violations += alloc - S[best_n]

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
            node = nodes[k]
            rng = epi_rng

            dispersion = 0.60 + 0.80 * rng.random()
            local_mod = FUMIGATION_LOCAL_MULT if fum_days_left[k] > 0 else 1.0
            breteau_mod = (
                (0.85 + 0.30 * (node.get("aedesBreteauIndex", 14.0) / 15.0))
                if is_dengue
                else 1.0
            )
            local_force = local_mod * breteau_mod * beta * (I[k] / node["population"])

            hub_factor = len(node["neighbors"]) / 3.0
            neigh_force = 0.0
            for nb_idx in node["neighbors"]:
                c_mod = 1.0
                if node_closed[k] == 1:
                    c_mod *= CLOSURE_FLOW_MULT
                if node_closed[nb_idx] == 1:
                    c_mod *= CLOSURE_FLOW_MULT

                edge_coupling = (
                    mobility_matrix[k][nb_idx]
                    if (is_dengue and mobility_matrix is not None)
                    else (corridor_coupling * hub_factor)
                )
                neigh_force += (
                    c_mod
                    * edge_coupling
                    * beta
                    * (I[nb_idx] / nodes[nb_idx]["population"])
                )

            lam = (local_force + neigh_force) * dispersion
            prob_exposure = 1.0 - math.exp(-lam) if lam > 0.0 else 0.0

            new_E[k] = sample_binomial(S[k], prob_exposure, rng)
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
# 5. MONTE CARLO, SHARDING FAN-OUT E INFORME EJECUTIVO PARA EL ALCALDE DE MANTA
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
        )[:3]
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

    mode_label = (
        "Epidemia de Dengue (INEC/MSP)"
        if config.get("mode") == "dengue"
        else "Plaga Zombie (Track B)"
    )

    return {
        "modeLabel": mode_label,
        "first48HoursBarrios": targets,
        "summary": (
            f"Señor Alcalde de Manta: Ante el brote ({mode_label}) detectado en {pz_node['name']}, "
            f"activar el 'Escudo de Centralidad + Cerco Perimetral Adaptativo' con ${config['budget']:,} "
            f"(ejecutando ~${spent_mean:,}) salva en promedio {saved_mean:,} vidas "
            f"[Rango: {saved_min:,} - {saved_max:,}] en {config['days']} días."
        ),
        "first48HoursPlan": (
            f"Intervenir en las primeras 48 horas: {', '.join(targets)}. "
            f"Aplicar cerco sanitario y fumigación en {pz_node['name']} mientras se despliega "
            f"el anillo perimetral de vacunación sobre {', '.join(priority_neighbors[:2])}."
        ),
        "budgetDistribution": (
            f"Distribución óptima de ${config['budget']:,}: "
            f"${close_cost:,} en cercos sanitarios selectivos (-75% flujo inter-barrial), "
            f"${fum_cost:,} en brigadas de fumigación/control vectorial (-40% contagio local por 5 días), y "
            f"${vac_cost:,} en {int(round(s_shield['meanDoses'])):,} dosis de vacuna ($15 c/u) "
            f"aplicadas estrictamente a población sana (efectividad {config['vaccineEffectiveness']}%)."
        ),
        "livesSavedComparison": (
            f"Frente a no hacer nada: {saved_mean:,} vidas salvadas en promedio [{saved_min:,} - {saved_max:,}]. "
            f"Frente al reparto al azar ({rand_mean:,} salvados [{rand_min:,} - {rand_max:,}]): "
            f"+{extra_vs_rand:,} ciudadanos adicionales protegidos con el mismo techo presupuestario."
        ),
        "justification": (
            "Cuando el brote golpea un nodo central o baja la efectividad vacunal, el algoritmo evita "
            "desperdiciar dosis dentro del foco ya expuesto: sella y fumiga el origen mientras levanta "
            "un anillo inmunológico preventivo en los barrios vecinos conectados."
        ),
    }


def run_monte_carlo(config):
    dataset, dataset_source = load_calibration_dataset()
    explicit_sub_seeds = config.get("subSeeds")
    if isinstance(explicit_sub_seeds, list) and len(explicit_sub_seeds) > 0:
        sub_seeds = [int(s) & 0xFFFFFFFF for s in explicit_sub_seeds[:500]]
    else:
        sub_seeds = derive_sub_seeds(config["seed"], config["runs"])

    runs = len(sub_seeds)
    days = config["days"]
    num_nodes = len(MANTA_NODES)
    include_detail = config.get("workerIndex", 0) == 0

    strategy_keys = ("none", "random", "shield")
    agg = {}
    for key in strategy_keys:
        agg[key] = {
            "infected": [],
            "saved": [],
            "doses": [],
            "spent": [],
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

    for r, seed in enumerate(sub_seeds):
        rec = include_detail and (r == 0)
        res_map = {
            "none": simulate_single_trajectory(seed, "none", config, dataset, rec),
            "random": simulate_single_trajectory(seed, "random", config, dataset, rec),
            "shield": simulate_single_trajectory(seed, "shield", config, dataset, rec),
        }
        base_inf = res_map["none"]["cumulativeInfected"]

        for key in strategy_keys:
            res = res_map[key]
            b = agg[key]
            saved_val = base_inf - res["cumulativeInfected"]
            b["infected"].append(res["cumulativeInfected"])
            b["saved"].append(saved_val)
            b["doses"].append(res["totalDosesApplied"])
            b["spent"].append(res["totalBudgetSpent"])

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
    shard_raw = {}
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

        if config.get("totalWorkers", 1) > 1:
            shard_raw[key] = {
                "infected": b["infected"],
                "saved": b["saved"],
                "doses": b["doses"],
                "spent": b["spent"],
                "dosesSum": b["doses_sum"],
                "immSum": b["imm_sum"],
                "fumSum": b["fum_sum"],
                "closeSum": b["close_sum"],
                "spentSum": b["spent_sum"],
                "violationsSum": b["violations_sum"],
                "nodeVacSum": b["node_vac"],
                "nodeFumSum": b["node_fum"],
                "nodeCloseSum": b["node_close"],
                "nodeInfSum": b["node_inf"],
                "dailySums": {
                    "S": b["daily_S"],
                    "E": b["daily_E"],
                    "I": b["daily_I"],
                    "R": b["daily_R"],
                    "cumInf": b["daily_cum_inf"],
                    "prot": b["daily_prot"],
                },
                "dailyMin": {
                    "cumInf": b["daily_min_cum"],
                    "I": b["daily_min_I"],
                    "prot": b["daily_min_prot"],
                },
                "dailyMax": {
                    "cumInf": b["daily_max_cum"],
                    "I": b["daily_max_I"],
                    "prot": b["daily_max_prot"],
                },
                "sampleSnapshots": b["sampleSnapshots"],
                "first48h": b["first48h"],
            }

    hash_hex = f"0x{fnv_hash:08X}"
    mayor_rec = build_mayor_recommendation(config, summary) if include_detail else None

    audit_history = []
    audit_source = "skipped-worker-shard"
    if config.get("totalWorkers", 1) == 1 and config.get("recordAudit", True):
        mode_code = "DENGUE_INEC_MSP" if config.get("mode") == "dengue" else "PLAGA_ZOMBIE"
        audit_entry = {
            "SimulationId": f"SIM-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}",
            "Timestamp": datetime.now(timezone.utc).isoformat(),
            "Seed": config["seed"],
            "Mode": mode_code,
            "Runs": runs,
            "SavedLivesMean": round(summary["shield"]["savedStats"]["mean"], 1),
            "HashFirma": hash_hex,
            "BudgetUsed": round(summary["shield"]["meanSpent"], 0),
        }
        audit_history, audit_source = save_and_fetch_dynamo_audit(audit_entry)
    elif include_detail:
        audit_history, audit_source = save_and_fetch_dynamo_audit(None)

    response_payload = {
        "ok": True,
        "engine": "aws-lambda-python3.12-multilayer",
        "datasetSource": dataset_source,
        "auditStorageSource": audit_source,
        "auditHistory": audit_history,
        "workerIndex": config.get("workerIndex", 0),
        "totalWorkers": config.get("totalWorkers", 1),
        "hashHex": hash_hex,
        "subSeeds": sub_seeds[:10],
        "scenario": {k: v for k, v in config.items() if k != "subSeeds"},
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

    if shard_raw:
        response_payload["shardRaw"] = shard_raw

    return response_payload


# ==============================================================================
# 6. PARSEO SEGURO DE ENTRADA (INPUT CLAMPING) Y HANDLER AWS LAMBDA
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

    raw_mode = str(body_dict.get("mode", "zombie")).strip().lower()
    mode = "dengue" if raw_mode in ("dengue", "dengue_inec_msp", "msp", "real") else "zombie"
    default_beta = 0.58 if mode == "dengue" else 0.72
    default_inc = 5 if mode == "dengue" else 3
    default_eff = 80.0 if mode == "dengue" else 85.0

    raw_init = body_dict.get("initialNode", body_dict.get("patientZeroIndex", 6))

    cfg = {
        "mode": mode,
        "seed": get_num(("seed",), 2026, int, 0, 2147483647),
        "runs": get_num(("runs",), 50, int, 1, 500),
        "days": get_num(("days",), 60, int, 10, 365),
        "beta": get_num(("beta",), default_beta, float, 0.05, 2.50),
        "vaccines": get_num(("vaccines", "totalVaccines"), 24000, int, 0, 100000),
        "vaccineEffectiveness": get_num(
            ("vaccineEffectiveness", "vaccineEfficacyPct"), default_eff, float, 10.0, 100.0
        ),
        "initialNode": resolve_initial_node(raw_init),
        "budget": get_num(("budget", "totalBudget"), 50000, int, 0, 2000000),
        "incubationDays": get_num(("incubationDays",), default_inc, int, 1, 30),
        "dailyDoseArrival": get_num(("dailyDoseArrival",), 800, int, 0, 20000),
        "dailyBrigadeArrival": get_num(("dailyBrigadeArrival",), 2, int, 0, 20),
        "useVaccines": get_bool("useVaccines", True),
        "useFumigation": get_bool("useFumigation", True),
        "useClosure": get_bool("useClosure", True),
        "workerIndex": get_num(("workerIndex",), 0, int, 0, 32),
        "totalWorkers": get_num(("totalWorkers",), 1, int, 1, 32),
        "recordAudit": get_bool("recordAudit", True),
    }

    if isinstance(body_dict.get("subSeeds"), list):
        clean_seeds = []
        for item in body_dict["subSeeds"][:500]:
            try:
                clean_seeds.append(int(item) & 0xFFFFFFFF)
            except (ValueError, TypeError):
                pass
        if clean_seeds:
            cfg["subSeeds"] = clean_seeds
            cfg["runs"] = len(clean_seeds)

    if body_dict.get("calibrateWithLiveWeather") is True:
        weather = fetch_manta_live_weather()
        cfg["beta"] = (
            weather["calibratedBetaDengue"]
            if mode == "dengue"
            else weather["calibratedBetaZombie"]
        )
        cfg["weatherSnapshot"] = weather

    return cfg


def lambda_handler(event, context):
    """Handler principal AWS Lambda (Python 3.12) con soporte Fan-Out, S3, DynamoDB y Open-Meteo."""
    if not isinstance(event, dict):
        event = {}

    http_method = (
        event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("httpMethod")
        or "POST"
    ).upper()

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

        action = str(payload.get("action", "simulate")).strip().lower()

        if action == "weather":
            weather = fetch_manta_live_weather()
            return {
                "statusCode": 200,
                "headers": CORS_HEADERS,
                "body": json.dumps({"ok": True, "weather": weather}, ensure_ascii=False),
            }

        if action == "record_audit":
            entry = {
                "SimulationId": str(
                    payload.get("SimulationId")
                    or f"SIM-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
                ),
                "Timestamp": str(payload.get("Timestamp") or datetime.now(timezone.utc).isoformat()),
                "Seed": int(payload.get("Seed", 2026)),
                "Mode": str(payload.get("Mode", "PLAGA_ZOMBIE")),
                "Runs": int(payload.get("Runs", 50)),
                "SavedLivesMean": float(payload.get("SavedLivesMean", 0.0)),
                "HashFirma": str(payload.get("HashFirma", "0x00000000")),
                "BudgetUsed": float(payload.get("BudgetUsed", 0.0)),
            }
            history, source = save_and_fetch_dynamo_audit(entry)
            return {
                "statusCode": 200,
                "headers": CORS_HEADERS,
                "body": json.dumps(
                    {"ok": True, "auditStorageSource": source, "auditHistory": history},
                    ensure_ascii=False,
                ),
            }

        if action == "list_audits":
            history, source = save_and_fetch_dynamo_audit(None)
            return {
                "statusCode": 200,
                "headers": CORS_HEADERS,
                "body": json.dumps(
                    {"ok": True, "auditStorageSource": source, "auditHistory": history},
                    ensure_ascii=False,
                ),
            }

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
