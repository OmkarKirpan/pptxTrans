import os
import logging
import subprocess
import tempfile
import glob
import asyncio
from typing import Dict, Optional
from app.core.config import get_settings
from app.core.utils import async_retry

logger = logging.getLogger(__name__)
settings = get_settings()

@async_retry(max_retries=5, delay=2.0, backoff=2.0)
async def _get_uno_context_with_retry():
    """
    Connects to the LibreOffice UNO server with a retry mechanism.
    """
    logger.info("Attempting to connect to LibreOffice UNO server...")
    import uno
    from com.sun.star.connection import NoConnectException

    try:
        localContext = uno.getComponentContext()
        resolver = localContext.ServiceManager.createInstanceWithContext(
            "com.sun.star.bridge.UnoUrlResolver", localContext
        )
        ctx = resolver.resolve("uno:socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext")
        logger.info("Successfully connected to LibreOffice UNO server.")
        return ctx
    except NoConnectException as e:
        logger.error(
            "Could not connect to LibreOffice UNO server. Make sure unoserver is running on port 2002.",
            extra={"error": str(e)}
        )
        raise  # Re-raise to trigger retry


async def generate_svgs_via_uno_api(
    presentation_path: str,
    output_dir: str,
    slide_count: int
) -> Dict[int, str]:
    """
    Generate SVG files for each slide using LibreOffice UNO API.
    Returns a dictionary mapping slide numbers to SVG file paths.
    """
    logger.info(f"Starting UNO API SVG generation for {slide_count} slides", 
                extra={"presentation_path": presentation_path, "output_dir": output_dir, "slide_count": slide_count})
    
    try:
        # Connect to UNO server with retry mechanism
        ctx = await _get_uno_context_with_retry()
        
        # Get the desktop service
        desktop = ctx.ServiceManager.createInstanceWithContext(
            "com.sun.star.frame.Desktop", ctx
        )
        
        # Load the presentation
        file_url = f"file://{os.path.abspath(presentation_path)}"
        doc = desktop.loadComponentFromURL(
            file_url, "_blank", 0, ()
        )
        
        if not doc:
            raise RuntimeError("Failed to load presentation via UNO API")
        
        logger.info("Successfully loaded presentation via UNO API")
        
        # Get the presentation controller
        controller = doc.getCurrentController()
        
        svg_paths = {}
        
        # Process each slide individually
        for i in range(slide_count):
            try:
                # Go to the specific slide
                controller.setCurrentPage(doc.getDrawPages().getByIndex(i))
                
                # Export current slide to SVG
                svg_filename = f"slide_{i+1}.svg"
                svg_path = os.path.join(output_dir, svg_filename)
                svg_url = f"file://{os.path.abspath(svg_path)}"
                
                # Create export filter properties
                filter_props = (
                    ("FilterName", "impress_svg_Export"),
                    ("Overwrite", True),
                )
                
                # Export the current slide
                doc.storeToURL(svg_url, filter_props)
                
                if os.path.exists(svg_path):
                    svg_paths[i + 1] = svg_path
                    logger.debug(f"Generated SVG for slide {i+1}: {svg_path}")
                else:
                    logger.warning(f"SVG file not created for slide {i+1}")
                    
            except Exception as e:
                logger.error(f"Error processing slide {i+1} via UNO API: {str(e)}")
                # Continue with other slides
                continue
        
        # Close the document
        doc.close(True)
        
        logger.info(f"UNO API SVG generation completed. Generated {len(svg_paths)}/{slide_count} slides.")
        return svg_paths
        
    except Exception as e:
        logger.error(f"UNO API SVG generation failed: {str(e)}", exc_info=True)
        raise


