import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import NewBook from "./pages/NewBook";
import BookDashboard from "./pages/BookDashboard";
import ChapterGrid from "./pages/ChapterGrid";
import ChapterEditor from "./pages/ChapterEditor";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import AdminSetup from "./pages/AdminSetup";
import PreviewBook from "./pages/PreviewBook";
import MemoryManager from "./pages/MemoryManager";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/new-book" element={<ProtectedRoute><NewBook /></ProtectedRoute>} />
            <Route path="/book/:bookId" element={<ProtectedRoute><BookDashboard /></ProtectedRoute>} />
            <Route path="/book/:bookId/chapters" element={<ProtectedRoute><ChapterGrid /></ProtectedRoute>} />
            <Route path="/book/:bookId/chapter/:chapterId" element={<ProtectedRoute><ChapterEditor /></ProtectedRoute>} />
            <Route path="/book/:bookId/preview" element={<ProtectedRoute><PreviewBook /></ProtectedRoute>} />
            <Route path="/book/:bookId/memories" element={<ProtectedRoute><MemoryManager /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/admin-setup" element={<ProtectedRoute><AdminSetup /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
