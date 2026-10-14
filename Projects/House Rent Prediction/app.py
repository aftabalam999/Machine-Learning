import os
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Paths
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "house_rent_linear_regression.pkl"
DATA_PATH = BASE_DIR / "house_rent.csv"

# Predefined categorical options matching dataset and notebook
CITIES = ["Bangalore", "Mumbai", "Delhi", "Chennai", "Hyderabad", "Pune", "Kolkata", "Ahmedabad"]
PROPERTY_TYPES = ["Apartment", "Independent House", "Villa", "Studio"]
FURNISHING_STATUSES = ["Fully Furnished", "Semi-Furnished", "Unfurnished"]
FLOOR_LEVELS = ["Ground", "Low", "Middle", "High"]

# Model evaluation metrics from the notebook
MODEL_METRICS = {
    "algorithm": "Linear Regression (Ordinary Least Squares)",
    "r2_score": 0.884,
    "mae": 5510.02,
    "rmse": 7012.56,
    "training_rows": 8000,
    "testing_rows": 2000,
    "features": [
        "bhk",
        "size_sqft",
        "bathrooms",
        "property_age",
        "city",
        "property_type",
        "furnishing",
        "floor"
    ]
}


def load_or_train_model():
    """
    Loads the saved model pipeline. If the model file is missing,
    it trains the exact Linear Regression pipeline as defined in
    House_Rent_Prediction_Linear_Regression.ipynb.
    """
    if MODEL_PATH.exists():
        try:
            return joblib.load(MODEL_PATH)
        except Exception as e:
            print(f"Error loading existing model: {e}. Retraining...")

    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}")

    # Retrain using the exact steps from the notebook
    from sklearn.model_selection import train_test_split
    from sklearn.compose import ColumnTransformer
    from sklearn.pipeline import Pipeline
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import OneHotEncoder, StandardScaler
    from sklearn.linear_model import LinearRegression

    df = pd.read_csv(DATA_PATH)
    df.columns = df.columns.str.strip()
    df["rent"] = pd.to_numeric(df["rent"], errors="coerce")
    df = df.dropna(subset=["rent"])
    df = df[df["rent"] > 0].copy()

    feature_cols = [
        col for col in [
            "city", "bhk", "size_sqft", "bathrooms",
            "property_type", "furnishing", "floor", "property_age"
        ] if col in df.columns
    ]

    X = df[feature_cols].copy()
    y = df["rent"].copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )

    numeric_features = X_train.select_dtypes(include="number").columns.tolist()
    categorical_features = X_train.select_dtypes(exclude="number").columns.tolist()

    numeric_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler())
    ])

    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore"))
    ])

    transformers = []
    if numeric_features:
        transformers.append(("numeric", numeric_pipeline, numeric_features))
    if categorical_features:
        transformers.append(("categorical", categorical_pipeline, categorical_features))

    preprocessor = ColumnTransformer(transformers=transformers)

    trained_model = Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", LinearRegression())
    ])

    trained_model.fit(X_train, y_train)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(trained_model, MODEL_PATH)
    return trained_model


model = load_or_train_model()


@app.route("/", methods=["GET"])
def index():
    default_values = {
        "city": "Bangalore",
        "bhk": 2,
        "size_sqft": 1100,
        "bathrooms": 2,
        "property_type": "Apartment",
        "furnishing": "Semi-Furnished",
        "floor": "Middle",
        "property_age": 5
    }
    return render_template(
        "index.html",
        cities=CITIES,
        property_types=PROPERTY_TYPES,
        furnishing_statuses=FURNISHING_STATUSES,
        floor_levels=FLOOR_LEVELS,
        metrics=MODEL_METRICS,
        form_data=default_values,
        prediction=None
    )


@app.route("/predict", methods=["POST"])
def predict():
    try:
        # Check if request is JSON or Form data
        if request.is_json:
            data = request.get_json()
        else:
            data = request.form.to_dict()

        # Extract and parse inputs
        city = str(data.get("city", "Bangalore")).strip()
        bhk = int(data.get("bhk", 2))
        size_sqft = float(data.get("size_sqft", 1000.0))
        bathrooms = float(data.get("bathrooms", 2.0))
        property_type = str(data.get("property_type", "Apartment")).strip()
        furnishing = str(data.get("furnishing", "Semi-Furnished")).strip()
        floor = str(data.get("floor", "Middle")).strip()
        property_age = int(data.get("property_age", 5))

        # Basic sanity bounds
        bhk = max(1, min(10, bhk))
        size_sqft = max(100.0, min(10000.0, size_sqft))
        bathrooms = max(1.0, min(10.0, bathrooms))
        property_age = max(0, min(100, property_age))

        input_dict = {
            "city": city,
            "bhk": bhk,
            "size_sqft": size_sqft,
            "bathrooms": bathrooms,
            "property_type": property_type,
            "furnishing": furnishing,
            "floor": floor,
            "property_age": property_age
        }

        # Create DataFrame matching pipeline requirements
        input_df = pd.DataFrame([input_dict])

        # Model prediction using Linear Regression
        raw_prediction = float(model.predict(input_df)[0])
        # Prevent any impossible negative value from linear projection
        monthly_rent = max(0.0, raw_prediction)
        annual_rent = monthly_rent * 12.0
        rent_per_sqft = (monthly_rent / size_sqft) if size_sqft > 0 else 0.0

        result_payload = {
            "success": True,
            "predicted_rent": round(monthly_rent, 2),
            "formatted_rent": f"₹ {round(monthly_rent):,}",
            "annual_rent": f"₹ {round(annual_rent):,}",
            "rent_per_sqft": f"₹ {round(rent_per_sqft, 2)}",
            "inputs": input_dict,
            "algorithm": MODEL_METRICS["algorithm"],
            "r2_score": MODEL_METRICS["r2_score"]
        }

        if request.is_json:
            return jsonify(result_payload)

        # For regular HTML form submission fallback
        return render_template(
            "index.html",
            cities=CITIES,
            property_types=PROPERTY_TYPES,
            furnishing_statuses=FURNISHING_STATUSES,
            floor_levels=FLOOR_LEVELS,
            metrics=MODEL_METRICS,
            form_data=input_dict,
            prediction=result_payload
        )

    except Exception as e:
        error_msg = f"Prediction error: {str(e)}"
        if request.is_json:
            return jsonify({"success": False, "error": error_msg}), 400
        return render_template(
            "index.html",
            cities=CITIES,
            property_types=PROPERTY_TYPES,
            furnishing_statuses=FURNISHING_STATUSES,
            floor_levels=FLOOR_LEVELS,
            metrics=MODEL_METRICS,
            form_data=request.form.to_dict() if request.form else {},
            error=error_msg
        ), 400


@app.route("/api/metrics", methods=["GET"])
def get_metrics():
    return jsonify(MODEL_METRICS)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
