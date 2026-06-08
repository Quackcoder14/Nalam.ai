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
    systolic_bp = np.random.normal(120 + (age - 50)*0.3 + (bmi - 25)*1.2, 15, n_samples)
    diastolic_bp = np.random.normal(80 + (age - 50)*0.1 + (bmi - 25)*0.8, 10, n_samples)
    spo2 = np.random.normal(98 - (age - 50)*0.05, 1.5, n_samples)
    temperature = np.random.normal(37.0, 0.4, n_samples)
    
    # Clip to realistic physiological bounds
    heart_rate = np.clip(heart_rate, 40, 200)
    systolic_bp = np.clip(systolic_bp, 70, 220)
    diastolic_bp = np.clip(diastolic_bp, 40, 130)
    spo2 = np.clip(spo2, 80, 100)
    temperature = np.clip(temperature, 35.0, 41.0)
    
    df = pd.DataFrame({
        'Age': age,
        'BMI': bmi,
        'Heart_Rate': heart_rate,
        'Systolic_BP': systolic_bp,
        'Diastolic_BP': diastolic_bp,
        'SpO2': spo2,
        'Temperature': temperature
    })
    
    # Define Target: Is_Anomaly
    # Anomaly conditions based on clinical rules
    anomaly = (
        (df['Heart_Rate'] > 100) | (df['Heart_Rate'] < 50) |
        (df['Systolic_BP'] > 140) | (df['Systolic_BP'] < 90) |
        (df['Diastolic_BP'] > 90) | (df['Diastolic_BP'] < 60) |
        (df['SpO2'] < 95) |
        (df['Temperature'] > 38.0) | (df['Temperature'] < 36.0)
    ).astype(int)
    
    # Introduce some noise to make it a non-perfect ML problem
    noise = np.random.binomial(1, 0.05, n_samples)
    df['Is_Anomaly'] = np.abs(anomaly - noise)
    
    return df

if __name__ == "__main__":
    print("Generating 15,000 synthetic patient records...")
    df = generate_synthetic_vitals(15000)
    
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
