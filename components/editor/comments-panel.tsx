"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { MessageSquare } from "lucide-react"
import { useComments } from "@/lib/store"
import { useSlides } from "@/lib/store"

export default function CommentsPanel() {
  const { currentSlide } = useSlides()
  const { comments } = useComments(currentSlide?.id)
  
  // Calculate if any shape has comments
  const hasComments = currentSlide && currentSlide.shapes.some(shape => shape.has_comments)
  
  return (
    <Card className="h-full">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center text-lg">
          <MessageSquare className="mr-2 h-5 w-5 text-primary" />
          Comments
        </CardTitle>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-4.5rem)] items-center justify-center p-4">
        {!currentSlide ? (
          <div className="text-center text-muted-foreground">
            <p className="mb-1 text-sm">No slide selected</p>
          </div>
        ) : !hasComments ? (
          <div className="text-center text-muted-foreground">
            <p className="mb-1 text-sm">No comments on this slide</p>
            <p className="text-xs">Select a text element to add a comment</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center text-muted-foreground">
            <p className="mb-1 text-sm">Select a text element on the slide</p>
            <p className="text-xs">to view or add comments</p>
          </div>
        ) : (
          <div className="w-full">
            {/* This would be replaced with actual comments UI when we implement it */}
            <p className="text-sm text-muted-foreground text-center">Comments UI will be implemented in a future phase</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
