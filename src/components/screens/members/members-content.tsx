'use client';

import { MoreHorizontal, Plus, UserMinus, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorAlert } from '@/components/shared/error-alert';
import { SkeletonTable } from '@/components/shared/skeleton-table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useMembers,
  useInviteMember,
  useUpdateMemberRole,
  useRemoveMember,
  type MemberItem,
} from '@/hooks/use-members';
import { useTenant } from '@/hooks/use-tenant';

const ROLES = ['VIEWER', 'MEMBER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'] as const;

function initials(name: string | null, email: string | null, userId: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      const first = parts[0]?.[0] ?? '';
      const second = parts[1]?.[0] ?? '';
      return (first + second).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return userId.slice(0, 2).toUpperCase();
}

function displayName(m: MemberItem): string {
  const name = m.user?.name?.trim();
  if (name) return name;
  if (m.user?.email) return m.user.email;
  return m.userId;
}

export function MembersContent() {
  const t = useTranslations('members');
  const tCommon = useTranslations('common');
  const { role } = useTenant();
  const canManageMembers = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<string>('MEMBER');
  const [editRoleMember, setEditRoleMember] = React.useState<MemberItem | null>(null);
  const [editRoleValue, setEditRoleValue] = React.useState<string>('MEMBER');
  const [removeMember, setRemoveMember] = React.useState<MemberItem | null>(null);

  const { data, isLoading, isError, error } = useMembers({ limit: 100 });
  const inviteMutation = useInviteMember();
  const updateRoleMutation = useUpdateMemberRole();
  const removeMutation = useRemoveMember();

  const items = (data?.data ?? []) as MemberItem[];

  React.useEffect(() => {
    if (editRoleMember) setEditRoleValue(editRoleMember.role);
  }, [editRoleMember]);

  const handleInvite = () => {
    const email = inviteEmail.trim();
    if (!email) return;
    inviteMutation.mutate(
      { email, role: inviteRole as 'VIEWER' | 'MEMBER' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN' },
      {
        onSuccess: () => {
          setInviteOpen(false);
          setInviteEmail('');
          setInviteRole('MEMBER');
          toast.success(t('invited'));
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleUpdateRole = () => {
    if (!editRoleMember) return;
    updateRoleMutation.mutate(
      {
        userId: editRoleMember.userId,
        role: editRoleValue as 'VIEWER' | 'MEMBER' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN',
      },
      {
        onSuccess: () => {
          setEditRoleMember(null);
          toast.success(t('roleUpdated'));
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleRemove = () => {
    if (!removeMember) return;
    removeMutation.mutate(removeMember.userId, {
      onSuccess: () => {
        setRemoveMember(null);
        toast.success(t('removed'));
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="section-title">{t('title')}</h2>
            {canManageMembers && (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus className="mr-2 size-4" />
                {t('inviteMember')}
              </Button>
            )}
          </div>
          {isError && (
            <ErrorAlert message={error instanceof Error ? error.message : tCommon('error')} />
          )}
          {isLoading && <SkeletonTable rows={5} columns={4} />}
          {!isLoading && !isError && items.length === 0 && (
            <EmptyState
              title={t('empty')}
              description={t('emptyDescription')}
              action={
                canManageMembers ? (
                  <Button onClick={() => setInviteOpen(true)}>
                    <Plus className="mr-2 size-4" />
                    {t('inviteMember')}
                  </Button>
                ) : undefined
              }
            />
          )}
          {!isLoading && !isError && items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('member')}</TableHead>
                  <TableHead>{t('email')}</TableHead>
                  <TableHead>{t('role')}</TableHead>
                  {canManageMembers && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback className="text-xs">
                            {initials(m.user?.name ?? null, m.user?.email ?? null, m.userId)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{displayName(m)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.user?.email ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t(`roles.${m.role}`)}</Badge>
                    </TableCell>
                    {canManageMembers && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">{t('actions')}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditRoleMember(m)}>
                              {t('changeRole')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setRemoveMember(m)}
                            >
                              <UserMinus className="mr-2 size-4" />
                              {t('remove')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('inviteMember')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="invite-email">{t('email')}</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@ejemplo.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-role">{t('role')}</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`roles.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviteMutation.isPending || !inviteEmail.trim()}
            >
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change role dialog */}
      <Dialog
        open={editRoleMember != null}
        onOpenChange={(open) => !open && setEditRoleMember(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('changeRole')}</DialogTitle>
          </DialogHeader>
          {editRoleMember && (
            <>
              <p className="text-sm text-muted-foreground">
                {t('changeRoleFor', { name: displayName(editRoleMember) })}
              </p>
              <div className="grid gap-2 py-2">
                <Label htmlFor="edit-role">{t('role')}</Label>
                <Select value={editRoleValue} onValueChange={setEditRoleValue}>
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`roles.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoleMember(null)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={updateRoleMutation.isPending || !editRoleMember}
            >
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm dialog */}
      <Dialog open={removeMember != null} onOpenChange={(open) => !open && setRemoveMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('removeMember')}</DialogTitle>
          </DialogHeader>
          {removeMember && (
            <p className="text-sm text-muted-foreground">
              {t('removeConfirm', { name: displayName(removeMember) })}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveMember(null)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removeMutation.isPending || !removeMember}
            >
              {t('remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
