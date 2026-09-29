from pathlib import Path

import pandas as pd
from flask import Flask, render_template, request
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline


BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "email_spam_dataset.csv"


def train_model():
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")

    dataset = pd.read_csv(DATASET_PATH)
    required_columns = {"input", "output"}
    if not required_columns.issubset(dataset.columns):
        raise ValueError("The dataset must contain 'input' and 'output' columns.")

    dataset = dataset.dropna(subset=["input", "output"])
    messages = dataset["input"].astype(str)
    labels = dataset["output"].astype(str).str.strip().str.lower()
    valid_rows = labels.isin({"spam", "ham"})
    messages = messages[valid_rows]
    labels = labels[valid_rows]

    if messages.empty:
        raise ValueError("The dataset does not contain any labeled messages.")

    model = make_pipeline(
        TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=80_000),
        MultinomialNB(alpha=0.25),
    )
    model.fit(messages, labels)
    return model


model = train_model()
app = Flask(__name__)


@app.route("/", methods=["GET", "POST"])
def index():
    message = ""
    result = None
    error = None

    if request.method == "POST":
        message = request.form.get("message", "").strip()
        if not message:
            error = "Paste a message first so it can be checked."
        else:
            prediction = model.predict([message])[0]
            result = "spam" if prediction == "spam" else "not_spam"

    return render_template("index.html", message=message, result=result, error=error)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)