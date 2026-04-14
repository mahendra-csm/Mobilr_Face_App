"""Manual Gemini smoke test using environment configuration.

This file is intentionally safe to import so it does not execute during pytest collection.
Run it directly with `python backend/test_gemini_new.py`.
"""
import os


def main() -> None:
    import google.generativeai as genai

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY is not set.")
        return

    genai.configure(api_key=api_key)

    for model_name in ("gemini-2.0-flash", "gemini-1.5-flash"):
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content("Say hello in one word")
            print(f"{model_name} SUCCESS: {response.text}")
        except Exception as exc:
            print(f"{model_name} ERROR: {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    main()
