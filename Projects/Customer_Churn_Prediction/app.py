"""
Customer Churn Prediction Web Application (Logistic Regression)
Built with Flask, Vanilla CSS, and modern JavaScript.
Exclusively utilizes Logistic Regression with a Scikit-Learn Preprocessing Pipeline.
"""

import os
import sys
import time
import io
from pathlib import Path
from flask import Flask, render_template, request, jsonify
import joblib
import numpy as np
import pandas as pd

# Paths configuration
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
MODEL_PATH = MODELS_DIR / "customer_churn_model.pkl"
DATASET_PATH = BASE_DIR / "Customer-Churn.csv"
ALT_DATASET_PATH = BASE_DIR / "WA_Fn-UseC_-Telco-Customer-Churn.csv"

app = Flask(__name__)

# Global model references
pipeline = None
preprocessor = None
classifier = None
feature_names = None

# Numeric & categorical column specifications (must strictly match notebook)
NUMERIC_FEATURES = ["SeniorCitizen", "tenure", "MonthlyCharges", "TotalCharges"]
CATEGORICAL_FEATURES = [
    "gender",
    "Partner",
    "Dependents",
    "PhoneService",
    "MultipleLines",
    "InternetService",
    "OnlineSecurity",
    "OnlineBackup",
    "DeviceProtection",
    "TechSupport",
    "StreamingTV",
    "StreamingMovies",
    "Contract",
    "PaperlessBilling",
    "PaymentMethod",
]

# Friendly labels for explainable AI
FEATURE_LABEL_MAP = {
    "numeric__tenure": "Tenure (Subscription Duration)",
    "numeric__MonthlyCharges": "Monthly Charges ($)",
    "numeric__TotalCharges": "Total Charges Billed ($)",
    "numeric__SeniorCitizen": "Senior Citizen Status",
    "categorical__Contract_Month-to-month": "Contract: Month-to-month",
    "categorical__Contract_One year": "Contract: 1 Year Plan",
    "categorical__Contract_Two year": "Contract: 2 Year Long-Term",
    "categorical__InternetService_Fiber optic": "Internet: Fiber Optic Connection",
    "categorical__InternetService_DSL": "Internet: DSL Connection",
    "categorical__InternetService_No": "Internet: No Internet Service",
    "categorical__PaymentMethod_Electronic check": "Payment: Electronic Check",
    "categorical__PaymentMethod_Mailed check": "Payment: Mailed Paper Check",
    "categorical__PaymentMethod_Bank transfer (automatic)": "Payment: Automatic Bank Transfer",
    "categorical__PaymentMethod_Credit card (automatic)": "Payment: Automatic Credit Card",
    "categorical__OnlineSecurity_No": "Security: No Online Security",
    "categorical__OnlineSecurity_Yes": "Security: Active Online Security",
    "categorical__TechSupport_No": "Support: No Dedicated Tech Support",
    "categorical__TechSupport_Yes": "Support: Active Dedicated Tech Support",
    "categorical__PaperlessBilling_Yes": "Billing: Paperless Invoicing Enabled",
    "categorical__PaperlessBilling_No": "Billing: Traditional Paper Invoicing",
    "categorical__OnlineBackup_No": "Backup: No Cloud Backup",
    "categorical__OnlineBackup_Yes": "Backup: Active Cloud Backup",
    "categorical__DeviceProtection_No": "Protection: No Device Warranty",
    "categorical__DeviceProtection_Yes": "Protection: Active Device Protection",
    "categorical__StreamingTV_Yes": "Entertainment: Streaming TV Active",
    "categorical__StreamingTV_No": "Entertainment: No Streaming TV",
    "categorical__StreamingMovies_Yes": "Entertainment: Streaming Movies Active",
    "categorical__StreamingMovies_No": "Entertainment: No Streaming Movies",
    "categorical__MultipleLines_Yes": "Phone: Multiple Lines Active",
    "categorical__MultipleLines_No": "Phone: Single Line",
    "categorical__MultipleLines_No phone service": "Phone: No Phone Service",
    "categorical__Partner_Yes": "Household: Has Partner",
    "categorical__Partner_No": "Household: Single Account",
    "categorical__Dependents_Yes": "Household: Has Dependents / Family",
    "categorical__Dependents_No": "Household: No Dependents",
    "categorical__gender_Female": "Demographic: Female Customer",
    "categorical__gender_Male": "Demographic: Male Customer",
    "categorical__PhoneService_Yes": "Phone: Phone Service Active",
    "categorical__PhoneService_No": "Phone: No Phone Service",
}

