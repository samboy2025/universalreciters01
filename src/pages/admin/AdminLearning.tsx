import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, Youtube, Lock, Unlock, BookOpen, Eye, GraduationCap } from "lucide-react";

interface LearningVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  thumbnail_url: string | null;
  unlock_fee: number;
  duration: number | null;
  views: number | null;
  category: string | null;
  order_index: number | null;
  is_active: boolean | null;
  created_at: string | null;
}

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "tajweed", label: "Tajweed Rules" },
  { value: "makhaarij", label: "Makhaarij (Articulation)" },
  { value: "memorization", label: "Memorization Tips" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const extractYouTubeId = (url: string) => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const AdminLearning = () => {
  const [videos, setVideos] = useState<LearningVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<LearningVideo | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    youtube_url: "",
    unlock_fee: 0,
    duration: 0,
    category: "general",
    order_index: 0,
    is_active: true,
  });
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchVideos = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("learning_videos")
      .select("*")
      .order("order_index", { ascending: true });
    if (data && !error) setVideos(data);
    setIsLoading(false);
  };

  useEffect(() => { fetchVideos(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.youtube_url.trim()) {
      toast({ title: "YouTube URL is required", variant: "destructive" });
      return;
    }
    const ytId = extractYouTubeId(formData.youtube_url);
    if (!ytId) {
      toast({ title: "Please enter a valid YouTube URL", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      const payload = {
        title: formData.title,
        description: formData.description || null,
        youtube_url: formData.youtube_url,
        thumbnail_url: thumbnail,
        unlock_fee: formData.unlock_fee,
        duration: formData.duration || null,
        category: formData.category,
        order_index: formData.order_index,
        is_active: formData.is_active,
      };

      if (editingVideo) {
        const { error } = await supabase.from("learning_videos").update(payload).eq("id", editingVideo.id);
        if (error) throw error;
        toast({ title: "Learning video updated" });
      } else {
        const { error } = await supabase.from("learning_videos").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        toast({ title: "Learning video added" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchVideos();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (video: LearningVideo) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      description: video.description || "",
      youtube_url: video.youtube_url,
      unlock_fee: video.unlock_fee,
      duration: video.duration || 0,
      category: video.category || "general",
      order_index: video.order_index || 0,
      is_active: video.is_active ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this learning video?")) return;
    const { error } = await supabase.from("learning_videos").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting", variant: "destructive" });
    } else {
      toast({ title: "Video deleted" });
      fetchVideos();
    }
  };

  const handleToggleActive = async (video: LearningVideo) => {
    const { error } = await supabase
      .from("learning_videos")
      .update({ is_active: !video.is_active })
      .eq("id", video.id);
    if (!error) {
      toast({ title: video.is_active ? "Video hidden from users" : "Video published to users" });
      fetchVideos();
    }
  };

  const resetForm = () => {
    setEditingVideo(null);
    setFormData({
      title: "", description: "", youtube_url: "",
      unlock_fee: 0, duration: 0, category: "general", order_index: 0, is_active: true,
    });
  };

  const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
  const activeVideos = videos.filter(v => v.is_active).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Learning Materials</h1>
            <p className="text-muted-foreground">Manage educational videos displayed on the user learning page</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Learning Video
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingVideo ? "Edit Learning Video" : "Add Learning Video"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>YouTube URL *</Label>
                  <div className="flex gap-2 items-center">
                    <Youtube className="w-5 h-5 text-destructive flex-shrink-0" />
                    <Input
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={formData.youtube_url}
                      onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                    />
                  </div>
                  {formData.youtube_url && extractYouTubeId(formData.youtube_url) && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-border">
                      <img
                        src={`https://img.youtube.com/vi/${extractYouTubeId(formData.youtube_url)}/hqdefault.jpg`}
                        alt="Preview"
                        className="w-full h-32 object-cover"
                      />
                      <p className="text-xs text-muted-foreground p-2 text-center">✓ Valid YouTube URL detected</p>
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      placeholder="e.g. Introduction to Tajweed"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unlock Fee (₦)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.unlock_fee}
                      onChange={(e) => setFormData({ ...formData, unlock_fee: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">Set 0 for free access</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Order Index</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.order_index}
                      onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">Lower number = shown first</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Duration (seconds)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="What will users learn from this video?"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label>Published (visible to users)</Label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" disabled={isSaving} className="flex-1">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {editingVideo ? "Update Video" : "Add Video"}
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
              <p className="text-2xl font-bold text-foreground">{videos.length}</p>
              <p className="text-sm text-muted-foreground">Total Videos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-success">{activeVideos}</p>
              <p className="text-sm text-muted-foreground">Published</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{totalViews.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Views</p>
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
            ) : videos.length === 0 ? (
              <div className="text-center py-16">
                <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">No learning videos yet</p>
                <p className="text-sm text-muted-foreground">Add videos to display in /dashboard/learn</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Thumbnail</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((video, idx) => {
                    const ytId = extractYouTubeId(video.youtube_url);
                    const thumb = ytId
                      ? `https://img.youtube.com/vi/${ytId}/default.jpg`
                      : video.thumbnail_url;
                    const catLabel = CATEGORIES.find(c => c.value === video.category)?.label || video.category;
                    return (
                      <TableRow key={video.id}>
                        <TableCell className="text-muted-foreground font-mono text-sm">
                          {video.order_index ?? idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="w-16 h-10 rounded overflow-hidden bg-muted">
                            {thumb ? (
                              <img src={thumb} alt={video.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <BookOpen className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-foreground line-clamp-1">{video.title}</p>
                          {video.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{video.description}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{catLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          {video.unlock_fee === 0 ? (
                            <Badge variant="secondary" className="gap-1">
                              <Unlock className="w-3 h-3" /> Free
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <Lock className="w-3 h-3" /> ₦{video.unlock_fee}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-muted-foreground text-sm">
                            <Eye className="w-3 h-3" /> {video.views || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={video.is_active ?? true}
                            onCheckedChange={() => handleToggleActive(video)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(video)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(video.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminLearning;
