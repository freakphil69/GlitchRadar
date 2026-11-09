import asyncio
import sys

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
import server  # noqa: E402


async def main():
    r = await server.classify_fake([
        "PS5 Slim Digital für 299€ bei Amazon | Amazon | Preis inkl. Versand",
        "GEWINNSPIEL: Gewinne ein iPhone 17! Jetzt teilnehmen | Instagram | Gewinnspiel",
    ])
    print(r)


asyncio.run(main())
