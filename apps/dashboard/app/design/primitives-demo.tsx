"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/layout";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xs font-medium uppercase tracking-widest text-text-subtle">{title}</h2>
      {children}
    </section>
  );
}

export function PrimitivesDemo() {
  const confirm = useConfirm();
  return (
    <div className="space-y-14">
      <Group title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Get started</Button>
          <Button variant="ink">Watch video</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="soft">Soft</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete</Button>
          <Button variant="link">Link</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">
            Large <Icon name="arrow-right" size="sm" />
          </Button>
          <Button size="icon" variant="outline" aria-label="Notifications">
            <Icon name="bell" />
          </Button>
          <Button size="icon-sm" variant="soft" aria-label="Edit">
            <Icon name="pen" size="sm" />
          </Button>
        </div>
      </Group>

      <Group title="Form controls">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" htmlFor="d-email" hint="We never share your email.">
            <Input id="d-email" placeholder="you@company.com" />
          </Field>
          <Field label="Name" htmlFor="d-name" error="This field is required.">
            <Input id="d-name" aria-invalid defaultValue="" />
          </Field>
          <Field label="Plan" htmlFor="d-plan">
            <Select defaultValue="pro">
              <SelectTrigger id="d-plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="agency">Agency</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Message" htmlFor="d-msg">
            <Textarea id="d-msg" placeholder="Write your testimonial…" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox defaultChecked /> Approve automatically
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch defaultChecked /> Show on widget
          </label>
        </div>
      </Group>

      <Group title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge variant="brand">Brand</Badge>
          <Badge variant="success">Approved</Badge>
          <Badge variant="warning">Pending</Badge>
          <Badge variant="info">Draft</Badge>
          <Badge variant="danger">Rejected</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="eyebrow">High efficient</Badge>
        </div>
      </Group>

      <Group title="Cards">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Default card</CardTitle>
              <CardDescription>Hairline border, soft shadow.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-text-muted">Content sits on the surface token.</CardContent>
          </Card>
          <Card variant="pink" padding="md" className="space-y-2">
            <h3 className="text-lg font-medium">Pink panel</h3>
            <p className="text-sm opacity-70">Pastel tints for feature blocks.</p>
          </Card>
          <Card variant="lime" padding="md" className="space-y-2">
            <h3 className="text-lg font-medium">Lime panel</h3>
            <p className="text-sm opacity-70">Pair with product shots.</p>
          </Card>
          <Card variant="peach" padding="md">Peach</Card>
          <Card variant="cream" padding="md">Cream</Card>
          <Card variant="inverse" padding="md" className="space-y-2">
            <h3 className="text-lg font-medium">Inverse band</h3>
            <p className="text-sm opacity-70">Testimonial and proof sections.</p>
          </Card>
        </div>
      </Group>

      <Group title="Stats, progress, avatar">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Total views" value="12,480" hint="+8.2% this week" />
          <Stat label="Conversion" value="32.4%" hint="vs 28.1% last week" />
          <Card padding="md" className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>AM</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">Ada Mensah</p>
                <p className="text-xs text-text-muted">Design Branding</p>
              </div>
            </div>
            <Progress value={75} />
          </Card>
        </div>
      </Group>

      <Group title="Tabs and table">
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Author</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Ada Mensah</TableCell>
                  <TableCell><Badge variant="success">Approved</Badge></TableCell>
                  <TableCell className="text-right font-mono tabular-nums">1,284</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Tunde Bello</TableCell>
                  <TableCell><Badge variant="warning">Pending</Badge></TableCell>
                  <TableCell className="text-right font-mono tabular-nums">312</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="approved" className="text-sm text-text-muted">Approved testimonials.</TabsContent>
          <TabsContent value="pending" className="text-sm text-text-muted">Pending testimonials.</TabsContent>
        </Tabs>
      </Group>

      <Group title="Overlays and feedback">
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete testimonial?</DialogTitle>
                <DialogDescription>This removes it from every widget. You can&apos;t undo this.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button variant="danger">Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Actions <Icon name="alt-arrow-down" size="sm" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Testimonial</DropdownMenuLabel>
              <DropdownMenuItem><Icon name="pen" size="sm" /> Edit</DropdownMenuItem>
              <DropdownMenuItem><Icon name="link" size="sm" /> Copy link</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive><Icon name="trash-bin-minimalistic" size="sm" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Info">
                <Icon name="info-circle" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tooltips use the inverse surface</TooltipContent>
          </Tooltip>

          <Button variant="soft" onClick={() => notify.success("Testimonial approved", { description: "It is now live on your widget." })}>
            Success toast
          </Button>
          <Button variant="outline" onClick={() => notify.error("Could not save changes", { description: "Check your connection and try again." })}>
            Error toast
          </Button>
          <Button variant="outline" onClick={() => notify.promise(new Promise((r) => setTimeout(r, 1500)), { loading: "Saving…", success: "Saved", error: "Failed" })}>
            Promise toast
          </Button>
          <Button variant="outline-danger" onClick={async () => notify.info((await confirm({ title: "Delete this item?", description: "This cannot be undone.", confirmLabel: "Delete", tone: "danger" })) ? "Confirmed" : "Cancelled")}>
            Confirm dialog
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <EmptyState
            title="No testimonials yet"
            description="Share your collection link to start receiving video testimonials."
            action={<Button>Copy collection link</Button>}
          />
          <div className="space-y-3 rounded-card border bg-surface p-5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </Group>

      <Group title="Page header">
        <Card variant="flat" padding="md">
          <PageHeader
            eyebrow={<Badge variant="eyebrow">Spaces</Badge>}
            title="Your spaces"
            description="Each space collects testimonials for one product or client."
            actions={<Button><Icon name="add-circle" size="sm" /> New space</Button>}
          />
        </Card>
      </Group>
    </div>
  );
}
