import asyncio
import logging
from typing import Callable, Coroutine, Dict, Any, Optional

from app.services.worker_pool import WorkerPool

logger = logging.getLogger(__name__)

class ProcessingManager:
    """
    Manages a queue of PPTX processing jobs and dispatches them to a WorkerPool.
    """
    _instance: Optional['ProcessingManager'] = None

    def __init__(self, worker_pool: WorkerPool, process_func: Callable[..., Coroutine[Any, Any, None]]):
        if ProcessingManager._instance is not None:
            # This check is more for a strict singleton pattern.
            # In some cases, re-initialization might be acceptable if state is reset.
            raise Exception("ProcessingManager is a singleton and already initialized.")
        
        self.worker_pool = worker_pool
        self.process_func = process_func
        self.job_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()
        self._processor_task: Optional[asyncio.Task] = None
        self._is_running = False
        
        # Metrics
        self.jobs_submitted_count = 0
        self.jobs_succeeded_count = 0
        self.jobs_failed_count = 0
        
        ProcessingManager._instance = self
        logger.info("ProcessingManager initialized.")

    @classmethod
    def get_instance(cls) -> 'ProcessingManager':
        if cls._instance is None:
            raise Exception("ProcessingManager has not been initialized. Call initialize_processing_manager() first.")
        return cls._instance

    async def submit_job(self, job_details: Dict[str, Any]):
        """
        Submits a new job to the processing queue.
        """
        await self.job_queue.put(job_details)
        self.jobs_submitted_count += 1
        logger.info(f"Job {job_details.get('job_id', 'unknown')} submitted. Queue size: {self.current_queue_size()}, Submitted: {self.jobs_submitted_count}")

    async def _execute_job(self, job_details: Dict[str, Any]):
        job_id = job_details.get('job_id', 'unknown')
        logger.info(f"Starting execution of job {job_id}. Busy workers: {self.worker_pool.current_busy_slots_count}")
        try:
            await self.process_func(**job_details)
            self.jobs_succeeded_count += 1
            logger.info(f"Successfully completed job {job_id}. Succeeded: {self.jobs_succeeded_count}")
        except Exception as e:
            self.jobs_failed_count += 1
            logger.error(f"Error processing job {job_id}: {str(e)}", exc_info=True)
            logger.info(f"Job {job_id} failed. Failed: {self.jobs_failed_count}")
            # Job status should be updated to FAILED within process_func or a wrapper if not already.
        finally:
            self.worker_pool.release_worker()
            self.job_queue.task_done()
            logger.info(f"Worker released for job {job_id}. Queue size: {self.current_queue_size()}. Busy workers: {self.worker_pool.current_busy_slots_count}")

    async def _run_processor_loop(self):
        logger.info("Processing manager loop started. Waiting for jobs...")
        self._is_running = True
        while self._is_running or not self.job_queue.empty():
            try:
                job_details = await asyncio.wait_for(self.job_queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                if not self._is_running and self.job_queue.empty():
                    logger.info("Processor loop: Not running and queue empty. Exiting.")
                    break 
                continue
            except Exception as e:
                logger.error(f"Error getting job from queue: {e}", exc_info=True)
                if not self._is_running:
                    logger.info("Processor loop: Not running after queue error. Exiting.")
                    break
                await asyncio.sleep(1) 
                continue
            
            job_id_for_log = job_details.get('job_id', 'unknown')
            logger.info(f"Acquiring worker for job {job_id_for_log}. Available slots: {self.worker_pool.available_slots}")
            await self.worker_pool.acquire_worker()
            logger.info(f"Worker acquired for job {job_id_for_log}. Dispatching job.")
            asyncio.create_task(self._execute_job(job_details))
        
        self._is_running = False # Ensure is_running is false when loop exits
        logger.info("Processing manager loop finished.")

    def start(self):
        if self._processor_task is None or self._processor_task.done():
            self._is_running = True
            self._processor_task = asyncio.create_task(self._run_processor_loop())
            logger.info("ProcessingManager started.")
        else:
            logger.warning("ProcessingManager already running or start called without stop/completion.")

    async def stop(self, graceful: bool = True):
        logger.info(f"Stopping ProcessingManager... Graceful: {graceful}")
        self._is_running = False
        if self._processor_task is not None and not self._processor_task.done():
            if graceful:
                logger.info("Graceful stop: Waiting for processor loop to finish queue and tasks...")
                try:
                    await asyncio.wait_for(self._processor_task, timeout=300) # 5 min timeout
                    logger.info("Processor loop completed gracefully.")
                except asyncio.TimeoutError:
                    logger.warning("Graceful shutdown timed out. Cancelling processor loop.")
                    self._processor_task.cancel()
                except Exception as e:
                    logger.error(f"Exception during graceful shutdown of processor loop: {e}", exc_info=True)
                    self._processor_task.cancel() # Cancel on other exceptions too
            else:
                logger.info("Forcing immediate stop: Cancelling processor loop.")
                self._processor_task.cancel()
            
            try:
                await self._processor_task 
            except asyncio.CancelledError:
                logger.info("Processor task was cancelled.")
            except Exception as e:
                 logger.error(f"Error encountered while awaiting cancelled processor task: {e}", exc_info=True)
        
        logger.info("ProcessingManager stop sequence complete.")
        self._processor_task = None # Clear the task reference

    async def join_queue(self):
        """Waits until all items in the queue have been received and processed."""
        await self.job_queue.join()
        logger.info("All jobs in the queue have been processed.")

    def current_queue_size(self) -> int:
        return self.job_queue.qsize()

    def get_metrics(self) -> Dict[str, Any]:
        return {
            "jobs_submitted": self.jobs_submitted_count,
            "jobs_succeeded": self.jobs_succeeded_count,
            "jobs_failed": self.jobs_failed_count,
            "current_queue_size": self.current_queue_size(),
            "is_running": self._is_running,
            "worker_pool_metrics": self.worker_pool.get_metrics()
        }

_processing_manager_instance: Optional[ProcessingManager] = None

def initialize_processing_manager(worker_pool: WorkerPool, process_func: Callable[..., Coroutine[Any, Any, None]]) -> ProcessingManager:
    global _processing_manager_instance
    if _processing_manager_instance is None:
        _processing_manager_instance = ProcessingManager(worker_pool, process_func)
        logger.info("Global ProcessingManager instance created.")
    # else: consider if re-initialization should update or error
    # logger.warning("ProcessingManager already initialized. Returning existing instance.")
    return _processing_manager_instance

def get_processing_manager() -> ProcessingManager:
    if _processing_manager_instance is None:
        raise RuntimeError("ProcessingManager not initialized. Call initialize_processing_manager first.")
    return _processing_manager_instance 