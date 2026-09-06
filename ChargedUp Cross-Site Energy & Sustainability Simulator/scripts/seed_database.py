"""Deterministic seed entry point; runtime repository remains in-memory in baseline."""
from pathlib import Path


def main() -> None:
    Path("data/synthetic").mkdir(parents=True, exist_ok=True)
    print("Synthetic baseline data is defined by the authoritative repository.")


if __name__ == "__main__":
    main()
