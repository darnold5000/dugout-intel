"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const AGE_LEVELS = ["8U", "9U", "10U", "11U", "12U", "13U", "14U"];

export default function NewOpponentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    age_level: "9U",
    location: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/opponents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create opponent");
      setLoading(false);
      return;
    }

    const opponent = await res.json();
    router.push(`/opponents/${opponent.id}`);
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-lg">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/opponents">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>New Opponent</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Team name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="e.g. Eastside Crushers"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age_level">Age level</Label>
                <select
                  id="age_level"
                  value={form.age_level}
                  onChange={(e) =>
                    setForm({ ...form, age_level: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {AGE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location (optional)</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  placeholder="e.g. Portland, OR"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  placeholder="Tournament opponent, pool play game 2..."
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Create opponent"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
