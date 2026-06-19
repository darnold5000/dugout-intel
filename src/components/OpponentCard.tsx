"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAuthHeaders } from "@/lib/auth-headers";
import { formatDate } from "@/lib/utils";
import type { Opponent } from "@/types";
import { Calendar, MapPin, Trash2 } from "lucide-react";

interface OpponentCardProps {
  opponent: Opponent;
  uploadCount?: number;
  hasReport?: boolean;
}

export function OpponentCard({
  opponent,
  uploadCount = 0,
  hasReport = false,
}: OpponentCardProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/opponents/${opponent.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      setConfirmDelete(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
        <Link href={`/opponents/${opponent.id}`} className="flex-1">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-lg">{opponent.name}</CardTitle>
              <Badge variant="secondary">{opponent.age_level}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              {opponent.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {opponent.location}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Added {formatDate(opponent.created_at)}
              </div>
              <div className="flex gap-2 pt-1">
                <Badge variant="outline">{uploadCount} screenshots</Badge>
                {hasReport && <Badge variant="success">Report ready</Badge>}
              </div>
            </div>
          </CardContent>
        </Link>
        <div className="px-6 pb-4 no-print">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-8"
            onClick={(e) => {
              e.preventDefault();
              setConfirmDelete(true);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
        </div>
      </Card>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {opponent.name}?</DialogTitle>
            <DialogDescription>
              This removes all scout notes, screenshots, and reports for this
              opponent. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete opponent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
