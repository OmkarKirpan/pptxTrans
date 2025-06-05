import hashlib
import json
import logging
import os
from typing import Optional, Dict, Any, Tuple

from app.core.config import get_settings
from app.models.schemas import ProcessedPresentation

logger = logging.getLogger(__name__)
settings = get_settings()

class CacheService:
    """
    Manages caching of PPTX processing results to avoid reprocessing identical files
    with the same parameters.
    """
    def __init__(self):
        self.cache_dir = settings.CACHE_DIR
        self._ensure_cache_dir_exists()
        logger.info(f"CacheService initialized. Cache directory: {self.cache_dir}")

    def _ensure_cache_dir_exists(self):
        try:
            os.makedirs(self.cache_dir, exist_ok=True)
        except OSError as e:
            logger.error(f"Error creating cache directory {self.cache_dir}: {e}", exc_info=True)
            # If cache dir cannot be created, caching will effectively be disabled
            # as store/get operations will fail.

    def _generate_file_hash(self, file_path: str) -> Optional[str]:
        """Generates a SHA256 hash for the content of a file."""
        if not os.path.exists(file_path):
            logger.error(f"File not found for hashing: {file_path}")
            return None
        hasher = hashlib.sha256()
        try:
            with open(file_path, 'rb') as f:
                while chunk := f.read(8192): # Read in 8KB chunks
                    hasher.update(chunk)
            return hasher.hexdigest()
        except IOError as e:
            logger.error(f"Error reading file for hashing {file_path}: {e}", exc_info=True)
            return None

    def generate_cache_key(self, file_path: str, params: Dict[str, Any]) -> Optional[str]:
        """
        Generates a unique cache key based on file content and processing parameters.
        Params should include things like source_language, target_language, generate_thumbnails.
        """
        file_hash = self._generate_file_hash(file_path)
        if not file_hash:
            return None

        # Create a stable string from parameters for hashing
        # Sort items to ensure consistent key regardless of param order
        param_string = "".join(f"{k}={v}" for k, v in sorted(params.items()))
        
        key_material = f"{file_hash}-{param_string}"
        return hashlib.sha256(key_material.encode('utf-8')).hexdigest()

    def _get_cache_file_path(self, cache_key: str) -> str:
        """Gets the full path for a cache file given a cache key."""
        return os.path.join(self.cache_dir, f"{cache_key}.json")

    def get_cached_result(self, cache_key: str) -> Optional[Tuple[ProcessedPresentation, str]]:
        """Retrieves a (ProcessedPresentation, result_json_url) tuple from cache."""
        if not cache_key:
            return None
        cache_file_path = self._get_cache_file_path(cache_key)
        if not os.path.exists(cache_file_path):
            logger.debug(f"Cache miss for key {cache_key}. File not found: {cache_file_path}")
            return None
        try:
            with open(cache_file_path, 'r') as f:
                cached_data = json.load(f)
            
            presentation_data = cached_data.get("processed_presentation_dict")
            result_json_url = cached_data.get("result_json_url_on_supabase")

            if presentation_data and result_json_url:
                processed_presentation = ProcessedPresentation(**presentation_data)
                logger.info(f"Cache hit for key {cache_key}. Loaded from {cache_file_path}")
                return processed_presentation, result_json_url
            else:
                logger.error(f"Corrupted cache data for key {cache_key} in {cache_file_path}. Missing fields.")
                self._delete_cache_file(cache_file_path) # Delete corrupted file
                return None
        except (IOError, json.JSONDecodeError, TypeError) as e:
            logger.error(f"Error reading or parsing cache file {cache_file_path}: {e}", exc_info=True)
            self._delete_cache_file(cache_file_path) # Delete corrupted file
            return None

    def store_cached_result(self, cache_key: str, result_data: ProcessedPresentation, result_json_url: str) -> bool:
        """Stores (ProcessedPresentation, result_json_url) in the cache."""
        if not cache_key:
            return False
        cache_file_path = self._get_cache_file_path(cache_key)
        try:
            # Ensure cache directory exists (in case it was deleted after init)
            self._ensure_cache_dir_exists()
            if not os.path.isdir(self.cache_dir):
                 logger.error(f"Cache directory {self.cache_dir} does not exist or is not a directory. Cannot store cache.")
                 return False

            cached_data = {
                "processed_presentation_dict": result_data.model_dump(mode='json'), # Pydantic v2 uses model_dump
                "result_json_url_on_supabase": result_json_url
            }
            with open(cache_file_path, 'w') as f:
                json.dump(cached_data, f, indent=4)
            logger.info(f"Result stored in cache for key {cache_key} at {cache_file_path}")
            return True
        except (IOError, TypeError) as e:
            logger.error(f"Error writing cache file {cache_file_path}: {e}", exc_info=True)
            return False

    def _delete_cache_file(self, file_path: str):
        try:
            os.remove(file_path)
            logger.info(f"Removed cache file: {file_path}")
        except OSError as e:
            logger.error(f"Failed to remove cache file {file_path}: {e}")

    def clear_cache_entry(self, cache_key: str) -> bool:
        """Clears a specific cache entry."""
        if not cache_key:
            return False
        cache_file_path = self._get_cache_file_path(cache_key)
        if os.path.exists(cache_file_path):
            self._delete_cache_file(cache_file_path)
            return True
        return False

    def clear_all_cache(self) -> bool:
        """Clears the entire cache directory."""
        if os.path.exists(self.cache_dir) and os.path.isdir(self.cache_dir):
            try:
                for filename in os.listdir(self.cache_dir):
                    file_path = os.path.join(self.cache_dir, filename)
                    if os.path.isfile(file_path) and filename.endswith(".json"):
                        self._delete_cache_file(file_path)
                logger.info(f"Entire cache directory {self.cache_dir} cleared.")
                return True
            except OSError as e:
                logger.error(f"Error clearing cache directory {self.cache_dir}: {e}", exc_info=True)
                return False
        logger.info(f"Cache directory {self.cache_dir} does not exist or is not a directory. Nothing to clear.")
        return True

# Global instance for easy access, or use dependency injection.
_cache_service_instance: Optional[CacheService] = None

def get_cache_service() -> CacheService:
    global _cache_service_instance
    if _cache_service_instance is None:
        _cache_service_instance = CacheService()
    return _cache_service_instance 