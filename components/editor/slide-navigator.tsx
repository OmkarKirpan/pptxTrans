"use client"
import type { ProcessedSlide } from "@/types"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface SlideNavigatorProps {
  slides: ProcessedSlide[]
  currentSlideId: string | null
  onSelectSlide: (slideId: string) => void
}

export default function SlideNavigator({ slides, currentSlideId, onSelectSlide }: SlideNavigatorProps) {
  if (!slides || slides.length === 0) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center p-4 text-muted-foreground">
          No slides to display.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="h-full overflow-hidden">
      <ScrollArea className="h-full">
        <div className="p-2 space-y-2">
          {slides.map((slide) => (
            <button
              key={slide.id}
              onClick={() => onSelectSlide(slide.id)}
              className={cn(
                "block w-full rounded-md border p-1.5 transition-all hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                slide.id === currentSlideId ? "border-primary ring-2 ring-primary ring-offset-2" : "border-border",
              )}
            >
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-muted-foreground w-6 text-center">{slide.slide_number}</span>
                <div className="aspect-video w-full flex-1 bg-muted rounded-sm overflow-hidden">
                  <Image
                    src={slide.svg_url || `/placeholder.svg?width=160&height=90&query=Slide ${slide.slide_number}`}
                    alt={`Slide ${slide.slide_number}`}
                    width={160}
                    height={90}
                    className="object-cover w-full h-full"
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  )
}