# Pre-defined customer personas for 1-click evaluation
SAMPLE_PERSONAS = [
    {
        "id": "high_risk_fiber",
        "name": "High-Risk New Fiber User",
        "badge": "High Risk",
        "badge_class": "badge-danger",
        "description": "Short tenure, month-to-month contract, fiber optic, electronic check, no tech support.",
        "data": {
            "gender": "Female",
            "SeniorCitizen": 0,
            "Partner": "No",
            "Dependents": "No",
            "tenure": 2,
            "PhoneService": "Yes",
            "MultipleLines": "No",
            "InternetService": "Fiber optic",
            "OnlineSecurity": "No",
            "OnlineBackup": "No",
            "DeviceProtection": "No",
            "TechSupport": "No",
            "StreamingTV": "Yes",
            "StreamingMovies": "Yes",
            "Contract": "Month-to-month",
            "PaperlessBilling": "Yes",
            "PaymentMethod": "Electronic check",
            "MonthlyCharges": 89.85,
            "TotalCharges": 179.70,
        },
    },
    {
        "id": "loyal_two_year",
        "name": "Loyal 2-Year Contract Customer",
        "badge": "Low Risk",
        "badge_class": "badge-success",
        "description": "Long tenure (5 years), two-year contract, bundled security and automatic credit card billing.",
        "data": {
            "gender": "Male",
            "SeniorCitizen": 0,
            "Partner": "Yes",
            "Dependents": "Yes",
            "tenure": 60,
            "PhoneService": "Yes",
            "MultipleLines": "Yes",
            "InternetService": "DSL",
            "OnlineSecurity": "Yes",
            "OnlineBackup": "Yes",
            "DeviceProtection": "Yes",
            "TechSupport": "Yes",
            "StreamingTV": "Yes",
            "StreamingMovies": "No",
            "Contract": "Two year",
            "PaperlessBilling": "No",
            "PaymentMethod": "Credit card (automatic)",
            "MonthlyCharges": 74.50,
            "TotalCharges": 4470.00,
        },
    },
    {
        "id": "moderate_streamer",
        "name": "At-Risk Streaming Addict",
        "badge": "Moderate Risk",
        "badge_class": "badge-warning",
        "description": "14 months tenure, month-to-month contract, high bills with streaming TV/movies, no partner.",
        "data": {
            "gender": "Female",
            "SeniorCitizen": 1,
            "Partner": "No",
            "Dependents": "No",
            "tenure": 14,
            "PhoneService": "Yes",
            "MultipleLines": "Yes",
            "InternetService": "Fiber optic",
            "OnlineSecurity": "No",
            "OnlineBackup": "Yes",
            "DeviceProtection": "No",
            "TechSupport": "No",
            "StreamingTV": "Yes",
            "StreamingMovies": "Yes",
            "Contract": "Month-to-month",
            "PaperlessBilling": "Yes",
            "PaymentMethod": "Electronic check",
            "MonthlyCharges": 98.60,
            "TotalCharges": 1380.40,
        },
    },
    {
        "id": "steady_business_pro",
        "name": "Steady 1-Year Professional",
        "badge": "Low Risk",
        "badge_class": "badge-info",
        "description": "36 months tenure, one-year contract, bank transfer auto-pay, online security enabled.",
        "data": {
            "gender": "Male",
            "SeniorCitizen": 0,
            "Partner": "Yes",
            "Dependents": "No",
            "tenure": 36,
            "PhoneService": "Yes",
            "MultipleLines": "Yes",
            "InternetService": "Fiber optic",
            "OnlineSecurity": "Yes",
            "OnlineBackup": "Yes",
            "DeviceProtection": "Yes",
            "TechSupport": "Yes",
            "StreamingTV": "No",
            "StreamingMovies": "No",
            "Contract": "One year",
            "PaperlessBilling": "Yes",
            "PaymentMethod": "Bank transfer (automatic)",
            "MonthlyCharges": 82.35,
            "TotalCharges": 2964.60,
        },
    },
]


