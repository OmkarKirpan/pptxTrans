import { Button } from "@/components/ui/button"
import { FilePlus2, PlusCircle } from "lucide-react"
import Link from "next/link"

export default function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/50 p-12 text-center shadow-sm">
      <FilePlus2 className="mx-auto h-16 w-16 text-muted-foreground" />
      <h3 className="mt-6 text-2xl font-semibold tracking-tight">No Translation Sessions Yet</h3>
      <p className="mb-6 mt-2 text-base text-muted-foreground">
        Get started by creating your first translation session.
      </p>
      <Button asChild size="lg">
        <Link href="/dashboard/new-session">
          <PlusCircle className="mr-2 h-5 w-5" />
          Create New Session
        </Link>
      </Button>
    </div>
  )
}
