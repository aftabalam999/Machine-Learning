"""
Spam Detection Web Application (Logistic Regression)
Built with Flask, Vanilla CSS, and modern JavaScript.
Strictly utilizes Logistic Regression with TF-IDF Vectorization.
"""

import os
import sys
import time
import pickle
from pathlib import Path
from flask import Flask, render_template, request, jsonify

# Base project directory
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "spam_detection_model.pkl"
ALT_MODEL_PATH = BASE_DIR / "spam_detection_model.pkl"
DATASET_PATH = BASE_DIR / "email_spam_dataset.csv"

app = Flask(__name__)

# Model and vectorizer references
model_package = None
model = None
vectorizer = None
feature_names = None


def train_logistic_regression():
    """
    Trains a Logistic Regression model from email_spam_dataset.csv
    if the pickled model file does not already exist.
    Strictly uses Logistic Regression only.
    """
    import pandas as pd
    from sklearn.model_selection import train_test_split
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression

    print("Pickle model not found. Training Logistic Regression from dataset...")
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}")

    df = pd.read_csv(DATASET_PATH)
    df = df.dropna(subset=["input", "output"]).drop_duplicates(subset=["input", "output"]).copy()
    df["input"] = df["input"].astype(str)
    df["output"] = df["output"].astype(str).str.strip().str.lower().map({"ham": "not_spam", "spam": "spam"})
    df = df.dropna(subset=["output"])

    input_data = df["input"]
    output_data = df["output"]

    x_train, _, y_train, _ = train_test_split(
        input_data, output_data, test_size=0.2, random_state=42, stratify=output_data
    )

    tfidf = TfidfVectorizer(lowercase=True, ngram_range=(1, 2), max_features=20000)
    x_train_vec = tfidf.fit_transform(x_train)

    lr_model = LogisticRegression(max_iter=1000, random_state=42)
    lr_model.fit(x_train_vec, y_train)

    pkg = {
        "model": lr_model,
        "vectorizer": tfidf,
        "labels": list(lr_model.classes_),
        "positive_label": "spam",
        "model_type": "LogisticRegression + TfidfVectorizer",
    }

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with MODEL_PATH.open("wb") as f:
        pickle.dump(pkg, f, protocol=pickle.HIGHEST_PROTOCOL)

    print(f"Logistic Regression model trained and saved to {MODEL_PATH}")
    return pkg


def load_model():
    """Loads the Logistic Regression model package."""
    global model_package, model, vectorizer, feature_names

    chosen_path = None
    if MODEL_PATH.exists():
        chosen_path = MODEL_PATH
    elif ALT_MODEL_PATH.exists():
        chosen_path = ALT_MODEL_PATH

    if chosen_path:
        with open(chosen_path, "rb") as f:
            model_package = pickle.load(f)
    else:
        model_package = train_logistic_regression()

    model = model_package["model"]
    vectorizer = model_package["vectorizer"]
    feature_names = vectorizer.get_feature_names_out()
    print("Logistic Regression model loaded successfully.")


# Load model on startup
load_model()


def extract_feature_contributions(message: str, top_k: int = 8):
    """
    Computes mathematical token contributions based on the Logistic Regression
    linear decision boundary:
    contribution = tfidf_value * coefficient.
    Positive contribution pulls towards 'spam'.
    Negative contribution pulls towards 'not_spam' (legitimate).
    """
    if not message or not message.strip():
        return {"spam_indicators": [], "ham_indicators": []}

    try:
        tfidf_vec = vectorizer.transform([message])
        row = tfidf_vec.tocoo()

        spam_indicators = []
        ham_indicators = []

        for col_idx, tfidf_val in zip(row.col, row.data):
            feat_name = feature_names[col_idx]
            coef_val = float(model.coef_[0][col_idx])
            impact = float(tfidf_val * coef_val)

            item = {
                "word": feat_name,
                "score": round(abs(impact), 3),
                "raw_impact": round(impact, 4),
                "weight": round(coef_val, 2),
                "tfidf": round(float(tfidf_val), 3),
            }

            if impact > 0:
                spam_indicators.append(item)
            else:
                ham_indicators.append(item)

        # Sort descending by absolute impact
        spam_indicators.sort(key=lambda x: x["raw_impact"], reverse=True)
        ham_indicators.sort(key=lambda x: x["raw_impact"])

        return {
            "spam_indicators": spam_indicators[:top_k],
            "ham_indicators": ham_indicators[:top_k],
        }
    except Exception as e:
        print(f"Error computing feature contributions: {e}")
        return {"spam_indicators": [], "ham_indicators": []}


