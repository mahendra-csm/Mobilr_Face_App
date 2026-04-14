"""Manual Groq connectivity check.

This file is intentionally safe to import so it does not execute during pytest collection.
Run it directly with `python backend/test_groq.py` when you want to verify credentials.
"""
import os


def main() -> None:
    from groq import Groq

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("GROQ_API_KEY is not set.")
        return

    client = Groq(api_key=api_key)

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say hello in one word"},
            ],
            max_tokens=50,
        )
        print(f"SUCCESS: {response.choices[0].message.content}")
        print(f"Model: {response.model}")
        print(f"Usage: {response.usage}")
    except Exception as exc:
        print(f"ERROR: {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    main()
