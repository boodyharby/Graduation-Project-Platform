"""Eco-Park AI v5.0 Mathematical Carbon & Thermal AI Models."""

VEHICLE_EMISSION_FACTORS = {
    "ELECTRIC": {"drive_g_km": 0.0, "idle_g_min": 0.0, "fee_sar": 0.0, "tax_sar": 0.0, "points": 30},
    "HYBRID": {"drive_g_km": 92.0, "idle_g_min": 3.5, "fee_sar": 5.0, "tax_sar": 0.0, "points": 18},
    "GASOLINE": {"drive_g_km": 192.0, "idle_g_min": 18.5, "fee_sar": 10.0, "tax_sar": 0.0, "points": 10},
    "DIESEL": {"drive_g_km": 171.0, "idle_g_min": 14.8, "fee_sar": 12.0, "tax_sar": 5.0, "points": 5},
}


def calculate_co2_saved_kg(vehicle_type: str, distance_saved_km: float, time_saved_min: float) -> float:
    spec = VEHICLE_EMISSION_FACTORS.get(vehicle_type.upper(), VEHICLE_EMISSION_FACTORS["GASOLINE"])
    drive_factor = 120.0 if vehicle_type.upper() == "ELECTRIC" else spec["drive_g_km"]
    idle_factor = 8.0 if vehicle_type.upper() == "ELECTRIC" else spec["idle_g_min"]
    return round(((distance_saved_km * drive_factor) + (time_saved_min * idle_factor)) / 1000.0, 3)


def assess_bess_safety(bess_charge_pct: float) -> dict:
    critical = bess_charge_pct < 20.0
    return {
        "bessChargePct": bess_charge_pct,
        "criticalAlarm": critical,
        "recommendedAction": "ACTIVATE_ECO_CONSERVATION" if critical else "NORMAL_OPERATION",
    }
