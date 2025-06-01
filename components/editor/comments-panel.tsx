"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { MessageSquare } from "lucide-react"

export default function CommentsPanel() {
  return (
    <Card className="h-full">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center text-lg">
          <MessageSquare className="mr-2 h-5 w-5 text-primary" />
          Comments
        </CardTitle>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-4.5rem)] items-center justify-center p-4">
        {" "}
        {/* Adjust height based on header */}
        <div className="text-center text-muted-foreground">
          <p className="mb-1 text-sm">Select a text element on the slide</p>
          <p className="text-xs">to view or add comments.</p>
        </div>
      </CardContent>
    </Card>
  )
}