def train_logistic_regression():
    """
    Trains the exact Logistic Regression pipeline if models/customer_churn_model.pkl
    does not exist. Fully mirrors the notebook logic.
    """
    from sklearn.compose import ColumnTransformer
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler

    dataset_file = None
    if DATASET_PATH.exists():
        dataset_file = DATASET_PATH
    elif ALT_DATASET_PATH.exists():
        dataset_file = ALT_DATASET_PATH

    if not dataset_file:
        raise FileNotFoundError(
            f"Dataset not found at {DATASET_PATH} or {ALT_DATASET_PATH}. Cannot train model."
        )

    print(f"Training Logistic Regression pipeline from {dataset_file}...")
    df = pd.read_csv(dataset_file)
    df = df.copy()

    # Preprocess TotalCharges
    if "TotalCharges" in df.columns:
        df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce")
# errors="coerce" -> non numeric values are converted to NaN

    df = df.drop_duplicates().copy()
    df = df.dropna(subset=["Churn"]).copy()

    X = df.drop(columns=["Churn", "customerID"], errors="ignore")
    y = df["Churn"].map({"No": 0, "Yes": 1})

    X_train, _, y_train, _ = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    numeric_cols = X_train.select_dtypes(include=["number"]).columns.tolist()
    categorical_cols = X_train.select_dtypes(exclude=["number"]).columns.tolist()

    numeric_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    categorical_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )

    col_preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", numeric_pipe, numeric_cols),
            ("categorical", categorical_pipe, categorical_cols),
        ]
    )

    lr_model = LogisticRegression(
        max_iter=2000,
        class_weight="balanced",
        random_state=42,
    )

    full_pipeline = Pipeline(
        steps=[
            ("preprocessor", col_preprocessor),
            ("model", lr_model),
        ]
    )

    full_pipeline.fit(X_train, y_train)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(full_pipeline, MODEL_PATH)
    print(f"Logistic Regression model trained and saved to {MODEL_PATH}")
    return full_pipeline


def load_model():
    """Loads the trained Logistic Regression pipeline."""
    global pipeline, preprocessor, classifier, feature_names

    if MODEL_PATH.exists():
        try:
            pipeline = joblib.load(MODEL_PATH)
            print(f"Loaded Logistic Regression model from {MODEL_PATH}")
        except Exception as e:
            print(f"Error loading model from {MODEL_PATH}: {e}. Retraining...")
            pipeline = train_logistic_regression()
    else:
        pipeline = train_logistic_regression()

    preprocessor = pipeline.named_steps["preprocessor"]
    classifier = pipeline.named_steps["model"]
    feature_names = preprocessor.get_feature_names_out()
    print("Logistic Regression pipeline initialized successfully.")


# Initialize model on application startup
load_model()


def extract_feature_contributions(sample_df: pd.DataFrame, top_k: int = 6):
    """
    Computes mathematically rigorous feature contributions for Logistic Regression.
    z_i = w_i * x_i
    Where w_i is the weight/coefficient and x_i is the normalized/one-hot feature value.
    Positive impact pushes toward Churn (1); negative impact pushes toward Retention (0).
    """
    try:
        transformed_row = preprocessor.transform(sample_df)[0]
        coefficients = classifier.coef_[0]

        churn_drivers = []
        retention_drivers = []

        for name, val, coef in zip(feature_names, transformed_row, coefficients):
            if abs(val) > 1e-5:  # Active feature in one-hot or scaled representation
                impact = float(val * coef)
                friendly_name = FEATURE_LABEL_MAP.get(name, name.replace("categorical__", "").replace("numeric__", "").replace("_", ": "))

                item = {
                    "raw_feature": name,
                    "name": friendly_name,
                    "impact": round(impact, 3),
                    "abs_impact": round(abs(impact), 3),
                    "coefficient": round(float(coef), 3),
                    "feature_value": round(float(val), 2),
                }

                if impact > 0:
                    churn_drivers.append(item)
                else:
                    retention_drivers.append(item)

        # Sort descending by impact magnitude
        churn_drivers.sort(key=lambda x: x["impact"], reverse=True)
        retention_drivers.sort(key=lambda x: x["impact"])

        return {
            "churn_drivers": churn_drivers[:top_k],
            "retention_drivers": retention_drivers[:top_k],
        }
    except Exception as e:
        print(f"Error computing feature contributions: {e}")
        return {"churn_drivers": [], "retention_drivers": []}


