import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Audit Log | PowerPoint Translator',
  description: 'View audit history for your translation session',
};

export default function AuditLogPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  
  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Audit Log</h1>
      <p className="text-muted-foreground mb-8">
        View the history of changes for session {sessionId}
      </p>
      
      <div className="flex justify-center items-center h-[50vh]">
        <AuditLogClientContent sessionId={sessionId} />
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatDistanceToNow } from 'date-fns';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

function AuditLogClientContent({ sessionId }: { sessionId: string }) {
  const { 
    auditLogs, 
    isLoading, 
    error, 
    totalCount, 
    currentPage, 
    pageSize, 
    goToPage, 
    refresh 
  } = useAuditLog(sessionId);
  const { toast } = useToast();

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / pageSize);

  // Generate pagination items
  const getPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 7;
    const ellipsisOffset = 1; // Pages to show before adding ellipsis

    if (totalPages <= maxVisiblePages) {
      // Show all pages if there aren't many
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink 
              href="#" 
              onClick={(e) => { e.preventDefault(); goToPage(i); }}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // Always show first page
      items.push(
        <PaginationItem key={1}>
          <PaginationLink 
            href="#" 
            onClick={(e) => { e.preventDefault(); goToPage(1); }}
            isActive={currentPage === 1}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      // Add ellipsis if needed before current page section
      if (currentPage > 2 + ellipsisOffset) {
        items.push(
          <PaginationItem key="ellipsis-1">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Pages around current page
      const startPage = Math.max(2, currentPage - ellipsisOffset);
      const endPage = Math.min(totalPages - 1, currentPage + ellipsisOffset);

      for (let i = startPage; i <= endPage; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink 
              href="#" 
              onClick={(e) => { e.preventDefault(); goToPage(i); }}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }

      // Add ellipsis if needed after current page section
      if (currentPage < totalPages - 1 - ellipsisOffset) {
        items.push(
          <PaginationItem key="ellipsis-2">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Always show last page
      if (totalPages > 1) {
        items.push(
          <PaginationItem key={totalPages}>
            <PaginationLink 
              href="#" 
              onClick={(e) => { e.preventDefault(); goToPage(totalPages); }}
              isActive={currentPage === totalPages}
            >
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      }
    }

    return items;
  };

  // Get action badge color based on action type
  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-green-100 text-green-800';
      case 'edit':
        return 'bg-blue-100 text-blue-800';
      case 'merge':
        return 'bg-purple-100 text-purple-800';
      case 'comment':
        return 'bg-yellow-100 text-yellow-800';
      case 'export':
        return 'bg-orange-100 text-orange-800';
      case 'share':
      case 'unshare':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading && auditLogs.length === 0) {
    return (
      <div className="space-y-4 w-full max-w-4xl">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-3 w-1/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (auditLogs.length === 0 && !isLoading) {
    return (
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>No Audit Logs Found</CardTitle>
          <CardDescription>
            There are no audit records for this session yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Actions like creating, editing, and exporting will be recorded here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-4xl">
      {auditLogs.map((log) => (
        <Card key={log.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                <Badge className={getActionBadgeColor(log.action)}>
                  {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                </Badge>
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
              </span>
            </div>
            <CardDescription>
              User: {log.userId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {log.details ? (
              <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">No additional details</p>
            )}
          </CardContent>
        </Card>
      ))}

      {totalPages > 1 && (
        <Pagination className="mt-8">
          <PaginationContent>
            {currentPage > 1 && (
              <PaginationItem>
                <PaginationPrevious 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); goToPage(currentPage - 1); }} 
                />
              </PaginationItem>
            )}
            
            {getPaginationItems()}
            
            {currentPage < totalPages && (
              <PaginationItem>
                <PaginationNext 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); goToPage(currentPage + 1); }} 
                />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
} 