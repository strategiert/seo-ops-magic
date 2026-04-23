import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WorkspaceProviderConvex } from "@/hooks/useWorkspaceConvex";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LegacyRedirect } from "@/components/LegacyRedirect";
import Dashboard from "./pages/Dashboard";
import ProjectDashboard from "./pages/ProjectDashboard";
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
import Brand from "./pages/Brand";
import BodycamDashboard from "./pages/BodycamDashboard";
import BodycamPagesList from "./pages/BodycamPagesList";
import BodycamPageEditor from "./pages/BodycamPageEditor";
import BodycamMedia from "./pages/BodycamMedia";
import BodycamPreview from "./pages/BodycamPreview";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <WorkspaceProviderConvex>
          <Routes>
            <Route path="/auth" element={<Auth />} />

            {/* Global (non-project-scoped) */}
            <Route path="/" element={<P><Dashboard /></P>} />
            <Route path="/projects" element={<P><Projects /></P>} />
            <Route path="/settings" element={<P><Settings /></P>} />

            {/* Project-scoped tree */}
            <Route path="/projects/:projectId" element={<P><ProjectDashboard /></P>} />
            <Route path="/projects/:projectId/brand" element={<P><Brand /></P>} />
            <Route path="/projects/:projectId/briefs" element={<P><Briefs /></P>} />
            <Route path="/projects/:projectId/briefs/:id" element={<P><BriefDetail /></P>} />
            <Route path="/projects/:projectId/articles" element={<P><Articles /></P>} />
            <Route path="/projects/:projectId/articles/:id" element={<P><ArticleDetail /></P>} />
            <Route path="/projects/:projectId/import" element={<P><ImportArticle /></P>} />
            <Route path="/projects/:projectId/templates" element={<P><Templates /></P>} />
            <Route path="/projects/:projectId/templates/:id" element={<P><TemplateDetail /></P>} />
            <Route path="/projects/:projectId/settings" element={<P><Settings /></P>} />

            {/* Legacy redirects — old flat URLs to the new project-scoped tree */}
            <Route path="/brand" element={<P><LegacyRedirect suffix="brand" /></P>} />
            <Route path="/briefs" element={<P><LegacyRedirect suffix="briefs" /></P>} />
            <Route path="/briefs/:id" element={<P><LegacyRedirect suffix="briefs" passId /></P>} />
            <Route path="/articles" element={<P><LegacyRedirect suffix="articles" /></P>} />
            <Route path="/articles/:id" element={<P><LegacyRedirect suffix="articles" passId /></P>} />
            <Route path="/import-article" element={<P><LegacyRedirect suffix="import" /></P>} />
            <Route path="/templates" element={<P><LegacyRedirect suffix="templates" /></P>} />
            <Route path="/templates/:id" element={<P><LegacyRedirect suffix="templates" passId /></P>} />

            {/* Bodycam CMS — standalone, not project-scoped */}
            <Route path="/bodycam" element={<P><BodycamDashboard /></P>} />
            <Route path="/bodycam/pages" element={<P><BodycamPagesList /></P>} />
            <Route path="/bodycam/pages/:pageKey" element={<P><BodycamPageEditor /></P>} />
            <Route path="/bodycam/media" element={<P><BodycamMedia /></P>} />
            <Route path="/bodycam/preview/:pageKey/:lang" element={<P><BodycamPreview /></P>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </WorkspaceProviderConvex>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