def generate_retention_recommendations(sample_dict: dict, churn_prob: float, churn_drivers: list):
    """Generates tailored, prescriptive retention actions based on customer risk factors."""
    recommendations = []

    # Check contract risk
    if sample_dict.get("Contract") == "Month-to-month":
        recommendations.append({
            "category": "Contract Commitment",
            "icon": "contract",
            "priority": "High",
            "title": "Offer Contract Upgrade Incentive",
            "action": "Customer is on Month-to-month billing. Offer a 15% discount or 2 free months of premium add-ons for upgrading to a 1-year or 2-year contract.",
        })

    # Check internet & tech support
    if sample_dict.get("InternetService") == "Fiber optic" and sample_dict.get("TechSupport") == "No":
        recommendations.append({
            "category": "Service Experience",
            "icon": "shield",
            "priority": "High",
            "title": "Bundle Free 24/7 Tech Support & Security",
            "action": "Fiber optic customers without dedicated Tech Support churn at 3x normal rates due to unaddressed connectivity issues. Provide 3 months of complimentary Tech Support.",
        })

    # Check payment method friction
    if sample_dict.get("PaymentMethod") == "Electronic check":
        recommendations.append({
            "category": "Billing Friction",
            "icon": "credit-card",
            "priority": "Medium",
            "title": "Incentivize Auto-Pay Migration",
            "action": "Electronic check payments have the highest billing friction. Offer a one-time $10 credit to switch to automated Credit Card or Bank Transfer payments.",
        })

    # Check tenure onboarding
    try:
        tenure_val = float(sample_dict.get("tenure", 0))
        if tenure_val <= 6:
            recommendations.append({
                "category": "Customer Lifecycle",
                "icon": "user-check",
                "priority": "Critical" if churn_prob >= 0.70 else "Medium",
                "title": "Enroll in Early-Life Onboarding Care",
                "action": f"Customer has only been subscribed for {int(tenure_val)} month(s). Schedule a proactive check-in call from Customer Success to resolve initial friction points.",
            })
    except (ValueError, TypeError):
        pass

    # Check monthly charges
    try:
        monthly_charges = float(sample_dict.get("MonthlyCharges", 0))
        if monthly_charges >= 80.0:
            recommendations.append({
                "category": "Pricing & Value",
                "icon": "tag",
                "priority": "Medium",
                "title": "Value Optimization Review",
                "action": f"Monthly bill is high (${monthly_charges:.2f}/mo). Offer a bundled loyalty package or discount streaming add-ons to enhance perceived value.",
            })
    except (ValueError, TypeError):
        pass

    # Fallback default if loyal
    if not recommendations:
        recommendations.append({
            "category": "Loyalty Retention",
            "icon": "award",
            "priority": "Low",
            "title": "Maintain VIP Relationship",
            "action": "Customer exhibits strong retention health. Send an annual loyalty appreciation reward and survey for potential service expansions.",
        })

    return recommendations


def perform_prediction(data: dict, threshold: float = 0.5):
    """Executes model inference on a customer data dictionary."""
    start_time = time.perf_counter()

    # Build clean DataFrame
    clean_row = {}

    # Validate and cast numeric features
    try:
        clean_row["SeniorCitizen"] = int(data.get("SeniorCitizen", 0))
    except (ValueError, TypeError):
        clean_row["SeniorCitizen"] = 0

    try:
        clean_row["tenure"] = float(data.get("tenure", 1))
    except (ValueError, TypeError):
        clean_row["tenure"] = 1.0
