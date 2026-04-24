import { useNavigate, useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useUser, useClerk } from '@clerk/clerk-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  FileText,
  Settings,
  FolderKanban,
  Zap,
  ChevronUp,
  LogOut,
  PenTool,
  Building2,
  LayoutTemplate,
  LayoutDashboard,
  ChevronsUpDown,
  Check,
  Home,
  BarChart3,
} from 'lucide-react';
import { useWorkspaceConvex } from '@/hooks/useWorkspaceConvex';
import { TOUR_IDS } from '@/components/onboarding';

export function AppSidebar() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { projects, currentProject, setCurrentProject } = useWorkspaceConvex();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const userInitials = user?.fullName
    ? user.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : user?.primaryEmailAddress?.emailAddress?.charAt(0).toUpperCase() || 'U';

  // Detect which scope we're in based on the URL
  const inProjectScope = location.pathname.startsWith('/projects/') &&
    location.pathname.split('/').length >= 3;

  const projectPrefix = currentProject ? `/projects/${currentProject._id}` : null;

  const projectNavItems = projectPrefix
    ? [
        { title: 'Übersicht', url: projectPrefix, icon: LayoutDashboard, exact: true },
        { title: 'Brand', url: `${projectPrefix}/brand`, icon: Building2 },
        {
          title: 'Content Briefs',
          url: `${projectPrefix}/briefs`,
          icon: FileText,
          tourId: TOUR_IDS.SIDEBAR_BRIEFS,
        },
        {
          title: 'Artikel',
          url: `${projectPrefix}/articles`,
          icon: PenTool,
          tourId: TOUR_IDS.SIDEBAR_ARTICLES,
        },
        { title: 'Analytics', url: `${projectPrefix}/analytics`, icon: BarChart3 },
        { title: 'Templates', url: `${projectPrefix}/templates`, icon: LayoutTemplate },
        { title: 'Projekt-Einstellungen', url: `${projectPrefix}/settings`, icon: Settings },
      ]
    : [];

  const globalNavItems = [
    { title: 'Dashboard', url: '/', icon: Home, exact: true },
    { title: 'Projekte', url: '/projects', icon: FolderKanban, tourId: TOUR_IDS.SIDEBAR_PROJECTS },
    { title: 'Einstellungen', url: '/settings', icon: Settings, tourId: TOUR_IDS.SIDEBAR_SETTINGS },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Zap className="h-4 w-4" />
                </div>
                {!collapsed && (
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">SEO Content Ops</span>
                    <span className="text-2xs text-sidebar-muted">Suite</span>
                  </div>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Project switcher — only visible when we're in a project scope */}
          {inProjectScope && currentProject && (
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="w-full justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                        <FolderKanban className="h-3.5 w-3.5" />
                      </div>
                      {!collapsed && (
                        <span className="truncate text-sm font-medium">
                          {currentProject.name}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
                    )}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="start"
                  className="w-64"
                >
                  <DropdownMenuLabel>Projekt wechseln</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {projects.map((p) => (
                    <DropdownMenuItem
                      key={p._id}
                      onClick={() => setCurrentProject(p)}
                      className="flex items-center gap-2"
                    >
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{p.name}</span>
                      {p._id === currentProject._id && (
                        <Check className="h-4 w-4" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/projects')}>
                    <FolderKanban className="mr-2 h-4 w-4" />
                    Alle Projekte
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/')}>
                    <Home className="mr-2 h-4 w-4" />
                    Zum Dashboard
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        {/* Project-scoped nav */}
        {inProjectScope && projectNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Projekt</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {projectNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end={item.exact}
                        className="flex items-center gap-2"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                        id={item.tourId}
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Global nav — always visible */}
        <SidebarGroup>
          <SidebarGroupLabel>Global</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {globalNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.exact}
                      className="flex items-center gap-2"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      id={item.tourId}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <>
                      <div className="flex flex-col flex-1 text-left text-xs">
                        <span className="font-medium truncate">
                          {user?.fullName || 'Benutzer'}
                        </span>
                        <span className="text-sidebar-muted truncate">
                          {user?.primaryEmailAddress?.emailAddress}
                        </span>
                      </div>
                      <ChevronUp className="h-4 w-4" />
                    </>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Einstellungen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
