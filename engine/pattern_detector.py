import pandas as pd

def detect_pattern(features_df: pd.DataFrame, sensor_type: str, is_anomaly: bool) -> tuple[str, str]:
    """
    Detects physical patterns (SPIKE, DRIFT, FLATLINE, NOISE) based on the latest 
    features and returns the pattern name and a recommended action.
    """
    if not is_anomaly:
        return "NORMAL", "System operating normally."

    # We only care about the latest row
    latest = features_df.iloc[-1]
    
    # Extract relevant features for the triggered sensor type
    rate = latest.get(f'{sensor_type}_rate', 0.0)
    abs_rate = latest.get(f'{sensor_type}_abs_rate', 0.0)
    zero_change_count = latest.get(f'{sensor_type}_zero_change_count', 0.0)
    unique_count = latest.get(f'{sensor_type}_unique_count', 1.0)
    deviation = latest.get(f'{sensor_type}_deviation', 0.0)
    rolling_std = latest.get(f'{sensor_type}_rolling_std', 0.0)

    pattern = "GENERAL_ANOMALY"
    action = "Inspect recent telemetry and associated equipment for abnormal operating conditions."

    # Pattern Logic
    if zero_change_count > 5 or unique_count <= 2:
        pattern = "FLATLINE"
        action = "Check sensor connection, power, wiring, and sensor health."
    elif abs_rate > (3.0 * rolling_std) and abs_rate > 10.0:
        pattern = "SPIKE"
        action = "Inspect sensor and associated equipment for sudden operating changes."
    elif abs(deviation) > (2.0 * rolling_std) and abs_rate < 2.0:
        pattern = "DRIFT"
        action = "Inspect sensor calibration and compare against a reference measurement."
    elif rolling_std > 5.0 and unique_count > 5:
        pattern = "NOISE"
        action = "Inspect sensor stability, wiring, shielding, and signal quality."

    return pattern, action