def perform_prediction(message: str, threshold: float = 0.5):
    """Performs inference using the loaded Logistic Regression model."""
    start_time = time.perf_counter()

    if not message or not message.strip():
        return {
            "error": "Message is empty. Please provide text to analyze."
        }

    # Transform input text using TF-IDF
    features = vectorizer.transform([message])

    # Predict probabilities with Logistic Regression
    probabilities = model.predict_proba(features)[0]
    classes = list(model.classes_)
    spam_idx = classes.index("spam")
    not_spam_idx = classes.index("not_spam")

    spam_prob = float(probabilities[spam_idx])
    ham_prob = float(probabilities[not_spam_idx])

    # Apply customizable decision threshold (defaults to 0.50)
    is_spam = spam_prob >= threshold
    prediction_label = "spam" if is_spam else "not_spam"

    # Assess Risk Level
    if spam_prob >= 0.85:
        risk_level = "Severe Risk"
        risk_color = "#ef4444"
        risk_badge = "CRITICAL SPAM"
    elif spam_prob >= 0.65:
        risk_level = "High Risk"
        risk_color = "#f97316"
        risk_badge = "LIKELY SPAM"
    elif spam_prob >= 0.45:
        risk_level = "Moderate / Suspicious"
        risk_color = "#eab308"
        risk_badge = "SUSPICIOUS"
    elif spam_prob >= 0.15:
        risk_level = "Low Risk"
        risk_color = "#38bdf8"
        risk_badge = "MOSTLY SAFE"
    else:
        risk_level = "Minimal Risk"
        risk_color = "#10b981"
        risk_badge = "VERIFIED SAFE"

    contributions = extract_feature_contributions(message)

    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
    words = message.split()

    return {
        "success": True,
        "prediction": prediction_label,
        "is_spam": is_spam,
        "label_display": "SPAM DETECTED" if is_spam else "LEGITIMATE (HAM)",
        "spam_probability": round(spam_prob, 4),
        "ham_probability": round(ham_prob, 4),
        "spam_percentage": f"{spam_prob * 100:.1f}%",
        "ham_percentage": f"{ham_prob * 100:.1f}%",
        "threshold_used": threshold,
        "risk_level": risk_level,
        "risk_color": risk_color,
        "risk_badge": risk_badge,
        "indicators": contributions,
        "stats": {
            "char_count": len(message),
            "word_count": len(words),
            "latency_ms": latency_ms,
        },
        "model_meta": {
            "algorithm": "Logistic Regression",
            "feature_extractor": "TF-IDF Vectorizer (1-2 N-Grams)",
            "max_features": 20000,
            "classes": classes,
        },
    }


# Pre-defined sample emails for immediate UI testing
SAMPLE_MESSAGES = [
    {
        "id": "spam-reward",
        "category": "spam",
        "title": "Cash Prize / Reward Notice",
        "text": "Final notice: claim your laptop before your reward expires! You have been chosen for an exclusive cash bonus of $1,000. Claim your reward now by clicking the link.",
    },
    {
        "id": "spam-lottery",
        "category": "spam",
        "title": "Urgent Lottery & Free Holiday",
        "text": "Claim your FREE holiday package before this offer expires! Congratulations, you have won guaranteed cash and free gift vouchers. Reply immediately.",
    },
    {
        "id": "spam-phishing",
        "category": "spam",
        "title": "Urgent Account Security Alert",
        "text": "URGENT: Your bank account will be suspended within 24 hours. Verify your login credentials immediately at the secure link below to prevent account freeze.",
    },
    {
        "id": "ham-meeting",
        "category": "ham",
        "title": "Meeting Sync & Agenda",
        "text": "Hi team, please find attached the revised agenda and slide deck for our quarterly project review meeting tomorrow at 2:00 PM. Let me know if you have additions.",
    },
    {
        "id": "ham-colleague",
        "category": "ham",
        "title": "Quick Question on Task",
        "text": "Can you help me with this task? RefH16120. I checked the documentation and pushed the latest commits to the development branch for your review.",
    },
    {
        "id": "ham-lunch",
        "category": "ham",
        "title": "Lunch Catchup Tomorrow",
        "text": "Hey Alex, are we still on for lunch tomorrow near the office at 12:30? Let me know if that time works or if we should reschedule.",
    },
]


@app.route("/", methods=["GET", "POST"])
def index():
    initial_result = None
    initial_text = ""

    if request.method == "POST":
        initial_text = request.form.get("message", "")
        threshold = float(request.form.get("threshold", 0.5))
        if initial_text.strip():
            initial_result = perform_prediction(initial_text, threshold)

    return render_template(
        "index.html",
        initial_result=initial_result,
        initial_text=initial_text,
        samples=SAMPLE_MESSAGES,
    )


@app.route("/api/predict", methods=["POST"])
def api_predict():
    data = request.get_json(silent=True) or {}
    message = data.get("message") or request.form.get("message", "")
    threshold = float(data.get("threshold") or request.form.get("threshold", 0.5))

    if not message or not message.strip():
        return jsonify({"success": False, "error": "No message text provided."}), 400

    result = perform_prediction(message, threshold)
    return jsonify(result)


@app.route("/api/samples", methods=["GET"])
def api_samples():
    return jsonify(SAMPLE_MESSAGES)


@app.route("/api/model-info", methods=["GET"])
def api_model_info():
    return jsonify({
        "algorithm": "Logistic Regression",
        "framework": "scikit-learn",
        "features": {
            "type": "TfidfVectorizer",
            "ngram_range": [1, 2],
            "max_features": 20000,
            "vocabulary_size": len(vectorizer.vocabulary_),
        },
        "hyperparameters": {
            "max_iter": 1000,
            "random_state": 42,
            "solver": model.solver if hasattr(model, "solver") else "lbfgs",
            "C": model.C if hasattr(model, "C") else 1.0,
        },
        "intercept": float(model.intercept_[0]) if hasattr(model, "intercept_") else None,
        "classes": list(model.classes_),
        "dataset_source": "email_spam_dataset.csv (100,000 samples, 50k spam / 50k ham)",
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print(f"Starting AegisSpam Flask Application on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
