import asyncio
import logging
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class WorkerPool:
    """
    Manages a pool of available workers for concurrent task execution.
    Uses an asyncio.Semaphore to limit the number of concurrent tasks.
    """
    def __init__(self, max_workers: int = 0):
        self.max_workers = max_workers or settings.MAX_CONCURRENT_JOBS
        if self.max_workers <= 0:
            logger.warning(f"Max concurrent jobs is {self.max_workers}, defaulting to 1. Check MAX_CONCURRENT_JOBS env var.")
            self.max_workers = 1
            
        self._semaphore = asyncio.Semaphore(self.max_workers)
        self._current_busy_slots = 0
        self.total_tasks_acquired = 0
        self.total_tasks_released = 0
        logger.info(f"WorkerPool initialized with {self.max_workers} worker slots.")

    async def acquire_worker(self):
        """Acquires a worker slot. Blocks if all workers are busy."""
        await self._semaphore.acquire()
        # Atomically increment busy slots after acquiring
        # This requires a lock if accessed from multiple threads, but asyncio is single-threaded per loop
        self._current_busy_slots += 1
        self.total_tasks_acquired += 1
        logger.debug(f"Worker slot acquired. Busy slots: {self._current_busy_slots}/{self.max_workers}")

    def release_worker(self):
        """Releases a worker slot."""
        self._semaphore.release()
        # Atomically decrement busy slots before releasing
        self._current_busy_slots -= 1
        self.total_tasks_released += 1 
        logger.debug(f"Worker slot released. Busy slots: {self._current_busy_slots}/{self.max_workers}")

    @property
    def available_slots(self) -> int:
        """Returns the number of currently available worker slots."""
        return self.max_workers - self._current_busy_slots

    @property
    def current_busy_slots_count(self) -> int:
        """Returns the number of currently busy worker slots."""
        return self._current_busy_slots

    def get_max_workers(self) -> int:
        return self.max_workers

    def get_metrics(self) -> dict:
        return {
            "max_workers": self.max_workers,
            "current_busy_slots": self.current_busy_slots_count,
            "available_slots": self.available_slots,
            "total_tasks_acquired": self.total_tasks_acquired,
            "total_tasks_released": self.total_tasks_released
        }

# Global instance (or manage via dependency injection in a real app)
# For simplicity here, a global instance.
# worker_pool_instance = WorkerPool() 