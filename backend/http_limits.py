"""Bound decoded response buffers without retaining a process-wide body cache."""


class ResponseTooLarge(ValueError):
    pass


async def bounded_get(client, url: str, max_bytes: int, **kwargs):
    """Return headers/body; close early on overflow, including decoded gzip data."""
    async with client.stream("GET", url, **kwargs) as response:
        response.raise_for_status()
        body = bytearray()
        async for chunk in response.aiter_bytes():
            if len(body) + len(chunk) > max_bytes:
                raise ResponseTooLarge(f"Antwort überschreitet {max_bytes} Bytes")
            body.extend(chunk)
        return response.headers, bytes(body)
