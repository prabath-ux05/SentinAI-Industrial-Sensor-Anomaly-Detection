import pandas as pd
import numpy as np
import json
import os

def load_feature_config():
    """Loads the feature configuration JSON to guarantee feature order."""
    config_path = os.path.join(os.path.dirname(__file__), "models", "sentinai_feature_config.json")
    with open(config_path, 'r') as f:
        return json.load(f)

def create_features(history_df: pd.DataFrame) -> pd.DataFrame:
    """
    Takes a DataFrame containing raw telemetry (temperature, pressure, flow)
    and computes the 33 engineered features expected by the model.
    """
    config = load_feature_config()
    window_size = config.get("window_size", 10)
    expected_features = config["features"]
    
    # We create a copy to avoid SettingWithCopyWarning
    df = history_df.copy()
    
    # Ensure raw features exist
    for base_col in ["temperature", "pressure", "flow"]:
        if base_col not in df.columns:
            raise ValueError(f"Required raw telemetry column '{base_col}' is missing.")
            
    for base_col in ["temperature", "pressure", "flow"]:
        # Rolling calculations (min_periods=1 allows computation even with partial history)
        rolling = df[base_col].rolling(window=window_size, min_periods=1)
        
        df[f'{base_col}_rolling_mean'] = rolling.mean()
        df[f'{base_col}_rolling_std'] = rolling.std().fillna(0.0)
        df[f'{base_col}_rolling_min'] = rolling.min()
        df[f'{base_col}_rolling_max'] = rolling.max()
        df[f'{base_col}_rolling_range'] = df[f'{base_col}_rolling_max'] - df[f'{base_col}_rolling_min']
        
        df[f'{base_col}_deviation'] = df[base_col] - df[f'{base_col}_rolling_mean']
        df[f'{base_col}_rate'] = df[base_col].diff().fillna(0.0)
        df[f'{base_col}_abs_rate'] = df[f'{base_col}_rate'].abs()
        
        # Zero change count and unique count need a custom rolling apply, which is slow in pandas.
        # But for small windows and inference, we can do it efficiently, or use rolling.apply.
        
        # zero_change_count: count of times the value did not change in the window
        # First compute boolean series of zero changes (rate == 0)
        zero_changes = (df[f'{base_col}_rate'] == 0).astype(int)
        # We don't want to count the very first NaN filled as 0 rate as a valid zero change if history is size 1.
        # But for exact matching of training, usually we just sum the boolean array in the window.
        df[f'{base_col}_zero_change_count'] = zero_changes.rolling(window=window_size, min_periods=1).sum().fillna(0.0)
        
        # unique_count: number of unique values in the rolling window
        df[f'{base_col}_unique_count'] = rolling.apply(lambda x: len(np.unique(x)), raw=True).fillna(1.0)

    # Return only the expected features in the exact order
    missing_features = [f for f in expected_features if f not in df.columns]
    if missing_features:
        raise ValueError(f"Feature engineering failed to produce required features: {missing_features}")
        
    return df[expected_features]
