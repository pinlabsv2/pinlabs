import { useRef, useState } from 'react';
import { ImageIcon, Link2, Loader2, Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useUpload } from '@/lib/upload';
import { Button } from '@/ui-kit/ui/button';
import { Input } from '@/ui-kit/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui-kit/ui/tabs';
import { cn } from '@/ui-kit/lib/utils';

function UploadButton({ accept, onUploaded, label }: { accept: string; onUploaded: (url: string) => void; label: string }) {
  const { upload, isUploading } = useUpload();
  const ref = useRef<HTMLInputElement>(null);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { const { url } = await upload(f); onUploaded(url); toast.success('Uploaded'); }
    catch (err: any) { toast.error(err?.message ?? 'Upload failed'); }
  };
  return (
    <>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={pick} />
      <Button type="button" variant="outline" className="w-full" disabled={isUploading} onClick={() => ref.current?.click()}>
        {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{label}
      </Button>
    </>
  );
}

export function ImagePicker({ value, onChange, library }: { value: string; onChange: (v: string) => void; library: string[] }) {
  return (
    <div className="flex gap-3">
      <div className="size-20 shrink-0 rounded-lg border bg-muted grid place-items-center overflow-hidden">
        {value ? <img src={value} alt="" className="size-full object-cover" /> : <ImageIcon className="size-6 text-muted-foreground" />}
      </div>
      <Tabs defaultValue="url" className="flex-1 min-w-0">
        <TabsList className="h-8"><TabsTrigger value="url" className="text-xs">URL</TabsTrigger><TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger><TabsTrigger value="library" className="text-xs">Library</TabsTrigger></TabsList>
        <TabsContent value="url"><div className="relative"><Link2 className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" /></div></TabsContent>
        <TabsContent value="upload"><UploadButton accept="image/*" label="Browse from device" onUploaded={onChange} /></TabsContent>
        <TabsContent value="library">
          {library.length === 0 ? <p className="text-xs text-muted-foreground">No images stored yet.</p> : (
            <div className="flex gap-2 overflow-x-auto pb-1">{library.map((u) => (
              <button type="button" key={u} onClick={() => onChange(u)} className={cn('size-12 shrink-0 rounded-md border-2 overflow-hidden', u === value ? 'border-primary' : 'border-transparent')}>
                <img src={u} alt="" className="size-full object-cover" /></button>
            ))}</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function PdfPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… (COA PDF link)" />
      <div className="flex gap-2 items-center">
        <div className="flex-1"><UploadButton accept="application/pdf" label="Upload PDF" onUploaded={onChange} /></div>
        {value && <Button type="button" variant="ghost" size="sm" asChild><a href={value} target="_blank" rel="noreferrer"><FileText className="size-4" />View</a></Button>}
      </div>
    </div>
  );
}
