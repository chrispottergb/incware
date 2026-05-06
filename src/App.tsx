import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AddressBookProvider } from "@/contexts/AddressBookContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import SplashScreen from "@/components/SplashScreen";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";

// Lazy-loaded pages
const Auth = lazy(() => import("@/pages/Auth"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const CompanyDetail = lazy(() => import("@/pages/CompanyDetail"));
const MeetingDetail = lazy(() => import("@/pages/MeetingDetail"));
const Reports = lazy(() => import("@/pages/Reports"));
const ImportAccess = lazy(() => import("@/pages/ImportAccess"));
const OrgChart = lazy(() => import("@/pages/OrgChart"));
const Settings = lazy(() => import("@/pages/Settings"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
const ResourcesAdmin = lazy(() => import("@/pages/ResourcesAdmin"));
const Profile = lazy(() => import("@/pages/Profile"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const AnnualReviewPublic = lazy(() => import("@/pages/AnnualReviewPublic"));
const PendingReviews = lazy(() => import("@/pages/PendingReviews"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Unsubscribe = lazy(() => import("@/pages/Unsubscribe"));
const PromissoryNote = lazy(() => import("@/pages/PromissoryNote"));
const V2Layout = lazy(() => import("@/pages/v2/V2Layout"));
const DashboardV2 = lazy(() => import("@/pages/v2/DashboardV2"));
const ClientsV2 = lazy(() => import("@/pages/v2/ClientsV2"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <>
    <SplashScreen duration={3000} />
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <AddressBookProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/:id"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CompanyDetail />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/:id/meetings/:meetingId"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <MeetingDetail />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Reports />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/import-access"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ImportAccess />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-chart"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <OrgChart />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Settings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/users"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <UserManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/resources"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ResourcesAdmin />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Profile />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pending-reviews"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <PendingReviews />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/promissory-note"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <PromissoryNote />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/annual-review/:token" element={<AnnualReviewPublic />} />
            <Route path="/v2" element={<V2Layout />}>
              <Route index element={<DashboardV2 />} />
              <Route path="clients" element={<ClientsV2 />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AddressBookProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
  </>
);

export default App;