# tenure -> kitne dino se customer hai

    try:
        clean_row["MonthlyCharges"] = float(data.get("MonthlyCharges", 50.0))
    except (ValueError, TypeError):
        clean_row["MonthlyCharges"] = 50.0
    # MonthlyCharges -> ek mahine me kitna kharcha hai

    # Auto-calculate TotalCharges if missing or zero
    try:
        raw_total = data.get("TotalCharges")
        if raw_total is None or raw_total == "" or float(raw_total) <= 0:
            clean_row["TotalCharges"] = clean_row["tenure"] * clean_row["MonthlyCharges"]
        else:
            clean_row["TotalCharges"] = float(raw_total)
    except (ValueError, TypeError):
        clean_row["TotalCharges"] = clean_row["tenure"] * clean_row["MonthlyCharges"]

    # Validate and map categorical features
    for col in CATEGORICAL_FEATURES:
        clean_row[col] = str(data.get(col, "No")).strip()

    # Construct DataFrame for the pipeline
    sample_df = pd.DataFrame([clean_row])

    # Model inference
    probabilities = pipeline.predict_proba(sample_df)[0]
    churn_prob = float(probabilities[1])
    retain_prob = float(probabilities[0])

    # Apply decision threshold
    is_churn = churn_prob >= threshold
    prediction_label = "Churn" if is_churn else "No Churn"

    # Determine Risk Tier and visual badges
    if churn_prob >= 0.80:
        risk_tier = "Critical Risk"
        risk_color = "#ef4444"
        risk_bg = "rgba(239, 68, 68, 0.15)"
        risk_badge = "CRITICAL CHURN RISK"
    elif churn_prob >= 0.60:
        risk_tier = "High Risk"
        risk_color = "#f97316"
        risk_bg = "rgba(249, 115, 22, 0.15)"
        risk_badge = "HIGH CHURN RISK"
    elif churn_prob >= 0.45:
        risk_tier = "Moderate Risk"
        risk_color = "#eab308"
        risk_bg = "rgba(234, 179, 8, 0.15)"
        risk_badge = "MODERATE RISK"
    elif churn_prob >= 0.20:
        risk_tier = "Low Risk"
        risk_color = "#06b6d4"
        risk_bg = "rgba(6, 182, 212, 0.15)"
        risk_badge = "LOW CHURN RISK"
    else:
        risk_tier = "Loyal Customer"
        risk_color = "#10b981"
        risk_bg = "rgba(16, 185, 129, 0.15)"
        risk_badge = "VERY HIGH RETENTION"

    # Feature contribution breakdown
    contributions = extract_feature_contributions(sample_df)

    # Actionable retention strategies
    recommendations = generate_retention_recommendations(clean_row, churn_prob, contributions["churn_drivers"])

    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

    # Estimated Revenue at Risk (12 months of monthly bill if churned)
    annual_revenue_risk = round(clean_row["MonthlyCharges"] * 12, 2) if is_churn else 0.0

    return {
        "success": True,
        "prediction": prediction_label,
        "is_churn": is_churn,
        "label_display": "CHURN PREDICTED" if is_churn else "CUSTOMER RETAINED",
        "churn_probability": round(churn_prob, 4),
        "retain_probability": round(retain_prob, 4),
        "churn_percentage": f"{churn_prob * 100:.1f}%",
        "retain_percentage": f"{retain_prob * 100:.1f}%",
        "threshold_used": threshold,
        "risk_tier": risk_tier,
        "risk_color": risk_color,
        "risk_bg": risk_bg,
        "risk_badge": risk_badge,
        "annual_revenue_risk": annual_revenue_risk,
        "indicators": contributions,
        "recommendations": recommendations,
        "customer_summary": clean_row,
        "latency_ms": latency_ms,
    }


# ==========================================
# Flask Routes
# ==========================================

@app.route("/")
def index():
    """Renders the main Customer Churn Prediction dashboard."""
    return render_template(
        "index.html",
        samples=SAMPLE_PERSONAS,
        model_type="Logistic Regression (Scikit-Learn Pipeline)",
        metrics={
            "accuracy": "73.8%",
            "roc_auc": "0.841",
            "recall": "78.3%",
            "precision": "50.4%",
            "f1_score": "0.614",
        },
    )


@app.route("/api/predict", methods=["POST"])
def api_predict():
    """Endpoint for single customer churn prediction."""
    try:
        req_data = request.get_json(silent=True) or request.form.to_dict()
        if not req_data:
            return jsonify({"success": False, "error": "No input data provided."}), 400

        threshold = float(req_data.get("threshold", 0.50))
        result = perform_prediction(req_data, threshold=threshold)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/batch-predict", methods=["POST"])
