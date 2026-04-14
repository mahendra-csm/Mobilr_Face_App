"""Manual Gemini connectivity check.

This file is intentionally safe to import so it does not execute during pytest collection.
Run it directly with `python backend/test_gemini.py` when you want to verify credentials.
"""
import os
from dotenv import load_dotenv


def main() -> None:
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

    key = os.environ.get('GEMINI_API_KEY')
    print(f"Key present: {bool(key)}")
    if not key:
        print("GEMINI_API_KEY is not set.")
        return

    import google.generativeai as genai

    genai.configure(api_key=key)

    print("\n--- Available models ---")
    try:
        for model_info in genai.list_models():
            methods = [method.name for method in model_info.supported_generation_methods]
            if 'generateContent' in methods:
                print(f"  {model_info.name}")
    except Exception as exc:
        print(f"  Error listing models: {exc}")

    print("\n--- Testing model names ---")
    for name in ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']:
        try:
            model = genai.GenerativeModel(name)
            result = model.generate_content('Say hello in one word')
            print(f"  {name}: OK -> {result.text.strip()[:50]}")
        except Exception as exc:
            print(f"  {name}: FAILED -> {exc}")


if __name__ == "__main__":
    main()
