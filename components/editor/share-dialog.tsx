'use client';

import { useState, useEffect } from 'react';
import { useShare } from '@/lib/store';
import { SharePermissions } from '@/types/store/share';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
}

export function ShareDialog({ open, onOpenChange, sessionId }: ShareDialogProps) {
  const { shares, isLoading, error, generateShareLink, listSessionShares, revokeShare } = useShare();
  const [shareUrl, setShareUrl] = useState('');
  const [permissions, setPermissions] = useState<SharePermissions>({
    read: true,
    comment: false,
    edit: false,
  });

  // Load existing shares when the dialog opens
  useEffect(() => {
    if (open && sessionId) {
      listSessionShares(sessionId).catch(err => {
        toast({
          title: 'Error',
          description: 'Failed to load shares',
          variant: 'destructive',
        });
      });
    }
  }, [open, sessionId, listSessionShares]);

  // Handle permission change
  const handlePermissionChange = (permission: keyof SharePermissions) => {
    setPermissions(prev => ({
      ...prev,
      [permission]: !prev[permission],
    }));
  };

  // Generate share link
  const handleGenerateLink = async () => {
    try {
      const url = await generateShareLink(sessionId, permissions);
      setShareUrl(url);
      
      // Copy to clipboard
      navigator.clipboard.writeText(url);
      
      toast({
        title: 'Share link generated',
        description: 'Link has been copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate share link',
        variant: 'destructive',
      });
    }
  };

  // Revoke share
  const handleRevokeShare = async (shareId: string) => {
    try {
      await revokeShare(shareId);
      toast({
        title: 'Share revoked',
        description: 'The share link has been revoked',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to revoke share link',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Presentation</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Permissions</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="read" 
                  checked={permissions.read} 
                  onCheckedChange={() => handlePermissionChange('read')}
                />
                <Label htmlFor="read">Read (view slides)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="comment" 
                  checked={permissions.comment} 
                  onCheckedChange={() => handlePermissionChange('comment')}
                />
                <Label htmlFor="comment">Comment (add comments)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="edit" 
                  checked={permissions.edit} 
                  onCheckedChange={() => handlePermissionChange('edit')}
                />
                <Label htmlFor="edit">Edit (modify translations)</Label>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={handleGenerateLink} 
            disabled={isLoading || !permissions.read}
          >
            Generate Share Link
          </Button>
          
          {shareUrl && (
            <div className="space-y-2">
              <Label htmlFor="share-url">Share URL</Label>
              <div className="flex space-x-2">
                <Input 
                  id="share-url" 
                  value={shareUrl} 
                  readOnly 
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button 
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    toast({
                      title: 'Copied!',
                      description: 'Link copied to clipboard',
                    });
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}
          
          {shares.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Active Share Links</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {shares.map(share => (
                  <div key={share.id} className="flex justify-between items-center border p-2 rounded-md">
                    <div>
                      <p className="text-xs">
                        {share.permissions.read ? 'Read ' : ''}
                        {share.permissions.comment ? 'Comment ' : ''}
                        {share.permissions.edit ? 'Edit' : ''}
                      </p>
                      {share.expires_at && (
                        <p className="text-xs text-muted-foreground">
                          Expires: {new Date(share.expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleRevokeShare(share.id)}
                      disabled={isLoading}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 