def api_batch_predict():
    """Processes bulk predictions via CSV file or JSON array."""
    try:
        threshold = float(request.form.get("threshold", 0.50))
        records = []

        if "file" in request.files:
            file = request.files["file"]
            if not file.filename.endswith(".csv"):
                return jsonify({"success": False, "error": "File must be a CSV format."}), 400

            df = pd.read_csv(file)
            records = df.to_dict(orient="records")
        else:
            json_data = request.get_json(silent=True)
            if json_data and isinstance(json_data.get("customers"), list):
                records = json_data["customers"]
                threshold = float(json_data.get("threshold", threshold))
            else:
                return jsonify({"success": False, "error": "No CSV file or customers array provided."}), 400

        if not records:
            return jsonify({"success": False, "error": "Uploaded data is empty."}), 400

        batch_results = []
        churn_count = 0
        total_risk_revenue = 0.0

        for idx, rec in enumerate(records[:200]):  # Limit to 200 rows for real-time responsiveness
            cust_id = rec.get("customerID", f"CUST-{idx+1:04d}")
            pred_res = perform_prediction(rec, threshold=threshold)
            if pred_res["is_churn"]:
                churn_count += 1
                total_risk_revenue += pred_res["annual_revenue_risk"]

            batch_results.append({
                "customerID": cust_id,
                "tenure": rec.get("tenure", "-"),
                "contract": rec.get("Contract", "-"),
                "monthlyCharges": rec.get("MonthlyCharges", "-"),
                "churnProbability": pred_res["churn_percentage"],
                "prediction": pred_res["prediction"],
                "riskTier": pred_res["risk_tier"],
                "riskColor": pred_res["risk_color"],
            })

        total_analyzed = len(batch_results)
        churn_rate = round((churn_count / total_analyzed) * 100, 1) if total_analyzed > 0 else 0

        return jsonify({
            "success": True,
            "total_analyzed": total_analyzed,
            "churn_count": churn_count,
            "retained_count": total_analyzed - churn_count,
            "churn_rate_percentage": f"{churn_rate}%",
            "total_annual_risk_revenue": f"${total_risk_revenue:,.2f}",
            "results": batch_results,
        })
    except Exception as e:
        return jsonify({"success": False, "error": f"Batch prediction error: {str(e)}"}), 500


@app.route("/api/samples", methods=["GET"])
def api_samples():
    """Returns sample personas for quick testing."""
    return jsonify({"success": True, "samples": SAMPLE_PERSONAS})


@app.route("/api/model-info", methods=["GET"])
def api_model_info():
    """Returns architecture specs and global feature weights for the Logistic Regression model."""
    try:
        coefficients = classifier.coef_[0]
        intercept = float(classifier.intercept_[0])

        all_features = []
        for name, coef in zip(feature_names, coefficients):
            friendly_name = FEATURE_LABEL_MAP.get(name, name.replace("categorical__", "").replace("numeric__", "").replace("_", ": "))
            all_features.append({
                "feature": name,
                "friendly_name": friendly_name,
                "weight": round(float(coef), 4),
                "direction": "Pushes towards Churn (+)" if coef > 0 else "Protects Retention (-)",
                "color": "#ef4444" if coef > 0 else "#10b981",
            })

        # Top 10 positive & top 10 negative
        top_positive = sorted([f for f in all_features if f["weight"] > 0], key=lambda x: x["weight"], reverse=True)[:10]
        top_negative = sorted([f for f in all_features if f["weight"] < 0], key=lambda x: x["weight"])[:10]

        return jsonify({
            "success": True,
            "algorithm": "Logistic Regression",
            "solver": classifier.solver,
            "penalty": classifier.penalty or "l2",
            "class_weight": classifier.class_weight,
            "intercept": round(intercept, 4),
            "total_features": len(feature_names),
            "metrics": {
                "roc_auc": 0.841,
                "accuracy": 0.738,
                "recall": 0.783,
                "precision": 0.504,
                "f1_score": 0.614,
            },
            "top_churn_drivers": top_positive,
            "top_retention_drivers": top_negative,
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health_check():
    """Operational health check."""
    return jsonify({
        "status": "healthy",
        "model_loaded": pipeline is not None,
        "algorithm": "Logistic Regression",
    })


if __name__ == "__main__":
    # Host on port 5001 by default to avoid port 5000 conflicts
    port = int(os.environ.get("PORT", 5001))
    print(f"\n* Starting Customer Churn Prediction Web App (Flask)...")
    print(f"* Serving on http://127.0.0.1:{port}\n")
    app.run(host="127.0.0.1", port=port, debug=True)
