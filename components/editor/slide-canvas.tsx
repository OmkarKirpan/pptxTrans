"use client"

import type React from "react"

import type { ProcessedSlide } from "@/types"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import Image from "next/image" // For displaying the SVG via URL

interface SlideCanvasProps {
  slide: ProcessedSlide | null
  editable: boolean
  onTextClick: (shapeId: string, originalText: string, currentTranslation?: string, shapeData?: any) => void
  showReadingOrder: boolean
  // scale prop might be less relevant if SVG scales within aspect ratio container
}

export default function SlideCanvas({ slide, editable, onTextClick, showReadingOrder }: SlideCanvasProps) {
  if (!slide || !slide.svg_url) {
    return (
      <Card className="flex h-full w-full items-center justify-center bg-muted/30">
        <CardContent className="p-4 text-center text-muted-foreground">
          <p>
            {slide && !slide.svg_url
              ? "Slide SVG is not available."
              : "No slide selected or slide data is unavailable."}
          </p>
        </CardContent>
      </Card>
    )
  }

  const aspectRatio =
    slide.original_width && slide.original_height ? slide.original_width / slide.original_height : 16 / 9

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gray-200 p-4 dark:bg-gray-800">
      {/* Aspect ratio container for the slide */}
      <div
        className="relative shadow-lg"
        style={{
          width: "100%", // Or a max-width like "1280px"
          maxWidth: `min(100%, ${slide.original_width || 1280}px)`, // Ensure it doesn't get too big if original_width is huge
          aspectRatio: `${aspectRatio}`,
        }}
      >
        {/* SVG Background Image */}
        <Image
          src={slide.svg_url || "/placeholder.svg"}
          alt={`Slide ${slide.slide_number}`}
          layout="fill"
          objectFit="contain" // 'contain' ensures the whole SVG is visible within the aspect ratio
          priority // Prioritize loading current slide image
        />

        {/* Overlay for Interactive Shapes */}
        {slide.shapes.map((shape, index) => {
          if (shape.type !== "text" || !shape.original_text) {
            // Only render interactive overlays for text shapes with actual text
            // Other shapes (images, etc.) are assumed to be part of the SVG background
            return null
          }

          let shapeStyle: React.CSSProperties = {}
          if (shape.coordinates_unit === "percentage") {
            shapeStyle = {
              left: `${shape.x_coordinate}%`,
              top: `${shape.y_coordinate}%`,
              width: `${shape.width}%`,
              height: `${shape.height}%`,
            }
          } else if (shape.coordinates_unit === "px" && slide.original_width && slide.original_height) {
            // Convert pixel coordinates to percentages if original dimensions are known
            shapeStyle = {
              left: `${(shape.x_coordinate / slide.original_width) * 100}%`,
              top: `${(shape.y_coordinate / slide.original_height) * 100}%`,
              width: `${(shape.width / slide.original_width) * 100}%`,
              height: `${(shape.height / slide.original_height) * 100}%`,
            }
          } else {
            // Fallback or if original dimensions aren't available for px units
            // This might lead to incorrect positioning if units are px and original dimensions are missing
            console.warn(
              "Shape uses 'px' units but original slide dimensions are missing. Positioning may be inaccurate.",
            )
            shapeStyle = {
              left: `${shape.x_coordinate}px`, // This will be relative to the scaled container, potentially problematic
              top: `${shape.y_coordinate}px`,
              width: `${shape.width}px`,
              height: `${shape.height}px`,
            }
          }

          return (
            <div
              key={shape.id}
              className={cn(
                "absolute group", // Added group for hover effects on children
                editable && "cursor-pointer",
              )}
              style={shapeStyle}
              onClick={() =>
                editable &&
                shape.original_text &&
                onTextClick(
                  shape.id, 
                  shape.original_text, 
                  shape.translated_text || undefined,
                  {
                    reading_order: shape.reading_order,
                    shape_type: shape.type,
                    position: {
                      x: shape.x_coordinate,
                      y: shape.y_coordinate,
                      width: shape.width,
                      height: shape.height,
                      unit: shape.coordinates_unit
                    }
                  }
                )
              }
              title={editable && shape.original_text ? "Click to edit text" : ""}
            >
              {/* Transparent overlay for interaction, with optional debug border */}
              <div
                className={cn(
                  "w-full h-full border border-transparent", // Transparent border by default
                  editable &&
                    shape.original_text &&
                    "group-hover:border-primary group-hover:bg-primary/10 transition-colors duration-150 ease-in-out", // Visible border on hover
                )}
              >
                {/*
                  Optionally, display the text here for quick reference or if SVG text rendering is imperfect.
                  However, the SVG is the source of visual truth. This text is for interaction.
                  Keep it minimal or style it to be very subtle.
                */}
                {/*
                <div className="truncate text-xs text-transparent group-hover:text-muted-foreground p-0.5">
                  {shape.translated_text || shape.original_text}
                </div>
                */}
              </div>

              {showReadingOrder && (
                <span
                  className="absolute -top-2 -left-2 z-10 flex h-5 w-5 items-center justify-center
                             rounded-full bg-primary text-xs font-bold text-primary-foreground"
                  style={{ transform: "scale(0.8)" }} // Make it a bit smaller
                >
                  {shape.reading_order !== null && shape.reading_order !== undefined ? shape.reading_order : index + 1}
                </span>
              )}
              {shape.has_comments && (
                <div
                  className="absolute -top-1.5 -right-1.5 z-10 h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-500"
                  title="Has comments"
                  style={{ transform: "scale(0.8)" }} // Make it a bit smaller
                ></div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
