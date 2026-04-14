"""Manual OpenAI connectivity check.

This file is intentionally safe to import so it does not execute during pytest collection.
Run it directly with `python backend/test_openai.py` when you want to verify credentials.
"""
import os
from dotenv import load_dotenv


def main() -> None:
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

    key = os.environ.get('OPENAI_API_KEY')
    print(f"Key present: {bool(key)}")
    if not key:
        print("OPENAI_API_KEY is not set.")
        return

    from openai import OpenAI

    client = OpenAI(api_key=key)

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say hello in one word"},
            ],
            max_tokens=50,
        )
        print(f"SUCCESS: {response.choices[0].message.content}")
    except Exception as exc:
        print(f"ERROR: {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    main()