async def generate_svgs_via_libreoffice_batch(
    presentation_path: str,
    output_dir: str,
    slide_count: int
) -> Dict[int, str]:
    """
    Generate SVG files using LibreOffice batch conversion as fallback.
    Returns a dictionary mapping slide numbers to SVG file paths.
    """
    logger.info(f"Starting LibreOffice batch SVG generation for {slide_count} slides",
                extra={"presentation_path": presentation_path, "output_dir": output_dir, "slide_count": slide_count})
    
    if not settings.LIBREOFFICE_PATH or not os.path.exists(settings.LIBREOFFICE_PATH):
        raise ValueError("LibreOffice not configured or not found")
    
    try:
        # Create temporary directory for LibreOffice output
        with tempfile.TemporaryDirectory() as temp_dir:
            # LibreOffice command for batch conversion
            cmd = [
                settings.LIBREOFFICE_PATH,
                "--headless",
                "--invisible",
                "--nodefault",
                "--norestore",
                "--convert-to", "svg:impress_svg_Export",
                "--outdir", temp_dir,
                presentation_path
            ]
            
            logger.debug(f"Executing LibreOffice command: {' '.join(cmd)}")
            
            # Execute LibreOffice conversion
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=120)
            
            if process.returncode != 0:
                error_msg = f"LibreOffice conversion failed with return code {process.returncode}"
                if stderr:
                    error_msg += f". Error: {stderr.decode()}"
                raise RuntimeError(error_msg)
            
            logger.info("LibreOffice batch conversion completed successfully")
            
            # Find generated SVG files
            svg_files = glob.glob(os.path.join(temp_dir, "*.svg"))
            svg_files.sort()  # Ensure consistent ordering
            
            if len(svg_files) != slide_count:
                logger.warning(f"Expected {slide_count} SVG files, found {len(svg_files)}")
            
            # Move SVG files to output directory and create mapping
            svg_paths = {}
            for i, svg_file in enumerate(svg_files[:slide_count]):  # Limit to expected count
                slide_number = i + 1
                destination_path = os.path.join(output_dir, f"slide_{slide_number}.svg")
                
                # Move file to final destination
                os.rename(svg_file, destination_path)
                svg_paths[slide_number] = destination_path
                
                logger.debug(f"Moved SVG for slide {slide_number}: {destination_path}")
            
            logger.info(f"LibreOffice batch SVG generation completed. Generated {len(svg_paths)}/{slide_count} slides.")
            return svg_paths
            
    except asyncio.TimeoutError:
        logger.error("LibreOffice conversion timed out")
        raise RuntimeError("LibreOffice conversion timed out")
    except Exception as e:
        logger.error(f"LibreOffice batch SVG generation failed: {str(e)}", exc_info=True)
        raise


async def generate_svgs(
    presentation_path: str,
    output_dir: str,
    slide_count: int
) -> Dict[int, str]:
    """
    Main function to generate SVG files for slides.
    Tries UNO API first, then falls back to LibreOffice batch conversion.
    Returns a dictionary mapping slide numbers to SVG file paths.
    """
    logger.info(f"Starting SVG generation for {slide_count} slides", 
                extra={"presentation_path": presentation_path, "output_dir": output_dir, "slide_count": slide_count})
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Try UNO API first (preferred method for individual slide control)
    try:
        svg_paths = await generate_svgs_via_uno_api(presentation_path, output_dir, slide_count)
        if len(svg_paths) == slide_count:
            logger.info("UNO API SVG generation successful for all slides")
            return svg_paths
        else:
            logger.warning(f"UNO API generated {len(svg_paths)}/{slide_count} slides, falling back to batch conversion")
    except Exception as e:
        logger.warning(f"UNO API SVG generation failed: {str(e)}, falling back to batch conversion")
    
    # Fallback to LibreOffice batch conversion
    try:
        svg_paths = await generate_svgs_via_libreoffice_batch(presentation_path, output_dir, slide_count)
        if len(svg_paths) > 0:
            logger.info("LibreOffice batch SVG generation successful")
            return svg_paths
        else:
            raise RuntimeError("No SVG files generated by LibreOffice batch conversion")
    except Exception as e:
        logger.error(f"Both UNO API and LibreOffice batch conversion failed: {str(e)}", exc_info=True)
        raise RuntimeError(f"SVG generation failed: {str(e)}")


def validate_libreoffice_availability() -> bool:
    """
    Validate that LibreOffice is available and functional.
    """
    if not settings.LIBREOFFICE_PATH or not os.path.exists(settings.LIBREOFFICE_PATH):
        logger.error("LibreOffice path not configured or file not found")
        return False
    
    try:
        # Test LibreOffice functionality
        test_command = [settings.LIBREOFFICE_PATH, "--help"]
        result = subprocess.run(test_command, check=True, capture_output=True, text=True, timeout=30)
        logger.info(f"LibreOffice is available at: {settings.LIBREOFFICE_PATH}")
        return True
    except Exception as e:
        logger.error(f"LibreOffice test failed: {str(e)}")
        return False 