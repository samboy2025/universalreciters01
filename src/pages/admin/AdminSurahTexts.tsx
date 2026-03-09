import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, BookOpen, Loader2, FileText, ToggleLeft, ToggleRight } from "lucide-react";

interface SurahData {
  id: string;
  surah_number: number;
  name_arabic: string;
  name_english: string;
  arabic_text: string;
  transliteration: string | null;
  total_ayahs: number | null;
  juz: number | null;
  is_active: boolean | null;
  created_at: string | null;
}

const AdminSurahTexts = () => {
  const [surahs, setSurahs] = useState<SurahData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSurah, setEditingSurah] = useState<SurahData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    surah_number: 1,
    name_arabic: "",
    name_english: "",
    arabic_text: "",
    transliteration: "",
    total_ayahs: 0,
    juz: 1,
    is_active: true,
  });
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSurahs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("surahs")
      .select("*")
      .order("surah_number", { ascending: true });
    if (data && !error) setSurahs(data);
    setIsLoading(false);
  };

  useEffect(() => { fetchSurahs(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        surah_number: formData.surah_number,
        name_arabic: formData.name_arabic,
        name_english: formData.name_english,
        arabic_text: formData.arabic_text,
        transliteration: formData.transliteration || null,
        total_ayahs: formData.total_ayahs || null,
        juz: formData.juz || null,
        is_active: formData.is_active,
      };

      if (editingSurah) {
        const { error } = await supabase.from("surahs").update(payload).eq("id", editingSurah.id);
        if (error) throw error;
        toast({ title: "Surah updated successfully" });
      } else {
        const { error } = await supabase.from("surahs").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        toast({ title: "Surah added successfully" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchSurahs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (surah: SurahData) => {
    setEditingSurah(surah);
    setFormData({
      surah_number: surah.surah_number,
      name_arabic: surah.name_arabic,
      name_english: surah.name_english,
      arabic_text: surah.arabic_text,
      transliteration: surah.transliteration || "",
      total_ayahs: surah.total_ayahs || 0,
      juz: surah.juz || 1,
      is_active: surah.is_active ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this Surah text? Users won't be able to practice with it anymore.")) return;
    const { error } = await supabase.from("surahs").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting", variant: "destructive" });
    } else {
      toast({ title: "Surah deleted" });
      fetchSurahs();
    }
  };

  const handleToggleActive = async (surah: SurahData) => {
    const { error } = await supabase
      .from("surahs")
      .update({ is_active: !surah.is_active })
      .eq("id", surah.id);
    if (!error) {
      toast({ title: surah.is_active ? "Surah deactivated" : "Surah activated" });
      fetchSurahs();
    }
  };

  const resetForm = () => {
    setEditingSurah(null);
    setFormData({
      surah_number: 1,
      name_arabic: "",
      name_english: "",
      arabic_text: "",
      transliteration: "",
      total_ayahs: 0,
      juz: 1,
      is_active: true,
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Recitation Checker — Surah Texts</h1>
            <p className="text-muted-foreground">Upload and manage Arabic text for each Surah so users can practice recitation</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Surah Text
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSurah ? "Edit Surah Text" : "Add Surah Text"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Surah Number *</Label>
                    <Input
                      type="number"
                      min="1"
                      max="114"
                      value={formData.surah_number}
                      onChange={(e) => setFormData({ ...formData, surah_number: parseInt(e.target.value) || 1 })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Juz Number</Label>
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={formData.juz}
                      onChange={(e) => setFormData({ ...formData, juz: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name in English *</Label>
                    <Input
                      placeholder="e.g. Al-Fatiha"
                      value={formData.name_english}
                      onChange={(e) => setFormData({ ...formData, name_english: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Name in Arabic *</Label>
                    <Input
                      placeholder="e.g. الفاتحة"
                      value={formData.name_arabic}
                      onChange={(e) => setFormData({ ...formData, name_arabic: e.target.value })}
                      dir="rtl"
                      className="text-right font-arabic"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Total Ayahs</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.total_ayahs}
                    onChange={(e) => setFormData({ ...formData, total_ayahs: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Arabic Text (Full Surah) *</Label>
                  <Textarea
                    value={formData.arabic_text}
                    onChange={(e) => setFormData({ ...formData, arabic_text: e.target.value })}
                    className="text-xl text-right font-arabic leading-loose"
                    dir="rtl"
                    rows={8}
                    placeholder="بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ..."
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste the complete Arabic text of the Surah. Each word will be used for the word-by-word recitation checker.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Transliteration (optional)</Label>
                  <Textarea
                    value={formData.transliteration}
                    onChange={(e) => setFormData({ ...formData, transliteration: e.target.value })}
                    rows={3}
                    placeholder="Bismillahi ar-rahmani ar-rahim..."
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label>Active (visible to users)</Label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving} className="flex-1">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {editingSurah ? "Update Surah" : "Add Surah"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{surahs.length}</p>
              <p className="text-sm text-muted-foreground">Total Surahs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-success">{surahs.filter(s => s.is_active).length}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-muted-foreground">{surahs.filter(s => !s.is_active).length}</p>
              <p className="text-sm text-muted-foreground">Inactive</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : surahs.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">No Surah texts uploaded yet</p>
                <p className="text-sm text-muted-foreground">Add Surah texts so users can practice recitation</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Arabic Name</TableHead>
                    <TableHead>Ayahs</TableHead>
                    <TableHead>Juz</TableHead>
                    <TableHead>Text Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {surahs.map((surah) => (
                    <TableRow key={surah.id}>
                      <TableCell>
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {surah.surah_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{surah.name_english}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-arabic text-lg" dir="rtl">{surah.name_arabic}</p>
                      </TableCell>
                      <TableCell>{surah.total_ayahs || "—"}</TableCell>
                      <TableCell>{surah.juz || "—"}</TableCell>
                      <TableCell>
                        <p className="font-arabic text-sm text-muted-foreground truncate max-w-[150px]" dir="rtl">
                          {surah.arabic_text?.substring(0, 40)}...
                        </p>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={surah.is_active ?? true}
                          onCheckedChange={() => handleToggleActive(surah)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(surah)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(surah.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSurahTexts;
