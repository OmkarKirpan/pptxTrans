"use client"
import type { ProcessedSlide } from "@/types"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useSlides } from "@/lib/store"
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided, DraggableStateSnapshot } from "@hello-pangea/dnd"
import { Loader2 } from "lucide-react"
import { useCallback } from "react"

export default function SlideNavigator() {
  const { 
    slides, 
    currentSlideId, 
    setCurrentSlide, 
    reorderSlides, 
    slidesLoading, 
    slidesError,
    syncStatus
  } = useSlides()

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex === destinationIndex) return;
    
    // Update slides order using the optimistic update function
    reorderSlides(sourceIndex, destinationIndex);
  }, [reorderSlides]);

  if (slidesLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center p-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading slides...</span>
        </CardContent>
      </Card>
    );
  }

  if (slidesError) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center p-4 text-destructive">
          Error loading slides: {slidesError}
        </CardContent>
      </Card>
    );
  }

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
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="slides-list">
            {(provided: DroppableProvided) => (
              <div 
                className="p-2 space-y-2"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {slides.map((slide, index) => (
                  <Draggable key={slide.id} draggableId={slide.id} index={index}>
                    {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={cn(
                          "transition-all",
                          snapshot.isDragging && "opacity-70"
                        )}
                      >
                        <button
                          onClick={() => setCurrentSlide(slide.id)}
                          className={cn(
                            "block w-full rounded-md border p-1.5 transition-all hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                            slide.id === currentSlideId ? "border-primary ring-2 ring-primary ring-offset-2" : "border-border",
                            snapshot.isDragging && "shadow-lg"
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
                              {slide._pendingSync && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </ScrollArea>
    </Card>
  )
}
