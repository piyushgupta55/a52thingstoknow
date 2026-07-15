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
import AuthConfirm from "./pages/AuthConfirm";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
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
import MemoryInvite from "./pages/MemoryInvite";
import HelpFaq from "./pages/HelpFaq";
import AncestrySection from "./pages/AncestrySection";
import FamilyHistorySection from "./pages/FamilyHistorySection";
import ChapterLibrary from "./pages/ChapterLibrary";
import BookReview from "./pages/BookReview";
import QuickRead from "./pages/QuickRead";
import ReviewPile from "./pages/ReviewPile";
import BookSettings from "./pages/BookSettings";
import FeedbackFab from "./components/feedback/FeedbackFab";

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
            <Route path="/auth/confirm" element={<AuthConfirm />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/new-book" element={<ProtectedRoute><NewBook /></ProtectedRoute>} />
            <Route path="/book/:bookId" element={<ProtectedRoute><BookDashboard /></ProtectedRoute>} />
            <Route path="/book/:bookId/chapters" element={<ProtectedRoute><ChapterGrid /></ProtectedRoute>} />
            <Route path="/book/:bookId/chapter/:chapterId" element={<ProtectedRoute><ChapterEditor /></ProtectedRoute>} />
            <Route path="/book/:bookId/preview" element={<ProtectedRoute><PreviewBook /></ProtectedRoute>} />
            <Route path="/book/:bookId/memories" element={<ProtectedRoute><MemoryManager /></ProtectedRoute>} />
            <Route path="/invite/:token" element={<MemoryInvite />} />
            <Route path="/help" element={<ProtectedRoute><HelpFaq /></ProtectedRoute>} />
            <Route path="/book/:bookId/ancestry" element={<ProtectedRoute><AncestrySection /></ProtectedRoute>} />
            <Route path="/book/:bookId/family-history" element={<ProtectedRoute><FamilyHistorySection /></ProtectedRoute>} />
            <Route path="/book/:bookId/library" element={<ProtectedRoute><ChapterLibrary /></ProtectedRoute>} />
            <Route path="/book/:bookId/review" element={<ProtectedRoute><BookReview /></ProtectedRoute>} />
            <Route path="/book/:bookId/quick-read" element={<ProtectedRoute><QuickRead /></ProtectedRoute>} />
            <Route path="/book/:bookId/pile/:pile" element={<ProtectedRoute><ReviewPile /></ProtectedRoute>} />
            <Route path="/book/:bookId/settings" element={<ProtectedRoute><BookSettings /></ProtectedRoute>} />
            <Route path="/library" element={<ProtectedRoute><ChapterLibrary /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/admin-setup" element={<ProtectedRoute><AdminSetup /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FeedbackFab />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
