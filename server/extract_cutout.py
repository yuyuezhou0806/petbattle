"""Create a transparent pet cutout with the same model used by the card API."""

import sys
from pathlib import Path

from rembg import new_session, remove


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract_cutout.py INPUT OUTPUT")
    source = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    destination.write_bytes(
        remove(source.read_bytes(), session=new_session("u2netp"), alpha_matting=True)
    )


if __name__ == "__main__":
    main()
