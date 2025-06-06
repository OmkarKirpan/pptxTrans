import asyncio
import logging
from functools import wraps
from typing import Callable, Any, Coroutine

logger = logging.getLogger(__name__)

def async_retry(max_retries: int = 3, delay: float = 1.0, backoff: float = 2.0):
    """
    A decorator for retrying an async function with exponential backoff.
    """
    def decorator(func: Callable[..., Coroutine[Any, Any, Any]]):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_delay = delay
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        logger.error(
                            f"Function '{func.__name__}' failed after {max_retries} attempts. Giving up.",
                            extra={"function_name": func.__name__, "attempt": attempt + 1, "max_retries": max_retries, "error": str(e)},
                            exc_info=True
                        )
                        raise
                    
                    logger.warning(
                        f"Function '{func.__name__}' failed on attempt {attempt + 1}/{max_retries}. Retrying in {current_delay:.2f} seconds...",
                        extra={"function_name": func.__name__, "attempt": attempt + 1, "max_retries": max_retries, "delay": current_delay, "error": str(e)}
                    )
                    await asyncio.sleep(current_delay)
                    current_delay *= backoff
        return wrapper
    return decorator 