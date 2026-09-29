from pathlib import Path

import pandas as pd
from flask import Flask, render_template, request
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import warnings

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent
app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static"),
)
DATA_PATH = BASE_DIR / "house_rent.csv"

FEATURE_ORDER = [
    "city",
    "bhk",
    "size_sqft",
    "bathrooms",
    "property_type",
    "furnishing",
    "floor",
    "property_age",
]


def load_model():
    df = pd.read_csv(DATA_PATH)
    df["size_sqft"] = df["size_sqft"].fillna(df["size_sqft"].median())
    df["bathrooms"] = df["bathrooms"].fillna(df["bathrooms"].median())
    df["furnishing"] = df["furnishing"].fillna(df["furnishing"].mode()[0])

    encoders = {}
    for col in ["city", "property_type", "furnishing", "floor"]:
        encoder = LabelEncoder()
        df[col] = encoder.fit_transform(df[col])
        encoders[col] = encoder

    X = df.drop(columns=["rent"])
    y = df["rent"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = RandomForestRegressor(n_estimators=300, random_state=42)
    model.fit(X_train, y_train)

    return model, encoders


MODEL, ENCODERS = load_model()


def prepare_input(form_data):
    raw_values = {
        "city": form_data.get("city"),
        "bhk": form_data.get("bhk"),
        "size_sqft": form_data.get("size_sqft"),
        "bathrooms": form_data.get("bathrooms"),
        "property_type": form_data.get("property_type"),
        "furnishing": form_data.get("furnishing"),
        "floor": form_data.get("floor"),
        "property_age": form_data.get("property_age"),
    }

    for key in ["bhk", "size_sqft", "bathrooms", "property_age"]:
        if raw_values[key] in (None, ""):
            raise ValueError(f"{key.replace('_', ' ').title()} is required.")

    encoded = {
        "city": raw_values["city"],
        "bhk": int(raw_values["bhk"]),
        "size_sqft": float(raw_values["size_sqft"]),
        "bathrooms": float(raw_values["bathrooms"]),
        "property_type": raw_values["property_type"],
        "furnishing": raw_values["furnishing"],
        "floor": raw_values["floor"],
        "property_age": int(raw_values["property_age"]),
    }

    for col in ["city", "property_type", "furnishing", "floor"]:
        valid_values = list(ENCODERS[col].classes_)
        if encoded[col] not in valid_values:
            raise ValueError(f"Please select a valid value for {col.replace('_', ' ')}.")
        encoded[col] = ENCODERS[col].transform([encoded[col]])[0]

    return pd.DataFrame([encoded], columns=FEATURE_ORDER)


@app.route("/", methods=["GET", "POST"])
def index():
    prediction = None
    error = None

    if request.method == "POST":
        try:
            prepared_data = prepare_input(request.form)
            predicted_rent = MODEL.predict(prepared_data)[0]
            prediction = round(float(predicted_rent), 2)
        except ValueError as exc:
            error = str(exc)

    return render_template("index.html", prediction=prediction, error=error)


if __name__ == "__main__":
    app.run(debug=True)
