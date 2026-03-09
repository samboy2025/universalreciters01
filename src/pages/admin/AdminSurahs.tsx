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
import { Plus, Edit, Trash2, Video, Eye, Loader2, Youtube, Lock, Unlock } from "lucide-react";

interface VideoData {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  arabic_text: string;
  unlock_fee: number | null;
  duration: number | null;
  views: number | null;
  created_at: string;
}

const extractYouTubeId = (url: string) => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const getYoutubeThumbnail = (url: string) => {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
};

const AdminSurahs = () => {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoData | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    video_url: "",
    arabic_text: "",
    unlock_fee: 0,
    duration: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchVideos = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });
    if (data && !error) setVideos(data);
    setIsLoading(false);
  };

  useEffect(() => { fetchVideos(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.video_url.trim()) {
      toast({ title: "YouTube URL is required", variant: "destructive" });
      return;
    }

    const youtubeId = extractYouTubeId(formData.video_url);
    if (!youtubeId) {
      toast({ title: "Please enter a valid YouTube URL", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
      const thumbnail = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

      const payload = {
        title: formData.title,
        description: formData.description || null,
        video_url: embedUrl,
        thumbnail_url: thumbnail,
        arabic_text: formData.arabic_text,
        unlock_fee: formData.unlock_fee,
        duration: formData.duration || null,
      };

      if (editingVideo) {
        const { error } = await supabase.from("videos").update(payload).eq("id", editingVideo.id);
        if (error) throw error;
        toast({ title: "Recitation video updated" });
      } else {
        const { error } = await supabase.from("videos").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        toast({ title: "Recitation video added" });
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

  const handleEdit = (video: VideoData) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      description: video.description || "",
      video_url: video.video_url,
      arabic_text: video.arabic_text,
      unlock_fee: video.unlock_fee || 0,
      duration: video.duration || 0,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this recitation video?")) return;
    const { error } = await supabase.from("videos").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting", variant: "destructive" });
    } else {
      toast({ title: "Video deleted" });
      fetchVideos();
    }
  };

  const resetForm = () => {
    setEditingVideo(null);
    setFormData({ title: "", description: "", video_url: "", arabic_text: "", unlock_fee: 0, duration: 0 });
  };

  const totalVideos = videos.length;
  const freeVideos = videos.filter(v => !v.unlock_fee || v.unlock_fee === 0).length;
  const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Recitation Videos</h1>
            <p className="text-muted-foreground">Manage Surah recitation videos via YouTube</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Surah Video
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingVideo ? "Edit Surah Video" : "Add New Surah Video"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Surah Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Surah Al-Fatiha"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unlock_fee">Unlock Fee (₦)</Label>
                    <Input
                      id="unlock_fee"
                      type="number"
                      min="0"
                      value={formData.unlock_fee}
                      onChange={(e) => setFormData({ ...formData, unlock_fee: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">Set 0 for free access</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="youtube_url">YouTube URL *</Label>
                  <div className="flex gap-2 items-center">
                    <Youtube className="w-5 h-5 text-destructive flex-shrink-0" />
                    <Input
                      id="youtube_url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={formData.video_url}
                      onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                    />
                  </div>
                  {formData.video_url && extractYouTubeId(formData.video_url) && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-border">
                      <img
                        src={getYoutubeThumbnail(formData.video_url) || ""}
                        alt="YouTube thumbnail"
                        className="w-full h-32 object-cover"
                      />
                      <p className="text-xs text-muted-foreground p-2 text-center">✓ Valid YouTube URL detected</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    placeholder="Brief description of the Surah..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (seconds)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="0"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arabic_text">Arabic Text (for Recitation Checker) *</Label>
                  <Textarea
                    id="arabic_text"
                    value={formData.arabic_text}
                    onChange={(e) => setFormData({ ...formData, arabic_text: e.target.value })}
                    className="text-xl text-right font-arabic"
                    dir="rtl"
                    rows={5}
                    placeholder="أدخل النص العربي هنا..."
                    required
                  />
                  <p className="text-xs text-muted-foreground">This text will be shown to users during recitation practice</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                    Cancel
                  </Button>
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
              <p className="text-2xl font-bold text-foreground">{totalVideos}</p>
              <p className="text-sm text-muted-foreground">Total Surahs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-success">{freeVideos}</p>
              <p className="text-sm text-muted-foreground">Free Access</p>
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
                <Youtube className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">No recitation videos yet</p>
                <p className="text-sm text-muted-foreground">Add your first Surah video using the button above</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thumbnail</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Arabic Text</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((video) => {
                    const ytId = extractYouTubeId(video.video_url);
                    const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/default.jpg` : video.thumbnail_url;
                    return (
                      <TableRow key={video.id}>
                        <TableCell>
                          <div className="w-16 h-10 rounded overflow-hidden bg-muted">
                            {thumb ? (
                              <img src={thumb} alt={video.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Video className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-foreground">{video.title}</p>
                          {video.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{video.description}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {!video.unlock_fee || video.unlock_fee === 0 ? (
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
                          <span className="text-sm font-arabic" dir="rtl">
                            {video.arabic_text?.substring(0, 30)}...
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Eye className="w-4 h-4" /> {video.views || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(video.created_at).toLocaleDateString()}
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

export default AdminSurahs;
