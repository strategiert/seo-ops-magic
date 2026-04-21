import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WorkspaceProviderConvex } from "@/hooks/useWorkspaceConvex";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Projects from "./pages/Projects";
import Briefs from "./pages/Briefs";
import BriefDetail from "./pages/BriefDetail";
import Articles from "./pages/Articles";
import ArticleDetail from "./pages/ArticleDetail";
import ImportArticle from "./pages/ImportArticle";
import Templates from "./pages/Templates";
import TemplateDetail from "./pages/TemplateDetail";
import Settings from "./pages/Settings";
import BodycamDashboard from "./pages/BodycamDashboard";
import BodycamPagesList from "./pages/BodycamPagesList";
import BodycamPageEditor from "./pages/BodycamPageEditor";
import BodycamMedia from "./pages/BodycamMedia";
import BodycamPreview from "./pages/BodycamPreview";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <WorkspaceProviderConvex>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/briefs" element={<ProtectedRoute><Briefs /></ProtectedRoute>} />
            <Route path="/briefs/:id" element={<ProtectedRoute><BriefDetail /></ProtectedRoute>} />
            <Route path="/articles" element={<ProtectedRoute><Articles /></ProtectedRoute>} />
            <Route path="/articles/:id" element={<ProtectedRoute><ArticleDetail /></ProtectedRoute>} />
            <Route path="/import-article" element={<ProtectedRoute><ImportArticle /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
            <Route path="/templates/:id" element={<ProtectedRoute><TemplateDetail /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            {/* Bodycam CMS */}
            <Route path="/bodycam" element={<ProtectedRoute><BodycamDashboard /></ProtectedRoute>} />
            <Route path="/bodycam/pages" element={<ProtectedRoute><BodycamPagesList /></ProtectedRoute>} />
            <Route path="/bodycam/pages/:pageKey" element={<ProtectedRoute><BodycamPageEditor /></ProtectedRoute>} />
            <Route path="/bodycam/media" element={<ProtectedRoute><BodycamMedia /></ProtectedRoute>} />
            <Route path="/bodycam/preview/:pageKey/:lang" element={<ProtectedRoute><BodycamPreview /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </WorkspaceProviderConvex>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
