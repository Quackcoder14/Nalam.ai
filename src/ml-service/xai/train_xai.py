import os
import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

# Ensure the xai directory exists
XAI_DIR = os.path.dirname(os.path.abspath(__file__))

def generate_synthetic_vitals(n_samples=15000):
    np.random.seed(42)
    
    # Base features
    age = np.random.randint(20, 90, n_samples)
    bmi = np.random.uniform(18.5, 40.0, n_samples)
    
    # Vitals with some correlation to age/bmi
    heart_rate = np.random.normal(72 + (age - 50)*0.1 + (bmi - 25)*0.5, 12, n_samples)
    sys = np.random.normal(120 + (age - 50)*0.3 + (bmi - 25)*1.2, 15, n_samples)
    dia = np.random.normal(80 + (age - 50)*0.1 + (bmi - 25)*0.8, 10, n_samples)
    spo2 = np.random.normal(98 - (age - 50)*0.05, 1.5, n_samples)
    temp = np.random.normal(37.0, 0.4, n_samples)
    resp = np.random.normal(16 + (age - 50)*0.02 + (bmi - 25)*0.1, 2, n_samples)
    
    # Clip to realistic physiological bounds
    heart_rate = np.clip(heart_rate, 40, 200)
    sys = np.clip(sys, 70, 220)
    dia = np.clip(dia, 40, 130)
    spo2 = np.clip(spo2, 80, 100)
    temp = np.clip(temp, 35.0, 41.0)
    resp = np.clip(resp, 8, 40)
    
    df = pd.DataFrame({
        'Age': age,
        'BMI': bmi,
        'Heart_Rate': heart_rate,
        'Sys': sys,
        'Dia': dia,
        'SpO2': spo2,
        'Temp': temp,
        'Resp': resp
    })
    
    # Define Target: Is_Anomaly
    # Anomaly conditions based on clinical rules
    anomaly = (
        (df['Heart_Rate'] > 100) | (df['Heart_Rate'] < 50) |
        (df['Sys'] > 140) | (df['Sys'] < 90) |
        (df['Dia'] > 90) | (df['Dia'] < 60) |
        (df['SpO2'] < 95) |
        (df['Temp'] > 38.0) | (df['Temp'] < 36.0) |
        (df['Resp'] > 25) | (df['Resp'] < 10)
    ).astype(int)
    
    # Introduce some noise to make it a non-perfect ML problem
    noise = np.random.binomial(1, 0.05, n_samples)
    df['Is_Anomaly'] = np.abs(anomaly - noise)
    
    return df

if __name__ == "__main__":
    print("Generating 15,000 synthetic patient records...")
    df = generate_synthetic_vitals(15000)
    
    csv_path = os.path.join(XAI_DIR, '..', '..', '..', 'datasets', 'xai_training_data.csv')
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)
    df.to_csv(csv_path, index=False)
    print(f"Saved 15,000 records to {csv_path}")
    
    X = df.drop(columns=['Is_Anomaly'])
    y = df['Is_Anomaly']
    
    print("Training RandomForestClassifier...")
    model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X, y)
    
    score = model.score(X, y)
    print(f"Training Accuracy: {score:.2%}")
    
    model_path = os.path.join(XAI_DIR, 'xai_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
        
    bg_path = os.path.join(XAI_DIR, 'xai_background.pkl')
    # Save a background dataset of 100 records for SHAP TreeExplainer baseline
    with open(bg_path, 'wb') as f:
        pickle.dump(X.sample(100, random_state=42), f)
        
    print(f"Model and background dataset saved to {XAI_DIR}")
