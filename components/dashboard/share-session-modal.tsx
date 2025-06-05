import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useShare } from '@/lib/store';
import { SharePermission, ShareRecord, CreatedShareInfo } from '@/types/share';
import { Trash2, Copy, Check, Loader2, Share2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ShareSessionModalProps {
  sessionId: string;
  sessionName: string;
  triggerButton?: React.ReactNode;
}

export function ShareSessionModal({ sessionId, sessionName, triggerButton }: ShareSessionModalProps) {
  const {
    sessionShares,
    isLoadingCreate,
    isLoadingSessionShares,
    isLoadingRevoke,
    errorCreate,
    errorSessionShares,
    createShare,
    fetchShares,
    revokeShare,
  } = useShare();

  const [selectedPermissions, setSelectedPermissions] = useState<SharePermission[]>([SharePermission.VIEW]);
  const [shareName, setShareName] = useState('');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const sharesForCurrentSession = sessionShares[sessionId] || [];
  const currentSessionLoading = isLoadingSessionShares[sessionId] || false;
  const currentSessionError = errorSessionShares[sessionId] || null;

  useEffect(() => {
    if (sessionId) {
      fetchShares(sessionId);
    }
  }, [sessionId, fetchShares]);

  const handleGenerateLink = async () => {
    const newShare = await createShare(sessionId, selectedPermissions, '7d', shareName || undefined);
    if (newShare && newShare.share_url) {
      toast({ title: 'Share link generated!', description: `Link: ${newShare.share_url}` });
      setShareName('');
      // fetchShares(sessionId); // Already called in createShare action
    } else if (errorCreate) {
        toast({ title: 'Error generating link', description: errorCreate, variant: 'destructive' });
    }
  };

  const handleRevokeLink = async (shareTokenJti: string) => {
    await revokeShare(shareTokenJti, sessionId);
    toast({ title: 'Share link revoked.' });
    // fetchShares(sessionId); // Already handled by optimistic update or store logic in revokeShare
  };

  const handleCopyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(url);
    toast({ title: 'Copied to clipboard!' });
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const onModalOpenChange = (open: boolean) => {
    if (open && sessionId) {
        fetchShares(sessionId);
    }
  };

  return (
    <Dialog onOpenChange={onModalOpenChange}>
      <DialogTrigger asChild>
        {triggerButton || <Button variant="outline" size="sm"><Share2 className="mr-2 h-4 w-4" /> Share</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Share "{sessionName}"</DialogTitle>
          <DialogDescription>
            Manage access to your translation session. Share links grant access based on selected permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="shareName" className="text-right">
              Link Name (Optional)
            </Label>
            <Input 
              id="shareName" 
              value={shareName} 
              onChange={(e) => setShareName(e.target.value)} 
              className="col-span-3" 
              placeholder="E.g., Review link for Team A"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="permissions" className="text-right">
              Permissions
            </Label>
            <Select
                value={selectedPermissions.join(',')}
                onValueChange={(value) => {
                    setSelectedPermissions(value.split(',') as SharePermission[])
                }}
            >
                <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select permissions" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={SharePermission.VIEW}>View Only</SelectItem>
                    <SelectItem value={SharePermission.COMMENT}>View and Comment</SelectItem>
                    {/* <SelectItem value={SharePermission.EDIT}>View and Edit</SelectItem> */}
                </SelectContent>
            </Select>

          </div>
          <Button onClick={handleGenerateLink} disabled={isLoadingCreate} className="w-full mt-2">
            {isLoadingCreate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate New Share Link
          </Button>
          {errorCreate && <p className="text-sm text-red-500 text-center">Error: {errorCreate}</p>}
        </div>

        <div className="mt-6">
          <h4 className="font-medium mb-2">Existing Share Links</h4>
          {currentSessionLoading && <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> <span className="ml-2">Loading links...</span></div>}
          {currentSessionError && <p className="text-sm text-red-500">Error loading links: {currentSessionError}</p>}
          {!currentSessionLoading && !currentSessionError && sharesForCurrentSession.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No share links generated yet for this session.</p>
          )}
          <div className="max-h-[200px] overflow-y-auto space-y-3 pr-2">
            {sharesForCurrentSession.map((share) => (
              <div key={share.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px]">{share.name || `Link (${share.permissions.join(', ')})`}</p>
                  <p className="text-xs text-muted-foreground">
                    Permissions: {share.permissions.join(', ')} | Expires: {new Date(share.expires_at).toLocaleDateString()}
                  </p>
                  {/* Display the share URL for debugging or if needed, otherwise copy button is main interaction */}
                  {/* <p className="text-xs text-blue-500 truncate max-w-[250px]">{share.share_url || 'URL not available'}</p> */}
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => share.share_url && handleCopyToClipboard(share.share_url)} 
                    disabled={!share.share_url || isLoadingRevoke[share.share_token_jti] || copiedLink === share.share_url}
                    title={share.share_url ? "Copy link" : "Share URL not available for this link"}
                  >
                    {copiedLink === share.share_url ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleRevokeLink(share.share_token_jti)} disabled={isLoadingRevoke[share.share_token_jti]}>
                    {isLoadingRevoke[share.share_token_jti] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 